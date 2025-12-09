# Freaky Flyer Delivery – Client Guide

Welcome!  
This document explains how to update your pricing/schedule files, manage images, and understand the launch & security features.

## 📄 Updating Pricing or Schedule PDFs

1. Log into cPanel
2. Browse to:

```
/public_html/assets/downloads/
```

3. Upload the new file using **the same filename**  
   The website will automatically use the latest version.

## 🖼 Updating Images

Use these folders:

| Folder         | Purpose                 |
| -------------- | ----------------------- |
| /assets/brand/ | Logos & identity images |
| /assets/img/   | Site images             |

Replacing an image with the same filename updates it instantly.

## ✉ Contact Form Behaviour

- Protected from bots via honeypot
- Server-side validation
- Email routing configurable via `.htaccess`

Update your receiving email address here:

```
SetEnv TO_EMAIL "admin@freakyflyerdelivery.com.au"
```

## 🌍 Launch Flow

Once you approve the new site:

1. WordPress is removed
2. The new site goes live
3. Cloudflare is enabled for:
   - Performance
   - Bot protection
   - Web analytics

## 🛡 Optional Enhancements

After launch, you may enable:

### Cloudflare Web Analytics

Shows real visitor and bot traffic.

### Cloudflare Turnstile

Invisible spam protection upgrade.

### Cloudflare Caching & CDN

Makes the site even faster.

## 📞 Need Help?

If you need assistance with images, text updates, email routing, Cloudflare, or security features—just ask.
