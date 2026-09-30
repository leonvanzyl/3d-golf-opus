import { defineConfig } from 'vite';

// Static build: `npm run build` emits dist/ which Vercel serves with zero config.
const port = Number(process.env.PORT) || undefined;

export default defineConfig({
  base: './',
  // honour a PORT env var (used by preview tooling); defaults to Vite's 5173 / 4173
  server: { port },
  preview: { port },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
        },
      },
    },
  },
});
