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

TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_SECURE=true
```

## 📩 Contact Form Security

- Honeypot
- Server-side validation
- Sanitisation
- PHP-based email handling
- Optional Turnstile (enabled post-launch once Cloudflare is active)

## 📦 Build & Deploy

```
pnpm build
```

Upload the contents of `/dist` to the **root public_html directory**.

Ensure:

- `.htaccess` is present
- `contact.php` is uploaded
- permissions allow PHP execution

## 🧹 Image Workflow

Raw → tools/images/raw  
Optimised → public/assets/img

```
pnpm images
```

## 🛡 Cloudflare Onboarding (Post-Launch Only)

Once Astro replaces WordPress:

1. Switch nameservers
2. SSL Full (Strict)
3. Enable Web Analytics
4. Add Turnstile keys to `.htaccess`
5. Add bot security rules
6. Validate form + caching

## 🚀 Launch Workflow Summary

1. Finalise QA
2. Remove WordPress from root
3. Deploy Astro to root
4. Test site
5. Enable Cloudflare
6. Enable Turnstile
7. Monitor analytics + bot traffic

This README contains everything needed to fully rebuild the project.
