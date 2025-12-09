// scripts/test-turnstile.mjs
// Simple Node script to test Cloudflare Turnstile verification locally.
//
// Usage:
//   node scripts/test-turnstile.mjs <token-from-browser>
//
// Steps:
// 1. Load your site with the contact form.
// 2. Open DevTools → Network tab.
// 3. Submit the form (with Turnstile active).
// 4. Copy the `cf-turnstile-response` value from the request payload.
// 5. Run this script with that token as an argument.

import 'dotenv/config'; // requires `npm i dotenv` if not already present

const secretKey = process.env.TURNSTILE_SECRET_KEY;
const tokenFromBrowser = process.argv[2];

if (!secretKey) {
  console.error('ERROR: TURNSTILE_SECRET_KEY is not set in the environment.');
  process.exit(1);
}

if (!tokenFromBrowser) {
  console.error(
    'Usage: node tools/test-turnstile.mjs <cf-turnstile-response-token>'
  );
  process.exit(1);
}

async function verifyToken() {
  try {
    const res = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: secretKey,
          response: tokenFromBrowser,
        }),
      }
    );

    const data = await res.json();
    console.log('Turnstile verification response:');
    console.dir(data, { depth: null });

    if (data.success) {
      console.log('✅ Token is valid. Turnstile verification passed.');
    } else {
      console.log('❌ Token is invalid or verification failed.');
    }
  } catch (err) {
    console.error('Error verifying Turnstile token:', err);
    process.exit(1);
  }
}

verifyToken();
