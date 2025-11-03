# Freaky Flyer Delivery – Client Handover Notes

Welcome aboard! This document covers the essentials for updating content and deploying the Astro site.

## Updating Documents & Downloads

- Place the latest PDF price lists or CSV schedules in `public/assets/docs/`.
- Replace the `README.md` placeholder in that folder with the real document (e.g. `ffd-pricelist.pdf`) before launch.
- Update any links in the Markdown content or pages that point to those files so visitors can download the newest version.

## Managing Images

- Brand photography, hero art, and logos go in `public/assets/brand/`.
- Optimised campaign images belong in `public/assets/img/optimized/` (keep originals in `public/assets/img/raw/`).
- Replace the placeholder README files (e.g. under `public/assets/brand/` or `public/assets/img/optimized/contact/`) once the final artwork is exported.
- When replacing an existing image, keep the same filename so the site references stay valid.

## Favicons & App Icons

- Provide `favicon.ico` in the `public/` folder root and upload `icon-192.png` & `icon-512.png` to `public/assets/brand/`.
- Update the artwork but keep the filenames so the manifest and `<link rel="icon">` references continue to work.

## Running the Site Locally

1. Install dependencies with `pnpm install`.
2. Start the dev server with `pnpm dev`.
3. Build for production with `pnpm build`. The output is written to the `dist/` directory.

## Deploying to cPanel

1. Run `pnpm build`.
2. Upload the contents of the `dist/` folder to your hosting account (usually via the cPanel File Manager or SFTP).
3. Ensure `.htaccess`, `robots.txt`, and `sitemap-index.xml` are copied across.

## Phase 3 Preview

A secure admin upload page will be added in Phase 3 for pushing new flyers, price lists, and coverage data without touching the codebase.
