import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Globe from 'react-globe.gl'
import type { GlobeMethods } from 'react-globe.gl'
import * as THREE from 'three'
import { geoArea, geoBounds, geoCentroid } from 'd3-geo'
import { ChevronLeft, ChevronRight, Flag, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import NavBar from '../components/NavBar'
import { visitedCountries } from '../data/visitedCountries'
import type { VisitedPlace } from '../data/visitedCountries'
import { mediaPrefix, isVideo } from '../utils/placeMedia'
import type { MediaItem } from '../utils/placeMedia'

interface CountryFeature {
  properties: {
    name: string
    iso2: string
    iso3: string
    continent: string
    subregion: string
    pop: number
  }
  geometry: {
    type: string
    coordinates: unknown[]
  }
}

// Largest polygon of a country — the detailed data includes overseas
// territories (e.g. the Caribbean Netherlands) that would otherwise
// distort where the camera centers and how far it zooms.
const mainPolygon = (feature: CountryFeature) => {
  const geom = feature.geometry
  if (geom.type === 'Polygon') return { type: 'Polygon', coordinates: geom.coordinates }
  let best = geom.coordinates[0]
  let bestArea = -1
  for (const coords of geom.coordinates) {
    const a = geoArea({ type: 'Polygon', coordinates: coords } as never)
    if (a > bestArea) {
      bestArea = a
      best = coords
    }
  }
  return { type: 'Polygon', coordinates: best }
}

const ACCENT = '#00ADB5'
const DEFAULT_POV = { lat: 30, lng: 5, altitude: 2.2 }
// Camera altitude limits (relative to globe radius). Distance = radius * (1 + altitude).
const MIN_ALTITUDE = 0.2
const MAX_ALTITUDE = 3.5

// 'NL' -> 🇳🇱 (regional indicator symbols)
const flagEmoji = (iso2: string) =>
  /^[A-Z]{2}$/.test(iso2)
    ? String.fromCodePoint(...[...iso2].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
    : ''

export default function TripsPage() {
  const { t } = useTranslation()
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [countries, setCountries] = useState<CountryFeature[]>([])
  const [detailedByCode, setDetailedByCode] = useState<Map<string, CountryFeature> | null>(null)
  // Country texts edited via /trips/admin (overrides the bundled description)
  const [remoteNotes, setRemoteNotes] = useState<Record<string, string> | null>(null)
  // Photos/videos of the selected place, uploaded via /trips/admin
  const [placeMedia, setPlaceMedia] = useState<MediaItem[] | null>(null)
  const [hovered, setHovered] = useState<CountryFeature | null>(null)
  const [selected, setSelected] = useState<CountryFeature | null>(null)
  // Keeps the last selection so the panel stays filled while fading out
  const [panelCountry, setPanelCountry] = useState<CountryFeature | null>(null)
  const [selectedPlace, setSelectedPlace] = useState<VisitedPlace | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Load country polygons
  useEffect(() => {
    fetch('/data/countries.geojson')
      .then((res) => res.json())
      .then((geojson) => setCountries(geojson.features))
      .catch((err) => console.error('Failed to load countries', err))
  }, [])

  // Load admin-edited country texts; falls back to the bundled descriptions
  useEffect(() => {
    fetch('/api/country-notes')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.notes) setRemoteNotes(data.notes)
      })
      .catch(() => {})
  }, [])

  // Keep the globe canvas sized to its container
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const visitedByCode = useMemo(
    () => new Map(visitedCountries.map((v) => [v.code, v])),
    []
  )

  // Lazily load detailed shapes and swap them in for visited countries only —
  // a handful of detailed polygons doesn't cause the lag the full set did,
  // and the countries you actually zoom into get the nice outlines.
  useEffect(() => {
    fetch('/data/countries-detailed.geojson')
      .then((res) => res.json())
      .then((geojson) => {
        const byCode = new Map<string, CountryFeature>(
          (geojson.features as CountryFeature[])
            .filter((f) => visitedByCode.has(f.properties.iso3))
            .map((f) => [f.properties.iso3, f])
        )
        setDetailedByCode(byCode)
      })
      .catch(() => {}) // fall back to blocky shapes silently
  }, [visitedByCode])

  const globeMaterial = useMemo(
    () => new THREE.MeshPhongMaterial({ color: '#2b3138' }),
    []
  )

  // Blocky base shapes, with detailed geometry swapped in for visited countries
  const polygonsData = useMemo(
    () => countries.map((c) => detailedByCode?.get(c.properties.iso3) ?? c),
    [countries, detailedByCode]
  )

  const isVisited = (d: object | null) =>
    !!d && visitedByCode.has((d as CountryFeature).properties.iso3)

  // Angular size of a country's mainland in degrees (handles the antimeridian)
  const countrySizeDeg = (feature: CountryFeature) => {
    const [[minLng, minLat], [maxLng, maxLat]] = geoBounds(mainPolygon(feature) as never)
    let lngSpan = maxLng - minLng
    if (lngSpan < 0) lngSpan += 360
    return Math.max(maxLat - minLat, lngSpan)
  }

  // Fly the camera to a country's mainland, zoomed to fit its size
  const focusCountry = (feature: CountryFeature) => {
    const [lng, lat] = geoCentroid(mainPolygon(feature) as never)
    const altitude = Math.min(2, Math.max(0.25, countrySizeDeg(feature) / 35))
    globeRef.current?.pointOfView({ lat, lng, altitude }, 1000)
  }

  const resetView = () => {
    setSelected(null)
    setSelectedPlace(null)
    globeRef.current?.pointOfView(DEFAULT_POV, 1000)
    const controls = globeRef.current?.controls()
    if (controls) controls.autoRotate = true
  }

  const selectCountry = (feature: CountryFeature) => {
    setSelected(feature)
    setPanelCountry(feature)
    setSelectedPlace(null)
    const controls = globeRef.current?.controls()
    if (controls) controls.autoRotate = false
    focusCountry(feature)
  }

  const handleCountryClick = (d: object | null) => {
    if (!d) return
    const feature = d as CountryFeature
    if (feature === selected) {
      // Misclicks next to a flag must not deselect the country (that's what
      // the card's reset button is for). If zoomed in on a place, clicking
      // the country zooms back out to the country view.
      if (selectedPlace) {
        setSelectedPlace(null)
        focusCountry(feature)
      }
      return
    }
    selectCountry(feature)
  }

  // Card arrows: cycle through the visited countries (data-file order)
  const stepCountry = (dir: 1 | -1) => {
    const codes = visitedCountries.map((v) => v.code)
    const current = panelCountry ?? selected
    const idx = current ? codes.indexOf(current.properties.iso3) : -1
    const nextCode = idx === -1 ? codes[0] : codes[(idx + dir + codes.length) % codes.length]
    const feature = polygonsData.find((f) => f.properties.iso3 === nextCode)
    if (feature) selectCountry(feature)
  }

  // Keyboard: Escape closes the country, arrow keys step through visited ones
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!selected) return
      if (e.key === 'Escape') {
        resetView()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        stepCountry(-1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        stepCountry(1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  // Zoom in on a visited place inside the selected country
  const focusPlace = useCallback((place: VisitedPlace) => {
    setSelectedPlace(place)
    globeRef.current?.pointOfView({ lat: place.lat, lng: place.lng, altitude: 0.3 }, 800)
  }, [])

  // Markers for the visited places of the currently selected country.
  // Data and element factory are kept stable so the flags are created exactly
  // once per country selection — re-renders (hover, place clicks) must NOT
  // rebuild them, or the plant animation replays. `source` keeps the original
  // place object so marker clicks and card chips agree on the active place.
  const markerEls = useRef(new Map<string, HTMLDivElement>())

  const placeMarkers = useMemo(() => {
    if (!selected) return []
    const places = visitedByCode.get(selected.properties.iso3)?.places ?? []
    markerEls.current.clear()
    return places.map((p, i) => ({ ...p, source: p, order: i }))
  }, [selected, visitedByCode])

  const makeMarkerElement = useCallback(
    (d: object) => {
      const place = d as VisitedPlace & { source: VisitedPlace; order: number }
      const el = document.createElement('div')
      el.className = 'place-flag'
      el.style.pointerEvents = 'auto'
      // Plant animation waits for the 1s camera flight to the country, then
      // the flags drop in one after another (fill-mode keeps them hidden
      // until their delay elapses).
      el.innerHTML = `
        <div class="place-flag-inner" style="animation-delay: ${1050 + place.order * 110}ms">
          <div class="place-flag-pole"></div>
          <div class="place-flag-banner">${place.name}</div>
          <div class="place-flag-ground"></div>
        </div>
        <div class="place-flag-hit"></div>`
      // The globe's click detection raycasts into the 3D scene regardless of
      // DOM hits, so flag clicks would ALSO select the country underneath.
      // Swallow all pointer events here so only the flag handles them.
      for (const type of ['pointerdown', 'pointerup', 'click'] as const) {
        el.addEventListener(type, (ev) => ev.stopPropagation())
      }
      el.onclick = (ev) => {
        ev.stopPropagation()
        focusPlace(place.source)
      }
      markerEls.current.set(place.name, el)
      return el
    },
    [focusPlace]
  )

  // Active-place styling is toggled on the existing flag elements
  useEffect(() => {
    for (const [name, el] of markerEls.current) {
      el.classList.toggle('place-flag--active', selectedPlace?.name === name)
    }
  }, [selectedPlace])

  // Load the selected place's photos/videos
  useEffect(() => {
    setPlaceMedia(null)
    if (!selectedPlace || !selected) return
    const prefix = mediaPrefix(selected.properties.iso3, selectedPlace.name)
    let cancelled = false
    fetch(`/api/place-media?prefix=${encodeURIComponent(prefix)}`)
      .then((res) =>
        res.ok && res.headers.get('content-type')?.includes('application/json') ? res.json() : null
      )
      .then((data) => {
        if (!cancelled && data?.media) setPlaceMedia(data.media)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [selectedPlace, selected])

  const panelPlaces = panelCountry
    ? visitedByCode.get(panelCountry.properties.iso3)?.places ?? []
    : []

  return (
    <div className="h-dvh flex flex-col overflow-hidden relative z-10 bg-gradient-to-b from-gray-900 to-gray-950">
      <NavBar />

      {/* Hero Section */}
      <div className="w-full pt-20 pb-4 header-gradient-trips relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
            {t('trips.hero.title')}
          </h1>
          <p className="text-sm md:text-base text-gray-200 max-w-3xl mx-auto">
            {t('trips.hero.subtitle')}
          </p>
        </div>
      </div>

      {/* Globe Section — fills the remaining viewport height */}
      <section className="flex-1 min-h-0 flex flex-col py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-3">
            <div className="bg-chip border border-accent rounded-full px-6 py-2 text-on-dark">
              <span className="font-bold text-accent text-xl mr-2">{visitedCountries.length}</span>
              {t('trips.visitedLabel')}
            </div>
            <p className="text-muted-on-dark text-sm">{t('trips.hint')}</p>
          </div>
        </div>

        <div className="relative overflow-hidden flex-1 min-h-0">
          <div
            ref={containerRef}
            className={`relative w-full h-full cursor-grab active:cursor-grabbing transition-transform duration-700 ease-in-out ${
              selected ? 'md:-translate-x-[20%]' : ''
            }`}
          >
            {countries.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-on-dark">
                {t('trips.loading')}
              </div>
            )}
            {countries.length > 0 && size.width > 0 && (
              <Globe
                ref={globeRef}
                width={size.width}
                height={size.height}
                backgroundColor="rgba(0,0,0,0)"
                globeMaterial={globeMaterial}
                showAtmosphere
                atmosphereColor={ACCENT}
                atmosphereAltitude={0.18}
                polygonsData={polygonsData}
                polygonCapColor={(d: object) => {
                  const active = d === hovered || d === selected
                  return isVisited(d)
                    ? active ? '#2fd4db' : ACCENT
                    : active ? 'rgba(170,180,190,0.65)' : 'rgba(110,120,132,0.45)'
                }}
                polygonSideColor={() => 'rgba(0,0,0,0.25)'}
                polygonStrokeColor={() => '#161b22'}
                polygonAltitude={(d: object) => (isVisited(d) ? 0.02 : 0.008)}
                polygonsTransitionDuration={300}
                htmlElementsData={placeMarkers}
                htmlAltitude={0.025}
                htmlElement={makeMarkerElement}
                htmlTransitionDuration={0}
                polygonLabel={(d: object) => {
                  const feature = d as CountryFeature
                  const visit = visitedByCode.get(feature.properties.iso3)
                  return `
                    <div style="background: rgba(34,40,49,0.92); color: #EEEEEE; padding: 8px 12px; border-radius: 8px; font-size: 14px; border: 1px solid ${visit ? ACCENT : 'rgba(238,238,238,0.15)'}; pointer-events: none;">
                      <div style="font-weight: 600;">${feature.properties.name}</div>
                      ${visit ? `<div style="color: ${ACCENT}; font-size: 12px; margin-top: 2px;">&#10003; ${visit.note ?? t('trips.visitedBadge')}</div>` : ''}
                    </div>`
                }}
                onPolygonHover={(d: object | null) => {
                  setHovered(d as CountryFeature | null)
                  const controls = globeRef.current?.controls()
                  if (controls) controls.autoRotate = !d && !selected
                }}
                onPolygonClick={handleCountryClick}
                onGlobeReady={() => {
                  const globe = globeRef.current
                  if (!globe) return
                  const controls = globe.controls()
                  const globeR = globe.getGlobeRadius()
                  controls.minDistance = globeR * (1 + MIN_ALTITUDE)
                  controls.maxDistance = globeR * (1 + MAX_ALTITUDE)
                  controls.autoRotate = true
                  controls.autoRotateSpeed = 0.4
                  globe.pointOfView(DEFAULT_POV, 0)
                }}
              />
            )}

          </div>

          {/* Country info panel — slides in from the right when a country is selected */}
          <div className="absolute inset-x-4 bottom-4 md:inset-x-auto md:bottom-auto md:right-6 lg:right-10 md:top-1/2 md:-translate-y-1/2 md:w-[45%] md:h-[85%] pointer-events-none">
            <div
              data-testid="country-card"
              className={`md:h-full flex flex-col bg-navbar border border-accent rounded-2xl p-6 md:p-8 lg:p-10 shadow-2xl backdrop-blur-sm transition-all duration-700 ease-in-out ${
                selected
                  ? 'opacity-100 translate-y-0 md:translate-x-0 pointer-events-auto'
                  : 'opacity-0 translate-y-6 md:translate-y-0 md:translate-x-[120%]'
              }`}
            >
              {panelCountry && (
                <>
                  <div className="flex items-center gap-2 md:gap-3">
                    {visitedCountries.length > 1 && (
                      <button
                        type="button"
                        data-testid="prev-country"
                        aria-label={t('trips.prevCountry')}
                        onClick={() => stepCountry(-1)}
                        className="shrink-0 text-muted-on-dark hover:text-accent transition-colors"
                      >
                        <ChevronLeft className="h-6 w-6 md:h-8 md:w-8" />
                      </button>
                    )}
                    <div className="flex items-center justify-center gap-3 md:gap-4 flex-1 min-w-0">
                      <span className="text-4xl md:text-5xl leading-none">{flagEmoji(panelCountry.properties.iso2)}</span>
                      <h3 className="text-2xl md:text-4xl font-bold text-on-dark truncate">{panelCountry.properties.name}</h3>
                    </div>
                    {visitedCountries.length > 1 && (
                      <button
                        type="button"
                        data-testid="next-country"
                        aria-label={t('trips.nextCountry')}
                        onClick={() => stepCountry(1)}
                        className="shrink-0 text-muted-on-dark hover:text-accent transition-colors"
                      >
                        <ChevronRight className="h-6 w-6 md:h-8 md:w-8" />
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={t('trips.resetView')}
                      onClick={resetView}
                      className="shrink-0 text-muted-on-dark hover:text-accent transition-colors"
                    >
                      <X className="h-5 w-5 md:h-6 md:w-6" />
                    </button>
                  </div>

                  {visitedByCode.has(panelCountry.properties.iso3) ? (
                    <div className="mt-3 md:mt-5 self-start inline-flex items-center gap-2 bg-chip border border-accent rounded-full px-3 py-1 md:px-4 md:py-1.5 text-sm md:text-base text-accent">
                      ✓ {visitedByCode.get(panelCountry.properties.iso3)?.note ?? t('trips.visitedBadge')}
                    </div>
                  ) : (
                    <div className="mt-3 md:mt-5 text-sm md:text-base text-muted-on-dark">{t('trips.notVisited')}</div>
                  )}

                  {(remoteNotes?.[panelCountry.properties.iso3] ??
                    visitedByCode.get(panelCountry.properties.iso3)?.description) && (
                    <p className="mt-5 md:mt-8 text-sm md:text-base text-on-dark leading-relaxed whitespace-pre-line border-t border-gray-700 pt-4 md:pt-6">
                      {remoteNotes?.[panelCountry.properties.iso3] ??
                        visitedByCode.get(panelCountry.properties.iso3)?.description}
                    </p>
                  )}

                  {panelPlaces.length > 0 && (
                    <div className="mt-5 md:mt-8">
                      <h4 className="text-sm md:text-base font-semibold text-on-dark mb-2 md:mb-3">
                        {t('trips.placesTitle')}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {panelPlaces.map((place) => (
                          <button
                            key={place.name}
                            type="button"
                            onClick={() => focusPlace(place)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 md:px-4 md:py-1.5 text-sm md:text-base border transition-colors ${
                              selectedPlace === place
                                ? 'bg-chip border-accent text-accent'
                                : 'border-gray-600 text-on-dark hover:border-accent hover:text-accent'
                            }`}
                          >
                            <Flag className="h-3.5 w-3.5 md:h-4 md:w-4" />
                            {place.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Photos/videos of the selected place */}
                  {selectedPlace && placeMedia && placeMedia.length > 0 ? (
                    <div className="mt-4 md:mt-6 md:flex-1 md:min-h-0 overflow-y-auto max-h-52 md:max-h-none">
                      <div className="grid grid-cols-2 gap-2 content-start">
                        {placeMedia.map((item) =>
                          isVideo(item.pathname) ? (
                            <video
                              key={item.url}
                              src={item.url}
                              controls
                              preload="metadata"
                              className="w-full rounded-lg bg-black/40"
                            />
                          ) : (
                            <img
                              key={item.url}
                              src={item.url}
                              alt={selectedPlace.name}
                              loading="lazy"
                              className="w-full rounded-lg object-cover aspect-video"
                            />
                          )
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Flexible space for future content */
                    <div className="hidden md:block flex-1" />
                  )}

                  <button
                    type="button"
                    onClick={resetView}
                    className="mt-5 md:mt-0 w-full border border-accent text-accent hover:bg-chip rounded-lg py-2 md:py-3 text-sm md:text-base font-medium transition-colors"
                  >
                    {t('trips.resetView')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

      </section>
    </div>
  )
}
