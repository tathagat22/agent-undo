// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// Project page lives at https://tathagat22.github.io/walkback
export default defineConfig({
  site: 'https://tathagat22.github.io',
  base: '/walkback',
  trailingSlash: 'ignore',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
