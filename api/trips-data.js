// The trips dataset (visited countries, their places, notes and descriptions).
// GET → { data: VisitedCountry[] | null } — public, read by the Trips page
// PUT → { data: VisitedCountry[] } — requires the admin session cookie
import { hasValidSession, kvGet, kvSet } from './_utils.js'

const KEY = 'trips-data'

const isValidPlace = (p) =>
  p &&
  typeof p === 'object' &&
  typeof p.name === 'string' &&
  p.name.trim().length >= 1 &&
  p.name.length <= 100 &&
  typeof p.lat === 'number' &&
  p.lat >= -90 &&
  p.lat <= 90 &&
  typeof p.lng === 'number' &&
  p.lng >= -180 &&
  p.lng <= 180 &&
  (p.description === undefined || (typeof p.description === 'string' && p.description.length <= 5000))

const isValidCountry = (c) =>
  c &&
  typeof c === 'object' &&
  /^[A-Z]{3}$/.test(c.code) &&
  (c.note === undefined || (typeof c.note === 'string' && c.note.length <= 300)) &&
  (c.description === undefined || (typeof c.description === 'string' && c.description.length <= 5000)) &&
  (c.places === undefined ||
    (Array.isArray(c.places) && c.places.length <= 200 && c.places.every(isValidPlace)))

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const data = await kvGet(KEY)
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json({ data })
    }

    if (req.method === 'PUT') {
      if (!hasValidSession(req)) {
        return res.status(401).json({ error: 'Not logged in' })
      }
      const data = req.body?.data
      if (!Array.isArray(data) || data.length > 500 || !data.every(isValidCountry)) {
        return res.status(400).json({ error: 'Invalid data shape' })
      }
      const codes = data.map((c) => c.code)
      if (new Set(codes).size !== codes.length) {
        return res.status(400).json({ error: 'Duplicate country codes' })
      }
      await kvSet(KEY, data)
      return res.status(200).json({ data })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    return res.status(500).json({ error: String(err?.message ?? err) })
  }
}
