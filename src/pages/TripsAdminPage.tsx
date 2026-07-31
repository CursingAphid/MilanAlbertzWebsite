import { useEffect, useState } from 'react'
import { LogOut, Save, Trash2, Upload } from 'lucide-react'
import { upload } from '@vercel/blob/client'
import NavBar from '../components/NavBar'
import { visitedCountries } from '../data/visitedCountries'
import type { VisitedPlace } from '../data/visitedCountries'
import { mediaPrefix, isVideo } from '../utils/placeMedia'
import type { MediaItem } from '../utils/placeMedia'

type AuthState = 'checking' | 'loggedOut' | 'loggedIn'

export default function TripsAdminPage() {
  const [auth, setAuth] = useState<AuthState>('checking')
  const [apiUnavailable, setApiUnavailable] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  // Media per place, keyed by the blob folder prefix
  const [media, setMedia] = useState<Record<string, MediaItem[]>>({})
  const [uploadBusy, setUploadBusy] = useState<Record<string, boolean>>({})

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Check for an existing session. A non-JSON response means the request was
  // answered by the SPA fallback (no serverless runtime) — API unavailable.
  useEffect(() => {
    fetch('/api/admin-login')
      .then((res) => {
        const isJson = res.headers.get('content-type')?.includes('application/json')
        if (!isJson) {
          setAuth('loggedOut')
          setApiUnavailable(true)
        } else if (res.status === 200) {
          setAuth('loggedIn')
        } else {
          setAuth('loggedOut')
          if (res.status !== 401) setApiUnavailable(true)
        }
      })
      .catch(() => {
        setAuth('loggedOut')
        setApiUnavailable(true)
      })
  }, [])

  // Once logged in, load the stored notes and merge with the bundled defaults
  useEffect(() => {
    if (auth !== 'loggedIn') return
    fetch('/api/country-notes')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('load failed'))))
      .then((data) => {
        const merged: Record<string, string> = {}
        for (const country of visitedCountries) {
          merged[country.code] = data.notes?.[country.code] ?? country.description ?? ''
        }
        setNotes(merged)
      })
      .catch(() => setStatus('Could not load stored texts — showing the defaults from the code.'))
  }, [auth])

  const refreshMedia = async (countryCode: string, placeName: string) => {
    const prefix = mediaPrefix(countryCode, placeName)
    try {
      const res = await fetch(`/api/place-media?prefix=${encodeURIComponent(prefix)}`)
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json()
        setMedia((prev) => ({ ...prev, [prefix]: data.media ?? [] }))
      }
    } catch {
      /* media listing is best-effort */
    }
  }

  // Load existing media for every place once logged in
  useEffect(() => {
    if (auth !== 'loggedIn') return
    for (const country of visitedCountries) {
      for (const place of country.places ?? []) {
        refreshMedia(country.code, place.name)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth])

  const handleMediaUpload = async (countryCode: string, place: VisitedPlace, files: FileList | null) => {
    if (!files || files.length === 0) return
    const prefix = mediaPrefix(countryCode, place.name)
    setUploadBusy((prev) => ({ ...prev, [prefix]: true }))
    setStatus(null)
    try {
      for (const file of Array.from(files)) {
        await upload(`${prefix}${file.name}`, file, {
          access: 'public',
          handleUploadUrl: '/api/media-upload',
        })
      }
      await refreshMedia(countryCode, place.name)
      setStatus(`Uploaded ${files.length} file(s) to ${place.name}.`)
    } catch (err) {
      setStatus(`Upload failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setUploadBusy((prev) => ({ ...prev, [prefix]: false }))
    }
  }

  const handleMediaDelete = async (countryCode: string, placeName: string, url: string) => {
    try {
      const res = await fetch('/api/place-media', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setStatus(`Delete failed: ${data?.error ?? res.status}`)
        return
      }
      await refreshMedia(countryCode, placeName)
    } catch {
      setStatus('Delete failed: could not reach the API.')
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(null)
    try {
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (!res.headers.get('content-type')?.includes('application/json')) {
        setLoginError('The admin API is not running here. Deploy to Vercel or use `npx vercel dev` locally.')
        return
      }
      if (res.ok) {
        setPassword('')
        setAuth('loggedIn')
      } else {
        const data = await res.json().catch(() => null)
        setLoginError(data?.error ?? `Login failed (${res.status})`)
      }
    } catch {
      setLoginError('Could not reach the login API. Run via `npx vercel dev` locally, or deploy to Vercel.')
    }
  }

  const handleLogout = async () => {
    await fetch('/api/admin-login', { method: 'DELETE' }).catch(() => {})
    setAuth('loggedOut')
  }

  const handleSave = async () => {
    setSaving(true)
    setStatus(null)
    try {
      const res = await fetch('/api/country-notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      if (res.ok) {
        setStatus('Saved — the texts are live.')
      } else {
        const data = await res.json().catch(() => null)
        setStatus(`Save failed: ${data?.error ?? res.status}`)
      }
    } catch {
      setStatus('Save failed: could not reach the API.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950">
      <NavBar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <h1 className="text-3xl font-bold text-on-dark mb-2">Trips admin</h1>
        <p className="text-muted-on-dark text-sm mb-8">
          Edit the country texts shown on the Trips globe. Changes go live for all visitors as soon as you save.
        </p>

        {apiUnavailable && (
          <div className="mb-6 rounded-lg border border-yellow-600 bg-yellow-900/30 text-yellow-200 text-sm px-4 py-3">
            The admin API is not reachable. It only runs on Vercel (or locally via <code>npx vercel dev</code>),
            and needs <code>ADMIN_PASSWORD</code> plus a storage integration (Upstash for Redis or Supabase,
            via the project&apos;s Storage tab) configured in the Vercel dashboard.
          </div>
        )}

        {auth === 'checking' && <p className="text-muted-on-dark">Checking session…</p>}

        {auth === 'loggedOut' && (
          <form onSubmit={handleLogin} className="bg-card-dark border border-gray-700 rounded-2xl p-6 max-w-sm">
            <label className="block text-sm text-muted-on-dark mb-1" htmlFor="admin-user">Username</label>
            <input
              id="admin-user"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full mb-4 rounded-lg bg-gray-800 border border-gray-600 text-on-dark px-3 py-2 focus:outline-none focus:border-accent"
            />
            <label className="block text-sm text-muted-on-dark mb-1" htmlFor="admin-pass">Password</label>
            <input
              id="admin-pass"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mb-4 rounded-lg bg-gray-800 border border-gray-600 text-on-dark px-3 py-2 focus:outline-none focus:border-accent"
            />
            {loginError && <p className="text-red-400 text-sm mb-4">{loginError}</p>}
            <button
              type="submit"
              className="w-full border border-accent text-accent hover:bg-chip rounded-lg py-2 font-medium transition-colors"
            >
              Log in
            </button>
          </form>
        )}

        {auth === 'loggedIn' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <p className="text-on-dark text-sm">Logged in.</p>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 text-sm text-muted-on-dark hover:text-accent transition-colors"
              >
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>

            <div className="space-y-6">
              {visitedCountries.map((country) => (
                <div key={country.code} className="bg-card-dark border border-gray-700 rounded-2xl p-5">
                  <h2 className="text-on-dark font-semibold mb-1">
                    {country.code}
                    {country.note ? <span className="text-muted-on-dark font-normal"> — {country.note}</span> : null}
                  </h2>
                  <textarea
                    value={notes[country.code] ?? ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [country.code]: e.target.value }))}
                    rows={4}
                    className="w-full rounded-lg bg-gray-800 border border-gray-600 text-on-dark px-3 py-2 text-sm leading-relaxed focus:outline-none focus:border-accent"
                    placeholder="Text shown on this country's card (empty = no text)"
                  />

                  {(country.places ?? []).map((place) => {
                    const prefix = mediaPrefix(country.code, place.name)
                    const items = media[prefix] ?? []
                    const busy = uploadBusy[prefix] ?? false
                    return (
                      <div key={place.name} className="mt-4 border-t border-gray-700 pt-3">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-medium text-on-dark">
                            {place.name}
                            <span className="text-muted-on-dark font-normal"> — {items.length} file(s)</span>
                          </h3>
                          <label className={`inline-flex items-center gap-1.5 text-sm border border-accent text-accent hover:bg-chip rounded-lg px-3 py-1 cursor-pointer transition-colors ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
                            <Upload className="h-3.5 w-3.5" />
                            {busy ? 'Uploading…' : 'Add photos/videos'}
                            <input
                              type="file"
                              accept="image/*,video/*"
                              multiple
                              className="hidden"
                              onChange={(e) => {
                                handleMediaUpload(country.code, place, e.target.files)
                                e.target.value = ''
                              }}
                            />
                          </label>
                        </div>
                        {items.length > 0 && (
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {items.map((item) => (
                              <div key={item.url} className="relative group rounded-lg overflow-hidden bg-gray-800">
                                {isVideo(item.pathname) ? (
                                  <video src={item.url} className="w-full h-24 object-cover" preload="metadata" muted />
                                ) : (
                                  <img src={item.url} alt="" loading="lazy" className="w-full h-24 object-cover" />
                                )}
                                <button
                                  type="button"
                                  aria-label="Delete file"
                                  onClick={() => handleMediaDelete(country.code, place.name, item.url)}
                                  className="absolute top-1 right-1 rounded-md bg-black/60 text-white p-1 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-4">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 border border-accent text-accent hover:bg-chip rounded-lg px-5 py-2 font-medium transition-colors disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save all'}
              </button>
              {status && <p className="text-sm text-muted-on-dark">{status}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
