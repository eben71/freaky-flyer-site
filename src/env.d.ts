/// <reference types="astro/client" />

declare interface ImportMetaEnv {
  readonly PUBLIC_CONTACT_EMAIL?: string;
  readonly TO_EMAIL?: string;
  readonly SITE_NAME?: string;
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}
