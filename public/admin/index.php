<?php
session_start();

$config = require __DIR__ . '/../../config/admin_config.php';

$isLoggedIn = !empty($_SESSION['admin_logged_in']);
$authError = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'login') {
    $username = $_POST['admin_username'] ?? '';
    $password = $_POST['admin_password'] ?? '';

    if ($username === $config['ADMIN_USERNAME'] && $password === $config['ADMIN_PASSWORD']) {
        session_regenerate_id(true);
        $_SESSION['admin_logged_in'] = true;
        $_SESSION['admin_username'] = $username;
        header('Location: /admin/');
        exit;
    }

    $authError = 'Incorrect username or password. Please try again.';
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Freaky Flyer Delivery – Admin Uploads</title>
  <style>
    :root {
      color-scheme: light;
    }

    body {
      font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
      background: #f6f7fb;
      color: #1f2933;
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 32px;
    }

    .card {
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
      max-width: 760px;
      width: min(100%, 760px);
      padding: 32px;
      display: grid;
      gap: 24px;
    }

    h1 {
      margin: 0;
      font-size: 1.8rem;
    }

    p {
      margin: 0;
      line-height: 1.6;
      color: #3c4856;
    }

    form {
      display: grid;
      gap: 16px;
    }

    label {
      font-weight: 600;
      display: block;
      margin-bottom: 6px;
      color: #1f2933;
    }

    input,
    select,
    button {
      font: inherit;
    }

    input,
    select {
      width: 100%;
      padding: 12px;
      border: 1px solid #d3d7df;
      border-radius: 10px;
      background: #fff;
      transition: border-color 0.2s ease;
    }

    input:focus,
    select:focus {
      outline: none;
      border-color: #5c6ac4;
      box-shadow: 0 0 0 3px rgba(92, 106, 196, 0.15);
    }

    button[type="submit"],
    .logout-link {
      justify-self: start;
      background: linear-gradient(135deg, #0ea5e9, #6366f1);
      color: #fff;
      padding: 12px 24px;
      border: none;
      border-radius: 999px;
      cursor: pointer;
      font-weight: 700;
      letter-spacing: 0.02em;
      transition: transform 0.15s ease, box-shadow 0.2s ease;
      box-shadow: 0 12px 24px rgba(99, 102, 241, 0.25);
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    button[type="submit"]:hover,
    .logout-link:hover {
      transform: translateY(-1px);
      box-shadow: 0 16px 30px rgba(99, 102, 241, 0.28);
    }

    .note {
      font-size: 0.95rem;
      color: #52606d;
    }

    .links {
      border-top: 1px solid #e4e7ec;
      padding-top: 12px;
    }

    .links code {
      background: #eef2ff;
      padding: 2px 6px;
      border-radius: 6px;
      color: #4338ca;
    }

    .error {
      color: #b42318;
      background: #fee4e2;
      border: 1px solid #fda29b;
      padding: 12px 16px;
      border-radius: 10px;
    }

    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .actions {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }
  </style>
</head>
<body>
  <main class="card" aria-labelledby="page-title">
    <div class="header-row">
      <div>
        <h1 id="page-title">Freaky Flyer Delivery – Admin Uploads</h1>
        <p>This secure area allows internal staff to upload the latest Pricing and Schedule PDFs for the public site.</p>
      </div>
      <?php if ($isLoggedIn): ?>
        <div class="actions">
          <span class="note">Logged in as <strong><?php echo htmlspecialchars($_SESSION['admin_username'] ?? ''); ?></strong></span>
          <a class="logout-link" href="/admin/logout.php">Logout</a>
        </div>
      <?php endif; ?>
    </div>

    <?php if (!$isLoggedIn): ?>
      <?php if ($authError): ?>
        <div class="error" role="alert"><?php echo htmlspecialchars($authError); ?></div>
      <?php endif; ?>
      <form method="POST" action="/admin/">
        <input type="hidden" name="action" value="login" />
        <div>
          <label for="admin_username">Admin username</label>
          <input type="text" name="admin_username" id="admin_username" autocomplete="username" required />
        </div>
        <div>
          <label for="admin_password">Admin password</label>
          <input type="password" name="admin_password" id="admin_password" autocomplete="current-password" required />
          <p class="note">Ask your web developer for the admin credentials.</p>
        </div>
        <button type="submit">Login</button>
      </form>
    <?php else: ?>
      <form method="POST" action="/admin/upload.php" enctype="multipart/form-data">
        <div>
          <label for="doc_type">Document type</label>
          <select name="doc_type" id="doc_type" required>
            <option value="">Select a document</option>
            <option value="pricing">Pricing</option>
            <option value="schedule">Delivery Schedule</option>
          </select>
        </div>

        <div>
          <label for="pdf_file">PDF file</label>
          <input type="file" name="pdf_file" id="pdf_file" accept="application/pdf" required />
          <p class="note">Maximum file size: <?php echo number_format($config['MAX_FILE_SIZE_BYTES'] / (1024 * 1024), 1); ?> MB.</p>
        </div>

        <button type="submit">Upload PDF</button>
      </form>
    <?php endif; ?>

  </main>
</body>
</html>
