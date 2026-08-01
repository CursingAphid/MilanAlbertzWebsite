// Shared helpers for the admin API. Files prefixed with "_" in /api are not
// exposed as serverless functions by Vercel.
//
// Required environment variables (set in the Vercel dashboard):
//   ADMIN_PASSWORD          – the admin password (never hardcode it!)
//   ADMIN_USERNAME          – optional, defaults to "Milan"
//   ADMIN_SESSION_SECRET    – optional, separate key for signing sessions
// Storage (either one):
//   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY – from the Supabase integration
//     (Vercel → project → Storage → Supabase) or supabase.com → Settings → API.
//     Table (run once in the Supabase SQL editor):
//       create table country_notes (code text primary key, description text not null default '');
//       alter table country_notes enable row level security;
//   KV_REST_API_URL/TOKEN   – alternative: the Upstash for Redis integration
import { createHmac, timingSafeEqual } from 'node:crypto'

const SESSION_COOKIE = 'admin_session'
const SESSION_TTL_MS = 24 * 60 * 60 * 1000 // 24h

const sessionSecret = () => process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || ''

const sign = (payload) => createHmac('sha256', sessionSecret()).update(payload).digest('hex')

export const safeEqual = (a, b) => {
  const bufA = Buffer.from(String(a))
  const bufB = Buffer.from(String(b))
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

export const createSessionCookie = () => {
  const expires = Date.now() + SESSION_TTL_MS
  const token = `${expires}.${sign(String(expires))}`
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=${SESSION_TTL_MS / 1000}`
}

export const clearSessionCookie = () =>
  `${SESSION_COOKIE}=; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=0`

export const hasValidSession = (req) => {
  const cookies = req.headers.cookie || ''
  const pair = cookies.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`))
  if (!pair) return false
  const [expires, sig] = pair.slice(SESSION_COOKIE.length + 1).split('.')
  if (!expires || !sig) return false
  if (!/^\d+$/.test(expires) || Number(expires) < Date.now()) return false
  return safeEqual(sig, sign(String(expires)))
}

// --- Storage: Upstash Redis (Vercel KV) via REST, no npm deps ---

const NOT_CONFIGURED =
  'Storage is not configured — add the Upstash for Redis integration (Vercel → project → Storage tab)'

const redisEnv = () => {
  const url =
    process.env.TRIPS_KV_REST_API_URL ||
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL
  const token =
    process.env.TRIPS_KV_REST_API_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? { url, token } : null
}

/** Reads a JSON value by key; null when the key doesn't exist. */
export const kvGet = async (key) => {
  const redis = redisEnv()
  if (!redis) throw new Error(NOT_CONFIGURED)
  const res = await fetch(`${redis.url}/get/${key}`, {
    headers: { Authorization: `Bearer ${redis.token}` },
  })
  if (!res.ok) throw new Error(`Storage read failed (${res.status})`)
  const data = await res.json()
  return data.result ? JSON.parse(data.result) : null
}

/** Writes a JSON value under a key. */
export const kvSet = async (key, value) => {
  const redis = redisEnv()
  if (!redis) throw new Error(NOT_CONFIGURED)
  const res = await fetch(`${redis.url}/set/${key}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${redis.token}` },
    body: JSON.stringify(value),
  })
  if (!res.ok) throw new Error(`Storage write failed (${res.status})`)
}
