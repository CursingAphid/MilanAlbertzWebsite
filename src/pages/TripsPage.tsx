import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Globe from 'react-globe.gl'
import type { GlobeMethods } from 'react-globe.gl'
import * as THREE from 'three'
import { geoArea, geoBounds, geoCentroid } from 'd3-geo'
import { ChevronLeft, ChevronRight, Flag, House, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import NavBar from '../components/NavBar'
import SpaceBackground from '../components/SpaceBackground'
import { visitedCountries } from '../data/visitedCountries'
import type { VisitedCountry, VisitedPlace } from '../data/visitedCountries'
import { mediaPrefix, isVideo } from '../utils/placeMedia'
import type { MediaItem } from '../utils/placeMedia'

// Natural Earth river centerlines, compacted by scripts (name + [lat,lng] points)
interface RiverPath {
  name: string
  points: [number, number][]
}

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
const DEFAULT_POV = { lat: 30, lng: 5, altitude: 1.8 }
// Camera altitude limits (relative to globe radius). Distance = radius * (1 + altitude).
// The floor must stay low enough that tightly packed place clusters
// (e.g. Hong Kong/Macau/Shenzhen) can still be zoomed apart.
const MIN_ALTITUDE = 0.025
const MAX_ALTITUDE = 3.5

// Marker clustering (screen-space): flags closer than CLUSTER_PX merge into a
// count badge; zooming until neighbours are SPLIT_TARGET_PX apart splits them.
const CLUSTER_PX = 60
const SPLIT_TARGET_PX = 85

// All countries sit essentially flat — visited ones are distinguished by
// color only. The tiny raise on visited countries is invisible but prevents
// z-fighting where their detailed shapes overlap blocky neighbours. Markers
// must sit at EXACTLY the visited polygon altitude — any gap makes them
// parallax-drift against the map when the camera moves.
const BASE_POLY_ALTITUDE = 0.008
const VISITED_POLY_ALTITUDE = 0.0085
const MARKER_ALTITUDE = VISITED_POLY_ALTITUDE
// Rivers float just above the land polygons (relief overlay sits at 0.011)
const RIVER_ALTITUDE = 0.0095

// A globe marker: an individual place flag, or a cluster badge grouping
// several places that would overlap on screen at the current zoom.
// spreadX/spreadY fan flags apart on screen when places are so close together
// (e.g. Nice/Monaco) that even the deepest allowed zoom can't separate them.
type MarkerDatum =
  | ({ kind: 'place'; source: VisitedPlace; delayMs: number; spreadX?: number; spreadY?: number } & VisitedPlace)
  | { kind: 'cluster'; lat: number; lng: number; count: number; splitAlt: number; delayMs: number }

// Flags fanned apart at the zoom floor aim for this separation
const SPREAD_TARGET_PX = 80

// 'NL' -> 🇳🇱 (regional indicator symbols)
const flagEmoji = (iso2: string) =>
  /^[A-Z]{2}$/.test(iso2)
    ? String.fromCodePoint(...[...iso2].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
    : ''

// Kerkrade is home — its flag gets a special golden treatment
const isHomePlace = (name: string) => name.trim().toLowerCase() === 'kerkrade'

// Lucide "house" icon, inlined because the globe markers are raw HTML
const HOUSE_ICON_SVG =
  '<svg class="place-flag-home-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/>' +
  '<path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' +
  '</svg>'

// ---------- decorative boats ----------

// Boats wander the oceans at random, steering away from coastlines using a
// low-res land mask rasterized from the country polygons. Their fading wakes
// are what gives the water its sense of motion.

const BOAT_COUNT = 15
const PLANE_COUNT = 5
const WAKE_POINTS = 48 // trail samples kept per craft
const WAKE_INTERVAL = 0.18 // seconds between trail samples
const WAKE_WIDTH = 1.6 // wake spread at its oldest point (world units)

type LandTest = (lat: number, lng: number) => boolean

interface Boat {
  obj: THREE.Group
  pos: THREE.Vector3 // unit vector on the sphere
  heading: THREE.Vector3 // unit tangent, direction of travel
  speed: number // radians/second
  turnDir: 1 | -1 // preferred way to turn when land is ahead
  bobPhase: number
  wakeScale: number // trail width multiplier for this craft
  bobScale: number // rocking intensity — 0 for aircraft
  flies: boolean // planes ignore coastlines and bank instead of bobbing
  alt: number // radius factor: ~1.0008 on the water, higher in the air
  wake: { mesh: THREE.Mesh; pts: THREE.Vector3[]; lastSample: number }
}

// three-globe's lat/lng → unit vector convention (θ measured from lng 90)
const latLngToVec3 = (lat: number, lng: number) => {
  const phi = ((90 - lat) * Math.PI) / 180
  const theta = ((90 - lng) * Math.PI) / 180
  return new THREE.Vector3(
    Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta)
  )
}

const vecToLatLng = (v: THREE.Vector3): [number, number] => {
  const lat = 90 - (Math.acos(Math.max(-1, Math.min(1, v.y))) * 180) / Math.PI
  const lng = ((90 - (Math.atan2(v.z, v.x) * 180) / Math.PI + 540) % 360) - 180
  return [lat, lng]
}

// Rasterize the country polygons into a small equirectangular mask, padded a
// little at the coasts, for cheap "is there land here?" lookups.
const buildLandMask = (features: CountryFeature[]): LandTest => {
  const W = 1024
  const H = 512
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return () => false
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 10 // pads coastlines ~1.7° so boats keep their distance
  for (const feature of features) {
    const geom = feature.geometry
    const polys = (
      geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
    ) as number[][][][]
    for (const rings of polys) {
      ctx.beginPath()
      for (const ring of rings) {
        // unwrap longitudes so antimeridian-crossing rings stay contiguous
        let prev = ring[0][0]
        let minLng = Infinity
        let maxLng = -Infinity
        const pts = ring.map(([lng, lat]) => {
          while (lng - prev > 180) lng -= 360
          while (lng - prev < -180) lng += 360
          prev = lng
          minLng = Math.min(minLng, lng)
          maxLng = Math.max(maxLng, lng)
          return [lng, lat] as const
        })
        const offsets = [0]
        if (maxLng > 180) offsets.push(-360)
        if (minLng < -180) offsets.push(360)
        for (const off of offsets) {
          pts.forEach(([lng, lat], i) => {
            const x = ((lng + off + 180) / 360) * W
            const y = ((90 - lat) / 180) * H
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          })
          ctx.closePath()
        }
      }
      ctx.fill('evenodd')
      ctx.stroke()
    }
  }
  const mask = ctx.getImageData(0, 0, W, H).data
  return (lat, lng) => {
    const x = Math.min(W - 1, Math.max(0, Math.floor((((((lng + 180) % 360) + 360) % 360) / 360) * W)))
    const y = Math.min(H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * H)))
    return mask[(y * W + x) * 4 + 3] > 0
  }
}

