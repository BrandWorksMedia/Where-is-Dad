<?php
// ------------------------------------------------------------
//  One-time setup page.  Visit https://bambamgo.com/api/setup.php
//  right after the site is deployed from GitHub.
//
//  First visit: creates api/config.php with a random secret and shows
//  the OwnTracks URL + a tap-to-configure link for the iPhone.
//  Later visits: only show the secret again if you already know it
//  (?token=...), so nobody else can read it.
// ------------------------------------------------------------
declare(strict_types=1);
require __DIR__ . '/_common.php';

$configFile = __DIR__ . '/config.php';
$host = $_SERVER['HTTP_HOST'] ?? 'bambamgo.com';
$base = 'https://' . $host;
$token = null;
$state = 'new';

$existing = null;
if (is_file($configFile)) {
    $cfg = require $configFile;
    if (is_array($cfg) && !empty($cfg['token']) && $cfg['token'] !== 'CHANGE-ME-to-a-long-random-secret') {
        $existing = (string)$cfg['token'];
    }
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
    // First visit: create the secret.
    $token = bin2hex(random_bytes(16));
    $php = "<?php\n// Created by setup.php on " . date('c') . "\nreturn [\n    'token' => '" . $token . "',\n];\n";
    $ok = @file_put_contents($configFile, $php, LOCK_EX) !== false;
    if (!$ok) {
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
  <p>Lost it? Delete <code>api/config.php</code> with hPanel's File Manager and reload this page to make a new one (then update OwnTracks).</p>
  <p><a class="btn blue" href="<?= $h($base) ?>/">Open the map</a></p>
</div>

<?php elseif ($state === 'unwritable'): ?>
<div class="card">
  <h1>Almost 😬</h1>
  <p class="warn">PHP could not write <code>api/config.php</code>. In hPanel's File Manager, create that file with this content and reload:</p>
  <pre class="box">&lt;?php
return ['token' =&gt; '<?= $h($token) ?>'];</pre>
</div>

<?php else: ?>
<div class="card">
  <h1><?= $state === 'new' ? 'All set! 🎉' : 'Your setup details' ?></h1>
  <p><?= $state === 'new' ? 'The secret was just created on the server.' : 'Here they are again.' ?> Do the two steps below and the map is live.</p>
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
</script>
<?php endif; ?>

</body>
</html>
