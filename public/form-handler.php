<?php
declare(strict_types=1);

use PHPMailer\PHPMailer\Exception;
use PHPMailer\PHPMailer\PHPMailer;

header('Content-Type: application/json');

require_once __DIR__ . '/vendor/phpmailer-lite/PHPMailerLite.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$rateDir = __DIR__ . '/storage';
if (!is_dir($rateDir)) {
    mkdir($rateDir, 0755, true);
}

$clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateFile = $rateDir . '/' . preg_replace('/[^a-z0-9]/i', '_', $clientIp) . '.json';
$now = time();
$windowSeconds = 1800; // 30 minutes
$maxAttempts = 3;
$state = ['count' => 0, 'reset' => $now + $windowSeconds];

if (file_exists($rateFile)) {
    $stored = json_decode((string) file_get_contents($rateFile), true);
    if (is_array($stored) && isset($stored['count'], $stored['reset'])) {
        if ($stored['reset'] > $now) {
            $state = $stored;
        }
    }
}

if ($state['reset'] <= $now) {
    $state = ['count' => 0, 'reset' => $now + $windowSeconds];
}

if ($state['count'] >= $maxAttempts) {
    http_response_code(429);
    echo json_encode(['ok' => false, 'error' => 'Too many requests. Please try again later.']);
    exit;
}

$inputs = filter_input_array(INPUT_POST, [
    'name' => FILTER_SANITIZE_FULL_SPECIAL_CHARS,
    'email' => FILTER_SANITIZE_EMAIL,
    'phone' => FILTER_SANITIZE_FULL_SPECIAL_CHARS,
    'company' => FILTER_SANITIZE_FULL_SPECIAL_CHARS,
    'flyerSize' => FILTER_SANITIZE_FULL_SPECIAL_CHARS,
    'quantity' => FILTER_SANITIZE_FULL_SPECIAL_CHARS,
    'suburbs' => FILTER_UNSAFE_RAW,
    'timing' => FILTER_SANITIZE_FULL_SPECIAL_CHARS,
    'notes' => FILTER_UNSAFE_RAW,
    'consent' => FILTER_SANITIZE_FULL_SPECIAL_CHARS,
    '_honey' => FILTER_UNSAFE_RAW,
]);

if (!empty($inputs['_honey'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Spam detected.']);
    exit;
}

$name = trim((string) ($inputs['name'] ?? ''));
$email = trim((string) ($inputs['email'] ?? ''));
$phone = trim((string) ($inputs['phone'] ?? ''));
$company = trim((string) ($inputs['company'] ?? ''));
$flyerSize = strtoupper(trim((string) ($inputs['flyerSize'] ?? '')));
$quantity = trim((string) ($inputs['quantity'] ?? ''));
$suburbs = trim((string) ($inputs['suburbs'] ?? ''));
$timing = trim((string) ($inputs['timing'] ?? ''));
$notes = trim((string) ($inputs['notes'] ?? ''));
$consent = (string) ($inputs['consent'] ?? '');

$errors = [];
if ($name === '') {
    $errors[] = 'Name is required.';
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'A valid email is required.';
}
if ($phone === '' || !preg_match('/^[0-9\s()+-]{6,}$/', $phone)) {
    $errors[] = 'A valid phone number is required.';
}
$allowedSizes = ['DL', 'A5', 'A4'];
if (!in_array($flyerSize, $allowedSizes, true)) {
    $errors[] = 'Please select a flyer size.';
}
if ($consent !== 'on') {
    $errors[] = 'Consent is required to submit the form.';
}

if ($errors) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => implode(' ', $errors)]);
    exit;
}

$state['count']++;
file_put_contents($rateFile, json_encode($state));

$env = static function (string $key, string $fallback): string {
    $value = getenv($key);
    if ($value === false || $value === '') {
        return $fallback;
    }
    return $value;
};

$smtpHost = $env('SMTP_HOST', 'TODO_SMTP_HOST');
$smtpUser = $env('SMTP_USER', 'TODO_SMTP_USER');
$smtpPass = $env('SMTP_PASS', 'TODO_SMTP_PASS');
$smtpPort = (int) $env('SMTP_PORT', '587');
$fromEmail = $env('FROM_EMAIL', 'no-reply@freakyflyerdelivery.com.au');
$fromName = $env('FROM_NAME', 'Freaky Flyer Delivery');
$toEmail = $env('TO_EMAIL', 'quotes@freakyflyerdelivery.com.au');

$messageLines = [
    'New Freaky Flyer Delivery quote enquiry',
    '----------------------------------------',
    'Name: ' . $name,
    'Email: ' . $email,
    'Phone: ' . $phone,
    'Company: ' . ($company !== '' ? $company : 'N/A'),
    'Flyer size: ' . $flyerSize,
    'Quantity tier: ' . ($quantity !== '' ? $quantity : 'N/A'),
    'Timing: ' . ($timing !== '' ? $timing : 'N/A'),
    'Target suburbs:',
    $suburbs !== '' ? $suburbs : 'N/A',
    'Notes:',
    $notes !== '' ? $notes : 'N/A',
];

$body = implode("\n", $messageLines);

try {
    $mailer = new PHPMailer();
    $mailer->isSMTP();
    $mailer->Host = $smtpHost;
    $mailer->Port = $smtpPort > 0 ? $smtpPort : 587;
    $mailer->SMTPAuth = true;
    $mailer->Username = $smtpUser;
    $mailer->Password = $smtpPass;
    $mailer->SMTPSecure = 'tls';
    $mailer->setFrom($fromEmail, $fromName);
    $mailer->addAddress($toEmail, 'Freaky Flyer Delivery Sales');
    $mailer->addReplyTo($email, $name);
    $mailer->Subject = 'New quote request from ' . $name;
    $mailer->Body = $body;
    $mailer->AltBody = $body;

    if (!$mailer->send()) {
        throw new Exception('Mailer send() returned false');
    }

    echo json_encode(['ok' => true]);
} catch (Exception $exception) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'Unable to send email. Please call us directly.',
    ]);
}
