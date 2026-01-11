#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname, extname, relative } from 'node:path';

const { targetDir, options } = parseArgs(process.argv.slice(2));

if (!targetDir) {
  console.error('Usage: linkinator <dir> [--skip <pattern>] [--silent] [--recurse]');
  process.exit(1);
}

const root = resolve(process.cwd(), targetDir);
let basePath = normalizeBasePath(options.base || process.env.PUBLIC_BASE_PATH);
if (!existsSync(root) || !statSync(root).isDirectory()) {
  console.error(`Directory not found: ${root}`);
  process.exit(1);
}

const skipRegex = options.skip ? new RegExp(options.skip) : null;
const htmlFiles = collectHtmlFiles(root);
if (!basePath) {
  basePath = inferBasePathFromLinks(htmlFiles, root);
}
let checkedLinks = 0;
const issues = [];

for (const file of htmlFiles) {
  const content = readFileSync(file, 'utf8');
  const links = extractLinks(content);
  if (!links.length) continue;
  for (const href of links) {
    if (!href) continue;
    if (skipRegex && skipRegex.test(href)) continue;
    if (/^[a-zA-Z+.-]+:/.test(href) && !href.startsWith('/')) {
      continue;
    }
    const resolvedPath = resolveLinkPath(href, file, root, basePath);
    if (!resolvedPath) continue;
    checkedLinks++;
    if (!pathExists(resolvedPath)) {
      issues.push({
        source: file,
        href,
      });
    }
  }
}

if (issues.length) {
  for (const issue of issues) {
    const relSource = relative(root, issue.source) || issue.source;
    console.error(`Broken link in ${relSource}: ${issue.href}`);
  }
  console.error(`Found ${issues.length} broken link(s).`);
  process.exit(1);
}

if (!options.silent) {
  console.log(`Checked ${checkedLinks} internal link(s) across ${htmlFiles.length} file(s). No issues found.`);
}

function parseArgs(argv) {
  const options = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      if (value !== undefined && value.length) {
        options[key] = coerceValue(value);
        continue;
      }
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        options[key] = coerceValue(next);
        i++;
      } else {
        options[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { targetDir: positional[0], options };
}

function coerceValue(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

function collectHtmlFiles(dir) {
  const files = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile() && fullPath.endsWith('.html')) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

function extractLinks(html) {
  const links = [];
  const regex = /<a\b[^>]*href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    links.push(value.trim());
  }
  return links;
}

function resolveLinkPath(href, sourceFile, rootDir, basePath) {
  if (!href || href.startsWith('#')) return null;
  const normalizedHref = stripBasePath(href, basePath);
  if (normalizedHref.startsWith('/')) {
    return join(rootDir, normalizedHref);
  }
  if (href.startsWith('..') || href.startsWith('./') || !href.includes(':')) {
    return resolve(dirname(sourceFile), href);
  }
  return null;
}

function normalizeBasePath(value) {
  if (!value || value === 'undefined' || value === 'null') return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  const normalized = `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
  return normalized === '/' ? '' : normalized;
}

function inferBasePathFromLinks(files, rootDir) {
  const counts = new Map();
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const links = extractLinks(content);
    for (const href of links) {
      if (!href || !href.startsWith('/') || href.startsWith('//')) continue;
      const match = href.match(/^\/([^/]+)(?:\/|$)/);
      if (!match) continue;
      const segment = match[1];
      if (!segment) continue;
      const candidate = `/${segment}`;
      counts.set(candidate, (counts.get(candidate) || 0) + 1);
    }
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  for (const [candidate] of sorted) {
    const candidatePath = join(rootDir, candidate);
    if (existsSync(candidatePath)) {
      continue;
    }
    return candidate;
  }
  return '';
}

function stripBasePath(href, basePath) {
  if (!basePath) return href;
  if (href === basePath) return '/';
  if (href.startsWith(`${basePath}/`)) {
    return href.slice(basePath.length) || '/';
  }
  return href;
}

function pathExists(targetPath) {
  const clean = targetPath.split('#')[0].split('?')[0];
  const candidates = new Set();
  const normalized = clean.replace(/\\+/g, '/');
  candidates.add(normalized);
  if (normalized.endsWith('/')) {
    candidates.add(join(normalized, 'index.html'));
  }
  if (!extname(normalized)) {
    candidates.add(`${normalized}.html`);
    candidates.add(join(normalized, 'index.html'));
  }
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      const stats = statSync(candidate);
      if (stats.isFile()) {
        return true;
      }
      if (stats.isDirectory()) {
        const indexFile = join(candidate, 'index.html');
        if (existsSync(indexFile) && statSync(indexFile).isFile()) {
          return true;
        }
      }
    }
  }
  return false;
}
