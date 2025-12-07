/// <reference types="astro/client" />

declare interface ImportMetaEnv {
  readonly PUBLIC_CONTACT_EMAIL?: string;
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}
