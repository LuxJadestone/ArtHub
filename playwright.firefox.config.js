import {defineConfig} from '@playwright/test';
import base from './playwright.config.js';

// Firefox on Linux needs an X display for the Mesa WebGL path.
export default defineConfig({
  ...base,
  testIgnore: [],
  projects: [
    {name:'firefox',testMatch:'surface-dither.spec.js'},
    {name:'firefox-privacy',testMatch:'firefox-privacy.spec.js',use:{launchOptions:{firefoxUserPrefs:{'webgl.force-enabled':true,'webgl.disabled':false,'gfx.webrender.all':true,'privacy.resistFingerprinting':true}}}},
  ],
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
