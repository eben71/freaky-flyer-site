import { defineConfig } from 'astro/config';

let sitemapIntegration;
try {
  ({ default: sitemapIntegration } = await import('@astrojs/sitemap'));
} catch (error) {
  ({ default: sitemapIntegration } = await import(
    './vendor/astrojs-sitemap/index.js'
  ));
}

const basePathRaw = process.env.PUBLIC_BASE_PATH?.trim() || '/newsite';
const normalizedBase = `/${basePathRaw.replace(/^\/+|\/+$/g, '')}/`;
const baseHrefPrefix = normalizedBase.slice(0, -1); // drop trailing slash

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

const ensureBaseTrailingSlash = (basePath) => {
  const baseNoSlash = basePath.endsWith('/')
    ? basePath.slice(0, -1)
    : basePath;

  return {
    name: 'ffd-base-trailing-slash',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        const [pathname, search = ''] = url.split('?', 2);
        if (pathname === baseNoSlash) {
          const target = `${basePath}${search ? `?${search}` : ''}`;
          res.statusCode = 301;
          res.setHeader('Location', target);
          res.end();
          return;
        }
        next();
      });
    },
  };
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
const baseRedirectPlugin = ensureBaseTrailingSlash(normalizedBase);
const mergedViteConfig = {
  ...viteConfig,
  plugins: [...(viteConfig?.plugins ?? []), baseRedirectPlugin],
};

export default defineConfig({
  site: 'https://freakyflyerdelivery.com.au/newsite',
  base: normalizedBase,
  output: 'static',
  integrations: [sitemapIntegration()],
  markdown: {
    remarkPlugins: [replacePlaceholders],
  },
  vite: mergedViteConfig,
});
