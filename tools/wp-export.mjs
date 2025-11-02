import path from 'path';
import TurndownService from 'turndown';
import matter from 'gray-matter';
import { parseHTML } from 'linkedom';
import {
  createLogger,
  downloadFile,
  ensureDir,
  fetchWithRetry,
  normalizeUrl,
  pathExists,
  safeSlug,
  unique,
  writeText,
} from './lib/io.mjs';

const logger = createLogger('wp-export');

function getArg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

const DEFAULT_BASE = 'https://freakyflyerdelivery.com.au';
const baseUrl = (process.env.WP_BASE || getArg('base') || DEFAULT_BASE).replace(
  /\/$/,
  ''
);
const outDir = path.resolve(
  process.cwd(),
  process.env.OUT_DIR || getArg('out') || 'src/content/pages'
);
const imageDir = path.resolve(
  process.cwd(),
  process.env.IMG_DIR || getArg('img') || 'public/assets/img/raw'
);

const concurrency = Math.max(
  1,
  toNumber(process.env.CONCURRENCY ?? getArg('concurrency'), 2)
);
const delayMs = Math.max(
  0,
  toNumber(process.env.DELAY_MS ?? getArg('delay'), 400)
);
const shouldFetchRendered =
  (process.env.FETCH_RENDERED ?? getArg('fetch-rendered') ?? '1') !== '0';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function toNumber(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

['table', 'thead', 'tbody', 'tr', 'td', 'th'].forEach((tag) =>
  turndownService.keep(tag)
);

turndownService.addRule('wp-figure', {
  filter: ['figure'],
  replacement: (content) => `\n\n${content.trim()}\n\n`,
});

turndownService.addRule('clean-nbsps', {
  filter: (node) =>
    node.nodeName === '#text' && node.nodeValue.includes('\u00a0'),
  replacement: (content) => content.replace(/\u00a0/g, ' '),
});

function decodeHtml(htmlString = '') {
  const { document } = parseHTML(`<body>${htmlString}</body>`);
  return document.body.textContent?.trim() ?? '';
}

function ensurePathname(pathname = '/') {
  let value = pathname || '/';
  if (!value.startsWith('/')) {
    value = `/${value}`;
  }
  if (value !== '/' && !value.endsWith('/')) {
    value = `${value}/`;
  }
  return value;
}

function deriveSlugInfo(link) {
  const normalizedLink = normalizeUrl(baseUrl, link) || link || '';
  try {
    const url = new URL(normalizedLink);
    const oldPath = ensurePathname(url.pathname || '/');
    const segments = oldPath
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map((segment) => safeSlug(segment));
    const alias = segments[segments.length - 1] || 'index';
    const flatSlug = segments.length > 0 ? segments.join('-') : 'index';
    return {
      oldUrl: url.toString(),
      oldPath,
      alias,
      flatSlug,
    };
  } catch (error) {
    const fallback = safeSlug(link || 'index', 'index');
    const alias = fallback || 'index';
    const oldPath = alias === 'index' ? '/' : ensurePathname(alias);
    const resolvedUrl =
      normalizeUrl(baseUrl, oldPath) ||
      normalizeUrl(baseUrl, link || '') ||
      normalizedLink ||
      `${baseUrl.replace(/\/$/, '')}/${alias}`;
    return {
      oldUrl: resolvedUrl,
      oldPath,
      alias,
      flatSlug: alias,
    };
  }
}

function cleanTitle(title) {
  return decodeHtml(title || '');
}

function extractDescription(page) {
  if (page.yoast_head_json) {
    const { description, og_description, twitter_description } =
      page.yoast_head_json;
    if (description) return description;
    if (og_description) return og_description;
    if (twitter_description) return twitter_description;
  }
  if (page.yoast_head) {
    const { document } = parseHTML(page.yoast_head);
    const meta = document.querySelector('meta[name="description"]');
    if (meta?.getAttribute('content')) {
      return meta.getAttribute('content');
    }
  }
  return '';
}

function htmlFromContent(content = '') {
  const wrapped = `<body>${content}</body>`;
  const { document } = parseHTML(wrapped);
  document
    .querySelectorAll('script, style, noscript')
    .forEach((el) => el.remove());
  return document.body.innerHTML;
}

async function ensureImage(url, flatSlug, index, hint = '') {
  if (!url) return null;
  const normalized = url.startsWith('http') ? url : normalizeUrl(baseUrl, url);
  if (!normalized) return null;

  const dirName = flatSlug && flatSlug.length > 0 ? flatSlug : 'index';
  const fsDir = path.join(imageDir, dirName);
  const posixDir = dirName;
  await ensureDir(fsDir);

  const urlObj = new URL(normalized);
  const originalName = path.basename(urlObj.pathname).split('?')[0];
  const ext = path.extname(originalName) || '.jpg';
  const baseName = safeSlug(
    path.basename(originalName, ext) || hint || `image-${index + 1}`,
    `image-${index + 1}`
  );
  let candidate = `${baseName}${ext}`;
  let counter = 1;
  while (await pathExists(path.join(fsDir, candidate))) {
    candidate = `${baseName}-${counter}${ext}`;
    counter += 1;
  }
  const destination = path.join(fsDir, candidate);
  await downloadFile(normalized, destination);
  const publicRaw = `/assets/img/raw/${posixDir}/${candidate}`.replace(/\/+/g, '/');
  const optimizedName = `${path.basename(candidate, ext)}-960.webp`;
  const publicOptimized =
    `/assets/img/optimized/${posixDir}/${optimizedName}`.replace(/\/+/g, '/');
  return {
    url: normalized,
    destination,
    publicRaw,
    publicOptimized,
  };
}

async function processPage(page) {
  const slugInfo = deriveSlugInfo(page.link || page.slug || '');
  const targetPath = path.join(outDir, `${slugInfo.flatSlug}.md`);
  await ensureDir(path.dirname(targetPath));

  const title = cleanTitle(page.title?.rendered || page.slug || slugInfo.flatSlug);
  const rawHtml = htmlFromContent(page.content?.rendered || '');
  const { document } = parseHTML(`<body>${rawHtml}</body>`);

  const downloadedImages = new Map();
  let embeddedCount = 0;
  let renderedCount = 0;

  const queueImage = async (candidateUrl, hint, source = 'embedded') => {
    if (!candidateUrl) return null;
    const normalized = normalizeUrl(slugInfo.oldUrl || baseUrl, candidateUrl);
    if (!normalized) return null;
    let image = downloadedImages.get(normalized);
    if (!image) {
      const index = downloadedImages.size;
      image = await ensureImage(normalized, slugInfo.flatSlug, index, hint);
      if (image) {
        downloadedImages.set(normalized, image);
        if (source === 'rendered') {
          renderedCount += 1;
        } else {
          embeddedCount += 1;
        }
      }
    }
    return image;
  };

  const imageNodes = Array.from(document.querySelectorAll('img'));
  for (const img of imageNodes) {
    const candidateSrc =
      img.getAttribute('data-src') || img.getAttribute('src');
    const image = await queueImage(
      candidateSrc,
      img.getAttribute('alt') || title,
      'embedded'
    );
    if (image) {
      img.setAttribute('src', image.publicRaw);
      img.removeAttribute('srcset');
      img.removeAttribute('sizes');
    }
  }

  const featured = page._embedded?.['wp:featuredmedia'] || [];
  for (const media of featured) {
    const source = media?.source_url;
    if (!source) continue;
    await queueImage(source, media?.slug || title, 'embedded');
  }

  if (downloadedImages.size === 0 && shouldFetchRendered && slugInfo.oldUrl) {
    try {
      const response = await fetchWithRetry(
        slugInfo.oldUrl,
        { headers: { Accept: 'text/html' } },
        { attempts: 3, delayMs: Math.max(delayMs, 500) }
      );
      const html = await response.text();
      const { document: renderedDocument } = parseHTML(html);
      const renderedImages = Array.from(
        renderedDocument.querySelectorAll('img')
      );
      for (const img of renderedImages) {
        const candidateSrc =
          img.getAttribute('data-src') || img.getAttribute('src');
        await queueImage(candidateSrc, img.getAttribute('alt') || title, 'rendered');
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      logger.warn(
        `Failed to fetch rendered page for ${slugInfo.flatSlug}:`,
        message
      );
    }
  }

  const markdown = turndownService.turndown(document.body.innerHTML);
  const description = extractDescription(page);
  const images = unique(
    Array.from(downloadedImages.values()).map((item) => item.publicOptimized)
  );
  const frontmatter = {
    title,
    description,
    oldUrl: slugInfo.oldUrl,
    oldPath: slugInfo.oldPath,
    slug: slugInfo.flatSlug,
    alias: slugInfo.alias,
    images,
  };

  const fileContents = matter.stringify(markdown.trim(), frontmatter);
  await writeText(targetPath, `${fileContents}\n`);
  return {
    slug: slugInfo.flatSlug,
    title,
    embedded: embeddedCount,
    rendered: renderedCount,
    total: downloadedImages.size,
  };
}

async function fetchAllPages() {
  const pages = [];
  let page = 1;
  while (true) {
    const endpoint = `${baseUrl}/wp-json/wp/v2/pages?per_page=100&page=${page}&_embed`;
    logger.info(`Fetching ${endpoint}`);
    const response = await fetchWithRetry(
      endpoint,
      { headers: { Accept: 'application/json' } },
      { attempts: 4, delayMs: 750 }
    );
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) break;
    pages.push(...data);
    const totalPages = Number(
      response.headers.get('x-wp-totalpages') || pages.length
    );
    if (page >= totalPages) break;
    page += 1;
  }
  return pages;
}

(async function run() {
  logger.info(`Exporting pages from ${baseUrl}`);
  await ensureDir(outDir);
  await ensureDir(imageDir);

  try {
    const pages = await fetchAllPages();
    logger.info(`Found ${pages.length} pages`);
    const queue = [...pages];
    const results = [];

    logger.info(
      `Using concurrency=${concurrency}, delayMs=${delayMs}, fetchRendered=${shouldFetchRendered}`
    );

    const workers = Array.from({ length: concurrency }).map(async () => {
      while (queue.length > 0) {
        const next = queue.shift();
        if (!next) break;
        try {
          const result = await processPage(next);
          results.push(result);
          logger.info(
            `slug=${result.slug}, images=${result.total} (embedded: ${result.embedded}, rendered: ${result.rendered})`
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          logger.error(
            `Failed to process page ${next.slug || next.id}:`,
            message
          );
        }
        if (delayMs > 0) {
          await sleep(delayMs);
        }
      }
    });

    await Promise.all(workers);

    const aggregate = results.reduce(
      (accumulator, item) => {
        accumulator.pages += 1;
        accumulator.images += item.total;
        accumulator.embedded += item.embedded;
        accumulator.rendered += item.rendered;
        return accumulator;
      },
      { pages: 0, images: 0, embedded: 0, rendered: 0 }
    );

    logger.info(
      `Export complete: ${aggregate.pages} pages, ${aggregate.images} images downloaded (embedded: ${aggregate.embedded}, rendered: ${aggregate.rendered}).`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Export failed:', message);
    process.exitCode = 1;
  }
})();
