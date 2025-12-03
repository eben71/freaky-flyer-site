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

`pnpm dev` now starts both the Astro dev server (port 4321) and a PHP built-in server
for the `/admin` tools (default proxy target `http://127.0.0.1:9400`). PHP 8.1+ must
be installed locally. Use `ADMIN_DEV_PHP_HOST` and/or `ADMIN_DEV_PHP_PORT` to override
the PHP server binding. If you only want the Astro dev server, run `pnpm dev:astro`.

### Admin credentials

Admin authentication credentials are loaded from environment variables so that secrets
are not committed to the repository. Create a local `.env` file with values for
`ADMIN_USERNAME` and `ADMIN_PASSWORD`, and configure the same variables in your
hosting environment or deployment pipeline for production.

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
- Raw images → `tools/images/raw/...`
- Optimized images → `public/assets/img/...`
- Downloads → `public/downloads/`
