<?php
// ------------------------------------------------------------
//  OwnTracks receiver.
//  In the OwnTracks app: Mode = HTTP,
//  URL = https://bambamgo.com/api/owntracks.php?token=YOUR-TOKEN
//  Every location the phone sends lands here.
// ------------------------------------------------------------
require __DIR__ . '/_common.php';

$cfg = load_config();
require_token($cfg);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    log_attempt('get-ok-token');
    json_out(['ok' => true, 'hint' => 'Token is right. OwnTracks will POST locations here.'], 200);
}

$raw = file_get_contents('php://input');
$p = json_decode((string)$raw, true);

// OwnTracks also posts "transition", "waypoint", "lwt" etc.  We only care about locations.
if (!is_array($p) || ($p['_type'] ?? '') !== 'location' || !isset($p['lat'], $p['lon'])) {
    log_attempt('ignored-' . (is_array($p) ? (string)($p['_type'] ?? 'no-type') : 'not-json'));
    header('Content-Type: application/json');
    echo '[]';   // OwnTracks expects a JSON array back
    exit;
}

$lat = (float)$p['lat'];
$lon = (float)$p['lon'];
if ($lat < -90 || $lat > 90 || $lon < -180 || $lon > 180) {
    echo '[]';
    exit;
}

$loc = [
    'lat'  => round($lat, 6),
    'lon'  => round($lon, 6),
    'tst'  => isset($p['tst']) ? (int)$p['tst'] : time(),     // when the phone took the fix
    'vel'  => isset($p['vel']) ? (int)$p['vel'] : null,        // km/h
    'cog'  => isset($p['cog']) ? (int)$p['cog'] : null,        // heading, degrees
    'acc'  => isset($p['acc']) ? (int)$p['acc'] : null,        // accuracy, metres
    'batt' => isset($p['batt']) ? (int)$p['batt'] : null,      // phone battery %
    'tid'  => isset($p['tid']) ? substr((string)$p['tid'], 0, 8) : null,
    'received' => time(),
];

ensure_data_dir();

// Don't let an old, late-arriving fix overwrite a newer one.
$prev = read_latest();
if ($prev === null || (int)($prev['tst'] ?? 0) <= $loc['tst']) {
    $tmp = LATEST_FILE . '.tmp';
    file_put_contents($tmp, json_encode($loc), LOCK_EX);
    rename($tmp, LATEST_FILE);
}
file_put_contents(HISTORY_FILE, json_encode($loc) . "\n", FILE_APPEND | LOCK_EX);
log_attempt('location-ok');

header('Content-Type: application/json');
echo '[]';
