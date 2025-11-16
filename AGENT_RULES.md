# Agent Rules (for Codex)

1. READ-ONLY PATHS
   - Treat the following directories as read-only:
     - `public/`
     - `assets/`
     - `static/`
     - `dist/`
   - Never add, modify, delete, or rename files in these directories.

2. BINARY FILE TYPES
   - Never add, modify, or delete:
     - `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.pdf`
     - `.woff`, `.woff2`, `.ttf`, `.mp4`, `.zip`
   - If a new asset is required, add a TODO comment and reference the expected path.

3. TEXT-ONLY CHANGES
   - Only edit text/code files: `.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `.css`, `.scss`, `.md`, `.yaml`, `.yml`.

4. SCOPE LIMITS
   - Limit any single task to:
     - ≤ 10 files changed
     - ≤ 300 lines of diff
   - If more is needed, stop and request a follow-up task and provide the prompt details for the follow-up task.
