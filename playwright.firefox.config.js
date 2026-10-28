import {defineConfig} from '@playwright/test';
import base from './playwright.config.js';

// Firefox on Linux needs an X display for the Mesa WebGL path.
export default defineConfig({
  ...base,
  testMatch: 'surface-dither.spec.js',
  use: {
    ...base.use,
    browserName: 'firefox',
    headless: false,
    launchOptions: {
      firefoxUserPrefs: {
        'webgl.force-enabled': true,
        'webgl.disabled': false,
        'gfx.webrender.all': true,
      },
    },
  },
});
