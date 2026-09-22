// Open Graph image for a trips share: the country's (or place's) painted
// scene with its name over it, 1200x630 PNG.
//
//   /api/og                          the generic "Where I've been" card
//   /api/og?country=HUN              Hungary: the Budapest scene
//   /api/og?country=PRT&place=lisbon Lisbon: the Lisbon scene
//
// Satori lays the card out as SVG, resvg rasterizes it. A plain Node
// function: @vercel/og's Edge bundle doesn't build outside Next.js. Fonts
// are embedded (api/_fonts.js), so nothing is fetched for text; the scene
// is the card's motionless "-static" SVG twin, read from public/frames when
// the bundle has it and fetched from this deployment otherwise, embedded as
// a data URI so a missing file degrades to the plain backdrop. Flags are
// twemoji glyphs fetched per render (one or two small SVGs).
import fs from 'node:fs'
import path from 'node:path'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { kvGet } from './_utils.js'
import { INTER_400_WOFF_BASE64, INTER_800_WOFF_BASE64 } from './_fonts.js'
import { describe, originOf, parseTarget } from './_og-data.js'

// Satori shapes text with harfbuzzjs, which reads its wasm from disk next to
// its own module at runtime — a read the function bundler can't see, so the
// file would be missing in production (ENOENT hb.wasm). Reading it here via
// a static path is what the bundler's asset tracing looks for; it lands in
// the bundle at the same relative location harfbuzzjs expects. `includeFiles`
// can't do this: it ignores node_modules paths.
const HB_WASM = path.join(process.cwd(), 'node_modules', 'harfbuzzjs', 'hb.wasm')
try {
  fs.readFileSync(HB_WASM)
} catch {
  // only matters at bundle time; at runtime harfbuzzjs does its own loading
}

const WIDTH = 1200
const HEIGHT = 630
// the 400x600 scene scaled to the card's width and cropped to the band
// that holds its skyline (y≈200-410 of the scene), like the card does
const SCENE_H = (WIDTH / 400) * 600
const SCENE_TOP = -(200 / 600) * SCENE_H

const FONTS = [
  { name: 'Inter', data: Buffer.from(INTER_800_WOFF_BASE64, 'base64'), weight: 800, style: 'normal' },
  { name: 'Inter', data: Buffer.from(INTER_400_WOFF_BASE64, 'base64'), weight: 400, style: 'normal' },
]

// Satori's element shape without JSX. Satori insists on `display: flex`
// for any node whose children are an array, so childless nodes get no
// children key at all.
const h = (type, props, ...children) => ({
  type,
  props: {
    ...props,
    ...(children.length === 0 ? {} : { children: children.length === 1 ? children[0] : children }),
  },
})

const fetchWithTimeout = async (url, ms) => {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}

const toDataUri = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`

/** The scene as a data URI, or null when it can't be had. */
const loadScene = async (origin, scene) => {
  if (!scene) return null
  const local = path.join(process.cwd(), 'public', 'frames', `${scene}-static.svg`)
  try {
    if (fs.existsSync(local)) return toDataUri(fs.readFileSync(local, 'utf8'))
  } catch {
    // fall through to the network
  }
  try {
    const res = await fetchWithTimeout(`${origin}/frames/${scene}-static.svg`, 4000)
    return res.ok ? toDataUri(await res.text()) : null
  } catch {
    return null
  }
}

/** twemoji glyph for an emoji segment (flags are two regional indicators) */
const loadEmoji = async (code, segment) => {
  if (code !== 'emoji') return ''
  const hex = [...segment].map((c) => c.codePointAt(0).toString(16)).join('-')
  try {
    const res = await fetchWithTimeout(`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${hex}.svg`, 4000)
    return res.ok ? toDataUri(await res.text()) : ''
  } catch {
    return ''
  }
}

/** The country's visited place names from the dataset, or [] on any hiccup. */
const placesFor = async (code) => {
  try {
    const data = await kvGet('trips-data')
    return data?.find((c) => c.code === code)?.places?.map((p) => p.name) ?? []
  } catch {
    return []
  }
}

const buildTree = (card, sceneUri) =>
  h(
    'div',
    {
      style: {
        width: WIDTH,
        height: HEIGHT,
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #1b1f3a 0%, #3b1d4d 55%, #10131f 100%)',
        color: '#eeeeee',
        fontFamily: 'Inter',
      },
    },
    // the scene, cropped to its skyline band
    ...(sceneUri
      ? [
          h('img', {
            src: sceneUri,
            width: WIDTH,
            height: SCENE_H,
            style: { position: 'absolute', top: SCENE_TOP, left: 0, width: WIDTH, height: SCENE_H },
          }),
        ]
      : []),
    // a dusk gradient so the lettering reads on any sky
    h('div', {
      style: {
        display: 'flex',
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 360,
        background:
          'linear-gradient(180deg, rgba(10,12,24,0) 0%, rgba(10,12,24,0.72) 55%, rgba(10,12,24,0.92) 100%)',
      },
    }),
    // site tag, top left
    h(
      'div',
      {
        style: {
          position: 'absolute',
          top: 36,
          left: 48,
          display: 'flex',
          alignItems: 'center',
          padding: '10px 18px',
          borderRadius: 999,
          background: 'rgba(10,12,24,0.55)',
          border: '1px solid rgba(255,255,255,0.18)',
          fontSize: 26,
          fontWeight: 400,
          letterSpacing: 1,
        },
      },
      '🌍  milanalbertz.nl/trips'
    ),
    // heading and subtitle, bottom left
    h(
      'div',
      { style: { position: 'absolute', left: 48, right: 48, bottom: 44, display: 'flex', flexDirection: 'column' } },
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', fontSize: 96, fontWeight: 800, lineHeight: 1.05 } },
        h('span', { style: { marginRight: 28 } }, card.flag),
        h('span', {}, card.heading)
      ),
      h(
        'div',
        { style: { display: 'flex', marginTop: 18, fontSize: 36, fontWeight: 400, color: 'rgba(238,238,238,0.85)' } },
        card.subtitle
      )
    )
  )

export default async function handler(req, res) {
  try {
    const target = parseTarget(req.query ?? {})
    const places = target ? await placesFor(target.code) : []
    const card = describe(target, places)
    const sceneUri = await loadScene(originOf(req), card.scene)
    const svg = await satori(buildTree(card, sceneUri), {
      width: WIDTH,
      height: HEIGHT,
      fonts: FONTS,
      loadAdditionalAsset: loadEmoji,
    })
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH }, font: { loadSystemFonts: false } })
      .render()
      .asPng()
    res.setHeader('Content-Type', 'image/png')
    // crawlers re-fetch rarely; a day at the edge is plenty and cheap
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800')
    return res.status(200).send(Buffer.from(png))
  } catch (err) {
    return res.status(500).json({ error: String(err?.message ?? err) })
  }
}
