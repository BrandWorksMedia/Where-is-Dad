<?php
// Shared bits for the tiny API.
declare(strict_types=1);

define('DATA_DIR', dirname(__DIR__) . '/data');
define('LATEST_FILE', DATA_DIR . '/latest.json');
define('HISTORY_FILE', DATA_DIR . '/history.jsonl');
define('ATTEMPT_LOG', DATA_DIR . '/receiver.log');
define('CONFIG_JSON', DATA_DIR . '/config.json');      // the secret lives here (web-blocked, git-ignored)
define('LEGACY_CONFIG', __DIR__ . '/config.php');     // older installs / hand-made config

function json_out($data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    echo json_encode($data, JSON_UNESCAPED_SLASHES);
    exit;
}

// Read the secret. JSON in data/ is the source of truth (PHP's opcache can serve a
// stale config.php for a while after it is rewritten, which broke resets).
function read_config(): ?array {
    if (is_file(CONFIG_JSON)) {
        $j = json_decode((string)@file_get_contents(CONFIG_JSON), true);
        if (is_array($j) && !empty($j['token'])) return $j;
    }
    if (is_file(LEGACY_CONFIG)) {
        if (function_exists('opcache_invalidate')) @opcache_invalidate(LEGACY_CONFIG, true);
        $c = include LEGACY_CONFIG;
        if (is_array($c) && !empty($c['token']) && $c['token'] !== 'CHANGE-ME-to-a-long-random-secret') {
            $cfg = ['token' => (string)$c['token'], 'reset_id' => (string)($c['reset_id'] ?? '')];
            try { save_config($cfg); } catch (RuntimeException $e) {}
            return $cfg;
        }
    }
    return null;
}

function save_config(array $cfg): void {
    if (!is_dir(DATA_DIR)) @mkdir(DATA_DIR, 0755, true);
    $tmp = CONFIG_JSON . '.tmp';
    if (@file_put_contents($tmp, json_encode($cfg, JSON_PRETTY_PRINT), LOCK_EX) === false || !@rename($tmp, CONFIG_JSON)) {
        throw new RuntimeException('cannot write ' . CONFIG_JSON);
    }
}

function load_config(): array {
    $cfg = read_config();
    if ($cfg === null) {
        json_out(['error' => 'Not set up yet. Open /api/setup.php once to create the secret.'], 500);
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
    save_config(['token' => $token, 'reset_id' => $resetId ?? '', 'created' => date('c')]);
    @unlink(LEGACY_CONFIG);   // an old config.php must not shadow the new secret
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
