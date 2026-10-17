import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// Cesium loads its web workers, widgets and built-in imagery at runtime from
// CESIUM_BASE_URL (set in index.html), so those folders are copied as-is.
const cesium = 'node_modules/cesium/Build/Cesium'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
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
