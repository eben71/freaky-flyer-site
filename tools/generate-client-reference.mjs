import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const docsDir = path.join(root, 'docs');
const repoUrl = 'https://github.com/eben71/freaky-flyer-site';

const readmePath = path.join(root, 'README.md');
const clientReadmePath = path.join(root, 'README_client.md');
const markdownOutputPath = path.join(docsDir, 'freaky-flyer-reference.md');
const htmlOutputPath = path.join(docsDir, 'freaky-flyer-reference.html');
const pdfOutputPath = path.join(docsDir, 'freaky-flyer-reference.pdf');

const stripFirstHeading = (markdown) =>
  markdown
    .replace(/^\uFEFF?#[^\n]*(?:\r?\n)+/, '')
    .replace(/\r\n/g, '\n')
    .trim();

const cleanMojibake = (markdown) =>
  markdown
    .replace(
      /```\n\/\n[\s\S]*?README_client\.md\n```/,
      `\`\`\`
/
|-- public/
|   |-- assets/
|   |   |-- brand/        # Logos, favicons
|   |   |-- img/          # Optimised site images
|   |   |-- downloads/    # Pricing & schedule PDFs (client-managed)
|   |-- contact.php       # Secure backend form processor
|   |-- robots.txt
|   |-- sitemap-index.xml
|   |-- .htaccess
|
|-- src/
|   |-- components/
|   |-- layouts/
|   |-- pages/
|   |-- content/          # Markdown from WordPress migration
|
|-- tools/
|   |-- wp-export.mjs
|   |-- images.mjs
|   |-- url-map.csv
|
|-- prompts/
|-- README.md
|-- README_client.md
\`\`\``
    )
    .replace(/ðŸš€\s*/g, '')
    .replace(/ðŸ“\s*/g, '')
    .replace(/ðŸ§ª\s*/g, '')
    .replace(/ðŸ”\s*/g, '')
    .replace(/ðŸ“©\s*/g, '')
    .replace(/ðŸ“¦\s*/g, '')
    .replace(/ðŸ§¹\s*/g, '')
    .replace(/ðŸ›¡\s*/g, '')
    .replace(/ðŸ”‘\s*/g, '')
    .replace(/ðŸ“„\s*/g, '')
    .replace(/ðŸ“Š\s*/g, '')
    .replace(/ðŸŽ‰\s*/g, '')
    .replace(/ðŸ› \s*/g, '')
    .replace(/â€“/g, '-')
    .replace(/â€”/g, '-')
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"')
    .replace(/â†’/g, '->')
    .replace(/âœ”/g, '-')
    .replace(/âœ˜/g, '-')
    .replace(/âœ¨\s*/g, '');

const [developerReadme, clientReadme] = await Promise.all([
  fs.readFile(readmePath, 'utf8'),
  fs.readFile(clientReadmePath, 'utf8'),
]);

const generatedDate = new Intl.DateTimeFormat('en-AU', {
  dateStyle: 'long',
  timeZone: 'Australia/Perth',
}).format(new Date());

const combinedMarkdown =
  cleanMojibake(`# Freaky Flyer Delivery Website Reference

Prepared for Freaky Flyer Delivery on ${generatedDate}.

This document combines the developer maintenance guide and the client admin guide into one reference. The GitHub repository is the source of truth for the website code and documentation:

**GitHub repository:** [${repoUrl}](${repoUrl})

## How to Use This Document

- Give the developer section to any website developer who needs to maintain, build, or redeploy the site.
- Use the client section when updating pricing and delivery schedule PDFs through the admin upload area.
- When in doubt, compare this document with the current files in the GitHub repository, because the repository is the authoritative source.

## Developer Maintenance Guide

${stripFirstHeading(developerReadme)}

## Client Admin Guide

${stripFirstHeading(clientReadme)}
`);

marked.setOptions({
  gfm: true,
  headerIds: false,
  mangle: false,
});

const htmlBody = marked.parse(combinedMarkdown);

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Freaky Flyer Delivery Website Reference</title>
    <style>
      @page {
        size: A4;
        margin: 18mm 16mm;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background: #f4f5f7;
        color: #20242c;
        font-family:
          "Segoe UI",
          Arial,
          sans-serif;
        font-size: 11pt;
        line-height: 1.58;
      }

      main {
        max-width: 920px;
        margin: 0 auto;
        background: #ffffff;
        min-height: 100vh;
        padding: 42px 54px 56px;
      }

      h1,
      h2,
      h3 {
        color: #8b1017;
        line-height: 1.2;
      }

      h1 {
        margin: 0 0 10px;
        font-size: 28pt;
        letter-spacing: 0;
      }

      h2 {
        margin: 34px 0 12px;
        padding-top: 8px;
        border-top: 2px solid #eceef2;
        font-size: 17pt;
      }

      h3 {
        margin: 22px 0 8px;
        font-size: 13pt;
      }

      p {
        margin: 0 0 11px;
      }

      a {
        color: #8b1017;
        text-decoration: none;
      }

      ul,
      ol {
        margin: 8px 0 14px 22px;
        padding: 0;
      }

      li {
        margin: 4px 0;
      }

      code {
        background: #f3f4f6;
        border: 1px solid #e2e5ea;
        border-radius: 4px;
        padding: 1px 4px;
        font-family: Consolas, "Courier New", monospace;
        font-size: 0.92em;
      }

      pre {
        margin: 12px 0 18px;
        padding: 13px 15px;
        background: #151922;
        color: #f8fafc;
        border-radius: 8px;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
        page-break-inside: avoid;
      }

      pre code {
        background: transparent;
        border: 0;
        color: inherit;
        padding: 0;
      }

      hr {
        border: 0;
        border-top: 1px solid #eceef2;
        margin: 26px 0;
      }

      strong {
        color: #111827;
      }

      blockquote {
        margin: 14px 0;
        padding: 10px 16px;
        border-left: 4px solid #8b1017;
        background: #faf4f4;
      }

      @media print {
        body {
          background: #ffffff;
        }

        main {
          max-width: none;
          min-height: 0;
          padding: 0;
        }

        h2 {
          break-after: avoid;
        }

        h3,
        pre {
          break-inside: avoid;
        }
      }
    </style>
  </head>
  <body>
    <main>${htmlBody}</main>
  </body>
</html>
`;

await fs.mkdir(docsDir, { recursive: true });
await Promise.all([
  fs.writeFile(markdownOutputPath, combinedMarkdown, 'utf8'),
  fs.writeFile(htmlOutputPath, html, 'utf8'),
]);

console.log(`Wrote ${path.relative(root, markdownOutputPath)}`);
console.log(`Wrote ${path.relative(root, htmlOutputPath)}`);

const pdfString = buildPdf(combinedMarkdown);
await fs.writeFile(pdfOutputPath, pdfString, 'binary');
console.log(`Wrote ${path.relative(root, pdfOutputPath)}`);

function buildPdf(markdown) {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginX = 52;
  const marginY = 52;
  const contentWidth = pageWidth - marginX * 2;
  const pages = [];
  let current = { operations: [], annotations: [] };
  let y = pageHeight - marginY;

  const newPage = () => {
    pages.push(current);
    current = { operations: [], annotations: [] };
    y = pageHeight - marginY;
  };

  const ensureSpace = (height) => {
    if (y - height < marginY) {
      newPage();
    }
  };

  const drawText = ({
    text,
    x = marginX,
    font = 'F1',
    size = 10.5,
    color = [32, 36, 44],
    leading = size * 1.35,
    link = null,
  }) => {
    ensureSpace(leading);
    current.operations.push(
      `BT ${color.map((value) => (value / 255).toFixed(3)).join(' ')} rg /${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${pdfEscape(text)}) Tj ET`
    );
    if (link) {
      current.annotations.push({
        url: link,
        rect: [
          x,
          y - 2,
          x + Math.min(contentWidth, text.length * size * 0.52),
          y + size,
        ],
      });
    }
    y -= leading;
  };

  const drawRule = () => {
    ensureSpace(18);
    current.operations.push(
      `0.925 0.933 0.949 RG 1 w ${marginX} ${y.toFixed(2)} m ${pageWidth - marginX} ${y.toFixed(2)} l S`
    );
    y -= 16;
  };

  const wrap = (text, size, maxWidth = contentWidth, fontFactor = 0.52) => {
    const words = text.split(/\s+/).filter(Boolean);
    const maxChars = Math.max(18, Math.floor(maxWidth / (size * fontFactor)));
    const lines = [];
    let line = '';

    for (const word of words) {
      if ((line ? `${line} ${word}` : word).length <= maxChars) {
        line = line ? `${line} ${word}` : word;
      } else {
        if (line) lines.push(line);
        if (word.length > maxChars) {
          for (let index = 0; index < word.length; index += maxChars) {
            lines.push(word.slice(index, index + maxChars));
          }
          line = '';
        } else {
          line = word;
        }
      }
    }

    if (line) lines.push(line);
    return lines;
  };

  const inlineText = (line) =>
    line
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');

  let inCode = false;
  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trimEnd();

    if (line.startsWith('```')) {
      inCode = !inCode;
      if (!inCode) y -= 4;
      continue;
    }

    if (inCode) {
      for (const wrappedLine of wrap(
        inlineText(line) || ' ',
        8.5,
        contentWidth,
        0.6
      )) {
        drawText({
          text: wrappedLine,
          font: 'F3',
          size: 8.5,
          color: [42, 48, 58],
          leading: 11,
        });
      }
      continue;
    }

    if (!line.trim()) {
      y -= 5;
      continue;
    }

    if (line === '---') {
      drawRule();
      continue;
    }

    if (line.startsWith('# ')) {
      ensureSpace(52);
      drawText({
        text: inlineText(line.slice(2)),
        font: 'F2',
        size: 24,
        color: [139, 16, 23],
        leading: 34,
      });
      drawRule();
      continue;
    }

    if (line.startsWith('## ')) {
      y -= 8;
      ensureSpace(34);
      drawText({
        text: inlineText(line.slice(3)),
        font: 'F2',
        size: 15,
        color: [139, 16, 23],
        leading: 22,
      });
      continue;
    }

    if (line.startsWith('### ')) {
      y -= 3;
      for (const wrappedLine of wrap(inlineText(line.slice(4)), 12.5)) {
        drawText({
          text: wrappedLine,
          font: 'F2',
          size: 12.5,
          color: [139, 16, 23],
          leading: 17,
        });
      }
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.*)$/);
    const numbered = line.match(/^\d+\.\s+(.*)$/);
    if (bullet || numbered) {
      const marker = bullet ? '-' : (line.match(/^\d+\./)?.[0] ?? '-');
      const text = inlineText((bullet || numbered)[1]);
      const indent = 16;
      let first = true;
      for (const wrappedLine of wrap(text, 10.5, contentWidth - indent)) {
        drawText({
          text: first ? `${marker} ${wrappedLine}` : `  ${wrappedLine}`,
          x: marginX + indent,
          size: 10.5,
          leading: 14.5,
        });
        first = false;
      }
      continue;
    }

    const text = inlineText(line);
    const isRepoLine = text.includes(repoUrl);
    for (const wrappedLine of wrap(text, 10.5)) {
      drawText({
        text: wrappedLine,
        size: 10.5,
        leading: 15,
        link: isRepoLine && wrappedLine.includes(repoUrl) ? repoUrl : null,
      });
    }
  }

  pages.push(current);

  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject('placeholder');
  const pagesId = addObject('placeholder');
  const fontRegularId = addObject(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  );
  const fontBoldId = addObject(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'
  );
  const fontMonoId = addObject(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>'
  );
  const pageIds = [];

  for (const page of pages) {
    const annotIds = page.annotations.map((annotation) =>
      addObject(
        `<< /Type /Annot /Subtype /Link /Rect [${annotation.rect.map((value) => value.toFixed(2)).join(' ')}] /Border [0 0 0] /A << /S /URI /URI (${pdfEscape(annotation.url)}) >> >>`
      )
    );
    const content = page.operations.join('\n');
    const contentId = addObject(
      `<< /Length ${Buffer.byteLength(content, 'binary')} >>\nstream\n${content}\nendstream`
    );
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R /F3 ${fontMonoId} 0 R >> >> /Contents ${contentId} 0 R${annotIds.length ? ` /Annots [${annotIds.map((id) => `${id} 0 R`).join(' ')}]` : ''} >>`
    );
    pageIds.push(pageId);
  }

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let output = '%PDF-1.7\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(output, 'binary'));
    output += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(output, 'binary');
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) {
    output += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return output;
}

function pdfEscape(value) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r?\n/g, ' ');
}
