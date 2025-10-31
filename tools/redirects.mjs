import path from 'path';
import { promises as fs } from 'fs';
import { createLogger, ensureDir, pathExists, readCSV } from './lib/io.mjs';

const logger = createLogger('redirects');

const mappingPath = path.resolve(
  process.cwd(),
  process.env.REDIRECTS_SOURCE || 'tools/url-map.csv'
);
const htaccessPath = path.resolve(
  process.cwd(),
  process.env.HTACCESS_PATH || 'public/.htaccess'
);

function normalizePath(value) {
  if (!value) return '/';
  const trimmed = value.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      return url.pathname || '/';
    } catch (error) {
      return '/';
    }
  }
  if (!trimmed.startsWith('/')) {
    return `/${trimmed}`;
  }
  return trimmed;
}

function formatRedirect(oldUrl, newPath) {
  const from = normalizePath(oldUrl);
  const to = normalizePath(newPath);
  return `Redirect 301 ${from} ${to}`;
}

async function loadExistingRedirects() {
  if (!(await pathExists(htaccessPath))) {
    return [];
  }
  const contents = await fs.readFile(htaccessPath, 'utf8');
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('Redirect 301 '));
}

async function appendRedirects(lines) {
  const content = `${lines.join('\n')}\n`;
  await ensureDir(path.dirname(htaccessPath));
  await fs.appendFile(htaccessPath, content, 'utf8');
}

(async function run() {
  logger.info(`Reading redirect mapping from ${mappingPath}`);
  try {
    const entries = await readCSV(mappingPath);
    if (entries.length === 0) {
      logger.warn('No redirect entries found.');
      return;
    }

    const existing = await loadExistingRedirects();
    const existingSet = new Set(existing.map((line) => line.toLowerCase()));

    const additions = [];
    for (const entry of entries) {
      const line = formatRedirect(entry.oldUrl, entry.newPath);
      if (!existingSet.has(line.toLowerCase())) {
        additions.push(line);
        existingSet.add(line.toLowerCase());
      }
    }

    if (additions.length === 0) {
      logger.info('No new redirects to append.');
      return;
    }

    await appendRedirects(additions);
    logger.info(
      `Appended ${additions.length} redirect rules to ${htaccessPath}`
    );
  } catch (error) {
    logger.error('Failed to build redirects:', error.message);
    process.exitCode = 1;
  }
})();
