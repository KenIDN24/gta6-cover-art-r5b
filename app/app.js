"use strict";
/* VICE FRAME Cover Studio — a GTA-style cover art maker that runs fully
 * offline. Photos are read on the visitor's own machine and never leave
 * it; the sample cast is drawn in code. Everything renders to one canvas
 * pipeline, so the on-screen preview and the exported PNG are the same
 * drawing at different sizes. */

const SIZES = {
  poster: { w: 1200, h: 1800, label: "Poster" },
  square: { w: 1440, h: 1440, label: "Square" },
  story: { w: 1080, h: 1920, label: "Story" },
  wide: { w: 1920, h: 1080, label: "Wide" },
};

/* Thirteen colour grades. `filter` is a canvas/CSS filter chain applied
 * to each photo panel; `tint` is washed over the whole cover; `vig`
 * scales the vignette the grade wants. */
const GRADES = [
  { id: "vice-sunset", name: "Vice Sunset", filter: "saturate(1.35) contrast(1.08) brightness(1.03)", tint: "#ff7a3d", vig: 0.55 },
  { id: "neon-noir", name: "Neon Noir", filter: "saturate(1.5) contrast(1.22) brightness(0.94)", tint: "#ff2e88", vig: 0.8 },
  { id: "golden-hour", name: "Golden Hour", filter: "sepia(0.32) saturate(1.3) contrast(1.05) brightness(1.06)", tint: "#ffb347", vig: 0.45 },
  { id: "teal-heat", name: "Teal Heat", filter: "hue-rotate(-12deg) saturate(1.4) contrast(1.12)", tint: "#0fb5a8", vig: 0.6 },
  { id: "bw-grit", name: "B&W Grit", filter: "grayscale(1) contrast(1.3) brightness(1.02)", tint: "#888888", vig: 0.85 },
  { id: "pastel-vice", name: "Pastel Vice", filter: "saturate(0.85) brightness(1.12) contrast(0.92)", tint: "#f7a8c4", vig: 0.3 },
  { id: "midnight-chrome", name: "Midnight Chrome", filter: "saturate(0.7) contrast(1.18) brightness(0.9) hue-rotate(8deg)", tint: "#3d5a99", vig: 0.9 },
  { id: "coral-heat", name: "Coral Heat", filter: "sepia(0.18) saturate(1.55) contrast(1.1)", tint: "#ff5a4d", vig: 0.5 },
  { id: "ultra-violet", name: "Ultra Violet", filter: "hue-rotate(24deg) saturate(1.45) contrast(1.14)", tint: "#7a1fa2", vig: 0.7 },
  { id: "mono-ink", name: "Mono Ink", filter: "grayscale(0.85) contrast(1.45) brightness(0.98)", tint: "#222222", vig: 0.75 },
  { id: "tropical-pop", name: "Tropical Pop", filter: "saturate(1.7) contrast(1.06) brightness(1.05)", tint: "#19c37d", vig: 0.4 },
  { id: "desert-dusk", name: "Desert Dusk", filter: "sepia(0.45) saturate(1.05) contrast(1.08) brightness(0.97)", tint: "#c97b2d", vig: 0.65 },
  { id: "arctic-neon", name: "Arctic Neon", filter: "hue-rotate(-28deg) saturate(1.3) contrast(1.1) brightness(1.04)", tint: "#25d5f5", vig: 0.55 },
];

/* The sample cast: eight original vector characters, each a palette and
 * a backdrop. Portraits are drawn by drawCastPortrait() below. */
const CAST = [
  { name: "Lucia", role: "THE LEAD", skin: "#b5714a", hair: "#241118", hairStyle: "long", jacket: "#c2245e", shirt: "#f5f0e6", sky: ["#ff9a5a", "#ff2e88"], scene: "palms", shades: false },
  { name: "Jason", role: "THE DRIVER", skin: "#c98a5e", hair: "#17130f", hairStyle: "cap", jacket: "#274b63", shirt: "#dfe7ee", sky: ["#ffd76a", "#ff7a3d"], scene: "strip", shades: true },
  { name: "Marco", role: "THE FIXER", skin: "#8a5636", hair: "#0e0c0a", hairStyle: "slick", jacket: "#20222b", shirt: "#b08d3f", sky: ["#7a1fa2", "#1d1233"], scene: "towers", shades: true },
  { name: "Vera", role: "THE SIREN", skin: "#e0aa7e", hair: "#5a1f16", hairStyle: "waves", jacket: "#0fb5a8", shirt: "#101018", sky: ["#25d5f5", "#0b3d66"], scene: "ocean", shades: false },
  { name: "Dex", role: "THE WHEELMAN", skin: "#6e4526", hair: "#000000", hairStyle: "fade", jacket: "#d9481f", shirt: "#f5f0e6", sky: ["#ffb347", "#c2245e"], scene: "strip", shades: false },
  { name: "Rosa", role: "THE SMUGGLER", skin: "#a0653c", hair: "#2c1503", hairStyle: "bun", jacket: "#5b2a86", shirt: "#ffd76a", sky: ["#ff7a3d", "#7a1fa2"], scene: "palms", shades: false },
  { name: "Kane", role: "THE MUSCLE", skin: "#d9a066", hair: "#3a2a18", hairStyle: "buzz", jacket: "#31413a", shirt: "#20222b", sky: ["#3d5a99", "#101828"], scene: "towers", shades: true },
  { name: "Palm", role: "THE GHOST", skin: "#8a5636", hair: "#e8e2d4", hairStyle: "long", jacket: "#e8e2d4", shirt: "#c2245e", sky: ["#f7a8c4", "#25d5f5"], scene: "ocean", shades: true },
];

