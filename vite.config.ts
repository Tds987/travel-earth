import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// Cesium loads its web workers, widgets and built-in imagery at runtime from
// CESIUM_BASE_URL (set in index.html), so those folders are copied as-is.
const cesium = 'node_modules/cesium/Build/Cesium'

/**
 * Offline support: list the files the service worker should save up front
 * (app code, Cesium workers, the bundled offline globe) and stamp a version so
 * each deploy replaces the old offline copy.
 */
function offlinePrecache(): Plugin {
  const wanted = [
    /^assets\//,
    /^cesium\/Workers\//,
    /^cesium\/Assets\/approximateTerrainHeights\.json$/,
    /^cesium\/Assets\/Textures\/(NaturalEarthII|SkyBox)\//,
    /^cesium\/Assets\/Textures\/moonSmall\.jpg$/,
    /^cesium\/Widgets\/widgets\.css$/,
  ]
  let outDir = 'dist'
  return {
    name: 'offline-precache',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir
    },
    closeBundle() {
      const walk = (dir: string): string[] =>
        readdirSync(dir).flatMap((f) => {
          const p = join(dir, f)
          return statSync(p).isDirectory() ? walk(p) : [p]
        })
      const files = walk(outDir)
        .map((p) => relative(outDir, p).split('\\').join('/'))
        .filter((f) => wanted.some((re) => re.test(f)))
        .sort()
      const hash = createHash('sha256')
      for (const f of [
        ...files,
        'index.html',
        'rail/jr.json',
        'rail/other.json',
        'rail/shinkansen.json',
      ])
        hash.update(f).update(readFileSync(join(outDir, f)))
      const swPath = join(outDir, 'sw.js')
      const sw = readFileSync(swPath, 'utf8')
        .replace(
          "const VERSION = 'te-dev'",
          `const VERSION = 'te-${hash.digest('hex').slice(0, 10)}'`,
        )
        .replace(
          'const PRECACHE_EXTRA = []',
          `const PRECACHE_EXTRA = ${JSON.stringify(files.map((f) => `/${f}`))}`,
        )
      writeFileSync(swPath, sw)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    offlinePrecache(),
    viteStaticCopy({
      targets: ['Workers', 'ThirdParty', 'Assets', 'Widgets'].map((dir) => ({
        src: `${cesium}/${dir}`,
        dest: 'cesium',
        // keep Workers/, Assets/… directly under /cesium/
        rename: { stripBase: 4 },
      })),
    }),
  ],
  build: {
    chunkSizeWarningLimit: 6000,
  },
})
