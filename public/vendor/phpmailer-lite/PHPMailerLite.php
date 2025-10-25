<?php
/**
 * Lightweight SMTP mailer compatible with common PHPMailer APIs.
 *
 * This implementation is intentionally small so it can ship with the static
 * build. It supports authenticated SMTP connections with optional TLS.
 * The public surface mirrors the subset used by form-handler.php.
 *
 * MIT License
 */

namespace PHPMailer\PHPMailer;

use RuntimeException;

class Exception extends RuntimeException
{
}

class SMTP
{
    private $socket;
    private int $timeout;

    public function __construct(int $timeout = 10)
    {
        $this->timeout = $timeout;
    }

    public function connect(string $host, int $port, bool $useSecure = false): void
    {
        $scheme = $useSecure ? 'ssl://' : '';
        $this->socket = @stream_socket_client(
            $scheme . $host . ':' . $port,
            $errno,
            $errstr,
            $this->timeout,
            STREAM_CLIENT_CONNECT
        );

        if (!$this->socket) {
            throw new Exception('Unable to connect to SMTP: ' . $errstr . ' (' . $errno . ')');
        }

        stream_set_timeout($this->socket, $this->timeout);
        $this->expect(220, 'SMTP greeting not received');
    }

    public function hello(string $domain): void
    {
        $this->command('EHLO ' . $domain, [250]);
    }

    public function startTLS(): void
    {
        $this->command('STARTTLS', [220]);
        if (!stream_socket_enable_crypto($this->socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            throw new Exception('Failed to enable TLS on SMTP connection');
        }
    }

    public function authenticate(string $username, string $password): void
    {
        $this->command('AUTH LOGIN', [334]);
        $this->command(base64_encode($username), [334]);
        $this->command(base64_encode($password), [235]);
    }

    public function mailFrom(string $address): void
    {
        $this->command('MAIL FROM:<' . $address . '>', [250]);
    }

    public function rcptTo(string $address): void
    {
        $this->command('RCPT TO:<' . $address . '>', [250, 251]);
    }

    public function data(string $message): void
    {
        $this->command('DATA', [354]);
        $this->write($message . "\r\n.");
        $this->expect(250, 'SMTP data not accepted');
    }

    public function quit(): void
    {
        if ($this->socket) {
            $this->command('QUIT', [221], false);
            fclose($this->socket);
            $this->socket = null;
        }
    }

    private function command(string $command, array $expect, bool $logResponse = true): void
    {
        $this->write($command);
        if ($logResponse) {
            $this->expect($expect, 'Unexpected SMTP response for command: ' . $command);
        }
    }

    private function expect($expectedCodes, string $errorMessage): void
    {
        $expectedCodes = (array) $expectedCodes;
        $response = $this->read();
        $code = (int) substr($response, 0, 3);
        if (!in_array($code, $expectedCodes, true)) {
            throw new Exception($errorMessage . ' (' . trim($response) . ')');
        }
    }

    private function read(): string
    {
        if (!$this->socket) {
            throw new Exception('SMTP connection not established');
        }

        $data = '';
        while (($line = fgets($this->socket, 515)) !== false) {
            $data .= $line;
            if (isset($line[3]) && $line[3] === ' ') {
                break;
            }
        }

        if ($data === '') {
            throw new Exception('Empty response from SMTP server');
        }

        return $data;
    }

    private function write(string $command): void
    {
        if (!$this->socket) {
            throw new Exception('SMTP connection not established');
        }

        fwrite($this->socket, $command . "\r\n");
    }

    public function __destruct()
    {
        if ($this->socket) {
            fclose($this->socket);
        }
    }
}

class PHPMailer
{
    public string $CharSet = 'UTF-8';
    public bool $SMTPAuth = true;
    public string $Host = 'localhost';
    public int $Port = 587;
    public string $Username = '';
    public string $Password = '';
    public string $SMTPSecure = 'tls';
    public int $Timeout = 10;
    public string $Subject = '';
    public string $Body = '';
    public string $AltBody = '';
    public bool $isHTML = false;
    public string $Encoding = '8bit';

