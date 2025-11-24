<?php
// Admin authentication and upload configuration for Freaky Flyer Delivery.
// NOTE: Change the username and password before deploying to production.
// This file is located outside the public web root to prevent direct access.

return [
    'ADMIN_USERNAME' => 'NW01FFD', 
    'ADMIN_PASSWORD' => 'Tuesday181211', // TODO: Replace with a strong password before going live.
    'MAX_FILE_SIZE_BYTES' => 10 * 1024 * 1024, // 10 MB
    'UPLOAD_ROOT' => dirname(__DIR__) . '/public/downloads',
];
