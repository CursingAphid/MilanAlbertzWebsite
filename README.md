<<<<<<< HEAD
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
=======
# MilanAlbertzWebsite

## Trips: uploading photos

Drop the photos for one place into `~/Downloads/trip-photo-uploads` and run,
from the project root:

```sh
node scripts/upload-photos.mjs PRT Lisbon
node scripts/upload-photos.mjs AUT "Zell am See" --dir ~/Pictures/austria
node scripts/upload-photos.mjs ESP "Gran Canaria" --dry-run
```

The script re-encodes to 1600px JPEG (macOS `sips`), uploads each file once
with a random suffix, and merges the new entries into the KV media manifest
in album order. It refuses unknown places (add them in `/trips/admin` first),
skips files already in that gallery, never calls the Blob `list()` API and
never deletes anything. `--dry-run` shows the plan without touching anything.

## Trips: card scenes

Card backgrounds are generated SVGs in `public/frames/` built by the
`scripts/build-*.py` scripts. After regenerating any scene, run
`python3 scripts/build-static-frames.py` to refresh the motionless twins
served under `prefers-reduced-motion` and used by the link previews.

## Trips: link previews

Sharing `/trips?country=HUN` (or `&place=budapest`) unfurls with the
country's scene and name. Two routes do this:

- `api/og.js` renders the 1200×630 PNG (Satori + resvg, fonts embedded in
  `api/_fonts.js`, scene from the `-static` twin).
- `api/trips-preview.js` serves an HTML page with the Open Graph tags.
  `vercel.json` rewrites `/trips` to it for known link-unfurling user agents
  only; browsers keep getting the static SPA.

Which scene stands for which country lives in `api/_og-data.js`; keep it in
step with `COUNTRY_THEMES` when a card gets a new scene. `vercel dev` does
not apply the user-agent rewrite, so check it on a deployment (the apex
redirects to `www`):

```sh
curl -A Twitterbot 'https://www.milanalbertz.nl/trips?country=HUN' | grep og:image
curl -sI 'https://www.milanalbertz.nl/api/og?country=HUN' | grep -i 'content-type'
```

`api/og.js` reads `node_modules/harfbuzzjs/hb.wasm` through a static path on
purpose: Satori's text shaper loads that file at runtime and the function
bundler only packs it when it sees such a read (`includeFiles` ignores
`node_modules`). Messaging apps cache previews per URL, so after a fix,
test with a URL you haven't shared before.
