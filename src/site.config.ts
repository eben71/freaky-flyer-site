import { withBase } from './lib/base';

const contactEmail =
  import.meta.env.PUBLIC_CONTACT_EMAIL?.trim() ||
  import.meta.env.TO_EMAIL?.trim() ||
  'freakyflyerbookings@gmail.com';

const siteName = import.meta.env.SITE_NAME?.trim() || 'Freaky Flyer Delivery';
const siteUrl =
  import.meta.env.PUBLIC_SITE_URL?.replace(/\/+$/, '') ||
  'https://freakyflyerdelivery.com.au';

export const site = {
  name: siteName,
  domain: siteUrl,
  phone: '(08) 9405 7777',
  email: contactEmail,
  address: '96 Nicholas Rd, Wanneroo WA 6065',
  hours: 'Mon–Thu 8:00am–3:00pm, Fri 8:00am–2:00pm',
  defaultDescription:
    'GPS-verified flyer distribution across the Perth metro area. Family-owned. Reliable. Accountable.',
  ogImage: withBase('/assets/brand/og-default.jpg'),
} as const;
