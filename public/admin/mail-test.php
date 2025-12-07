<?php
$config = require __DIR__ . '/../../config/app_config.php';

$toAddress = $config['site']['contact_email'] ?: $config['site']['from_email'];
$subject = sprintf('%s Mail Test', $config['site']['name']);
$message = 'This is a test email from the server.';

$sent = mail($toAddress, $subject, $message);
echo $sent ? 'Mail sent OK' : 'Mail failed';
