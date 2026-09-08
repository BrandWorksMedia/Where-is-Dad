<?php
// ------------------------------------------------------------
//  Little admin helper (needs the token).
//  api/admin.php?token=...&action=reset   -> wipe the trail, start fresh
//  api/admin.php?token=...&action=status  -> show what the server has
//  api/admin.php?token=...&action=fake&lat=30.43&lon=-84.28&vel=100
//                                          -> pretend the truck is somewhere (for testing)
// ------------------------------------------------------------
require __DIR__ . '/_common.php';

$cfg = load_config();
require_token($cfg);
ensure_data_dir();

$action = $_GET['action'] ?? 'status';

if ($action === 'reset') {
    @unlink(LATEST_FILE);
    @unlink(HISTORY_FILE);
    @unlink(ATTEMPT_LOG);
    json_out(['ok' => true, 'message' => 'Trail cleared. The map is back to "Dad hasn\'t left yet".']);
}

if ($action === 'fake') {
    $loc = [
        'lat' => round((float)($_GET['lat'] ?? 25.7617), 6),
        'lon' => round((float)($_GET['lon'] ?? -80.1918), 6),
        'tst' => time(),
        'vel' => (int)($_GET['vel'] ?? 0),
        'cog' => (int)($_GET['cog'] ?? 270),
        'acc' => 10, 'batt' => 88, 'tid' => 'TS',
        'received' => time(),
    ];
    file_put_contents(LATEST_FILE, json_encode($loc), LOCK_EX);
    file_put_contents(HISTORY_FILE, json_encode($loc) . "\n", FILE_APPEND | LOCK_EX);
    json_out(['ok' => true, 'latest' => $loc]);
}

$lines = is_file(HISTORY_FILE) ? count(file(HISTORY_FILE, FILE_SKIP_EMPTY_LINES) ?: []) : 0;
json_out([
    'ok' => true,
    'latest' => read_latest(),
    'history_points' => $lines,
    'recent_attempts' => recent_attempts(10),
    'server_time' => time(),
    'data_dir_writable' => is_writable(DATA_DIR),
    'php' => PHP_VERSION,
]);
