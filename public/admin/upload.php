<?php
session_start();

$config = require __DIR__ . '/../../config/admin_config.php';

// ADMIN PASSWORD:
// - This value MUST be changed before going live.
// - The client should store the final password in their password manager.
// - To rotate the password, edit this value and redeploy.
// - Do not commit real production passwords to version control.
$ADMIN_PASSWORD = $config['ADMIN_PASSWORD'];

$MAX_FILE_SIZE_BYTES = $config['MAX_FILE_SIZE_BYTES'];
$UPLOAD_ROOT = $config['UPLOAD_ROOT'];

function respond_with_message(string $title, string $message, int $statusCode = 400): void
{
    http_response_code($statusCode);
    $statusClass = $statusCode >= 200 && $statusCode < 300 ? 'status-success' : 'status-error';
    echo "<!DOCTYPE html>
<html lang=\"en\">
<head>
  <meta charset=\"UTF-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
  <title>{$title}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 32px 16px;
      font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
      background: radial-gradient(circle at top, #eef2ff, #f8fafc);
      color: #0f172a;
      min-height: 100vh;
      display: grid;
      place-items: center;
    }
    .card {
      width: min(640px, 100%);
      background: #fff;
      border-radius: 20px;
      padding: 32px;
      box-shadow: 0 25px 70px rgba(15, 23, 42, 0.12);
      display: grid;
      gap: 16px;
    }
    .pill {
      justify-self: start;
      font-size: 0.85rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 6px 14px;
      border-radius: 999px;
    }
    .status-success {
      background: rgba(5, 150, 105, 0.12);
      color: #047857;
    }
    .status-error {
      background: rgba(239, 68, 68, 0.12);
      color: #b91c1c;
    }
    h1 { margin: 0; font-size: clamp(1.5rem, 2vw, 2rem); }
    p { margin: 0; line-height: 1.6; color: #475569; }
    a.button-link {
      justify-self: start;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 22px;
      border-radius: 999px;
      background: linear-gradient(135deg, #0ea5e9, #6366f1);
      color: #fff;
      text-decoration: none;
      font-weight: 600;
      box-shadow: 0 18px 35px rgba(79, 70, 229, 0.3);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    a.button-link:hover {
      transform: translateY(-1px);
      box-shadow: 0 25px 45px rgba(79, 70, 229, 0.35);
    }
  </style>
</head>
<body>
  <div class=\"card\">
    <span class=\"pill {$statusClass}\">" . ($statusClass === 'status-success' ? 'Success' : 'Status') . "</span>
    <h1>{$title}</h1>
    <p>{$message}</p>
    <a class=\"button-link\" href=\"/admin/\">Back to admin uploads</a>
  </div>
</body>
</html>";
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond_with_message('Invalid request', 'Uploads must be sent via POST.', 405);
}

if (empty($_SESSION['admin_logged_in'])) {
    respond_with_message('Access denied', 'You must be logged in to upload files.', 403);
}

$providedPassword = $_SESSION['admin_password'] ?? '';
if ($providedPassword !== $ADMIN_PASSWORD) {
    http_response_code(403);
    echo '<p>Access denied. Incorrect admin password.</p>';
    exit;
}

if (!is_dir($UPLOAD_ROOT)) {
    if (!mkdir($UPLOAD_ROOT, 0755, true) && !is_dir($UPLOAD_ROOT)) {
        respond_with_message('Server error', 'Unable to prepare the upload directory.', 500);
    }
}

$docType = $_POST['doc_type'] ?? '';
$allowedDocTypes = ['pricing', 'schedule'];
if (!in_array($docType, $allowedDocTypes, true)) {
    respond_with_message('Invalid document type', 'Please choose either pricing or schedule.', 400);
}

if (!isset($_FILES['pdf_file']) || !is_array($_FILES['pdf_file'])) {
    respond_with_message('Upload error', 'No file was uploaded. Please try again.', 400);
}

$fileError = $_FILES['pdf_file']['error'] ?? UPLOAD_ERR_NO_FILE;
if ($fileError !== UPLOAD_ERR_OK) {
    respond_with_message('Upload error', 'There was an error uploading the file. Please try again.', 400);
}

$fileSize = $_FILES['pdf_file']['size'] ?? 0;
if ($fileSize > $MAX_FILE_SIZE_BYTES) {
    respond_with_message('File too large', 'The uploaded file exceeds the 10 MB limit.', 400);
}

$tmpPath = $_FILES['pdf_file']['tmp_name'] ?? '';
if (!is_uploaded_file($tmpPath)) {
    respond_with_message('Upload error', 'The uploaded file could not be validated.', 400);
}

// Validate MIME type and extension
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mimeType = $finfo->file($tmpPath);
$originalName = $_FILES['pdf_file']['name'] ?? '';
$extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));

if ($mimeType !== 'application/pdf' || $extension !== 'pdf') {
    respond_with_message('Invalid file type', 'Only PDF uploads are accepted.', 400);
}

// Ensure archive directory exists
$archiveDir = $UPLOAD_ROOT . '/archived';
if (!is_dir($archiveDir)) {
    if (!mkdir($archiveDir, 0755, true) && !is_dir($archiveDir)) {
        respond_with_message('Server error', 'Unable to create the archive directory.', 500);
    }
}

$timestamp = date('Ymd-His');
$timestampedName = $docType . '-' . $timestamp . '.pdf';
$targetPathTimestamped = $archiveDir . '/' . $timestampedName;

if (!move_uploaded_file($tmpPath, $targetPathTimestamped)) {
    respond_with_message('Upload error', 'Failed to save the uploaded file.', 500);
}

$canonicalName = $docType . '.pdf';
$canonicalPath = $UPLOAD_ROOT . '/' . $canonicalName;
$canonicalUrl = '/downloads/' . $canonicalName;

$canonicalUpdated = copy($targetPathTimestamped, $canonicalPath);

// Trim old timestamped files to keep only the latest three
$files = glob($archiveDir . '/' . $docType . '-*.pdf');
usort($files, function ($a, $b) {
    return filemtime($b) <=> filemtime($a);
});

$filesToDelete = array_slice($files, 3);
foreach ($filesToDelete as $oldFile) {
    @unlink($oldFile);
}

if (!$canonicalUpdated) {
    respond_with_message(
        'Upload saved with warning',
        'The file was saved, but the canonical link could not be updated. Please try again or contact support.',
        500
    );
}

respond_with_message(
    'Upload successful',
    sprintf(
        'The %s document was uploaded successfully at %s. Public URL: <a href="%s">%s</a>.',
        htmlspecialchars($docType, ENT_QUOTES, 'UTF-8'),
        htmlspecialchars($timestamp, ENT_QUOTES, 'UTF-8'),
        htmlspecialchars($canonicalUrl, ENT_QUOTES, 'UTF-8'),
        htmlspecialchars($canonicalUrl, ENT_QUOTES, 'UTF-8')
    ),
    200
);