const state = {
  photos: [],          // {id, name, role, source(canvas|img), w, h}
  layout: "hero-popout",
  grade: GRADES[0],
  size: "wide",
  titleStyle: "chrome",
  title: "VICE FRAME",
  subtitle: "LEONIDA HEAT",
  billing: "",
  tint: true, grain: true, vignette: true,
  selectedPanel: 0,
  slots: [],           // per panel: {photoId, dx, dy, zoom, role}
};

const $ = (id) => document.getElementById(id);
const stage = $("stage");
let previewPanels = []; // panel rects in preview-canvas pixels, for hit tests

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function gradeById(id) { return GRADES.find((g) => g.id === id) || GRADES[0]; }

/* ---------- sample cast portraits, drawn in code ---------- */

function drawPalm(ctx, x, y, s, color) {
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = 7 * s;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 8 * s, y - 60 * s, x + 20 * s, y - 96 * s); ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * (0.08 + i * 0.16);
    ctx.lineWidth = 5 * s;
    ctx.beginPath();
    ctx.moveTo(x + 20 * s, y - 96 * s);
    ctx.quadraticCurveTo(
      x + 20 * s + Math.cos(a) * 44 * s, y - 96 * s - Math.sin(a) * 30 * s - 12 * s,
      x + 20 * s + Math.cos(a) * 74 * s, y - 96 * s - Math.sin(a) * 38 * s + 16 * s);
    ctx.stroke();
  }
}

function drawScene(ctx, spec, W, H) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, spec.sky[0]); sky.addColorStop(1, spec.sky[1]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  // striped retro sun
  const sx = W * 0.68, sy = H * 0.3, sr = W * 0.21;
  ctx.save();
  ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.clip();
  const sun = ctx.createLinearGradient(0, sy - sr, 0, sy + sr);
  sun.addColorStop(0, "#ffe259"); sun.addColorStop(1, "#ff7518");
  ctx.fillStyle = sun; ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  ctx.fillStyle = "rgba(20,8,32,0.55)";
  for (let i = 0; i < 4; i++) ctx.fillRect(sx - sr, sy + sr * (0.08 + i * 0.22), sr * 2, sr * 0.07);
  ctx.restore();
  ctx.fillStyle = "rgba(16,6,28,0.8)";
  if (spec.scene === "palms") {
    drawPalm(ctx, W * 0.1, H * 0.62, 1.15, "#160a24");
    drawPalm(ctx, W * 0.9, H * 0.58, 0.85, "#160a24");
    ctx.fillRect(0, H * 0.6, W, H * 0.4);
  } else if (spec.scene === "towers") {
    const base = H * 0.62;
    [0.02, 0.16, 0.78, 0.9].forEach((fx, i) => {
      const bw = W * 0.13, bh = H * (0.3 + (i % 3) * 0.09);
      ctx.fillRect(W * fx, base - bh, bw, bh + H * 0.4);
      ctx.fillStyle = "rgba(255,214,120,0.85)";
      for (let wy = base - bh + 12; wy < base - 14; wy += 22)
        for (let wx = W * fx + 8; wx < W * fx + bw - 10; wx += 16)
          if ((wx * wy) % 3 !== 0) ctx.fillRect(wx, wy, 6, 8);
      ctx.fillStyle = "rgba(16,6,28,0.8)";
    });
    ctx.fillRect(0, base, W, H - base);
  } else if (spec.scene === "ocean") {
    ctx.fillStyle = "rgba(8,40,66,0.85)"; ctx.fillRect(0, H * 0.6, W, H * 0.4);
    ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(W * (0.06 + i * 0.17), H * (0.68 + (i % 2) * 0.07));
      ctx.lineTo(W * (0.16 + i * 0.17), H * (0.68 + (i % 2) * 0.07));
      ctx.stroke();
    }
  } else { // strip: boulevard + low skyline
    ctx.fillRect(0, H * 0.56, W * 0.3, H * 0.1); ctx.fillRect(W * 0.62, H * 0.5, W * 0.38, H * 0.16);
    ctx.fillStyle = "rgba(10,6,20,0.9)"; ctx.fillRect(0, H * 0.64, W, H * 0.36);
    ctx.fillStyle = "#ffd76a";
    for (let i = 0; i < 7; i++) ctx.fillRect(W * (0.05 + i * 0.14), H * 0.7, W * 0.05, 5);
  }
}

