export function sanitizeHtml(
  html: string,
  { siteHost = 'freakyflyerdelivery.com.au' } = {}
) {
  if (!html) return '';

  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hostPattern = escapeRegExp(siteHost);

  // 1) Drop obvious "Navigation" sections (heading + long list of same-domain links)
  html = html.replace(/<p>\s*<a[^>]*>\s*Navigation\s*<\/a>\s*<\/p>/gi, '');
  html = html.replace(/<h\d[^>]*>\s*Navigation\s*<\/h\d>\s*<ul[\s\S]*?<\/ul>/gi, '');
  // also generic: remove UL lists that are mostly internal links to same host
  html = html.replace(
    new RegExp(
      `<ul>(?:\\s*<li>\\s*(?:<p>)?\\s*<a[^>]+href="(?:https?:)?\/\/(?:www\\.)?${hostPattern}[^\"]*"[^>]*>[\\s\\S]*?<\\/a>[\\s\\S]*?<\\/li>){6,}\\s*<\\/ul>`,
      'gi'
    ),
    ''
  );

  // 2) Demote multiple H1s to H2/H3 (keep the first H1 only)
  let first = true;
  html = html.replace(/<h1\b([^>]*)>([\s\S]*?)<\/h1>/gi, (_m, attrs, text) => {
    if (first) {
      first = false;
      return `<h1${attrs}>${text}</h1>`;
    }
    return `<h2${attrs}>${text}</h2>`;
  });

  // 3) Remove empty anchors (no text, no img)
  html = html.replace(/<a[^>]*>\s*<\/a>/gi, '');

  // 4) Convert absolute internal links to site-relative
  html = html.replace(
    new RegExp(`href=["']https?:\/\/(?:www\\.)?${hostPattern}([^"']*)["']`, 'gi'),
    (_m, path) => `href="${path || '/'}"`
  );

  // 5) Convert protocol-relative WP image URLs to https
  html = html.replace(/src=["']\/\/([^"']+)["']/gi, (_m, rest) => `src="https://${rest}"`);

  return html;
}
