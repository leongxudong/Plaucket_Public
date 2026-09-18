import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Plaucket — Private Meeting Recorder',
        short_name: 'Plaucket',
        description: 'A privacy-first, self-hosted meeting recorder and AI note maker.',
        theme_color: '#0a0d12',
        background_color: '#0a0d12',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
        cleanupOutdatedCaches: true
      }
    })
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:8788'
    }
  },
  build: {
    sourcemap: true
  }
})
