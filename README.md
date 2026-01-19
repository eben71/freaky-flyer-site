# Freaky Flyer Delivery – Astro Static Site (Developer Guide)

A modernised static rebuild of the Freaky Flyer Delivery website using **Astro**, with a secure PHP backend for form submission and admin-upload features.

This document is the authoritative technical reference for building, maintaining, and redeploying the project.

## 🚀 Tech Stack

- Astro 5+
- HTML/CSS custom design system
- PHP 8.1+ backend for form submission + admin uploads
- pnpm dependency management
- Image optimisation workflow (Sharp pipeline)

## 📁 Project Structure

```
/
├── public/
│   ├── assets/
│   │   ├── brand/        # Logos, favicons
│   │   ├── img/          # Optimised site images
│   │   ├── downloads/    # Pricing & schedule PDFs (client-managed)
│   ├── contact.php       # Secure backend form processor
│   ├── robots.txt
│   ├── sitemap-index.xml
│   ├── .htaccess
│
├── src/
│   ├── components/
│   ├── layouts/
│   ├── pages/
│   ├── content/          # Markdown from WordPress migration
│
├── tools/
│   ├── wp-export.mjs
│   ├── images.mjs
│   ├── url-map.csv
│
├── prompts/
├── README.md
└── README_client.md
```

## 🧪 Local Development

```
pnpm install
pnpm dev
```

## 🔐 Environment Variables

These are used locally via `.env` and in production via `.htaccess`:

```
PUBLIC_CONTACT_EMAIL=
SITE_NAME="Freaky Flyer Delivery"

TO_EMAIL=
FROM_EMAIL=

ADMIN_USERNAME=
ADMIN_PASSWORD=

PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
PUBLIC_TURNSTILE_DEBUG=false
TURNSTILE_BYPASS=false
CF_WEB_ANALYTICS_TOKEN=

SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_SECURE=true
```

`PUBLIC_TURNSTILE_SITE_KEY` is baked into the Astro build, so set it in `.env` locally and in your build environment for production. `TURNSTILE_BYPASS` should stay `false` in production.

## 📩 Contact Form Security

- Honeypot
- Server-side validation
- Sanitisation
- PHP-based email handling
- Optional Turnstile (enabled post-launch once Cloudflare is active)

## ✨ Formatting

Run Prettier before committing to keep CI green:

```
pnpm format
```

## 📦 Build & Deploy

```
pnpm build
```

Upload the contents of `/dist` to the **root public_html directory**.

Ensure:

- `.htaccess` is present. If the secrets has already been set remove .htaccess from the 'dist' folder before uploading and replacing the file.
- `contact.php` is uploaded
- permissions allow PHP execution

## 🧹 Image Workflow

Raw → tools/images/raw  
Optimised → public/assets/img

```
pnpm images
```

## 🛡 Cloudflare Configuration

Use Cloudflare to manage DNS, SSL, security, and analytics:

1. **DNS / Nameservers**: Point the domain to Cloudflare and confirm records match the live origin.
2. **SSL/TLS**: Set mode to **Full (Strict)** and keep the origin certificate valid.
3. **Web Analytics**: Enable Web Analytics for the zone to track traffic without adding cookies.
4. **Turnstile**: Add `PUBLIC_TURNSTILE_SITE_KEY` (frontend) and `TURNSTILE_SECRET_KEY` (server) values to `.htaccess`.
5. **Analytics token**: Add `CF_WEB_ANALYTICS_TOKEN` in `.htaccess` to inject the beacon.
6. **Security rules**: Enable bot protections and rate limits as needed.
7. **Caching**: Avoid caching `/admin` and `contact.php` while allowing static asset caching.

See `docs/cloudflare-onboarding.md` for the step-by-step checklist.

This README contains everything needed to fully rebuild the project.