// Random open-water spawn point with a random heading
const spawnBoat = (isLand: LandTest) => {
  for (let attempt = 0; attempt < 400; attempt++) {
    const lat = (Math.asin(Math.random() * 2 - 1) * 180) / Math.PI
    if (Math.abs(lat) > 62) continue // skip polar seas — nobody looks there
    const lng = Math.random() * 360 - 180
    const clear = [
      [0, 0],
      [4, 0],
      [-4, 0],
      [0, 4],
      [0, -4],
    ].every(([dlat, dlng]) => !isLand(lat + dlat, lng + dlng))
    if (!clear) continue
    const pos = latLngToVec3(lat, lng)
    const east = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), pos).normalize()
    const north = new THREE.Vector3().crossVectors(pos, east).normalize()
    const a = Math.random() * Math.PI * 2
    const heading = east
      .multiplyScalar(Math.cos(a))
      .add(north.multiplyScalar(Math.sin(a)))
      .normalize()
    return { pos, heading }
  }
  return null
}

// ----- ship models (low-poly, forward = +X, waterline at y = 0) -----

const shipBox = (
  parent: THREE.Group,
  w: number,
  h: number,
  d: number,
  color: string,
  x: number,
  y: number,
  z = 0
) => {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color })
  )
  mesh.position.set(x, y, z)
  parent.add(mesh)
  return mesh
}

const SAIL_COLORS = ['#f4efe2', '#f4efe2', '#e86f5e', '#f2c14e', '#7fc4dd']
const CONTAINER_COLORS = ['#c0504d', '#4f81bd', '#9bbb59', '#f0a030', '#7f6084', '#3aa6a0']
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]

// Sailboat: brown hull, cream cabin, mast and a (sometimes colorful) mainsail
const makeSailboat = () => {
  const boat = new THREE.Group()
  shipBox(boat, 1.1, 0.22, 0.42, '#7d4f24', 0, 0.11) // hull
  shipBox(boat, 0.32, 0.18, 0.26, '#e8e2d0', -0.22, 0.31) // cabin
  shipBox(boat, 0.03, 0.95, 0.03, '#5b3a1e', 0.05, 0.74) // mast
  const sailGeom = new THREE.BufferGeometry()
  sailGeom.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0.08, 0.35, 0.02, 0.08, 1.15, 0.02, 0.62, 0.35, 0.02], 3)
  )
  sailGeom.computeVertexNormals()
  boat.add(
    new THREE.Mesh(
      sailGeom,
      new THREE.MeshBasicMaterial({ color: pick(SAIL_COLORS), side: THREE.DoubleSide })
    )
  )
  return boat
}

// Container ship: long dark hull, white bridge astern, stacked cargo
const makeCargoShip = () => {
  const boat = new THREE.Group()
  shipBox(boat, 2.3, 0.3, 0.55, pick(['#7a3b2e', '#31465e', '#3d5c46']), 0, 0.15) // hull
  shipBox(boat, 0.4, 0.5, 0.45, '#e8e2d0', -0.85, 0.55) // bridge
  shipBox(boat, 0.12, 0.18, 0.12, '#333a40', -0.85, 0.89) // funnel
  let x = -0.35
  for (let i = 0; i < 4; i++) {
    const stacks = 1 + Math.floor(Math.random() * 2)
    for (let s = 0; s < stacks; s++) {
      shipBox(boat, 0.42, 0.2, 0.42, pick(CONTAINER_COLORS), x, 0.4 + s * 0.2)
    }
    x += 0.48
  }
  return boat
}

// Speedboat: small white hull with a dark windshield
const makeSpeedboat = () => {
  const boat = new THREE.Group()
  shipBox(boat, 0.72, 0.15, 0.26, '#f2efe9', 0, 0.1)
  shipBox(boat, 0.2, 0.1, 0.2, '#2f3a44', 0.08, 0.22)
  return boat
}

// Tugboat: stubby hull, tall wheelhouse, black funnel
const makeTugboat = () => {
  const boat = new THREE.Group()
  shipBox(boat, 1.0, 0.26, 0.44, '#a5432c', 0, 0.14)
  shipBox(boat, 0.34, 0.32, 0.3, '#e8e2d0', 0.08, 0.44)
  shipBox(boat, 0.1, 0.26, 0.1, '#333a40', -0.28, 0.48)
  return boat
}

