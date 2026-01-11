<?php
$configPath = __DIR__ . '/../config/app_config.php';

$env = function ($key, $default = '') {
    $value = getenv($key);
    if ($value === false && isset($_ENV[$key])) {
        $value = $_ENV[$key];
    }
    $value = is_string($value) ? trim($value) : '';
    return $value !== '' ? $value : $default;
};

$defaults = [
    'site_name' => 'Freaky Flyer Delivery',
    'contact_email' => 'freakyflyerbookings@gmail.com',
    'from_email' => 'freakyflyerbookings@gmail.com',
];

$siteConfig = [
    'contact_email' => $env('PUBLIC_CONTACT_EMAIL', $env('TO_EMAIL', $defaults['contact_email'])),
    'from_email' => $env('FROM_EMAIL', $defaults['from_email']),
    'name' => $env('SITE_NAME', $defaults['site_name']),
];

if (is_readable($configPath)) {
    $config = require $configPath;
    if (is_array($config) && isset($config['site']) && is_array($config['site'])) {
        $siteConfig = array_merge($siteConfig, array_filter($config['site']));
    }
}

$RECIPIENT_EMAIL = isset($siteConfig['contact_email']) ? $siteConfig['contact_email'] : '';
$FROM_EMAIL = isset($siteConfig['from_email']) ? $siteConfig['from_email'] : '';
$SITE_NAME = isset($siteConfig['name']) ? $siteConfig['name'] : $defaults['site_name'];
$acceptsJson = isset($_SERVER['HTTP_ACCEPT']) && stripos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false;
$debug = strtolower($env('DEBUG_CONTACT', '')) === 'true' || $env('DEBUG_CONTACT', '') === '1';
$envSnapshot = [
    'recipient_email' => $RECIPIENT_EMAIL ?: '[empty]',
    'from_email' => $FROM_EMAIL ?: '[empty]',
    'site_name' => $SITE_NAME ?: '[empty]',
    'script' => isset($_SERVER['SCRIPT_FILENAME']) ? $_SERVER['SCRIPT_FILENAME'] : '[unknown]',
    'debug_contact' => $debug ? 'true' : 'false',
    'turnstile_secret_present' => $env('TURNSTILE_SECRET_KEY', '') !== '' ? 'true' : 'false',
];

function render_response($content, $status = 200, $success = null, $debugData = null)
{
    global $acceptsJson, $debug;
    http_response_code($status);
    $ok = $success !== null ? $success : ($status >= 200 && $status < 300);
    if ($acceptsJson) {
        header('Content-Type: application/json');
        $response = [
            'message' => strip_tags($content),
            'status' => $status,
            'success' => $ok,
        ];
        if ($debug && $debugData) {
            $response['debug'] = $debugData;
        }
        echo json_encode($response) ?: '';
    } else {
        echo '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Contact us</title></head><body>';
        echo $content;
        echo '</body></html>';
    }
    exit;
}

function render_turnstile_failure($debugData = null)
{
    global $acceptsJson;
    http_response_code(400);
    $payload = ['ok' => false, 'error' => 'Turnstile verification failed'];
    if ($debugData !== null) {
        $payload['debug'] = $debugData;
    }
    if ($acceptsJson) {
        header('Content-Type: application/json');
        echo json_encode($payload) ?: '';
    } else {
        echo '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Contact us</title></head><body>';
        echo '<p>Turnstile verification failed. Please try again.</p>';
        echo '</body></html>';
    }
    exit;
}

function verify_turnstile_token($secret, $token, $remoteIp = '')
{
    $postData = http_build_query([
        'secret' => $secret,
        'response' => $token,
        'remoteip' => $remoteIp,
    ]);
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-type: application/x-www-form-urlencoded\r\n",
            'content' => $postData,
            'timeout' => 10,
        ],
    ]);
    $result = @file_get_contents('https://challenges.cloudflare.com/turnstile/v0/siteverify', false, $context);
    if ($result === false) {
        return null;
    }
    $decoded = json_decode($result, true);
    return is_array($decoded) ? $decoded : null;
}

function log_issue($message)
{
    $candidates = [
        __DIR__ . '/contact-error.log',
        dirname(__DIR__) . '/contact-error.log',
        sys_get_temp_dir() . '/contact-error.log',
    ];
    $timestamp = date('c');
    $line = "[{$timestamp}] {$message}\n";
    foreach ($candidates as $target) {
        $result = @file_put_contents($target, $line, FILE_APPEND);
        if ($result !== false) {
            return;
        }
    }
    // Fall back to PHP error log.
    error_log($line);
}

set_error_handler(function ($errno, $errstr, $errfile, $errline) use ($debug, $envSnapshot) {
    // Respect @-silenced errors.
    if (error_reporting() === 0) {
        return false;
    }
    $message = "PHP error {$errno} at {$errfile}:{$errline} - {$errstr}";
    log_issue($message);
    if ($debug) {
        $extra = $envSnapshot;
        $extra['error'] = $message;
        // We don't output here to avoid partial responses; shutdown handler will catch fatals.
    }
    return false;
});

