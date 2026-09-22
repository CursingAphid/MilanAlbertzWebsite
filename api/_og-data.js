// Shared bits for the link-preview routes (/api/og and /api/trips-preview):
// which painted scene stands for which country or place, the display names,
// and the title/description wording. Files prefixed with "_" in /api are
// not exposed as functions.
//
// The scene names mirror COUNTRY_THEMES in src/pages/TripsPage.tsx (tint and
// placeTints). Keep them in step when a card gets a new scene. The routes
// use the "-static" twins built by scripts/build-static-frames.py, so the
// preview is the card at rest.

export const SITE_NAME = 'Milan Albertz'
export const TRIPS_TITLE = "Where I've been"
export const TRIPS_DESCRIPTION =
  "An interactive globe of the countries and places I've visited, with photos and live facts."

/** ISO 3166-1 alpha-3 -> name, alpha-2 (for the flag), scene, per-place scenes */
export const COUNTRIES = {
  NLD: { name: 'Netherlands', iso2: 'NL', scene: 'nl-amsterdam' },
  BRA: { name: 'Brazil', iso2: 'BR', scene: 'br-rio' },
  DEU: { name: 'Germany', iso2: 'DE', scene: 'de-schwarzwald' },
  BEL: { name: 'Belgium', iso2: 'BE', scene: 'be-brussels' },
  CHN: {
    name: 'China',
    iso2: 'CN',
    scene: 'cn-china',
    placeScenes: { 'hong-kong': 'cn-hongkong', macau: 'cn-macau' },
  },
  CHE: { name: 'Switzerland', iso2: 'CH', scene: 'ch-alpenglow' },
  CZE: { name: 'Czechia', iso2: 'CZ', scene: 'cz-prague' },
  AUT: { name: 'Austria', iso2: 'AT', scene: 'at-alps' },
  ESP: {
    name: 'Spain',
    iso2: 'ES',
    scene: 'es-mediterranean',
    placeScenes: {
      'gran-canaria': 'es-canarias',
      lanzarote: 'es-canarias',
      tenerife: 'es-canarias',
      fuerteventura: 'es-canarias',
    },
  },
  PRT: { name: 'Portugal', iso2: 'PT', scene: 'pt-porto', placeScenes: { lisbon: 'pt-lisbon' } },
  HUN: { name: 'Hungary', iso2: 'HU', scene: 'hu-budapest' },
  FRA: { name: 'France', iso2: 'FR', scene: 'fr-paris' },
  GBR: { name: 'United Kingdom', iso2: 'GB', scene: 'gb-london' },
  ITA: { name: 'Italy', iso2: 'IT', scene: 'it-tuscany' },
  GRC: { name: 'Greece', iso2: 'GR', scene: 'gr-aegean' },
  TUR: { name: 'Turkey', iso2: 'TR', scene: 'tr-antalya' },
  HRV: { name: 'Croatia', iso2: 'HR', scene: 'hr-adriatic' },
  LUX: { name: 'Luxembourg', iso2: 'LU' }, // no card scene yet: plain backdrop
}

/** 'Zell am See' -> 'zell-am-see' — same rule as src/utils/placeMedia.ts */
export const placeSlug = (name) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

/** 'NL' -> 🇳🇱 */
export const flagEmoji = (iso2) =>
  String.fromCodePoint(...[...iso2.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))

/** https://host, honouring the proxy header; http for local dev */
export const originOf = (req) => {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'milanalbertz.nl'
  const proto = /^(localhost|127\.0\.0\.1)/.test(host) ? 'http' : 'https'
  return `${proto}://${host}`
}

/** Reads ?country and ?place, returns null for anything unknown. */
export const parseTarget = (query) => {
  const code = String(query.country ?? '').toUpperCase()
  const country = COUNTRIES[code]
  if (!country) return null
  const slug = String(query.place ?? '').toLowerCase()
  return { code, country, slug: slug || null }
}

/**
 * Title, description, subtitle and scene for a share. `places` are the
 * visited place names for the country when known (from the dataset), used
 * for the wording and to resolve the place slug back to its display name.
 */
export const describe = (target, places = []) => {
  if (!target) {
    return { title: TRIPS_TITLE, description: TRIPS_DESCRIPTION, heading: TRIPS_TITLE, subtitle: SITE_NAME, scene: null, flag: '🌍' }
  }
  const { code, country, slug } = target
  const flag = flagEmoji(country.iso2)
  const placeName = slug ? places.find((p) => placeSlug(p) === slug) : undefined
  if (slug && placeName) {
    return {
      title: `${placeName}, ${country.name}`,
      description: `Photos and live facts from ${placeName}, one of the places I visited in ${country.name}.`,
      heading: placeName,
      subtitle: country.name,
      scene: country.placeScenes?.[slug] ?? country.scene ?? null,
      flag,
    }
  }
  const list = places.length ? places.join(' · ') : null
  return {
    title: country.name,
    description: list
      ? `Places I visited in ${country.name}: ${places.join(', ')}. Photos and live facts on the globe.`
      : `${country.name} on my travel globe: photos and live facts from the places I visited.`,
    heading: country.name,
    subtitle: list ?? SITE_NAME,
    scene: country.scene ?? null,
    flag,
    code,
  }
}
