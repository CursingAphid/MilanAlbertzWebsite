// GET    ?prefix=trips/BRA/sao-paulo/ → { media: [...] } — public, read by the Trips page
// DELETE { url } → removes one file — requires the admin session cookie
import { list, del } from '@vercel/blob'
import { hasValidSession } from './_utils.js'

const PREFIX_RE = /^trips\/[A-Z]{3}\/[a-z0-9-]+\/$/

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const prefix = String(req.query.prefix ?? '')
      if (!PREFIX_RE.test(prefix)) {
        return res.status(400).json({ error: 'Invalid prefix' })
      }
      const { blobs } = await list({ prefix, limit: 100 })
      // Blob list() calls count against the monthly "advanced operations"
      // quota — let the CDN serve repeat views for 10 minutes (a day when
      // stale) instead of hitting the store every time. The admin page
      // busts this with a cache-buster param after uploads.
      res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400')
      return res.status(200).json({
        media: blobs.map((b) => ({
          url: b.url,
          pathname: b.pathname,
          size: b.size,
          uploadedAt: b.uploadedAt,
        })),
      })
    }

    if (req.method === 'DELETE') {
      if (!hasValidSession(req)) {
        return res.status(401).json({ error: 'Not logged in' })
      }
      const url = req.body?.url
      if (typeof url !== 'string' || !url.includes('/trips/')) {
        return res.status(400).json({ error: 'Invalid url' })
      }
      await del(url)
      return res.status(200).json({ ok: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    return res.status(500).json({ error: String(err?.message ?? err) })
  }
}
