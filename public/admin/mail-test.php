<?php
$config = require __DIR__ . '/config.php';

$toAddress = $config['CONTACT_EMAIL'] ?: $config['FROM_EMAIL'];
$subject = sprintf('%s Mail Test', $config['SITE_NAME']);
$message = 'This is a test email from the server.';

$sent = mail($toAddress, $subject, $message);
echo $sent ? 'Mail sent OK' : 'Mail failed';
