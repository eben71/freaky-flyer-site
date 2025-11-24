<?php
$sent = mail("eben.venter@gmail.com", "FFD Mail Test", "This is a test email from the server.");
echo $sent ? "Mail sent OK" : "Mail failed";
