<?php
// Central configuration loader for Freaky Flyer Delivery.
// All sensitive values are read from environment variables so no secrets are
// committed to the repository. Defaults are kept here to avoid duplication.

if (!function_exists('ffd_env')) {
    /**
     * Read an environment variable with trimming and a fallback.
     */
    function ffd_env($key, $default = null)
    {
        $value = getenv($key);
        if ($value === false && isset($_ENV[$key])) {
            $value = $_ENV[$key];
        }

        $value = is_string($value) ? trim($value) : '';

        if ($value !== '') {
            return $value;
        }

        return $default !== null ? $default : '';
    }
}

if (!function_exists('ffd_resolve_client_ip')) {
    /**
     * Resolve client IP with Cloudflare and proxy headers in mind.
     */
    function ffd_resolve_client_ip()
    {
        $cfConnectingIp = isset($_SERVER['HTTP_CF_CONNECTING_IP']) ? trim($_SERVER['HTTP_CF_CONNECTING_IP']) : '';
        if ($cfConnectingIp && filter_var($cfConnectingIp, FILTER_VALIDATE_IP)) {
            return $cfConnectingIp;
        }

        $forwardedFor = isset($_SERVER['HTTP_X_FORWARDED_FOR']) ? trim($_SERVER['HTTP_X_FORWARDED_FOR']) : '';
        if ($forwardedFor !== '') {
            $parts = array_map('trim', explode(',', $forwardedFor));
            $firstIp = $parts ? $parts[0] : '';
            if ($firstIp && filter_var($firstIp, FILTER_VALIDATE_IP)) {
                return $firstIp;
            }
        }

        return isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '';
    }
}

$defaults = [
    'site_name' => 'Freaky Flyer Delivery',
    'contact_email' => 'freakyflyerbookings@gmail.com',
    'from_email' => 'freakyflyerbookings@gmail.com',
];

return [
    'site' => [
        // Preferred source for the public contact email. Falls back to TO_EMAIL
        // so PHP-only environments can use the same value without duplication.
        'contact_email' => ffd_env('PUBLIC_CONTACT_EMAIL', ffd_env('TO_EMAIL', $defaults['contact_email'])),
        'from_email' => ffd_env('FROM_EMAIL', $defaults['from_email']),
        'name' => ffd_env('SITE_NAME', $defaults['site_name']),
    ],
    'admin' => [
        'username' => ffd_env('ADMIN_USERNAME', 'change-me'),
        'password' => ffd_env('ADMIN_PASSWORD', 'change-me'),
    ],
    'uploads' => [
        'max_file_size_bytes' => 10 * 1024 * 1024, // 10 MB
        'root' => dirname(__DIR__) . '/public/downloads',
    ],
    'smtp' => [
        'host' => ffd_env('SMTP_HOST', ''),
        'port' => ffd_env('SMTP_PORT', ''),
        'secure' => ffd_env('SMTP_SECURE', ''),
        'user' => ffd_env('SMTP_USER', ''),
        'password' => ffd_env('SMTP_PASS', ''),
    ],
];