    private string $mailer = 'mail';
    private array $from = ['address' => '', 'name' => ''];
    private array $replyTo = [];
    private array $addresses = [];

    public function isSMTP(): void
    {
        $this->mailer = 'smtp';
    }

    public function setFrom(string $address, string $name = ''): void
    {
        $this->from = ['address' => $address, 'name' => $name];
    }

    public function addAddress(string $address, string $name = ''): void
    {
        $this->addresses[] = ['address' => $address, 'name' => $name];
    }

    public function addReplyTo(string $address, string $name = ''): void
    {
        $this->replyTo = ['address' => $address, 'name' => $name];
    }

    public function clearAllRecipients(): void
    {
        $this->addresses = [];
    }

    public function send(): bool
    {
        if ($this->mailer === 'smtp') {
            return $this->smtpSend();
        }

        return $this->mailSend();
    }

    private function smtpSend(): bool
    {
        if (empty($this->from['address'])) {
            throw new Exception('From address must be set');
        }

        if (empty($this->addresses)) {
            throw new Exception('At least one recipient must be provided');
        }

        $smtp = new SMTP($this->Timeout);
        $useSecure = strtolower($this->SMTPSecure) === 'ssl';
        $smtp->connect($this->Host, $this->Port, $useSecure);
        $smtp->hello($this->getDomain());

        if (strtolower($this->SMTPSecure) === 'tls') {
            $smtp->startTLS();
            $smtp->hello($this->getDomain());
        }

        if ($this->SMTPAuth) {
            $smtp->authenticate($this->Username, $this->Password);
        }

        $smtp->mailFrom($this->from['address']);
        foreach ($this->addresses as $address) {
            $smtp->rcptTo($address['address']);
        }

        $smtp->data($this->buildMessage());
        $smtp->quit();

        return true;
    }

    private function mailSend(): bool
    {
        $headers = $this->buildHeaders();
        $to = $this->formatAddressList($this->addresses);
        return mail($to, $this->encodeHeader($this->Subject), $this->Body, $headers);
    }

    private function buildMessage(): string
    {
        $headers = $this->buildHeaders();
        $body = $this->Body;

        if (!$this->isHTML && $this->AltBody !== '') {
            $body .= "\r\n\r\n" . $this->AltBody;
        }

        return $headers . "\r\n" . $body;
    }

    private function buildHeaders(): string
    {
        $headers = [];
        $headers[] = 'Date: ' . gmdate('D, d M Y H:i:s') . ' +0000';
        $headers[] = 'From: ' . $this->formatAddress($this->from);
        if (!empty($this->replyTo)) {
            $headers[] = 'Reply-To: ' . $this->formatAddress($this->replyTo);
        }
        $headers[] = 'Message-ID: <' . $this->generateMessageId() . '>';
        $headers[] = 'X-Mailer: PHPMailer Lite';
        $headers[] = 'MIME-Version: 1.0';
        $headers[] = 'Content-Type: text/plain; charset=' . $this->CharSet;
        $headers[] = 'Content-Transfer-Encoding: ' . $this->Encoding;
        $headers[] = 'Subject: ' . $this->encodeHeader($this->Subject);
        $headers[] = 'To: ' . $this->formatAddressList($this->addresses);

        return implode("\r\n", $headers);
    }

    private function formatAddressList(array $addresses): string
    {
        return implode(', ', array_map(fn ($addr) => $this->formatAddress($addr), $addresses));
    }

    private function formatAddress(array $address): string
    {
        $name = $address['name'] ?? '';
        if ($name !== '') {
            $encodedName = $this->encodeHeader($name);
            return sprintf('%s <%s>', $encodedName, $address['address']);
        }
        return $address['address'];
    }

    private function generateMessageId(): string
    {
        $domain = $this->getDomain();
        return uniqid('freakyflyer-', true) . '@' . $domain;
    }

    private function getDomain(): string
    {
        if (str_contains($this->from['address'], '@')) {
            return substr(strrchr($this->from['address'], '@'), 1);
        }
        return 'localhost';
    }

    private function encodeHeader(string $value): string
    {
        if ($value === '') {
            return '';
        }

        return '=?' . $this->CharSet . '?B?' . base64_encode($value) . '?=';
    }
}
