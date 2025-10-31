import path from 'path';
import { promises as fs } from 'fs';
import fg from 'fast-glob';
import sharp from 'sharp';
import matter from 'gray-matter';
import { createLogger, ensureDir, unique, writeText } from './lib/io.mjs';

const logger = createLogger('images');

const rawDir = path.resolve(
  process.cwd(),
  process.env.RAW_DIR || 'public/assets/img/raw'
);
const optimizedDir = path.resolve(
  process.cwd(),
  process.env.OPTIMIZED_DIR || 'public/assets/img/optimized'
);
const markdownDir = path.resolve(
  process.cwd(),
  process.env.MARKDOWN_DIR || 'src/content/pages'
);

const TARGET_SIZES = [640, 960, 1280];
const DEFAULT_SIZE = 960;

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

async function optimizeImage(file) {
  const relative = path.relative(rawDir, file);
  const parsed = path.parse(relative);
  const source = path.join(rawDir, relative);
  const outputDir = path.join(optimizedDir, parsed.dir);
  await ensureDir(outputDir);

  const baseName = parsed.name;

  for (const size of TARGET_SIZES) {
    const outputName = `${baseName}-${size}.webp`;
    const outputPath = path.join(outputDir, outputName);
    const outputExists = await fs
      .access(outputPath)
      .then(() => true)
      .catch(() => false);
    if (!outputExists) {
      await sharp(source)
        .resize({ width: size, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(outputPath);
    }
  }

  const relativeDir = toPosix(parsed.dir || '');
  const publicOptimized = `/assets/img/optimized/${relativeDir ? `${relativeDir}/` : ''}${baseName}-${DEFAULT_SIZE}.webp`;
  const publicRaw = `/assets/img/raw/${relativeDir ? `${relativeDir}/` : ''}${parsed.base}`;

  return {
    raw: publicRaw,
    optimizedDefault: publicOptimized,
  };
}

async function optimizeAllImages() {
  const pattern = toPosix(
    path.relative(
      process.cwd(),
      path.join(rawDir, '**/*.{jpg,jpeg,png,gif,webp,avif}')
    )
  );
  const files = await fg(pattern, { dot: false, onlyFiles: true });
  const mapping = new Map();

  for (const file of files) {
    const absolute = path.resolve(process.cwd(), file);
    const result = await optimizeImage(absolute);
    mapping.set(result.raw, result.optimizedDefault);
    logger.info(`Optimized ${result.raw} -> ${result.optimizedDefault}`);
  }

  return mapping;
}

function collectImageRefs(content) {
  const matches = new Set();
  const markdownRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
  const htmlRegex = /<img[^>]+src=["']([^"']+)["']/g;
  let match;
  while ((match = markdownRegex.exec(content)) !== null) {
    matches.add(match[1]);
  }
  while ((match = htmlRegex.exec(content)) !== null) {
    matches.add(match[1]);
  }
  return Array.from(matches);
}

function ensureComment(content) {
  const comment =
    '<!-- Optimized images generated; wire up srcset in components when ready. -->';
  if (content.includes(comment)) {
    return content;
  }
  return `${content}\n\n${comment}\n`;
}

async function updateMarkdownFiles(mapping) {
  const pattern = toPosix(
    path.relative(process.cwd(), path.join(markdownDir, '**/*.md'))
  );
  const files = await fg(pattern, { dot: false, onlyFiles: true });
  let updatedCount = 0;

  for (const file of files) {
    const filePath = path.resolve(process.cwd(), file);
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = matter(raw);
    let { content } = parsed;

    for (const [rawPath, optimizedPath] of mapping.entries()) {
      const escaped = escapeRegExp(rawPath);
      const mdRegex = new RegExp(`(!\\[[^\\]]*\\]\\()${escaped}(\\))`, 'g');
      const htmlRegex = new RegExp(`(<img[^>]+src=["'])${escaped}(["'])`, 'g');
      const replacedContent = content
        .replace(mdRegex, `$1${optimizedPath}$2`)
        .replace(htmlRegex, `$1${optimizedPath}$2`);
      content = replacedContent;
    }

    const imageRefs = collectImageRefs(content).filter((ref) =>
      ref.startsWith('/assets/img/optimized/')
    );
    const imagesField = unique(imageRefs);
    let changed = false;

    if (
      imagesField.length !==
        (parsed.data.images ? parsed.data.images.length : 0) ||
      imagesField.some((value, index) => parsed.data.images?.[index] !== value)
    ) {
      parsed.data.images = imagesField;
      changed = true;
    }

    if (content !== parsed.content) {
      parsed.content = content;
      changed = true;
    }

    if (imagesField.length > 0) {
      const nextContent = ensureComment(parsed.content);
      if (nextContent !== parsed.content) {
        parsed.content = nextContent;
        changed = true;
      }
    }

    if (changed) {
      const output = matter.stringify(parsed.content, parsed.data);
      await writeText(filePath, `${output}\n`);
      updatedCount += 1;
      logger.info(`Updated ${path.relative(process.cwd(), filePath)}`);
    }
  }

  return updatedCount;
}

(async function run() {
  logger.info('Optimizing images...');
  await ensureDir(rawDir);
  await ensureDir(optimizedDir);

  try {
    const mapping = await optimizeAllImages();
    const updated = await updateMarkdownFiles(mapping);
    logger.info(
      `Optimization complete. ${mapping.size} images processed. ${updated} markdown files updated.`
    );
  } catch (error) {
    logger.error('Image optimization failed:', error.message);
    process.exitCode = 1;
  }
})();
