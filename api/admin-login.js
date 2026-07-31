// POST   { username, password } → sets an httpOnly session cookie on success
// GET    → 200 when a valid session cookie is present, 401 otherwise
// DELETE → clears the session cookie (logout)
import { safeEqual, createSessionCookie, clearSessionCookie, hasValidSession } from './_utils.js'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const loggedIn = hasValidSession(req)
    return res.status(loggedIn ? 200 : 401).json({ loggedIn })
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', clearSessionCookie())
    return res.status(200).json({ loggedIn: false })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const expectedUser = process.env.ADMIN_USERNAME || 'Milan'
  const expectedPass = process.env.ADMIN_PASSWORD
  if (!expectedPass) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD is not configured in Vercel' })
  }

  const { username, password } = req.body ?? {}
  if (!safeEqual(username ?? '', expectedUser) || !safeEqual(password ?? '', expectedPass)) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  res.setHeader('Set-Cookie', createSessionCookie())
  return res.status(200).json({ loggedIn: true })
}
