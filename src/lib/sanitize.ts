export function sanitizeHtml(
  html: string,
  { siteHost = 'freakyflyerdelivery.com.au' } = {}
) {
  if (!html) return '';

  const escapeRegExp = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hostPattern = escapeRegExp(siteHost);

  // 1) Drop obvious "Navigation" sections (heading + long list of same-domain links)
  html = html.replace(/<p>\s*<a[^>]*>\s*Navigation\s*<\/a>\s*<\/p>/gi, '');
  html = html.replace(
    /<h\d[^>]*>\s*Navigation\s*<\/h\d>\s*<ul[\s\S]*?<\/ul>/gi,
    ''
  );
  // also generic: remove UL lists that are mostly internal links to same host
  html = html.replace(
    new RegExp(
      `<ul>(?:\\s*<li>\\s*(?:<p>)?\\s*<a[^>]+href="(?:https?:)?\/\/(?:www\\.)?${hostPattern}[^\"]*"[^>]*>[\\s\\S]*?<\\/a>[\\s\\S]*?<\\/li>){6,}\\s*<\\/ul>`,
      'gi'
    ),
    ''
  );

  // 2) Demote additional H1 headings to H2 so layout controls the single page H1
  let firstH1Preserved = false;
  html = html.replace(
    /<h1\b([^>]*)>([\s\S]*?)<\/h1>/gi,
    (match, attrs, text) => {
      if (!firstH1Preserved) {
        firstH1Preserved = true;
        return match;
      }
      return `<h2${attrs}>${text}</h2>`;
    }
  );

  // 3) Remove empty anchors (no text, no img)
  html = html.replace(/<a[^>]*>\s*<\/a>/gi, '');

  // 4) Convert absolute internal links to site-relative
  html = html.replace(
    new RegExp(
      `href=["']https?:\/\/(?:www\\.)?${hostPattern}([^"']*)["']`,
      'gi'
    ),
    (_m, path) => `href="${path || '/'}"`
  );

  // 5) Ensure external links open safely
  html = html.replace(
    /<a\b([^>]*?href=["'](mailto:[^"']+|tel:[^"']+|https?:\/\/[^"']+)["'][^>]*)>/gi,
    (match, attrs) => {
      let updated = attrs;
      if (/target\s*=\s*['"][^'"]*['"]/i.test(updated)) {
        updated = updated.replace(
          /target\s*=\s*(['"])([^'"]*)\1/i,
          ' target=\"_blank\"'
        );
      } else {
        updated += ' target="_blank"';
      }
      if (/rel\s*=\s*['"][^'"]*['"]/i.test(updated)) {
        updated = updated.replace(
          /rel\s*=\s*(['"])([^'"]*)\1/i,
          (full, quote, value) => {
            const tokens = value
              .split(/\s+/)
              .filter(Boolean)
              .map((token) => token.toLowerCase());
            const ensureToken = (token: string) => {
              if (!tokens.includes(token)) {
                tokens.push(token);
              }
            };
            ensureToken('noopener');
            ensureToken('noreferrer');
            return ` rel=${quote}${tokens.join(' ')}${quote}`;
          }
        );
      } else {
        updated += ' rel="noopener noreferrer"';
      }
      return `<a${updated}>`;
    }
  );

  // 6) Convert protocol-relative WP image URLs to https
  html = html.replace(
    /src=["']\/\/([^"']+)["']/gi,
    (_m, rest) => `src="https://${rest}"`
  );

  // 7) Provide fallback alt text for images without alt attribute
  html = html.replace(/<img\b([^>]*)>/gi, (match, attrs) => {
    if (/\balt\s*=/i.test(attrs)) {
      return match;
    }
    const selfClosing = /\/?\s*$/.test(attrs);
    const cleanedAttrs = selfClosing ? attrs.replace(/\/?\s*$/, '') : attrs;
    const srcMatch = cleanedAttrs.match(/src=["']([^"']+)["']/i);
    const filename = srcMatch
      ? (srcMatch[1].split('/').pop() ?? 'Image')
      : 'Image';
    const fallback =
      filename
        .replace(/[-_]+/g, ' ')
        .replace(/\.[^.]+$/, '')
        .trim() || 'Image';
    const suffix = selfClosing ? ' />' : '>';
    return `<img${cleanedAttrs} alt="${fallback}"${suffix}`;
  });

  return html;
}
