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
