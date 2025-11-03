import { writeFile } from 'node:fs/promises';

export default function sitemap() {
  let site = '';
  return {
    name: '@astrojs/sitemap-local',
    hooks: {
      'astro:config:done'({ config }) {
        if (typeof config.site === 'string') {
          site = config.site;
        } else if (config.site) {
          site = config.site.toString();
        }
      },
      async 'astro:build:done'({ dir, routes }) {
        if (!site) {
          return;
        }
        const origin = site.endsWith('/') ? site.slice(0, -1) : site;
        const urls = Array.from(
          new Set(
            routes
              .filter((route) => route.type === 'page')
              .map((route) => {
                const path =
                  typeof route.route === 'string'
                    ? route.route
                    : route.pathname;
                if (!path || path === '') {
                  return '/';
                }
                return path.startsWith('/') ? path : `/${path}`;
              })
          )
        ).sort();

        const sitemapBody = urls
          .map(
            (path) => `    <url>\n      <loc>${origin}${path}</loc>\n    </url>`
          )
          .join('\n');

        const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapBody}\n</urlset>\n`;
        const sitemapUrl = `${origin}/sitemap-0.xml`;
        const indexXml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<sitemapindex xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n  <sitemap>\n    <loc>${sitemapUrl}</loc>\n  </sitemap>\n</sitemapindex>\n`;

        await writeFile(new URL('sitemap-0.xml', dir), sitemapXml, 'utf-8');
        await writeFile(new URL('sitemap-index.xml', dir), indexXml, 'utf-8');
      },
    },
  };
}
