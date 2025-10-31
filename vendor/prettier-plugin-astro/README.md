# Prettier Plugin Astro (Offline Stub)

This local package provides a minimal Prettier plugin so that the Freaky Flyer site can run installs without downloading the official `prettier-plugin-astro` package. The plugin behaves as a no-op formatter for `.astro` files by returning the original source text.

If full Astro formatting capabilities are required, replace this stub with the upstream plugin by removing the override in the root `package.json` and running `pnpm install` in an environment with registry access.
