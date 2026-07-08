import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages can't set HTTP headers, so CSP ships as a meta tag. Injected
// only into production builds — the dev server needs inline scripts for
// react-refresh, which this policy forbids.
// 'unsafe-inline' styles: required by React style={{}} attributes.
// connect-src api.github.com: gist cloud sync.
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; connect-src 'self' https://api.github.com; " +
  "manifest-src 'self'; worker-src 'self'; base-uri 'self'; form-action 'self'; " +
  "object-src 'none'; frame-src 'none'"

function injectCSP(): Plugin {
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return {
        html,
        tags: [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
            injectTo: 'head-prepend',
          },
        ],
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/my-workouts/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          recharts: ['recharts'],
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    injectCSP(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'My Workouts',
        short_name: 'Workouts',
        start_url: '/my-workouts/',
        display: 'standalone',
        background_color: '#0a0a0a',
        theme_color: '#007AFF',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
