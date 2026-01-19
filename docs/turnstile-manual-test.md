# Turnstile Manual Test

## Setup

1. Set `PUBLIC_TURNSTILE_SITE_KEY` in `.env` (build-time) and `TURNSTILE_SECRET_KEY` for PHP.
2. Rebuild/redeploy the site so the frontend has the public key.

## Widget check (Chrome DevTools)

1. Open `/contact` and inspect the form.
2. Confirm a `.cf-turnstile` element exists inside the `<form>`.

## Token payload check

1. Submit the form once.
2. In Network > `contact.php`, confirm the request payload includes `cf-turnstile-response` with a non-empty value.

## Server acceptance check

1. Confirm the response is JSON with `ok: true` or `success: true`.
2. Confirm the email is delivered (cPanel mail logs or inbox).

## If it fails

- Cloudflare Turnstile: confirm the widget site key matches the domain and is not in "bot fight" or "managed" modes blocking execution.
- cPanel/PHP: confirm `TURNSTILE_SECRET_KEY` is set and `contact-error.log` has a "Turnstile verification failed" entry with error codes.
