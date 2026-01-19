# Cloudflare Onboarding Checklist

Use this checklist to onboard the site to Cloudflare with minimal redeploys.

## 1) Nameserver cutover

1. Add the domain to Cloudflare and review imported DNS records.
2. Update the registrar to Cloudflare-assigned nameservers.
3. Verify A/AAAA/CNAME records match the origin host.

## 2) SSL configuration (recommended)

- Set **SSL/TLS mode** to **Full (Strict)**.
- Install or renew a valid origin certificate.
- Enable “Always Use HTTPS” once the origin is ready.

## 3) WAF + bot rules

- Block WordPress probes:
  - `/wp-login.php`
  - `/wp-admin/`
  - `/xmlrpc.php`
- Add rate limits to `/contact.php` and `/admin/*` if needed.

## 4) Turnstile setup (optional until launch)

1. Create a Turnstile widget in Cloudflare.
2. Set the keys in `.htaccess`:

   ```apache
   SetEnv PUBLIC_TURNSTILE_SITE_KEY "your-site-key"
   SetEnv TURNSTILE_SECRET_KEY "your-secret-key"
   ```

3. Deploy and confirm the contact form submits successfully.

## 5) Web Analytics enablement

1. Create a Web Analytics site in Cloudflare.
2. Add the token to `.htaccess`:

   ```apache
   SetEnv CF_WEB_ANALYTICS_TOKEN "your-analytics-token"
   ```

3. Deploy and confirm analytics events flow in the dashboard.

## 6) Post-launch checks

- Submit the contact form end-to-end and confirm email delivery.
- Verify `/contact.php` and `/admin/*` responses are not cached.
- Validate HTTPS redirects and HSTS (if enabled).
- Run a quick smoke test on top pages and key CTAs.
