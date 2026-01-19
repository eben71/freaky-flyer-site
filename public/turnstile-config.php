<?php
$env = function ($key, $default = '') {
    $value = getenv($key);
    if ($value === false && isset($_ENV[$key])) {
        $value = $_ENV[$key];
    }
    $value = is_string($value) ? trim($value) : '';
    return $value !== '' ? $value : $default;
};

$siteKey = $env('PUBLIC_TURNSTILE_SITE_KEY', '');

if (!headers_sent()) {
    header('Content-Type: application/json');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
}

echo json_encode([
    'siteKey' => $siteKey,
]) ?: '';
