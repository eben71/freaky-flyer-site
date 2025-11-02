import { promises as fs } from 'fs';
import matter from 'gray-matter';
import { marked } from 'marked';

const CONTENT_DIR = new URL('../content/pages/', import.meta.url);
const PAGE_MAP_URL = new URL('../../tools/page-map.json', import.meta.url);

interface PageIndexEntry {
  file: string;
  data: Record<string, unknown>;
  content: string;
}

let pageIndexCache: PageIndexEntry[] | null = null;
let pageMapCache: Record<string, string> | null = null;

function normalizeSlug(input: string | null | undefined): string {
  if (!input) return 'index';
  const trimmed = input
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();
  return trimmed.length > 0 ? trimmed : 'index';
}

function getStringField(
  data: Record<string, unknown> | undefined,
  key: string
): string {
  if (!data) return '';
  const value = data[key];
  return typeof value === 'string' ? value.trim() : '';
}

async function getPageIndex(): Promise<PageIndexEntry[]> {
  if (pageIndexCache) {
    return pageIndexCache;
  }

  const entries = await fs.readdir(CONTENT_DIR, { withFileTypes: true });
  const pages: PageIndexEntry[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) {
      continue;
    }
    const fileUrl = new URL(`./${entry.name}`, CONTENT_DIR);
    const raw = await fs.readFile(fileUrl, 'utf8');
    const parsed = matter(raw);
    pages.push({
      file: entry.name,
      data: (parsed.data ?? {}) as Record<string, unknown>,
      content: parsed.content,
    });
  }

  pageIndexCache = pages;
  return pages;
}

async function getPageMap(): Promise<Record<string, string>> {
  if (pageMapCache) {
    return pageMapCache;
  }

  try {
    const raw = await fs.readFile(PAGE_MAP_URL, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, string>;
    pageMapCache = parsed;
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      pageMapCache = {};
      return pageMapCache;
    }
    throw error;
  }
}

function toLoadedPage(entry: PageIndexEntry): LoadedPage {
  const html = marked.parse(entry.content).trim();
  return {
    html,
    fm: entry.data ?? {},
  };
}

export interface LoadedPage {
  html: string;
  fm: Record<string, unknown>;
}

marked.setOptions({
  mangle: false,
  headerIds: true,
});

export async function loadPage(slug: string): Promise<LoadedPage | null> {
  if (process.env.NODE_ENV === 'development') {
    pageIndexCache = null;
    pageMapCache = null;
  }

  const targetSlug = normalizeSlug(slug);
  const pages = await getPageIndex();

  const direct = pages.find((entry) => entry.file === `${targetSlug}.md`);
  if (direct) {
    return toLoadedPage(direct);
  }

  const pageMap = await getPageMap();
  const mappedPaths = Object.entries(pageMap)
    .filter(([, value]) => normalizeSlug(value) === targetSlug)
    .map(([oldPath]) => oldPath);

  for (const oldPath of mappedPaths) {
    const match = pages.find(
      (entry) => getStringField(entry.data, 'oldPath') === oldPath
    );
    if (match) {
      return toLoadedPage(match);
    }
  }

  const aliasMatch = pages.find((entry) => {
    const alias = getStringField(entry.data, 'alias');
    return alias.length > 0 && alias.toLowerCase() === targetSlug;
  });

  if (aliasMatch) {
    return toLoadedPage(aliasMatch);
  }

  return null;
}

export async function loadPages(
  slugs: string[]
): Promise<Record<string, LoadedPage>> {
  const entries = await Promise.all(
    slugs.map(async (slug) => {
      const page = await loadPage(slug);
      return [slug, page] as const;
    })
  );
  return entries.reduce<Record<string, LoadedPage>>(
    (accumulator, [slug, page]) => {
      if (page) {
        accumulator[slug] = page;
      }
      return accumulator;
    },
    {}
  );
}
