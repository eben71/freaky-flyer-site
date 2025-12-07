<?php
// Admin authentication and upload configuration for Freaky Flyer Delivery.
// NOTE: Change the username and password before deploying to production.
// This file is located outside the public web root to prevent direct access.

$config = require __DIR__ . '/app_config.php';

return [
    'ADMIN_USERNAME' => $config['admin']['username'],
    'ADMIN_PASSWORD' => $config['admin']['password'],
    'MAX_FILE_SIZE_BYTES' => $config['uploads']['max_file_size_bytes'],
    'UPLOAD_ROOT' => $config['uploads']['root'],
];
