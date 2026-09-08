<?php
// ------------------------------------------------------------
//  One-time setup page.  Visit https://bambamgo.com/api/setup.php
//  right after the site is deployed from GitHub.
//
//  First visit: creates data/config.json with a random secret and shows
//  the OwnTracks URL + a tap-to-configure link for the iPhone.
//  Later visits: only show the secret again if you already know it
//  (?token=...), so nobody else can read it.
// ------------------------------------------------------------
declare(strict_types=1);
require __DIR__ . '/_common.php';

$host = $_SERVER['HTTP_HOST'] ?? 'bambamgo.com';
$base = 'https://' . $host;
$token = null;
$state = 'new';

$existing = null;
$storedResetId = '';
$cfg = read_config();
if ($cfg !== null) {
    $existing = (string)$cfg['token'];
    $storedResetId = (string)($cfg['reset_id'] ?? '');
}

// A new api/reset-secret.txt (pushed through GitHub) forces one fresh secret.
$resetId = current_reset_id();
if ($existing !== null && $resetId !== null && $resetId !== '' && $resetId !== $storedResetId) {
    $existing = null;   // treat as first visit: make a new secret below
}

if ($existing !== null) {
    $given = (string)($_GET['token'] ?? '');
    if ($given !== '' && hash_equals($existing, $given)) {
        $token = $existing;
        $state = 'shown-again';
    } else {
        $state = 'locked';
    }
} else {
    // First visit (or a reset): create the secret.
    try {
        $token = write_new_secret($resetId);
    } catch (RuntimeException $e) {
        $token = bin2hex(random_bytes(16));
        $state = 'unwritable';
    }
    ensure_data_dir_quiet();
}

function ensure_data_dir_quiet(): void {
    if (!is_dir(DATA_DIR)) @mkdir(DATA_DIR, 0755, true);
}

