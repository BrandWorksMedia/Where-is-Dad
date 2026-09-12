// ============================================================
//  Where is Dad?  —  the cartoon map
//  Draws a simple, hand-drawn-looking Gulf Coast in SVG using
//  real latitude/longitude so the truck lands in the right spot.
// ============================================================

window.MAP = (function () {
  // Map window (degrees).  Miami sits near the bottom-right, Tomball at the left.
  const LON_MIN = -96.6, LON_MAX = -78.9;
  const LAT_MIN = 24.5, LAT_MAX = 31.8;
  const COS = Math.cos((28.2 * Math.PI) / 180);   // squish longitude like a real map
  const S = 100;                                   // pixels per degree of latitude
  const W = Math.round((LON_MAX - LON_MIN) * COS * S);
  const H = Math.round((LAT_MAX - LAT_MIN) * S);

  function proj(lon, lat) {
    return { x: (lon - LON_MIN) * COS * S, y: (LAT_MAX - lat) * S };
  }
  function pts(list) {
    return list.map(([lon, lat]) => { const p = proj(lon, lat); return p.x.toFixed(1) + "," + p.y.toFixed(1); }).join(" ");
  }

  // ---- Coastline pieces (lon, lat), drawn west -> east ----------------------
  const coastTX = [[-96.6,28.42],[-96.4,28.45],[-96.2,28.6],[-95.98,28.62],[-95.75,28.72],[-95.55,28.8],[-95.35,28.9],[-95.15,29.0],[-95.0,29.15],
    [-94.85,29.28],[-94.95,29.45],[-95.0,29.62],[-94.9,29.72],[-94.75,29.62],[-94.68,29.45],[-94.55,29.45],[-94.4,29.52],[-94.2,29.6],[-94.0,29.67],[-93.85,29.7]];
  const coastLA = [[-93.85,29.7],[-93.6,29.76],[-93.35,29.77],[-93.1,29.75],[-92.85,29.7],[-92.6,29.6],[-92.3,29.55],[-92.05,29.6],[-91.85,29.5],[-91.65,29.6],
    [-91.5,29.55],[-91.3,29.35],[-91.1,29.25],[-90.9,29.15],[-90.7,29.1],[-90.45,29.1],[-90.25,29.1],[-90.05,29.2],[-89.85,29.3],[-89.65,29.25],[-89.45,29.15],
    [-89.25,29.0],[-89.1,28.95],[-89.05,29.15],[-89.25,29.35],[-89.4,29.5],[-89.55,29.6],[-89.7,29.7],[-89.6,29.85],[-89.45,29.95],[-89.55,30.1],[-89.55,30.2]];
  const coastMS = [[-89.55,30.2],[-89.4,30.27],[-89.25,30.31],[-89.1,30.35],[-88.95,30.36],[-88.8,30.37],[-88.65,30.35],[-88.5,30.33],[-88.4,30.38]];
  const coastAL = [[-88.4,30.38],[-88.25,30.4],[-88.1,30.32],[-88.02,30.45],[-88.0,30.6],[-88.05,30.68],[-87.95,30.62],[-87.9,30.48],[-87.85,30.35],[-87.75,30.25],[-87.65,30.27],[-87.55,30.28]];
  const coastFL = [[-87.55,30.28],[-87.4,30.32],[-87.25,30.35],[-87.1,30.38],[-86.95,30.38],[-86.8,30.4],[-86.6,30.4],[-86.45,30.38],[-86.25,30.35],[-86.05,30.3],
    [-85.85,30.22],[-85.7,30.15],[-85.55,30.0],[-85.45,29.8],[-85.4,29.68],[-85.25,29.68],[-85.1,29.7],[-84.95,29.72],[-84.8,29.75],[-84.65,29.85],[-84.5,29.9],
    [-84.35,29.95],[-84.2,30.05],[-84.05,30.08],[-83.9,29.95],[-83.75,29.9],[-83.6,29.8],[-83.45,29.7],[-83.35,29.55],[-83.2,29.4],[-83.1,29.25],[-83.0,29.1],
    [-82.85,29.0],[-82.7,28.9],[-82.7,28.75],[-82.7,28.55],[-82.75,28.4],[-82.8,28.2],[-82.85,28.0],[-82.8,27.85],[-82.7,27.7],[-82.65,27.6],[-82.55,27.75],
    [-82.45,27.9],[-82.4,27.75],[-82.55,27.55],[-82.6,27.4],[-82.55,27.25],[-82.5,27.1],[-82.4,26.95],[-82.25,26.8],[-82.1,26.65],[-82.0,26.5],[-81.9,26.35],
    [-81.8,26.15],[-81.75,26.0],[-81.7,25.85],[-81.55,25.75],[-81.4,25.65],[-81.25,25.5],[-81.15,25.3],[-81.1,25.15],[-80.95,25.13],[-80.8,25.18],[-80.65,25.2],
    [-80.5,25.25],[-80.4,25.35],[-80.32,25.5],[-80.25,25.62],[-80.15,25.75],[-80.12,25.9],[-80.1,26.1],[-80.07,26.3],[-80.04,26.5],[-80.03,26.7],[-80.06,26.9],
    [-80.12,27.1],[-80.2,27.3],[-80.3,27.5],[-80.4,27.7],[-80.5,27.9],[-80.58,28.1],[-80.6,28.3],[-80.58,28.45],[-80.65,28.6],[-80.75,28.8],[-80.85,29.0],
    [-80.95,29.15],[-81.05,29.35],[-81.15,29.55],[-81.25,29.75],[-81.3,29.9],[-81.38,30.1],[-81.42,30.3],[-81.45,30.5],[-81.45,30.7]];
  const coastGA = [[-81.45,30.7],[-81.45,30.9],[-81.4,31.1],[-81.3,31.3],[-81.2,31.5],[-81.1,31.65],[-81.05,31.8]];

  // ---- State borders ---------------------------------------------------------
  const bTXLA = [[-93.85,29.7],[-93.7,30.3],[-93.55,31.0],[-93.7,31.8]];
  const bLAMS = [[-89.55,30.2],[-89.7,30.6],[-89.75,31.0],[-91.6,31.0],[-91.45,31.8]];
  const bMSAL = [[-88.4,30.38],[-88.45,31.0],[-88.2,31.8]];
  const bALFL = [[-87.55,30.28],[-87.6,31.0],[-85.0,31.0],[-85.0,30.7]];
  const bALGA = [[-85.0,31.0],[-85.05,31.8]];
  const bFLGA = [[-85.0,30.7],[-82.05,30.6],[-81.8,30.45],[-81.45,30.7]];

  const rev = (a) => a.slice().reverse();

  const states = [
    { id: "TX", name: "TEXAS", fill: "#ffe08a", labelAt: [-95.4, 30.9],
      poly: [...coastTX, ...bTXLA, [-96.6, 31.8]] },
    { id: "LA", name: "LOUISIANA", fill: "#d9c8ff", labelAt: [-92.2, 31.05],
      poly: [...coastLA, ...bLAMS, [-93.7, 31.8], ...rev(bTXLA).slice(1)] },
    { id: "MS", name: "MISSISSIPPI", fill: "#ffc9a8", labelAt: [-89.85, 31.42],
      poly: [...coastMS, ...bMSAL, [-91.45, 31.8], ...rev(bLAMS).slice(1)] },
    { id: "AL", name: "ALABAMA", fill: "#c6f0c2", labelAt: [-86.75, 31.42],
      poly: [...coastAL, ...bALFL.slice(0, 3), ...bALGA, [-88.2, 31.8], ...rev(bMSAL).slice(1)] },
    { id: "GA", name: "GEORGIA", fill: "#ffd6e8", labelAt: [-83.2, 31.35],
      poly: [[-85.05, 31.8], [-85.0, 31.0], ...bFLGA, ...coastGA] },
    { id: "FL", name: "FLORIDA", fill: "#b6ee9b", labelAt: [-81.85, 28.35],
      poly: [...coastFL, ...rev(bFLGA).slice(1), [-85.0, 31.0], [-87.6, 31.0]] }
  ];

  // Sea, lakes, decorations (lon, lat)
  const lakes = [
    { lon: -80.8, lat: 26.95, rx: 0.33, ry: 0.33 },   // Lake Okeechobee
    { lon: -90.1, lat: 30.2, rx: 0.36, ry: 0.15 }     // Lake Pontchartrain
  ];
  const seaLabels = [
    { text: "GULF OF MEXICO", lon: -88.4, lat: 27.3, size: 40 },
    { text: "ATLANTIC OCEAN", lon: -79.25, lat: 27.9, size: 26, rotate: -90 }
  ];
  const doodles = [
    { e: "🐬", lon: -90.5, lat: 28.3, size: 44, cls: "bob" },
    { e: "⛵", lon: -85.6, lat: 27.9, size: 46, cls: "bob slow" },
    { e: "🐟", lon: -84.3, lat: 26.3, size: 32, cls: "bob" },
    { e: "🐢", lon: -79.4, lat: 25.5, size: 34, cls: "bob slow" },
    { e: "🦩", lon: -81.0, lat: 25.75, size: 34 },
    { e: "🍑", lon: -83.25, lat: 30.95, size: 30 },
    { e: "🌲", lon: -84.6, lat: 30.9, size: 30 },
    { e: "🌲", lon: -86.3, lat: 30.75, size: 26 },
    { e: "🐄", lon: -95.8, lat: 31.35, size: 30 },
    { e: "🌵", lon: -96.2, lat: 29.7, size: 30 },
    { e: "🎸", lon: -93.15, lat: 31.55, size: 28 },
    { e: "🍤", lon: -88.2, lat: 29.55, size: 28, cls: "bob" },
    { e: "☀️", lon: -79.7, lat: 31.3, size: 72, cls: "sun" },
    { e: "☁️", lon: -94.6, lat: 27.6, size: 60, cls: "cloud c1" },
    { e: "☁️", lon: -83.6, lat: 25.2, size: 52, cls: "cloud c2" },
    { e: "☁️", lon: -92.6, lat: 29.2, size: 48, cls: "cloud c3" }
  ];

  function emojiAt(e, lon, lat, size, cls, extra) {
    const p = proj(lon, lat);
    return `<text class="doodle ${cls || ""}" style="--fs:${size}px" x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" font-size="${size}" text-anchor="middle" dominant-baseline="central" ${extra || ""}>${e}</text>`;
  }

  // ---- The truck: a white Toyota Tacoma, side view, facing LEFT (west) ------
  // Origin is the ground point between the wheels.
  function truckSVG() {
    return `
    <g id="truck" class="truck">
      <circle class="tap-target" cx="0" cy="-30" r="95" fill="transparent"/>
      <ellipse class="shadow" cx="0" cy="4" rx="74" ry="8"/>
      <g class="puffs">
        <circle class="puff p1" cx="72" cy="-16" r="6"/>
        <circle class="puff p2" cx="84" cy="-20" r="8"/>
        <circle class="puff p3" cx="98" cy="-26" r="10"/>
      </g>
      <g class="body-bounce">
        <!-- bed cargo -->
        <rect x="24" y="-62" width="26" height="16" rx="3" fill="#c98a4b" stroke="#333" stroke-width="3"/>
        <line x1="37" y1="-62" x2="37" y2="-46" stroke="#333" stroke-width="3"/>
        <text x="55" y="-56" font-size="20" text-anchor="middle" dominant-baseline="central">🎒</text>
        <!-- truck body -->
        <path class="paint" d="M -66,-16 L -66,-40 Q -66,-46 -60,-46 L -34,-46 L -22,-70 Q -20,-74 -14,-74 L 12,-74 L 12,-48 L 62,-48 Q 66,-48 66,-44 L 66,-14 Q 66,-10 62,-10 L -62,-10 Q -66,-10 -66,-16 Z"/>
        <!-- bed rail + cab back line -->
        <line x1="12" y1="-48" x2="12" y2="-10" stroke="#333" stroke-width="3"/>
        <line x1="-66" y1="-40" x2="-34" y2="-40" stroke="#333" stroke-width="2" opacity=".35"/>
        <!-- window -->
        <path d="M -29,-46 L -19,-66 L 8,-66 L 8,-46 Z" fill="#a9e2ff" stroke="#333" stroke-width="3"/>
        <!-- Dad -->
        <circle cx="-4" cy="-56" r="7" fill="#f2c49b" stroke="#333" stroke-width="2"/>
        <path d="M -11,-58 Q -4,-66 3,-58 Z" fill="#333"/>
        <path d="M -7,-54 Q -4,-51 -1,-54" stroke="#333" stroke-width="1.5" fill="none"/>
        <!-- lights + bumper + door handle -->
        <rect x="-70" y="-22" width="12" height="9" rx="3" fill="#8f979e" stroke="#333" stroke-width="2"/>
        <circle cx="-61" cy="-31" r="4" fill="#ffe66d" stroke="#333" stroke-width="2"/>
        <rect x="60" y="-34" width="6" height="8" rx="2" fill="#ff5a5a" stroke="#333" stroke-width="2"/>
        <rect x="-8" y="-38" width="10" height="3" rx="1.5" fill="#333"/>
        <line x1="-19" y1="-46" x2="-19" y2="-10" stroke="#333" stroke-width="2" opacity=".35"/>
      </g>
      <!-- wheels -->
      <g class="wheel" transform="translate(-40,-8)">
        <circle r="14" fill="#333"/><circle r="6" fill="#cfd6dc" stroke="#333" stroke-width="2"/>
        <g class="spokes"><line x1="-6" y1="0" x2="6" y2="0" stroke="#333" stroke-width="2"/><line x1="0" y1="-6" x2="0" y2="6" stroke="#333" stroke-width="2"/></g>
      </g>
      <g class="wheel" transform="translate(42,-8)">
        <circle r="14" fill="#333"/><circle r="6" fill="#cfd6dc" stroke="#333" stroke-width="2"/>
        <g class="spokes"><line x1="-6" y1="0" x2="6" y2="0" stroke="#333" stroke-width="2"/><line x1="0" y1="-6" x2="0" y2="6" stroke="#333" stroke-width="2"/></g>
      </g>
    </g>`;
  }

  // ---- Build the whole map ---------------------------------------------------
  function render(landmarks) {
    let s = "";

    // states
    for (const st of states) {
      s += `<polygon class="state" data-state="${st.id}" fill="${st.fill}" points="${pts(st.poly)}"/>`;
    }
    for (const st of states) {
      const p = proj(st.labelAt[0], st.labelAt[1]);
      s += `<text class="state-name" style="--fs:26px" x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}">${st.name}</text>`;
    }
    // lakes
    for (const l of lakes) {
      const p = proj(l.lon, l.lat);
      s += `<ellipse class="lake" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" rx="${(l.rx * COS * S).toFixed(1)}" ry="${(l.ry * S).toFixed(1)}"/>`;
    }
    // sea labels
    for (const t of seaLabels) {
      const p = proj(t.lon, t.lat);
      const rot = t.rotate ? ` transform="rotate(${t.rotate} ${p.x.toFixed(1)} ${p.y.toFixed(1)})"` : "";
      s += `<text class="sea-name" style="--fs:${t.size}px" x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" font-size="${t.size}"${rot}>${t.text}</text>`;
    }
    // the road
    const roadPts = pts(landmarks.map(l => [l.lon, l.lat]));
    s += `<polyline class="road-edge" points="${roadPts}"/>`;
    s += `<polyline class="road" points="${roadPts}"/>`;
    s += `<polyline class="road-dash" points="${roadPts}"/>`;
    // breadcrumb trail (filled in later by app.js)
    s += `<polyline id="trail" class="trail" points=""/>`;
    // doodles
    for (const d of doodles) s += emojiAt(d.e, d.lon, d.lat, d.size, d.cls);
    // landmarks
    landmarks.forEach((l, i) => {
      if (l.waypoint) return;                      // bends in the road, not stops
      const p = proj(l.lon, l.lat);
      const big = !l.minor;
      const r = big ? 9 : 5;
      const size = big ? 40 : 24;
      const fs = big ? 22 : 15;
      let tx = p.x, ty, anchor = "middle";
      const lab = l.label || "below";
      if (lab === "above") ty = p.y - size * 0.75 - 6;
      else if (lab === "right") { tx = p.x + size * 0.6 + 4; ty = p.y - size * 0.45; anchor = "start"; }
      else if (lab === "left") { tx = p.x - size * 0.6 - 4; ty = p.y - size * 0.45; anchor = "end"; }
      else ty = p.y + size * 0.75 + fs * 0.6;
      s += `<g class="landmark ${big ? "big" : "minor"}" data-i="${i}">`;
      s += `<circle class="pin" style="--r:${r}px" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}"/>`;
      s += `<text class="lm-emoji" style="--fs:${size}px" x="${p.x.toFixed(1)}" y="${(p.y - size * 0.55).toFixed(1)}" font-size="${size}" text-anchor="middle" dominant-baseline="central">${l.emoji}</text>`;
      if (lab !== "none") s += `<text class="lm-name" style="--fs:${fs}px" x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" font-size="${fs}" text-anchor="${anchor}">${l.short || l.name}</text>`;
      s += `</g>`;
    });
    // truck goes on top
    s += `<g id="truck-pos" class="truck-pos" transform="translate(-1000,-1000)"><g class="truck-hop">${truckSVG()}</g></g>`;
    return { svg: s, viewBox: `0 0 ${W} ${H}`, W, H };
  }

  // Bounding box of a state in map (SVG) units, for zooming.
  function stateBounds(id) {
    const st = states.find(s => s.id === id);
    if (!st) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [lon, lat] of st.poly) {
      const p = proj(lon, lat);
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, name: st.name, fill: st.fill };
  }

  // Which state is this point in?  Ray casting against the cartoon polygons.
  function stateAt(lon, lat) {
    for (const st of states) {
      const p = st.poly; let inside = false;
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        const [xi, yi] = p[i], [xj, yj] = p[j];
        if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) return { id: st.id, name: st.name, fill: st.fill };
    }
    return null;
  }

  return { proj, render, stateAt, stateBounds, W, H, LON_MIN, LON_MAX, LAT_MIN, LAT_MAX };
})();
