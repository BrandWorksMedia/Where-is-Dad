// ============================================================
//  Where is Dad?  —  app logic
//  Polls api/location.php, moves the truck, updates the words.
// ============================================================
(function () {
  const T = window.TRIP;
  const M = window.MAP;
  const L = T.landmarks;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);

  // ---------------- geometry helpers ----------------
  const R_MI = 3958.8;
  function haversine(a, b) {
    const toR = Math.PI / 180;
    const dLat = (b.lat - a.lat) * toR, dLon = (b.lon - a.lon) * toR;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) ** 2;
    return 2 * R_MI * Math.asin(Math.sqrt(h));
  }
  // cumulative road miles at each landmark
  const cum = [0];
  for (let i = 1; i < L.length; i++) cum[i] = cum[i - 1] + haversine(L[i - 1], L[i]);
  const TOTAL = cum[L.length - 1];

  // Project a point onto the route: returns {miles (progress), off (miles off the road), seg}
  function alongRoute(p) {
    const cosLat = Math.cos((p.lat * Math.PI) / 180);
    let best = { miles: 0, off: Infinity, seg: 0 };
    for (let i = 0; i < L.length - 1; i++) {
      const a = L[i], b = L[i + 1];
      // work in a flat local frame (good enough for these distances)
      const ax = (a.lon - p.lon) * cosLat, ay = a.lat - p.lat;
      const bx = (b.lon - p.lon) * cosLat, by = b.lat - p.lat;
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy || 1e-9;
      let t = -(ax * dx + ay * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const cx = ax + t * dx, cy = ay + t * dy;
      const off = Math.sqrt(cx * cx + cy * cy) * 69.0;   // degrees -> miles
      if (off < best.off) best = { miles: cum[i] + t * (cum[i + 1] - cum[i]), off, seg: i };
    }
    return best;
  }
  function nearest(p) {
    let bi = 0, bd = Infinity;
    L.forEach((l, i) => { const d = haversine(p, l); if (d < bd) { bd = d; bi = i; } });
    return { i: bi, d: bd };
  }
  const mi = (n) => Math.round(n).toLocaleString();
  const miles = (n) => mi(n) + (Math.round(n) === 1 ? " mile" : " miles");
  function hoursText(h) {
    if (h < 1 / 60) return "almost there!";
    if (h < 1) return Math.max(5, Math.round(h * 60 / 5) * 5) + " minutes";
    const hh = Math.floor(h), mm = Math.round((h - hh) * 60 / 15) * 15;
    if (mm === 60) return (hh + 1) + " hour" + (hh + 1 > 1 ? "s" : "");
    if (mm === 0) return hh + " hour" + (hh > 1 ? "s" : "");
    return hh + (mm === 30 ? "½" : mm === 15 ? "¼" : "¾") + " hours";
  }
  function agoText(sec) {
    if (sec < 45) return "just now";
    if (sec < 90) return "1 minute ago";
    if (sec < 3600) return Math.round(sec / 60) + " minutes ago";
    if (sec < 7200) return "1 hour ago";
    if (sec < 86400) return Math.round(sec / 3600) + " hours ago";
    return Math.round(sec / 86400) + " days ago";
  }

  // ---------------- build the map ----------------
  const mapEl = $("map");
  const built = M.render(L);
  mapEl.setAttribute("viewBox", built.viewBox);
  mapEl.innerHTML = built.svg;
  const truckPos = $("truck-pos");
  const truck = $("truck");
  const trailEl = $("trail");

  // progress bar landmarks
  const pb = $("pb-marks");
  L.forEach((l, i) => {
    if (l.minor) return;
    const d = document.createElement("div");
    d.className = "pb-mark";
    d.style.left = (cum[i] / TOTAL * 100) + "%";
    d.innerHTML = `<span class="pb-emoji">${l.emoji}</span>`;
    d.title = l.name;
    pb.appendChild(d);
  });

  // ---------------- state ----------------
  let last = null;        // last location object from server
  let facing = -1;        // -1 = west (left), 1 = east (right)
  let failures = 0;
  let arrivedShown = false;

  function placeTruck(lat, lon, cog, moving) {
    const p = M.proj(lon, lat);
    truckPos.setAttribute("transform", `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`);
    if (typeof cog === "number" && moving) facing = (cog > 180 || cog < 0) ? -1 : (cog < 180 && cog > 0 ? 1 : facing);
    // truck art faces west (left). heading 0..180 = eastward -> flip
    truck.setAttribute("transform", `scale(${facing === 1 ? -0.85 : 0.85},0.85)`);
    truck.classList.toggle("moving", !!moving);
  }

  function setHeadline(big, small, fact) {
    $("headline").textContent = big;
    $("subline").textContent = small || "";
    $("fact").textContent = fact || "";
  }
  function setStat(id, v) { $(id).textContent = v; }

  function highlightLandmark(i) {
    document.querySelectorAll(".landmark.active").forEach(e => e.classList.remove("active"));
    if (i >= 0) { const el = document.querySelector(`.landmark[data-i="${i}"]`); if (el) el.classList.add("active"); }
  }

  function updateDashboard(loc) {
    const now = Date.now() / 1000;
    const age = Math.max(0, now - loc.tst);
    const stale = age > T.staleMinutes * 60;
    const mph = loc.vel != null ? Math.round(loc.vel * 0.621371) : null;   // OwnTracks sends km/h
    const moving = !stale && mph != null && mph > 3;
    const p = { lat: loc.lat, lon: loc.lon };
    const ar = alongRoute(p);
    const nr = nearest(p);
    const done = Math.max(0, Math.min(TOTAL, ar.miles));
    const left = TOTAL - done;
    const finish = L[L.length - 1];
    const toFinish = haversine(p, finish);

    placeTruck(loc.lat, loc.lon, loc.cog, moving);
    stateWatch(loc.lat, loc.lon, stale);
    document.body.classList.toggle("stale", stale);
    document.body.classList.toggle("moving", moving);

    // progress bar
    $("pb-fill").style.width = (done / TOTAL * 100) + "%";
    $("pb-truck").style.left = (done / TOTAL * 100) + "%";
    setStat("miles-done", mi(done));
    setStat("miles-left", toFinish < T.arriveMiles ? "0" : mi(left));

    // stats
    setStat("speed", mph == null ? "–" : String(mph));
    setStat("updated", agoText(age));
    setStat("battery", loc.batt != null ? loc.batt + "%" : "–");
    const avg = Math.max(55, mph || 0);
    setStat("eta", toFinish < T.arriveMiles ? "He's here!" : hoursText(left / avg));

    // next stop = first landmark ahead on the route
    let nextI = L.findIndex((l, i) => cum[i] > done + 5);
    if (nextI < 0) nextI = L.length - 1;
    const prevI = Math.max(0, nextI - 1);
    const next = L[nextI];
    const arrived = toFinish < T.arriveMiles;
    setStat("next-name", next.emoji + " " + next.name);
    setStat("next-miles", arrived ? "you made it!" : miles(haversine(p, next)) + " away");

    // headline
    const D = T.driverName;
    if (toFinish < T.arriveMiles) {
      setHeadline(`${D} MADE IT TO ${finish.name.toUpperCase()}! 🎉`, `The whole trip: ${mi(TOTAL)} miles!`, finish.fact);
      highlightLandmark(L.length - 1);
      celebrate();
    } else if (stale) {
      setHeadline(`${D}'s phone is resting 😴`, `Last seen near ${L[nr.i].name}, ${agoText(age)}.`, "It will wake up when the truck moves again.");
      highlightLandmark(nr.i);
    } else if (ar.off > 30) {
      setHeadline(`${D} is exploring near ${L[nr.i].name}!`, `${mi(nr.d)} miles from ${L[nr.i].name}, ${L[nr.i].state}`, "That's a little detour off the big road.");
      highlightLandmark(nr.i);
    } else if (nr.d < T.nearMiles) {
      const l = L[nr.i];
      setHeadline(`${D} is near ${l.name}, ${l.state}! ${l.emoji}`, moving ? `Zooming along at ${mph} mph` : "The truck is parked right now.", l.fact);
      highlightLandmark(nr.i);
    } else {
      const a = L[prevI], b = L[nextI];
      setHeadline(`${D} is between ${a.name} and ${b.name}`, moving ? `Driving ${mph} mph toward ${b.name} ${b.emoji}` : "The truck is parked right now.", b.fact);
      highlightLandmark(nextI);
    }
  }

  function showWaiting() {
    const start = L[0];
    placeTruck(start.lat, start.lon, 270, false);
    setHeadline(`${T.driverName} hasn't left yet!`, `The truck is waiting in ${start.name} ${start.emoji}`, `The trip to ${L[L.length - 1].name} is ${mi(TOTAL)} miles long.`);
    highlightLandmark(0);
    $("pb-fill").style.width = "0%";
    $("pb-truck").style.left = "0%";
    setStat("miles-done", "0"); setStat("miles-left", mi(TOTAL));
    setStat("speed", "0"); setStat("updated", "waiting…"); setStat("battery", "–");
    setStat("eta", hoursText(TOTAL / 60)); setStat("next-name", L[1].emoji + " " + L[1].name);
    setStat("next-miles", mi(haversine(L[0], L[1])) + " miles away");
  }

  function drawTrail(points) {
    if (!points || !points.length) return;
    trailEl.setAttribute("points", points.map(q => { const p = M.proj(q.lon, q.lat); return p.x.toFixed(1) + "," + p.y.toFixed(1); }).join(" "));
  }

  // ---------------- horn (Web Audio, no sound files) ----------------
  // Browsers only allow sound after the first tap on the page.
  const horn = (function () {
    let ctx = null, unlocked = false;
    const pill = $("sound-pill");
    function unlock() {
      if (unlocked) return;
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        ctx.resume().then(() => {
          const o = ctx.createOscillator(), g = ctx.createGain(); g.gain.value = 0.0001;
          o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.05);
        });
        unlocked = true; pill.hidden = true;
      } catch (e) { /* no audio available */ }
    }
    ["touchend", "click", "keydown"].forEach(ev => document.addEventListener(ev, unlock, { passive: true }));
    setTimeout(() => { if (!unlocked && !params.has("quiet")) pill.hidden = false; }, 2000);

    // One cartoon honk: two detuned saw waves through a low-pass, with a quick envelope.
    function honk(at, dur) {
      const g = ctx.createGain(), f = ctx.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = 1400;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.5, at + 0.02);
      g.gain.setValueAtTime(0.5, at + dur - 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      [415, 523].forEach(fr => {
        const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = fr;
        o.connect(f); o.start(at); o.stop(at + dur + 0.05);
      });
      f.connect(g).connect(ctx.destination);
    }
    function play(pattern) {
      if (!unlocked || !ctx) return false;
      let t = ctx.currentTime + 0.05;
      for (const [d, gap] of pattern) { honk(t, d); t += d + gap; }
      return true;
    }
    return {
      beepBeep: () => play([[0.18, 0.12], [0.28, 0]]),
      arrival:  () => play([[0.15, 0.1], [0.15, 0.1], [0.15, 0.1], [0.9, 0]])
    };
  })();

  // ---------------- state-line crossings ----------------
  const stateWatch = (function () {
    let known = null;      // state id we last announced / started in
    let candidate = null, candidateHits = 0;
    try { known = localStorage.getItem("lastState") || null; } catch (e) {}
    const banner = $("state-banner");
    let hideTimer = null;
    function show(st) {
      $("sb-state").textContent = st.name.charAt(0) + st.name.slice(1).toLowerCase();
      banner.style.background = st.fill;
      banner.classList.remove("out"); banner.hidden = false;
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => { banner.classList.add("out"); setTimeout(() => { banner.hidden = true; }, 450); }, 12000);
    }
    return function update(lat, lon, stale) {
      if (!T.hornOnStateLines || stale) return;
      const st = M.stateAt(lon, lat);
      if (!st) return;                                   // over water / off the map: keep last state
      if (known === null) { known = st.id; try { localStorage.setItem("lastState", known); } catch (e) {} return; }
      if (st.id === known) { candidate = null; candidateHits = 0; return; }
      // need the new state twice in a row so a wobbly GPS point near a border doesn't honk
      if (candidate === st.id) candidateHits++; else { candidate = st.id; candidateHits = 1; }
      if (candidateHits < 2) return;
      known = st.id; candidate = null; candidateHits = 0;
      try { localStorage.setItem("lastState", known); } catch (e) {}
      show(st); horn.beepBeep();
    };
  })();

  // ---------------- confetti ----------------
  function celebrate() {
    if (arrivedShown) return;
    arrivedShown = true;
    document.body.classList.add("arrived");
    if (T.hornOnArrival) horn.arrival();
    const c = $("confetti");
    const colors = ["#ff5a5a", "#ffe66d", "#6dd3ff", "#8bff8b", "#ff9de2", "#ffb347"];
    for (let i = 0; i < 90; i++) {
      const s = document.createElement("i");
      s.style.left = Math.random() * 100 + "%";
      s.style.background = colors[i % colors.length];
      s.style.animationDelay = (Math.random() * 4) + "s";
      s.style.animationDuration = (4 + Math.random() * 4) + "s";
      s.style.transform = `rotate(${Math.random() * 360}deg)`;
      c.appendChild(s);
    }
  }

  // ---------------- polling ----------------
  async function poll() {
    try {
      const r = await fetch("api/location.php?history=1&_=" + Date.now(), { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      failures = 0;
      $("offline").hidden = true;
      if (j.status === "waiting" || !j.latest) { showWaiting(); return; }
      last = j.latest;
      updateDashboard(last);
      drawTrail(j.history);
    } catch (e) {
      failures++;
      if (failures >= 3) $("offline").hidden = false;
      if (last) updateDashboard(last);   // keep the "ago" text ticking
    }
  }

  // ---------------- demo mode ----------------
  // Open index.html?demo=1 to watch a pretend trip (about 3 minutes long).
  function demo() {
    $("demo-badge").hidden = false;
    let miles = 0, t0 = Date.now();
    const hist = [];
    function at(m) {
      let i = 0; while (i < L.length - 2 && cum[i + 1] < m) i++;
      const f = (m - cum[i]) / (cum[i + 1] - cum[i]);
      const lat = L[i].lat + f * (L[i + 1].lat - L[i].lat);
      const lon = L[i].lon + f * (L[i + 1].lon - L[i].lon) + (Math.sin(m / 7) * 0.02);
      const cog = (Math.atan2(L[i + 1].lon - L[i].lon, L[i + 1].lat - L[i].lat) * 180 / Math.PI + 360) % 360;
      return { lat, lon, cog };
    }
    setInterval(() => {
      const sec = (Date.now() - t0) / 1000;
      const speedMph = miles >= TOTAL ? 0 : 60 + 12 * Math.sin(sec / 5);
      miles = Math.min(TOTAL, miles + speedMph * 8 / 60);       // every real second = 8 pretend minutes of driving
      const q = at(miles);
      const loc = { lat: q.lat, lon: q.lon, cog: q.cog, vel: Math.round(speedMph / 0.621371), tst: Date.now() / 1000, batt: Math.max(20, 100 - Math.round(sec / 4)) };
      hist.push({ lat: q.lat, lon: q.lon });
      last = loc;
      updateDashboard(loc);
      drawTrail(hist);
    }, 1000);
  }

  // ---------------- big-map mode ----------------
  // One tap hides everything but the map; the choice survives reloads.
  (function () {
    const btn = $("fullmap-btn");
    let on = false;
    try { on = localStorage.getItem("fullmap") === "1"; } catch (e) {}
    function apply() {
      document.body.classList.toggle("fullmap", on);
      btn.setAttribute("aria-label", on ? "Show everything" : "Big map");
      btn.title = on ? "Show everything" : "Big map";
    }
    btn.addEventListener("click", () => {
      on = !on;
      try { localStorage.setItem("fullmap", on ? "1" : "0"); } catch (e) {}
      apply();
    });
    apply();
  })();

  // ---------------- clock + housekeeping ----------------
  function tickClock() {
    const d = new Date();
    $("clock").textContent = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  tickClock(); setInterval(tickClock, 10000);
  setTimeout(() => location.reload(), 12 * 3600 * 1000);   // fresh page twice a day

  $("greeting").textContent = `Hi ${T.kidName}!`;
  $("eta-label").textContent = `left until ${L[L.length - 1].name}`;
  $("driver-name").textContent = T.driverName;
  document.title = `Where is ${T.driverName}?`;

  if (params.has("demo")) { demo(); }
  else { showWaiting(); poll(); setInterval(poll, T.pollSeconds * 1000); }
})();