function drawCastPortrait(spec) {
  const W = 600, H = 760;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  drawScene(ctx, spec, W, H);
  const cx = W / 2;
  // shoulders + jacket
  ctx.fillStyle = spec.jacket;
  ctx.beginPath();
  ctx.moveTo(cx - 215, H); ctx.quadraticCurveTo(cx - 205, H * 0.66, cx - 108, H * 0.615);
  ctx.lineTo(cx + 108, H * 0.615); ctx.quadraticCurveTo(cx + 205, H * 0.66, cx + 215, H);
  ctx.closePath(); ctx.fill();
  // shirt V
  ctx.fillStyle = spec.shirt;
  ctx.beginPath();
  ctx.moveTo(cx - 62, H * 0.63); ctx.lineTo(cx + 62, H * 0.63); ctx.lineTo(cx, H * 0.86);
  ctx.closePath(); ctx.fill();
  // jacket lapels
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath(); ctx.moveTo(cx - 108, H * 0.615); ctx.lineTo(cx - 30, H * 0.7); ctx.lineTo(cx - 66, H); ctx.lineTo(cx - 150, H); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx + 108, H * 0.615); ctx.lineTo(cx + 30, H * 0.7); ctx.lineTo(cx + 66, H); ctx.lineTo(cx + 150, H); ctx.closePath(); ctx.fill();
  // neck + head
  ctx.fillStyle = spec.skin;
  ctx.fillRect(cx - 30, H * 0.47, 60, H * 0.15);
  ctx.beginPath(); ctx.ellipse(cx, H * 0.36, 86, 104, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.13)";
  ctx.beginPath(); ctx.ellipse(cx, H * 0.435, 60, 26, 0, 0, Math.PI); ctx.fill();
  // hair, by style
  ctx.fillStyle = spec.hair;
  const top = H * 0.36 - 104;
  if (spec.hairStyle === "long") {
    // two strands framing the face, plus a cap over the crown — drawn
    // after the head, so the strands must stay clear of the face itself
    ctx.beginPath(); ctx.roundRect(cx - 106, top + 4, 42, H * 0.47, 20); ctx.fill();
    ctx.beginPath(); ctx.roundRect(cx + 64, top + 4, 42, H * 0.47, 20); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, top + 18, 90, 42, 0, Math.PI, Math.PI * 2); ctx.fill();
  } else if (spec.hairStyle === "waves") {
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(cx - 70 + i * 35, top + 14, 26, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillRect(cx - 100, top + 6, 34, H * 0.3); ctx.fillRect(cx + 66, top + 6, 34, H * 0.3);
  } else if (spec.hairStyle === "bun") {
    ctx.beginPath(); ctx.arc(cx, top - 16, 34, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, top + 22, 88, 34, 0, Math.PI, Math.PI * 2); ctx.fill();
  } else if (spec.hairStyle === "cap") {
    ctx.beginPath(); ctx.ellipse(cx, top + 26, 92, 40, 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillRect(cx - 96, top + 22, 192, 14);
    ctx.fillStyle = "#101018"; ctx.fillRect(cx + 30, top + 30, 110, 12);
  } else if (spec.hairStyle === "slick") {
    ctx.beginPath(); ctx.ellipse(cx, top + 20, 88, 36, 0, Math.PI, Math.PI * 2); ctx.fill();
  } else if (spec.hairStyle === "fade") {
    ctx.beginPath(); ctx.ellipse(cx, top + 26, 86, 30, 0, Math.PI, Math.PI * 2); ctx.fill();
  } else { // buzz
    ctx.beginPath(); ctx.ellipse(cx, top + 24, 87, 33, 0, Math.PI, Math.PI * 2); ctx.fill();
  }
  if (spec.shades) {
    ctx.fillStyle = "#0c0c12";
    ctx.fillRect(cx - 76, H * 0.345, 64, 30); ctx.fillRect(cx + 12, H * 0.345, 64, 30);
    ctx.fillRect(cx - 12, H * 0.352, 24, 8);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(cx - 66, H * 0.35, 22, 7); ctx.fillRect(cx + 22, H * 0.35, 22, 7);
  }
  return c;
}

function seedCast() {
  state.photos = CAST.map((spec, i) => {
    const art = drawCastPortrait(spec);
    return { id: "cast-" + i, name: spec.name, role: spec.role, source: art, w: art.width, h: art.height };
  });
}

/* ---------- layouts: panel geometry in normalised cover coords ------ */

const LAYOUTS = [
  { id: "hero-popout", name: "Hero Pop-Out" },
  { id: "classic-mosaic", name: "Classic Mosaic" },
  { id: "vice-strips", name: "Vice Strips" },
  { id: "diagonal-heat", name: "Diagonal Heat" },
  { id: "wanted-poster", name: "Wanted Poster" },
  { id: "duo-split", name: "Duo Split" },
  { id: "trio-columns", name: "Trio Columns" },
  { id: "ensemble-3x3", name: "Ensemble 3×3" },
  { id: "cover-star", name: "Cover Star" },
  { id: "comic-panels", name: "Comic Panels" },
  { id: "mirror-duo", name: "Mirror Duo" },
  { id: "headline-grid", name: "Headline Grid" },
  { id: "quad-squad", name: "Quad Squad" },
];

function rect(x, y, w, h, extra) { return Object.assign({ x, y, w, h }, extra || {}); }

function panelsFor(layoutId) {
  switch (layoutId) {
    case "hero-popout":
      return [
        rect(0, 0, 0.52, 1, { popOut: true }),
        rect(0.52, 0, 0.48, 0.52),
        rect(0.52, 0.52, 0.48, 0.48),
      ];
    case "classic-mosaic":
      return [
        rect(0, 0, 0.58, 0.62), rect(0.58, 0, 0.42, 0.62),
        rect(0, 0.62, 0.34, 0.38), rect(0.34, 0.62, 0.33, 0.38), rect(0.67, 0.62, 0.33, 0.38),
      ];
    case "vice-strips":
      return [0, 1, 2, 3].map((i) => rect(i * 0.25, 0, 0.25, 1));
    case "diagonal-heat":
      return [
        { poly: [[0, 0], [0.42, 0], [0.3, 1], [0, 1]] },
        { poly: [[0.42, 0], [0.74, 0], [0.62, 1], [0.3, 1]] },
        { poly: [[0.74, 0], [1, 0], [1, 1], [0.62, 1]] },
      ];
    case "wanted-poster":
      return [
        rect(0.24, 0.07, 0.52, 0.64),
        rect(0.07, 0.76, 0.4, 0.19), rect(0.53, 0.76, 0.4, 0.19),
      ];
    case "duo-split":
      return [rect(0, 0, 0.5, 1), rect(0.5, 0, 0.5, 1)];
    case "trio-columns":
      return [0, 1, 2].map((i) => rect(i / 3, 0, 1 / 3, 1));
    case "ensemble-3x3": {
      const out = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) out.push(rect(c / 3, r / 3, 1 / 3, 1 / 3));
      return out;
    }
    case "cover-star":
      return [rect(0, 0, 1, 1), rect(0.665, 0.6, 0.3, 0.34)];
    case "comic-panels":
      return [
        rect(0, 0, 0.52, 0.44), rect(0.52, 0, 0.48, 0.56),
        rect(0, 0.44, 0.52, 0.56), rect(0.52, 0.56, 0.48, 0.44),
      ];
    case "mirror-duo":
      return [rect(0, 0, 0.5, 1), rect(0.5, 0, 0.5, 1, { mirror: true, sameAs: 0 })];
    case "headline-grid":
      return [
        rect(0, 0, 1, 0.3),
        rect(0, 0.3, 0.5, 0.7), rect(0.5, 0.3, 0.5, 0.7),
      ];
    case "quad-squad":
      return [rect(0, 0, 0.5, 0.5), rect(0.5, 0, 0.5, 0.5), rect(0, 0.5, 0.5, 0.5), rect(0.5, 0.5, 0.5, 0.5)];
    default:
      return [rect(0, 0, 1, 1)];
  }
}

