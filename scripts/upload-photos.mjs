#!/usr/bin/env node
/**
 * Upload trip photos for one place: re-encode, push to Vercel Blob, update
 * the KV media manifest.
 *
 *   node scripts/upload-photos.mjs <ISO3> "<Place name>" [options]
 *
 *   node scripts/upload-photos.mjs PRT Lisbon
 *   node scripts/upload-photos.mjs AUT "Zell am See" --dir ~/Pictures/austria
 *   node scripts/upload-photos.mjs ESP "Gran Canaria" --dry-run
 *
 * Options
 *   --dir <path>   folder holding the photos (default ~/Downloads/trip-photo-uploads)
 *   --dry-run      show what would happen, touch nothing
 *   --force        upload even if the place isn't in the trips dataset yet
 *
 * What it does, and the rules it bakes in
 *   1. Reads .env / .env.local (quoted values ok). Tokens are never printed.
 *   2. Checks the place exists under that country in the live dataset, so
 *      photos can't land under a slug nothing points to.
 *   3. Reads the CURRENT manifest first and skips files whose name already
 *      sits in this place's gallery (you may have deleted others meanwhile;
 *      positions shift, and nothing is ever deleted here).
 *   4. Re-encodes images with macOS `sips` to JPEG, 1600px on the long side,
 *      quality 80 — the site only ever serves optimizer derivatives up to
 *      2048px, and originals would eat the 1 GB Hobby store. Videos are
 *      uploaded as they are. Filenames are sanitized ("012.Piazza del
 *      Campo.JPG" → "012-piazza-del-campo.jpg").
 *   5. Uploads every file ONCE with addRandomSuffix: Blob URLs are cached on
 *      the CDN for a long time, so re-using a pathname would keep serving
 *      the stale bytes. Each upload is recorded in a results file straight
 *      away, so an interrupted run leaves no orphaned, unlisted blobs.
 *   6. Never calls blob list() — those count against the monthly
 *      "advanced operations" quota. The manifest in KV is the source of truth.
 *   7. Gallery order: numbered album scans ("037.Roque Nublo") sort into the
 *      numbered run by their number; anything unnumbered keeps its place,
 *      new unnumbered files go on the end in filename order.
 *
 * Run it from the project root (it needs the project's @vercel/blob).
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { put } from '@vercel/blob'

// ---------------------------------------------------------------- args
const args = process.argv.slice(2)
const flags = new Set(args.filter((a) => a.startsWith('--') && !a.includes('=')))
const positional = args.filter((a) => !a.startsWith('--'))
const dirFlagIndex = args.indexOf('--dir')
const dir = path.resolve(
  (dirFlagIndex >= 0 ? args[dirFlagIndex + 1] : null) ??
    path.join(os.homedir(), 'Downloads', 'trip-photo-uploads')
)
if (dirFlagIndex >= 0) positional.splice(positional.indexOf(args[dirFlagIndex + 1]), 1)
const [countryCode, placeName] = positional
const dryRun = flags.has('--dry-run')
const force = flags.has('--force')

const fail = (msg) => {
  console.error(`\n✖ ${msg}`)
  process.exit(1)
}
if (!countryCode || !placeName || !/^[A-Z]{3}$/.test(countryCode)) {
  fail('usage: node scripts/upload-photos.mjs <ISO3> "<Place name>" [--dir <path>] [--dry-run] [--force]')
}

// ---------------------------------------------------------------- env
const env = {}
for (const f of ['.env', '.env.local']) {
  if (!fs.existsSync(f)) continue
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, '')
  }
}
const blobToken = env.BLOB_READ_WRITE_TOKEN
const kvUrl = env.TRIPS_KV_REST_API_URL || env.KV_REST_API_URL
const kvToken = env.TRIPS_KV_REST_API_TOKEN || env.KV_REST_API_TOKEN
if (!blobToken || !kvUrl || !kvToken) {
  fail('missing BLOB_READ_WRITE_TOKEN / TRIPS_KV_REST_API_URL / TRIPS_KV_REST_API_TOKEN in .env or .env.local (run from the project root)')
}
const kvHeaders = { Authorization: `Bearer ${kvToken}` }
const kvGet = async (key) => {
  const res = await fetch(`${kvUrl}/get/${key}`, { headers: kvHeaders })
  if (!res.ok) fail(`KV read failed (${res.status})`)
  const { result } = await res.json()
  return result ? JSON.parse(result) : null
}
const kvSet = async (key, value) => {
  const res = await fetch(`${kvUrl}/set/${key}`, { method: 'POST', headers: kvHeaders, body: JSON.stringify(value) })
  if (!res.ok) fail(`KV write failed (${res.status})`)
}

// ---------------------------------------------------------------- helpers
// same slug rule as src/utils/placeMedia.ts (kept in sync by hand: this
// script can't import the TypeScript source)
const placeSlug = (name) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

/** "012.Piazza del Campo" -> "012-piazza-del-campo" */
const safeStem = (stem) => placeSlug(stem)

/** the photo's original stem from a suffixed blob pathname */
const stemOf = (pathname) =>
  decodeURIComponent(pathname.split('/').pop()).replace(/-[A-Za-z0-9]{30}\.[a-z0-9]+$/i, '')

