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
      res.setHeader('Cache-Control', 'no-store')
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
