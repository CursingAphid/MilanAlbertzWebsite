import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Globe from 'react-globe.gl'
import type { GlobeMethods } from 'react-globe.gl'
import * as THREE from 'three'
import { geoArea, geoBounds, geoCentroid } from 'd3-geo'
import { BadgeCheck, BarChart3, ChevronDown, ChevronLeft, ChevronRight, Flag, House, Image as ImageIcon, Maximize2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import NavBar from '../components/NavBar'
import SpaceBackground from '../components/SpaceBackground'
import { visitedCountries } from '../data/visitedCountries'
import type { VisitedCountry, VisitedPlace } from '../data/visitedCountries'
import { mediaPrefix, isVideo, placeSlug, optimizedUrl } from '../utils/placeMedia'
import 'flag-icons/css/flag-icons.min.css'
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
// NavBar is `fixed` (h-16) and overlays the top of the page rather than
// pushing content down. On mobile the hero is hidden, so the globe
// container's own top edge sits at y=0, directly behind the navbar — the
// framing math below must treat that band as dead space, not usable canvas.
const MOBILE_NAV_HEIGHT_PX = 64
// fraction of the container height the bottom sheet occupies on mobile
const MOBILE_CARD_FRACTION = 0.6
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

// SVG flag (flag-icons css classes); sized via font-size like text

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

// Rasterize the country polygons into a small equirectangular mask for cheap
// "is there land here?" lookups. `padPx` > 0 grows the coastlines outward
// (boats keep their distance); 0 gives the exact land shape (buildings).
const buildLandMask = (features: CountryFeature[], padPx = 10, W = 1024, H = 512): LandTest => {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return () => false
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = padPx
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
      if (padPx > 0) ctx.stroke()
    }
  }
  const mask = ctx.getImageData(0, 0, W, H).data
  return (lat, lng) => {
    const x = Math.min(W - 1, Math.max(0, Math.floor((((((lng + 180) % 360) + 360) % 360) / 360) * W)))
    const y = Math.min(H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * H)))
    return mask[(y * W + x) * 4 + 3] > 0
  }
}

// ---------- world landmarks ----------

// Small primitive helpers for the landmark models (waterline/ground at y = 0)
const lmCyl = (
  parent: THREE.Group,
  rTop: number,
  rBot: number,
  h: number,
  color: string,
  x: number,
  y: number,
  z = 0,
  seg = 8
) => {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(rTop, rBot, h, seg),
    new THREE.MeshLambertMaterial({ color })
  )
  mesh.position.set(x, y, z)
  parent.add(mesh)
  return mesh
}

const lmSphere = (parent: THREE.Group, r: number, color: string, x: number, y: number, z = 0) => {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(r, 12, 8),
    new THREE.MeshLambertMaterial({ color })
  )
  mesh.position.set(x, y, z)
  parent.add(mesh)
  return mesh
}

// Famous landmarks, each hand-built from a few primitives — recognizable
// silhouettes rather than faithful models.
const buildEiffel = () => {
  const g = new THREE.Group()
  lmCyl(g, 0.1, 0.32, 0.55, '#6e553f', 0, 0.27, 0, 4)
  lmCyl(g, 0.05, 0.1, 0.5, '#6e553f', 0, 0.78, 0, 4)
  lmCyl(g, 0.015, 0.05, 0.45, '#6e553f', 0, 1.25, 0, 4)
  lmCyl(g, 0.008, 0.008, 0.22, '#6e553f', 0, 1.58, 0, 4)
  return g
}

const buildBigBen = () => {
  const g = new THREE.Group()
  shipBox(g, 0.22, 1.0, 0.22, '#c9b791', 0, 0.5)
  shipBox(g, 0.26, 0.16, 0.26, '#e8e2d0', 0, 1.0)
  lmCyl(g, 0, 0.16, 0.35, '#4a5d54', 0, 1.26, 0, 4)
  return g
}

const buildLiberty = () => {
  const g = new THREE.Group()
  shipBox(g, 0.3, 0.25, 0.3, '#b8a88f', 0, 0.125)
  lmCyl(g, 0.09, 0.11, 0.45, '#6fae9a', 0, 0.48)
  lmSphere(g, 0.07, '#6fae9a', 0, 0.76)
  const arm = shipBox(g, 0.05, 0.38, 0.05, '#6fae9a', 0.11, 0.85)
  arm.rotation.z = -0.35
  lmSphere(g, 0.045, '#f2c14e', 0.18, 1.03)
  return g
}

const buildPyramids = () => {
  const g = new THREE.Group()
  lmCyl(g, 0, 0.38, 0.42, '#d4b06a', 0, 0.21, 0, 4)
  lmCyl(g, 0, 0.26, 0.3, '#c9a55e', 0.5, 0.15, 0.25, 4)
  lmCyl(g, 0, 0.18, 0.22, '#dcb974', -0.45, 0.11, 0.3, 4)
  return g
}

const buildColosseum = () => {
  const g = new THREE.Group()
  lmCyl(g, 0.36, 0.36, 0.22, '#cbb693', 0, 0.11, 0, 14)
  lmCyl(g, 0.28, 0.28, 0.3, '#bfa87f', 0, 0.15, 0, 14)
  lmCyl(g, 0.18, 0.18, 0.06, '#8a7a5c', 0, 0.15, 0, 12)
  return g
}

const buildRedeemer = () => {
  const g = new THREE.Group()
  shipBox(g, 0.14, 0.18, 0.14, '#9aa2ab', 0, 0.09)
  shipBox(g, 0.1, 0.5, 0.1, '#f0ede5', 0, 0.42)
  shipBox(g, 0.56, 0.08, 0.08, '#f0ede5', 0, 0.56)
  lmSphere(g, 0.055, '#f0ede5', 0, 0.72)
  return g
}

const buildBurj = () => {
  const g = new THREE.Group()
  lmCyl(g, 0.16, 0.24, 0.5, '#c8ccd2', 0, 0.25, 0, 6)
  lmCyl(g, 0.1, 0.16, 0.5, '#d4d8dd', 0, 0.75, 0, 6)
  lmCyl(g, 0.055, 0.1, 0.5, '#c8ccd2', 0, 1.25, 0, 6)
  lmCyl(g, 0.02, 0.055, 0.4, '#d4d8dd', 0, 1.7, 0, 6)
  lmCyl(g, 0.006, 0.006, 0.35, '#b8bcc2', 0, 2.05, 0, 6)
  return g
}

const buildOperaHouse = () => {
  const g = new THREE.Group()
  shipBox(g, 0.75, 0.08, 0.45, '#d9cfc0', 0, 0.04)
  const sail = (w: number, h: number, x: number, tilt: number) => {
    const geom = new THREE.BufferGeometry()
    geom.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, 0, w, 0, 0, w * 0.35, h, 0], 3)
    )
    geom.computeVertexNormals()
    const mesh = new THREE.Mesh(
      geom,
      new THREE.MeshLambertMaterial({ color: '#f4f1e8', side: THREE.DoubleSide })
    )
    mesh.position.set(x, 0.08, 0)
    mesh.rotation.x = tilt
    g.add(mesh)
  }
  sail(0.34, 0.42, -0.32, 0.15)
  sail(0.3, 0.34, -0.02, -0.12)
  sail(0.26, 0.27, 0.24, 0.18)
  return g
}

const buildTajMahal = () => {
  const g = new THREE.Group()
  shipBox(g, 0.52, 0.1, 0.52, '#e8e2d8', 0, 0.05)
  shipBox(g, 0.3, 0.26, 0.3, '#f4efe6', 0, 0.26)
  lmSphere(g, 0.16, '#f4efe6', 0, 0.5)
  for (const dx of [-0.23, 0.23]) {
    for (const dz of [-0.23, 0.23]) {
      lmCyl(g, 0.02, 0.02, 0.38, '#efe9dd', dx, 0.29, dz, 6)
    }
  }
  return g
}

const buildGoldenGate = () => {
  const g = new THREE.Group()
  shipBox(g, 1.05, 0.03, 0.1, '#c0442e', 0, 0.2)
  shipBox(g, 0.06, 0.6, 0.06, '#c0442e', -0.3, 0.3)
  shipBox(g, 0.06, 0.6, 0.06, '#c0442e', 0.3, 0.3)
  return g
}

const buildTorii = () => {
  const g = new THREE.Group()
  lmCyl(g, 0.035, 0.04, 0.5, '#c73e2e', -0.18, 0.25, 0, 8)
  lmCyl(g, 0.035, 0.04, 0.5, '#c73e2e', 0.18, 0.25, 0, 8)
  shipBox(g, 0.62, 0.06, 0.09, '#c73e2e', 0, 0.55)
  shipBox(g, 0.46, 0.05, 0.07, '#c73e2e', 0, 0.42)
  return g
}

const buildStBasils = () => {
  const g = new THREE.Group()
  shipBox(g, 0.36, 0.2, 0.36, '#b0402f', 0, 0.1)
  lmCyl(g, 0.1, 0.1, 0.32, '#e8e2d0', 0, 0.36, 0, 10)
  const onion = lmSphere(g, 0.14, '#d98032', 0, 0.62)
  onion.scale.y = 1.25
  lmCyl(g, 0, 0.05, 0.16, '#e6c14f', 0, 0.85, 0, 6)
  lmCyl(g, 0.05, 0.05, 0.22, '#f0ede5', 0.2, 0.31, 0.2, 8)
  lmSphere(g, 0.07, '#3f8fbf', 0.2, 0.48, 0.2)
  lmCyl(g, 0.05, 0.05, 0.22, '#f0ede5', -0.2, 0.31, -0.2, 8)
  lmSphere(g, 0.07, '#5ba05b', -0.2, 0.48, -0.2)
  return g
}

const buildWindmill = () => {
  const g = new THREE.Group()
  lmCyl(g, 0.1, 0.15, 0.42, '#7a5a3a', 0, 0.21, 0, 8)
  lmCyl(g, 0, 0.13, 0.14, '#4a3826', 0, 0.49, 0, 8)
  const blades = new THREE.Group()
  const b1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.6, 0.07),
    new THREE.MeshLambertMaterial({ color: '#e8e2d0' })
  )
  const b2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.07, 0.6),
    new THREE.MeshLambertMaterial({ color: '#e8e2d0' })
  )
  blades.add(b1, b2)
  blades.position.set(0.14, 0.45, 0)
  blades.rotation.x = Math.PI / 4
  g.add(blades)
  return g
}

