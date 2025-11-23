<?php
// Admin authentication and upload configuration for Freaky Flyer Delivery.
// NOTE: Change the username and password before deploying to production.
// This file is located outside the public web root to prevent direct access.

return [
    'ADMIN_USERNAME' => 'CHANGE_ME_ADMIN_USERNAME', // TODO: Replace with a strong username before going live.
    'ADMIN_PASSWORD' => 'CHANGE_ME_STRONG_PASSWORD', // TODO: Replace with a strong password before going live.
    'MAX_FILE_SIZE_BYTES' => 10 * 1024 * 1024, // 10 MB
    'UPLOAD_ROOT' => dirname(__DIR__) . '/public/downloads',
];
