const contactEmail =
  import.meta.env.PUBLIC_CONTACT_EMAIL?.trim() ||
  'admin@freakyflyerdelivery.com.au';

export const site = {
  name: 'Freaky Flyer Delivery',
  domain: 'https://freakyflyerdelivery.com.au',
  phone: '(08) 9405 7777',
  email: contactEmail,
  address: '96 Nicholas Rd, Wanneroo WA 6065',
  hours: 'Mon–Fri 7:00am–3:30pm',
  defaultDescription:
    'GPS-verified flyer distribution across the Perth metro area. Family-owned. Reliable. Accountable.',
  ogImage: '/assets/brand/og-default.jpg',
} as const;
