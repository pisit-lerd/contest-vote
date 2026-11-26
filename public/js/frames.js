'use strict';
// Photo-booth frames: draws a sheet (frame + up to 4 shots + caption) on a canvas.
// Ported from the "Staff Party" design. Used by party.js; exposes window.Frames.
(() => {
let LOGO = null, ICON = null, EVENT_TITLE = '';
let W = 1080; // current sheet width; set per draw (horizontal strips are wider)
const STRIP_H = { 1: 1350, 2: 1620, 3: 1920, 4: 2400 };
/* [width, height] of a sheet: vertical strips grow downward; "แนวนอน" sheets are 1080 square */
const frameDims = (shape, n) => shape === "square" ? [1080, 1080] : [1080, STRIP_H[n] || 1350];
const CONTEST_FRAME = "ig";
const FRAMES = [
  { id: "beneat", name: "BeNeat Zone" },
  { id: "ig",     name: "IG Post" },
  { id: "kawaii", name: "Kawaii Pastel" },
  { id: "neon",   name: "Neon Party" },
  { id: "scrap",  name: "Scrapbook" },
  { id: "film",   name: "Vintage Film" },
  { id: "groovy", name: "Retro 70s" },
  { id: "mag",    name: "Y2K Magazine" },
];
const LAYOUT = {
  beneat: { side: 76, top: 128, bottom: 390, gap: 28 },
  scrap:  { side: 150, top: 160, bottom: 240, gap: 96 },
  film:   { side: 132, top: 122, bottom: 196, gap: 46 },
  ig:     { side: 36, top: 156, bottom: 300, gap: 14 },
  groovy: { side: 136, top: 216, bottom: 246, gap: 52 },
  kawaii: { side: 112, top: 196, bottom: 232, gap: 52 },
  neon:   { side: 112, top: 196, bottom: 236, gap: 56 },
  mag:    { side: 60,  top: 118, bottom: 190, gap: 0, custom: (n, h) => magSlots(n, h) },
};
function loadImg(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}
function fmtDate() {
  const d = new Date(); const p = n => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
/* ---------- canvas primitives ---------- */
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  const k = Array.isArray(r) ? r[0] : r;
  ctx.moveTo(x + k, y); ctx.arcTo(x + w, y, x + w, y + h, k); ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k); ctx.arcTo(x, y, x + w, y, k); ctx.closePath();
}
function placeholder(ctx, x, y, w, h, label) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, "#2a4a54"); g.addColorStop(1, "#13282f");
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const m = Math.min(w, h), cx = x + w / 2, hy = y + h * 0.5;
  ctx.fillStyle = "rgba(122,230,240,.22)";
  ctx.beginPath(); ctx.arc(cx, hy, m * 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx, hy + m * 0.5, m * 0.34, m * 0.3, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = "rgba(234,246,247,.7)"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `600 ${Math.round(m * 0.075)}px Anuphan, sans-serif`;
  ctx.fillText(label, cx, y + h * 0.17);
  ctx.textBaseline = "alphabetic";
}
function cover(ctx, img, x, y, w, h, r, filter, label) {
  ctx.save(); rr(ctx, x, y, w, h, r || 0); ctx.clip();
  if (img) {
    if (filter && "filter" in ctx) ctx.filter = filter;
    const s = Math.max(w / img.width, h / img.height), iw = img.width * s, ih = img.height * s;
    ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    ctx.filter = "none";
  } else placeholder(ctx, x, y, w, h, label);
  ctx.restore();
}
function fitFont(ctx, text, maxW, size, tpl) {
  let s = size; ctx.font = tpl(s);
  while (ctx.measureText(text).width > maxW && s > 18) { s -= 2; ctx.font = tpl(s); }
  return s;
}
function spaced(ctx, text, x, y, sp) {
  if ("letterSpacing" in ctx) { ctx.letterSpacing = sp + "px"; ctx.fillText(text, x, y); ctx.letterSpacing = "0px"; }
  else ctx.fillText(text, x, y);
}
function sparkle(ctx, x, y, r, c) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = c; ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.lineTo(Math.cos(a + Math.PI / 4) * r * 0.26, Math.sin(a + Math.PI / 4) * r * 0.26);
  }
  ctx.closePath(); ctx.fill(); ctx.restore();
}
function heart(ctx, x, y, s, c) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = c; ctx.strokeStyle = "#fff"; ctx.lineWidth = s * 0.18; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(0, s * 0.55); ctx.bezierCurveTo(-s * 1.2, -s * 0.2, -s * 0.6, -s * 1.1, 0, -s * 0.45);
  ctx.bezierCurveTo(s * 0.6, -s * 1.1, s * 1.2, -s * 0.2, 0, s * 0.55); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
}
function star(ctx, x, y, r, c) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = c; ctx.strokeStyle = "#fff"; ctx.lineWidth = r * 0.16; ctx.lineJoin = "round"; ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * 0.45 : r; ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
  ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
}
function bow(ctx, x, y, k, c) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.fillStyle = c; ctx.strokeStyle = "#fff"; ctx.lineWidth = 5; ctx.lineJoin = "round";
  for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(d * 46, -40, d * 52, 0); ctx.quadraticCurveTo(d * 46, 40, 0, 0); ctx.closePath(); ctx.stroke(); ctx.fill(); }
  for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(d * 22, 44); ctx.lineTo(d * 8, 40); ctx.closePath(); ctx.fill(); }
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.stroke(); ctx.fill(); ctx.restore();
}
function cloud(ctx, x, y, k) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.fillStyle = "#fff";
  for (const [cx, cy, r] of [[-30, 6, 22], [0, -8, 30], [30, 4, 24], [0, 14, 20]]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
function diamond(ctx, x, y, s) { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-s / 2, -s / 2, s, s); ctx.restore(); }
let NOISE = null;
function grain(ctx, w, h, a) {
  if (!NOISE) {
    NOISE = document.createElement("canvas"); NOISE.width = NOISE.height = 180;
    const x = NOISE.getContext("2d"), d = x.createImageData(180, 180), r = mulberry(5);
    for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = r() * 60; }
    x.putImageData(d, 0, 0);
  }
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = ctx.createPattern(NOISE, "repeat"); ctx.fillRect(0, 0, w, h); ctx.restore();
}
function magCover(h) { return { x: 60, y: 118, w: W - 120, h: h - 118 - 190 }; }
function magSlots(n, h) {
  const C = magCover(h);
  const m = { x: C.x + 30, y: C.y + 168, w: C.w - 60, h: C.h - 168 - 52 };
  const out = [m];
  if (n > 1) {
    const iw = Math.min(m.w * 0.27, (m.h - 120) / 2 / 1.25), ih = iw * 1.25;
    const pos = [[m.x + m.w - iw - 22, m.y + 22], [m.x + 22, m.y + m.h - ih - 62], [m.x + m.w - iw - 22, m.y + m.h - ih - 62]];
    for (let i = 1; i < n; i++) out.push({ x: pos[i - 1][0], y: pos[i - 1][1], w: iw, h: ih });
  }
  return out;
}
/* vertical strip stacks shots downward; the square ("แนวนอน") sheet uses an asymmetric left-right bento */
function slotsFor(L, n, h, shape) {
  if (L.custom) return L.custom(n, h, shape);
  const x = L.side, y = L.top, w = W - 2 * L.side, ih = h - L.top - L.bottom, g = L.gap;
  if (shape !== "square" || n === 1) {
    const sh = (ih - g * (n - 1)) / n;
    return Array.from({ length: n }, (_, i) => ({ x, y: y + i * (sh + g), w, h: sh }));
  }
  if (n === 2) {
    const aw = (w - g) * 0.58, bw = w - g - aw;
    return [{ x, y, w: aw, h: ih }, { x: x + aw + g, y: y + ih * 0.16, w: bw, h: ih * 0.84 }];
  }
  if (n === 3) {
    const aw = (w - g) * 0.6, rw = w - g - aw, bh = (ih - g) * 0.58;
    return [{ x, y, w: aw, h: ih }, { x: x + aw + g, y, w: rw, h: bh }, { x: x + aw + g, y: y + bh + g, w: rw, h: ih - bh - g }];
  }
  const th = (ih - g) * 0.56, bh = ih - th - g, aw = (w - g) * 0.62, cw = (w - g) * 0.4;
  return [
    { x, y, w: aw, h: th }, { x: x + aw + g, y, w: w - aw - g, h: th },
    { x, y: y + th + g, w: cw, h: bh }, { x: x + cw + g, y: y + th + g, w: w - cw - g, h: bh },
  ];
}
const slotLabel = (n, i) => n > 1 ? `รูปที่ ${i + 1}` : "รูปของคุณจะอยู่ตรงนี้";

