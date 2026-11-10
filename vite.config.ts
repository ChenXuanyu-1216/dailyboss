/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Production builds (and `vite preview` of them) use the GitHub Pages project path /dailyboss/.
// The dev server stays at "/". Override with BASE_PATH=/other/ if needed.
export default defineConfig(({ command, isPreview }) => ({
  base: process.env.BASE_PATH ?? (command === 'build' || isPreview ? '/dailyboss/' : '/'),
  plugins: [react()],
  build: {
    target: 'es2022',
    // Three.js + React Three Fiber form one lazily loaded chunk (~925 kB min / ~245 kB gzip).
    chunkSizeWarningLimit: 1000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
}));
