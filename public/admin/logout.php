<?php
session_start();

$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
}

session_destroy();
$config = require __DIR__ . '/config.php';
$basePath = isset($config['BASE_PATH']) ? rtrim($config['BASE_PATH'], '/') : '';
$adminRootWithSlash = ($basePath . '/admin') . '/';
header('Location: ' . $adminRootWithSlash);
exit;
