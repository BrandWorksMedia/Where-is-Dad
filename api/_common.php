<?php
// Shared bits for the tiny API.
declare(strict_types=1);

define('DATA_DIR', dirname(__DIR__) . '/data');
define('LATEST_FILE', DATA_DIR . '/latest.json');
define('HISTORY_FILE', DATA_DIR . '/history.jsonl');
define('ATTEMPT_LOG', DATA_DIR . '/receiver.log');

function json_out($data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    echo json_encode($data, JSON_UNESCAPED_SLASHES);
    exit;
}

function load_config(): array {
    $file = __DIR__ . '/config.php';
    if (!is_file($file)) {
        json_out(['error' => 'api/config.php is missing. Copy config.example.php to config.php and set a token.'], 500);
    }
    $cfg = require $file;
    if (!is_array($cfg) || empty($cfg['token']) || $cfg['token'] === 'CHANGE-ME-to-a-long-random-secret') {
        json_out(['error' => 'Set a real token in api/config.php'], 500);
    }
    return $cfg;
}

// Remember every attempt to reach the receiver, so setup/status pages can show
// "the phone is trying but the token is wrong" vs "nothing has arrived at all".
function log_attempt(string $outcome): void {
    if (!is_dir(DATA_DIR)) @mkdir(DATA_DIR, 0755, true);
    $line = json_encode([
        't' => time(),
        'outcome' => $outcome,
        'method' => $_SERVER['REQUEST_METHOD'] ?? '',
        'ip' => $_SERVER['HTTP_X_FORWARDED_FOR'] ?? ($_SERVER['REMOTE_ADDR'] ?? ''),
        'ua' => substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 80),
    ]);
    @file_put_contents(ATTEMPT_LOG, $line . "\n", FILE_APPEND | LOCK_EX);
}

function recent_attempts(int $n = 10): array {
    if (!is_file(ATTEMPT_LOG)) return [];
    $lines = file(ATTEMPT_LOG, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
    $out = [];
    foreach (array_slice($lines, -$n) as $l) { $j = json_decode($l, true); if (is_array($j)) $out[] = $j; }
    return array_reverse($out);
}

define('RESET_MARKER', __DIR__ . '/reset-secret.txt');

// Write api/config.php with a fresh secret. $resetId ties the secret to the
// current reset marker so a deploy with a new marker triggers exactly one reset.
function write_new_secret(?string $resetId = null): string {
    $token = bin2hex(random_bytes(16));
    $php = "<?php\n// Created by setup.php on " . date('c') . "\nreturn [\n"
         . "    'token' => '" . $token . "',\n"
         . "    'reset_id' => " . var_export($resetId ?? '', true) . ",\n];\n";
    if (@file_put_contents(__DIR__ . '/config.php', $php, LOCK_EX) === false) {
        throw new RuntimeException('cannot write config.php');
    }
    return $token;
}

function current_reset_id(): ?string {
    return is_file(RESET_MARKER) ? trim((string)@file_get_contents(RESET_MARKER)) : null;
}

function require_token(array $cfg): void {
    $given = $_GET['token'] ?? '';
    // OwnTracks can also send HTTP basic auth; accept the token as the password too.
    if ($given === '' && isset($_SERVER['PHP_AUTH_PW'])) {
        $given = $_SERVER['PHP_AUTH_PW'];
    }
    if (!is_string($given) || !hash_equals((string)$cfg['token'], $given)) {
        if (basename($_SERVER['SCRIPT_NAME'] ?? '') === 'owntracks.php') log_attempt('bad-token');
        json_out(['error' => 'bad token'], 403);
    }
}

function ensure_data_dir(): void {
    if (!is_dir(DATA_DIR)) {
        @mkdir(DATA_DIR, 0755, true);
    }
    if (!is_writable(DATA_DIR)) {
        json_out(['error' => 'data/ folder is not writable'], 500);
    }
}

function read_latest(): ?array {
    if (!is_file(LATEST_FILE)) return null;
    $j = json_decode((string)@file_get_contents(LATEST_FILE), true);
    return is_array($j) ? $j : null;
}
