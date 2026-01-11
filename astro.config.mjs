import { defineConfig } from 'astro/config';

let sitemapIntegration;
try {
  const sitemapModule = await import('@astrojs/sitemap');
  sitemapIntegration = sitemapModule.default;
} catch (error) {
  const sitemapModule = await import('./vendor/astrojs-sitemap/index.js');
  sitemapIntegration = sitemapModule.default;
}

const basePathRaw = process.env.PUBLIC_BASE_PATH?.trim() || '';
const normalizedBase = basePathRaw
  ? `/${basePathRaw.replace(/^\/+|\/+$/g, '')}`
  : '';
const baseHrefPrefix = normalizedBase; // no trailing slash

const contactEmail =
  process.env.PUBLIC_CONTACT_EMAIL?.trim() ||
  process.env.TO_EMAIL?.trim() ||
  'freakyflyerbookings@gmail.com';

const replacePlaceholders = () => {
  const replacements = {
    '{{CONTACT_EMAIL}}': contactEmail,
    'mailto:{{CONTACT_EMAIL}}': `mailto:${contactEmail}`,
  };

  const replaceInString = (value) => {
    if (typeof value !== 'string') return value;
    let next = value;
    for (const [needle, replacement] of Object.entries(replacements)) {
      next = next.split(needle).join(replacement);
    }
    if (
      baseHrefPrefix &&
      next.startsWith('/') &&
      !next.startsWith('//') &&
      !next.startsWith(baseHrefPrefix + '/')
    ) {
      next = `${baseHrefPrefix}${next}`;
    }
    return next;
  };

  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.value === 'string') {
      node.value = replaceInString(node.value);
    }
    if (typeof node.url === 'string') {
      node.url = replaceInString(node.url);
    }
    if (Array.isArray(node.children)) {
      node.children.forEach(walk);
    }
  };

  return (tree) => walk(tree);
};

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
          '/contact.php': {
            target: adminProxyTarget,
            changeOrigin: true,
            secure: false,
          },
        },
      },
    }
  : undefined;

export default defineConfig({
  site: `https://freakyflyerdelivery.com.au${normalizedBase || ''}`,
  base: normalizedBase || '/',
  output: 'static',
  integrations: [sitemapIntegration()],
  markdown: {
    remarkPlugins: [replacePlaceholders],
  },
  vite: viteConfig,
});
