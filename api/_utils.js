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

// --- Storage: Supabase (preferred) or Upstash Redis, via REST, no npm deps ---

const NOT_CONFIGURED =
  'Storage is not configured — set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (Supabase) ' +
  'or add the Upstash for Redis integration (Vercel → project → Storage)'

const supabaseEnv = () => {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && key ? { url, key } : null
}

const redisEnv = () => {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? { url, token } : null
}

/** Returns the notes map { [iso3 code]: description }. */
export const loadNotes = async () => {
  const sb = supabaseEnv()
  if (sb) {
    const res = await fetch(`${sb.url}/rest/v1/country_notes?select=code,description`, {
      headers: { apikey: sb.key, Authorization: `Bearer ${sb.key}` },
    })
    if (!res.ok) throw new Error(`Supabase read failed (${res.status}) — does the country_notes table exist?`)
    const rows = await res.json()
    return Object.fromEntries(rows.map((row) => [row.code, row.description]))
  }

  const redis = redisEnv()
  if (redis) {
    const res = await fetch(`${redis.url}/get/country-notes`, {
      headers: { Authorization: `Bearer ${redis.token}` },
    })
    if (!res.ok) throw new Error(`Storage read failed (${res.status})`)
    const data = await res.json()
    return data.result ? JSON.parse(data.result) : {}
  }

  throw new Error(NOT_CONFIGURED)
}

/** Persists the notes map { [iso3 code]: description }. */
export const saveNotes = async (notes) => {
  const sb = supabaseEnv()
  if (sb) {
    const rows = Object.entries(notes).map(([code, description]) => ({ code, description }))
    const res = await fetch(`${sb.url}/rest/v1/country_notes`, {
      method: 'POST',
      headers: {
        apikey: sb.key,
        Authorization: `Bearer ${sb.key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(rows),
    })
    if (!res.ok) throw new Error(`Supabase write failed (${res.status}) — does the country_notes table exist?`)
    return
  }

  const redis = redisEnv()
  if (redis) {
    const res = await fetch(`${redis.url}/set/country-notes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${redis.token}` },
      body: JSON.stringify(notes),
    })
    if (!res.ok) throw new Error(`Storage write failed (${res.status})`)
    return
  }

  throw new Error(NOT_CONFIGURED)
}
