import { defineConfig } from 'astro/config';

let sitemapIntegration;
try {
  ({ default: sitemapIntegration } = await import('@astrojs/sitemap'));
} catch (error) {
  ({ default: sitemapIntegration } = await import(
    './vendor/astrojs-sitemap/index.js'
  ));
}

const adminProxyTarget = process.env.ADMIN_DEV_PROXY_TARGET;
const viteConfig = adminProxyTarget
  ? {
      server: {
        proxy: {
          '/admin': {
            target: adminProxyTarget,
            changeOrigin: true,
            secure: false,
          },
        },
      },
    }
  : undefined;

export default defineConfig({
  site: 'https://freakyflyerdelivery.com.au',
  output: 'static',
  integrations: [sitemapIntegration()],
  vite: viteConfig,
});
