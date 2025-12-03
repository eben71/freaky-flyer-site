<?php
// Admin authentication and upload configuration for Freaky Flyer Delivery.
// NOTE: Change the username and password before deploying to production.
// This file is located outside the public web root to prevent direct access.

return [
    // Credentials are pulled from environment variables so secrets are never
    // committed to the repository. Set these in your local `.env` file or on
    // the server environment (e.g., via hosting control panel or deploy
    // tooling).
    'ADMIN_USERNAME' => getenv('ADMIN_USERNAME') ?: 'change-me',
    'ADMIN_PASSWORD' => getenv('ADMIN_PASSWORD') ?: 'change-me',
    'MAX_FILE_SIZE_BYTES' => 10 * 1024 * 1024, // 10 MB
    'UPLOAD_ROOT' => dirname(__DIR__) . '/public/downloads',
];
