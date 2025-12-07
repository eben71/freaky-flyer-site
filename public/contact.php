<?php
$configPath = __DIR__ . '/../config/app_config.php';

$env = function (string $key, string $default = ''): string {
    $value = getenv($key);
    if ($value === false && isset($_ENV[$key])) {
        $value = $_ENV[$key];
    }
    $value = is_string($value) ? trim($value) : '';
    return $value !== '' ? $value : $default;
};

$defaults = [
    'site_name' => 'Freaky Flyer Delivery',
    'contact_email' => 'admin@freakyflyerdelivery.com.au',
    'from_email' => 'no-reply@freakyflyerdelivery.com.au',
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

$RECIPIENT_EMAIL = $siteConfig['contact_email'] ?? '';
$FROM_EMAIL = $siteConfig['from_email'] ?? '';
$SITE_NAME = $siteConfig['name'] ?? $defaults['site_name'];
$acceptsJson = isset($_SERVER['HTTP_ACCEPT']) && stripos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false;

function render_response(string $content, int $status = 200): void
{
    global $acceptsJson;
    http_response_code($status);
    if ($acceptsJson) {
        header('Content-Type: application/json');
        echo json_encode([
            'message' => strip_tags($content),
            'status' => $status,
            'success' => $status >= 200 && $status < 300,
        ]) ?: '';
    } else {
        echo '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Contact us</title></head><body>';
        echo $content;
        echo '</body></html>';
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    render_response('<p>Invalid request method.</p>', 405);
}

$honeypot = $_POST['website'] ?? '';
if (trim($honeypot) !== '') {
    render_response('<p>Thank you for your enquiry. If required, we will contact you shortly.</p>');
}

$startedAt = isset($_POST['form_started_at']) ? (int) $_POST['form_started_at'] : 0;
$now = (int) (microtime(true) * 1000);
$deltaMs = $now - $startedAt;

if ($startedAt > 0 && $deltaMs > 0 && $deltaMs < 2000) {
    render_response('<p>Thank you for your enquiry. If required, we will contact you shortly.</p>');
}

$firstName = trim($_POST['firstName'] ?? '');
$lastName = trim($_POST['lastName'] ?? '');
$email = filter_var($_POST['email'] ?? '', FILTER_SANITIZE_EMAIL);
$phone = trim($_POST['phone'] ?? '');
$message = trim($_POST['message'] ?? '');
$street = trim($_POST['street'] ?? '');
$city = trim($_POST['city'] ?? '');
$state = trim($_POST['state'] ?? '');
$postcode = trim($_POST['postcode'] ?? '');

if ($firstName === '' || $lastName === '' || $email === '' || $phone === '' || $message === '') {
    render_response('<p>Please complete the required fields and try again.</p>', 400);
}

if ($RECIPIENT_EMAIL === '' || $FROM_EMAIL === '') {
    render_response('<p>The contact form is not configured correctly. Please try again later.</p>', 500);
}

$recipientEmail = filter_var($RECIPIENT_EMAIL, FILTER_VALIDATE_EMAIL);
$fromEmail = filter_var($FROM_EMAIL, FILTER_VALIDATE_EMAIL);

if ($recipientEmail === false || $fromEmail === false) {
    render_response('<p>The contact form is not configured correctly. Please try again later.</p>', 500);
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
    render_response('<p>We could not send your message right now. Please try again or call us.</p>', 500);
}

render_response('<p>Thank you for your enquiry. If required, we will contact you shortly.</p>');
