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
const baseUrl = (process.env.WP_BASE || getArg('base') || DEFAULT_BASE).replace(/\/$/, '');
const outDir = path.resolve(process.cwd(), process.env.OUT_DIR || getArg('out') || 'src/content/pages');
const imageDir = path.resolve(process.cwd(), process.env.IMG_DIR || getArg('img') || 'public/assets/img/raw');

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

['table', 'thead', 'tbody', 'tr', 'td', 'th'].forEach((tag) => turndownService.keep(tag));

turndownService.addRule('wp-figure', {
  filter: ['figure'],
  replacement: (content) => `\n\n${content.trim()}\n\n`,
});

turndownService.addRule('clean-nbsps', {
  filter: (node) => node.nodeName === '#text' && node.nodeValue.includes('\u00a0'),
  replacement: (content) => content.replace(/\u00a0/g, ' '),
});

function decodeHtml(htmlString = '') {
  const { document } = parseHTML(`<body>${htmlString}</body>`);
  return document.body.textContent?.trim() ?? '';
}

function buildSlugFromLink(link) {
  try {
    const url = new URL(link);
    const segments = url.pathname
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map((segment) => safeSlug(segment));
    return {
      fileSlug: segments.length > 0 ? segments.join('-') : 'index',
      slugPath: segments.join('/') || 'index',
    };
  } catch (error) {
    const slug = safeSlug(link, 'index');
    return { fileSlug: slug || 'index', slugPath: slug || 'index' };
  }
}

function cleanTitle(title) {
  return decodeHtml(title || '');
}

function extractDescription(page) {
  if (page.yoast_head_json) {
    const { description, og_description, twitter_description } = page.yoast_head_json;
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
  document.querySelectorAll('script, style, noscript').forEach((el) => el.remove());
  return document.body.innerHTML;
}

async function ensureImage(url, slugPath, index, hint = '') {
  if (!url) return null;
  const normalized = url.startsWith('http') ? url : normalizeUrl(baseUrl, url);
  if (!normalized) return null;

  const dirSegments = slugPath.split('/').filter(Boolean);
  if (dirSegments.length === 0) {
    dirSegments.push('index');
  }
  const fsDir = path.join(imageDir, ...dirSegments);
  const posixDir = dirSegments.join('/');
  await ensureDir(fsDir);

  const urlObj = new URL(normalized);
  const originalName = path.basename(urlObj.pathname).split('?')[0];
  const ext = path.extname(originalName) || '.jpg';
  const baseName = safeSlug(path.basename(originalName, ext) || hint || `image-${index + 1}`, `image-${index + 1}`);
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
  const publicOptimized = `/assets/img/optimized/${posixDir}/${optimizedName}`.replace(/\/+/g, '/');
  return {
    url: normalized,
    destination,
    publicRaw,
    publicOptimized,
  };
}

async function processPage(page) {
  const { fileSlug, slugPath } = buildSlugFromLink(page.link || page.slug || '');
  const targetPath = path.join(outDir, `${fileSlug}.md`);
  await ensureDir(path.dirname(targetPath));

  const title = cleanTitle(page.title?.rendered || page.slug || fileSlug);
  const rawHtml = htmlFromContent(page.content?.rendered || '');
  const { document } = parseHTML(`<body>${rawHtml}</body>`);

  const downloadedImages = new Map();
  const imageNodes = Array.from(document.querySelectorAll('img'));
  let imageIndex = 0;
  for (const img of imageNodes) {
    const candidateSrc = img.getAttribute('data-src') || img.getAttribute('src');
    const normalized = candidateSrc ? normalizeUrl(baseUrl, candidateSrc) : null;
    if (!normalized) {
      imageIndex += 1;
      continue;
    }
    let image = downloadedImages.get(normalized);
    if (!image) {
      image = await ensureImage(normalized, slugPath, imageIndex, img.getAttribute('alt') || title);
      if (image) {
        downloadedImages.set(normalized, image);
      }
    }
    if (image) {
      img.setAttribute('src', image.publicRaw);
      img.removeAttribute('srcset');
      img.removeAttribute('sizes');
    }
    imageIndex += 1;
  }

  const featured = page._embedded?.['wp:featuredmedia'] || [];
  for (const media of featured) {
    const source = media?.source_url;
    if (!source) continue;
    const normalized = normalizeUrl(baseUrl, source);
    if (!normalized) continue;
    if (!downloadedImages.has(normalized)) {
      const image = await ensureImage(normalized, slugPath, imageIndex, media?.slug || title);
      if (image) {
        downloadedImages.set(normalized, image);
      }
    }
    imageIndex += 1;
  }

  const markdown = turndownService.turndown(document.body.innerHTML);
  const description = extractDescription(page);
  const frontmatter = {
    title,
    description,
    oldUrl: page.link,
    slug: slugPath,
    images: unique(Array.from(downloadedImages.values()).map((item) => item.publicOptimized)),
  };

  const fileContents = matter.stringify(markdown.trim(), frontmatter);
  await writeText(targetPath, `${fileContents}\n`);
  return {
    slug: slugPath,
    title,
    images: frontmatter.images.length,
  };
}

async function fetchAllPages() {
  const pages = [];
  let page = 1;
  while (true) {
    const endpoint = `${baseUrl}/wp-json/wp/v2/pages?per_page=100&page=${page}&_embed`;
    logger.info(`Fetching ${endpoint}`);
    const response = await fetchWithRetry(endpoint, { headers: { Accept: 'application/json' } }, { attempts: 4, delayMs: 750 });
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) break;
    pages.push(...data);
    const totalPages = Number(response.headers.get('x-wp-totalpages') || pages.length);
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
    const results = [];
    for (const page of pages) {
      try {
        const result = await processPage(page);
        results.push(result);
        logger.info(`Exported ${result.slug} (${result.images} images)`);
      } catch (error) {
        logger.error(`Failed to process page ${page.slug || page.id}:`, error.message);
      }
    }
    const totalImages = results.reduce((sum, page) => sum + page.images, 0);
    logger.info(`Export complete: ${results.length} pages, ${totalImages} images referenced.`);
  } catch (error) {
    logger.error('Export failed:', error.message);
    process.exitCode = 1;
  }
})();

