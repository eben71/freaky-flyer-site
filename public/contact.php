<?php
$RECIPIENT_EMAIL = 'eben.venter@gmail.com';
$SITE_NAME = 'Freaky Flyer Delivery';
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
    'From' => "{$SITE_NAME} <no-reply@freakyflyerdelivery.com.au>",
    'Reply-To' => $email,
    'Content-Type' => 'text/plain; charset=UTF-8',
];

// IMPORTANT:
// - During development, the contact form may be wired to the developer's email.
// - Before launch, ensure all contact emails are switched to admin@freakyflyerdelivery.com.au.

$formattedHeaders = '';
foreach ($headers as $key => $value) {
    $formattedHeaders .= $key . ': ' . $value . "\r\n";
}

if (!mail($RECIPIENT_EMAIL, $subject, $body, $formattedHeaders)) {
    render_response('<p>We could not send your message right now. Please try again or call us.</p>', 500);
}

render_response('<p>Thank you for your enquiry. If required, we will contact you shortly.</p>');