/* Bounding box of a panel (polygons included), in normalised coords. */
function panelBox(p) {
  if (!p.poly) return p;
  const xs = p.poly.map((pt) => pt[0]), ys = p.poly.map((pt) => pt[1]);
  return {
    x: Math.min(...xs), y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys),
  };
}

/* Keep one slot per panel; new panels inherit photos in cast order. */
function syncSlots() {
  const panels = panelsFor(state.layout);
  while (state.slots.length < panels.length) {
    const i = state.slots.length;
    const photo = state.photos[i % Math.max(1, state.photos.length)];
    state.slots.push({
      photoId: photo ? photo.id : null,
      dx: 0, dy: 0, zoom: 1,
      role: photo ? photo.role : "",
    });
  }
  state.slots.length = panels.length;
  state.selectedPanel = clamp(state.selectedPanel, 0, panels.length - 1);
  // mirror-duo: the second panel always shows the first panel's photo
  panels.forEach((p, i) => {
    if (p.sameAs !== undefined && state.slots[p.sameAs]) {
      state.slots[i].photoId = state.slots[p.sameAs].photoId;
      state.slots[i].role = state.slots[p.sameAs].role;
    }
  });
}

function photoById(id) { return state.photos.find((p) => p.id === id) || null; }

/* ---------- the cover renderer (preview and export share it) -------- */

let noiseCanvas = null;
function makeNoise() {
  noiseCanvas = document.createElement("canvas");
  noiseCanvas.width = noiseCanvas.height = 256;
  const nctx = noiseCanvas.getContext("2d");
  const img = nctx.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 96 + Math.floor(Math.random() * 96);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  nctx.putImageData(img, 0, 0);
}

