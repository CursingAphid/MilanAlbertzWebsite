// GET → { notes: { [iso3]: string } } — public, read by the Trips page
// PUT → { notes: { [iso3]: string } } — requires the admin session cookie
import { hasValidSession, loadNotes, saveNotes } from './_utils.js'

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const notes = await loadNotes()
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json({ notes })
    }

    if (req.method === 'PUT') {
      if (!hasValidSession(req)) {
        return res.status(401).json({ error: 'Not logged in' })
      }
      const notes = req.body?.notes
      if (!notes || typeof notes !== 'object' || Array.isArray(notes)) {
        return res.status(400).json({ error: 'Body must be { notes: { [countryCode]: string } }' })
      }
      for (const [code, text] of Object.entries(notes)) {
        if (!/^[A-Z]{3}$/.test(code) || typeof text !== 'string' || text.length > 5000) {
          return res.status(400).json({ error: `Invalid entry: ${code}` })
        }
      }
      await saveNotes(notes)
      return res.status(200).json({ notes })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    return res.status(500).json({ error: String(err?.message ?? err) })
  }
}