const albumNo = (stem) => {
  const m = stem.match(/^(\d+)/)
  return m ? Number(m[1]) : null
}

const IMAGE_EXT = /\.(heic|heif|jpe?g|png|tiff?|webp)$/i
const VIDEO_EXT = /\.(mp4|mov|m4v|webm)$/i

// ---------------------------------------------------------------- plan
const prefix = `trips/${countryCode}/${placeSlug(placeName)}/`
console.log(`\nUploading to ${prefix}`)
console.log(`from ${dir}${dryRun ? '  (dry run)' : ''}`)

const data = await kvGet('trips-data')
const country = data?.find((c) => c.code === countryCode)
const place = country?.places?.find((p) => p.name === placeName)
if (!place) {
  const hint = country
    ? `known places for ${countryCode}: ${(country.places ?? []).map((p) => p.name).join(', ') || 'none'}`
    : `no country ${countryCode} in the dataset`
  if (!force) fail(`"${placeName}" is not a place under ${countryCode} (${hint}). Add it in /trips/admin first, or pass --force.`)
  console.warn(`! "${placeName}" is not in the dataset (${hint}) — continuing because of --force`)
}

if (!fs.existsSync(dir)) fail(`folder not found: ${dir}`)
const files = fs
  .readdirSync(dir)
  .filter((f) => !f.startsWith('.') && (IMAGE_EXT.test(f) || VIDEO_EXT.test(f)))
  .sort()
if (files.length === 0) fail('no photos or videos in the folder')

const manifest = (await kvGet('media-manifest')) ?? {}
const existing = manifest[prefix] ?? []
const existingStems = new Set(existing.map((x) => stemOf(x.pathname)))
const fresh = []
for (const f of files) {
  const stem = f.replace(/\.[^.]+$/, '')
  if (existingStems.has(stem) || existingStems.has(safeStem(stem))) console.log(`  skip  ${f}  (already in this gallery)`)
  else fresh.push(f)
}
if (fresh.length === 0) fail('nothing new to upload')
const totalMb = fresh.reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0) / 1048576
console.log(`\n${fresh.length} new file(s), ${totalMb.toFixed(1)} MB; ${existing.length} already in the gallery`)
for (const f of fresh) console.log(`  + ${f}  →  ${safeStem(f.replace(/\.[^.]+$/, ''))}${VIDEO_EXT.test(f) ? path.extname(f).toLowerCase() : '.jpg'}`)
if (dryRun) {
  console.log('\nDry run — nothing encoded or uploaded.')
  process.exit(0)
}

// ---------------------------------------------------------------- encode
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'trip-upload-'))
const resultsPath = path.join(work, 'upload-results.json')
console.log(`\nEncoding into ${work}`)
const prepared = []
for (const f of fresh) {
  const stem = safeStem(f.replace(/\.[^.]+$/, ''))
  const src = path.join(dir, f)
  if (VIDEO_EXT.test(f)) {
    prepared.push({ name: `${stem}${path.extname(f).toLowerCase()}`, file: src, contentType: 'video/mp4' })
    continue
  }
  const out = path.join(work, `${stem}.jpg`)
  try {
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '80', '-Z', '1600', src, '--out', out], { stdio: 'ignore' })
  } catch {
    fail(`sips failed on ${f} (this script relies on macOS sips for re-encoding)`)
  }
  prepared.push({ name: `${stem}.jpg`, file: out, contentType: 'image/jpeg' })
}
const encodedMb = prepared.reduce((n, p) => n + fs.statSync(p.file).size, 0) / 1048576
console.log(`encoded ${prepared.length} file(s), ${encodedMb.toFixed(1)} MB`)

// ---------------------------------------------------------------- upload
console.log('\nUploading')
const results = []
for (const p of prepared) {
  const buf = fs.readFileSync(p.file)
  const blob = await put(prefix + p.name, buf, {
    access: 'public',
    addRandomSuffix: true,
    contentType: p.contentType,
    token: blobToken,
  })
  results.push({ url: blob.url, pathname: blob.pathname, size: buf.length, uploadedAt: new Date().toISOString() })
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2))
  console.log(`  ok  ${blob.pathname}`)
}

// ---------------------------------------------------------------- manifest
// re-read right before writing: the admin page may have changed it meanwhile
const latest = (await kvGet('media-manifest')) ?? {}
const current = latest[prefix] ?? []
const all = [...current, ...results]
const numbered = all
  .filter((x) => albumNo(stemOf(x.pathname)) !== null)
  .sort((a, b) => albumNo(stemOf(a.pathname)) - albumNo(stemOf(b.pathname)))
const rest = all.filter((x) => albumNo(stemOf(x.pathname)) === null)
latest[prefix] = [...numbered, ...rest]
await kvSet('media-manifest', latest)

const check = (await kvGet('media-manifest')) ?? {}
const got = check[prefix] ?? []
console.log(`\nManifest: ${current.length} → ${got.length} entries under ${prefix}`)
console.log(`Order: ${got.map((x) => stemOf(x.pathname)).join(' | ')}`)
console.log(`\nUpload record kept at ${resultsPath}`)
console.log('The originals in the folder were left alone. Production caches the gallery list for ~5 minutes.')