function tracePanel(ctx, p, W, H) {
  ctx.beginPath();
  if (p.poly) {
    p.poly.forEach((pt, i) => {
      const x = pt[0] * W, y = pt[1] * H;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
  } else {
    ctx.rect(p.x * W, p.y * H, p.w * W, p.h * H);
  }
}

/* Draw one photo into a pixel box, cover-fit. The focal anchor sits a
 * third down the frame — faces live in the upper third of a portrait —
 * and the panel's dx/dy nudge it from there. */
function drawPhoto(ctx, photo, box, slot, mirror) {
  const iw = photo.w, ih = photo.h;
  const scale = Math.max(box.w / iw, box.h / ih) * slot.zoom;
  const dw = iw * scale, dh = ih * scale;
  const ax = clamp(0.5 + slot.dx, 0.02, 0.98);
  const ay = clamp(0.3 + slot.dy, 0.02, 0.98);
  const x = box.x + (box.w - dw) * ax;
  const y = box.y + (box.h - dh) * ay;
  ctx.save();
  if (mirror) {
    ctx.translate(box.x + box.w / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(box.x + box.w / 2), 0);
  }
  ctx.drawImage(photo.source, x, y, dw, dh);
  ctx.restore();
}

function renderCover(ctx, W, H, forExport) {
  const grade = state.grade;
  const panels = panelsFor(state.layout);
  // backdrop the panels sit on (shows through poster-style layouts)
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1d1233"); bg.addColorStop(0.55, "#3d1150"); bg.addColorStop(1, "#0a0614");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  panels.forEach((p, i) => {
    const slot = state.slots[i];
    const photo = slot && photoById(slot.photoId);
    const box = panelBox(p);
    const px = { x: box.x * W, y: box.y * H, w: box.w * W, h: box.h * H };
    ctx.save();
    tracePanel(ctx, p, W, H); ctx.clip();
    if (photo) {
      ctx.filter = grade.filter;
      drawPhoto(ctx, photo, px, slot, p.mirror);
      ctx.filter = "none";
    } else {
      ctx.fillStyle = "#241640"; ctx.fillRect(px.x, px.y, px.w, px.h);
    }
    ctx.restore();
    // GTA-style white keyline between panels
    ctx.save();
    tracePanel(ctx, p, W, H);
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = Math.max(2, W * 0.0045);
    ctx.stroke();
    ctx.restore();
  });

  // pop-out hero: the lead photo breaks the top edge of its frame
  panels.forEach((p, i) => {
    if (!p.popOut) return;
    const slot = state.slots[i];
    const photo = slot && photoById(slot.photoId);
    if (!photo) return;
    const lift = H * 0.085;
    const px = { x: p.x * W - W * 0.006, y: -lift, w: p.w * W + W * 0.012, h: p.h * H + lift };
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = W * 0.02; ctx.shadowOffsetY = W * 0.008;
    ctx.beginPath(); ctx.rect(px.x, 0, px.w, px.h); ctx.clip();
    ctx.filter = grade.filter;
    // a touch larger than the in-frame draw, so the head rises clear
    // of where the frame alone would have put it
    drawPhoto(ctx, photo, px, Object.assign({}, slot, { zoom: slot.zoom * 1.07 }), false);
    ctx.restore();
  });

  if (state.tint) {
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = 0.16; ctx.fillStyle = grade.tint;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  if (state.grain && noiseCanvas) {
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = ctx.createPattern(noiseCanvas, "repeat");
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  if (state.vignette) {
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.78);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, `rgba(0,0,0,${0.5 * grade.vig})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  drawRoleTags(ctx, W, H, panels);
  drawLettering(ctx, W, H);

  if (!forExport) {
    const p = panels[state.selectedPanel];
    if (p) {
      ctx.save();
      tracePanel(ctx, p, W, H);
      ctx.strokeStyle = "#25d5f5"; ctx.lineWidth = Math.max(2, W * 0.003);
      ctx.setLineDash([W * 0.012, W * 0.008]);
      ctx.stroke();
      ctx.restore();
    }
  }
  return panels;
}

/* ---------- lettering: title, subtitle, role tags, billing ---------- */

function drawRoleTags(ctx, W, H, panels) {
  const fs = clamp(W * 0.0145, 11, 30);
  ctx.save();
  ctx.font = `700 ${fs}px "Segoe UI", system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  panels.forEach((p, i) => {
    const slot = state.slots[i];
    if (!slot || !slot.role) return;
    const box = panelBox(p);
    if (box.w * W < 150 || box.h * H < 90) return;
    const label = slot.role.toUpperCase();
    const tw = ctx.measureText(label).width;
    const x = box.x * W + W * 0.012, y = box.y * H + H * 0.014;
    ctx.fillStyle = "rgba(5,3,12,0.74)";
    ctx.beginPath();
    ctx.roundRect(x, y, tw + fs * 1.1, fs * 1.7, fs * 0.4);
    ctx.fill();
    ctx.fillStyle = "#ffd7ec";
    ctx.fillText(label, x + fs * 0.55, y + fs * 0.88);
  });
  ctx.restore();
}

function fitFont(ctx, text, weight, family, startPx, maxW) {
  let px = startPx;
  ctx.font = `${weight} ${px}px ${family}`;
  while (px > 12 && ctx.measureText(text).width > maxW) {
    px *= 0.94;
    ctx.font = `${weight} ${px}px ${family}`;
  }
  return px;
}

function drawLettering(ctx, W, H) {
  const title = (state.title || "").trim();
  const sub = (state.subtitle || "").trim();
  const billing = (state.billing || "").trim();
  const cx = W / 2;
  const onPoster = state.layout === "wanted-poster";
  ctx.save();
  ctx.textAlign = "center";

  if (sub) {
    const fs = fitFont(ctx, sub, "700", '"Segoe UI", system-ui, sans-serif', W * 0.026, W * 0.8);
    try { ctx.letterSpacing = `${Math.round(fs * 0.42)}px`; } catch { /* older canvas */ }
    ctx.fillStyle = "#ffd76a";
    ctx.shadowColor = "rgba(0,0,0,0.65)"; ctx.shadowBlur = fs * 0.35; ctx.shadowOffsetY = fs * 0.08;
    ctx.fillText(sub, cx, onPoster ? H * 0.155 : H * 0.762);
    try { ctx.letterSpacing = "0px"; } catch { /* older canvas */ }
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  }

  if (title) {
    const baseY = onPoster ? H * 0.115 : H * 0.925;
    ctx.save();
    ctx.translate(cx, baseY);
    ctx.transform(1, 0, -0.055, 1, 0, 0); // a whisper of poster slant
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    if (state.titleStyle === "neon") {
      const px = fitFont(ctx, title, "italic 700", '"Brush Script MT", "Segoe Script", cursive', W * 0.13, W * 0.9);
      ctx.font = `italic 700 ${px}px "Brush Script MT", "Segoe Script", cursive`;
      ctx.shadowColor = "#ff2e88"; ctx.shadowBlur = px * 0.4;
      ctx.fillStyle = "#ff5ea8";
      ctx.fillText(title, 0, 0); ctx.fillText(title, 0, 0);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(37,213,245,0.8)"; ctx.lineWidth = Math.max(1, px * 0.012);
      ctx.strokeText(title, 0, 0);
    } else if (state.titleStyle === "outline") {
      const px = fitFont(ctx, title, "900", '"Arial Black", "Segoe UI", sans-serif', W * 0.115, W * 0.92);
      ctx.font = `900 ${px}px "Arial Black", "Segoe UI", sans-serif`;
      ctx.fillStyle = "rgba(8,3,18,0.3)"; ctx.fillText(title, 0, 0);
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = px * 0.09; ctx.lineJoin = "round";
      ctx.strokeText(title, 0, 0);
    } else if (state.titleStyle === "retro") {
      const px = fitFont(ctx, title, "900", '"Arial Black", "Segoe UI", sans-serif', W * 0.11, W * 0.92);
      ctx.font = `900 ${px}px "Arial Black", "Segoe UI", sans-serif`;
      ctx.fillStyle = "#ff2e88"; ctx.fillText(title, px * 0.09, px * 0.1);
      ctx.fillStyle = "#ff7a3d"; ctx.fillText(title, px * 0.05, px * 0.055);
      ctx.fillStyle = "#ffe9c9"; ctx.fillText(title, 0, 0);
    } else { // chrome
      const px = fitFont(ctx, title, "900", '"Arial Black", "Segoe UI", sans-serif', W * 0.115, W * 0.92);
      ctx.font = `900 ${px}px "Arial Black", "Segoe UI", sans-serif`;
      const grad = ctx.createLinearGradient(0, -px, 0, px * 0.25);
      grad.addColorStop(0, "#ffffff"); grad.addColorStop(0.38, "#ffd7ec");
      grad.addColorStop(0.55, "#ff2e88"); grad.addColorStop(0.78, "#7a1fa2");
      grad.addColorStop(1, "#25d5f5");
      ctx.fillStyle = grad;
      ctx.strokeStyle = "#14041f"; ctx.lineWidth = px * 0.055; ctx.lineJoin = "round";
      ctx.strokeText(title, 0, 0);
      ctx.fillText(title, 0, 0);
    }
    ctx.restore();
  }

  if (billing) {
    const fs = clamp(W * 0.0115, 9, 22);
    ctx.font = `500 ${fs}px "Arial Narrow", Arial, sans-serif`;
    try { ctx.letterSpacing = `${Math.round(fs * 0.3)}px`; } catch { /* older canvas */ }
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.shadowColor = "rgba(0,0,0,0.7)"; ctx.shadowBlur = fs * 0.3;
    ctx.fillText(billing, cx, H * 0.972);
    try { ctx.letterSpacing = "0px"; } catch { /* older canvas */ }
  }
  ctx.restore();
}

/* ---------- editor UI ---------- */

function renderPreview() {
  const { w, h } = SIZES[state.size];
  const scale = Math.min(1, 1060 / w, 700 / h);
  stage.width = Math.round(w * scale);
  stage.height = Math.round(h * scale);
  const ctx = stage.getContext("2d");
  const panels = renderCover(ctx, stage.width, stage.height, false);
  previewPanels = panels.map((p) => {
    const b = panelBox(p);
    return { raw: p, x: b.x * stage.width, y: b.y * stage.height, w: b.w * stage.width, h: b.h * stage.height };
  });
}

function setStatus(msg) { $("statusLine").textContent = msg; }

function buildLayoutGrid() {
  const grid = $("layoutGrid");
  grid.innerHTML = "";
  LAYOUTS.forEach((l) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = l.name;
    b.className = l.id === state.layout ? "active" : "";
    b.addEventListener("click", () => {
      state.layout = l.id;
      buildLayoutGrid(); syncSlots(); renderPreview(); syncPanelControls();
      setStatus(`Layout: ${l.name}. Photos flow into the panels in order.`);
    });
    grid.appendChild(b);
  });
}

function buildGradeGrid() {
  const grid = $("gradeGrid");
  grid.innerHTML = "";
  GRADES.forEach((g) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = g.id === state.grade.id ? "active" : "";
    b.title = g.name;
    const sw = document.createElement("i");
    sw.style.background = `linear-gradient(120deg, ${g.tint}, #241640 70%)`;
    sw.style.filter = g.filter;
    const label = document.createElement("span");
    label.textContent = g.name;
    b.append(sw, label);
    b.addEventListener("click", () => {
      state.grade = g;
      buildGradeGrid(); renderPreview();
      setStatus(`Grade: ${g.name}.`);
    });
    grid.appendChild(b);
  });
}

