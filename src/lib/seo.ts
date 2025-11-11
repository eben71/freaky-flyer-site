import type { APIContext } from 'astro';
import { site } from '../site.config';

export function buildMeta(
  ctx: APIContext,
  {
    title,
    description,
    image,
    canonical,
  }: {
    title?: string;
    description?: string;
    image?: string;
    canonical?: string;
  } = {}
) {
  const url = new URL(ctx.url);
  const pageTitle = title ? `${title} | ${site.name}` : site.name;
  const desc = description || site.defaultDescription;
  const og = image || site.ogImage;
  const ensureLeadingSlash = (value: string) =>
    value.startsWith('/') ? value : `/${value}`;
  const normalisePathname = (pathname: string) => {
    if (!pathname || pathname === '/') {
      return '/';
    }
    const trimmed = pathname.replace(/\/+$/, '');
    return `${trimmed}/`;
  };

  let canonicalUrl: string;

  if (canonical && canonical.trim().length > 0) {
    const provided = canonical.trim();
    if (/^https?:\/\//i.test(provided)) {
      const withoutTrailing = provided.replace(/\/+$/, '');
      canonicalUrl = `${withoutTrailing}/`;
    } else {
      const relative = normalisePathname(ensureLeadingSlash(provided));
      canonicalUrl = `${site.domain}${relative}`;
    }
  } else {
    canonicalUrl = `${site.domain}${normalisePathname(url.pathname)}`;
  }

  return { pageTitle, desc, og, canonical: canonicalUrl };
}
