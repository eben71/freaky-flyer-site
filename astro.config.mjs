import { defineConfig } from 'astro/config';

let sitemapIntegration;
try {
  ({ default: sitemapIntegration } = await import('@astrojs/sitemap'));
} catch (error) {
  ({ default: sitemapIntegration } = await import(
    './vendor/astrojs-sitemap/index.js'
  ));
}

const contactEmail =
  process.env.PUBLIC_CONTACT_EMAIL?.trim() ||
  process.env.TO_EMAIL?.trim() ||
  'admin@freakyflyerdelivery.com.au';

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
  site: 'https://freakyflyerdelivery.com.au/newsite',
  base: '/newsite',
  output: 'static',
  integrations: [sitemapIntegration()],
  markdown: {
    remarkPlugins: [replacePlaceholders],
  },
  vite: viteConfig,
});