function thumbURL(photo) {
  if (photo.source instanceof HTMLCanvasElement) return photo.source.toDataURL("image/jpeg", 0.72);
  return photo.source.src;
}

function assignToSelected(photo) {
  const slot = state.slots[state.selectedPanel];
  if (!slot) return;
  slot.photoId = photo.id;
  slot.role = photo.role || photo.name.toUpperCase();
  syncSlots(); renderPreview(); buildStrip(); syncPanelControls();
  setStatus(`${photo.name} is in panel ${state.selectedPanel + 1}. Drag it to reframe.`);
}

function buildCastStrip() {
  const strip = $("castStrip");
  strip.innerHTML = "";
  state.photos.filter((p) => p.id.startsWith("cast-")).forEach((photo) => {
    const b = document.createElement("button");
    b.type = "button"; b.title = `Put ${photo.name} in the selected panel`;
    const img = document.createElement("img");
    img.src = thumbURL(photo); img.alt = photo.name;
    const label = document.createElement("span");
    label.textContent = photo.name;
    b.append(img, label);
    b.addEventListener("click", () => assignToSelected(photo));
    strip.appendChild(b);
  });
}

function buildStrip() {
  const strip = $("strip");
  strip.innerHTML = "";
  const usedId = state.slots[state.selectedPanel]?.photoId;
  state.photos.forEach((photo) => {
    const fig = document.createElement("figure");
    fig.className = photo.id === usedId ? "active" : "";
    fig.title = `Put ${photo.name} in the selected panel`;
    const img = document.createElement("img");
    img.src = thumbURL(photo); img.alt = photo.name;
    const cap = document.createElement("figcaption");
    cap.textContent = photo.name;
    fig.append(img, cap);
    fig.addEventListener("click", () => assignToSelected(photo));
    strip.appendChild(fig);
  });
}

