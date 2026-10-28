import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist/asset',
    lib: { entry: 'src/asset-entry.js', formats: ['es'], fileName: () => 'gem-lab.js' },
  },
});
