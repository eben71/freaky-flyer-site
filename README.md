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
