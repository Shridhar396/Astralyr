import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import fs from 'fs';

// Confine temp directory within workspace so sandboxed builds remain hermetic
const tempDir = path.resolve(__dirname, 'node_modules/.cache/temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}
process.env.TEMP = tempDir;
process.env.TMP = tempDir;
process.env.TMPDIR = tempDir;

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.ELECTRON_BUILD === '1' ? './' : '/Constella/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        inlineWorkboxRuntime: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
      },
      includeAssets: [
        'favicon.ico',
        'constella-icon.svg',
        'icon-192.png',
        'icon-512.png',
        'icon-maskable-512.png',
      ],
      manifest: {
        name: 'Constella',
        short_name: 'Constella',
        description: 'your music, as a constellation — synced lyrics + ambient light',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'landscape',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: ['es2021', 'chrome105', 'safari13'],
    minify: 'esbuild',
    sourcemap: false,
  },
});