function syncPanelControls() {
  const slot = state.slots[state.selectedPanel];
  if (!slot) return;
  $("panelRole").value = slot.role || "";
  $("panelZoom").value = String(slot.zoom);
  const photo = photoById(slot.photoId);
  $("panelInfo").textContent =
    `Panel ${state.selectedPanel + 1} of ${state.slots.length}` +
    (photo ? ` — ${photo.name}. Drag the photo to reframe it.` : " — empty. Pick a photo below.");
}

/* pointer: select a panel, then drag its photo inside the frame */
function pointInPanel(p, nx, ny) {
  if (p.poly) {
    let inside = false;
    const poly = p.poly;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > ny) !== (yj > ny) && nx < ((xj - xi) * (ny - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  return nx >= p.x && nx <= p.x + p.w && ny >= p.y && ny <= p.y + p.h;
}

let drag = null;
function stagePoint(evt) {
  const r = stage.getBoundingClientRect();
  return {
    x: (evt.clientX - r.left) * (stage.width / r.width),
    y: (evt.clientY - r.top) * (stage.height / r.height),
  };
}

stage.addEventListener("pointerdown", (evt) => {
  const pt = stagePoint(evt);
  const nx = pt.x / stage.width, ny = pt.y / stage.height;
  const panels = panelsFor(state.layout);
  const idx = panels.findIndex((p) => pointInPanel(p, nx, ny));
  if (idx >= 0) state.selectedPanel = idx;
  const slot = state.slots[state.selectedPanel];
  const box = previewPanels[state.selectedPanel];
  if (!slot || !box) return;
  drag = { x: pt.x, y: pt.y, dx: slot.dx, dy: slot.dy, w: box.w, h: box.h };
  stage.setPointerCapture(evt.pointerId);
  syncPanelControls(); buildStrip(); renderPreview();
});

stage.addEventListener("pointermove", (evt) => {
  if (!drag) return;
  const pt = stagePoint(evt);
  const slot = state.slots[state.selectedPanel];
  if (!slot) return;
  // dragging right pulls the photo right, which walks the anchor left
  slot.dx = clamp(drag.dx - (pt.x - drag.x) / drag.w, -0.48, 0.48);
  slot.dy = clamp(drag.dy - (pt.y - drag.y) / drag.h, -0.48, 0.48);
  renderPreview();
});

["pointerup", "pointercancel"].forEach((ev) =>
  stage.addEventListener(ev, () => { drag = null; }));

/* ---------- export, uploads, wiring ---------- */

function renderToBlob(sizeKey, done) {
  const { w, h } = SIZES[sizeKey];
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  renderCover(c.getContext("2d"), w, h, true);
  c.toBlob((blob) => done(blob, sizeKey), "image/png");
}

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function exportSize(sizeKey) {
  renderToBlob(sizeKey, (blob) => {
    if (!blob) return;
    download(blob, `vice-frame-${sizeKey}.png`);
    setStatus(`Exported ${SIZES[sizeKey].label} PNG (${SIZES[sizeKey].w} × ${SIZES[sizeKey].h}).`);
  });
}

function wireControls() {
  $("sizeSelect").addEventListener("change", (e) => { state.size = e.target.value; renderPreview(); });
  $("exportBtn").addEventListener("click", () => exportSize(state.size));
  $("exportAllBtn").addEventListener("click", () => {
    Object.keys(SIZES).forEach((key, i) => setTimeout(() => exportSize(key), i * 450));
  });
  $("titleStyle").addEventListener("change", (e) => { state.titleStyle = e.target.value; renderPreview(); });
  $("titleText").addEventListener("input", (e) => { state.title = e.target.value; renderPreview(); });
  $("subtitleText").addEventListener("input", (e) => { state.subtitle = e.target.value; renderPreview(); });
  $("billingText").addEventListener("input", (e) => { state.billing = e.target.value; renderPreview(); });
  [["optTint", "tint"], ["optGrain", "grain"], ["optVignette", "vignette"]].forEach(([id, key]) => {
    $(id).addEventListener("change", (e) => { state[key] = e.target.checked; renderPreview(); });
  });
  $("panelRole").addEventListener("input", (e) => {
    const slot = state.slots[state.selectedPanel];
    if (slot) { slot.role = e.target.value; renderPreview(); }
  });
  $("panelZoom").addEventListener("input", (e) => {
    const slot = state.slots[state.selectedPanel];
    if (slot) { slot.zoom = parseFloat(e.target.value); renderPreview(); }
  });
  $("faceBtn").addEventListener("click", () => {
    const slot = state.slots[state.selectedPanel];
    if (slot) { slot.dx = 0; slot.dy = 0; renderPreview(); }
  });
  $("resetBtn").addEventListener("click", () => {
    const slot = state.slots[state.selectedPanel];
    if (slot) { slot.dx = 0; slot.dy = 0; slot.zoom = 1; syncPanelControls(); renderPreview(); }
  });
  $("fileInput").addEventListener("change", (e) => {
    const files = Array.from(e.target.files || []);
    let added = 0;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          state.photos.push({
            id: "up-" + Date.now() + "-" + added,
            name: file.name.replace(/\.[^.]+$/, "").slice(0, 18) || "Photo",
            role: "THE NEW FACE",
            source: img, w: img.naturalWidth, h: img.naturalHeight,
          });
          added++;
          syncSlots(); buildStrip();
          if (added === 1) assignToSelected(state.photos[state.photos.length - 1]);
          setStatus(`${added} photo(s) added — they live only in this tab.`);
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  });
}

/* Shot modes for the entry screenshots: #view=cover-wide renders the
 * wide cover full-bleed; #view=cover-poster a poster cover with a
 * different layout and grade, so the set shows range. */
function applyShotMode() {
  const m = /view=(cover-wide|cover-poster)/.exec(location.hash || "");
  if (!m) return false;
  document.body.classList.add("shot");
  const shot = $("shotCanvas");
  shot.hidden = false;
  if (m[1] === "cover-wide") {
    state.size = "wide"; state.layout = "hero-popout"; state.grade = gradeById("vice-sunset");
    shot.width = 1280; shot.height = 720;
  } else {
    state.size = "poster"; state.layout = "classic-mosaic"; state.grade = gradeById("neon-noir");
    state.titleStyle = "neon";
    shot.width = 853; shot.height = 1280;
  }
  syncSlots();
  renderCover(shot.getContext("2d"), shot.width, shot.height, true);
  return true;
}

function init() {
  makeNoise();
  seedCast();
  state.billing = $("billingText").value;
  buildLayoutGrid();
  buildGradeGrid();
  buildCastStrip();
  wireControls();
  syncSlots();
  buildStrip();
  syncPanelControls();
  if (!applyShotMode()) renderPreview();
}

document.addEventListener("DOMContentLoaded", init);