const buildPisa = () => {
  const g = new THREE.Group()
  const tower = lmCyl(g, 0.09, 0.1, 0.5, '#f0ead8', 0, 0.26, 0, 10)
  tower.rotation.z = 0.15
  const top = lmCyl(g, 0.065, 0.07, 0.1, '#e6dfc9', -0.076, 0.55, 0, 10)
  top.rotation.z = 0.15
  return g
}

const buildPetronas = () => {
  const g = new THREE.Group()
  for (const dz of [-0.15, 0.15]) {
    lmCyl(g, 0.07, 0.1, 0.65, '#c8ccd2', 0, 0.33, dz, 8)
    lmCyl(g, 0.01, 0.05, 0.2, '#d4d8dd', 0, 0.75, dz, 8)
    lmCyl(g, 0.005, 0.005, 0.18, '#b8bcc2', 0, 0.92, dz, 6)
  }
  shipBox(g, 0.05, 0.03, 0.3, '#9aa2ab', 0, 0.38)
  return g
}

const buildMoai = () => {
  const g = new THREE.Group()
  shipBox(g, 0.32, 0.07, 0.18, '#6e747c', 0, 0.035)
  shipBox(g, 0.14, 0.28, 0.12, '#8d939b', 0, 0.21)
  shipBox(g, 0.12, 0.2, 0.11, '#979da6', 0, 0.44)
  shipBox(g, 0.03, 0.08, 0.03, '#8d939b', 0.06, 0.42)
  return g
}

const buildMachuPicchu = () => {
  const g = new THREE.Group()
  shipBox(g, 0.5, 0.08, 0.4, '#7c8f6a', 0, 0.04)
  shipBox(g, 0.4, 0.08, 0.32, '#8fa07a', 0, 0.12)
  shipBox(g, 0.3, 0.08, 0.24, '#7c8f6a', 0, 0.2)
  shipBox(g, 0.08, 0.06, 0.06, '#9aa2ab', -0.05, 0.27)
  shipBox(g, 0.06, 0.05, 0.06, '#9aa2ab', 0.07, 0.27)
  lmCyl(g, 0, 0.14, 0.5, '#66785c', -0.28, 0.4, -0.12, 5) // Huayna Picchu
  return g
}

const buildStonehenge = () => {
  const g = new THREE.Group()
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    shipBox(g, 0.05, 0.18, 0.05, '#9aa2ab', Math.cos(a) * 0.2, 0.09, Math.sin(a) * 0.2)
  }
  shipBox(g, 0.2, 0.045, 0.07, '#8d939b', 0.1, 0.2, -0.17)
  shipBox(g, 0.2, 0.045, 0.07, '#8d939b', -0.14, 0.2, 0.12)
  return g
}

const buildGreatWall = () => {
  const g = new THREE.Group()
  const seg1 = shipBox(g, 0.45, 0.12, 0.09, '#a89a7c', -0.28, 0.06)
  seg1.rotation.y = 0.5
  const seg2 = shipBox(g, 0.45, 0.12, 0.09, '#a89a7c', 0.28, 0.06)
  seg2.rotation.y = -0.5
  shipBox(g, 0.14, 0.24, 0.14, '#8a7a5c', 0, 0.12) // watchtower
  return g
}

const buildNeuschwanstein = () => {
  const g = new THREE.Group()
  shipBox(g, 0.32, 0.22, 0.2, '#f0ede5', 0, 0.11)
  lmCyl(g, 0.05, 0.05, 0.42, '#f0ede5', -0.12, 0.21, 0, 8)
  lmCyl(g, 0, 0.07, 0.16, '#5b7fa6', -0.12, 0.5, 0, 8)
  lmCyl(g, 0.035, 0.035, 0.3, '#f0ede5', 0.14, 0.15, 0.06, 8)
  lmCyl(g, 0, 0.055, 0.13, '#5b7fa6', 0.14, 0.37, 0.06, 8)
  shipBox(g, 0.12, 0.1, 0.12, '#e8e2d0', 0.02, 0.27)
  lmCyl(g, 0, 0.09, 0.12, '#5b7fa6', 0.02, 0.38, 0, 4)
  return g
}

const buildSagrada = () => {
  const g = new THREE.Group()
  shipBox(g, 0.4, 0.12, 0.25, '#c9a86f', 0, 0.06)
  lmCyl(g, 0.01, 0.06, 0.55, '#b8975e', -0.13, 0.38, 0, 6)
  lmCyl(g, 0.01, 0.07, 0.7, '#c9a86f', 0, 0.45, 0, 6)
  lmCyl(g, 0.01, 0.06, 0.55, '#b8975e', 0.13, 0.38, 0, 6)
  lmCyl(g, 0.01, 0.05, 0.42, '#c9a86f', 0, 0.3, 0.14, 6)
  return g
}

const buildParthenon = () => {
  const g = new THREE.Group()
  shipBox(g, 0.5, 0.06, 0.3, '#d9cfb8', 0, 0.03)
  for (const x of [-0.2, -0.1, 0, 0.1, 0.2]) {
    lmCyl(g, 0.022, 0.022, 0.2, '#e6dcc4', x, 0.16, 0.11, 6)
    lmCyl(g, 0.022, 0.022, 0.2, '#e6dcc4', x, 0.16, -0.11, 6)
  }
  shipBox(g, 0.52, 0.05, 0.32, '#d9cfb8', 0, 0.28)
  shipBox(g, 0.4, 0.04, 0.24, '#cfc4aa', 0, 0.32)
  return g
}

const buildHagiaSophia = () => {
  const g = new THREE.Group()
  shipBox(g, 0.4, 0.16, 0.4, '#c9b08a', 0, 0.08)
  lmSphere(g, 0.18, '#8a7a5c', 0, 0.24)
  for (const dx of [-0.26, 0.26]) {
    for (const dz of [-0.26, 0.26]) {
      lmCyl(g, 0.016, 0.016, 0.45, '#e8e2d0', dx, 0.22, dz, 6)
    }
  }
  return g
}

const buildAngkorWat = () => {
  const g = new THREE.Group()
  shipBox(g, 0.55, 0.08, 0.4, '#8a795f', 0, 0.04)
  lmCyl(g, 0, 0.09, 0.45, '#786a52', 0, 0.3, 0, 6)
  for (const [dx, dz] of [
    [-0.18, -0.12],
    [0.18, -0.12],
    [-0.18, 0.12],
    [0.18, 0.12],
  ]) {
    lmCyl(g, 0, 0.07, 0.32, '#8a795f', dx, 0.24, dz, 6)
  }
  return g
}

const buildChichenItza = () => {
  const g = new THREE.Group()
  shipBox(g, 0.45, 0.07, 0.45, '#c2ab84', 0, 0.035)
  shipBox(g, 0.35, 0.07, 0.35, '#b8a078', 0, 0.105)
  shipBox(g, 0.26, 0.07, 0.26, '#c2ab84', 0, 0.175)
  shipBox(g, 0.17, 0.07, 0.17, '#b8a078', 0, 0.245)
  shipBox(g, 0.11, 0.1, 0.11, '#a89066', 0, 0.33)
  return g
}

const buildCNTower = () => {
  const g = new THREE.Group()
  lmCyl(g, 0.03, 0.06, 0.7, '#c8ccd2', 0, 0.35, 0, 8)
  lmCyl(g, 0.09, 0.09, 0.07, '#9aa2ab', 0, 0.68, 0, 10)
  lmCyl(g, 0.008, 0.008, 0.32, '#b8bcc2', 0, 0.88, 0, 6)
  return g
}

const buildGatewayArch = () => {
  const g = new THREE.Group()
  const arch = new THREE.Mesh(
    new THREE.TorusGeometry(0.38, 0.022, 8, 24, Math.PI),
    new THREE.MeshLambertMaterial({ color: '#c8ccd2' })
  )
  arch.position.y = 0.01
  g.add(arch)
  return g
}

const buildMarinaBay = () => {
  const g = new THREE.Group()
  for (const x of [-0.18, 0, 0.18]) {
    const tower = shipBox(g, 0.09, 0.45, 0.13, '#d4d8dd', x, 0.225)
    tower.rotation.z = x === 0 ? 0 : x < 0 ? 0.08 : -0.08
  }
  shipBox(g, 0.62, 0.045, 0.16, '#e8e2d0', 0, 0.5) // skypark deck
  return g
}

const buildBrandenburg = () => {
  const g = new THREE.Group()
  for (const x of [-0.2, -0.1, 0, 0.1, 0.2]) {
    shipBox(g, 0.045, 0.24, 0.07, '#d9cfb8', x, 0.12)
  }
  shipBox(g, 0.52, 0.09, 0.12, '#d9cfb8', 0, 0.29)
  shipBox(g, 0.09, 0.06, 0.06, '#6fae9a', 0, 0.37) // quadriga
  return g
}

const buildAtomium = () => {
  const g = new THREE.Group()
  const center = new THREE.Vector3(0, 0.32, 0)
  const corners: THREE.Vector3[] = []
  for (const dx of [-0.18, 0.18]) {
    for (const dy of [0.14, 0.5]) {
      for (const dz of [-0.18, 0.18]) corners.push(new THREE.Vector3(dx, dy, dz))
    }
  }
  // connecting tube between two sphere centers
  const strut = (a: THREE.Vector3, b: THREE.Vector3) => {
    const dir = new THREE.Vector3().subVectors(b, a)
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, dir.length(), 6),
      new THREE.MeshLambertMaterial({ color: '#b0b6bd' })
    )
    mesh.position.copy(a).add(b).multiplyScalar(0.5)
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
    g.add(mesh)
  }
  for (const c of corners) strut(center, c) // 8 diagonals into the middle
  for (let i = 0; i < corners.length; i++) {
    for (let j = i + 1; j < corners.length; j++) {
      const a = corners[i]
      const b = corners[j]
      const axesDiffering =
        (a.x !== b.x ? 1 : 0) + (a.y !== b.y ? 1 : 0) + (a.z !== b.z ? 1 : 0)
      if (axesDiffering === 1) strut(a, b) // 12 cube edges
    }
  }
  lmCyl(g, 0.018, 0.018, 0.14, '#9aa2ab', 0, 0.07, 0, 6)
  lmSphere(g, 0.07, '#c8ccd2', center.x, center.y, center.z)
  for (const c of corners) lmSphere(g, 0.055, '#c8ccd2', c.x, c.y, c.z)
  return g
}