register_shutdown_function(function () use ($acceptsJson, $debug, $envSnapshot) {
    $error = error_get_last();
    if (!$error || !in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR, E_RECOVERABLE_ERROR], true)) {
        return;
    }
    $message = "Fatal error {$error['type']} at {$error['file']}:{$error['line']} - {$error['message']}";
    log_issue($message);
    if (headers_sent()) {
        return;
    }
    http_response_code(500);
    $payload = [
        'message' => 'Contact form error. Please try again later.',
        'success' => false,
        'status' => 500,
    ];
    if ($debug) {
        $payload['debug'] = array_merge($envSnapshot, ['error' => $message]);
    }
    if ($acceptsJson) {
        header('Content-Type: application/json');
        echo json_encode($payload) ?: '';
    } else {
        echo '<!DOCTYPE html><html lang="en"><body><p>' . htmlentities($payload['message']) . '</p></body></html>';
    }
});

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    render_response('<p>Invalid request method.</p>', 405);
}

$honeypot = isset($_POST['website']) ? $_POST['website'] : '';
if (trim($honeypot) !== '') {
    render_response('<p>Thank you for your enquiry. If required, we will contact you shortly.</p>');
}

$startedAt = isset($_POST['form_started_at']) ? (int) $_POST['form_started_at'] : 0;
$now = (int) (microtime(true) * 1000);
$deltaMs = $now - $startedAt;
$turnstileSecretKey = $env('TURNSTILE_SECRET_KEY', '');
$turnstileResponseToken = isset($_POST['cf-turnstile-response']) ? trim($_POST['cf-turnstile-response']) : '';
$requestIp = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '';

if ($startedAt > 0 && $deltaMs > 0 && $deltaMs < 2000) {
    render_response('<p>Thank you for your enquiry. If required, we will contact you shortly.</p>');
}

$firstName = trim(isset($_POST['firstName']) ? $_POST['firstName'] : '');
$lastName = trim(isset($_POST['lastName']) ? $_POST['lastName'] : '');
$email = filter_var(isset($_POST['email']) ? $_POST['email'] : '', FILTER_SANITIZE_EMAIL);
$phone = trim(isset($_POST['phone']) ? $_POST['phone'] : '');
$message = trim(isset($_POST['message']) ? $_POST['message'] : '');
$street = trim(isset($_POST['street']) ? $_POST['street'] : '');
$city = trim(isset($_POST['city']) ? $_POST['city'] : '');
$state = trim(isset($_POST['state']) ? $_POST['state'] : '');
$postcode = trim(isset($_POST['postcode']) ? $_POST['postcode'] : '');

if ($debug) {
    log_issue('Config snapshot: recipient=' . $envSnapshot['recipient_email'] . ', from=' . $envSnapshot['from_email'] . ', site=' . $envSnapshot['site_name']);
}

if ($firstName === '' || $lastName === '' || $email === '' || $phone === '' || $message === '') {
    render_response('<p>Please complete the required fields and try again.</p>', 400, null, $debug ? $envSnapshot : null);
}

if ($turnstileSecretKey === '' || $turnstileResponseToken === '') {
    log_issue('Turnstile verification missing token or secret.');
    render_turnstile_failure($debug ? $envSnapshot : null);
}

$turnstileResult = verify_turnstile_token($turnstileSecretKey, $turnstileResponseToken, $requestIp);
if (!is_array($turnstileResult) || empty($turnstileResult['success'])) {
    $debugData = $debug ? array_merge($envSnapshot, ['turnstile' => $turnstileResult]) : null;
    render_turnstile_failure($debugData);
}

if ($RECIPIENT_EMAIL === '' || $FROM_EMAIL === '') {
    log_issue('Invalid contact form email configuration.');
    render_response(
        '<p>The contact form is not configured correctly. Please try again later.</p>',
        200,
        false,
        $debug ? $envSnapshot : null
    );
}

$recipientEmail = filter_var($RECIPIENT_EMAIL, FILTER_VALIDATE_EMAIL);
$fromEmail = filter_var($FROM_EMAIL, FILTER_VALIDATE_EMAIL);

if ($recipientEmail === false || $fromEmail === false) {
    log_issue('Invalid contact form email configuration.');
    render_response(
        '<p>The contact form is not configured correctly. Please try again later.</p>',
        200,
        false,
        $debug ? $envSnapshot : null
    );
}

$addressParts = array_filter([$street, $city, $state, $postcode]);
$address = $addressParts ? implode(', ', $addressParts) : 'Not provided';

$subject = "New contact form submission from {$SITE_NAME}";
$body = "Name: {$firstName} {$lastName}\n" .
    "Email: {$email}\n" .
    "Phone: {$phone}\n" .
    "Address: {$address}\n" .
    "Message:\n{$message}\n\n" .
    'Submitted at: ' . date('c');

$headers = [
    'From' => "{$SITE_NAME} <{$fromEmail}>",
    'Reply-To' => $email,
    'Content-Type' => 'text/plain; charset=UTF-8',
];

// IMPORTANT:
// - Configure the email addresses with environment variables:
//   - TO_EMAIL: recipient inbox for enquiries.
//   - FROM_EMAIL: authenticated "from" address for the server.
//   - SITE_NAME: optional, defaults to "Freaky Flyer Delivery".

$formattedHeaders = '';
foreach ($headers as $key => $value) {
    $formattedHeaders .= $key . ': ' . $value . "\r\n";
}

if (!mail($recipientEmail, $subject, $body, $formattedHeaders)) {
    log_issue('mail() returned false for contact form submission.');
    render_response(
        '<p>We could not send your message right now. Please try again or call us.</p>',
        200,
        false,
        $debug ? $envSnapshot : null
    );
}

render_response(
    '<p>Thank you for your enquiry. If required, we will contact you shortly.</p>',
    200,
    true,
    $debug ? $envSnapshot : null
);
