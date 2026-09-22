// ============================================================
//  Where is Dad?  —  the walkie-talkie
//  Push-to-talk voice clips between the kid (map page) and Dad
//  (/radio/).  Recording via MediaRecorder, playback via <audio>,
//  radio noises via Web Audio.  No libraries.
//
//    RADIO.mount(rootEl, { role: "kid"|"dad", mode: "hold"|"tap", api: "api/radio.php" })
// ============================================================
window.RADIO = (function () {
  const T = window.TRIP || {};
  const R = Object.assign({ kidMaxSeconds: 20, dadMaxSeconds: 10, pollSeconds: 3, channel: "CH 4" }, T.radio || {});
  const names = { kid: T.kidName || "Bam Bam", dad: T.driverName || "Dad" };

  // ---------------- sounds (shared across mounts) ----------------
  const sfx = (function () {
    let ctx = null, unlocked = false, primed = false;
    const player = new Audio();
    player.setAttribute("playsinline", "");
    const listeners = [];
    function silentWav() {
      const rate = 8000, n = 400, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
      const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
      str(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); str(8, "WAVE"); str(12, "fmt "); v.setUint32(16, 16, true);
      v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
      v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, "data"); v.setUint32(40, n * 2, true);
      return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
    }
    function unlock() {
      if (unlocked) return;
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        ctx.resume();
        if (!primed) {               // iOS lets <audio> autoplay later only if it played once in a gesture
          primed = true;
          player.src = silentWav();
          const p = player.play(); if (p && p.catch) p.catch(() => {});
        }
        unlocked = true;
        listeners.forEach(f => f());
      } catch (e) { /* no audio */ }
    }
    ["touchend", "click", "keydown", "pointerup"].forEach(ev => document.addEventListener(ev, unlock, { passive: true }));

    function env(g, at, peak, dur) {
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(peak, at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    }
    function squelch() {                       // "kssht"
      if (!ctx) return;
      const dur = 0.22, at = ctx.currentTime;
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
      const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1800; f.Q.value = 0.7;
      const g = ctx.createGain(); env(g, at, 0.35, dur);
      src.connect(f).connect(g).connect(ctx.destination); src.start(at); src.stop(at + dur + 0.02);
    }
    function tone(freq, at, dur, peak, type) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || "sine"; o.frequency.value = freq; env(g, at, peak, dur);
      o.connect(g).connect(ctx.destination); o.start(at); o.stop(at + dur + 0.02);
    }
    function roger() {                          // "over" beep-beep
      if (!ctx) return; const at = ctx.currentTime + 0.02;
      tone(1175, at, 0.09, 0.25, "square"); tone(880, at + 0.11, 0.12, 0.25, "square");
    }
    function click() { if (!ctx) return; tone(600, ctx.currentTime, 0.035, 0.2, "square"); }
    function chirp() { if (!ctx) return; const at = ctx.currentTime; tone(700, at, 0.06, 0.2, "triangle"); tone(1000, at + 0.07, 0.08, 0.2, "triangle"); }
    return { squelch, roger, click, chirp, player, onUnlock: (f) => { if (unlocked) f(); else listeners.push(f); }, get unlocked() { return unlocked; } };
  })();

  // ---------------- helpers ----------------
  const fmt = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const ago = (sec) => sec < 45 ? "just now" : sec < 3600 ? Math.round(sec / 60) + " min ago" : Math.round(sec / 3600) + " h ago";
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  // ---------------- a radio instance ----------------
  function mount(root, opts) {
    const role = opts.role === "dad" ? "dad" : "kid";
    const other = role === "kid" ? "dad" : "kid";
    const mode = opts.mode || (role === "dad" ? "tap" : "hold");
    const API = opts.api || "api/radio.php";
    const maxSec = role === "dad" ? R.dadMaxSeconds : R.kidMaxSeconds;

    root.classList.add("walkie-root");
    root.innerHTML = `
      <div class="walkie" data-role="${role}">
        <div class="antenna"></div><div class="antenna-tip"></div>
        <div class="w-top">
          <div class="grille">${"<i></i>".repeat(18)}</div>
          <div class="led" title="radio light"></div>
        </div>
        <div class="screen">
          <div class="scr-chan">${R.channel} · ${names.kid.toUpperCase()} ↔ ${names.dad.toUpperCase()}</div>
          <div class="scr-status">Radio ready!</div>
          <div class="scr-wave">${"<b></b>".repeat(9)}</div>
        </div>
        <button class="ptt" type="button">
          <span class="ptt-ring"></span>
          <span class="ptt-label">${mode === "hold" ? "PRESS<br>TO TALK" : "TAP<br>TO TALK"}</span>
          <span class="ptt-timer"></span>
        </button>
        <div class="history"></div>
      </div>`;
    const walkie = root.querySelector(".walkie"), ptt = root.querySelector(".ptt"), label = root.querySelector(".ptt-label");
    const timerEl = root.querySelector(".ptt-timer"), statusEl = root.querySelector(".scr-status"), led = root.querySelector(".led");
    const history = root.querySelector(".history");

    let state = "idle";                 // idle | arming | recording | sending
    let stream = null, rec = null, chunks = [], recStart = 0, tick = null, stopTimer = null;
    let lastSeenId = "", playing = false;
    const queue = [];

    function status(text, cls) {
      statusEl.textContent = text;
      walkie.classList.remove("is-recording", "is-sending", "is-receiving", "is-error");
      if (cls) walkie.classList.add(cls);
    }
    function setLabel() {
      if (state === "recording") label.innerHTML = mode === "hold" ? "RELEASE<br>TO SEND" : "TAP<br>TO SEND";
      else if (state === "sending") label.innerHTML = "SENDING…";
      else label.innerHTML = mode === "hold" ? "PRESS<br>TO TALK" : "TAP<br>TO TALK";
    }

    // ---- recording ----
    function pickMime() {
      if (!window.MediaRecorder) return null;
      for (const m of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"]) {
        try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) {}
      }
      return "";
    }
    async function startRecording() {
      if (state !== "idle") return;
      if (!navigator.mediaDevices || !window.MediaRecorder) { status("This browser can't record 😕", "is-error"); return; }
      state = "arming"; setLabel();
      try {
        stream = stream || await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        state = "idle"; setLabel();
        status("Microphone is off. Settings → Safari → Microphone → Allow", "is-error");
        return;
      }
      if (state !== "arming") { state = "idle"; setLabel(); return; }   // released before the mic was ready
      const mime = pickMime();
      try { rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream); }
      catch (e) { rec = new MediaRecorder(stream); }
      chunks = [];
      rec.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };
      rec.onstop = onRecorded;
      rec.start(250);
      recStart = Date.now();
      state = "recording"; setLabel();
      sfx.click();
      status(mode === "hold" ? "Talking… let go to send" : "Talking… tap to send", "is-recording");
      timerEl.textContent = fmt(0);
      tick = setInterval(() => {
        const s = (Date.now() - recStart) / 1000;
        timerEl.textContent = fmt(s);
        ptt.style.setProperty("--p", Math.min(1, s / maxSec).toFixed(3));
      }, 200);
      stopTimer = setTimeout(stopRecording, maxSec * 1000);
    }
    function stopRecording() {
      if (state === "arming") { state = "idle"; setLabel(); return; }
      if (state !== "recording") return;
      clearInterval(tick); clearTimeout(stopTimer);
      state = "sending"; setLabel();
      ptt.style.removeProperty("--p"); timerEl.textContent = "";
      try { rec.stop(); } catch (e) { onRecorded(); }
    }
    async function onRecorded() {
      const dur = (Date.now() - recStart) / 1000;
      const type = (rec && rec.mimeType) || (chunks[0] && chunks[0].type) || "audio/mp4";
      const blob = new Blob(chunks, { type });
      chunks = [];
      if (dur < 0.6 || blob.size < 200) {
        state = "idle"; setLabel(); status("Hold the button a bit longer 🙂"); return;
      }
      status("Sending… 📡", "is-sending");
      try {
        const r = await fetch(`${API}?action=send&from=${role}&dur=${dur.toFixed(1)}&_=${Date.now()}`, {
          method: "POST", headers: { "Content-Type": type.split(";")[0] }, body: blob
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) throw new Error(j.error || ("HTTP " + r.status));
        lastSeenId = j.id;                                 // don't play our own clip back
        sfx.roger();
        status("Sent! Over. 📻");
        addChip({ id: j.id, from: role, tst: j.tst, dur }, blob);
      } catch (e) {
        status("Couldn't send. Try again!", "is-error");
      }
      state = "idle"; setLabel();
    }

    // ---- button wiring ----
    ptt.addEventListener("contextmenu", e => e.preventDefault());
    if (mode === "hold") {
      ptt.addEventListener("pointerdown", (e) => { e.preventDefault(); ptt.setPointerCapture && ptt.setPointerCapture(e.pointerId); startRecording(); });
      const up = () => stopRecording();
      ptt.addEventListener("pointerup", up); ptt.addEventListener("pointercancel", up);
      ptt.addEventListener("lostpointercapture", up);
      window.addEventListener("blur", up);
    } else {
      ptt.addEventListener("click", () => { if (state === "recording") stopRecording(); else startRecording(); });
    }

    // ---- history chips ----
    function addChip(clip, blob) {
      const who = clip.from === role ? "You" : names[clip.from];
      const chip = el("button", "chip " + (clip.from === role ? "mine" : "theirs"));
      chip.type = "button";
      chip.innerHTML = `▶ <b>${who}</b> ${fmt(clip.dur || 0)} <small>${ago(Math.max(0, Date.now() / 1000 - clip.tst))}</small>`;
      chip.addEventListener("click", () => playClip(clip, blob, true));
      history.prepend(chip);
      while (history.children.length > 5) history.removeChild(history.lastChild);
    }

    // ---- playback ----
    async function fetchBlob(clip) {
      const r = await fetch(`${API}?action=clip&id=${encodeURIComponent(clip.id)}`);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.blob();
    }
    function playBlob(blob) {
      return new Promise((resolve) => {
        const p = sfx.player;
        const url = URL.createObjectURL(blob);
        const done = () => { p.removeEventListener("ended", done); p.removeEventListener("error", done); URL.revokeObjectURL(url); resolve(); };
        p.addEventListener("ended", done); p.addEventListener("error", done);
        p.src = url;
        const pr = p.play(); if (pr && pr.catch) pr.catch(done);
      });
    }
    async function playClip(clip, blob, manual) {
      if (playing && !manual) { queue.push(clip); return; }
      playing = true;
      try {
        status(`${names[clip.from === role ? role : other]} is talking… 📻`, "is-receiving");
        sfx.squelch();
        await new Promise(r => setTimeout(r, 220));
        await playBlob(blob || await fetchBlob(clip));
        sfx.roger();
        status("Over! Press to answer.");
      } catch (e) {
        status("Couldn't play that one", "is-error");
      }
      playing = false;
      if (queue.length) playClip(queue.shift());
    }

    // ---- polling ----
    let first = true;
    async function poll() {
      try {
        const url = `${API}?action=list${first || !lastSeenId ? "" : "&since=" + encodeURIComponent(lastSeenId)}&_=${Date.now()}`;
        const j = await (await fetch(url, { cache: "no-store" })).json();
        if (first) {
          (j.clips || []).forEach(c => addChip(c));
          lastSeenId = j.latest_id || "";
          first = false;
          walkie.classList.add("is-online");
        } else {
          for (const c of (j.clips || [])) {
            if (c.id > lastSeenId) lastSeenId = c.id;
            addChip(c);
            if (c.from !== role) playClip(c);
          }
        }
      } catch (e) { walkie.classList.remove("is-online"); }
      setTimeout(poll, (document.hidden ? 15 : R.pollSeconds) * 1000);
    }
    poll();
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { /* next tick is soon anyway */ } });

    sfx.onUnlock(() => walkie.classList.add("sound-on"));
    setLabel();
    return { role, mode };
  }

  return { mount, sfx };
})();
