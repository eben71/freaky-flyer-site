<?php
// Admin upload tool for Freaky Flyer Delivery
// IMPORTANT: Change the admin password below before deploying to production.

$ADMIN_PASSWORD = 'CHANGE_ME_STRONG_PASSWORD'; // TODO: Replace with a strong password before going live.
$MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
$UPLOAD_ROOT = __DIR__ . '/../downloads';

function respond_with_message(string $title, string $message, int $statusCode = 400): void
{
    http_response_code($statusCode);
    echo "<!DOCTYPE html>
<html lang=\"en\">
<head>
  <meta charset=\"UTF-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
  <title>{$title}</title>
  <style>
    body { font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif; background: #f8fafc; color: #1f2933; padding: 32px; }
    .card { max-width: 640px; margin: 0 auto; background: #fff; padding: 24px; border-radius: 12px; box-shadow: 0 12px 32px rgba(0,0,0,0.08); }
    h1 { margin-top: 0; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <div class=\"card\">
    <h1>{$title}</h1>
    <p>{$message}</p>
    <p><a href=\"/admin/\">Return to admin uploads</a></p>
  </div>
</body>
</html>";
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond_with_message('Invalid request', 'Uploads must be sent via POST.', 405);
}

$providedPassword = $_POST['admin_password'] ?? '';
if (!$providedPassword || $providedPassword !== $ADMIN_PASSWORD) {
    respond_with_message('Access denied', 'The admin password was incorrect or missing.', 403);
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

// Ensure directories exist
$targetDir = $UPLOAD_ROOT . '/' . $docType;
if (!is_dir($targetDir)) {
    if (!mkdir($targetDir, 0755, true) && !is_dir($targetDir)) {
        respond_with_message('Server error', 'Unable to create the target directory.', 500);
    }
}

$timestamp = date('Ymd-His');
$timestampedName = $docType . '-' . $timestamp . '.pdf';
$targetPathTimestamped = $targetDir . '/' . $timestampedName;

if (!move_uploaded_file($tmpPath, $targetPathTimestamped)) {
    respond_with_message('Upload error', 'Failed to save the uploaded file.', 500);
}

$canonicalName = $docType . '.pdf';
$canonicalPath = $UPLOAD_ROOT . '/' . $canonicalName;
$canonicalUrl = '/downloads/' . $canonicalName;

$canonicalUpdated = copy($targetPathTimestamped, $canonicalPath);

// Trim old timestamped files to keep only the latest three
$files = glob($targetDir . '/' . $docType . '-*.pdf');
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
