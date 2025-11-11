import { site } from '../site.config';

const siteHost = new URL(site.domain).host.replace(/^www\./, '');

export function isExternal(href: string): boolean {
  if (!href) return false;
  const value = href.trim();
  if (value === '') return false;
  if (/^(mailto:|tel:)/i.test(value)) {
    return true;
  }
  if (/^https?:\/\//i.test(value) || value.startsWith('//')) {
    try {
      const linkUrl = new URL(
        value.startsWith('//') ? `https:${value}` : value
      );
      const linkHost = linkUrl.host.replace(/^www\./, '');
      return linkHost !== siteHost;
    } catch (error) {
      return false;
    }
  }
  return false;
}

export function linkAttrs(href?: string) {
  if (!href || !isExternal(href)) {
    return {};
  }
  return { target: '_blank', rel: 'noopener noreferrer' };
}
