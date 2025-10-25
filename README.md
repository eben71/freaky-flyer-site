# Freaky Flyer Delivery marketing site

Production-ready static marketing website for Freaky Flyer Delivery built with [Astro](https://astro.build/) and minimal vanilla enhancements.

## Requirements

- Node.js 18+
- pnpm 8+

## Getting started

```bash
pnpm install
pnpm dev
```

The development server runs at `http://localhost:4321`.

## Quality scripts

```bash
pnpm lint
pnpm build
pnpm preview
```

Prettier is configured via `pnpm format`.

## Project structure

```
/
├── public/
│   ├── assets/
│   │   ├── img/
│   │   └── maps/
│   ├── form-handler.php
│   └── *.static assets copied to dist/
├── src/
│   ├── components/
│   ├── layouts/
│   ├── pages/
│   ├── scripts/
│   └── styles/
├── astro.config.mjs
├── package.json
└── README.md
```

## GPS tracking viewer

The `/gps-tracking` page initialises Leaflet and fetches `/assets/maps/sample.geojson` by default. Users can upload `.geojson`, `.gpx` or `.kml` files, which are converted client-side via the [togeojson](https://github.com/mapbox/togeojson) UMD bundle. No tracking data is sent to a server.

## Quote form

The contact form posts to `/form-handler.php` and expects JSON responses. Client-side validation prevents incomplete submissions and the submit button is disabled while the request is pending.

Server-side handling is powered by a lightweight PHPMailer-compatible SMTP client located at `public/vendor/phpmailer-lite/PHPMailerLite.php`. Update the SMTP credentials before deploying.

Environment variables are read when present:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `FROM_EMAIL`
- `FROM_NAME`
- `TO_EMAIL`

When variables are missing, placeholder values prefixed with `TODO_` are used. Replace these before launch or configure them in cPanel's PHP environment manager.

## Deploying to cPanel

1. Run a production build locally:
   ```bash
   pnpm install
   pnpm build
   ```
2. The static output is generated in `dist/`.
3. Upload the **contents** of `dist/` to your cPanel document root using File Manager or SFTP.
4. Ensure the following files exist in the document root after upload:
   - `.htaccess`
   - `form-handler.php`
   - `assets/` directory with map + image assets
5. Set your SMTP credentials via environment variables in cPanel, or edit the placeholders in `public/form-handler.php`.

### Email deliverability checklist

- **SPF:** add an SPF TXT record referencing your SMTP host (e.g. `v=spf1 include:mail.yourhost.com ~all`).
- **DKIM:** enable DKIM within your cPanel account for the sending domain.
- **DMARC:** publish a DMARC record such as `v=DMARC1; p=quarantine; rua=mailto:postmaster@yourdomain.com.au`.
- Send a test quote submission and confirm it lands in the inbox. Adjust the `FROM_EMAIL` to a domain-aligned address if needed.

## Lighthouse targets

Pages are optimised for ≥95 scores in Performance, Best Practices and SEO. Images are lazy-loaded, scripts are deferred, and CSS is consolidated in `src/styles/globals.css`.

## Accessibility & SEO

- Semantic landmarks with skip link support
- Accessible navigation with keyboard-friendly mobile menu
- All pages have unique titles, descriptions and heading hierarchy
- Breadcrumb component provides contextual navigation
- JSON-LD structured data for LocalBusiness, Service and FAQ content

## Notes

- The PHP rate limiter stores counters in `public/storage/`. The `.gitignore` inside the directory keeps the folder empty in Git.
- Update `.htaccess` domain placeholders before go-live (`freakyflyerdelivery.com.au`).
- Analytics placeholders are commented out in `BaseLayout.astro` – swap in GA4 or Plausible when ready.
