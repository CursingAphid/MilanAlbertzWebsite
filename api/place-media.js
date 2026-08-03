// GET    ?prefix=trips/BRA/sao-paulo/ → { media: [...] } — public, read by
//        the Trips page. Served from the KV media manifest: NO blob list()
//        call, since those count against the monthly "advanced operations"
//        quota. The manifest is updated on uploads/deletes.
// POST   { prefix } → rescans that prefix with a single list() call and
//        updates the manifest — requires the admin session cookie
// DELETE { url } → removes one file and its manifest entry — requires the
//        admin session cookie
import { list, del } from '@vercel/blob'
import { hasValidSession, kvGet, kvSet } from './_utils.js'

const PREFIX_RE = /^trips\/[A-Z]{3}\/[a-z0-9-]+\/$/
const MANIFEST_KEY = 'media-manifest'

const toItem = (b) => ({
  url: b.url,
  pathname: b.pathname,
  size: b.size,
  uploadedAt: b.uploadedAt,
})

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const prefix = String(req.query.prefix ?? '')
      if (!PREFIX_RE.test(prefix)) {
        return res.status(400).json({ error: 'Invalid prefix' })
      }
      const manifest = (await kvGet(MANIFEST_KEY)) ?? {}
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400')
      return res.status(200).json({ media: manifest[prefix] ?? [] })
    }

    if (req.method === 'POST') {
      if (!hasValidSession(req)) {
        return res.status(401).json({ error: 'Not logged in' })
      }
      const prefix = String(req.body?.prefix ?? '')
      if (!PREFIX_RE.test(prefix)) {
        return res.status(400).json({ error: 'Invalid prefix' })
      }
      const { blobs } = await list({ prefix, limit: 100 })
      const manifest = (await kvGet(MANIFEST_KEY)) ?? {}
      manifest[prefix] = blobs.map(toItem)
      await kvSet(MANIFEST_KEY, manifest)
      return res.status(200).json({ media: manifest[prefix] })
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
      const manifest = (await kvGet(MANIFEST_KEY)) ?? {}
      for (const prefix of Object.keys(manifest)) {
        manifest[prefix] = manifest[prefix].filter((m) => m.url !== url)
      }
      await kvSet(MANIFEST_KEY, manifest)
      return res.status(200).json({ ok: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    return res.status(500).json({ error: String(err?.message ?? err) })
  }
}
