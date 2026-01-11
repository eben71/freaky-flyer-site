<?php
// Compatible with older PHP versions (no short array syntax)
$env = function ($key, $default = '') {
    static $loaded = false;
    static $fileVars = array();
    if (!$loaded) {
        $envFile = dirname(__DIR__, 2) . '/.env';
        if (is_readable($envFile)) {
            $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            if ($lines !== false) {
                foreach ($lines as $line) {
                    if (strpos(trim($line), '#') === 0 || strpos($line, '=') === false) {
                        continue;
                    }
                    $parts = explode('=', $line, 2);
                    if (count($parts) === 2) {
                        $k = $parts[0];
                        $v = $parts[1];
                        $fileVars[trim($k)] = trim($v, " \t\n\r\0\x0B\"'");
                    }
                }
            }
        }
        $loaded = true;
    }

    $value = getenv($key);
    if ($value === false && isset($_ENV[$key])) {
        $value = $_ENV[$key];
    }
    if (($value === false || $value === null || $value === '') && isset($fileVars[$key])) {
        $value = $fileVars[$key];
    }
    $value = is_string($value) ? trim($value) : '';
    return $value !== '' ? $value : $default;
};

$defaults = array(
    'admin_username' => 'change-me',
    'admin_password' => 'change-me',
    'max_file_size_bytes' => 10 * 1024 * 1024,
    'upload_root' => dirname(__DIR__) . '/downloads',
    'site_name' => 'Freaky Flyer Delivery',
    'contact_email' => 'freakyflyerbookings@gmail.com',
    'from_email' => 'freakyflyerbookings@gmail.com',
);

$basePath = '';
$basePathEnv = $env('PUBLIC_BASE_PATH', $env('BASE_PATH', ''));
if ($basePathEnv !== '') {
    $basePath = '/' . trim($basePathEnv, '/');
}

if ($basePath === '') {
    $candidatePath = isset($_SERVER['SCRIPT_NAME']) && $_SERVER['SCRIPT_NAME'] !== ''
        ? $_SERVER['SCRIPT_NAME']
        : (isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '');
    if ($candidatePath !== '') {
        $basePath = preg_replace('#/admin(/.*)?$#', '', $candidatePath);
        if ($basePath === '/' || $basePath === false) {
            $basePath = '';
        }
    }
}

$configPath = __DIR__ . '/../../config/app_config.php';
$site = $admin = $uploads = array();

if (is_readable($configPath)) {
    $app = require $configPath;
    if (is_array($app)) {
        $site = isset($app['site']) && is_array($app['site']) ? $app['site'] : array();
        $admin = isset($app['admin']) && is_array($app['admin']) ? $app['admin'] : array();
        $uploads = isset($app['uploads']) && is_array($app['uploads']) ? $app['uploads'] : array();
    }
}

$adminUsername = $env(
    'ADMIN_USERNAME',
    isset($admin['username']) ? $admin['username'] : $defaults['admin_username']
);
$adminPassword = $env(
    'ADMIN_PASSWORD',
    isset($admin['password']) ? $admin['password'] : $defaults['admin_password']
);
$uploadRoot = isset($uploads['root']) ? $uploads['root'] : $defaults['upload_root'];
$maxFileSizeBytes = isset($uploads['max_file_size_bytes'])
    ? (int) $uploads['max_file_size_bytes']
    : (int) $defaults['max_file_size_bytes'];

return array(
    'ADMIN_USERNAME' => $adminUsername,
    'ADMIN_PASSWORD' => $adminPassword,
    'MAX_FILE_SIZE_BYTES' => $maxFileSizeBytes,
    'UPLOAD_ROOT' => $uploadRoot,
    'SITE_NAME' => isset($site['name'])
        ? $site['name']
        : $env('SITE_NAME', $defaults['site_name']),
    'CONTACT_EMAIL' => isset($site['contact_email'])
        ? $site['contact_email']
        : $env('TO_EMAIL', $defaults['contact_email']),
    'FROM_EMAIL' => isset($site['from_email'])
        ? $site['from_email']
        : $env('FROM_EMAIL', $defaults['from_email']),
    'BASE_PATH' => $basePath,
);
