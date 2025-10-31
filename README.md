# Freaky Flyer Delivery (Phase 1)

Static marketing site for Freaky Flyer Delivery built with Astro.

## Stack

- Astro v4+
- HTML, CSS, JavaScript (no frameworks yet)
- pnpm for dependency management

## Getting Started

```bash
pnpm install
pnpm dev
```

> **Note**
> When new tooling dependencies are added, run `pnpm install --no-frozen-lockfile` to refresh `pnpm-lock.yaml` locally before relying on cached installs.

Visit http://localhost:4321 to view the site.

## Pages

- `/` – GPS-verified flyer delivery overview with hero and value highlights

## Build

```bash
pnpm build
```

## Deployment

1. Build locally with `pnpm build`.
2. Upload the contents of `dist/` to the TPP Wholesale cPanel document root via File Manager or SFTP.

## Directory Overview

```
/
├── public/        # Static assets copied as-is
├── src/           # Astro components, pages, styles, scripts
├── infra/deploy/  # Deployment helper scripts (disabled placeholders)
├── prompts/       # Project specifications and briefs
└── README.md
```

## Tooling

- Prettier configured with two-space indentation and single quotes.
- ESLint with Astro recommended rules.

## Content Migration

Preferred (WordPress REST):

```bash
WP_BASE=https://freakyflyerdelivery.com.au pnpm export:wp
```

Fallback (scrape public HTML):

```bash
BASE_URL=https://freakyflyerdelivery.com.au pnpm export:html
```

Optimize images and relink:

```bash
pnpm images
```

Build redirects from mapping:

```bash
pnpm redirects
```

Outputs:

- Markdown pages → `src/content/pages/*.md`
- Raw images → `public/assets/img/raw/...`
- Optimized images → `public/assets/img/optimized/...`
- Downloads → `public/downloads/`
