<?php
// Shared bits for the tiny API.
declare(strict_types=1);

define('DATA_DIR', dirname(__DIR__) . '/data');
define('LATEST_FILE', DATA_DIR . '/latest.json');
define('HISTORY_FILE', DATA_DIR . '/history.jsonl');

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

function require_token(array $cfg): void {
    $given = $_GET['token'] ?? '';
    // OwnTracks can also send HTTP basic auth; accept the token as the password too.
    if ($given === '' && isset($_SERVER['PHP_AUTH_PW'])) {
        $given = $_SERVER['PHP_AUTH_PW'];
    }
    if (!is_string($given) || !hash_equals((string)$cfg['token'], $given)) {
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
