import { defineConfig } from 'vite';

export default defineConfig({
  base: '/play/character-tactics/',
  build: {
    outDir: 'out/play/character-tactics',
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
