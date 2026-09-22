// Link-preview page for /trips shares. The trips page is a static SPA, so
// crawlers (which don't run JavaScript) would only ever see the generic
// index.html. vercel.json rewrites /trips to this route for known
// link-unfurling user agents only; humans keep getting the static page, so
// this never sits in their path. A person who does land here (a bot UA in
// a real browser, say) is sent straight to the SPA by the script below.
import { kvGet } from './_utils.js'
import { SITE_NAME, describe, originOf, parseTarget } from './_og-data.js'

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

export default async function handler(req, res) {
  const origin = originOf(req)
  const target = parseTarget(req.query ?? {})
  let places = []
  if (target) {
    try {
      const data = await kvGet('trips-data')
      places = data?.find((c) => c.code === target.code)?.places?.map((p) => p.name) ?? []
    } catch {
      // wording just won't list the places
    }
  }
  const card = describe(target, places)

  const params = new URLSearchParams()
  if (target) {
    params.set('country', target.code)
    if (target.slug) params.set('place', target.slug)
  }
  const qs = params.toString()
  const pageUrl = `${origin}/trips${qs ? `?${qs}` : ''}`
  const imageUrl = `${origin}/api/og${qs ? `?${qs}` : ''}`
  const fullTitle = target ? `${card.title} · ${SITE_NAME}` : `${card.title} · ${SITE_NAME}`

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(fullTitle)}</title>
    <meta name="description" content="${escapeHtml(card.description)}" />
    <link rel="canonical" href="${escapeHtml(pageUrl)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />
    <meta property="og:title" content="${escapeHtml(card.title)}" />
    <meta property="og:description" content="${escapeHtml(card.description)}" />
    <meta property="og:url" content="${escapeHtml(pageUrl)}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(`${card.heading} — ${card.subtitle}`)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(card.title)}" />
    <meta name="twitter:description" content="${escapeHtml(card.description)}" />
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
    <script>location.replace(${JSON.stringify(pageUrl)})</script>
  </head>
  <body style="font-family: system-ui, sans-serif; background: #222831; color: #eeeeee; padding: 2rem">
    <p>${escapeHtml(card.description)}</p>
    <p><a href="${escapeHtml(pageUrl)}" style="color: #00adb5">Open the trips globe</a></p>
  </body>
</html>
`
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
  res.status(200).send(html)
}
