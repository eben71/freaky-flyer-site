import path from 'path';
import TurndownService from 'turndown';
import matter from 'gray-matter';
import { parseHTML } from 'linkedom';
import { fetch as undiciFetch } from 'undici';
import {
  createLogger,
  downloadFile,
  ensureDir,
  normalizeUrl,
  pathExists,
  readLines,
  safeSlug,
  unique,
  writeText,
} from './lib/io.mjs';

const logger = createLogger('html-export');

function getArg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

const DEFAULT_BASE = 'https://freakyflyerdelivery.com.au';
const baseUrl = (process.env.BASE_URL || getArg('base') || DEFAULT_BASE).replace(/\/$/, '');
const outDir = path.resolve(process.cwd(), process.env.OUT_DIR || getArg('out') || 'src/content/pages');
const imageDir = path.resolve(process.cwd(), process.env.IMG_DIR || getArg('img') || 'public/assets/img/raw');
const urlListPath = path.resolve(process.cwd(), 'tools/urls.txt');
const shouldCrawl = ['1', 'true', 'yes'].includes((process.env.CRAWL || '').toLowerCase());
const maxDepth = Number(process.env.CRAWL_DEPTH || 2);

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});
['table', 'thead', 'tbody', 'tr', 'td', 'th'].forEach((tag) => turndownService.keep(tag));

turndownService.addRule('clean-nbsps', {
  filter: (node) => node.nodeName === '#text' && node.nodeValue.includes('\u00a0'),
  replacement: (content) => content.replace(/\u00a0/g, ' '),
});

function decodeHtml(htmlString = '') {
  const { document } = parseHTML(`<body>${htmlString}</body>`);
  return document.body.textContent?.trim() ?? '';
}

function buildSlug(pathname) {
  const segments = pathname
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => safeSlug(segment));
  return {
    fileSlug: segments.length > 0 ? segments.join('-') : 'index',
    slugPath: segments.join('/') || 'index',
  };
}

function cleanDocument(html) {
  const { document } = parseHTML(html);
  document.querySelectorAll('script, style, noscript').forEach((el) => el.remove());
  return document;
}

function extractMainContent(document) {
  const main = document.querySelector('main');
  if (main) return main.innerHTML;
  const article = document.querySelector('article');
  if (article) return article.innerHTML;
  const bodyClone = document.body.cloneNode(true);
  bodyClone.querySelectorAll('header, footer, nav, aside').forEach((el) => el.remove());
  return bodyClone.innerHTML;
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
    publicRaw,
    publicOptimized,
  };
}

async function fetchHtml(url) {
  const response = await undiciFetch(url, { headers: { 'User-Agent': 'content-export-script' } });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

async function crawlUrls(seedUrls) {
  if (!shouldCrawl) {
    return seedUrls;
  }
  const visited = new Set(seedUrls.map((p) => normalizeUrl(baseUrl, p)).filter(Boolean));
  const queue = seedUrls
    .map((path) => ({ url: normalizeUrl(baseUrl, path), depth: 0 }))
    .filter((item) => item.url);
  const results = new Set(visited);

  while (queue.length > 0) {
    const { url, depth } = queue.shift();
    if (!url || depth > maxDepth) continue;
    try {
      const html = await fetchHtml(url);
      const document = cleanDocument(html);
      document.querySelectorAll('a[href]').forEach((anchor) => {
        const href = anchor.getAttribute('href');
        const target = normalizeUrl(baseUrl, href);
        if (!target) return;
        if (!target.startsWith(baseUrl)) return;
        if (target.includes('#')) {
          const withoutHash = target.split('#')[0];
          if (visited.has(withoutHash)) return;
          visited.add(withoutHash);
          if (depth + 1 <= maxDepth) {
            queue.push({ url: withoutHash, depth: depth + 1 });
          }
          results.add(withoutHash);
          return;
        }
        if (visited.has(target)) return;
        visited.add(target);
        if (depth + 1 <= maxDepth) {
          queue.push({ url: target, depth: depth + 1 });
        }
        results.add(target);
      });
    } catch (error) {
      logger.warn(`Failed to crawl ${url}:`, error.message);
    }
  }

  return Array.from(results).map((url) => {
    try {
      const parsed = new URL(url);
      return parsed.pathname || '/';
    } catch (error) {
      return '/';
    }
  });
}

async function loadSeedUrls() {
  try {
    const lines = await readLines(urlListPath);
    if (lines.length === 0) return ['/'];
    return lines;
  } catch (error) {
    logger.warn('Unable to read tools/urls.txt, defaulting to /.');
    return ['/'];
  }
}

async function processUrl(pathname) {
  const pageUrl = normalizeUrl(baseUrl, pathname);
  if (!pageUrl) {
    throw new Error(`Invalid URL for path ${pathname}`);
  }
  const html = await fetchHtml(pageUrl);
  const document = cleanDocument(html);
  const mainHtml = extractMainContent(document);

  const title = decodeHtml(document.querySelector('title')?.textContent || '');
  const description = decodeHtml(document.querySelector('meta[name="description"]')?.getAttribute('content') || '');
  const { fileSlug, slugPath } = buildSlug(new URL(pageUrl).pathname);

  const dom = parseHTML(`<body>${mainHtml}</body>`);
  const downloadedImages = new Map();
  const imageNodes = Array.from(dom.document.querySelectorAll('img'));
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

  const markdown = turndownService.turndown(dom.document.body.innerHTML);
  const frontmatter = {
    title: title || `Page ${slugPath}`,
    description,
    oldUrl: pageUrl,
    slug: slugPath,
    images: unique(Array.from(downloadedImages.values()).map((item) => item.publicOptimized)),
  };

  const filePath = path.join(outDir, `${fileSlug}.md`);
  await ensureDir(path.dirname(filePath));
  const fileContents = matter.stringify(markdown.trim(), frontmatter);
  await writeText(filePath, `${fileContents}\n`);
  return {
    slug: slugPath,
    images: frontmatter.images.length,
  };
}

(async function run() {
  logger.info(`Exporting HTML from ${baseUrl}`);
  await ensureDir(outDir);
  await ensureDir(imageDir);

  try {
    const seeds = await loadSeedUrls();
    const targets = await crawlUrls(seeds);
    const uniquePaths = unique(targets.map((target) => {
      try {
        const url = new URL(normalizeUrl(baseUrl, target));
        return url.pathname || '/';
      } catch (error) {
        return target;
      }
    }));

    logger.info(`Processing ${uniquePaths.length} URLs`);
    const results = [];
    for (const pathname of uniquePaths) {
      try {
        const result = await processUrl(pathname);
        results.push(result);
        logger.info(`Exported ${result.slug} (${result.images} images)`);
      } catch (error) {
        logger.error(`Failed to export ${pathname}:`, error.message);
      }
    }
    const totalImages = results.reduce((sum, page) => sum + page.images, 0);
    logger.info(`Export complete: ${results.length} pages, ${totalImages} images referenced.`);
  } catch (error) {
    logger.error('HTML export failed:', error.message);
    process.exitCode = 1;
  }
})();

