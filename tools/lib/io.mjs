import { promises as fs } from 'fs';
import path from 'path';
import slugify from 'slugify';
import fetch from 'node-fetch';

const SLUG_OPTIONS = {
  lower: true,
  strict: true,
  trim: true,
};

export function createLogger(scope = 'tools') {
  const prefix = `[${scope}]`;
  return {
    info: (...args) => console.log(prefix, ...args),
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args),
  };
}

export const logger = createLogger();

export async function ensureDir(dirPath) {
  if (!dirPath) return;
  await fs.mkdir(dirPath, { recursive: true });
}

export async function readJSON(filePath) {
  const data = await fs.readFile(filePath, 'utf8');
  return JSON.parse(data);
}

export async function writeJSON(filePath, data) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export async function readText(filePath) {
  return fs.readFile(filePath, 'utf8');
}

export async function writeText(filePath, contents) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, contents, 'utf8');
}

export async function readCSV(filePath) {
  const text = await readText(filePath);
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  if (rows.length === 0) return [];

  const headers = rows[0].split(',').map((h) => h.trim());
  return rows.slice(1).map((row) => {
    const values = row.split(',');
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ? values[index].trim() : '';
    });
    return record;
  });
}

export async function writeCSV(filePath, rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    await writeText(filePath, '');
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    const line = headers
      .map((header) => {
        const value = row[header] ?? '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      })
      .join(',');
    lines.push(line);
  }
  await writeText(filePath, `${lines.join('\n')}\n`);
}

export function safeSlug(input, fallback = 'page') {
  const base = (input || '').toString().trim();
  const slug = slugify(base, SLUG_OPTIONS);
  if (slug.length > 0) return slug;
  return slugify(fallback, SLUG_OPTIONS) || 'page';
}

export function resolveFileName(name, extension = '') {
  const slug = safeSlug(name);
  return extension ? `${slug}.${extension.replace(/^\./, '')}` : slug;
}

export async function fetchWithRetry(url, options = {}, { attempts = 3, delayMs = 500 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
  }
  throw lastError;
}

export async function downloadFile(url, destination) {
  const response = await fetchWithRetry(url, { redirect: 'follow' }, { attempts: 4, delayMs: 750 });
  await ensureDir(path.dirname(destination));
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(destination, buffer);
  return destination;
}

export async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch (error) {
    return false;
  }
}

export async function readLines(filePath) {
  const text = await readText(filePath);
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

export function normalizeUrl(base, maybeRelative) {
  try {
    return new URL(maybeRelative, base).toString();
  } catch (error) {
    return null;
  }
}

export function unique(array) {
  return [...new Set(array.filter(Boolean))];
}