$otUrl = $token ? "$base/api/owntracks.php?token=$token" : '';
$otConfig = $token ? [
    '_type' => 'configuration',
    'mode' => 3,                       // HTTP mode
    'url' => $otUrl,
    'auth' => false,
    'deviceId' => 'tacoma',
    'tid' => 'DA',
    'monitoring' => 2,                 // Move mode for the trip
    'locatorDisplacement' => 200,      // metres between reports
    'locatorInterval' => 30,           // seconds between reports
    'ignoreStaleLocations' => 0,
    'ranging' => false,
] : null;
$otLink = $otConfig ? 'owntracks:///config?inline=' . rawurlencode(base64_encode(json_encode($otConfig))) : '';
$h = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Where is Dad? — setup</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; background: #bfe9ff; color: #2d2a32; margin: 0; padding: 24px 16px; }
  .card { max-width: 640px; margin: 0 auto 16px; background: #fffaf0; border: 4px solid #2d2a32; border-radius: 22px; padding: 20px 22px; box-shadow: 0 6px 0 rgba(0,0,0,.12); }
  h1 { margin: 0 0 6px; font-size: 28px; } h2 { font-size: 19px; margin: 0 0 10px; }
  p { line-height: 1.45; }
  code, .box { font-family: ui-monospace, Menlo, monospace; font-size: 14px; }
  .box { display: block; background: #fff; border: 2px solid #2d2a32; border-radius: 12px; padding: 12px; word-break: break-all; user-select: all; -webkit-user-select: all; }
  .btn { display: inline-block; background: #ff6b6b; color: #fff; text-decoration: none; font-weight: 700; font-size: 18px; padding: 12px 20px; border-radius: 999px; border: 3px solid #2d2a32; margin: 8px 0; }
  .btn.blue { background: #4cb5ff; }
  .warn { background: #fff3c4; border-radius: 12px; padding: 10px 14px; }
  ol li { margin: 6px 0; }
  #qr { margin: 10px auto; width: 200px; height: 200px; }
  small { color: #5a5566; }
</style>
</head>
<body>

<?php if ($state === 'locked'): ?>
<div class="card">
  <h1>Already set up ✅</h1>
  <p>The secret was created earlier and is not shown again to strangers.</p>
  <p>Know the secret? Open <code><?= $h($base) ?>/api/setup.php?token=YOUR-SECRET</code> to see this page again.</p>
  <p>Lost it? Change the text inside <code>api/reset-secret.txt</code> in the GitHub repo and push. After Hostinger deploys, the next visit here shows a brand-new secret.</p>
  <p><a class="btn blue" href="<?= $h($base) ?>/">Open the map</a></p>
</div>

<?php elseif ($state === 'unwritable'): ?>
<div class="card">
  <h1>Almost 😬</h1>
  <p class="warn">PHP could not write <code>data/config.json</code>. In hPanel's File Manager make sure the <code>data</code> folder exists and is writable, then reload.</p>
</div>

<?php else: ?>
<div class="card">
  <h1><?= $state === 'new' ? 'All set! 🎉' : 'Your setup details' ?></h1>
  <p><?= $state === 'new' ? 'The secret was just created on the server.' : 'Here they are again.' ?> Do the two steps below and the map is live.</p>
</div>

<div class="card" id="conn-card">
  <h2>Is the phone connected? <span id="conn-dot">⏳</span></h2>
  <p id="conn-text">Checking…</p>
  <p id="conn-detail"><small></small></p>
</div>

<div class="card">
  <h2>1. Dad's iPhone: OwnTracks</h2>
  <p>Install <b>OwnTracks</b> from the App Store, then <b>on the iPhone</b> tap this button. It fills in everything (HTTP mode, this URL, Move mode):</p>
  <p><a class="btn" href="<?= $h($otLink) ?>">Configure OwnTracks on this iPhone</a></p>
  <p><small>Reading this on the iPad or a computer? Scan this with the iPhone camera instead:</small></p>
  <div id="qr"></div>
  <p><small>If the button does nothing, set it by hand in OwnTracks → (i) → Settings: Mode <b>HTTP</b>, URL below, Device ID <b>tacoma</b>, Tracker ID <b>DA</b>, then tap the mode icon on the map until it says <b>Move</b>.</small></p>
  <span class="box"><?= $h($otUrl) ?></span>
  <p><small>Then allow Location <b>Always</b> when iOS asks, and tap the publish arrow once.</small></p>
</div>

<div class="card">
  <h2>2. The wall iPad</h2>
  <p>Open <a href="<?= $h($base) ?>/"><?= $h($base) ?></a> in Safari → Share → <b>Add to Home Screen</b> → open it from the icon. Settings → Display &amp; Brightness → Auto-Lock → <b>Never</b>.</p>
  <p><a class="btn blue" href="<?= $h($base) ?>/?demo=1">Watch the demo trip</a></p>
</div>

<div class="card">
  <h2>Handy links (keep this page's address private)</h2>
  <p>This page again: <span class="box"><?= $h($base) ?>/api/setup.php?token=<?= $h($token) ?></span></p>
  <p>Is the phone reporting? <span class="box"><?= $h($base) ?>/api/admin.php?token=<?= $h($token) ?>&amp;action=status</span></p>
  <p>Clear test points before the real trip: <span class="box"><?= $h($base) ?>/api/admin.php?token=<?= $h($token) ?>&amp;action=reset</span></p>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script>
  try { new QRCode(document.getElementById('qr'), { text: <?= json_encode($otLink) ?>, width: 200, height: 200 }); } catch (e) {}

  // Live connection check: polls the status endpoint every 5 seconds.
  (function () {
    const statusUrl = <?= json_encode("$base/api/admin.php?token=$token&action=status") ?>;
    const dot = document.getElementById('conn-dot'), text = document.getElementById('conn-text'), detail = document.getElementById('conn-detail');
    const ago = s => s < 60 ? Math.round(s) + ' s ago' : s < 3600 ? Math.round(s / 60) + ' min ago' : Math.round(s / 3600) + ' h ago';
    async function check() {
      try {
        const j = await (await fetch(statusUrl + '&_=' + Date.now(), { cache: 'no-store' })).json();
        const now = j.server_time || Math.floor(Date.now() / 1000);
        const att = (j.recent_attempts || [])[0];
        if (j.latest) {
          dot.textContent = '🟢';
          text.innerHTML = '<b>Yes! The phone is reporting.</b> Last position ' + ago(now - j.latest.tst) +
            ' (' + j.latest.lat.toFixed(3) + ', ' + j.latest.lon.toFixed(3) + ')' + (j.latest.vel != null ? ', ' + Math.round(j.latest.vel * 0.621) + ' mph' : '') + '.';
          detail.innerHTML = '<small>' + j.history_points + ' points so far. The map is live: <a href="<?= $h($base) ?>/"><?= $h($base) ?></a></small>';
        } else if (att && att.outcome === 'bad-token') {
          dot.textContent = '🟠';
          text.innerHTML = '<b>The phone reached the server ' + ago(now - att.t) + ', but with the wrong secret.</b> Re-tap the configure button below, or paste the URL below into OwnTracks exactly.';
          detail.innerHTML = '<small>Seen: ' + (att.ua || 'unknown app') + '</small>';
        } else if (att && att.outcome && att.outcome.startsWith('ignored')) {
          dot.textContent = '🟠';
          text.innerHTML = '<b>Something reached the server ' + ago(now - att.t) + ' but it was not a location</b> (' + att.outcome.replace('ignored-', '') + '). In OwnTracks, tap the publish arrow (↑) once.';
          detail.innerHTML = '<small>Seen: ' + (att.ua || 'unknown app') + '</small>';
        } else if (att && att.outcome === 'get-ok-token') {
          dot.textContent = '🟠';
          text.innerHTML = '<b>The URL and secret are right</b> (something opened it ' + ago(now - att.t) + '), but OwnTracks has not sent a location yet. Open OwnTracks and tap the publish arrow (↑).';
          detail.innerHTML = '';
        } else {
          dot.textContent = '🔴';
          text.innerHTML = '<b>Nothing from the phone yet.</b> Do step 1 below, then in OwnTracks tap the publish arrow (↑) at the top. This box turns green by itself.';
          detail.innerHTML = '<small>Checklist: Mode = HTTP · URL pasted exactly · Location permission = Always · not in Quiet/Manual mode.</small>';
        }
      } catch (e) {
        dot.textContent = '⚠️'; text.textContent = 'Could not reach the status endpoint: ' + e;
      }
    }
    check(); setInterval(check, 5000);
  })();
</script>
<?php endif; ?>

</body>
</html>
