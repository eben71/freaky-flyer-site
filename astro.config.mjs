import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://www.freakyflyerdelivery.com.au",
  integrations: [],
  output: "static",
  scopedStyleStrategy: "where",
  vite: {
    build: {
      sourcemap: false
    }
  }
});