// Supertanker: very long low hull, deck pipeline and tank domes, bridge astern
const makeTanker = () => {
  const boat = new THREE.Group()
  shipBox(boat, 3.6, 0.32, 0.7, pick(['#5a2e26', '#33424f']), 0, 0.16) // hull
  shipBox(boat, 3.0, 0.06, 0.6, '#8a4636', -0.1, 0.35) // deck
  shipBox(boat, 0.45, 0.55, 0.5, '#e8e2d0', -1.4, 0.62) // bridge
  shipBox(boat, 0.14, 0.22, 0.14, '#333a40', -1.4, 1.0) // funnel
  shipBox(boat, 2.4, 0.08, 0.08, '#9aa4ad', 0.2, 0.42) // pipeline
  for (let x = -0.6; x <= 1.2; x += 0.6) {
    shipBox(boat, 0.3, 0.12, 0.3, '#7a8891', x, 0.44) // tank domes
  }
  return boat
}

// Cruise liner: white layered decks over a dark waterline, colored funnel
const makeCruiseShip = () => {
  const boat = new THREE.Group()
  shipBox(boat, 3.2, 0.1, 0.64, '#25313c', 0, 0.05) // waterline band
  shipBox(boat, 3.2, 0.35, 0.62, '#f4f4f2', 0, 0.27) // hull
  shipBox(boat, 2.6, 0.22, 0.52, '#ffffff', -0.1, 0.55) // deck 1
  shipBox(boat, 2.1, 0.2, 0.44, '#f7f7f5', -0.15, 0.76) // deck 2
  shipBox(boat, 1.5, 0.18, 0.38, '#ffffff', -0.2, 0.95) // deck 3
  shipBox(boat, 0.3, 0.26, 0.2, pick(['#e86f5e', '#f2c14e', '#3aa6a0']), -0.7, 1.15) // funnel
  return boat
}

// Satellite: boxy body, blue solar panel wings, red blinking beacon
const makeSatellite = () => {
  const sat = new THREE.Group()
  shipBox(sat, 2, 1.2, 1.2, '#c8ccd2', 0, 0) // body
  shipBox(sat, 0.9, 0.8, 0.8, '#9aa2ab', 1.35, 0) // instrument module
  shipBox(sat, 1.6, 0.06, 3.4, '#3b5f9e', 0, 0, 2.5) // panel
  shipBox(sat, 1.6, 0.06, 3.4, '#3b5f9e', 0, 0, -2.5) // panel
  const beacon = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.35, 0.35),
    new THREE.MeshBasicMaterial({ color: '#ff5f56' })
  )
  beacon.position.set(-0.6, 0.8, 0)
  sat.add(beacon)
  return { sat, beacon }
}

// Airliner: white fuselage, gray wings and tailplane, colored fin
const makePlane = () => {
  const plane = new THREE.Group()
  shipBox(plane, 0.85, 0.12, 0.12, '#f2f4f6', 0, 0) // fuselage
  shipBox(plane, 0.28, 0.03, 1.05, '#c9d2d8', 0.04, -0.02) // wings
  shipBox(plane, 0.16, 0.02, 0.42, '#c9d2d8', -0.36, 0.02) // tailplane
  shipBox(plane, 0.16, 0.2, 0.03, pick(['#e86f5e', '#4f81bd', '#f2c14e']), -0.38, 0.12) // fin
  shipBox(plane, 0.08, 0.06, 0.1, '#2f3a44', 0.4, 0.01) // cockpit
  return plane
}

interface ShipKind {
  build: () => THREE.Group
  speed: [number, number] // radians/second range
  wakeScale: number // wake width multiplier (roughly the beam)
  bobScale: number // how much it rocks — heavy ships barely move
  weight: number // spawn probability weight
}

const SHIP_KINDS: ShipKind[] = [
  { build: makeSailboat, speed: [0.005, 0.01], wakeScale: 1, bobScale: 1, weight: 4 },
  { build: makeCargoShip, speed: [0.003, 0.005], wakeScale: 1.6, bobScale: 0.3, weight: 2 },
  { build: makeSpeedboat, speed: [0.012, 0.02], wakeScale: 0.7, bobScale: 1.4, weight: 2 },
  { build: makeTugboat, speed: [0.005, 0.008], wakeScale: 1.1, bobScale: 0.7, weight: 2 },
  { build: makeTanker, speed: [0.002, 0.0035], wakeScale: 2.4, bobScale: 0.15, weight: 1 },
  { build: makeCruiseShip, speed: [0.004, 0.006], wakeScale: 2, bobScale: 0.2, weight: 1 },
]

const pickShipKind = () => {
  const total = SHIP_KINDS.reduce((sum, k) => sum + k.weight, 0)
  let r = Math.random() * total
  for (const kind of SHIP_KINDS) {
    r -= kind.weight
    if (r <= 0) return kind
  }
  return SHIP_KINDS[0]
}