const buildUluru = () => {
  const g = new THREE.Group()
  const rock = lmSphere(g, 0.3, '#b3502e', 0, 0.03)
  rock.scale.set(1.4, 0.35, 0.75)
  return g
}

interface Landmark {
  name: string
  city: string
  lat: number
  lng: number
  build: () => THREE.Group
}

const LANDMARKS: Landmark[] = [
  { name: 'Eiffel Tower', city: 'Paris', lat: 48.858, lng: 2.294, build: buildEiffel },
  { name: 'Big Ben', city: 'London', lat: 51.501, lng: -0.125, build: buildBigBen },
  { name: 'Statue of Liberty', city: 'New York', lat: 40.689, lng: -74.045, build: buildLiberty },
  { name: 'Pyramids of Giza', city: 'Cairo', lat: 29.979, lng: 31.134, build: buildPyramids },
  { name: 'Colosseum', city: 'Rome', lat: 41.89, lng: 12.492, build: buildColosseum },
  { name: 'Christ the Redeemer', city: 'Rio de Janeiro', lat: -22.952, lng: -43.21, build: buildRedeemer },
  { name: 'Burj Khalifa', city: 'Dubai', lat: 25.197, lng: 55.274, build: buildBurj },
  { name: 'Sydney Opera House', city: 'Sydney', lat: -33.857, lng: 151.215, build: buildOperaHouse },
  { name: 'Taj Mahal', city: 'Agra', lat: 27.175, lng: 78.042, build: buildTajMahal },
  { name: 'Golden Gate Bridge', city: 'San Francisco', lat: 37.82, lng: -122.478, build: buildGoldenGate },
  { name: 'Itsukushima Torii', city: 'Hiroshima', lat: 34.296, lng: 132.32, build: buildTorii },
  { name: "Saint Basil's Cathedral", city: 'Moscow', lat: 55.752, lng: 37.623, build: buildStBasils },
  { name: 'Kinderdijk Windmills', city: 'Rotterdam', lat: 51.883, lng: 4.63, build: buildWindmill },
  { name: 'Leaning Tower of Pisa', city: 'Pisa', lat: 43.723, lng: 10.396, build: buildPisa },
  { name: 'Petronas Towers', city: 'Kuala Lumpur', lat: 3.158, lng: 101.712, build: buildPetronas },
  { name: 'Moai', city: 'Easter Island', lat: -27.126, lng: -109.277, build: buildMoai },
  { name: 'Machu Picchu', city: 'Cusco', lat: -13.163, lng: -72.545, build: buildMachuPicchu },
  { name: 'Stonehenge', city: 'Wiltshire', lat: 51.179, lng: -1.826, build: buildStonehenge },
  { name: 'Great Wall', city: 'Beijing', lat: 40.36, lng: 116.02, build: buildGreatWall },
  { name: 'Neuschwanstein Castle', city: 'Bavaria', lat: 47.558, lng: 10.75, build: buildNeuschwanstein },
  { name: 'Sagrada Família', city: 'Barcelona', lat: 41.404, lng: 2.174, build: buildSagrada },
  { name: 'Parthenon', city: 'Athens', lat: 37.972, lng: 23.726, build: buildParthenon },
  { name: 'Hagia Sophia', city: 'Istanbul', lat: 41.009, lng: 28.98, build: buildHagiaSophia },
  { name: 'Angkor Wat', city: 'Siem Reap', lat: 13.412, lng: 103.867, build: buildAngkorWat },
  { name: 'Chichén Itzá', city: 'Yucatán', lat: 20.683, lng: -88.569, build: buildChichenItza },
  { name: 'CN Tower', city: 'Toronto', lat: 43.643, lng: -79.387, build: buildCNTower },
  { name: 'Gateway Arch', city: 'St. Louis', lat: 38.625, lng: -90.185, build: buildGatewayArch },
  { name: 'Marina Bay Sands', city: 'Singapore', lat: 1.284, lng: 103.861, build: buildMarinaBay },
  { name: 'Brandenburg Gate', city: 'Berlin', lat: 52.516, lng: 13.378, build: buildBrandenburg },
  { name: 'Atomium', city: 'Brussels', lat: 50.895, lng: 4.341, build: buildAtomium },
  { name: 'Uluru', city: 'Northern Territory', lat: -25.345, lng: 131.036, build: buildUluru },
]

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

// ---------- per-country card themes ----------

// Some countries get a personalized card: a tinted wash, a flag-colored top
// strip, a big faint watermark and matching accent colors. Add an entry per
// country you want to feel special.
interface CountryTheme {
  border: string // card border color
  tint: string // background wash over the card
  strip: string // decorative strip along the top edge
  watermark?: string // large faint glyph in the corner
  badge: string // verified-badge color
  chipActive: string // selected place chip
  chipIdle: string // idle place chip
  chipClass?: string // extra class on place chips only; supplies its own
  // icon (e.g. the tube roundel), so the default flag icon is skipped
  flagClass?: string // modifier class for the planted place flags (see CSS)
  frame?: string // decorative frame class around the photo slideshow
  watermarkClass?: string // extra classes for the watermark glyph
  extras?: string // key for bespoke decorations rendered in the card
  nativeLabels?: Record<string, string> // local-script names for country/places
  nativeClass?: string // styling for the native-name labels
  bgArt?: string // decorative image rendered in the card's background layer
  bgArtClass?: string // positioning/opacity class for bgArt
  titleArt?: string // small emblem shown next to the country title
  cardClass?: string // extra classes on the card root (e.g. text outlining)
  snow?: boolean // gentle snowfall in the card's background layer
  rain?: boolean // slanted drizzle in the card's background layer
}

const COUNTRY_THEMES: Record<string, CountryTheme> = {
  CHN: {
    border: 'border-red-700/80',
    tint: 'bg-gradient-to-b from-red-800/60 via-red-950/30 to-red-950/55',
    strip: 'h-2.5 cn-meander-strip',
    watermark: '龍',
    watermarkClass: 'cn-calligraphy text-red-200',
    badge: 'text-amber-400',
    chipActive: 'bg-red-500/15 border-amber-400 text-amber-300',
    chipIdle: 'border-red-800/70 text-on-dark hover:border-amber-300 hover:text-amber-200',
    flagClass: 'place-flag--cn',
    frame: 'media-frame--cn',
    extras: 'cn',
    nativeLabels: {
      China: '中国',
      Shenzhen: '深圳',
      'Hong Kong': '香港',
      Macau: '澳門',
    },
    nativeClass: 'cn-calligraphy',
  },
  NLD: {
    border: 'border-orange-500/70',
    tint: 'bg-gradient-to-b from-orange-600/65 via-orange-700/40 to-blue-950/40',
    strip: 'h-4 nl-skyline-strip',
    badge: 'text-orange-400',
    chipActive: 'bg-orange-500/15 border-orange-400 text-orange-300',
    chipIdle: 'border-gray-600 text-on-dark hover:border-orange-300 hover:text-orange-200',
    flagClass: 'place-flag--nl',
    frame: 'media-frame--nl',
    extras: 'nl',
    nativeLabels: { Netherlands: 'Nederland' },
    nativeClass: 'italic',
    bgArt: '/frames/nl-tulips.svg',
    bgArtClass: 'nl-tulips',
    titleArt: '/frames/nl-lion.svg',
  },
  AUT: {
    border: 'border-red-700/80',
    // not the flag here: a dusk alpine panorama with a hint of alpenglow
    tint: 'at-alps-bg',
    strip: 'h-4 at-ridge-strip',
    badge: 'text-red-300',
    chipActive: 'bg-red-500/15 border-red-300 text-red-200',
    chipIdle: 'border-red-400/60 text-on-dark hover:border-red-200 hover:text-red-100',
    flagClass: 'place-flag--at',
    frame: 'media-frame--at',
    extras: 'at',
    nativeLabels: { Austria: 'Österreich' },
    nativeClass: 'italic',
    titleArt: '/frames/at-eagle.svg',
    snow: true,
  },
  GBR: {
    border: 'border-red-700/80',
    // not the flag: London at dusk — skyline silhouettes, fog and drizzle
    tint: 'gb-london-bg',
    strip: 'h-4 gb-gap-strip',
    badge: 'text-red-300',
    chipActive: 'bg-blue-500/15 border-red-400 text-red-100',
    chipIdle: 'border-blue-500/60 text-on-dark hover:border-red-300 hover:text-red-100',
    chipClass: 'gb-chip',
    flagClass: 'place-flag--gb',
    frame: 'media-frame--gb',
    extras: 'gb',
    rain: true,
    titleArt: '/frames/gb-crown.svg',
  },
  ITA: {
    border: 'border-green-700/80',
    // not the flag: a Tuscan golden-hour panorama (hills echo the green,
    // the honey sky echoes the red)
    tint: 'it-tuscany-bg',
    strip: 'h-4 it-arches-strip',
    badge: 'text-amber-300',
    chipActive: 'bg-green-500/15 border-amber-300 text-amber-200',
    chipIdle: 'border-green-700/70 text-on-dark hover:border-amber-200 hover:text-amber-100',
    flagClass: 'place-flag--it',
    frame: 'media-frame--it',
    extras: 'it',
    nativeLabels: { Italy: 'Italia' },
    nativeClass: 'it-serif italic',
  },
  FRA: {
    border: 'border-blue-700/70',
    // the tricolore runs vertically, so this card's wash is horizontal:
    // blue on the left, a pale lift in the middle, red on the right
    tint: 'bg-[linear-gradient(to_right,rgb(0_85_164/0.55)_0%,rgb(0_85_164/0.55)_30%,rgb(252_252_255/0.72)_37%,rgb(252_252_255/0.72)_63%,rgb(225_43_43/0.55)_70%,rgb(225_43_43/0.55)_100%)]',
    strip: 'h-2 fr-flag-strip',
    badge: 'text-blue-300',
    chipActive: 'bg-blue-500/15 border-blue-300 text-blue-200',
    chipIdle: 'border-blue-400/70 text-on-dark hover:border-blue-200 hover:text-blue-100',
    flagClass: 'place-flag--fr',
    frame: 'media-frame--fr',
    extras: 'fr',
    titleArt: '/frames/fr-rooster.svg',
  },
  ESP: {
    border: 'border-red-700/80',
    // the rojigualda: strong red at the edges fading quickly into a wide
    // golden middle (explicit stops — red is done by 22% from each edge)
    tint: 'bg-[linear-gradient(to_bottom,rgb(153_27_27/0.65)_0%,rgb(153_27_27/0.65)_8%,rgb(253_209_49/0.72)_30%,rgb(253_209_49/0.72)_70%,rgb(153_27_27/0.65)_92%,rgb(153_27_27/0.65)_100%)]',
    strip: 'h-2 es-flag-strip',
    badge: 'text-yellow-400',
    chipActive: 'bg-red-500/15 border-yellow-400 text-yellow-300',
    chipIdle: 'border-red-800/70 text-on-dark hover:border-yellow-300 hover:text-yellow-200',
    flagClass: 'place-flag--es',
    frame: 'media-frame--es',
    extras: 'es',
    nativeLabels: { Spain: 'España' },
    nativeClass: 'italic',
    titleArt: '/frames/es-bull.svg',
  },
  BRA: {
    border: 'border-emerald-500/70',
    tint: 'bg-gradient-to-b from-emerald-700/50 via-emerald-900/25 to-yellow-900/30',
    strip: 'h-1.5 bg-gradient-to-r from-green-600 via-yellow-400 to-blue-600',
    badge: 'text-emerald-400',
    chipActive: 'bg-emerald-500/15 border-yellow-300 text-yellow-200',
    chipIdle: 'border-gray-600 text-on-dark hover:border-yellow-300 hover:text-yellow-200',
    flagClass: 'place-flag--br',
    frame: 'media-frame--br',
    extras: 'br',
    nativeLabels: { Brazil: 'Brasil' },
    nativeClass: 'italic',
  },
}

