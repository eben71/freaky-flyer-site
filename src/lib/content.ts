import { promises as fs } from 'fs';
import matter from 'gray-matter';
import { marked } from 'marked';

const CONTENT_DIR = new URL('../content/pages/', import.meta.url);

export interface LoadedPage {
  html: string;
  fm: Record<string, unknown>;
}

marked.setOptions({
  mangle: false,
  headerIds: true,
});

export async function loadPage(slug: string): Promise<LoadedPage | null> {
  const normalized = slug?.trim() || 'index';
  const fileUrl = new URL(`./${normalized}.md`, CONTENT_DIR);
  try {
    const raw = await fs.readFile(fileUrl, 'utf8');
    const parsed = matter(raw);
    const html = marked.parse(parsed.content);
    return {
      html: html.trim(),
      fm: parsed.data ?? {},
    };
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function loadPages(slugs: string[]): Promise<Record<string, LoadedPage>> {
  const entries = await Promise.all(
    slugs.map(async (slug) => {
      const page = await loadPage(slug);
      return [slug, page] as const;
    }),
  );
  return entries.reduce<Record<string, LoadedPage>>((accumulator, [slug, page]) => {
    if (page) {
      accumulator[slug] = page;
    }
    return accumulator;
  }, {});
}

