import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, LogOut, MapPin, Plus, Save, Trash2, Upload } from 'lucide-react'
import { upload } from '@vercel/blob/client'
import NavBar from '../components/NavBar'
import { visitedCountries as bundledCountries } from '../data/visitedCountries'
import type { VisitedCountry, VisitedPlace } from '../data/visitedCountries'
import { mediaPrefix, isVideo } from '../utils/placeMedia'
import type { MediaItem } from '../utils/placeMedia'
import 'flag-icons/css/flag-icons.min.css'

type AuthState = 'checking' | 'loggedOut' | 'loggedIn'

interface GeoCountry {
  name: string
  iso3: string
  iso2: string
}

const inputCls =
  'rounded-lg bg-gray-800 border border-gray-600 text-on-dark px-3 py-2 text-sm focus:outline-none focus:border-accent'

export default function TripsAdminPage() {
  const [auth, setAuth] = useState<AuthState>('checking')
  const [apiUnavailable, setApiUnavailable] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)

  const [data, setData] = useState<VisitedCountry[]>([])
  const [dirty, setDirty] = useState(false)
  const [openCode, setOpenCode] = useState<string | null>(null)
  const [geo, setGeo] = useState<GeoCountry[]>([])
  const [newCountry, setNewCountry] = useState('')
  const [newPlace, setNewPlace] = useState({ name: '', lat: '', lng: '' })
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const [media, setMedia] = useState<Record<string, MediaItem[]>>({})
  const [uploadBusy, setUploadBusy] = useState<Record<string, boolean>>({})

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Country names/codes for the add-country picker and display
  useEffect(() => {
    fetch('/data/countries.geojson')
      .then((res) => res.json())
      .then((geojson) =>
        setGeo(
          (geojson.features as { properties: GeoCountry }[])
            .map((f) => ({ name: f.properties.name, iso3: f.properties.iso3, iso2: f.properties.iso2 }))
            .sort((a, b) => a.name.localeCompare(b.name))
        )
      )
      .catch(() => {})
  }, [])

  // Check for an existing session (non-JSON response = SPA fallback = no API)
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

  // Load the dataset once logged in; seed from the bundled file if empty
  useEffect(() => {
    if (auth !== 'loggedIn') return
    fetch('/api/trips-data')
      .then((res) =>
        res.ok && res.headers.get('content-type')?.includes('application/json')
          ? res.json()
          : Promise.reject(new Error('load failed'))
      )
      .then((payload) => {
        if (Array.isArray(payload?.data) && payload.data.length > 0) {
          setData(payload.data)
        } else {
          setData(bundledCountries)
          setStatus('No stored data yet — starting from the defaults in the code. Press Save to persist them.')
        }
      })
      .catch(() => {
        setData(bundledCountries)
        setStatus('Could not load stored data — showing the defaults from the code.')
      })
  }, [auth])

  // Warn about unsaved changes when leaving
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const geoByIso3 = useMemo(() => new Map(geo.map((g) => [g.iso3, g])), [geo])

  const mutate = (updater: (draft: VisitedCountry[]) => VisitedCountry[]) => {
    setData(updater)
    setDirty(true)
  }

  // ---------- countries ----------

  const addCountry = () => {
    const query = newCountry.trim()
    if (!query) return
    const match =
      geo.find((g) => g.iso3 === query.toUpperCase()) ??
      geo.find((g) => g.name.toLowerCase() === query.toLowerCase())
    if (!match) {
      setStatus(`Unknown country "${query}" — pick one from the list or use its 3-letter code.`)
      return
    }
    if (data.some((c) => c.code === match.iso3)) {
      setStatus(`${match.name} is already in the list.`)
      setOpenCode(match.iso3)
      return
    }
    mutate((draft) => [...draft, { code: match.iso3 }])
    setOpenCode(match.iso3)
    setNewCountry('')
    setStatus(null)
  }

  const deleteCountry = (code: string) => {
    const name = geoByIso3.get(code)?.name ?? code
    if (!window.confirm(`Delete ${name} and all its places from the list?`)) return
    mutate((draft) => draft.filter((c) => c.code !== code))
    if (openCode === code) setOpenCode(null)
  }

  const updateCountry = (code: string, patch: Partial<VisitedCountry>) => {
    mutate((draft) => draft.map((c) => (c.code === code ? { ...c, ...patch } : c)))
  }

  // ---------- places ----------

  const addPlace = (code: string) => {
    const name = newPlace.name.trim()
    const lat = Number(newPlace.lat)
    const lng = Number(newPlace.lng)
    if (!name) return setStatus('Place needs a name.')
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return setStatus('Latitude must be between -90 and 90.')
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) return setStatus('Longitude must be between -180 and 180.')
    const country = data.find((c) => c.code === code)
    if (country?.places?.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      return setStatus(`"${name}" already exists in this country.`)
    }
    mutate((draft) =>
      draft.map((c) => (c.code === code ? { ...c, places: [...(c.places ?? []), { name, lat, lng }] } : c))
    )
    setNewPlace({ name: '', lat: '', lng: '' })
    setStatus(null)
  }

  const updatePlace = (code: string, index: number, patch: Partial<VisitedPlace>) => {
    mutate((draft) =>
      draft.map((c) =>
        c.code === code
          ? { ...c, places: (c.places ?? []).map((p, i) => (i === index ? { ...p, ...patch } : p)) }
          : c
      )
    )
  }

  const deletePlace = (code: string, index: number) => {
    mutate((draft) =>
      draft.map((c) => (c.code === code ? { ...c, places: (c.places ?? []).filter((_, i) => i !== index) } : c))
    )
  }

  // ---------- media ----------

  const refreshMedia = async (countryCode: string, placeName: string) => {
    const prefix = mediaPrefix(countryCode, placeName)
    try {
      // cache-buster: the public API response is CDN-cached, but the admin
      // must always see the store's current contents (e.g. after uploads)
      const res = await fetch(
        `/api/place-media?prefix=${encodeURIComponent(prefix)}&fresh=${Date.now()}`
      )
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const payload = await res.json()
        setMedia((prev) => ({ ...prev, [prefix]: payload.media ?? [] }))
      }
    } catch {
      /* media listing is best-effort */
    }
  }

  // Load media for the places of the opened country
  useEffect(() => {
    if (!openCode) return
    const country = data.find((c) => c.code === openCode)
    for (const place of country?.places ?? []) {
      refreshMedia(openCode, place.name)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCode])

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
        const payload = await res.json().catch(() => null)
        setStatus(`Delete failed: ${payload?.error ?? res.status}`)
        return
      }
      await refreshMedia(countryCode, placeName)
    } catch {
      setStatus('Delete failed: could not reach the API.')
    }
  }

  // ---------- auth & save ----------

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
        setLoginError('The admin API is not running here. Use `make dev` (or deploy).')
        return
      }
      if (res.ok) {
        setPassword('')
        setAuth('loggedIn')
      } else {
        const payload = await res.json().catch(() => null)
        setLoginError(payload?.error ?? `Login failed (${res.status})`)
      }
    } catch {
      setLoginError('Could not reach the login API. Use `make dev` (or deploy).')
    }
  }

  const handleLogout = async () => {
    if (dirty && !window.confirm('You have unsaved changes. Log out anyway?')) return
    await fetch('/api/admin-login', { method: 'DELETE' }).catch(() => {})
    setAuth('loggedOut')
  }

  const handleSave = async () => {
    setSaving(true)
    setStatus(null)
    try {
      const res = await fetch('/api/trips-data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      })
      if (res.ok) {
        setDirty(false)
        setStatus('Saved — the changes are live.')
      } else {
        const payload = await res.json().catch(() => null)
        setStatus(`Save failed: ${payload?.error ?? res.status}`)
      }
    } catch {
      setStatus('Save failed: could not reach the API.')
    } finally {
      setSaving(false)
    }
  }

  // ---------- render ----------

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950">
      <NavBar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <h1 className="text-3xl font-bold text-on-dark mb-2">Trips dashboard</h1>
        <p className="text-muted-on-dark text-sm mb-6">
          Manage the countries and places shown on the Trips globe. Don't forget to press Save.
        </p>

        {apiUnavailable && (
          <div className="mb-6 rounded-lg border border-yellow-600 bg-yellow-900/30 text-yellow-200 text-sm px-4 py-3">
            The admin API is not reachable. Run the site with <code>make dev</code> (not{' '}
            <code>make frontend</code>), or deploy to Vercel with <code>ADMIN_PASSWORD</code> and the Upstash
            integration configured.
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
              className={`w-full mb-4 ${inputCls}`}
            />
            <label className="block text-sm text-muted-on-dark mb-1" htmlFor="admin-pass">Password</label>
            <input
              id="admin-pass"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full mb-4 ${inputCls}`}
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
            {/* Toolbar */}
            <div className="sticky top-16 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-gray-900/95 backdrop-blur border-b border-gray-800 flex items-center gap-4 mb-6">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !dirty}
                className="inline-flex items-center gap-2 border border-accent text-accent hover:bg-chip rounded-lg px-5 py-2 font-medium transition-colors disabled:opacity-40"
              >
                <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
              </button>
              {dirty && <span className="text-yellow-300 text-sm">● unsaved changes</span>}
              {status && <span className="text-sm text-muted-on-dark flex-1 min-w-0 truncate">{status}</span>}
              <button
                type="button"
                onClick={handleLogout}
                className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted-on-dark hover:text-accent transition-colors shrink-0"
              >
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>

            {/* Add country */}
            <div className="flex gap-2 mb-6">
              <input
                list="country-options"
                value={newCountry}
                onChange={(e) => setNewCountry(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCountry()}
                placeholder="Add a country — type its name or 3-letter code"
                className={`flex-1 ${inputCls}`}
              />
              <datalist id="country-options">
                {geo.map((g) => (
                  <option key={g.iso3} value={g.name}>{g.iso3}</option>
                ))}
              </datalist>
              <button
                type="button"
                onClick={addCountry}
                className="inline-flex items-center gap-1.5 border border-accent text-accent hover:bg-chip rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>

            {/* Countries */}
            <div className="space-y-3">
              {data.map((country) => {
                const geoInfo = geoByIso3.get(country.code)
                const isOpen = openCode === country.code
                return (
                  <div key={country.code} className="bg-card-dark border border-gray-700 rounded-2xl overflow-hidden">
                    {/* Row header */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenCode(isOpen ? null : country.code)
                          setNewPlace({ name: '', lat: '', lng: '' })
                        }}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 text-muted-on-dark shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-on-dark shrink-0" />
                        )}
                        {/^[A-Za-z]{2}$/.test(geoInfo?.iso2 ?? '') && (
                          <span className={`fi fi-${geoInfo!.iso2.toLowerCase()} text-lg rounded-sm shrink-0`} />
                        )}
                        <span className="text-on-dark font-semibold truncate">
                          {geoInfo?.name ?? country.code}
                        </span>
                        <span className="text-xs text-muted-on-dark bg-gray-800 rounded px-1.5 py-0.5">{country.code}</span>
                        <span className="text-sm text-muted-on-dark truncate hidden sm:inline">{country.note}</span>
                        <span className="ml-auto text-xs text-muted-on-dark shrink-0">
                          {(country.places ?? []).length} place(s)
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${geoInfo?.name ?? country.code}`}
                        onClick={() => deleteCountry(country.code)}
                        className="text-muted-on-dark hover:text-red-400 transition-colors shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Editor */}
                    {isOpen && (
                      <div className="border-t border-gray-700 px-4 py-4 space-y-4">
                        <div className="grid sm:grid-cols-2 gap-3">
                          <label className="block">
                            <span className="text-xs text-muted-on-dark">Badge note (e.g. “Home”, “Exchange 2024”)</span>
                            <input
                              type="text"
                              value={country.note ?? ''}
                              onChange={(e) => updateCountry(country.code, { note: e.target.value })}
                              className={`w-full mt-1 ${inputCls}`}
                            />
                          </label>
                        </div>
                        <label className="block">
                          <span className="text-xs text-muted-on-dark">Card text (English)</span>
                          <textarea
                            value={country.description ?? ''}
                            onChange={(e) => updateCountry(country.code, { description: e.target.value })}
                            rows={3}
                            className={`w-full mt-1 ${inputCls} leading-relaxed`}
                            placeholder="Free text shown on this country's card"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs text-muted-on-dark">Card text (Dutch)</span>
                          <textarea
                            value={country.descriptionNl ?? ''}
                            onChange={(e) => updateCountry(country.code, { descriptionNl: e.target.value })}
                            rows={3}
                            className={`w-full mt-1 ${inputCls} leading-relaxed`}
                            placeholder="Dutch version — shown when the site is in Dutch (falls back to English)"
                          />
                        </label>

                        {/* Places */}
                        <div>
                          <h3 className="text-sm font-semibold text-on-dark mb-2 inline-flex items-center gap-1.5">
                            <MapPin className="h-4 w-4 text-accent" /> Places
                          </h3>
                          <p className="text-xs text-muted-on-dark mb-3">
                            Tip: photos/videos are stored under the place's name — rename places before uploading media.
                          </p>
                          <div className="space-y-4">
                            {(country.places ?? []).map((place, index) => {
                              const prefix = mediaPrefix(country.code, place.name)
                              const items = media[prefix] ?? []
                              const busy = uploadBusy[prefix] ?? false
                              return (
                                <div key={index} className="rounded-xl border border-gray-700 p-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <input
                                      type="text"
                                      value={place.name}
                                      onChange={(e) => updatePlace(country.code, index, { name: e.target.value })}
                                      className={`flex-1 min-w-32 ${inputCls}`}
                                      placeholder="Place name"
                                    />
                                    <input
                                      type="number"
                                      value={place.lat}
                                      step="any"
                                      onChange={(e) =>
                                        updatePlace(country.code, index, {
                                          lat: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : 0,
                                        })
                                      }
                                      className={`w-28 ${inputCls}`}
                                      placeholder="Latitude"
                                    />
                                    <input
                                      type="number"
                                      value={place.lng}
                                      step="any"
                                      onChange={(e) =>
                                        updatePlace(country.code, index, {
                                          lng: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : 0,
                                        })
                                      }
                                      className={`w-28 ${inputCls}`}
                                      placeholder="Longitude"
                                    />
                                    <label className={`inline-flex items-center gap-1.5 text-sm border border-accent text-accent hover:bg-chip rounded-lg px-3 py-1.5 cursor-pointer transition-colors ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
                                      <Upload className="h-3.5 w-3.5" />
                                      {busy ? 'Uploading…' : 'Media'}
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
                                    <button
                                      type="button"
                                      aria-label={`Delete ${place.name}`}
                                      onClick={() => deletePlace(country.code, index)}
                                      className="text-muted-on-dark hover:text-red-400 transition-colors"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                  <textarea
                                    value={place.description ?? ''}
                                    onChange={(e) => updatePlace(country.code, index, { description: e.target.value })}
                                    rows={2}
                                    className={`w-full mt-2 ${inputCls} leading-relaxed`}
                                    placeholder="Text shown when this place is selected — English (optional)"
                                  />
                                  <textarea
                                    value={place.descriptionNl ?? ''}
                                    onChange={(e) => updatePlace(country.code, index, { descriptionNl: e.target.value })}
                                    rows={2}
                                    className={`w-full mt-2 ${inputCls} leading-relaxed`}
                                    placeholder="Dutch version (optional — falls back to English)"
                                  />
                                  {items.length > 0 && (
                                    <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 gap-2">
                                      {items.map((item) => (
                                        <div key={item.url} className="relative group rounded-lg overflow-hidden bg-gray-800">
                                          {isVideo(item.pathname) ? (
                                            <video src={item.url} className="w-full h-20 object-cover" preload="metadata" muted />
                                          ) : (
                                            <img src={item.url} alt="" loading="lazy" className="w-full h-20 object-cover" />
                                          )}
                                          <button
                                            type="button"
                                            aria-label="Delete file"
                                            onClick={() => handleMediaDelete(country.code, place.name, item.url)}
                                            className="absolute top-1 right-1 rounded-md bg-black/60 text-white p-1 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            })}

                            {/* Add place */}
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="text"
                                value={newPlace.name}
                                onChange={(e) => setNewPlace((p) => ({ ...p, name: e.target.value }))}
                                className={`flex-1 min-w-32 ${inputCls}`}
                                placeholder="New place name"
                              />
                              <input
                                type="text"
                                inputMode="decimal"
                                value={newPlace.lat}
                                onChange={(e) => setNewPlace((p) => ({ ...p, lat: e.target.value }))}
                                className={`w-28 ${inputCls}`}
                                placeholder="Latitude"
                              />
                              <input
                                type="text"
                                inputMode="decimal"
                                value={newPlace.lng}
                                onChange={(e) => setNewPlace((p) => ({ ...p, lng: e.target.value }))}
                                className={`w-28 ${inputCls}`}
                                placeholder="Longitude"
                              />
                              <button
                                type="button"
                                onClick={() => addPlace(country.code)}
                                className="inline-flex items-center gap-1.5 border border-accent text-accent hover:bg-chip rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                              >
                                <Plus className="h-4 w-4" /> Add place
                              </button>
                            </div>
                            <p className="text-xs text-muted-on-dark">
                              Find coordinates: right-click a spot on Google Maps and the lat/lng is the first menu entry.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
