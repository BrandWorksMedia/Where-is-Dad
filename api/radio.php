<?php
// ------------------------------------------------------------
//  The walkie-talkie backend.  Open access on purpose: anyone who
//  finds the radio can talk over it.  Only sanity limits apply.
//
//  POST radio.php?action=send&from=kid|dad&dur=<sec>   body = raw audio, Content-Type = its mime
//  GET  radio.php?action=list[&since=<id>]             newest clips (after <id>)
//  GET  radio.php?action=clip&id=<id>                  stream one clip
// ------------------------------------------------------------
declare(strict_types=1);
require __DIR__ . '/_common.php';

define('RADIO_DIR', DATA_DIR . '/radio');
define('RADIO_INDEX', RADIO_DIR . '/messages.jsonl');
const RADIO_MAX_BYTES = 3 * 1024 * 1024;   // per clip
const RADIO_MIN_BYTES = 200;               // anything smaller is an accidental tap
const RADIO_KEEP = 40;                     // clips kept on disk
const RADIO_MIMES = [
    'audio/mp4' => 'm4a', 'audio/x-m4a' => 'm4a', 'audio/aac' => 'aac', 'audio/mpeg' => 'mp3',
    'audio/webm' => 'webm', 'audio/ogg' => 'ogg', 'audio/wav' => 'wav', 'audio/x-wav' => 'wav',
];

function radio_rows(): array {
    if (!is_file(RADIO_INDEX)) return [];
    $out = [];
    foreach (file(RADIO_INDEX, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $l) {
        $j = json_decode($l, true);
        if (is_array($j) && isset($j['id'])) $out[] = $j;
    }
    return $out;
}
function radio_write_rows(array $rows): void {
    $tmp = RADIO_INDEX . '.tmp';
    file_put_contents($tmp, implode("\n", array_map('json_encode', $rows)) . ($rows ? "\n" : ''), LOCK_EX);
    rename($tmp, RADIO_INDEX);
}
function radio_ext(string $id, array $row): string { return $row['ext'] ?? 'm4a'; }
function radio_id_ok(string $id): bool { return (bool)preg_match('/^\d{10,16}-(kid|dad)$/', $id); }

$action = $_GET['action'] ?? 'list';

// ------------------------------------------------------------ send
if ($action === 'send') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'POST the audio bytes'], 405);
    $from = $_GET['from'] ?? '';
    if (!in_array($from, ['kid', 'dad'], true)) json_out(['error' => 'from must be kid or dad'], 400);

    $ctype = strtolower(trim(explode(';', (string)($_SERVER['CONTENT_TYPE'] ?? ''))[0]));
    if (!isset(RADIO_MIMES[$ctype])) json_out(['error' => 'unsupported audio type', 'got' => $ctype], 415);
    $len = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($len > RADIO_MAX_BYTES) json_out(['error' => 'clip too big'], 413);

    $bytes = file_get_contents('php://input', false, null, 0, RADIO_MAX_BYTES + 1);
    $size = strlen((string)$bytes);
    if ($size > RADIO_MAX_BYTES) json_out(['error' => 'clip too big'], 413);
    if ($size < RADIO_MIN_BYTES) json_out(['error' => 'clip too short'], 400);

    if (!is_dir(RADIO_DIR)) @mkdir(RADIO_DIR, 0755, true);
    if (!is_writable(RADIO_DIR)) json_out(['error' => 'data/radio is not writable'], 500);

    $rows = radio_rows();
    $now = (int)round(microtime(true) * 1000);
    $last = end($rows);
    if ($last && ($last['from'] ?? '') === $from && $now - (int)$last['ms'] < 1000) {
        json_out(['error' => 'slow down'], 429);
    }
    $id = $now . '-' . $from;
    $ext = RADIO_MIMES[$ctype];
    if (file_put_contents(RADIO_DIR . "/$id.$ext", $bytes, LOCK_EX) === false) json_out(['error' => 'could not save'], 500);

    $dur = min(60.0, max(0.0, (float)($_GET['dur'] ?? 0)));
    $rows[] = ['id' => $id, 'from' => $from, 'ms' => $now, 'tst' => intdiv($now, 1000), 'dur' => round($dur, 1),
               'mime' => $ctype, 'ext' => $ext, 'size' => $size];

    // keep the newest RADIO_KEEP clips
    while (count($rows) > RADIO_KEEP) {
        $old = array_shift($rows);
        @unlink(RADIO_DIR . '/' . $old['id'] . '.' . radio_ext($old['id'], $old));
    }
    radio_write_rows($rows);
    json_out(['ok' => true, 'id' => $id, 'tst' => intdiv($now, 1000), 'size' => $size]);
}

// ------------------------------------------------------------ list
if ($action === 'list') {
    $rows = radio_rows();
    $since = (string)($_GET['since'] ?? '');
    $pub = fn($r) => ['id' => $r['id'], 'from' => $r['from'], 'tst' => $r['tst'], 'dur' => $r['dur'], 'size' => $r['size']];
    if ($since !== '') {
        $sinceMs = (int)$since;                                    // ids start with the ms timestamp
        $new = array_values(array_filter($rows, fn($r) => (int)$r['ms'] > $sinceMs));
        $new = array_slice($new, -20);
    } else {
        $new = array_slice($rows, -5);
    }
    $latest = $rows ? end($rows)['id'] : '';
    json_out(['server_time' => time(), 'latest_id' => $latest, 'clips' => array_map($pub, $new)]);
}

// ------------------------------------------------------------ clip
if ($action === 'clip') {
    $id = (string)($_GET['id'] ?? '');
    if (!radio_id_ok($id)) json_out(['error' => 'bad id'], 400);
    $row = null;
    foreach (radio_rows() as $r) if ($r['id'] === $id) { $row = $r; break; }
    if (!$row) json_out(['error' => 'not found'], 404);
    $path = RADIO_DIR . '/' . $id . '.' . radio_ext($id, $row);
    if (!is_file($path)) json_out(['error' => 'gone'], 404);
    header('Content-Type: ' . $row['mime']);
    header('Content-Length: ' . filesize($path));
    header('Cache-Control: private, max-age=3600');
    header('Accept-Ranges: none');
    if ($_SERVER['REQUEST_METHOD'] === 'HEAD') exit;
    readfile($path);
    exit;
}

json_out(['error' => 'unknown action'], 400);
