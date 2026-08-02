// Shared helpers for place photo/video storage paths (Vercel Blob).

/** 'São Paulo' -> 'sao-paulo' — stable folder name for a place. */
export const placeSlug = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

/** Blob folder prefix for a place's media. */
export const mediaPrefix = (countryCode: string, placeName: string) =>
  `trips/${countryCode}/${placeSlug(placeName)}/`

export interface MediaItem {
  url: string
  pathname: string
  size: number
  uploadedAt: string
}

export const isVideo = (pathname: string) => /\.(mp4|mov|m4v|webm)$/i.test(pathname)

/**
 * Route an image through Vercel's image optimizer: resized, converted to
 * WebP/AVIF and cached at the edge — far less transfer than the stored
 * originals, and the blob store is only hit on optimizer cache misses.
 * In dev the optimizer doesn't run, so the original URL is used.
 */
export const optimizedUrl = (url: string, width: 640 | 2048) =>
  import.meta.env.DEV ? url : `/_vercel/image?url=${encodeURIComponent(url)}&w=${width}&q=75`
