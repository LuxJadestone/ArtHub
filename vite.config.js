import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  build: { rollupOptions: { input: {
    main: fileURLToPath(new URL('./index.html', import.meta.url)),
    embed: fileURLToPath(new URL('./examples/embed.html', import.meta.url)),
    gem: fileURLToPath(new URL('./techniques/gem.html', import.meta.url)),
    surfaceDither: fileURLToPath(new URL('./techniques/surface-dither.html', import.meta.url)),
  } } },
});
