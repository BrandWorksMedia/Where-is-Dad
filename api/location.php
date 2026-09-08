<?php
// ------------------------------------------------------------
//  Read endpoint for the iPad page.
//  GET api/location.php            -> {"status":"ok","latest":{...}}
//  GET api/location.php?history=1  -> also includes a thinned breadcrumb trail
//  No token needed: it only reveals where the truck is, which is the whole point.
// ------------------------------------------------------------
require __DIR__ . '/_common.php';

$latest = read_latest();
if ($latest === null) {
    json_out(['status' => 'waiting', 'latest' => null, 'history' => []]);
}

$out = ['status' => 'ok', 'latest' => $latest, 'server_time' => time()];

if (isset($_GET['history']) && is_file(HISTORY_FILE)) {
    $lines = file(HISTORY_FILE, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
    $max = 400;                                   // points to send at most
    $n = count($lines);
    $step = max(1, (int)ceil($n / $max));
    $hist = [];
    for ($i = 0; $i < $n; $i += $step) {
        $j = json_decode($lines[$i], true);
        if (is_array($j) && isset($j['lat'], $j['lon'])) {
            $hist[] = ['lat' => $j['lat'], 'lon' => $j['lon'], 'tst' => $j['tst'] ?? null];
        }
    }
    // always end the trail at the newest point
    if ($n > 0 && ($n - 1) % $step !== 0) {
        $j = json_decode($lines[$n - 1], true);
        if (is_array($j) && isset($j['lat'], $j['lon'])) $hist[] = ['lat' => $j['lat'], 'lon' => $j['lon'], 'tst' => $j['tst'] ?? null];
    }
    $out['history'] = $hist;
}

json_out($out);
