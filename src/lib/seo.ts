import type { APIContext } from 'astro';
import { site } from '../site.config';

export function buildMeta(
  ctx: APIContext,
  {
    title,
    description,
    image,
  }: { title?: string; description?: string; image?: string } = {}
) {
  const url = new URL(ctx.url);
  const pageTitle = title ? `${title} | ${site.name}` : site.name;
  const desc = description || site.defaultDescription;
  const og = image || site.ogImage;
  const canonical = `${site.domain}${url.pathname}`;

  return { pageTitle, desc, og, canonical };
}
