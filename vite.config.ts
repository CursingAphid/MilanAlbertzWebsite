import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteImagemin from 'vite-plugin-imagemin'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteImagemin({
      gifsicle: { optimizationLevel: 3 },
      optipng: { optimizationLevel: 7 },
      pngquant: { quality: [0.6, 0.8], speed: 4 },
      mozjpeg: { quality: 72, progressive: true },
      svgo: { plugins: [{ name: 'removeViewBox', active: false }] },
      webp: { quality: 70 }
    }),
    ViteImageOptimizer({
      includePublic: true,
      // The trips card backgrounds in public/frames are CSS backgrounds that
      // size themselves from their viewBox, and several draw glints that
      // start at opacity="0" and animate in via SMIL — svgo's defaults
      // would strip both, so those two passes stay off.
      svg: {
        multipass: true,
        plugins: [
          {
            name: 'preset-default',
            params: {
              overrides: {
                removeViewBox: false,
                removeHiddenElems: false
              }
            }
          },
          'sortAttrs'
        ]
      },
      jpg: { quality: 72, progressive: true },
      jpeg: { quality: 72, progressive: true },
      png: { quality: 70 },
      webp: { quality: 70 },
      avif: { quality: 50 }
    })
  ]
})