export default function TripsPage() {
  const { t, i18n } = useTranslation()
  // Pick the Dutch text when the site runs in Dutch, falling back to English
  const localText = (item?: { description?: string; descriptionNl?: string }) =>
    i18n.language?.startsWith('nl') ? item?.descriptionNl || item?.description : item?.description
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const pageRef = useRef<HTMLDivElement | null>(null)
  // The DOM moon fades out while the globe's disc covers its screen spot
  const [moonCovered, setMoonCovered] = useState(false)
  // Tooltip shown while hovering a city's buildings (updated imperatively)
  const cityTipRef = useRef<HTMLDivElement | null>(null)
  // Our own directional light (installed in onGlobeReady, replacing the
  // stock lights) — repositioned every frame to follow the camera
  const dirLightsRef = useRef<THREE.DirectionalLight[]>([])
  // Decorative boats built in onGlobeReady, sailed by the animation loop
  const boatsRef = useRef<Boat[]>([])
  // Land lookup for boat steering, rasterized from the country polygons
  const landMaskRef = useRef<LandTest>(() => false)
  // Projection view-offset (fractions of width/height): shifts the whole
  // scene while the panel is open — left on desktop (panel on the right),
  // up on mobile (panel on the bottom half) — without moving or clipping
  // the canvas. Eased toward its target every frame by the animation loop.
  const viewOffsetRef = useRef({ x: 0, y: 0 })
  const viewOffsetTargetRef = useRef({ x: 0, y: 0 })
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
  // Slideshow position within the selected place's media + lightbox state
  const [mediaIndex, setMediaIndex] = useState(0)
  const [mediaFullscreen, setMediaFullscreen] = useState(false)
  // swipe-to-close tracking for the mobile lightbox
  const lightboxTouchY = useRef<number | null>(null)
  // Which media URLs have finished downloading (skeleton pulse until then)
  const [mediaLoaded, setMediaLoaded] = useState<Record<string, boolean>>({})
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

  const [globeReady, setGlobeReady] = useState(false)
  // The scene fades in as one once all layers have had time to build
  const [sceneVisible, setSceneVisible] = useState(false)
  // Travel stats live behind a toggle to keep the hero compact
  const [statsOpen, setStatsOpen] = useState(false)

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

  // Is the globe's projected disc covering the moon's screen position?
  // (moon geometry must match the CSS: top 34%, right 9%, 92px wide)
  const updateMoonCovered = useCallback(() => {
    const globe = globeRef.current
    const container = containerRef.current
    const page = pageRef.current
    if (!globe || !container || !page) return
    const cam = globe.camera() as THREE.PerspectiveCamera
    const R = globe.getGlobeRadius()
    const d = cam.position.length()
    const crect = container.getBoundingClientRect()
    if (crect.height === 0 || d <= R) return
    // pixel radius of the globe: focal length in px × tan(angular radius)
    const focal = crect.height / 2 / Math.tan((cam.fov * Math.PI) / 360)
    const globePx = (focal * R) / Math.sqrt(d * d - R * R)
    const prect = page.getBoundingClientRect()
    const moonX = prect.left + prect.width * 0.91 - 46
    const moonY = prect.top + prect.height * 0.34 + 46
    // the projection view-offset slides the globe's disc away from center
    const cx = crect.left + crect.width / 2 - viewOffsetRef.current.x * crect.width
    const cy = crect.top + crect.height / 2 - viewOffsetRef.current.y * crect.height
    setMoonCovered(Math.hypot(moonX - cx, moonY - cy) < globePx + 40)
  }, [])

  // Keep the globe canvas sized to its container
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight })
      updateMoonCovered()
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [updateMoonCovered])

  const activeCountries = countriesData ?? visitedCountries

  const visitedByCode = useMemo(
    () => new Map(activeCountries.map((v) => [v.code, v])),
    [activeCountries]
  )

  // Lazily load the detailed shapes; polygonsData below swaps them in for
  // visited countries and the current selection (the full set at once would
  // lag, so the rest of the world stays blocky).
  useEffect(() => {
    fetch('/data/countries-detailed.geojson')
      .then((res) => res.json())
      .then((geojson) => {
        const byCode = new Map<string, CountryFeature>(
          (geojson.features as CountryFeature[]).map((f) => [f.properties.iso3, f])
        )
        setDetailedByCode(byCode)
      })
      .catch(() => {}) // fall back to blocky shapes silently
  }, [])

  // Landmark hover tooltip: convert the cursor to lat/lng on the globe and
  // find the nearest landmark — the area around it is the hover target, and
  // it grows a little when zoomed out so landmarks stay easy to hit.
  useEffect(() => {
    if (!globeReady) return
    const container = containerRef.current
    const globe = globeRef.current
    const tip = cityTipRef.current
    if (!container || !globe || !tip) return
    let lastRun = 0
    const onMove = (e: PointerEvent) => {
      const now = performance.now()
      if (now - lastRun < 40) return
      lastRun = now
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const coords = globe.toGlobeCoords(x, y)
      if (!coords) {
        tip.classList.add('hidden')
        container.classList.remove('city-hovered')
        return
      }
      const cosLat = Math.max(0.2, Math.cos((coords.lat * Math.PI) / 180))
      const radius = 0.8 * Math.max(1, altitudeRef.current * 1.5)
      let best: Landmark | null = null
      let bestScore = 1 // scores below 1 are inside the hover area
      for (const lm of LANDMARKS) {
        const dLat = lm.lat - coords.lat
        if (dLat > 5 || dLat < -5) continue
        let dLng = Math.abs(lm.lng - coords.lng)
        if (dLng > 180) dLng = 360 - dLng
        dLng *= cosLat
        const score = (dLat * dLat + dLng * dLng) / (radius * radius)
        if (score < bestScore) {
          bestScore = score
          best = lm
        }
      }
      if (best) {
        tip.textContent = `${best.name} — ${best.city}`
        tip.style.left = `${x + 14}px`
        tip.style.top = `${y + 10}px`
        tip.classList.remove('hidden')
        container.classList.add('city-hovered') // suppresses the country tooltip
      } else {
        tip.classList.add('hidden')
        container.classList.remove('city-hovered')
      }
    }
    const onLeave = () => {
      tip.classList.add('hidden')
      container.classList.remove('city-hovered')
    }
    container.addEventListener('pointermove', onMove)
    container.addEventListener('pointerleave', onLeave)
    return () => {
      container.removeEventListener('pointermove', onMove)
      container.removeEventListener('pointerleave', onLeave)
      container.classList.remove('city-hovered')
    }
  }, [globeReady])


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

  // While a country is selected the scene slides aside for the panel: left
  // on desktop, up into the strip above the mobile card. On mobile that
  // strip sits between the fixed navbar and the card, not between the
  // container's true top (which the navbar overlaps) and the card.
  useEffect(() => {
    if (!selected) {
      viewOffsetTargetRef.current = { x: 0, y: 0 }
      return
    }
    if (window.innerWidth >= 768) {
      viewOffsetTargetRef.current = { x: 0.225, y: 0 }
      return
    }
    const H = containerRef.current?.clientHeight || window.innerHeight
    const navFrac = MOBILE_NAV_HEIGHT_PX / H
    const zoneBottomFrac = 1 - MOBILE_CARD_FRACTION
    // shift the display center up from 0.5 to the midpoint of [navFrac, zoneBottomFrac]
    viewOffsetTargetRef.current = { x: 0, y: 0.5 - (navFrac + zoneBottomFrac) / 2 }
  }, [selected])

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
        // ease the projection offset toward its target (scene slides aside
        // when the panel opens, back to center when it closes)
        const offsetTarget = viewOffsetTargetRef.current
        const offset = viewOffsetRef.current
        if (
          Math.abs(offset.x - offsetTarget.x) > 0.0005 ||
          Math.abs(offset.y - offsetTarget.y) > 0.0005
        ) {
          offset.x += (offsetTarget.x - offset.x) * Math.min(1, dt * 5)
          offset.y += (offsetTarget.y - offset.y) * Math.min(1, dt * 5)
          const el = containerRef.current
          const persp = cam as THREE.PerspectiveCamera
          if (el && persp.isPerspectiveCamera) {
            const nearZero = Math.abs(offset.x) < 0.0005 && Math.abs(offset.y) < 0.0005
            if (nearZero && offsetTarget.x === 0 && offsetTarget.y === 0) {
              offset.x = 0
              offset.y = 0
              persp.clearViewOffset()
            } else {
              persp.setViewOffset(
                el.clientWidth,
                el.clientHeight,
                offset.x * el.clientWidth,
                offset.y * el.clientHeight,
                el.clientWidth,
                el.clientHeight
              )
            }
          }
          updateMoonCovered()
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
  // Detailed geometry for visited countries (and whichever country is
  // selected, visited or not); blocky base shapes for the rest. Feature
  // identities stay stable across selections, so three-globe only
  // re-tessellates polygons that actually change.
  const polygonsData = useMemo(
    () =>
      countries.map((c) =>
        visitedByCode.has(c.properties.iso3) ||
        (selected && c.properties.iso3 === selected.properties.iso3)
          ? detailedByCode?.get(c.properties.iso3) ?? c
          : c
      ),
    [countries, detailedByCode, visitedByCode, selected]
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

  // Fly the camera to a country, zoomed so its bounding box fits the screen
  // area the info panel leaves free: on desktop the panel takes the right
  // side, so the country is framed into roughly the left half. The bounds
  // include islands near the mainland (Sicily, Sardinia…) but not far-flung
  // territories (Caribbean, Guiana…) that would wreck the framing.
  const focusCountry = (feature: CountryFeature) => {
    const geom = feature.geometry
    const allPolys = (
      geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
    ) as number[][][][]
    const [mainLng, mainLat] = geoCentroid(mainPolygon(feature) as never)
    const nearby = allPolys.filter((coords) => {
      const [cLng, cLat] = geoCentroid({ type: 'Polygon', coordinates: coords } as never)
      let dLng = Math.abs(cLng - mainLng)
      if (dLng > 180) dLng = 360 - dLng
      return Math.hypot(cLat - mainLat, dLng) <= 15
    })
    const region = { type: 'MultiPolygon', coordinates: nearby } as never
    const [[minLng, minLat], [maxLng, maxLat]] = geoBounds(region)
    let lngSpan = maxLng - minLng
    if (lngSpan < 0) lngSpan += 360
    // aim at the bbox center — the area centroid leans toward landmass bulk
    const lat = (minLat + maxLat) / 2
    let lng = minLng + lngSpan / 2
    if (lng > 180) lng -= 360
    const toRad = Math.PI / 180
    // angular sizes of the bbox at the surface, in radians
    const sizeV = (maxLat - minLat) * toRad
    const sizeH = lngSpan * toRad * Math.max(0.2, Math.cos(lat * toRad))
    // projected fraction of the viewport ≈ size·R / (2·tan(fov/2)·(d−R)),
    // solved for altitude; fov is 50°, so 2·tan(25°) ≈ 0.933
    const aspect = size.height > 0 ? size.width / size.height : 1.7
    const desktop = window.innerWidth >= 768
    // desktop: fit into the left half beside the panel; mobile: fit into the
    // strip above the bottom-sheet card, minus the fixed navbar's dead band
    const H = size.height || (typeof window !== 'undefined' ? window.innerHeight : 800)
    const mobileZoneFrac = Math.max(0, (1 - MOBILE_CARD_FRACTION) - MOBILE_NAV_HEIGHT_PX / H)
    const targetV = desktop ? 0.82 : mobileZoneFrac * 0.8 // fraction of viewport height to fill
    const targetH = desktop ? 0.53 : 0.85 // fraction of viewport width
    const altitude = Math.min(
      2,
      Math.max(0.08, Math.max(sizeV / (0.933 * targetV), sizeH / (0.933 * aspect * targetH)))
    )
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
    // Compare by code — the selected country's polygon object is swapped
    // for its detailed twin, so identity comparison would miss
    if (selected && feature.properties.iso3 === selected.properties.iso3) {
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
    // Only visited countries open — the others have nothing to show
    if (!visitedByCode.has(feature.properties.iso3)) return
    selectCountry(feature)
  }

  // Card arrows: cycle through the visited countries (dashboard order)
  // Blocks the prev/next arrows (and their keyboard shortcuts) while the
  // camera is mid-flight, so spamming them can't queue up or interrupt
  // flights — the next step only fires once the current one has settled
  // in the center (matches focusCountry's 1000ms fly duration). A ref, not
  // state: the keyboard listener's closure must always read the live value.
  const countryStepBusyRef = useRef(false)
  const stepCountry = (dir: 1 | -1) => {
    if (countryStepBusyRef.current) return
    const codes = activeCountries.map((v) => v.code)
    const current = panelCountry ?? selected
    const idx = current ? codes.indexOf(current.properties.iso3) : -1
    const nextCode = idx === -1 ? codes[0] : codes[(idx + dir + codes.length) % codes.length]
    const feature = polygonsData.find((f) => f.properties.iso3 === nextCode)
    if (!feature) return
    selectCountry(feature)
    countryStepBusyRef.current = true
    window.setTimeout(() => {
      countryStepBusyRef.current = false
    }, 1000)
  }

  // Keyboard: Escape closes the country, arrow keys step through visited
  // ones — unless the media lightbox is open, which owns the keys then
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!selected || mediaFullscreen) return
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
  }, [selected, mediaFullscreen])

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
  // Deep links: /trips?country=CHN&place=shenzhen opens that view directly.
  // The country applies as soon as the globe is ready; the place waits in
  // pendingPlaceRef until the (possibly admin-managed) dataset contains it —
  // on load the bundled fallback may not know the place yet.
  const urlAppliedRef = useRef(false)
  const pendingPlaceRef = useRef<{ code: string; slug: string } | null>(null)
  useEffect(() => {
    if (urlAppliedRef.current || !globeReady || countries.length === 0) return
    urlAppliedRef.current = true
    const params = new URLSearchParams(window.location.search)
    const code = params.get('country')?.toUpperCase()
    if (!code) return
    const feature = polygonsData.find((f) => f.properties.iso3 === code)
    if (!feature) return
    selectCountry(feature)
    const placeParam = params.get('place')?.toLowerCase()
    if (placeParam) pendingPlaceRef.current = { code, slug: placeParam }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globeReady, countries])

  // Fly to the pending deep-linked place once the data knows it. Give up if
  // the live dataset arrived without a match, or if the user moved on.
  useEffect(() => {
    const pending = pendingPlaceRef.current
    if (!pending) return
    if (!selected || selected.properties.iso3 !== pending.code) {
      pendingPlaceRef.current = null
      return
    }
    const place = visitedByCode
      .get(pending.code)
      ?.places?.find((p) => placeSlug(p.name) === pending.slug)
    if (place) {
      pendingPlaceRef.current = null
      focusPlace(place)
    } else if (countriesData !== null) {
      pendingPlaceRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitedByCode, selected, countriesData])

  // ...and the URL follows the selection, so any view can be shared
  // (replaceState — selections shouldn't pile up in the history). Paused
  // while a deep-linked place is still waiting for its data, so the pasted
  // URL isn't rewritten without the place in the meantime.
  useEffect(() => {
    if (!urlAppliedRef.current || pendingPlaceRef.current) return
    const params = new URLSearchParams(window.location.search)
    if (selected) params.set('country', selected.properties.iso3)
    else params.delete('country')
    if (selected && selectedPlace) params.set('place', placeSlug(selectedPlace.name))
    else params.delete('place')
    const qs = params.toString()
    window.history.replaceState(
      null,
      '',
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    )
  }, [selected, selectedPlace])

  // Theme modifier class for the selected country's place flags
  const themeFlagRef = useRef('')
  useEffect(() => {
    themeFlagRef.current = selected
      ? COUNTRY_THEMES[selected.properties.iso3]?.flagClass ?? ''
      : ''
  }, [selected])

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
      el.className = `place-flag${themeFlagRef.current ? ` ${themeFlagRef.current}` : ''}${home ? ' place-flag--home' : ''}${selectedPlaceRef.current?.name === d.name ? ' place-flag--active' : ''}`
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

  // Fullscreen lightbox: Escape closes, arrow keys navigate
  useEffect(() => {
    if (!mediaFullscreen) return
    const onKey = (e: KeyboardEvent) => {
      const count = placeMedia?.length ?? 0
      if (e.key === 'Escape') setMediaFullscreen(false)
      else if (e.key === 'ArrowRight' && count > 1) setMediaIndex((i) => (i + 1) % count)
      else if (e.key === 'ArrowLeft' && count > 1) setMediaIndex((i) => (i - 1 + count) % count)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mediaFullscreen, placeMedia])

  // Media lists fetched this session, keyed by storage prefix — revisiting
  // a place or country costs no request (and no Blob operation) at all
  const mediaCacheRef = useRef(new Map<string, MediaItem[]>())

  // Load photos/videos: the selected place's own media, or — when no place
  // is selected — everything from all of the country's places combined
  useEffect(() => {
    setPlaceMedia(null)
    setMediaIndex(0)
    setMediaFullscreen(false)
    if (!selected) return
    const places = visitedByCode.get(selected.properties.iso3)?.places ?? []
    const targets = selectedPlace ? [selectedPlace] : places
    if (targets.length === 0) return
    let cancelled = false
    const loadPrefix = (prefix: string): Promise<MediaItem[]> => {
      const cached = mediaCacheRef.current.get(prefix)
      if (cached) return Promise.resolve(cached)
      return fetch(`/api/place-media?prefix=${encodeURIComponent(prefix)}`)
        .then((res) =>
          res.ok && res.headers.get('content-type')?.includes('application/json')
            ? res.json()
            : null
        )
        .then((data) => {
          const items = (data?.media ?? []) as MediaItem[]
          if (data) mediaCacheRef.current.set(prefix, items)
          return items
        })
        .catch(() => [] as MediaItem[])
    }
    Promise.all(
      targets.map((p) => loadPrefix(mediaPrefix(selected.properties.iso3, p.name)))
    ).then((lists) => {
      if (!cancelled) setPlaceMedia(lists.flat())
    })
    return () => {
      cancelled = true
    }
  }, [selectedPlace, selected, visitedByCode])

  // Background preloading, neighbors only: fetch just the photos adjacent
  // to the current one (at card size), so stepping is instant WITHOUT
  // downloading whole galleries up front — that burned transfer quota.
  useEffect(() => {
    if (!placeMedia || placeMedia.length < 2) return
    const current = Math.min(mediaIndex, placeMedia.length - 1)
    const candidates = [
      (current + 1) % placeMedia.length,
      (current - 1 + placeMedia.length) % placeMedia.length,
    ]
    for (const i of candidates) {
      const item = placeMedia[i]
      if (isVideo(item.pathname) || mediaLoaded[item.url]) continue
      const img = new Image()
      img.onload = () =>
        setMediaLoaded((loaded) => (loaded[item.url] ? loaded : { ...loaded, [item.url]: true }))
      img.src = optimizedUrl(item.url, 640)
    }
  }, [placeMedia, mediaIndex, mediaLoaded])

  const panelPlaces = panelCountry
    ? visitedByCode.get(panelCountry.properties.iso3)?.places ?? []
    : []
  const cardTheme = panelCountry ? COUNTRY_THEMES[panelCountry.properties.iso3] : undefined
  // randomized once per mount; negative delays mean the sky is already
  // mid-snowfall when the card opens
  const snowflakes = useMemo(
    () =>
      Array.from({ length: 16 }, () => ({
        left: Math.random() * 100,
        size: 2 + Math.random() * 2.5,
        dur: 7 + Math.random() * 8,
        delay: -Math.random() * 15,
        opacity: 0.4 + Math.random() * 0.5,
        sx: (Math.random() - 0.5) * 60,
      })),
    []
  )
  const raindrops = useMemo(
    () =>
      Array.from({ length: 22 }, () => ({
        left: Math.random() * 100,
        len: 8 + Math.random() * 9,
        dur: 2 + Math.random() * 1.6,
        delay: -Math.random() * 4,
        opacity: 0.25 + Math.random() * 0.35,
      })),
    []
  )
  const placeText = selectedPlace ? localText(selectedPlace) : undefined
  const countryText = panelCountry
    ? localText(visitedByCode.get(panelCountry.properties.iso3))
    : undefined
  // what the media area's text column shows: the selected place's story,
  // or the country's own story when no place is selected
  const panelText = placeText ?? (selectedPlace ? undefined : countryText)

  // Hero stats: countries visited, continents, share of the world
  const stats = useMemo(() => {
    if (countries.length === 0) return null
    const visited = countries.filter((c) => visitedByCode.has(c.properties.iso3))
    if (visited.length === 0) return null
    return {
      countries: visited.length,
      continents: new Set(visited.map((c) => c.properties.continent)).size,
      worldPct: Math.round((visited.length / countries.length) * 100),
    }
  }, [countries, visitedByCode])

  return (
    <div ref={pageRef} className="h-dvh flex flex-col overflow-hidden relative z-10 bg-gradient-to-b from-purple-900 via-blue-900 to-black">
      {/* Same space backdrop as the home page's About section */}
      <SpaceBackground
        moonCard={{ title: t('trips.moonTitle'), text: t('trips.moonText') }}
        moonHidden={moonCovered}
      />
      <NavBar />

      {/* Hero Section — compact; hidden on mobile where every pixel counts;
          the stats hide behind the chart button */}
      <div className="hidden md:block w-full pt-16 pb-1.5 header-gradient-trips relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h1 className="text-lg md:text-xl font-bold text-white">{t('trips.hero.title')}</h1>
          <p className="text-xs md:text-sm text-gray-200 max-w-3xl mx-auto">
            {t('trips.hero.subtitle')}
          </p>
          {stats && (
            <>
              <button
                type="button"
                aria-label={t('trips.statsToggle')}
                title={t('trips.statsToggle')}
                onClick={() => setStatsOpen((open) => !open)}
                className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors ${
                  statsOpen ? 'text-white' : 'text-gray-200 hover:text-white'
                }`}
              >
                <BarChart3 className="h-5 w-5" />
              </button>
              {statsOpen && (
                <div className="absolute right-4 top-full mt-2 z-30 inline-flex items-center gap-2 md:gap-3 rounded-full border border-white/20 bg-gray-900/90 px-4 md:px-5 py-1.5 text-sm text-gray-200 backdrop-blur-sm whitespace-nowrap">
                  <span>
                    <span className="font-bold text-white">{stats.countries}</span> {t('trips.stats.countries')}
                  </span>
                  <span className="opacity-50">·</span>
                  <span>
                    <span className="font-bold text-white">{stats.continents}</span> {t('trips.stats.continents')}
                  </span>
                  <span className="opacity-50">·</span>
                  <span>
                    <span className="font-bold text-white">{stats.worldPct}%</span> {t('trips.stats.world')}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Globe Section — fills the remaining viewport height */}
      <section className="flex-1 min-h-0 flex flex-col py-1.5">
        <div className="relative overflow-hidden flex-1 min-h-0">
          {/* Loading veil — the scene stays hidden underneath until every
              layer (countries, relief, clouds) has had time to build, then
              the whole world fades in at once */}
          {!sceneVisible && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-on-dark pointer-events-none">
              {t('trips.loading')}
            </div>
          )}
          <div
            ref={containerRef}
            className={`relative w-full h-full cursor-grab active:cursor-grabbing transition-opacity duration-700 ease-in-out ${
              sceneVisible ? 'opacity-100' : 'opacity-0'
            } ${
              // on mobile the open card owns the screen — the globe can't be
              // dragged/zoomed until it's closed (place flags stay tappable)
              selected ? 'pointer-events-none md:pointer-events-auto' : ''
            }`}
          >
            {/* City hover tooltip, positioned imperatively next to the cursor */}
            <div
              ref={cityTipRef}
              className="hidden absolute z-20 pointer-events-none whitespace-nowrap rounded-lg border border-gray-600 bg-gray-900/95 px-2.5 py-1.5 text-xs md:text-sm text-on-dark"
            ></div>
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
                  // By code, not identity — the selected polygon object is
                  // swapped for its detailed twin
                  const isSel =
                    selected?.properties.iso3 === (d as CountryFeature).properties.iso3
                  const active = d === hovered || isSel
                  // While a country is selected, every other country dims so
                  // the selection carries the focus (hover still lifts them
                  // slightly so they read as clickable). Land must stay
                  // opaque — translucent fills let the water shimmer through.
                  const dimmed = selected && !isSel
                  // Unvisited countries don't react to hover — they can't be
                  // opened, so they shouldn't look clickable
                  return isVisited(d)
                    ? dimmed
                      ? active ? '#7d9a28' : '#5f7a1e'
                      : active ? '#bef264' : '#a3e635'
                    : dimmed
                      ? '#0c3018'
                      : '#14532d'
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
                // Unvisited countries can't be opened — no pointer cursor
                showPointerCursor={(objType: string, objData: object) =>
                  objType !== 'polygon' || isVisited(objData)
                }
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
                  updateMoonCovered()
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
                  // World landmarks, planted upright at their real spots
                  const lmPrev = scene.getObjectByName('landmarks')
                  if (lmPrev) scene.remove(lmPrev)
                  const landmarks = new THREE.Group()
                  landmarks.name = 'landmarks'
                  for (const lm of LANDMARKS) {
                    const obj = lm.build()
                    obj.traverse((o) => {
                      o.raycast = () => {} // hover uses area math, not raycasts
                    })
                    const up = latLngToVec3(lm.lat, lm.lng)
                    const east = new THREE.Vector3()
                      .crossVectors(new THREE.Vector3(0, 1, 0), up)
                      .normalize()
                    const north = new THREE.Vector3().crossVectors(up, east)
                    obj.quaternion.setFromRotationMatrix(
                      new THREE.Matrix4().makeBasis(east, up, north.clone().negate())
                    )
                    obj.position.copy(up).multiplyScalar(globeR * (1 + BASE_POLY_ALTITUDE))
                    landmarks.add(obj)
                  }
                  scene.add(landmarks)
                  setGlobeReady(true)
                  globe.pointOfView(DEFAULT_POV, 0)
                  updateMoonCovered()
                  // reveal once the polygons have tessellated and the relief
                  // and cloud textures have most likely arrived
                  window.setTimeout(() => setSceneVisible(true), 600)
                }}
              />
            )}

          </div>

          {/* Country info panel — on mobile it fills the bottom half (the
              globe shifts the selection into the top half); on desktop it
              fills the full right side, edge to edge */}
          <div className="absolute inset-x-0 bottom-0 h-3/5 md:inset-x-auto md:bottom-auto md:right-0 md:top-0 md:h-full md:w-[45%] pointer-events-none z-30">
            <div
              data-testid="country-card"
              className={`relative h-full flex flex-col bg-[#222831] border-0 border-t md:border-t-0 md:border-l ${
                cardTheme?.border ?? 'border-accent'
              } ${cardTheme?.cardClass ?? ''} card-text-halo rounded-t-2xl md:rounded-none p-4 md:p-6 shadow-2xl backdrop-blur-sm transition-all duration-700 ease-in-out ${
                selected
                  ? 'opacity-100 translate-y-0 md:translate-x-0 pointer-events-auto'
                  : 'opacity-0 translate-y-full md:translate-y-0 md:translate-x-[120%]'
              }`}
            >
              {panelCountry && (
                <>
                  {/* Country theme decoration: wash, top strip, watermark —
                      behind the content (the card's backdrop-blur creates the
                      stacking context that makes -z-10 sit above its bg) */}
                  {cardTheme && (
                    <div className="absolute inset-0 -z-10 overflow-hidden rounded-t-2xl md:rounded-none pointer-events-none">
                      <div className={`absolute inset-0 ${cardTheme.tint}`} />
                      {cardTheme.rain && (
                        <div className="gb-rain">
                          {raindrops.map((drop, i) => (
                            <span
                              key={i}
                              className="gb-raindrop"
                              style={{
                                left: `${drop.left}%`,
                                height: drop.len,
                                opacity: drop.opacity,
                                animationDuration: `${drop.dur}s`,
                                animationDelay: `${drop.delay}s`,
                              }}
                            />
                          ))}
                        </div>
                      )}
                      {cardTheme.snow && (
                        <div className="at-snow">
                          {snowflakes.map((flake, i) => (
                            <span
                              key={i}
                              className="at-snowflake"
                              style={
                                {
                                  left: `${flake.left}%`,
                                  width: flake.size,
                                  height: flake.size,
                                  opacity: flake.opacity,
                                  animationDuration: `${flake.dur}s`,
                                  animationDelay: `${flake.delay}s`,
                                  '--sx': `${flake.sx}px`,
                                } as React.CSSProperties
                              }
                            />
                          ))}
                        </div>
                      )}
                      <div className={`absolute top-0 inset-x-0 ${cardTheme.strip}`} />
                      {cardTheme.bgArt && (
                        <img src={cardTheme.bgArt} alt="" className={cardTheme.bgArtClass ?? ''} />
                      )}
                      {cardTheme.watermark && (
                        <span
                          className={`absolute -right-4 -top-2 text-[9rem] leading-none opacity-[0.08] select-none ${
                            cardTheme.watermarkClass ?? ''
                          }`}
                        >
                          {cardTheme.watermark}
                        </span>
                      )}
                    </div>
                  )}
                  {cardTheme?.extras === 'cn' && (
                    <>
                      <img src="/frames/cn-lantern.svg" alt="" className="cn-lantern hidden md:block w-8" style={{ top: '0.6rem', left: '9%' }} />
                      <img src="/frames/cn-lantern.svg" alt="" className="cn-lantern hidden md:block w-6" style={{ top: '0.6rem', left: '17%', animationDelay: '-2.2s' }} />
                      <img src="/frames/cn-knot.svg" alt="" className="cn-knot hidden md:block w-5" style={{ top: '0.6rem', right: '22%', animationDelay: '-1.1s' }} />
                      <span className="cn-seal cn-calligraphy hidden md:block">米兰</span>
                    </>
                  )}
                  {cardTheme?.extras === 'br' && (
                    <>
                      <img src="/frames/br-garland.svg" alt="" className="br-garland" style={{ top: '0.5rem', left: '2%', width: '23%' }} />
                      <img src="/frames/br-garland.svg" alt="" className="br-garland" style={{ top: '0.5rem', right: '11%', width: '18%' }} />
                      <img src="/frames/br-stamp.svg" alt="" className="br-stamp hidden md:block" />
                    </>
                  )}
                  {cardTheme?.extras === 'at' && (
                    <>
                      {/* cableway: the gondola glides along its cable */}
                      <div
                        className="at-cableway hidden md:block"
                        style={{ top: '4.5rem', left: '50%', width: '26%', transform: 'translateX(-50%)' }}
                      >
                        <div className="at-cable" />
                        <img src="/frames/at-gondola.svg" alt="" className="at-gondola w-6" />
                      </div>
                      <img src="/frames/at-stamp.svg" alt="" className="at-stamp hidden md:block" />
                    </>
                  )}
                  {cardTheme?.extras === 'fr' && (
                    <>
                      <img
                        src="/frames/fr-croissant.svg"
                        alt=""
                        className="fr-croissant hidden md:block w-11"
                        style={{ top: '1.3rem', left: '2.6rem' }}
                      />
                      <img src="/frames/fr-stamp.svg" alt="" className="fr-stamp hidden md:block" />
                    </>
                  )}
                  {cardTheme?.extras === 'gb' && (
                    <>
                      <img
                        src="/frames/gb-bus.svg"
                        alt=""
                        className="gb-bus hidden md:block w-12"
                        style={{ top: '1.4rem', left: '2.4rem' }}
                      />
                      <img src="/frames/gb-stamp.svg" alt="" className="gb-stamp hidden md:block" />
                    </>
                  )}
                  {cardTheme?.extras === 'it' && (
                    <img src="/frames/it-stamp.svg" alt="" className="it-stamp hidden md:block" />
                  )}
                  {cardTheme?.extras === 'es' && (
                    <>
                      <img
                        src="/frames/es-guitar.svg"
                        alt=""
                        className="es-guitar hidden md:block w-12"
                        style={{ top: '1.2rem', left: '2.6rem' }}
                      />
                      <img src="/frames/es-stamp.svg" alt="" className="es-stamp hidden md:block" />
                    </>
                  )}
                  {cardTheme?.extras === 'nl' && (
                    <>
                      <div className="nl-windmill hidden md:block" style={{ top: '1.3rem', left: '2.6rem' }}>
                        <img src="/frames/nl-windmill-body.svg" alt="" className="absolute inset-0 w-full h-full" />
                        <img src="/frames/nl-windmill-blades.svg" alt="" className="nl-windmill-blades" />
                      </div>
                      <img src="/frames/nl-stamp.svg" alt="" className="nl-stamp hidden md:block" />
                    </>
                  )}
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="flex items-center justify-center gap-3 md:gap-4 flex-1 min-w-0">
                      {/^[A-Za-z]{2}$/.test(panelCountry.properties.iso2) && (
                        <span
                          className={`fi fi-${panelCountry.properties.iso2.toLowerCase()} text-3xl md:text-4xl rounded shadow-md shrink-0`}
                        />
                      )}
                      <h3 className="text-2xl md:text-4xl font-bold text-on-dark truncate">{panelCountry.properties.name}</h3>
                      {cardTheme?.nativeLabels?.[panelCountry.properties.name] && (
                        <span
                          className={`text-2xl md:text-4xl leading-none shrink-0 opacity-90 ${cardTheme.badge} ${cardTheme.nativeClass ?? ''}`}
                        >
                          {cardTheme.nativeLabels[panelCountry.properties.name]}
                        </span>
                      )}
                      {visitedByCode.has(panelCountry.properties.iso3) && (
                        <span className="relative group shrink-0">
                          <BadgeCheck
                            className={`h-6 w-6 md:h-8 md:w-8 ${cardTheme?.badge ?? 'text-accent'}`}
                            aria-label={t('trips.visitedBadge')}
                          />
                          <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 px-2.5 py-1 rounded-md bg-gray-900/95 border border-gray-600 text-xs md:text-sm font-medium text-on-dark whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            {t('trips.visitedBadge')}!
                          </span>
                        </span>
                      )}
                    </div>
                    {/* the country emblem sits at the row's far right edge */}
                    {cardTheme?.titleArt && (
                      <img src={cardTheme.titleArt} alt="" className="h-7 md:h-9 w-auto shrink-0" />
                    )}
                  </div>
                  {/* close handle: a pull tab sticking out of the card like
                      a sticky note — out the left edge on desktop (the card
                      slides away right), out the top on mobile (the sheet
                      slides down). Same background/border so it reads as
                      part of the card. */}
                  <button
                    type="button"
                    aria-label={t('trips.resetView')}
                    onClick={resetView}
                    className={`hidden md:flex absolute -left-8 top-1/2 -translate-y-1/2 w-8 h-16 items-center justify-center rounded-l-xl border border-r-0 ${
                      cardTheme?.border ?? 'border-accent'
                    } bg-[#222831] text-muted-on-dark hover:text-on-dark transition-colors`}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                  <button
                    type="button"
                    aria-label={t('trips.resetView')}
                    onClick={resetView}
                    className={`md:hidden absolute -top-8 left-1/2 -translate-x-1/2 h-8 w-16 flex items-center justify-center rounded-t-xl border border-b-0 ${
                      cardTheme?.border ?? 'border-accent'
                    } bg-[#222831] text-muted-on-dark active:bg-white/10 transition-colors`}
                  >
                    <ChevronDown className="h-5 w-5" />
                  </button>

                  {!visitedByCode.has(panelCountry.properties.iso3) && (
                    <div className="mt-2 text-sm md:text-base text-muted-on-dark">{t('trips.notVisited')}</div>
                  )}

                  {/* country text normally lives in the media area's right
                      column; this fallback is only for countries without any
                      places (so no media row renders at all) */}
                  {!selectedPlace && countryText && panelPlaces.length === 0 && (
                    <p
                      className="hidden md:block mt-4 text-sm md:text-base text-on-dark leading-relaxed whitespace-pre-line border-t border-gray-700 pt-4"
                    >
                      {countryText}
                    </p>
                  )}

                  {panelPlaces.length > 0 && (
                    <div className="mt-5 md:mt-7">
                      <h4 className="text-sm md:text-base font-semibold text-on-dark mb-2 md:mb-3">
                        {t('trips.placesTitle')}
                      </h4>
                      <div className="flex flex-nowrap overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0 gap-2">
                        {panelPlaces.map((place) => (
                          <button
                            key={place.name}
                            type="button"
                            onClick={() => {
                              // clicking the active chip deselects the place
                              // and returns to the country view
                              if (selectedPlace?.name === place.name) {
                                setSelectedPlace(null)
                                selectedPlaceRef.current = null
                                focusCountry(panelCountry)
                              } else {
                                focusPlace(place)
                              }
                            }}
                            title={isHomePlace(place.name) ? t('trips.homeHint') : undefined}
                            className={`inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap rounded-full px-3 py-1 md:px-4 md:py-1.5 text-sm md:text-base border transition-colors ${cardTheme?.chipClass ?? ''} ${
                              // compare by name, not reference — a deep-linked
                              // place is looked up from the dataset separately
                              // from panelPlaces, so the objects can differ
                              // even when they describe the same place
                              isHomePlace(place.name)
                                ? selectedPlace?.name === place.name
                                  ? 'bg-amber-400/15 border-amber-400 text-amber-300'
                                  : 'border-amber-500/60 text-amber-300 hover:border-amber-300 hover:text-amber-200'
                                : selectedPlace?.name === place.name
                                  ? cardTheme?.chipActive ?? 'bg-chip border-accent text-accent'
                                  : cardTheme?.chipIdle ??
                                    'border-gray-600 text-on-dark hover:border-accent hover:text-accent'
                            }`}
                          >
                            {isHomePlace(place.name) ? (
                              <House className="h-3.5 w-3.5 md:h-4 md:w-4" />
                            ) : cardTheme?.chipClass ? null : (
                              <Flag className="h-3.5 w-3.5 md:h-4 md:w-4" />
                            )}
                            {place.name}
                            {cardTheme?.nativeLabels?.[place.name] && (
                              <span className={`opacity-90 ${cardTheme.nativeClass ?? ''}`}>
                                {cardTheme.nativeLabels[place.name]}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Photo slideshow (portrait 3:4, one at a time,
                      letterboxed) with the place's story next to it. With no
                      place selected it shows every photo from the country's
                      places combined. While the media list or the current
                      image is still loading, its shape pulses as a skeleton. */}
                  {(selectedPlace || panelPlaces.length > 0) &&
                  (placeMedia === null || placeMedia.length > 0 || panelText) ? (
                    <div className="hidden md:flex mt-4 flex-1 min-h-0 flex-row items-stretch gap-4">
                      {placeMedia === null ? (
                        <div className="h-full aspect-[3/4] max-w-full shrink-0 rounded-lg media-skeleton flex items-center justify-center">
                          <ImageIcon className="h-9 w-9 text-white/20" />
                        </div>
                      ) : placeMedia.length > 0 ? (
                      <div className={`h-full aspect-[3/4] max-w-full shrink-0 ${cardTheme?.frame ?? ''}`}>
                      <div className="relative w-full h-full rounded-lg overflow-hidden bg-black/50">
                        {(() => {
                          const item = placeMedia[Math.min(mediaIndex, placeMedia.length - 1)]
                          return isVideo(item.pathname) ? (
                            <video
                              key={item.url}
                              src={item.url}
                              controls
                              preload="metadata"
                              className="absolute inset-0 w-full h-full object-contain"
                            />
                          ) : (
                            <>
                              <img
                                key={item.url}
                                src={optimizedUrl(item.url, 640)}
                                alt={selectedPlace?.name ?? panelCountry.properties.name}
                                onClick={() => setMediaFullscreen(true)}
                                onLoad={() =>
                                  setMediaLoaded((loaded) => ({ ...loaded, [item.url]: true }))
                                }
                                className={`absolute inset-0 w-full h-full object-contain cursor-zoom-in transition-opacity duration-300 ${
                                  mediaLoaded[item.url] ? 'opacity-100' : 'opacity-0'
                                }`}
                              />
                              {!mediaLoaded[item.url] && (
                                <div className="absolute inset-0 media-skeleton flex items-center justify-center pointer-events-none">
                                  <ImageIcon className="h-9 w-9 text-white/20" />
                                </div>
                              )}
                            </>
                          )
                        })()}
                        {/* desktop only — on mobile, tapping the photo's
                            center opens fullscreen */}
                        <button
                          type="button"
                          aria-label={t('trips.mediaFullscreen')}
                          title={t('trips.mediaFullscreen')}
                          onClick={() => setMediaFullscreen(true)}
                          className="hidden md:block absolute right-1.5 top-1.5 rounded-full bg-black/50 hover:bg-black/75 text-white p-1.5 transition-colors"
                        >
                          <Maximize2 className="h-4 w-4" />
                        </button>
                        {placeMedia.length > 1 && (
                          <>
                            {/* Instagram-style progress bars (full width on
                                mobile — no fullscreen button there) */}
                            <div className="absolute top-2 left-2 right-2 md:right-10 flex gap-1 pointer-events-none">
                              {placeMedia.map((m, i) => (
                                <div
                                  key={m.url}
                                  className={`h-1 flex-1 rounded-full transition-colors ${
                                    i === Math.min(mediaIndex, placeMedia.length - 1)
                                      ? 'bg-white/90'
                                      : 'bg-white/30'
                                  }`}
                                />
                              ))}
                            </div>
                            {/* mobile: tap the photo's left/right side to flip */}
                            <button
                              type="button"
                              aria-label={t('trips.mediaPrev')}
                              onClick={() =>
                                setMediaIndex((i) => (i - 1 + placeMedia.length) % placeMedia.length)
                              }
                              className="md:hidden absolute inset-y-0 left-0 w-2/5"
                            />
                            <button
                              type="button"
                              aria-label={t('trips.mediaNext')}
                              onClick={() => setMediaIndex((i) => (i + 1) % placeMedia.length)}
                              className="md:hidden absolute inset-y-0 right-0 w-2/5"
                            />
                            {/* desktop: arrows */}
                            <button
                              type="button"
                              aria-label={t('trips.mediaPrev')}
                              onClick={() =>
                                setMediaIndex((i) => (i - 1 + placeMedia.length) % placeMedia.length)
                              }
                              className="hidden md:block absolute left-1.5 top-1/2 -translate-y-1/2 rounded-full bg-black/50 hover:bg-black/75 text-white p-1.5 transition-colors"
                            >
                              <ChevronLeft className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              aria-label={t('trips.mediaNext')}
                              onClick={() => setMediaIndex((i) => (i + 1) % placeMedia.length)}
                              className="hidden md:block absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-black/50 hover:bg-black/75 text-white p-1.5 transition-colors"
                            >
                              <ChevronRight className="h-5 w-5" />
                            </button>
                          </>
                        )}
                      </div>
                      </div>
                      ) : null}
                      {panelText && (
                        <div className="flex-1 min-w-0 min-h-0 max-h-full overflow-y-auto text-base text-on-dark leading-relaxed whitespace-pre-line">
                          {panelText}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Flexible space for future content */
                    <div className="hidden md:block flex-1" />
                  )}

                  {/* mobile: the card is text-first — the story scrolls, and
                      a photo button opens the gallery straight in fullscreen */}
                  <div className="md:hidden mt-3 flex-1 min-h-0 flex flex-col gap-3">
                    {panelText && (
                      <div className="flex-1 min-h-0 overflow-y-auto text-sm text-on-dark leading-relaxed whitespace-pre-line">
                        {panelText}
                      </div>
                    )}
                    {placeMedia === null ? (
                      <div className="h-11 rounded-lg media-skeleton" />
                    ) : placeMedia.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setMediaFullscreen(true)}
                        className={`w-full inline-flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                          cardTheme?.chipActive ?? 'bg-chip border-accent text-accent'
                        }`}
                      >
                        <ImageIcon className="h-5 w-5" />
                        {t('trips.viewPhotos')} ({placeMedia.length})
                      </button>
                    ) : null}
                  </div>

                </>
              )}
            </div>
          </div>
        </div>

      </section>

      {/* Fullscreen media lightbox */}
      {mediaFullscreen &&
        placeMedia &&
        placeMedia.length > 0 &&
        (() => {
          const item = placeMedia[Math.min(mediaIndex, placeMedia.length - 1)]
          return (
            <div
              className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
              onClick={() => setMediaFullscreen(false)}
              onTouchStart={(e) => {
                lightboxTouchY.current = e.touches[0].clientY
              }}
              onTouchEnd={(e) => {
                // swipe up or down closes the lightbox (mobile)
                const start = lightboxTouchY.current
                lightboxTouchY.current = null
                if (start != null && Math.abs(e.changedTouches[0].clientY - start) > 70) {
                  setMediaFullscreen(false)
                }
              }}
            >
              {isVideo(item.pathname) ? (
                <video
                  key={item.url}
                  src={item.url}
                  controls
                  autoPlay
                  onClick={(e) => e.stopPropagation()}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <img
                  key={item.url}
                  src={optimizedUrl(item.url, 2048)}
                  alt={selectedPlace?.name ?? panelCountry?.properties.name ?? ''}
                  onClick={(e) => e.stopPropagation()}
                  className="max-w-full max-h-full object-contain"
                />
              )}
              {/* desktop only — on mobile a swipe closes the lightbox */}
              <button
                type="button"
                aria-label={t('trips.mediaClose')}
                onClick={() => setMediaFullscreen(false)}
                className="hidden md:block absolute right-4 top-4 rounded-full bg-black/60 hover:bg-black/80 text-white p-2 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
              {placeMedia.length > 1 && (
                <>
                  {/* Instagram-style progress bars (full width on mobile —
                      no close button there) */}
                  <div className="absolute top-4 left-4 right-4 md:right-16 flex gap-1 pointer-events-none">
                    {placeMedia.map((m, i) => (
                      <div
                        key={m.url}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i === Math.min(mediaIndex, placeMedia.length - 1)
                            ? 'bg-white/90'
                            : 'bg-white/30'
                        }`}
                      />
                    ))}
                  </div>
                  {/* mobile: tap left/right side to flip */}
                  <button
                    type="button"
                    aria-label={t('trips.mediaPrev')}
                    onClick={(e) => {
                      e.stopPropagation()
                      setMediaIndex((i) => (i - 1 + placeMedia.length) % placeMedia.length)
                    }}
                    className="md:hidden absolute inset-y-0 left-0 w-2/5"
                  />
                  <button
                    type="button"
                    aria-label={t('trips.mediaNext')}
                    onClick={(e) => {
                      e.stopPropagation()
                      setMediaIndex((i) => (i + 1) % placeMedia.length)
                    }}
                    className="md:hidden absolute inset-y-0 right-0 w-2/5"
                  />
                  {/* desktop: arrows */}
                  <button
                    type="button"
                    aria-label={t('trips.mediaPrev')}
                    onClick={(e) => {
                      e.stopPropagation()
                      setMediaIndex((i) => (i - 1 + placeMedia.length) % placeMedia.length)
                    }}
                    className="hidden md:block absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/60 hover:bg-black/80 text-white p-2 transition-colors"
                  >
                    <ChevronLeft className="h-7 w-7" />
                  </button>
                  <button
                    type="button"
                    aria-label={t('trips.mediaNext')}
                    onClick={(e) => {
                      e.stopPropagation()
                      setMediaIndex((i) => (i + 1) % placeMedia.length)
                    }}
                    className="hidden md:block absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/60 hover:bg-black/80 text-white p-2 transition-colors"
                  >
                    <ChevronRight className="h-7 w-7" />
                  </button>
                </>
              )}
            </div>
          )
        })()}
    </div>
  )
}
