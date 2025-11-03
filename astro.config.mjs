import { defineConfig } from 'astro/config';

let sitemapIntegration;
try {
  ({ default: sitemapIntegration } = await import('@astrojs/sitemap'));
} catch (error) {
  ({ default: sitemapIntegration } = await import(
    './vendor/astrojs-sitemap/index.js'
  ));
}

export default defineConfig({
  site: 'https://freakyflyerdelivery.com.au',
  output: 'static',
  integrations: [sitemapIntegration()],
});