/* ---------- frames ---------- */
function drawFrame(ctx, id, imgs, cap, n, shape = "strip") {
  const [fw, h] = frameDims(shape, n), prevW = W, caption = (cap || "").trim(), date = fmtDate();
  W = fw;
  try {
    const slots = slotsFor(LAYOUT[id] || LAYOUT.beneat, n, h, shape);
    ctx.save(); ctx.textBaseline = "alphabetic"; ctx.textAlign = "center";
    (FRAME_DRAW[id] || FRAME_DRAW.beneat)(ctx, h, slots, imgs, caption, date, n);
    ctx.restore();
  } finally { W = prevW; }
}

const FRAME_DRAW = {
  /* BeNeat Zone: cyan take on the classic booth strip — hazard tape, dark photo mounts, road-sign plate */
  beneat(ctx, h, slots, imgs, caption, date, n) {
    const navy = "#0B2A33", cyan = "#31C1D7";
    const bg = ctx.createRadialGradient(W / 2, h * 0.45, 100, W / 2, h * 0.45, h * 0.8);
    bg.addColorStop(0, "#5ED3E4"); bg.addColorStop(1, "#22AFC6");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, h);
    const tape = y => {
      ctx.save(); ctx.fillStyle = "#E9FBFD"; ctx.fillRect(0, y, W, 64);
      ctx.beginPath(); ctx.rect(0, y, W, 64); ctx.clip(); ctx.fillStyle = navy;
      for (let x = -80; x < W + 80; x += 84) { ctx.beginPath(); ctx.moveTo(x, y + 64); ctx.lineTo(x + 42, y + 64); ctx.lineTo(x + 106, y); ctx.lineTo(x + 64, y); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = navy; ctx.fillRect(0, y - 4, W, 4); ctx.fillRect(0, y + 64, W, 4);
    };
    tape(34); tape(h - 98);
    slots.forEach((s, i) => {
      ctx.save(); ctx.shadowColor = "rgba(6,32,39,.3)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
      ctx.fillStyle = navy; rr(ctx, s.x - 10, s.y - 10, s.w + 20, s.h + 20, 10); ctx.fill(); ctx.restore();
      cover(ctx, imgs[i], s.x, s.y, s.w, s.h, 4, "contrast(1.05) saturate(1.05)", slotLabel(n, i));
    });
    // date tag under the last photo
    const last = slots[slots.length - 1], ty = last.y + last.h + 14;
    ctx.font = `700 30px "Chakra Petch", monospace`; const tw = ctx.measureText(date).width + 36;
    ctx.fillStyle = "#fff"; rr(ctx, slots[0].x, ty, tw, 46, 8); ctx.fill();
    ctx.strokeStyle = navy; ctx.lineWidth = 3; rr(ctx, slots[0].x, ty, tw, 46, 8); ctx.stroke();
    ctx.fillStyle = navy; ctx.textAlign = "left"; ctx.fillText(date, slots[0].x + 18, ty + 34);
    // road-sign plate
    const sw = Math.min(W - 260, 900), sx = (W - sw) / 2, sh = 196, sy = h - 112 - sh;
    ctx.save(); ctx.translate(W / 2, sy + sh / 2); ctx.rotate(-0.012); ctx.translate(-W / 2, -(sy + sh / 2));
    ctx.shadowColor = "rgba(6,32,39,.35)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
    ctx.fillStyle = "#7AE6F0"; rr(ctx, sx, sy, sw, sh, 30); ctx.fill(); ctx.shadowColor = "transparent";
    ctx.strokeStyle = navy; ctx.lineWidth = 9; rr(ctx, sx, sy, sw, sh, 30); ctx.stroke();
    ctx.lineWidth = 3; rr(ctx, sx + 14, sy + 14, sw - 28, sh - 28, 20); ctx.stroke();
    ctx.fillStyle = navy; for (const [px, py] of [[sx + 30, sy + 30], [sx + sw - 30, sy + 30], [sx + 30, sy + sh - 30], [sx + sw - 30, sy + sh - 30]]) { ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill(); }
    if (ICON) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(sx + 108, sy + sh / 2, 62, 0, Math.PI * 2); ctx.fill(); ctx.drawImage(ICON, sx + 52, sy + sh / 2 - 56, 112, 112); }
    const tx = sx + 190 + (sw - 230) / 2;
    ctx.textAlign = "center"; ctx.fillStyle = navy;
    ctx.font = `700 26px "Chakra Petch", monospace`; spaced(ctx, "BENEAT 2026", tx + 4, sy + 52, 6);
    fitFont(ctx, "PARTY ZONE", sw - 250, 80, s => `700 ${s}px "Chakra Petch", monospace`); ctx.fillText("PARTY ZONE", tx, sy + 124);
    const line = caption || "ระวัง..ความปังล้นงาน";
    fitFont(ctx, line, sw - 250, 32, s => `700 ${s}px Anuphan, sans-serif`); ctx.fillText(line, tx, sy + 166);
    ctx.restore();
  },

  /* Scrapbook: polaroids taped onto kraft paper, ink date stamp */
  scrap(ctx, h, slots, imgs, caption, date, n) {
    ctx.fillStyle = "#CDB28A"; ctx.fillRect(0, 0, W, h);
    const g = ctx.createRadialGradient(W / 2, h / 2, h * 0.2, W / 2, h / 2, h * 0.75);
    g.addColorStop(0, "rgba(255,240,210,.25)"); g.addColorStop(1, "rgba(80,50,20,.28)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, h);
    grain(ctx, W, h, 0.9);
    ctx.strokeStyle = "rgba(92,62,32,.55)"; ctx.lineWidth = 3; ctx.setLineDash([16, 12]);
    rr(ctx, 30, 30, W - 60, h - 60, 18); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "#4A3726"; ctx.font = `600 56px Mali, cursive`;
    ctx.fillText("our party diary", W / 2, 104);
    sparkle(ctx, W / 2 - 250, 86, 16, "#8C5A2B"); sparkle(ctx, W / 2 + 250, 86, 16, "#8C5A2B");
    const tapes = ["rgba(242,172,87,.78)", "rgba(176,217,209,.88)", "rgba(223,174,105,.8)"];
    slots.forEach((s, i) => {
      const rot = n === 1 ? -0.012 : (i % 2 ? 0.02 : -0.018);
      ctx.save(); ctx.translate(s.x + s.w / 2, s.y + s.h / 2); ctx.rotate(rot);
      ctx.shadowColor = "rgba(50,30,10,.35)"; ctx.shadowBlur = 20; ctx.shadowOffsetY = 10;
      ctx.fillStyle = "#FBF8F1"; ctx.fillRect(-s.w / 2 - 22, -s.h / 2 - 22, s.w + 44, s.h + 44 + (n === 1 ? 30 : 0));
      ctx.shadowColor = "transparent";
      cover(ctx, imgs[i], -s.w / 2, -s.h / 2, s.w, s.h, 0, "sepia(.35) saturate(.85) contrast(1.05)", slotLabel(n, i));
      ctx.translate(0, -s.h / 2 - 22); ctx.rotate(i % 2 ? 0.07 : -0.06);
      ctx.fillStyle = tapes[i % 3]; ctx.fillRect(-105, -24, 210, 48);
      ctx.strokeStyle = "rgba(255,255,255,.45)"; ctx.lineWidth = 6;
      ctx.save(); ctx.beginPath(); ctx.rect(-105, -24, 210, 48); ctx.clip();
      for (let k = -120; k < 120; k += 22) { ctx.beginPath(); ctx.moveTo(k, 30); ctx.lineTo(k + 30, -30); ctx.stroke(); }
      ctx.restore(); ctx.restore();
    });
    const fy = h - 120;
    ctx.fillStyle = "#3B2A1A";
    const cap = caption || "คืนนี้แต่งเต็ม!";
    fitFont(ctx, cap, 600, 66, s => `600 ${s}px Mali, cursive`); ctx.fillText(cap, W / 2 - 80, fy);
    ctx.save(); ctx.translate(W - 190, fy - 20); ctx.rotate(-0.22);
    ctx.strokeStyle = "rgba(170,58,40,.85)"; ctx.fillStyle = "rgba(170,58,40,.85)";
    ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 76, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 64, 0, Math.PI * 2); ctx.stroke();
    ctx.font = `700 24px "Chakra Petch", monospace`; spaced(ctx, "BENEAT", 3, -8, 4);
    ctx.font = `600 18px "Chakra Petch", monospace`; ctx.fillText(date, 0, 22);
    diamond(ctx, -40, 44, 6); diamond(ctx, 40, 44, 6); diamond(ctx, 0, 48, 6);
    ctx.restore();
  },

  /* Old 35mm negative: warm stock, sprockets, light leaks, edge print */
  film(ctx, h, slots, imgs, caption, date, n) {
    ctx.fillStyle = "#17110D"; ctx.fillRect(0, 0, W, h);
    const tint = ctx.createLinearGradient(0, 0, W, 0);
    tint.addColorStop(0, "rgba(120,60,20,.25)"); tint.addColorStop(.5, "rgba(0,0,0,0)"); tint.addColorStop(1, "rgba(120,60,20,.25)");
    ctx.fillStyle = tint; ctx.fillRect(0, 0, W, h);
    ctx.fillStyle = "#D9C7A2";
    for (let y = 26; y < h - 40; y += 96) { rr(ctx, 28, y, 48, 62, 9); ctx.fill(); rr(ctx, W - 76, y, 48, 62, 9); ctx.fill(); }
    ctx.fillStyle = "#E8963A"; ctx.font = `600 26px "Chakra Petch", monospace`;
    ctx.textAlign = "left"; spaced(ctx, "BENEAT GOLD 400", 134, 82, 5);
    ctx.textAlign = "right"; spaced(ctx, "▸ 12A", W - 134, 82, 5);
    slots.forEach((s, i) => {
      cover(ctx, imgs[i], s.x, s.y, s.w, s.h, 6, "sepia(.28) saturate(1.2) contrast(1.08) brightness(1.04)", slotLabel(n, i));
      ctx.save(); rr(ctx, s.x, s.y, s.w, s.h, 6); ctx.clip();
      const lx = i % 2 ? s.x : s.x + s.w, ly = i % 2 ? s.y + s.h : s.y;
      const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, s.w * 0.65);
      lg.addColorStop(0, "rgba(255,140,40,.55)"); lg.addColorStop(.45, "rgba(255,70,30,.16)"); lg.addColorStop(1, "rgba(255,70,30,0)");
      ctx.globalCompositeOperation = "screen"; ctx.fillStyle = lg; ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.globalCompositeOperation = "source-over";
      const vg = ctx.createRadialGradient(s.x + s.w / 2, s.y + s.h / 2, Math.min(s.w, s.h) * 0.35, s.x + s.w / 2, s.y + s.h / 2, Math.max(s.w, s.h) * 0.75);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.42)");
      ctx.fillStyle = vg; ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.restore();
      if (s.x > LAYOUT.film.side) return;
      ctx.save(); ctx.translate(106, s.y + s.h / 2); ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = "#E8963A"; ctx.font = `600 22px "Chakra Petch", monospace`; ctx.textAlign = "center";
      spaced(ctx, `${12 + i}  ▸  ${12 + i}A`, 0, 8, 4); ctx.restore();
    });
    grain(ctx, W, h, 0.55);
    ctx.textAlign = "center"; ctx.fillStyle = "#F2E6CC";
    const cap = caption || "SCENE 01 · TAKE 01";
    fitFont(ctx, cap, 780, 46, s => `600 ${s}px "Chakra Petch", Anuphan, monospace`); ctx.fillText(cap, W / 2, h - 108);
    ctx.fillStyle = "#E8963A"; ctx.font = `600 24px "Chakra Petch", monospace`;
    spaced(ctx, `▸ ${date}  ▸ PARTY NIGHT`, W / 2, h - 60, 5);
  },

  /* IG Post: a clean social-feed card — story-ring avatar, edge-to-edge photos, action row */
  ig(ctx, h, slots, imgs, caption, date, n) {
    const ink = "#111418", grey = "#7A8288";
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, W, h);
    // header
    const ax = 100, ay = 78;
    const ring = ctx.createLinearGradient(ax - 48, ay + 48, ax + 48, ay - 48);
    ring.addColorStop(0, "#F2AC57"); ring.addColorStop(.5, "#E8557A"); ring.addColorStop(1, "#8E5BD8");
    ctx.fillStyle = ring; ctx.beginPath(); ctx.arc(ax, ay, 50, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ax, ay, 43, 0, Math.PI * 2); ctx.fill();
    if (ICON) ctx.drawImage(ICON, ax - 39, ay - 39, 78, 78);
    ctx.textAlign = "left"; ctx.fillStyle = ink; ctx.font = `700 34px Anuphan, sans-serif`;
    ctx.fillText("beneat.party", 172, 70);
    const vw = ctx.measureText("beneat.party").width;
    ctx.fillStyle = "#31C1D7"; ctx.beginPath(); ctx.arc(172 + vw + 22, 58, 13, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(172 + vw + 15, 58); ctx.lineTo(172 + vw + 20, 64); ctx.lineTo(172 + vw + 29, 52); ctx.stroke();
    ctx.fillStyle = grey; ctx.font = `500 26px Anuphan, sans-serif`;
    ctx.fillText(EVENT_TITLE, 172, 108);
    ctx.fillStyle = ink; for (const dx of [-26, 0, 26]) { ctx.beginPath(); ctx.arc(W - 80 + dx, 78, 6, 0, Math.PI * 2); ctx.fill(); }
    // photos
    slots.forEach((s, i) => cover(ctx, imgs[i], s.x, s.y, s.w, s.h, 22, "contrast(1.05) saturate(1.08)", slotLabel(n, i)));
    if (n > 1) {
      ctx.fillStyle = "rgba(17,20,24,.6)"; rr(ctx, W - 36 - 112, slots[0].y + 22, 90, 44, 22); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = `600 24px "Chakra Petch", monospace`; ctx.textAlign = "center";
      ctx.fillText(`1/${n}`, W - 36 - 67, slots[0].y + 52);
    }
    // action row
    const ry = h - 236;
    ctx.save(); ctx.translate(76, ry); ctx.fillStyle = "#E8455A"; ctx.beginPath();
    ctx.moveTo(0, 16); ctx.bezierCurveTo(-34, -6, -22, -34, 0, -20); ctx.bezierCurveTo(22, -34, 34, -6, 0, 16); ctx.fill(); ctx.restore();
    ctx.strokeStyle = ink; ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.arc(160, ry - 4, 22, Math.PI * 0.75, Math.PI * 2.55); ctx.lineTo(142, ry + 22); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(220, ry - 24); ctx.lineTo(270, ry - 24); ctx.lineTo(240, ry + 22); ctx.lineTo(236, ry - 2); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(236, ry - 2); ctx.lineTo(270, ry - 24); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W - 92, ry - 26); ctx.lineTo(W - 60, ry - 26); ctx.lineTo(W - 60, ry + 24); ctx.lineTo(W - 76, ry + 10); ctx.lineTo(W - 92, ry + 24); ctx.closePath(); ctx.stroke();
    if (n > 1) for (let i = 0; i < n; i++) { ctx.fillStyle = i ? "#C9CED2" : "#31C1D7"; ctx.beginPath(); ctx.arc(W / 2 + (i - (n - 1) / 2) * 22, ry, 6, 0, Math.PI * 2); ctx.fill(); }
    ctx.textAlign = "left"; ctx.fillStyle = ink; ctx.font = `700 30px Anuphan, sans-serif`;
    ctx.fillText("ถูกใจโดย beneat และคนอื่นๆ 1,024 คน", 48, ry + 70);
    ctx.font = `700 30px Anuphan, sans-serif`; ctx.fillText("beneat.party", 48, ry + 118);
    const uw = ctx.measureText("beneat.party ").width;
    const cap = caption || "แต่งเต็มมาก คืนนี้ใครปังสุด?";
    fitFont(ctx, cap, W - 96 - uw, 30, s => `400 ${s}px Anuphan, sans-serif`); ctx.fillText(cap, 48 + uw, ry + 118);
    ctx.fillStyle = "#31C1D7"; ctx.font = `600 28px Anuphan, sans-serif`; ctx.fillText("#BeNeatParty  #BestCostume", 48, ry + 162);
    ctx.fillStyle = grey; ctx.font = `500 22px "Chakra Petch", monospace`; spaced(ctx, date, 48, ry + 202, 3);
  },

  /* Kawaii pastel: polka dots, scalloped edge, hearts/stars/bows stickers */
  kawaii(ctx, h, slots, imgs, caption, date, n) {
    ctx.fillStyle = "#FFE3EE"; ctx.fillRect(0, 0, W, h);
    ctx.fillStyle = "rgba(255,255,255,.75)";
    for (let y = 0, row = 0; y < h + 40; y += 46, row++) for (let x = (row % 2) * 23; x < W + 40; x += 46) { ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "#fff";
    const sc = 22;
    for (let x = 0; x <= W; x += sc * 2) { ctx.beginPath(); ctx.arc(x, 0, sc, 0, Math.PI * 2); ctx.arc(x, h, sc, 0, Math.PI * 2); ctx.fill(); }
    for (let y = 0; y <= h; y += sc * 2) { ctx.beginPath(); ctx.arc(0, y, sc, 0, Math.PI * 2); ctx.arc(W, y, sc, 0, Math.PI * 2); ctx.fill(); }
    ctx.lineJoin = "round"; ctx.textAlign = "center"; ctx.font = `600 64px Mali, cursive`;
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 14; ctx.strokeText("kawaii party", W / 2, 128);
    ctx.fillStyle = "#E8578E"; ctx.fillText("kawaii party", W / 2, 128);
    heart(ctx, W / 2 - 250, 104, 30, "#FF8FB8"); heart(ctx, W / 2 + 250, 104, 30, "#FF8FB8");
    slots.forEach((s, i) => {
      ctx.save(); ctx.shadowColor = "rgba(232,87,142,.25)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
      ctx.fillStyle = "#fff"; rr(ctx, s.x - 16, s.y - 16, s.w + 32, s.h + 32, 40); ctx.fill(); ctx.restore();
      ctx.strokeStyle = "#FF9EC2"; ctx.lineWidth = 4; ctx.setLineDash([2, 12]); ctx.lineCap = "round";
      rr(ctx, s.x - 8, s.y - 8, s.w + 16, s.h + 16, 34); ctx.stroke(); ctx.setLineDash([]);
      cover(ctx, imgs[i], s.x, s.y, s.w, s.h, 28, "saturate(1.08) brightness(1.04)", slotLabel(n, i));
      bow(ctx, s.x + s.w - 6, s.y + 4, 1, i % 2 ? "#B9A4F5" : "#FF8FB8");
      star(ctx, s.x + 8, s.y + s.h - 6, 30, "#FFD36E");
    });
    const r = mulberry(17), kinds = [0, 1, 2, 3];
    const spots = [];
    for (let y = 230; y < h - 260; y += 150) { spots.push([56, y]); spots.push([W - 56, y + 75]); }
    spots.forEach(([x, y], k) => {
      const t = kinds[(k + Math.floor(r() * 4)) % 4];
      if (t === 0) heart(ctx, x, y, 26, "#FF8FB8"); else if (t === 1) star(ctx, x, y, 26, "#FFD36E");
      else if (t === 2) cloud(ctx, x, y, 0.9); else sparkle(ctx, x, y, 20, "#B9A4F5");
    });
    ctx.fillStyle = "#C2457A";
    const cap = caption || "น่ารักที่สุดในงาน";
    fitFont(ctx, cap, 760, 58, s => `600 ${s}px Mali, cursive`); ctx.fillText(cap, W / 2, h - 132);
    ctx.fillStyle = "#E58AB0"; ctx.font = `600 26px "Chakra Petch", monospace`; spaced(ctx, `BENEAT · ${date}`, W / 2 + 3, h - 84, 5);
    cloud(ctx, 150, h - 110, 1.1); cloud(ctx, W - 150, h - 120, 1);
  },

  /* Neon party: night wall, glowing tube outlines, neon sign header */
  neon(ctx, h, slots, imgs, caption, date, n) {
    ctx.fillStyle = "#0C0A1C"; ctx.fillRect(0, 0, W, h);
    ctx.fillStyle = "rgba(255,255,255,.035)";
    for (let y = 0, row = 0; y < h; y += 44, row++) for (let x = (row % 2) * 60 - 60; x < W; x += 120) ctx.fillRect(x + 3, y + 3, 114, 38);
    const glow = (color, blur, fn) => { ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = blur; fn(); fn(); ctx.restore(); };
    ctx.textAlign = "center"; ctx.font = `700 84px "Chakra Petch", monospace`;
    glow("#FF3DA8", 34, () => { ctx.fillStyle = "#FFD3EC"; spaced(ctx, "PARTY NIGHT", W / 2 + 6, 132, 12); });
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    glow("#7AE6F0", 20, () => { ctx.strokeStyle = "#BFF6FA"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(W / 2 - 300, 162); ctx.lineTo(W / 2 + 300, 162); ctx.stroke(); });
    const cols = [["#31C1D7", "#C8FAFF"], ["#FF3DA8", "#FFD3EC"], ["#B66BFF", "#EBD6FF"]];
    slots.forEach((s, i) => {
      cover(ctx, imgs[i], s.x, s.y, s.w, s.h, 20, "saturate(1.25) contrast(1.1)", slotLabel(n, i));
      const [c1, c2] = cols[i % 3];
      glow(c1, 28, () => { ctx.strokeStyle = c2; ctx.lineWidth = 6; rr(ctx, s.x - 14, s.y - 14, s.w + 28, s.h + 28, 30); ctx.stroke(); });
    });
    glow("#FF3DA8", 18, () => { sparkle(ctx, 62, 70, 22, "#FFD3EC"); sparkle(ctx, W - 62, h - 70, 22, "#FFD3EC"); });
    glow("#7AE6F0", 18, () => { sparkle(ctx, W - 62, 70, 16, "#C8FAFF"); sparkle(ctx, 62, h - 70, 16, "#C8FAFF"); });
    const cap = caption || "Let's glow tonight";
    fitFont(ctx, cap, 780, 56, s => `700 ${s}px Anuphan, sans-serif`);
    glow("#31C1D7", 26, () => { ctx.fillStyle = "#D6FBFF"; ctx.fillText(cap, W / 2, h - 132); });
    ctx.font = `600 26px "Chakra Petch", monospace`;
    glow("#FF3DA8", 14, () => { ctx.fillStyle = "#FFB8DF"; spaced(ctx, `BENEAT · ${date}`, W / 2 + 3, h - 80, 6); });
  },

  /* Y2K magazine cover: sky + rainbow + pitch, tilted masthead, main shot with inset shots, cover-line stickers */
  mag(ctx, h, slots, imgs, caption, date, n) {
    const navy = "#14213D", pink = "#FF4FA3", blue = "#2F6BFF", yellow = "#FFE14D", teal = "#34D1C9";
    const outlined = (t, x, y, fill, stroke, lw) => { ctx.lineJoin = "round"; ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeText(t, x, y); ctx.fillStyle = fill; ctx.fillText(t, x, y); };
    const italic = (x, y, fn, rot = 0) => { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.transform(1, 0, -0.16, 1, 0, 0); fn(); ctx.restore(); };
    // sky, rainbow, pitch
    const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#6CCBF2"); sky.addColorStop(.62, "#C6EEFF"); sky.addColorStop(.62, "#3E9E4E"); sky.addColorStop(1, "#2F8A3F");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, h);
    ctx.fillStyle = "rgba(255,255,255,.07)"; for (let y = h * 0.62; y < h; y += 60) ctx.fillRect(0, y, W, 30);
    ["#FF6B6B", "#FFB84D", "#FFE14D", "#6EE07A", "#5BB8FF", "#B57CFF"].forEach((c, i) => {
      ctx.strokeStyle = c; ctx.globalAlpha = .45; ctx.lineWidth = 22;
      ctx.beginPath(); ctx.arc(W * 0.15, h * 0.62, W * 0.95 - i * 22, Math.PI * 1.02, Math.PI * 1.6); ctx.stroke();
    });
    ctx.globalAlpha = 1;
    const r0 = mulberry(8); for (let i = 0; i < 16; i++) sparkle(ctx, r0() * W, r0() * h, 7 + r0() * 10, i % 2 ? "#fff" : "#FFB3D9");
    // header line + corner sticker
    ctx.textAlign = "left"; ctx.fillStyle = "#fff"; ctx.font = `700 22px "Chakra Petch", monospace`;
    spaced(ctx, "BENEAT × BEST COSTUME MAGAZINE", 64, 72, 4);
    italic(W - 70, 56, () => {
      ctx.textAlign = "right"; ctx.fillStyle = "#1FA34A"; ctx.fillRect(-250, -40, 262, 82);
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 4; ctx.strokeRect(-250, -40, 262, 82);
      ctx.fillStyle = yellow; ctx.font = `700 32px "Chakra Petch", monospace`; ctx.fillText("NEW PLAYER", 0, -4);
      ctx.fillStyle = "#fff"; ctx.font = `700 20px "Chakra Petch", monospace`; ctx.fillText("BENEAT GAMES 2026", 0, 28);
    }, 0.04);
    // magazine body
    const C = magCover(h), m = slots[0];
    ctx.save(); ctx.translate(C.x + C.w / 2, C.y + C.h / 2); ctx.rotate(-0.012); ctx.translate(-(C.x + C.w / 2), -(C.y + C.h / 2));
    ctx.shadowColor = "rgba(20,33,61,.4)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 14;
    ctx.fillStyle = "#FF8FCB"; ctx.fillRect(C.x, C.y, C.w, C.h); ctx.shadowColor = "transparent";
    ctx.strokeStyle = blue; ctx.lineWidth = 16; ctx.strokeRect(C.x + 8, C.y + 8, C.w - 16, C.h - 16);
    // main photo
    ctx.fillStyle = teal; ctx.fillRect(m.x - 12, m.y - 12, m.w + 24, m.h + 24);
    cover(ctx, imgs[0], m.x, m.y, m.w, m.h, 0, "saturate(1.15) contrast(1.06)", slotLabel(n, 0));
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 4; ctx.strokeRect(m.x, m.y, m.w, m.h);
    // masthead
    italic(C.x + 34, C.y + 34, () => {
      ctx.fillStyle = yellow; ctx.fillRect(0, 0, C.w * 0.62, 118); ctx.strokeStyle = navy; ctx.lineWidth = 5; ctx.strokeRect(0, 0, C.w * 0.62, 118);
      ctx.textAlign = "left"; fitFont(ctx, "Party!", C.w * 0.58, 112, s => `700 ${s}px "Chakra Petch", monospace`);
      ctx.fillStyle = navy; ctx.fillText("Party!", 22, 104);
      outlined("Party!", 16, 98, pink, "#fff", 12); ctx.fillStyle = pink; ctx.fillText("Party!", 16, 98);
    }, -0.03);
    ctx.textAlign = "left"; ctx.fillStyle = navy; ctx.font = `700 18px "Chakra Petch", monospace`;
    const ix = C.x + C.w * 0.62 + 44;
    spaced(ctx, "ISSUE 26", ix, C.y + 62, 2); spaced(ctx, date, ix, C.y + 88, 1); spaced(ctx, "PARTY ED.", ix, C.y + 114, 2);
    // inset shots
    slots.slice(1).forEach((s, k) => {
      const i = k + 1, rot = [0.04, -0.035, 0.03][k];
      ctx.save(); ctx.translate(s.x + s.w / 2, s.y + s.h / 2); ctx.rotate(rot); ctx.translate(-(s.x + s.w / 2), -(s.y + s.h / 2));
      ctx.shadowColor = "rgba(20,33,61,.35)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
      ctx.fillStyle = [yellow, "#FF8FCB", teal][k]; ctx.fillRect(s.x - 10, s.y - 10, s.w + 20, s.h + 20); ctx.shadowColor = "transparent";
      cover(ctx, imgs[i], s.x, s.y, s.w, s.h, 0, "saturate(1.15)", slotLabel(n, i));
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.strokeRect(s.x, s.y, s.w, s.h);
      ctx.restore();
    });
    // cover lines
    const fs = Math.round(Math.min(58, m.w * 0.07));
    italic(C.x + C.w - 120, C.y + 66, () => {
      ctx.fillStyle = yellow; ctx.beginPath();
      for (let j = 0; j < 24; j++) { const a = j * Math.PI / 12, rad = j % 2 ? 50 : 66; ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
      ctx.closePath(); ctx.fill(); ctx.strokeStyle = navy; ctx.lineWidth = 3; ctx.stroke();
      ctx.textAlign = "center"; ctx.fillStyle = "#E8322E"; ctx.font = `700 26px "Chakra Petch", monospace`; ctx.fillText("WINNER!", 0, 9);
    }, 0.12);
    italic(m.x + m.w - 30, m.y + m.h * 0.56, () => {
      ctx.textAlign = "right"; ctx.font = `700 ${Math.round(fs * 1.5)}px "Chakra Petch", monospace`;
      const w1 = ctx.measureText("MVP").width + 40;
      ctx.fillStyle = pink; ctx.fillRect(-w1, -fs * 1.3, w1, fs * 1.6); ctx.strokeStyle = "#fff"; ctx.lineWidth = 4; ctx.strokeRect(-w1, -fs * 1.3, w1, fs * 1.6);
      outlined("MVP", -20, 0, "#7CF06A", navy, 10);
    }, -0.05);
    // caption strip across the bottom edge
    const cap = caption || "No Time For Loser";
    ctx.font = `700 44px "Chakra Petch", Anuphan, monospace`;
    const cw = Math.min(C.w - 120, ctx.measureText(cap).width + 70);
    italic(C.x + C.w / 2, C.y + C.h - 6, () => {
      ctx.fillStyle = yellow; ctx.fillRect(-cw / 2, -36, cw, 72); ctx.strokeStyle = navy; ctx.lineWidth = 4; ctx.strokeRect(-cw / 2, -36, cw, 72);
      ctx.textAlign = "center"; ctx.fillStyle = "#E8322E";
      fitFont(ctx, cap, cw - 50, 44, s => `700 ${s}px "Chakra Petch", Anuphan, monospace`); ctx.fillText(cap, 0, 15);
    }, -0.015);
    ctx.restore();
    // footer tag on the pitch
    italic(70, h - 70, () => {
      ctx.textAlign = "left"; ctx.font = `700 64px "Chakra Petch", monospace`;
      ctx.fillStyle = pink; ctx.fillText("PARTY!", 7, 7);
      outlined("NEW", 0, -64, yellow, navy, 10); outlined("PARTY!", 0, 0, "#fff", navy, 10);
    }, -0.05);
    ctx.textAlign = "right"; ctx.fillStyle = "#fff"; ctx.font = `700 24px "Chakra Petch", monospace`; spaced(ctx, `BENEAT · ${date}`, W - 64, h - 56, 4);
  },

  /* 70s: groovy stripe border, sunburst, arched windows, halftone */
  groovy(ctx, h, slots, imgs, caption, date, n) {
    ctx.fillStyle = "#F6E7CC"; ctx.fillRect(0, 0, W, h);
    ctx.save(); ctx.translate(W / 2, h * 0.55); ctx.fillStyle = "rgba(226,170,90,.14)";
    for (let i = 0; i < 28; i += 2) { const a0 = i * Math.PI / 14; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, h, a0, a0 + Math.PI / 14); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    const dots = (cx, cy, dirX, dirY) => {
      ctx.fillStyle = "rgba(196,83,45,.32)";
      for (let gx = 0; gx < 9; gx++) for (let gy = 0; gy < 9; gy++) {
        const rad = Math.max(0, 9 - (gx + gy) * 0.75); if (rad <= 0.5) continue;
        ctx.beginPath(); ctx.arc(cx + dirX * gx * 26, cy + dirY * gy * 26, rad, 0, Math.PI * 2); ctx.fill();
      }
    };
    dots(118, h - 118, 1, -1); dots(W - 118, 118, -1, 1);
    const stripes = ["#C4532D", "#E0892F", "#E9B949", "#7A9E7E"];
    stripes.forEach((c, k) => { const ins = 20 + k * 22; ctx.strokeStyle = c; ctx.lineWidth = 20; rr(ctx, ins, ins, W - 2 * ins, h - 2 * ins, 110 - k * 20); ctx.stroke(); });
    ctx.font = `66px Chonburi, Georgia, serif`;
    ctx.fillStyle = "#E9B949"; ctx.fillText("GROOVY PARTY", W / 2 + 5, 180);
    ctx.fillStyle = "#C4532D"; ctx.fillText("GROOVY PARTY", W / 2, 175);
    slots.forEach((s, i) => {
      const R = Math.min(s.w, s.h) * 0.48;
      ctx.strokeStyle = "#C4532D"; ctx.lineWidth = 6; rr(ctx, s.x - 12, s.y - 12, s.w + 24, s.h + 24, [R + 12, R + 12, 26, 26]); ctx.stroke();
      ctx.fillStyle = "#FFF6E4"; rr(ctx, s.x - 6, s.y - 6, s.w + 12, s.h + 12, [R + 6, R + 6, 20, 20]); ctx.fill();
      cover(ctx, imgs[i], s.x, s.y, s.w, s.h, [R, R, 14, 14], "sepia(.22) saturate(1.2) contrast(1.05)", slotLabel(n, i));
    });
    grain(ctx, W, h, 0.35);
    ctx.fillStyle = "#3A2416";
    const cap = caption || "ปาร์ตี้คืนนี้!";
    fitFont(ctx, cap, 760, 58, s => `${s}px Chonburi, Anuphan, serif`); ctx.fillText(cap, W / 2, h - 140);
    ctx.fillStyle = "#C4532D"; ctx.font = `600 26px "Chakra Petch", monospace`;
    spaced(ctx, `PEACE · LOVE · ${date}`, W / 2 + 3, h - 94, 5);
  },
};

function compose(scale, frame, imgs, cap, n, shape = "strip") {
  const [fw, fh] = frameDims(shape, n), c = document.createElement("canvas");
  c.width = Math.round(fw * scale); c.height = Math.round(fh * scale);
  const x = c.getContext("2d"); x.scale(scale, scale); drawFrame(x, frame, imgs, cap, n, shape); return c;
}
function smallDataURL(c) {
  let q = 0.84, u;
  do { u = c.toDataURL("image/jpeg", q); q -= 0.08; } while (u.length > 200000 && q > 0.3);
  return u;
}
async function fileToPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const im = await loadImg(url);
    const k = Math.min(1, 1400 / Math.max(im.width, im.height));
    const c = document.createElement("canvas");
    c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
    c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
    const data = c.toDataURL("image/jpeg", 0.86);
    return { img: await loadImg(data), data };
  } finally { URL.revokeObjectURL(url); }
}


window.Frames = {
  FRAMES, CONTEST_FRAME, frameDims, drawFrame, compose, smallDataURL, fileToPhoto, loadImg,
  setTitle(t) { EVENT_TITLE = String(t || ''); },
  async loadArt() { try { [LOGO, ICON] = await Promise.all([loadImg('/img/beneat-logo.png'), loadImg('/img/beneat-icon.png')]); } catch {} },
  /* sizes a canvas to a sheet at `scale` and returns a context already scaled to sheet units */
  sizeCanvas(c, dims, scale) {
    const w = Math.round(dims[0] * scale), h = Math.round(dims[1] * scale);
    if (c.width !== w) c.width = w; if (c.height !== h) c.height = h;
    const x = c.getContext('2d'); x.setTransform(scale, 0, 0, scale, 0, 0); return x;
  },
};
})();