// Fading trail ribbon: a triangle strip that widens and dissolves with age,
// tinted by per-vertex alpha. Light blue for wakes, white for contrails.
const makeWakeMesh = (color = '#9fd8e8') => {
  const geom = new THREE.BufferGeometry()
  const verts = (WAKE_POINTS + 1) * 2
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3))
  geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(verts * 4), 4))
  const indices: number[] = []
  for (let i = 0; i < WAKE_POINTS; i++) {
    const a = i * 2
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  geom.setIndex(indices)
  const mesh = new THREE.Mesh(
    geom,
    new THREE.MeshBasicMaterial({
      color,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  )
  mesh.frustumCulled = false // geometry rewrites every frame; bounds go stale
  mesh.raycast = () => {}
  return mesh
}

const updateWake = (b: Boat, radius: number, t: number) => {
  const wake = b.wake
  if (t - wake.lastSample > WAKE_INTERVAL) {
    wake.lastSample = t
    wake.pts.unshift(b.pos.clone())
    if (wake.pts.length > WAKE_POINTS) wake.pts.pop()
  }
  const chain = [b.pos, ...wake.pts]
  const posAttr = wake.mesh.geometry.getAttribute('position') as THREE.BufferAttribute
  const colAttr = wake.mesh.geometry.getAttribute('color') as THREE.BufferAttribute
  const side = new THREE.Vector3()
  const dir = new THREE.Vector3()
  for (let i = 0; i <= WAKE_POINTS; i++) {
    const p = chain[Math.min(i, chain.length - 1)]
    dir.subVectors(
      chain[Math.min(Math.max(i - 1, 0), chain.length - 1)],
      chain[Math.min(i + 1, chain.length - 1)]
    )
    side.crossVectors(p, dir)
    if (side.lengthSq() > 1e-12) side.normalize()
    const f = i / WAKE_POINTS
    const half = ((0.14 + WAKE_WIDTH * Math.pow(f, 0.75)) / 2) * b.wakeScale
    const alpha = i < chain.length ? 0.5 * Math.pow(1 - f, 1.4) : 0
    const bx = p.x * radius * b.alt
    const by = p.y * radius * b.alt
    const bz = p.z * radius * b.alt
    posAttr.setXYZ(i * 2, bx + side.x * half, by + side.y * half, bz + side.z * half)
    posAttr.setXYZ(i * 2 + 1, bx - side.x * half, by - side.y * half, bz - side.z * half)
    colAttr.setXYZW(i * 2, 1, 1, 1, alpha)
    colAttr.setXYZW(i * 2 + 1, 1, 1, 1, alpha)
  }
  posAttr.needsUpdate = true
  colAttr.needsUpdate = true
}

// Advance every boat: steer away from coastlines ahead, otherwise meander
// lazily; move along the heading's great circle, keep the hull upright with
// a gentle bobbing roll, and refresh the wake. Runs once per frame.
const sailBoats = (boats: Boat[], isLand: LandTest, radius: number, t: number, dt: number) => {
  const q = new THREE.Quaternion()
  const axis = new THREE.Vector3()
  for (const b of boats) {
    axis.crossVectors(b.pos, b.heading).normalize()
    let blocked = false
    if (!b.flies) {
      for (const lookAhead of [0.05, 0.1]) {
        const probe = b.pos.clone().applyQuaternion(q.setFromAxisAngle(axis, lookAhead))
        const [plat, plng] = vecToLatLng(probe)
        if (isLand(plat, plng)) {
          blocked = true
          break
        }
      }
    }
    const turn = blocked
      ? b.turnDir * 1.1 // evade the coast
      : Math.sin(t * 0.23 + b.bobPhase) * (b.flies ? 0.04 : 0.12) // lazy meandering
    b.heading.applyQuaternion(q.setFromAxisAngle(b.pos, turn * dt))
    b.heading.sub(b.pos.clone().multiplyScalar(b.heading.dot(b.pos))).normalize()
    // advance along the heading's great circle (transports the heading too)
    axis.crossVectors(b.pos, b.heading).normalize()
    q.setFromAxisAngle(axis, b.speed * dt)
    b.pos.applyQuaternion(q).normalize()
    b.heading.applyQuaternion(q).normalize()
    // place & orient (+X forward, +Y up)
    const side = new THREE.Vector3().crossVectors(b.heading, b.pos)
    b.obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(b.heading, b.pos, side))
    b.obj.position.copy(b.pos).multiplyScalar(radius * b.alt)
    if (b.flies) {
      b.obj.rotateX(-turn * 4) // bank into the turn
    } else {
      b.obj.rotateX(Math.sin(t * 1.7 + b.bobPhase) * 0.05 * b.bobScale)
      b.obj.rotateZ(Math.sin(t * 1.3 + b.bobPhase * 2) * 0.04 * b.bobScale)
    }
    updateWake(b, radius, t)
  }
}

export default function TripsPage() {
  const { t } = useTranslation()
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement | null>(null)
  // Our own directional light (installed in onGlobeReady, replacing the
  // stock lights) — repositioned every frame to follow the camera
  const dirLightsRef = useRef<THREE.DirectionalLight[]>([])
  // Decorative boats built in onGlobeReady, sailed by the animation loop
  const boatsRef = useRef<Boat[]>([])
  // Land lookup for boat steering, rasterized from the country polygons
  const landMaskRef = useRef<LandTest>(() => false)
  // Sky objects (built in onGlobeReady), animated by the loop
  const cloudsRef = useRef<THREE.Mesh | null>(null)
  const satRef = useRef<THREE.Group | null>(null)
  const satBeaconRef = useRef<THREE.Mesh | null>(null)
  const [countries, setCountries] = useState<CountryFeature[]>([])
  const [detailedByCode, setDetailedByCode] = useState<Map<string, CountryFeature> | null>(null)
  // Visited countries managed via the /trips/admin dashboard; the bundled
  // data file is only the fallback when the API/storage is unavailable
  const [countriesData, setCountriesData] = useState<VisitedCountry[] | null>(null)
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

  // Load river centerlines (decorative — failures are fine)
  const [rivers, setRivers] = useState<RiverPath[]>([])
  useEffect(() => {
    fetch('/data/rivers.json')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => Array.isArray(data) && setRivers(data))
      .catch(() => {})
  }, [])

  // Load the admin-managed dataset; falls back to the bundled data file
  useEffect(() => {
    fetch('/api/trips-data')
      .then((res) =>
        res.ok && res.headers.get('content-type')?.includes('application/json') ? res.json() : null
      )
      .then((payload) => {
        if (Array.isArray(payload?.data) && payload.data.length > 0) setCountriesData(payload.data)
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

  const activeCountries = countriesData ?? visitedCountries

  const visitedByCode = useMemo(
    () => new Map(activeCountries.map((v) => [v.code, v])),
    [activeCountries]
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

  // Ocean: deep blue with a soft specular sheen — no surface texture; the
  // sense of moving water comes from the boats and their wakes.
  const globeMaterial = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        color: '#0c2d48',
        specular: new THREE.Color('#2f6f8f'),
        shininess: 12,
      }),
    []
  )

  // Per-frame animation: keep the directional light just above the camera
  // ("headlight", so the ocean glint follows the view) and sail the boats.
  useEffect(() => {
    let raf = 0
    let t = 0
    let last = performance.now()
    const tick = (now: number) => {
      // clamp tab-switch deltas — a huge dt would tunnel boats through land
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      t += dt
      const globe = globeRef.current
      if (globe) {
        const cam = globe.camera()
        for (const light of dirLightsRef.current) {
          light.position.copy(cam.position)
          // small upward nudge → glint sits slightly above view center
          light.position.y += cam.position.length() * 0.25
        }
        const radius = globe.getGlobeRadius()
        sailBoats(boatsRef.current, landMaskRef.current, radius, t, dt)
        // clouds drift slowly eastward
        if (cloudsRef.current) cloudsRef.current.rotation.y += dt * 0.004
        // satellite on a fast, steeply tilted low orbit (~40 s per lap)
        if (satRef.current) {
          const sa = t * ((Math.PI * 2) / 40)
          satRef.current.position.set(
            Math.cos(sa) * 1.4 * radius,
            Math.sin(sa) * 0.82 * 1.4 * radius,
            Math.sin(sa) * 0.57 * 1.4 * radius
          )
          const fwd = new THREE.Vector3(
            -Math.sin(sa),
            Math.cos(sa) * 0.82,
            Math.cos(sa) * 0.57
          ).normalize()
          const up = satRef.current.position.clone().normalize()
          satRef.current.quaternion.setFromRotationMatrix(
            new THREE.Matrix4().makeBasis(fwd, up, new THREE.Vector3().crossVectors(fwd, up))
          )
          if (satBeaconRef.current) satBeaconRef.current.visible = Math.sin(t * 6) > 0.2
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])


  // Blocky base shapes, with detailed geometry swapped in for visited countries
  const polygonsData = useMemo(
    () => countries.map((c) => detailedByCode?.get(c.properties.iso3) ?? c),
    [countries, detailedByCode]
  )

  const isVisited = (d: object | null) =>
    !!d && visitedByCode.has((d as CountryFeature).properties.iso3)

  // Stable accessor: a changed identity makes three-globe re-tessellate every
  // polygon on each render, which lags with 16 detailed countries in the scene.
  const polygonAltitude = useCallback(
    (d: object) =>
      visitedByCode.has((d as CountryFeature).properties.iso3)
        ? VISITED_POLY_ALTITUDE
        : BASE_POLY_ALTITUDE,
    [visitedByCode]
  )

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
    selectedPlaceRef.current = null
    globeRef.current?.pointOfView(DEFAULT_POV, 1000)
  }

  const selectCountry = (feature: CountryFeature) => {
    setSelected(feature)
    setPanelCountry(feature)
    setSelectedPlace(null)
    selectedPlaceRef.current = null
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
        selectedPlaceRef.current = null
        focusCountry(feature)
      }
      return
    }
    selectCountry(feature)
  }

  // Card arrows: cycle through the visited countries (dashboard order)
  const stepCountry = (dir: 1 | -1) => {
    const codes = activeCountries.map((v) => v.code)
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

  // Zoom in on a visited place. When a neighbour is too close to distinguish
  // (e.g. Hong Kong/Macau), zoom past 0.3 until the flags separate on screen.
  const focusPlace = useCallback((place: VisitedPlace) => {
    selectedPlaceRef.current = place
    setSelectedPlace(place)
    const globe = globeRef.current
    let altitude = 0.3
    if (globe) {
      const pov = globe.pointOfView() as { altitude?: number }
      const cur = pov?.altitude ?? 1
      const own = globe.getScreenCoords(place.lat, place.lng, MARKER_ALTITUDE)
      const others = placesRef.current.filter((p) => p.name !== place.name)
      if (others.length > 0) {
        const nnPx = Math.min(
          ...others.map((p) => {
            const q = globe.getScreenCoords(p.lat, p.lng, MARKER_ALTITUDE)
            return Math.hypot(q.x - own.x, q.y - own.y)
          })
        )
        altitude = Math.max(MIN_ALTITUDE + 0.01, Math.min(0.3, cur * (nnPx / SPLIT_TARGET_PX)))
      }
    }
    globeRef.current?.pointOfView({ lat: place.lat, lng: place.lng, altitude }, 800)
  }, [])

  // Markers for the visited places of the currently selected country, with
  // screen-space clustering: places whose flags would overlap are grouped
  // into a single count badge. The marker data identity only changes when the
  // cluster composition changes (tracked via a signature), so flags are not
  // needlessly recreated (which would replay the plant animation) on every
  // render or small zoom step.
  const markerEls = useRef(new Map<string, HTMLDivElement>())
  const placesRef = useRef<VisitedPlace[]>([])
  const selectedPlaceRef = useRef<VisitedPlace | null>(null)
  const markerSigRef = useRef('')
  const markerDataRef = useRef<MarkerDatum[]>([])
  const lastCountryRef = useRef<string | null>(null)
  const altitudeRef = useRef(DEFAULT_POV.altitude)
  // Quantized zoom level — bumps a re-cluster check on meaningful zoom changes
  const [altBucket, setAltBucket] = useState(() => Math.round(Math.log2(DEFAULT_POV.altitude) * 4))

  const placeMarkers = useMemo(() => {
    const globe = globeRef.current
    if (!selected || !globe) {
      markerSigRef.current = ''
      markerDataRef.current = []
      placesRef.current = []
      return markerDataRef.current
    }
    const code = selected.properties.iso3
    const places = visitedByCode.get(code)?.places ?? []
    placesRef.current = places
    if (places.length === 0) {
      markerSigRef.current = `${code}::empty`
      markerDataRef.current = []
      return markerDataRef.current
    }

    // group places whose markers are within CLUSTER_PX on screen (union-find)
    const pts = places.map((p) => globe.getScreenCoords(p.lat, p.lng, MARKER_ALTITUDE))
    const parent = places.map((_, i) => i)
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
    for (let i = 0; i < places.length; i++) {
      for (let j = i + 1; j < places.length; j++) {
        if (Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) < CLUSTER_PX) {
          parent[find(i)] = find(j)
        }
      }
    }
    const groups = new Map<number, number[]>()
    places.forEach((_, i) => {
      const root = find(i)
      groups.set(root, [...(groups.get(root) ?? []), i])
    })

    // Per group: pixel extent, and whether zooming to the floor can split it.
    // Unsplittable groups fan their flags apart once the camera is near the
    // floor, so no places stay locked inside a cluster forever.
    const floorCap = MIN_ALTITUDE + 0.01
    const nearFloor = altitudeRef.current <= floorCap + 0.015
    const groupInfos = [...groups.values()].map((group) => {
      let maxPx = 0
      for (const i of group)
        for (const j of group)
          maxPx = Math.max(maxPx, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y))
      const pxAtFloor = (maxPx * altitudeRef.current) / floorCap
      const spread = group.length > 1 && pxAtFloor < SPLIT_TARGET_PX && nearFloor
      return { group, maxPx, spread }
    })

    const sig =
      code +
      '::' +
      groupInfos
        .map((gi) => gi.group.map((i) => places[i].name).sort().join(gi.spread ? '*' : '+'))
        .sort()
        .join('|')
    if (sig === markerSigRef.current) return markerDataRef.current

    // On a fresh country selection the plant animation waits for the camera
    // flight; on zoom-driven re-clustering the markers appear right away.
    const isNewCountry = lastCountryRef.current !== code
    lastCountryRef.current = code
    markerSigRef.current = sig
    markerEls.current.clear()

    const data: MarkerDatum[] = []
    let order = 0
    for (const { group, maxPx, spread } of groupInfos) {
      const delayMs = isNewCountry ? 1050 + order * 110 : order * 60
      if (group.length === 1) {
        const p = places[group[0]]
        data.push({ kind: 'place', ...p, source: p, delayMs })
      } else if (spread) {
        const cx = group.reduce((sum, i) => sum + pts[i].x, 0) / group.length
        const cy = group.reduce((sum, i) => sum + pts[i].y, 0) / group.length
        group.forEach((i, k) => {
          const p = places[i]
          let spreadX: number
          let spreadY: number
          if (maxPx > 4) {
            const factor = SPREAD_TARGET_PX / maxPx - 1
            spreadX = (pts[i].x - cx) * factor
            spreadY = (pts[i].y - cy) * factor
          } else {
            const angle = (k / group.length) * Math.PI * 2
            spreadX = Math.cos(angle) * SPREAD_TARGET_PX * 0.6
            spreadY = Math.sin(angle) * SPREAD_TARGET_PX * 0.6
          }
          data.push({ kind: 'place', ...p, source: p, delayMs, spreadX, spreadY })
        })
      } else {
        const lat = group.reduce((sum, i) => sum + places[i].lat, 0) / group.length
        const lng = group.reduce((sum, i) => sum + places[i].lng, 0) / group.length
        // altitude at which the widest pair reaches SPLIT_TARGET_PX apart
        const splitAlt = Math.max(floorCap, altitudeRef.current * (maxPx / SPLIT_TARGET_PX))
        data.push({ kind: 'cluster', lat, lng, count: group.length, splitAlt, delayMs })
      }
      order++
    }
    markerDataRef.current = data
    return data
  }, [selected, visitedByCode, altBucket, size.height])

  const makeMarkerElement = useCallback(
    (datum: object) => {
      const d = datum as MarkerDatum
      const el = document.createElement('div')
      el.style.pointerEvents = 'auto'
      // The globe's click detection raycasts into the 3D scene regardless of
      // DOM hits, so marker clicks would ALSO select the country underneath.
      // Swallow pointer events here so only the marker handles them.
      for (const type of ['pointerdown', 'pointerup', 'click'] as const) {
        el.addEventListener(type, (ev) => ev.stopPropagation())
      }
      // Wheel zoom must keep working while hovering a marker: the element sits
      // above the canvas, so forward wheel events to it.
      el.addEventListener(
        'wheel',
        (ev) => {
          const canvas = containerRef.current?.querySelector('canvas')
          if (!canvas) return
          ev.preventDefault()
          canvas.dispatchEvent(new WheelEvent('wheel', ev))
        },
        { passive: false }
      )

      if (d.kind === 'cluster') {
        el.className = 'place-cluster'
        el.title = t('trips.clusterHint')
        el.innerHTML = `<div class="place-cluster-badge" style="animation-delay: ${d.delayMs}ms">${d.count}</div>`
        el.onclick = (ev) => {
          ev.stopPropagation()
          const pov = globeRef.current?.pointOfView() as { altitude?: number } | undefined
          const cur = pov?.altitude ?? 1
          const altitude = Math.max(MIN_ALTITUDE + 0.01, Math.min(cur * 0.55, d.splitAlt))
          globeRef.current?.pointOfView({ lat: d.lat, lng: d.lng, altitude }, 600)
        }
        return el
      }

      const home = isHomePlace(d.name)
      el.className = `place-flag${home ? ' place-flag--home' : ''}${selectedPlaceRef.current?.name === d.name ? ' place-flag--active' : ''}`
      if (home) el.title = t('trips.homeHint')
      el.innerHTML = `
        <div class="place-flag-spread" style="transform: translate(${d.spreadX ?? 0}px, ${d.spreadY ?? 0}px)">
          <div class="place-flag-inner" style="animation-delay: ${d.delayMs}ms">
            <div class="place-flag-pole"></div>
            <div class="place-flag-banner">${home ? HOUSE_ICON_SVG : ''}${d.name}</div>
            <div class="place-flag-ground"></div>
          </div>
          <div class="place-flag-hit"></div>
        </div>`
      el.onclick = (ev) => {
        ev.stopPropagation()
        focusPlace(d.source)
      }
      markerEls.current.set(d.name, el)
      return el
    },
    [focusPlace, t]
  )

  // Active-place styling is toggled on the existing flag elements
  useEffect(() => {
    for (const [name, el] of markerEls.current) {
      el.classList.toggle('place-flag--active', selectedPlace?.name === name)
    }
  }, [selectedPlace, placeMarkers])

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
    <div className="h-dvh flex flex-col overflow-hidden relative z-10 bg-gradient-to-b from-purple-900 via-blue-900 to-black">
      {/* Same space backdrop as the home page's About section */}
      <SpaceBackground />
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
                  // Land must be opaque — translucent fills let the animated
                  // water shimmer through the countries.
                  return isVisited(d)
                    ? active ? '#bef264' : '#a3e635'
                    : active ? '#1f7a3f' : '#14532d'
                }}
                polygonSideColor={() => 'rgba(0,0,0,0.25)'}
                polygonStrokeColor={() => '#161b22'}
                polygonAltitude={polygonAltitude}
                polygonsTransitionDuration={300}
                pathsData={rivers}
                pathPoints={(d: object) => (d as RiverPath).points}
                pathPointLat={(p: [number, number]) => p[0]}
                pathPointLng={(p: [number, number]) => p[1]}
                pathPointAlt={RIVER_ALTITUDE}
                pathColor={() => '#4596cf'}
                pathTransitionDuration={0}
                // Rivers are decoration — never let them swallow country
                // hover/clicks (line raycast hits have a generous threshold)
                pointerEventsFilter={(obj: THREE.Object3D) => {
                  for (let o: THREE.Object3D | null = obj; o; o = o.parent) {
                    if ((o as unknown as { __globeObjType?: string }).__globeObjType === 'path') return false
                  }
                  return true
                }}
                htmlElementsData={placeMarkers}
                htmlAltitude={MARKER_ALTITUDE}
                htmlElement={makeMarkerElement}
                htmlTransitionDuration={0}
                polygonLabel={(d: object) => {
                  const feature = d as CountryFeature
                  const visited = visitedByCode.has(feature.properties.iso3)
                  return `
                    <div style="background: rgba(34,40,49,0.92); color: #EEEEEE; padding: 8px 12px; border-radius: 8px; font-size: 14px; border: 1px solid ${visited ? ACCENT : 'rgba(238,238,238,0.15)'}; pointer-events: none;">
                      <div style="font-weight: 600;">${feature.properties.name}</div>
                    </div>`
                }}
                onZoom={(pov: { altitude: number }) => {
                  altitudeRef.current = pov.altitude
                  setAltBucket(Math.round(Math.log2(Math.max(pov.altitude, 0.01)) * 4))
                }}
                onPolygonHover={(d: object | null) => setHovered(d as CountryFeature | null)}
                onPolygonClick={handleCountryClick}
                onGlobeReady={() => {
                  const globe = globeRef.current
                  if (!globe) return
                  const controls = globe.controls()
                  const globeR = globe.getGlobeRadius()
                  controls.minDistance = globeR * (1 + MIN_ALTITUDE)
                  controls.maxDistance = globeR * (1 + MAX_ALTITUDE)
                  // Replace the default lights: the stock directional light
                  // is pinned above the north pole, lighting only the top of
                  // the globe. Swapping in our own means the animation loop
                  // can reliably keep it just above the camera.
                  const dirLight = new THREE.DirectionalLight(0xffffff, 0.6 * Math.PI)
                  dirLightsRef.current = [dirLight]
                  globe.lights([new THREE.AmbientLight(0xcccccc, Math.PI), dirLight])
                  // Sharper textures up close: use the GPU's best filtering
                  const maxAniso = globe.renderer().capabilities.getMaxAnisotropy()
                  // Mountain relief overlay: hillshade pre-baked from Natural
                  // Earth data (regenerate with scripts/build-relief-texture.py)
                  const scene = globe.scene()
                  if (!scene.getObjectByName('mountain-relief')) {
                    new THREE.TextureLoader().load('/textures/relief-shade.png', (tex) => {
                      tex.colorSpace = THREE.SRGBColorSpace
                      tex.anisotropy = maxAniso
                      const relief = new THREE.Mesh(
                        new THREE.SphereGeometry(globeR * 1.011, 128, 64),
                        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
                      )
                      relief.name = 'mountain-relief'
                      relief.rotation.y = -Math.PI / 2 // three-globe's lat/lng alignment
                      relief.raycast = () => {} // never block country hover/click
                      scene.add(relief)
                    })
                  }
                  // Launch the fleet: boats spawn at random open-water spots
                  // and wander from there (replaces any fleet from a remount)
                  const isLand = buildLandMask(countries)
                  landMaskRef.current = isLand
                  const previousFleet = scene.getObjectByName('boats')
                  if (previousFleet) scene.remove(previousFleet)
                  boatsRef.current = []
                  const fleet = new THREE.Group()
                  fleet.name = 'boats'
                  for (let i = 0; i < BOAT_COUNT; i++) {
                    const spawn = spawnBoat(isLand)
                    if (!spawn) continue
                    const kind = pickShipKind()
                    const obj = kind.build()
                    obj.traverse((o) => {
                      o.raycast = () => {} // decoration — never block country clicks
                    })
                    const wakeMesh = makeWakeMesh()
                    fleet.add(obj, wakeMesh)
                    boatsRef.current.push({
                      obj,
                      pos: spawn.pos,
                      heading: spawn.heading,
                      speed: kind.speed[0] + Math.random() * (kind.speed[1] - kind.speed[0]),
                      turnDir: Math.random() < 0.5 ? 1 : -1,
                      bobPhase: Math.random() * 10,
                      wakeScale: kind.wakeScale,
                      bobScale: kind.bobScale,
                      flies: false,
                      alt: 1.0008,
                      wake: { mesh: wakeMesh, pts: [], lastSample: 0 },
                    })
                  }
                  // ...and a few airliners above it all, leaving contrails.
                  // They spawn anywhere — planes don't mind land.
                  for (let i = 0; i < PLANE_COUNT; i++) {
                    const spawn = spawnBoat(() => false)
                    if (!spawn) continue
                    const obj = makePlane()
                    // varied size and cruising altitude give the sky depth:
                    // small ones low, big ones high, everything in between
                    const size = 0.7 + Math.random() * 0.6
                    obj.scale.setScalar(size)
                    obj.traverse((o) => {
                      o.raycast = () => {}
                    })
                    const contrail = makeWakeMesh('#ffffff')
                    fleet.add(obj, contrail)
                    boatsRef.current.push({
                      obj,
                      pos: spawn.pos,
                      heading: spawn.heading,
                      speed: 0.03 + Math.random() * 0.025,
                      turnDir: 1,
                      bobPhase: Math.random() * 10,
                      wakeScale: 0.35 * size,
                      bobScale: 0,
                      flies: true,
                      alt: 1.028 + Math.random() * 0.042,
                      wake: { mesh: contrail, pts: [], lastSample: 0 },
                    })
                  }
                  scene.add(fleet)
                  // Sky: drifting cloud layer between the terrain and the
                  // planes, a mottled moon far out, a blinking satellite
                  const skyPrev = scene.getObjectByName('sky')
                  if (skyPrev) scene.remove(skyPrev)
                  const sky = new THREE.Group()
                  sky.name = 'sky'
                  new THREE.TextureLoader().load('/textures/clouds.png', (tex) => {
                    tex.anisotropy = maxAniso
                    const clouds = new THREE.Mesh(
                      new THREE.SphereGeometry(globeR * 1.02, 96, 48),
                      new THREE.MeshLambertMaterial({
                        map: tex,
                        transparent: true,
                        depthWrite: false,
                      })
                    )
                    clouds.raycast = () => {}
                    cloudsRef.current = clouds
                    sky.add(clouds)
                  })
                  const { sat, beacon } = makeSatellite()
                  sat.traverse((o) => {
                    o.raycast = () => {}
                  })
                  satRef.current = sat
                  satBeaconRef.current = beacon
                  sky.add(sat)
                  scene.add(sky)
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
                    {activeCountries.length > 1 && (
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
                    {activeCountries.length > 1 && (
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

                  {visitedByCode.get(panelCountry.properties.iso3)?.description && (
                    <p className="mt-5 md:mt-8 text-sm md:text-base text-on-dark leading-relaxed whitespace-pre-line border-t border-gray-700 pt-4 md:pt-6">
                      {visitedByCode.get(panelCountry.properties.iso3)?.description}
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
                            title={isHomePlace(place.name) ? t('trips.homeHint') : undefined}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 md:px-4 md:py-1.5 text-sm md:text-base border transition-colors ${
                              isHomePlace(place.name)
                                ? selectedPlace === place
                                  ? 'bg-amber-400/15 border-amber-400 text-amber-300'
                                  : 'border-amber-500/60 text-amber-300 hover:border-amber-300 hover:text-amber-200'
                                : selectedPlace === place
                                  ? 'bg-chip border-accent text-accent'
                                  : 'border-gray-600 text-on-dark hover:border-accent hover:text-accent'
                            }`}
                          >
                            {isHomePlace(place.name) ? (
                              <House className="h-3.5 w-3.5 md:h-4 md:w-4" />
                            ) : (
                              <Flag className="h-3.5 w-3.5 md:h-4 md:w-4" />
                            )}
                            {place.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedPlace?.description && (
                    <p className="mt-4 md:mt-6 text-sm md:text-base text-on-dark leading-relaxed whitespace-pre-line">
                      {selectedPlace.description}
                    </p>
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
