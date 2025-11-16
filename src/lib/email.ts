import { site } from '../site.config';

export const contactEmail = site.email;

export const getEmailParts = (email: string = contactEmail) => {
  const [user = '', domain = ''] = email.split('@');
  return { user, domain } as const;
};

export const contactEmailParts = getEmailParts();
