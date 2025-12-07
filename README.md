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

Copy `.env.example` to `.env` and populate it with your local secrets before running
the project. The `.env` file is ignored by git so credentials never enter the repo.

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

## Email configuration (environment variables)

The public email shown across the site and the PHP contact form now read from
environment variables instead of hard-coded addresses.

1. Create a `.env` file locally (or set environment variables in your CI/CD pipeline) before running `pnpm build`:
   - `PUBLIC_CONTACT_EMAIL` – address rendered on the site and structured data.
   - `SITE_NAME` – optional label for email headers (defaults to "Freaky Flyer Delivery").
2. In cPanel, add runtime environment variables so `public/contact.php` can send mail:
   - Open **File Manager** → document root and edit (or create) `.htaccess`.
   - Add lines such as:

     ```
     SetEnv TO_EMAIL "admin@freakyflyerdelivery.com.au"
     SetEnv FROM_EMAIL "no-reply@freakyflyerdelivery.com.au"
     SetEnv SITE_NAME "Freaky Flyer Delivery"
     ```

   These values are read with `getenv()` at runtime, so no code changes are required per host.
3. Deploy the freshly built `dist/` folder via File Manager or SFTP.
4. Submit a test enquiry from `/contact` to verify the email reaches the inbox configured in `TO_EMAIL`.

## Secrets and environment variables

All runtime settings are loaded through `config/app_config.php`, which reads from
environment variables so credentials are never hard-coded. Keep `config/app_config.php`
as the single place for defaults and load secrets from the environment.

### Local development

Copy `.env.example` to `.env` and fill in values:

- `PUBLIC_CONTACT_EMAIL` / `SITE_NAME` – exposed to the Astro build for site metadata.
- `PUBLIC_BASE_PATH` – optional path prefix (e.g., `/newsite`) if the site is served from a subdirectory.
- `TO_EMAIL` / `FROM_EMAIL` – used by the PHP contact form and admin mail test (also used as a fallback for `PUBLIC_CONTACT_EMAIL`).
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` – required to log into `/admin`.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` – SMTP credentials if the host requires authenticated mail.

### cPanel (.htaccess) runtime configuration

Set the same variables on the server so no credentials live in the codebase:

```
SetEnv PUBLIC_CONTACT_EMAIL "admin@example.com"
SetEnv SITE_NAME "Freaky Flyer Delivery"
SetEnv TO_EMAIL "admin@example.com"
SetEnv FROM_EMAIL "no-reply@example.com"
SetEnv ADMIN_USERNAME "admin-user"
SetEnv ADMIN_PASSWORD "change-me"
SetEnv SMTP_HOST "mail.example.com"
SetEnv SMTP_PORT "465"
SetEnv SMTP_SECURE "true"
SetEnv SMTP_USER "admin@example.com"
SetEnv SMTP_PASS "your-smtp-password"
```

Update these values directly in cPanel (or your deployment pipeline) instead of
committing them. For other hosts, configure the same variables via their runtime
environment UI or process manager.

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
