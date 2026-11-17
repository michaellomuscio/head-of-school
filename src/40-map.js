/* The city diorama. An isometric model of the whole city drawn on canvas: two cached layers (ground, buildings) with traffic
   between them, then flags, cranes, weather and labels on top. Seasons follow the school calendar; the dark theme is night. */
const HW = 22, HH = 11;
const iso = (i, j, z) => [(i - j) * HW, (i + j) * HH - (z || 0)];
const M_OX = CITY_G * HW + 30, M_OY = 170, M_W = CITY_G * HW * 2 + 60, M_H = CITY_G * HH * 2 + M_OY + 80;

const _hex = {};
function hexRgb(h) { if (_hex[h]) return _hex[h]; const n = parseInt(h.slice(1), 16); return (_hex[h] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]); }
function mixHex(a, b, t) { const x = hexRgb(a), y = hexRgb(b); return '#' + [0, 1, 2].map((k) => Math.round(lerp(x[k], y[k], t)).toString(16).padStart(2, '0')).join(''); }
const _tone = {};
function tone(hex, mul, night) {
  const key = hex + mul + (night ? 'n' : 'd');
  if (_tone[key]) return _tone[key];
  let [r, g, b] = hexRgb(hex); r *= mul; g *= mul; b *= mul;
  if (night) { const l = (r + g + b) / 3; r = lerp(r, l, 0.3) * 0.4 + 6; g = lerp(g, l, 0.3) * 0.45 + 12; b = lerp(b, l, 0.2) * 0.6 + 30; }
  return (_tone[key] = 'rgb(' + clamp(r | 0, 0, 255) + ',' + clamp(g | 0, 0, 255) + ',' + clamp(b | 0, 0, 255) + ')');
}

const SEASON_PAL = {
  summer: { grass: '#93c66f', park: '#7fba63', lawn: '#8fd07a', water: '#5fa9d6', leaf: ['#4f9a4a', '#3f8a47', '#63a94f'], snow: 0 },
  spring: { grass: '#a0d07a', park: '#8fc86e', lawn: '#9bd884', water: '#63aeda', leaf: ['#7fc46a', '#f2b6c6', '#fbe3ea', '#8fd07a'], snow: 0 },
  fall: { grass: '#b3b96a', park: '#a3ad5c', lawn: '#b0c26a', water: '#5a9fca', leaf: ['#d98a2b', '#c9542b', '#e2b53a', '#a8a03a'], snow: 0 },
  winter: { grass: '#e8eef3', park: '#e2eaf0', lawn: '#eef3f6', water: '#9fc6dd', leaf: null, snow: 0.6 },
};
const SKY = { summer: ['#5fb0ea', '#bfe3f5', '#e6f2ea'], fall: ['#86b4d8', '#f1dcba', '#f4ecd9'], winter: ['#9db6cd', '#dde7ef', '#eef2f6'], spring: ['#7cc2ec', '#d6eef7', '#eef6e6'] };
const HOUSE_WALL = ['#f0e6d2', '#e3d5bd', '#d9e0e4', '#e8cdb5', '#cfd8c4', '#f2efe6', '#d7c3a5'];
const HOUSE_ROOF = ['#8a4b3c', '#5d6673', '#7a5a46', '#4f5d52', '#93604a'];
const GLASS = ['#8fb3cf', '#a9c4d6', '#6f93b5', '#c9d3da', '#d7c6a8', '#9eb7c2'];
const BRICK = ['#a85f47', '#96543f', '#b56f52', '#8c4d3d'];
const CAR_COLORS = ['#d94f4f', '#f1f1ef', '#2f3b4d', '#4f8fc0', '#e9b949', '#7b8794', '#3d7a5a'];

function MapView(canvas) {
  this.cv = canvas; this.ctx = canvas.getContext('2d');
  this.cam = { x: 0, y: 420, z: 1 }; this.dpr = 1; this.vw = 300; this.vh = 200;
  this.S = null; this.key = ''; this.layers = null; this.prev = null; this.fade = 1;
  this.overlay = 'none'; this.ovCanvas = null; this.ovKey = '';
  this.cars = []; this.particles = []; this.bursts = []; this.hover = null; this.t = 0; this.fit = 1; this.night = false;
  this.cs = Math.min(2, Math.max(1.25, (typeof window !== 'undefined' && window.innerWidth < 720 ? 1.25 : 2)));
  this.sites = null; this.stack = null; this.userMoved = false;
}
MapView.prototype.setState = function (S) { this.S = S; this.key = ''; this.cars = []; this.sites = null; };
MapView.prototype.resize = function () {
  const r = this.cv.getBoundingClientRect();
  if (!r.width || !r.height) return;
  this.dpr = Math.min(2, window.devicePixelRatio || 1); this.vw = r.width; this.vh = r.height;
  this.cv.width = Math.round(r.width * this.dpr); this.cv.height = Math.round(r.height * this.dpr);
  this.fit = Math.min(this.vw / (CITY_G * HW * 2 * 0.74), this.vh / (CITY_G * HH * 2 * 0.86));
  if (!this.userMoved) { this.cam.z = this.fit * (this.vw < 640 ? 1.5 : 1.12); const c = iso(CAMPUS.ci, CAMPUS.cj - 4, 0); this.cam.x = c[0]; this.cam.y = c[1]; }
  this.clampCam();
};
MapView.prototype.clampCam = function () {
  const c = this.cam; c.z = clamp(c.z, this.fit * 0.7, 3.2);
  c.x = clamp(c.x, -CITY_G * HW, CITY_G * HW); c.y = clamp(c.y, 0, CITY_G * HH * 2);
};
MapView.prototype.home = function () { this.userMoved = false; this.resize(); };
MapView.prototype.centerOn = function (i, j) { const p = iso(i, j, 0); this.cam.x = p[0]; this.cam.y = p[1]; this.userMoved = true; this.clampCam(); };
MapView.prototype.pan = function (dx, dy) { this.cam.x += dx / this.cam.z; this.cam.y += dy / this.cam.z; this.userMoved = true; this.clampCam(); };
MapView.prototype.toWorld = function (sx, sy) { return [(sx - this.vw / 2) / this.cam.z + this.cam.x, (sy - this.vh / 2) / this.cam.z + this.cam.y]; };
MapView.prototype.toScreen = function (wx, wy) { return [(wx - this.cam.x) * this.cam.z + this.vw / 2, (wy - this.cam.y) * this.cam.z + this.vh / 2]; };
MapView.prototype.pickAt = function (sx, sy) {
  if (!this.S) return null;
  const [wx, wy] = this.toWorld(sx, sy), i = Math.floor((wx / HW + wy / HH) / 2), j = Math.floor((wy / HH - wx / HW) / 2);
  if (i < 0 || j < 0 || i >= CITY_G || j >= CITY_G) return null;
  if (inCampus(i, j)) return { type: 'campus' };
  for (const s of this.rivalSites()) if (i >= s.i0 - 0.5 && i < s.i0 + 2.5 && j >= s.j0 - 0.5 && j < s.j0 + 2.5) return { type: 'rival', id: s.k };
  const n = cityLayout(this.S.seed).nb[j * CITY_G + i];
  return n >= 0 ? { type: 'nb', id: n } : null;
};
MapView.prototype.zoomAt = function (sx, sy, f) {
  const before = this.toWorld(sx, sy); this.cam.z = clamp(this.cam.z * f, this.fit * 0.7, 3.2);
  const after = this.toWorld(sx, sy); this.cam.x += before[0] - after[0]; this.cam.y += before[1] - after[1]; this.userMoved = true; this.clampCam();
};
MapView.prototype.rivalSites = function () {
  if (this.sites && this.sites.n === this.S.city.rivals.length) return this.sites.list;
  const L = cityLayout(this.S.seed), list = [];
  this.S.city.rivals.forEach((r, k) => {
    let best = null, bd = 1e9;
    for (let bj = 0; bj < 10; bj++) for (let bi = 0; bi < 10; bi++) {
      const i0 = bi * 4 + 1, j0 = bj * 4 + 1; let ok = true;
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) if (L.type[(j0 + b) * CITY_G + i0 + a] !== T_LOT) ok = false;
      if (!ok || list.some((s) => s.i0 === i0 && s.j0 === j0)) continue;
      const d = Math.hypot(i0 + 1 - r.ci, j0 + 1 - r.cj); if (d < bd) { bd = d; best = { i0, j0, k }; }
    }
    if (best) list.push(best);
  });
  this.sites = { n: this.S.city.rivals.length, list };
  return list;
};

/* ---------- drawing primitives (world coordinates) ---------- */
function poly(c, pts, fill) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) c.lineTo(pts[k][0], pts[k][1]); c.closePath(); c.fillStyle = fill; c.fill(); }
function box(P, i0, j0, i1, j1, z0, z1, wall, top) {
  const c = P.ctx, n = P.night, A = iso(i0, j1, z1), B = iso(i1, j1, z1), C = iso(i1, j1, z0), D = iso(i0, j1, z0), E = iso(i1, j0, z1), F = iso(i1, j0, z0), T0 = iso(i0, j0, z1);
  let lf = tone(wall, 0.92, n), rf = tone(wall, 0.7, n);
  if (z1 - z0 > 15 && !P.flat) {
    /* tall walls darken toward the street, which reads as depth */
    const g1 = c.createLinearGradient(0, A[1], 0, D[1]); g1.addColorStop(0, tone(wall, 1, n)); g1.addColorStop(1, tone(wall, 0.8, n)); lf = g1;
    const g2 = c.createLinearGradient(0, E[1], 0, C[1]); g2.addColorStop(0, tone(wall, 0.78, n)); g2.addColorStop(1, tone(wall, 0.58, n)); rf = g2;
  }
  poly(c, [A, B, C, D], lf); poly(c, [E, B, C, F], rf); poly(c, [T0, E, B, A], tone(top || wall, 1.05, n));
  if (P.flat) return;
  c.lineWidth = 0.6; c.strokeStyle = n ? 'rgba(170,190,255,.2)' : 'rgba(255,255,255,.5)'; c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.lineTo(E[0], E[1]); c.stroke();
  c.strokeStyle = n ? 'rgba(0,0,0,.4)' : 'rgba(20,30,55,.22)'; c.beginPath(); c.moveTo(B[0], B[1]); c.lineTo(C[0], C[1]); c.stroke();
  if (z0 === 0) { c.lineWidth = 1; c.strokeStyle = n ? 'rgba(0,0,0,.45)' : 'rgba(20,30,55,.3)'; c.beginPath(); c.moveTo(D[0], D[1]); c.lineTo(C[0], C[1]); c.lineTo(F[0], F[1]); c.stroke(); }
}
function roofCol(P, hex) { return P.pal.snow ? mixHex(hex, '#f3f6f9', P.pal.snow) : hex; }
function gable(P, i0, j0, i1, j1, z, rh, col, alongI) {
  const c = P.ctx, n = P.night, k = roofCol(P, col);
  if (alongI) {
    const jm = (j0 + j1) / 2;
    poly(c, [iso(i0, j0, z), iso(i1, j0, z), iso(i1, jm, z + rh), iso(i0, jm, z + rh)], tone(k, 0.8, n));
    poly(c, [iso(i0, j1, z), iso(i1, j1, z), iso(i1, jm, z + rh), iso(i0, jm, z + rh)], tone(k, 1.02, n));
    poly(c, [iso(i1, j0, z), iso(i1, j1, z), iso(i1, jm, z + rh)], tone(col === k ? '#e9e2d4' : '#e9e2d4', 0.72, n));
  } else {
    const im = (i0 + i1) / 2;
    poly(c, [iso(i0, j0, z), iso(i0, j1, z), iso(im, j1, z + rh), iso(im, j0, z + rh)], tone(k, 1.02, n));
    poly(c, [iso(i1, j0, z), iso(i1, j1, z), iso(im, j1, z + rh), iso(im, j0, z + rh)], tone(k, 0.74, n));
    poly(c, [iso(i0, j1, z), iso(i1, j1, z), iso(im, j1, z + rh)], tone('#e9e2d4', 0.95, n));
  }
}
function pyramid(P, i0, j0, i1, j1, z, h, col) {
  const c = P.ctx, a = iso((i0 + i1) / 2, (j0 + j1) / 2, z + h), k = roofCol(P, col);
  poly(c, [iso(i0, j1, z), iso(i1, j1, z), a], tone(k, 1, P.night));
  poly(c, [iso(i1, j0, z), iso(i1, j1, z), a], tone(k, 0.72, P.night));
}
function winColor(P, seedA, seedB, litP) {
  if (P.night) return hash(P.seed + 5, seedA, seedB) < (litP == null ? 0.5 : litP) ? '#ffd98a' : '#18223f';
  return hash(P.seed + 5, seedA, seedB) < 0.25 ? '#a9c9e2' : '#4a6685';
}
/* Windows on the left-facing wall (j fixed) or the right-facing wall (i fixed). */
function wins(P, side, a0, a1, fixed, z0, z1, cols, rows, litP) {
  const c = P.ctx, da = (a1 - a0) / cols, dz = (z1 - z0) / rows;
  for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
    const a = a0 + da * (x + 0.24), b = a0 + da * (x + 0.76), za = z0 + dz * (y + 0.22), zb = z0 + dz * (y + 0.74);
    const col = winColor(P, Math.round(a * 97 + fixed * 13) + (side ? 500 : 0), y + Math.round(z0), litP);
    if (side) poly(c, [iso(fixed, a, zb), iso(fixed, b, zb), iso(fixed, b, za), iso(fixed, a, za)], side && !P.night ? tone(col, 0.82, false) : col);
    else poly(c, [iso(a, fixed, zb), iso(b, fixed, zb), iso(b, fixed, za), iso(a, fixed, za)], col);
  }
}
function tree(P, i, j, s, kind) {
  const c = P.ctx, [x, y] = iso(i, j, 0), n = P.night, pal = P.pal, r = hash(P.seed, Math.round(i * 31), Math.round(j * 37));
  if (!n) { c.fillStyle = 'rgba(25,40,70,.15)'; c.beginPath(); c.ellipse(x + 3.5 * s, y + 1.2 * s, 5.2 * s, 2.4 * s, 0, 0, 7); c.fill(); }
  if (kind === 'conifer') {
    const col = pal.snow ? mixHex('#2f6b4a', '#f3f6f9', 0.35) : '#2f6b4a';
    c.fillStyle = tone('#6b4a35', 1, n); c.fillRect(x - 0.8, y - 3 * s, 1.6, 3 * s);
    for (let k = 0; k < 3; k++) poly(c, [[x - (5 - k * 1.2) * s, y - (2 + k * 4) * s], [x + (5 - k * 1.2) * s, y - (2 + k * 4) * s], [x, y - (9 + k * 4) * s]], tone(col, 1 - k * 0.04 + 0.08, n));
    return;
  }
  c.fillStyle = tone('#6b4a35', 1, n); c.fillRect(x - 0.9, y - 5 * s, 1.8, 5 * s);
  if (!pal.leaf) {
    c.strokeStyle = tone('#6b4a35', 1, n); c.lineWidth = 0.9; c.beginPath();
    c.moveTo(x, y - 5 * s); c.lineTo(x - 3.5 * s, y - 10 * s); c.moveTo(x, y - 5 * s); c.lineTo(x + 3 * s, y - 10.5 * s); c.moveTo(x, y - 5 * s); c.lineTo(x, y - 12 * s);
    c.moveTo(x - 1.6 * s, y - 7.5 * s); c.lineTo(x - 4.5 * s, y - 8 * s); c.moveTo(x + 1.5 * s, y - 8 * s); c.lineTo(x + 4.6 * s, y - 8.2 * s); c.stroke();
    c.fillStyle = tone('#f7fafc', 1, n); c.beginPath(); c.arc(x - 3 * s, y - 10 * s, 1.5 * s, 0, 7); c.arc(x + 2.8 * s, y - 10.6 * s, 1.4 * s, 0, 7); c.arc(x, y - 12 * s, 1.5 * s, 0, 7); c.fill();
    return;
  }
  const col = pal.leaf[Math.floor(r * pal.leaf.length)];
  c.fillStyle = tone(col, 0.86, n); c.beginPath(); c.arc(x - 2.8 * s, y - 7 * s, 3.7 * s, 0, 7); c.arc(x + 2.9 * s, y - 7.2 * s, 3.9 * s, 0, 7); c.fill();
  c.fillStyle = tone(col, 1, n); c.beginPath(); c.arc(x, y - 9.2 * s, 5.1 * s, 0, 7); c.fill();
  c.fillStyle = tone(col, 1.14, n); c.beginPath(); c.arc(x - 1.6 * s, y - 10.8 * s, 2.6 * s, 0, 7); c.fill();
}
function flagpole(P, i, j, z, h) { const c = P.ctx, a = iso(i, j, z), b = iso(i, j, z + h); c.strokeStyle = tone('#e8e8e8', 1, P.night); c.lineWidth = 1; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }

/* ---------- campus buildings ---------- */
const CAMPUS_DRAW = {
  main(P, r, sc) {
    const [i0, j0, i1, j1] = r, m = (i0 + i1) / 2, jm = (j0 + j1) / 2, B = '#b0694d', SL = '#56606f';
    box(P, i0, j0 + 0.25, i1, j1 - 0.1, 0, 19, B); gable(P, i0, j0 + 0.25, i1, j1 - 0.1, 19, 8, SL, true);
    wins(P, 0, i0 + 0.1, m - 0.75, j1 - 0.1, 3, 17, 4, 2, 0.7); wins(P, 0, m + 0.75, i1 - 0.1, j1 - 0.1, 3, 17, 4, 2, 0.7); wins(P, 1, j0 + 0.35, j1 - 0.2, i1, 3, 17, 3, 2, 0.7);
    box(P, m - 0.75, j0 + 0.1, m + 0.75, j1 + 0.12, 0, 25, mixHex(B, '#ffffff', 0.08)); gable(P, m - 0.75, j0 + 0.1, m + 0.75, j1 + 0.12, 25, 8, SL, false);
    wins(P, 0, m - 0.6, m + 0.6, j1 + 0.12, 9, 23, 3, 2, 0.85);
    poly(P.ctx, [iso(m - 0.2, j1 + 0.12, 8), iso(m + 0.2, j1 + 0.12, 8), iso(m + 0.2, j1 + 0.12, 0), iso(m - 0.2, j1 + 0.12, 0)], tone(sc[0], 0.9, P.night));
    /* the clock tower */
    box(P, m - 0.3, jm - 0.3, m + 0.3, jm + 0.3, 29, 47, '#bd7557'); box(P, m - 0.35, jm - 0.35, m + 0.35, jm + 0.35, 47, 49.5, '#f1ece0'); pyramid(P, m - 0.37, jm - 0.37, m + 0.37, jm + 0.37, 49.5, 12, sc[0]);
    poly(P.ctx, [iso(m + 0.3, jm - 0.14, 44), iso(m + 0.3, jm + 0.14, 44), iso(m + 0.3, jm + 0.14, 38), iso(m + 0.3, jm - 0.14, 38)], tone('#4a3a34', 1, P.night));
    for (const k of [iso(m, jm + 0.3, 41)]) { const cx = P.ctx; cx.fillStyle = P.night ? '#ffe9b0' : '#fbf8ee'; cx.beginPath(); cx.arc(k[0], k[1], 3.5, 0, 7); cx.fill(); cx.strokeStyle = '#2a2f3a'; cx.lineWidth = 0.8; cx.beginPath(); cx.arc(k[0], k[1], 3.5, 0, 7); cx.moveTo(k[0], k[1]); cx.lineTo(k[0], k[1] - 2.5); cx.moveTo(k[0], k[1]); cx.lineTo(k[0] + 1.7, k[1] + 0.7); cx.stroke(); }
    if (P.solar) solarTop(P, i0 + 0.3, j0 + 0.5, m - 1, jm - 0.1, 24);
  },
  ls(P, r, sc) {
    const [i0, j0, i1, j1] = r, W = '#efe3cd';
    box(P, i0, j0, i1, j0 + 0.95, 0, 11, W); gable(P, i0, j0, i1, j0 + 0.95, 11, 6, '#c8674a', true); wins(P, 0, i0 + 1.1, i1 - 0.1, j0 + 0.95, 3, 9, 4, 1, 0.6);
    box(P, i0, j0 + 0.95, i0 + 1.05, j1, 0, 11, W); gable(P, i0, j0 + 0.95, i0 + 1.05, j1, 11, 6, '#c8674a', false);
    wins(P, 1, j0 + 1.05, j1 - 0.1, i0 + 1.05, 3, 9, 2, 1, 0.6); wins(P, 0, i0 + 0.15, i0 + 0.9, j1, 3, 9, 2, 1, 0.6);
    poly(P.ctx, [iso(i0 + 0.4, j1, 7), iso(i0 + 0.65, j1, 7), iso(i0 + 0.65, j1, 0), iso(i0 + 0.4, j1, 0)], tone(sc[1], 1, P.night));
  },
  us(P, r, sc) {
    const [i0, j0, i1, j1] = r;
    box(P, i0, j0, i1, j1, 0, 26, '#a85f47', '#d9d6cf'); box(P, i0 - 0.02, j0 - 0.02, i1 + 0.02, j1 + 0.02, 26, 28.5, sc[0], '#d9d6cf');
    wins(P, 0, i0 + 0.1, i1 - 0.55, j1, 3, 24, 4, 3, 0.7); wins(P, 1, j0 + 0.1, j1 - 0.65, i1, 3, 24, 4, 3, 0.7);
    box(P, i1 - 0.5, j1 - 0.6, i1 + 0.06, j1 + 0.06, 0, 31, '#8fb7d1', '#e8eef2'); wins(P, 0, i1 - 0.45, i1, j1 + 0.06, 2, 29, 1, 4, 0.9); wins(P, 1, j1 - 0.55, j1, i1 + 0.06, 2, 29, 1, 4, 0.9);
    if (P.solar) solarTop(P, i0 + 0.2, j0 + 0.2, i1 - 0.7, j1 - 0.8, 28.6);
  },
  gym(P, r) { const [i0, j0, i1, j1] = r; box(P, i0, j0, i1, j1, 0, 14, '#c7b299'); gable(P, i0, j0, i1, j1, 14, 6, '#7c8794', true); wins(P, 0, i0 + 0.2, i1 - 0.2, j1, 8, 13, 5, 1, 0.5); },
  wing(P, r, sc) {
    const [i0, j0, i1, j1] = r;
    box(P, i0, j0 + 0.2, i1 - 0.5, j1, 0, 18, '#e9e6df', '#d5d2ca'); box(P, i0 - 0.02, j0 + 0.18, i1 - 0.48, j1 + 0.02, 18, 20, sc[0], '#d5d2ca');
    wins(P, 0, i0 + 0.1, i1 - 0.6, j1, 2.5, 16.5, 4, 3, 0.7); wins(P, 1, j0 + 0.3, j1 - 0.1, i1 - 0.5, 2.5, 16.5, 3, 3, 0.7);
    box(P, i1 - 0.6, j0 + 0.5, i1, j1 - 0.3, 0, 11, '#b9694c', '#d5d2ca'); wins(P, 1, j0 + 0.6, j1 - 0.4, i1, 2, 9.5, 2, 2, 0.7);
  },
  library(P, r, sc) {
    const [i0, j0, i1, j1] = r, ST = '#ddd3bf';
    box(P, i0, j0, i1, j1 - 0.25, 0, 17, ST); gable(P, i0, j0, i1, j1 - 0.25, 17, 7, '#6a7a72', false);
    wins(P, 1, j0 + 0.15, j1 - 0.4, i1, 3, 15, 3, 2, 0.8);
    for (let k = 0; k < 5; k++) { const a = i0 + 0.12 + k * (i1 - i0 - 0.34) / 4; box(P, a, j1 - 0.2, a + 0.1, j1 - 0.08, 0, 15, '#f4eedf'); }
    box(P, i0, j1 - 0.28, i1, j1 - 0.02, 15, 17, '#efe8d8');
    box(P, i0 - 0.05, j1 - 0.05, i1 + 0.02, j1 + 0.1, 0, 1.5, '#cfc6b3');
  },
  science(P, r, sc) {
    const [i0, j0, i1, j1] = r;
    box(P, i0, j0, i1, j1, 0, 22, '#9cc3d8', '#e8eef2'); wins(P, 0, i0 + 0.05, i1 - 0.05, j1, 1.5, 21, 6, 4, 0.85); wins(P, 1, j0 + 0.05, j1 - 0.05, i1, 1.5, 21, 5, 4, 0.85);
    box(P, i0 - 0.03, j0 - 0.03, i1 + 0.03, j1 + 0.03, 22, 23.5, '#f4f6f8');
    const d = iso(i0 + 0.65, j0 + 0.65, 23.5), c = P.ctx; c.fillStyle = tone('#eef2f5', 1, P.night); c.beginPath(); c.arc(d[0], d[1], 9, Math.PI, 0); c.closePath(); c.fill();
    c.fillStyle = tone('#eef2f5', 0.78, P.night); c.beginPath(); c.arc(d[0], d[1], 9, -Math.PI / 2.6, 0); c.lineTo(d[0], d[1]); c.closePath(); c.fill();
    c.strokeStyle = tone('#39485c', 1, P.night); c.lineWidth = 1.4; c.beginPath(); c.moveTo(d[0] - 2, d[1] - 8.6); c.lineTo(d[0] - 2, d[1]); c.stroke();
    box(P, i1 - 0.8, j0 + 0.3, i1 - 0.2, j0 + 0.9, 23.5, 27, sc[0]);
  },
  arts(P, r, sc) {
    const [i0, j0, i1, j1] = r;
    box(P, i0, j0, i1, j1, 0, 15, '#dcd6ca'); box(P, i0 + 0.15, j0 + 0.15, i0 + 1.15, j0 + 1.1, 15, 31, sc[0], mixHex(sc[0], '#ffffff', 0.2));
    poly(P.ctx, [iso(i0 + 0.2, j1, 15), iso(i1 - 0.2, j1, 15), iso(i1 - 0.2, j1, 8), iso(i0 + 0.2, j1, 8)], P.night ? '#ffd98a' : '#5c7fa1');
    box(P, i0 + 0.1, j1, i1 - 0.1, j1 + 0.16, 6.5, 8, sc[1]);
    wins(P, 1, j0 + 0.2, j1 - 0.1, i1, 3, 13, 3, 2, 0.6);
  },
  fieldhouse(P, r, sc) {
    const [i0, j0, i1, j1] = [r[0], r[1] - 0.25, r[2] + 0.25, r[3] + 0.2];
    box(P, i0, j0, i1, j1, 0, 17, '#e3e6ea'); gable(P, i0, j0, i1, j1, 17, 10, sc[0], true);
    poly(P.ctx, [iso(i0, j1, 9), iso(i1, j1, 9), iso(i1, j1, 6), iso(i0, j1, 6)], tone(sc[1], 1, P.night));
    wins(P, 0, i0 + 0.2, i1 - 0.2, j1, 10.5, 15.5, 7, 1, 0.8); wins(P, 1, j0 + 0.2, j1 - 0.2, i1, 2, 8, 3, 1, 0.8);
  },
  dining(P, r, sc) {
    const [i0, j0, i1, j1] = r, c = P.ctx;
    box(P, i0, j0, i1, j1 - 0.45, 0, 10, '#a9cbd9'); wins(P, 0, i0 + 0.05, i1 - 0.05, j1 - 0.45, 1, 9, 5, 1, 0.9); wins(P, 1, j0 + 0.05, j1 - 0.5, i1, 1, 9, 3, 1, 0.9);
    box(P, i0 - 0.1, j0 - 0.1, i1 + 0.1, j1 - 0.3, 10, 11.5, '#b98d5e', roofCol(P, '#c79a68'));
    for (let k = 0; k < 4; k++) { const p = iso(i0 + 0.3 + k * (i1 - i0 - 0.6) / 3, j1 - 0.1, 4); c.fillStyle = tone(k % 2 ? sc[1] : sc[0], 1, P.night); c.beginPath(); c.ellipse(p[0], p[1], 4.4, 2.2, 0, 0, 7); c.fill(); }
  },
  elc(P, r) {
    const [i0, j0, i1, j1] = r, cols = ['#f2b05e', '#7fb7a3', '#e7775f'], w = (i1 - i0) / 3;
    for (let k = 0; k < 3; k++) { const a = i0 + k * w; box(P, a + 0.04, j0 + 0.2 + (k % 2) * 0.25, a + w - 0.04, j1 - 0.3 + (k % 2) * 0.2, 0, 8, cols[k]); gable(P, a + 0.04, j0 + 0.2 + (k % 2) * 0.25, a + w - 0.04, j1 - 0.3 + (k % 2) * 0.2, 8, 4.5, '#6c7683', false); }
  },
};
CAMPUS_DRAW.wingL = CAMPUS_DRAW.wingM = CAMPUS_DRAW.wingU = CAMPUS_DRAW.wing;
const CAMPUS_H = { main: 61, ls: 17, us: 31, gym: 20, wingL: 20, wingM: 20, wingU: 20, library: 24, science: 32, arts: 31, fieldhouse: 27, dining: 12, elc: 13 };
function solarTop(P, i0, j0, i1, j1, z) { const c = P.ctx; for (let a = i0; a < i1 - 0.2; a += 0.42) poly(c, [iso(a, j0, z), iso(a + 0.32, j0, z), iso(a + 0.32, j1, z), iso(a, j1, z)], tone('#27406b', 1, P.night)); }
function siteOf(S, b) { if (b.slot >= 0) return SLOTS[b.slot]; if (b.t === 'fieldhouse') return FIXED_SITES.gym; return FIXED_SITES[b.t] || null; }

/* ---------- city lots ---------- */
function drawLot(P, i, j, type, r, nb) {
  const s = P.seed, r2 = hash(s, i * 7 + 3, j * 5 + 1), r3 = hash(s, i * 3 + 9, j * 11 + 4), c = P.ctx;
  if (type === 'downtown') {
    const d = Math.hypot(i - 22, j - 15.5), h = 26 + r * 70 * clamp(1.25 - d / 9, 0.25, 1) + (r2 > 0.9 ? 30 : 0), g = GLASS[Math.floor(r2 * GLASS.length)];
    box(P, i + 0.1, j + 0.1, i + 0.9, j + 0.9, 0, h, g, '#d6dbe0');
    wins(P, 0, i + 0.13, i + 0.87, j + 0.9, 3, h - 2, 3, Math.max(2, Math.round(h / 9)), 0.55); wins(P, 1, j + 0.13, j + 0.87, i + 0.9, 3, h - 2, 3, Math.max(2, Math.round(h / 9)), 0.55);
    if (r3 > 0.6) box(P, i + 0.35, j + 0.35, i + 0.65, j + 0.65, h, h + 5, '#9aa3ad');
    if (r3 > 0.92) flagpole(P, i + 0.5, j + 0.5, h + 5, 16);
    return h;
  }
  if (type === 'university') {
    const h = 17 + r * 10; box(P, i + 0.08, j + 0.14, i + 0.92, j + 0.86, 0, h, BRICK[Math.floor(r2 * 4)]);
    gable(P, i + 0.08, j + 0.14, i + 0.92, j + 0.86, h, 6, r3 > 0.5 ? '#5d8f7b' : '#5d6673', true);
    wins(P, 0, i + 0.12, i + 0.88, j + 0.86, 2.5, h - 1.5, 4, 2, 0.5); wins(P, 1, j + 0.2, j + 0.8, i + 0.92, 2.5, h - 1.5, 2, 2, 0.5);
    return h + 6;
  }
  if (type === 'arts') {
    const lofty = hash(s, i, j + 900) < clamp((nb.inc / P.S.costIdx - 60) / 70, 0.1, 0.8), h = 11 + r * 7, wall = lofty ? ['#d8574a', '#e9b949', '#4f8fc0', '#7fb7a3', '#b0694d'][Math.floor(r2 * 5)] : BRICK[Math.floor(r2 * 4)];
    box(P, i + 0.06, j + 0.06, i + 0.94, j + 0.94, 0, h, wall, '#8d9299');
    for (let k = 0; k < 3; k++) poly(c, [iso(i + 0.1 + k * 0.28, j + 0.1, h), iso(i + 0.3 + k * 0.28, j + 0.1, h + 3.5), iso(i + 0.3 + k * 0.28, j + 0.9, h + 3.5), iso(i + 0.1 + k * 0.28, j + 0.9, h)], tone(roofCol(P, '#a9b0b8'), 1, P.night));
    wins(P, 0, i + 0.1, i + 0.9, j + 0.94, 3, h - 1.5, 4, 1, 0.45); wins(P, 1, j + 0.1, j + 0.9, i + 0.94, 3, h - 1.5, 3, 1, 0.45);
    if (r3 > 0.9) { box(P, i + 0.4, j + 0.4, i + 0.55, j + 0.55, h, h + 26, '#8c4d3d'); if (!P.stack) P.stack = iso(i + 0.47, j + 0.47, h + 27); }
    return h + 4;
  }
  if (type === 'working') {
    const h = 10 + r * 3, w = BRICK[Math.floor(r2 * 4)], alongI = (i + j) % 2 === 0;
    if (alongI) { box(P, i + 0.04, j + 0.22, i + 0.96, j + 0.8, 0, h, w, roofCol(P, '#7d8087')); wins(P, 0, i + 0.08, i + 0.92, j + 0.8, 2, h - 1, 4, 2, 0.5); wins(P, 1, j + 0.26, j + 0.76, i + 0.96, 2, h - 1, 1, 2, 0.5); }
    else { box(P, i + 0.22, j + 0.04, i + 0.8, j + 0.96, 0, h, w, roofCol(P, '#7d8087')); wins(P, 1, j + 0.08, j + 0.92, i + 0.8, 2, h - 1, 4, 2, 0.5); wins(P, 0, i + 0.26, i + 0.76, j + 0.96, 2, h - 1, 1, 2, 0.5); }
    return h;
  }
  /* houses: old money (large), new suburb, middle, south, streetcar */
  const big = type === 'oldmoney' ? 1 : type === 'newsuburb' ? 0.8 : type === 'streetcar' ? 0.6 : 0.35;
  if (r3 < 0.3 + big * 0.25) tree(P, i + 0.2, j + 0.22, 0.75 + big * 0.35, r2 > 0.8 ? 'conifer' : 'leaf');
  const in0 = 0.3 - big * 0.1, h = 8 + big * 4 + r * 2, wall = HOUSE_WALL[Math.floor(r2 * HOUSE_WALL.length)], roof = HOUSE_ROOF[Math.floor(r * HOUSE_ROOF.length)], alongI = r2 > 0.5;
  const a0 = i + in0, b0 = j + in0 + 0.05, a1 = i + 1 - in0, b1 = j + 1 - in0 - 0.02;
  box(P, a0, b0, a1, b1, 0, h, type === 'oldmoney' && r > 0.5 ? BRICK[Math.floor(r3 * 4)] : wall); gable(P, a0 - 0.03, b0 - 0.03, a1 + 0.03, b1 + 0.03, h, 5 + big * 2.5, roof, alongI);
  wins(P, 0, a0 + 0.04, a1 - 0.04, b1, 2, h - 1, 2, big > 0.5 ? 2 : 1, 0.6); wins(P, 1, b0 + 0.04, b1 - 0.04, a1, 2, h - 1, 2, big > 0.5 ? 2 : 1, 0.6);
  if (P.pal.snow && r3 > 0.5) { P.chimneys.push(iso(a0 + 0.15, b0 + 0.2, h + 8)); }
  if (r3 > 0.62) tree(P, i + 0.86, j + 0.9, 0.6 + big * 0.3, 'leaf');
  return h + 7;
}
function drawRival(P, k, i0, j0, r) {
  const c = P.ctx;
  if (r.id === 'elite') {
    box(P, i0 + 0.1, j0 + 0.3, i0 + 1.9, j0 + 1.5, 0, 20, '#b7ad9a'); gable(P, i0 + 0.1, j0 + 0.3, i0 + 1.9, j0 + 1.5, 20, 9, '#4d5868', true);
    wins(P, 0, i0 + 0.2, i0 + 1.8, j0 + 1.5, 3, 18, 6, 2, 0.7); wins(P, 1, j0 + 0.4, j0 + 1.4, i0 + 1.9, 3, 18, 3, 2, 0.7);
    box(P, i0 + 0.8, j0 + 1.3, i0 + 1.25, j0 + 1.75, 0, 36, '#c4baa6'); pyramid(P, i0 + 0.76, j0 + 1.26, i0 + 1.29, j0 + 1.79, 36, 12, '#4d5868');
    P.flags.push({ p: iso(i0 + 1.02, j0 + 1.52, 48), col: '#7a1f2b', h: 9 });
  } else if (r.id === 'prog') {
    box(P, i0 + 0.15, j0 + 0.3, i0 + 1.85, j0 + 1.1, 0, 11, '#c99a62', roofCol(P, '#7fae6a')); box(P, i0 + 0.3, j0 + 1.1, i0 + 1.0, j0 + 1.8, 0, 9, '#e6d9bf', roofCol(P, '#7fae6a'));
    wins(P, 0, i0 + 1.0, i0 + 1.8, j0 + 1.1, 2, 9.5, 3, 1, 0.7); wins(P, 0, i0 + 0.35, i0 + 0.95, j0 + 1.8, 2, 8, 2, 1, 0.7); wins(P, 1, j0 + 0.35, j0 + 1.05, i0 + 1.85, 2, 9.5, 2, 1, 0.7);
    tree(P, i0 + 1.5, j0 + 1.6, 1.1, 'leaf'); P.flags.push({ p: iso(i0 + 0.3, j0 + 0.4, 11), col: '#2f8f6a', h: 12 });
  } else if (r.id === 'parish') {
    box(P, i0 + 0.2, j0 + 0.4, i0 + 1.5, j0 + 1.1, 0, 15, '#d8cdb8'); gable(P, i0 + 0.2, j0 + 0.4, i0 + 1.5, j0 + 1.1, 15, 9, '#7a4a3c', true);
    box(P, i0 + 1.5, j0 + 0.5, i0 + 1.85, j0 + 0.95, 0, 29, '#d8cdb8'); pyramid(P, i0 + 1.47, j0 + 0.47, i0 + 1.88, j0 + 0.98, 29, 13, '#7a4a3c');
    wins(P, 0, i0 + 0.3, i0 + 1.4, j0 + 1.1, 4, 13, 4, 1, 0.6);
    box(P, i0 + 0.3, j0 + 1.3, i0 + 1.6, j0 + 1.8, 0, 9, BRICK[1], roofCol(P, '#8d9299')); wins(P, 0, i0 + 0.35, i0 + 1.55, j0 + 1.8, 2, 8, 5, 1, 0.6);
  } else {
    box(P, i0 + 0.15, j0 + 0.25, i0 + 1.85, j0 + 1.7, 0, 16, '#e8e8e4', '#cfd3d6'); box(P, i0 + 0.13, j0 + 0.23, i0 + 1.87, j0 + 1.72, 16, 18, '#ef7d3c', '#cfd3d6');
    wins(P, 0, i0 + 0.2, i0 + 1.8, j0 + 1.7, 2.5, 14.5, 6, 2, 0.7); wins(P, 1, j0 + 0.3, j0 + 1.65, i0 + 1.85, 2.5, 14.5, 4, 2, 0.7);
    P.flags.push({ p: iso(i0 + 0.2, j0 + 0.3, 18), col: '#ef7d3c', h: 10 });
  }
}

/* ---------- building the cached layers ---------- */
MapView.prototype.stateKey = function () {
  const S = this.S;
  return [season(S), this.night ? 1 : 0, S.colors.join(''), S.bld.map((b) => b.t + b.slot).join(','), S.builds.map((b) => b.t + b.slot + Math.floor((1 - b.left / b.total) * 4)).join(','),
    S.city.nbs.map((n) => Math.round(n.density * 30)).join(''), S.city.rivals.map((r) => (r.open ? 1 : 0)).join(''), Math.round(S.city.nbs[7].inc / S.costIdx / 8)].join('|');
};
MapView.prototype.rebuild = function () {
  const t0 = performance.now();
  const S = this.S, cs = this.cs, L = cityLayout(S.seed), G = CITY_G, night = this.night, pal = SEASON_PAL[season(S)];
  const mk = () => { const c = document.createElement('canvas'); c.width = Math.round(M_W * cs); c.height = Math.round(M_H * cs); const x = c.getContext('2d'); x.setTransform(cs, 0, 0, cs, M_OX * cs, M_OY * cs); return [c, x]; };
  const [gc, g] = mk(), [oc, o] = mk();
  const P = { ctx: o, night, pal, seed: S.seed, S, flags: [], chimneys: [], stack: null, solar: has(S, 'solar') };
  const T = (h, m) => tone(h, m == null ? 1 : m, night), sc = S.colors;
  const sites = this.rivalSites(), special = new Set(); sites.forEach((s) => { for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) special.add((s.j0 + b) * G + s.i0 + a); });

  /* slab */
  const th = 30;
  poly(g, [iso(0, G, 0), iso(G, G, 0), iso(G, G, -th), iso(0, G, -th)], T('#8a6f55', 0.95)); poly(g, [iso(G, 0, 0), iso(G, G, 0), iso(G, G, -th), iso(G, 0, -th)], T('#8a6f55', 0.72));
  poly(g, [iso(0, G, -7), iso(G, G, -7), iso(G, G, -13), iso(0, G, -13)], T('#a3876a', 0.95)); poly(g, [iso(G, 0, -7), iso(G, G, -7), iso(G, G, -13), iso(G, 0, -13)], T('#a3876a', 0.72));
  poly(g, [iso(0, G, 0), iso(G, G, 0), iso(G, G, -3), iso(0, G, -3)], T(pal.snow ? '#dfe7ee' : '#6fa055', 0.95)); poly(g, [iso(G, 0, 0), iso(G, G, 0), iso(G, G, -3), iso(G, 0, -3)], T(pal.snow ? '#dfe7ee' : '#6fa055', 0.75));
  { const rc = riverC(S.seed, G - 0.5); poly(g, [iso(G, rc - 1.5, 0), iso(G, rc + 1.4, 0), iso(G, rc + 1.4, -th), iso(G, rc - 1.5, -th)], T(pal.water, 0.8)); }

  /* ground tiles, in tile space */
  g.save(); g.transform(HW, HH, -HW, HH, 0, 0);
  const nbs = S.city.nbs, parkP = { downtown: 0.08, oldmoney: 0.14, newsuburb: 0.1, middle: 0.07, south: 0.09, working: 0.04, university: 0.22, arts: 0.05, streetcar: 0.1 };
  const isPark = (i, j, n) => { const bi = i >> 2, bj = j >> 2; if (hash(S.seed, bi * 31 + bj, 77) < parkP[nbs[n].type]) return true; for (let d = -1; d <= 1; d++) if (L.type[clamp(j + d, 0, G - 1) * G + i] === T_WATER) return true; return false; };
  const side = pal.snow ? '#dfe4ea' : '#c3c7cd', asph = pal.snow ? '#7b828d' : '#636a76';
  for (let pass = 0; pass < 2; pass++) {
  if (pass === 1) {
    /* a smooth river over the blocky tiles, with a pale bank */
    const bank = (w, col) => { g.beginPath(); for (let x = 0; x <= G; x += 0.25) g.lineTo(x, riverC(S.seed, x - 0.5) - w); for (let x = G; x >= 0; x -= 0.25) g.lineTo(x, riverC(S.seed, x - 0.5) + w); g.closePath(); g.fillStyle = col; g.fill(); };
    bank(1.62, T(pal.snow ? '#dfe7ee' : '#d9cfa8')); bank(1.47, T(pal.water, 1)); bank(0.8, T(pal.water, 1.05));
    g.strokeStyle = night ? 'rgba(190,210,255,.25)' : 'rgba(255,255,255,.75)'; g.lineWidth = 0.05;
    for (const w of [-1.47, 1.47]) { g.beginPath(); for (let x = 0; x <= G; x += 0.25) g.lineTo(x, riverC(S.seed, x - 0.5) + w); g.stroke(); }
    g.strokeStyle = night ? 'rgba(190,210,255,.14)' : 'rgba(255,255,255,.38)'; g.lineWidth = 0.035;
    for (let k = 0; k < 80; k++) { const x = hash(S.seed, k, 91) * G, y = riverC(S.seed, x - 0.5) + (hash(S.seed, k, 92) - 0.5) * 2.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 0.25 + hash(S.seed, k, 93) * 0.3, y + 0.04); g.stroke(); }
  }
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const t = L.type[j * G + i], n = L.nb[j * G + i], r = hash(S.seed, i, j);
    if (pass === 0 && t === T_WATER) { g.fillStyle = T(pal.water, 1); g.fillRect(i, j, 1.03, 1.03); continue; }
    if ((pass === 1) !== (t === T_ROAD || t === T_BRIDGE)) continue;
    if (t === T_CAMPUS) { g.fillStyle = T(pal.lawn, (i + j) % 2 ? 1 : 0.965); g.fillRect(i, j, 1.03, 1.03); continue; }
    if (t === T_ROAD || t === T_BRIDGE) {
      g.fillStyle = T(t === T_BRIDGE ? '#d8d2c4' : side); g.fillRect(i, j, 1.03, 1.03); g.fillStyle = T(asph);
      const v = i % 4 === 0, h = j % 4 === 0;
      if (v) g.fillRect(i + 0.14, j, 0.72, 1.03); if (h && t !== T_BRIDGE) g.fillRect(i, j + 0.14, 1.03, 0.72);
      g.fillStyle = T('#f1e9c9', 0.95);
      if (v && !h) g.fillRect(i + 0.485, j + 0.2, 0.03, 0.6); if (h && !v) g.fillRect(i + 0.2, j + 0.485, 0.6, 0.03);
      continue;
    }
    const ty = nbs[n].type, park = isPark(i, j, n);
    let col = pal.grass;
    if (park) col = pal.park; else if (ty === 'downtown') col = pal.snow ? '#dfe3e8' : '#c9ccd1'; else if (ty === 'arts') col = pal.snow ? '#dcdcd8' : '#bdb8ab'; else if (ty === 'working') col = mixHex(pal.grass, '#b5ad8a', pal.snow ? 0 : 0.3);
    g.fillStyle = T(col, 0.96 + r * 0.08); g.fillRect(i, j, 1.03, 1.03);
    if (park && r > 0.9 && L.type[j * G + i + 1] === T_LOT) { g.fillStyle = T(pal.water, 1.05); g.beginPath(); g.ellipse(i + 0.5, j + 0.5, 0.42, 0.3, 0.4, 0, 7); g.fill(); }
  }
  }
  /* texture: grass tufts, petals and leaves in season, crosswalks at every intersection */
  const se = season(S);
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const t = L.type[j * G + i];
    if (t === T_LOT || t === T_CAMPUS) {
      const ty = t === T_LOT ? nbs[L.nb[j * G + i]].type : 'campus'; if (ty === 'downtown' || ty === 'arts') continue;
      for (let k = 0; k < 5; k++) {
        const rx = hash(S.seed, i * 13 + k, j * 7 + 2), ry = hash(S.seed, i * 5 + k, j * 11 + 3), rc = hash(S.seed, i + k * 3, j + 9);
        g.fillStyle = pal.snow ? T('#cfdbe6') : se === 'spring' && rc > 0.6 ? T(['#f6c1d0', '#fff2a8', '#ffffff'][k % 3]) : se === 'fall' && rc > 0.55 ? T(['#d98a2b', '#c9542b'][k % 2]) : T(mixHex(pal.grass, '#1d3b1a', 0.24));
        g.fillRect(i + 0.08 + rx * 0.84, j + 0.08 + ry * 0.84, 0.06, 0.06);
      }
    } else if (t === T_ROAD && i % 4 === 0 && j % 4 === 0) {
      g.fillStyle = T('#eef0f2', 0.95);
      for (let k = 0; k < 4; k++) { const a = 0.2 + k * 0.165; g.fillRect(i + a, j + 0.02, 0.08, 0.1); g.fillRect(i + a, j + 0.88, 0.08, 0.1); g.fillRect(i + 0.02, j + a, 0.1, 0.08); g.fillRect(i + 0.88, j + a, 0.1, 0.08); }
    }
  }
  /* campus ground: paths, quad, field */
  const path = pal.snow ? '#d9d4c8' : '#e6dcc3', Q = FIXED_SITES.quad, F = FIXED_SITES.field, C = CAMPUS;
  g.fillStyle = T(path);
  g.fillRect(22.3, 23.2, 0.4, 8.8); g.fillRect(17.4, 26.42, 10.3, 0.34); g.fillRect(17.4, 23.72, 10.3, 0.3); g.fillRect(19.95, 23.7, 0.3, 5.3); g.fillRect(24.95, 23.7, 0.3, 5.3); g.fillRect(17.4, 28.95, 5.2, 0.3);
  g.beginPath(); g.ellipse(22.5, 25.2, 0.95, 0.95, 0, 0, 7); g.fill();
  g.fillStyle = T('#cfc6b3'); g.beginPath(); g.ellipse(22.5, 25.2, 0.5, 0.5, 0, 0, 7); g.fill();
  g.fillStyle = T(pal.water, 1.08); g.beginPath(); g.ellipse(22.5, 25.2, 0.4, 0.4, 0, 0, 7); g.fill();
  if (!pal.snow) for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; g.fillStyle = T(k % 2 ? sc[1] : sc[0], 1.1); g.fillRect(22.5 + Math.cos(a) * 0.74 - 0.045, 25.2 + Math.sin(a) * 0.74 - 0.045, 0.09, 0.09); }
  const turf = has(S, 'turf');
  g.fillStyle = T('#c66b4a', pal.snow ? 1.15 : 1); g.beginPath(); g.ellipse((F[0] + F[2]) / 2, (F[1] + F[3]) / 2, (F[2] - F[0]) / 2 + 0.1, (F[3] - F[1]) / 2 + 0.1, 0, 0, 7); g.fill();
  for (let k = 0; k < 8; k++) { g.fillStyle = T(turf ? (k % 2 ? '#3f9a54' : '#4aa85f') : pal.snow ? '#e4ecf0' : (k % 2 ? '#7cc468' : '#86cc70')); g.fillRect(F[0] + 0.45 + k * (F[2] - F[0] - 0.9) / 8, F[1] + 0.3, (F[2] - F[0] - 0.9) / 8 + 0.01, F[3] - F[1] - 0.6); }
  g.strokeStyle = T('#ffffff', 0.97); g.lineWidth = 0.04; g.strokeRect(F[0] + 0.45, F[1] + 0.3, F[2] - F[0] - 0.9, F[3] - F[1] - 0.6);
  g.beginPath(); g.moveTo((F[0] + F[2]) / 2, F[1] + 0.3); g.lineTo((F[0] + F[2]) / 2, F[3] - 0.3); g.stroke(); g.beginPath(); g.ellipse((F[0] + F[2]) / 2, (F[1] + F[3]) / 2, 0.35, 0.35, 0, 0, 7); g.stroke();
  if (turf) { g.fillStyle = T(sc[0]); g.fillRect(F[0] + 0.45, F[1] + 0.3, 0.3, F[3] - F[1] - 0.6); g.fillRect(F[2] - 0.75, F[1] + 0.3, 0.3, F[3] - F[1] - 0.6); }
  /* playground and parking */
  g.fillStyle = T('#d9b98a'); g.fillRect(18.7, 22.65, 1.2, 0.8);
  g.fillStyle = T(asph, 1.1); g.fillRect(17.3, 31.5, 2.4, 0.42); g.fillStyle = T('#ffffff', 0.9); for (let k = 0; k < 7; k++) g.fillRect(17.4 + k * 0.33, 31.52, 0.03, 0.36);
  /* construction pads */
  for (const b of S.builds) { const r = siteOf(S, b); if (!r || b.t === 'turf') continue; g.fillStyle = T('#b89b72'); g.fillRect(r[0] - 0.15, r[1] - 0.15, r[2] - r[0] + 0.3, r[3] - r[1] + 0.3); }
  if (has(S, 'solar')) { g.fillStyle = T('#27406b'); for (let k = 0; k < 6; k++) g.fillRect(20.2 + k * 0.3, 31.5, 0.22, 0.42); }
  g.restore();

  /* object list */
  const objs = [], add = (d, fn, sh) => objs.push({ d, fn, sh });
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const k = j * G + i, t = L.type[k], n = L.nb[k];
    if (t !== T_LOT || special.has(k)) continue;
    const nb = nbs[n], r = hash(S.seed, i, j), fillRank = hash(S.seed, i + 400, j + 200);
    if (S.flags && has(S, 'housing') && j === 25 && i >= 13 && i <= 15) {
      add(i + j + 2, () => { box(P, i + 0.22, j + 0.28, i + 0.8, j + 0.78, 0, 9, '#efe6d3'); gable(P, i + 0.2, j + 0.26, i + 0.82, j + 0.8, 9, 5.5, sc[0], true); wins(P, 0, i + 0.26, i + 0.76, j + 0.78, 2, 8, 2, 1, 0.8); }, [i + 0.22, j + 0.28, i + 0.8, j + 0.78, 12]);
      continue;
    }
    if (isPark(i, j, n)) { add(i + j + 1.2, () => { if (r > 0.25) tree(P, i + 0.3 + r * 0.3, j + 0.35, 0.9 + r * 0.5, r > 0.85 ? 'conifer' : 'leaf'); if (fillRank > 0.5) tree(P, i + 0.75, j + 0.7, 0.8 + fillRank * 0.4, 'leaf'); }); continue; }
    if (fillRank > nb.density) { if (r > 0.7) add(i + j + 1.2, () => tree(P, i + 0.5, j + 0.5, 0.8, 'leaf')); continue; }
    const hgt = nb.type === 'downtown' ? 60 : 14;
    add(i + j + 2, () => drawLot(P, i, j, nb.type, r, nb), [i + 0.15, j + 0.15, i + 0.85, j + 0.85, nb.type === 'downtown' ? 26 + r * 50 : nb.type === 'university' ? 22 : 12]);
  }
  sites.forEach((s) => { const r = S.city.rivals[s.k]; if (!r.open) { add(s.i0 + s.j0 + 4, () => { box(P, s.i0 + 0.3, s.j0 + 0.4, s.i0 + 1.7, s.j0 + 1.5, 0, 12, '#9a958c'); }); return; } add(s.i0 + s.j0 + 4, () => drawRival(P, s.k, s.i0, s.j0, r), [s.i0 + 0.2, s.j0 + 0.3, s.i0 + 1.8, s.j0 + 1.6, 18]); });
  /* street life: bridge rails, lamp posts, street trees, parked cars */
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const t = L.type[j * G + i], r = hash(S.seed, i + 77, j + 31);
    if (t === T_BRIDGE) { add(i + j + 1.05, () => box(P, i + 0.1, j, i + 0.15, j + 1, 0, 3.2, '#e9e3d5')); add(i + j + 1.95, () => box(P, i + 0.85, j, i + 0.9, j + 1, 0, 3.2, '#e9e3d5')); continue; }
    if (t !== T_ROAD) continue;
    const v = i % 4 === 0, h = j % 4 === 0;
    if (v && h) { add(i + j + 0.3, () => { flagpole(P, i + 0.08, j + 0.08, 0, 11); const q = iso(i + 0.08, j + 0.08, 11); o.fillStyle = night ? '#ffe2a0' : '#d9dde2'; o.fillRect(q[0] - 1.6, q[1] - 1, 3.2, 1.8); }); continue; }
    const n = L.nb[j * G + i]; if (n < 0) continue;
    const ty = nbs[n].type, leafy = ty !== 'downtown' && ty !== 'arts' && ty !== 'working';
    if (leafy && r < 0.36) { const a = v ? [i + 0.07, j + 0.2 + r] : [i + 0.2 + r, j + 0.07]; add(a[0] + a[1] + 0.1, () => tree(P, a[0], a[1], 0.6, 'leaf')); }
    else if (!leafy && r < 0.45) { const col = CAR_COLORS[Math.floor(r * 15) % CAR_COLORS.length], tp = mixHex(col, '#ffffff', 0.25); if (v) add(i + j + 1, () => box(P, i + 0.74, j + 0.3, i + 0.86, j + 0.62, 0.4, 3.4, col, tp)); else add(i + j + 1, () => box(P, i + 0.3, j + 0.74, i + 0.62, j + 0.86, 0.4, 3.4, col, tp)); }
  }
  /* campus details: playground, parked cars */
  add(19.0 + 23.0, () => box(P, 18.85, 22.8, 19.0, 23.0, 0, 5, '#e2574c')); add(19.35 + 23.3, () => box(P, 19.3, 22.8, 19.35, 23.3, 0, 6, '#f2c230')); add(19.75 + 23.25, () => box(P, 19.55, 23.05, 19.75, 23.25, 0, 3.5, '#3f8fd0'));
  for (let k = 0; k < 7; k++) { if (hash(S.seed, k, 55) > 0.72) continue; const col = CAR_COLORS[Math.floor(hash(S.seed, k, 56) * CAR_COLORS.length)]; add(51.3 + k * 0.01, () => box(P, 17.44 + k * 0.33, 31.56, 17.62 + k * 0.33, 31.86, 0.4, 3.4, col, mixHex(col, '#ffffff', 0.25))); }
  /* campus */
  for (const b of S.bld) {
    const r = siteOf(S, b); if (!r || !CAMPUS_DRAW[b.t]) continue;
    add(r[2] + r[3], () => CAMPUS_DRAW[b.t](P, r, sc), [r[0], r[1], r[2], r[3], CAMPUS_H[b.t] * 0.6]);
  }
  this.cranes = [];
  for (const b of S.builds) {
    const r = siteOf(S, b); if (!r || b.t === 'turf') continue;
    const pr = 1 - b.left / b.total, H = (CAMPUS_H[b.t] || 18) * 0.8;
    this.cranes.push({ p: iso(r[0] + 0.2, r[1] + 0.2, 0), h: H + 26 });
    add(r[2] + r[3], () => {
      box(P, r[0] + 0.1, r[1] + 0.1, r[2] - 0.1, r[3] - 0.1, 0, Math.max(2, H * pr), '#b9bcc0', '#a4a8ad');
      o.strokeStyle = T('#e2a53a'); o.lineWidth = 0.8; o.beginPath();
      for (let z = 0; z <= H; z += 6) { const a = iso(r[0], r[3], z), q = iso(r[2], r[3], z), w = iso(r[2], r[1], z); o.moveTo(a[0], a[1]); o.lineTo(q[0], q[1]); o.lineTo(w[0], w[1]); }
      for (let a = r[0]; a <= r[2] + 0.01; a += (r[2] - r[0]) / 4) { const p0 = iso(a, r[3], 0), p1 = iso(a, r[3], H); o.moveTo(p0[0], p0[1]); o.lineTo(p1[0], p1[1]); }
      for (let a = r[1]; a <= r[3] + 0.01; a += (r[3] - r[1]) / 3) { const p0 = iso(r[2], a, 0), p1 = iso(r[2], a, H); o.moveTo(p0[0], p0[1]); o.lineTo(p1[0], p1[1]); }
      o.stroke();
    });
  }
  if (has(S, 'turf')) { const F2 = FIXED_SITES.field; add(F2[2] + F2[1], () => { for (let k = 0; k < 3; k++) box(P, F2[0] + 0.6, F2[1] - 0.05 - k * 0.12, F2[2] - 0.6, F2[1] + 0.07 - k * 0.12, 0, 2 + k * 2.2, '#c9ced4'); });
    for (const q of [[F2[0] + 0.2, F2[1]], [F2[2] - 0.2, F2[1]], [F2[0] + 0.2, F2[3]], [F2[2] - 0.2, F2[3]]]) add(q[0] + q[1] + 0.1, () => { flagpole(P, q[0], q[1], 0, 24); const p = iso(q[0], q[1], 24); o.fillStyle = night ? '#fff3c4' : '#e9edf0'; o.fillRect(p[0] - 3, p[1] - 2, 6, 2.5); }); }
  /* campus trees, gate, flagpole */
  for (let a = C.i0 + 0.5; a < C.i1; a += 1.25) { const r = hash(S.seed, Math.round(a * 10), 3); add(a + C.j0 + 0.25, () => tree(P, a, C.j0 + 0.22, 1 + r * 0.3, 'leaf')); if (Math.abs(a - 22.5) > 1) add(a + C.j1 - 0.2, () => tree(P, a, C.j1 - 0.2, 0.95 + r * 0.3, 'leaf')); }
  for (let b = C.j0 + 1.4; b < C.j1 - 0.6; b += 1.3) { const r = hash(S.seed, Math.round(b * 10), 4); add(C.i0 + b + 0.2, () => tree(P, C.i0 + 0.2, b, 1 + r * 0.3, r > 0.7 ? 'conifer' : 'leaf')); add(C.i1 + b - 0.2, () => tree(P, C.i1 - 0.2, b, 1 + r * 0.3, 'leaf')); }
  for (const q of [[21.2, 24.3], [23.9, 24.4], [21.1, 26.0], [23.9, 26.0]]) add(q[0] + q[1], () => tree(P, q[0], q[1], 1.15, 'leaf'));
  add(22.5 + 24.2 + 0.1, () => flagpole(P, 22.5, 24.2, 0, 30));
  add(C.j1 + 23.5, () => { box(P, 21.75, C.j1 - 0.2, 21.95, C.j1, 0, 9, '#cfc6b3'); box(P, 23.05, C.j1 - 0.2, 23.25, C.j1, 0, 9, '#cfc6b3'); box(P, 21.75, C.j1 - 0.14, 23.25, C.j1 - 0.06, 9, 12, sc[0]); });
  objs.sort((a, b) => a.d - b.d);

  /* shadows on the ground (day), streetlights (night) */
  if (!night) {
    g.fillStyle = 'rgba(30,42,70,0.16)';
    for (const ob of objs) if (ob.sh) { const [i0, j0, i1, j1, h] = ob.sh, sx = h * 0.55, sy = h * 0.2, A = iso(i0, j1, 0), B = iso(i1, j1, 0), Cc = iso(i1, j0, 0); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.lineTo(Cc[0], Cc[1]); g.lineTo(Cc[0] + sx, Cc[1] + sy); g.lineTo(B[0] + sx, B[1] + sy); g.lineTo(A[0] + sx, A[1] + sy); g.closePath(); g.fill(); }
  } else {
    g.globalCompositeOperation = 'lighter';
    for (let j = 0; j <= 40; j += 4) for (let i = 0; i <= 40; i += 4) { const t = L.type[Math.min(j, G - 1) * G + Math.min(i, G - 1)]; if (t !== T_ROAD && t !== T_BRIDGE) continue; const p = iso(i + 0.5, j + 0.5, 0), gr = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], 30); gr.addColorStop(0, 'rgba(255,205,130,0.34)'); gr.addColorStop(1, 'rgba(255,205,130,0)'); g.fillStyle = gr; g.fillRect(p[0] - 30, p[1] - 30, 60, 60); }
    const p = iso(22.5, 26.5, 0), gr = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], 150); gr.addColorStop(0, 'rgba(255,220,160,0.22)'); gr.addColorStop(1, 'rgba(255,220,160,0)'); g.fillStyle = gr; g.fillRect(p[0] - 150, p[1] - 150, 300, 300);
    g.globalCompositeOperation = 'source-over';
  }
  for (const ob of objs) ob.fn();
  if (night) {
    /* bloom: a blurred, contrast-boosted copy of the lit windows added back on top */
    const sm = document.createElement('canvas'); sm.width = Math.round(oc.width / 7); sm.height = Math.round(oc.height / 7);
    const sx = sm.getContext('2d'); sx.drawImage(oc, 0, 0, sm.width, sm.height); sx.globalCompositeOperation = 'multiply'; sx.drawImage(sm, 0, 0); sx.drawImage(sm, 0, 0);
    o.save(); o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'lighter'; o.globalAlpha = 0.85; o.imageSmoothingQuality = 'high'; o.drawImage(sm, 0, 0, oc.width, oc.height); o.restore();
  }
  this.flags = P.flags; this.chimneys = P.chimneys.slice(0, 40); this.stack = P.stack;
  if (this.layers) { this.prev = this.layers; this.fade = 0; }
  this.layers = { g: gc, o: oc };
  if (location.search.indexOf('perf') >= 0) console.log('PERF rebuild ms', Math.round(performance.now() - t0), 'night', night);
};

/* ---------- overlay ---------- */
const OVERLAYS = {
  income: { name: 'Household income', val: (S, nb) => nb.inc / S.costIdx, lo: 50, hi: 250, c0: '#f4e9c8', c1: '#1f6b78', legend: ['Lower income', 'Higher'], fmt: (v, S) => '$' + Math.round(v * S.costIdx) + 'k' },
  kids: { name: 'School-age children', val: (S, nb) => nb.kids, lo: 80, hi: 400, c0: '#f6e3d2', c1: '#b5441f', legend: ['Fewer children', 'More'], fmt: (v) => Math.round(v) + ' per grade' },
  reach: { name: 'Your reach', val: (S, nb) => nb.aware * 100, lo: 25, hi: 90, c0: '#f4f6fa', c1: null, legend: ['Few know you', 'Most do \u00b7 1 dot = 2 students'], fmt: (v, S, nb) => Math.round(S.nbE[nb.id]) + ' students · ' + Math.round(v) + '% know you' },
};
MapView.prototype.buildOverlay = function () {
  const S = this.S, O = OVERLAYS[this.overlay], L = cityLayout(S.seed), G = CITY_G;
  const c = document.createElement('canvas'); c.width = M_W; c.height = M_H; const x = c.getContext('2d');
  x.setTransform(HW, HH, -HW, HH, M_OX, M_OY);
  const cols = S.city.nbs.map((nb) => mixHex(O.c0, O.c1 || S.colors[0], clamp((O.val(S, nb) - O.lo) / (O.hi - O.lo), 0, 1)));
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { const n = L.nb[j * G + i]; if (n < 0) continue; x.fillStyle = cols[n]; x.fillRect(i, j, 1.03, 1.03); }
  if (this.overlay === 'reach') {
    x.setTransform(1, 0, 0, 1, M_OX, M_OY);
    S.city.nbs.forEach((nb, n) => {
      const dots = Math.round(S.nbE[n] / 2); let made = 0;
      for (let k = 0; k < 4000 && made < dots; k++) { const i = Math.floor(hash(S.seed, k, n * 7 + 1) * G), j = Math.floor(hash(S.seed, k, n * 7 + 2) * G); if (L.nb[j * G + i] !== n || L.type[j * G + i] !== T_LOT) continue; const p = iso(i + hash(S.seed, k, 5), j + hash(S.seed, k, 6), 0); x.fillStyle = '#15233b'; x.beginPath(); x.arc(p[0], p[1], 3.6, 0, 7); x.fill(); x.fillStyle = S.colors[1]; x.beginPath(); x.arc(p[0], p[1], 2.5, 0, 7); x.fill(); made++; }
    });
  }
  this.ovCanvas = c;
};

/* ---------- traffic ---------- */
MapView.prototype.edgeOk = function (a, b) {
  const L = cityLayout(this.S.seed), G = CITY_G, di = Math.sign(b[0] - a[0]), dj = Math.sign(b[1] - a[1]);
  if (b[0] < 0 || b[1] < 0 || b[0] > 40 || b[1] > 40) return false;
  for (let k = 0; k <= 4; k++) { const t = L.type[(a[1] + dj * k) * G + a[0] + di * k]; if (t !== T_ROAD && t !== T_BRIDGE) return false; }
  return true;
};
MapView.prototype.nextNode = function (a, prev) {
  const opts = [[4, 0], [-4, 0], [0, 4], [0, -4]].map((d) => [a[0] + d[0], a[1] + d[1]]).filter((b) => this.edgeOk(a, b));
  const fwd = opts.filter((b) => !prev || b[0] !== prev[0] || b[1] !== prev[1]);
  const list = fwd.length ? fwd : opts; return list.length ? list[Math.floor(Math.random() * list.length)] : null;
};
MapView.prototype.route = function (from, to) {
  const key = (p) => p[0] + ',' + p[1], q = [from], seen = { [key(from)]: null };
  while (q.length) { const a = q.shift(); if (a[0] === to[0] && a[1] === to[1]) break; for (const d of [[4, 0], [-4, 0], [0, 4], [0, -4]]) { const b = [a[0] + d[0], a[1] + d[1]]; if (key(b) in seen || !this.edgeOk(a, b)) continue; seen[key(b)] = a; q.push(b); } }
  if (!(key(to) in seen)) return null; const out = []; let c = to; while (c) { out.unshift(c); c = seen[key(c)]; } return out;
};
MapView.prototype.syncCars = function () {
  const S = this.S, want = this.vw < 640 ? 26 : 46;
  this.cars = this.cars.filter((c) => !c.bus || S.bus.includes(c.bus - 1));
  let n = this.cars.filter((c) => !c.bus).length, guard = 0;
  while (n < want && guard++ < 400) { const a = [Math.floor(Math.random() * 11) * 4, Math.floor(Math.random() * 11) * 4], b = this.nextNode(a, null); if (!b) continue; this.cars.push({ a, b, t: Math.random(), v: 0.25 + Math.random() * 0.2, col: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)] }); n++; }
  for (const nbId of S.bus) {
    if (this.cars.some((c) => c.bus === nbId + 1)) continue;
    const nb = S.city.nbs[nbId], from = [clamp(Math.round(nb.ci / 4) * 4, 0, 40), clamp(Math.round(nb.cj / 4) * 4, 0, 40)], path = this.route(from, [24, 32]);
    if (path && path.length > 1) for (let k = 0; k < 2; k++) this.cars.push({ bus: nbId + 1, path, k: k ? Math.floor(path.length / 2) : 0, dir: 1, a: path[0], b: path[1], t: 0, v: 0.3, col: '#f2b632', init: k });
  }
};
MapView.prototype.stepCars = function (dt) {
  for (const c of this.cars) {
    if (c.init) { c.k = Math.min(c.path.length - 2, c.k); c.a = c.path[c.k]; c.b = c.path[c.k + 1]; c.init = 0; }
    c.t += dt * c.v;
    if (c.t >= 1) {
      c.t -= 1;
      if (c.bus) { c.k += c.dir; if (c.k >= c.path.length - 1 || c.k < 0) { c.dir *= -1; c.k = clamp(c.k, 0, c.path.length - 1); c.k += c.dir < 0 ? 0 : 0; } const from = c.path[c.k], to = c.path[clamp(c.k + c.dir, 0, c.path.length - 1)]; c.a = from; c.b = to; if (from === to) { c.dir *= -1; c.b = c.path[clamp(c.k + c.dir, 0, c.path.length - 1)]; } }
      else { const nx = this.nextNode(c.b, c.a); if (!nx) { const t = c.a; c.a = c.b; c.b = t; } else { c.a = c.b; c.b = nx; } }
    }
  }
};
MapView.prototype.drawCars = function (P) {
  const c = P.ctx;
  for (const v of this.cars) {
    const di = Math.sign(v.b[0] - v.a[0]), dj = Math.sign(v.b[1] - v.a[1]);
    const pi = lerp(v.a[0], v.b[0], v.t) + 0.5 - dj * 0.17, pj = lerp(v.a[1], v.b[1], v.t) + 0.5 + di * 0.17, len = v.bus ? 0.27 : 0.17, wid = 0.085, h = v.bus ? 5.5 : 3.6;
    if (di) box(P, pi - len, pj - wid, pi + len, pj + wid, 0.5, h, v.col, v.bus ? '#f7c948' : mixHex(v.col, '#ffffff', 0.25));
    else box(P, pi - wid, pj - len, pi + wid, pj + len, 0.5, h, v.col, v.bus ? '#f7c948' : mixHex(v.col, '#ffffff', 0.25));
    if (P.night) { const p = iso(pi + di * len, pj + dj * len, 2); c.fillStyle = 'rgba(255,236,170,0.9)'; c.beginPath(); c.arc(p[0], p[1], 1.6, 0, 7); c.fill(); }
  }
};

/* ---------- the frame ---------- */
MapView.prototype.burst = function (kind) {
  const base = iso(CAMPUS.ci, CAMPUS.cj - 2, 0), cols = [this.S.colors[0], this.S.colors[1], '#ffffff', '#ff6b6b', '#ffd166'];
  if (kind === 'graduation' || kind === 'ribbon') for (let b = 0; b < (kind === 'graduation' ? 7 : 4); b++) { const cx = base[0] + (Math.random() - 0.5) * 180, cy = base[1] - 90 - Math.random() * 70, delay = b * 0.45, col = cols[b % cols.length]; for (let k = 0; k < 34; k++) { const a = Math.random() * 6.283, sp = 20 + Math.random() * 46; this.bursts.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: -delay, max: 1.5, col, g: 26, r: 1.5 }); } }
  else for (let k = 0; k < 26; k++) this.bursts.push({ x: base[0] + (Math.random() - 0.5) * 150, y: base[1] + 20 + Math.random() * 40, vx: (Math.random() - 0.5) * 6, vy: -16 - Math.random() * 14, life: -Math.random() * 1.5, max: 5, col: cols[k % cols.length], g: 0, r: 3.4, balloon: true });
};
MapView.prototype.draw = function (dt, running) {
  const S = this.S, ctx = this.ctx; if (!S || !this.vw) return;
  this.t += dt;
  const key = this.stateKey(); if (key !== this.key) { this.key = key; this.rebuild(); this.ovKey = ''; }
  if (this.overlay !== 'none') { const ok = this.overlay + this.key + Math.floor(S.week / 4); if (ok !== this.ovKey) { this.ovKey = ok; this.buildOverlay(); } }
  if (this.fade < 1) this.fade = Math.min(1, this.fade + dt / 1.1);
  const z = this.cam.z, d = this.dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.cv.width, this.cv.height);
  {
    /* sky, sun or moon, and a few clouds behind the model */
    const W = this.cv.width, H = this.cv.height, SK = this.night ? ['#040814', '#0e1a3c', '#1d2b54'] : SKY[season(S)], sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, SK[0]); sky.addColorStop(0.55, SK[1]); sky.addColorStop(1, SK[2]); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    const sx = W * 0.1, sy = H * 0.13, sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.min(W, H) * 0.55);
    if (this.night) { sg.addColorStop(0, 'rgba(200,215,255,.4)'); sg.addColorStop(0.07, 'rgba(160,185,255,.16)'); sg.addColorStop(1, 'rgba(160,185,255,0)'); } else { sg.addColorStop(0, 'rgba(255,251,230,.95)'); sg.addColorStop(0.1, 'rgba(255,244,200,.4)'); sg.addColorStop(1, 'rgba(255,244,200,0)'); }
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    if (this.night) {
      for (let k = 0; k < 90; k++) { ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(this.t * 0.6 + k * 1.3)); ctx.fillStyle = '#ffffff'; const q = hash(k, 3, 9) > 0.85 ? 2 : 1.2; ctx.fillRect(hash(k, 1, 9) * W, hash(k, 2, 9) * H * 0.7, q * d, q * d); }
      ctx.globalAlpha = 1; ctx.fillStyle = '#eef2ff'; ctx.beginPath(); ctx.arc(sx, sy, 15 * d, 0, 7); ctx.fill(); ctx.fillStyle = SK[0]; ctx.beginPath(); ctx.arc(sx + 6 * d, sy - 4 * d, 13 * d, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      for (let k = 0; k < 5; k++) { const cx = ((this.t * 5 * d + k * W * 0.27) % (W * 1.3)) - W * 0.15, cy = H * (0.05 + 0.055 * ((k * 2) % 5)), sc2 = d * (0.8 + (k % 3) * 0.25); ctx.beginPath(); ctx.arc(cx, cy, 16 * sc2, 0, 7); ctx.arc(cx + 18 * sc2, cy - 6 * sc2, 20 * sc2, 0, 7); ctx.arc(cx + 40 * sc2, cy, 15 * sc2, 0, 7); ctx.arc(cx + 20 * sc2, cy + 5 * sc2, 19 * sc2, 0, 7); ctx.fill(); }
    }
  }
  ctx.setTransform(d * z, 0, 0, d * z, d * (this.vw / 2 - this.cam.x * z), d * (this.vh / 2 - this.cam.y * z));
  /* table shadow */
  const bc = iso(CITY_G / 2, CITY_G / 2, -52), sg = ctx.createRadialGradient(bc[0], bc[1] + 40, 60, bc[0], bc[1] + 40, CITY_G * HW * 1.05);
  sg.addColorStop(0, this.night ? 'rgba(0,0,0,0.45)' : 'rgba(30,45,80,0.22)'); sg.addColorStop(1, 'rgba(30,45,80,0)');
  ctx.save(); ctx.translate(bc[0], bc[1] + 40); ctx.scale(1, 0.5); ctx.translate(-bc[0], -(bc[1] + 40)); ctx.fillStyle = sg; ctx.fillRect(bc[0] - 1200, bc[1] - 1200, 2400, 2400); ctx.restore();
  const blit = (L, layer, a) => { ctx.globalAlpha = a; ctx.drawImage(L[layer], -M_OX, -M_OY, M_W, M_H); ctx.globalAlpha = 1; };
  const P = { ctx, night: this.night, pal: SEASON_PAL[season(S)], seed: S.seed, S, flat: true };
  if (this.fade < 1 && this.prev) blit(this.prev, 'g', 1);
  blit(this.layers, 'g', this.fade < 1 && this.prev ? this.fade : 1);
  /* river life */
  if (season(S) !== 'winter') for (let k = 0; k < 3; k++) { const bi = ((this.t * 0.35 + k * 14) % 41), bj = riverC(S.seed, bi) - 0.1 + (k - 1) * 0.35, p = iso(bi, bj, 0); ctx.fillStyle = tone('#7a5a46', 1, this.night); ctx.fillRect(p[0] - 4, p[1] - 1, 8, 2.2); poly(ctx, [[p[0] - 0.5, p[1] - 1], [p[0] - 0.5, p[1] - 11], [p[0] + 5, p[1] - 2]], tone('#fbfbf7', 1, this.night)); }
  ctx.strokeStyle = this.night ? 'rgba(160,190,230,0.25)' : 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let k = 0; k < 16; k++) { const ri = (k * 2.6 + this.t * 0.25) % 41, p = iso(ri, riverC(S.seed, ri) + Math.sin(k * 1.7) * 0.8, 0); ctx.moveTo(p[0] - 5, p[1]); ctx.lineTo(p[0] + 5, p[1] + 2.5); }
  ctx.stroke();
  /* traffic sits between the ground and the buildings, so buildings in front hide it */
  if (!this.cars.length || Math.random() < 0.01) this.syncCars();
  this.stepCars(dt); this.drawCars(P);
  if (running && season(S) !== 'winter' && Math.floor(wk(S) / 4) >= 2) { const F = FIXED_SITES.field; for (let k = 0; k < 9; k++) { const a = this.t * (0.6 + k * 0.07) + k * 2, p = iso(F[0] + 1 + (Math.sin(a) * 0.5 + 0.5) * (F[2] - F[0] - 2), F[1] + 0.5 + (Math.cos(a * 1.3 + k) * 0.5 + 0.5) * (F[3] - F[1] - 1), 0); ctx.fillStyle = k % 2 ? S.colors[0] : (this.night ? '#cfd6e6' : '#ffffff'); ctx.fillRect(p[0] - 0.8, p[1] - 3, 1.6, 3); } }
  { /* students on the walks during the school year */
    const mo = Math.floor(wk(S) / 4);
    if (mo >= 2 && mo <= 10) for (let k = 0; k < 14; k++) {
      const u = (this.t * (0.012 + (k % 5) * 0.003) + k * 0.173) % 1, back = k % 2 ? 1 - u : u, off = (k % 3 - 1) * 0.09;
      const q = k % 4 === 0 ? iso(17.7 + back * 9.7, 26.6 + off, 0) : iso(22.5 + off, 23.5 + back * 8.3, 0);
      ctx.fillStyle = [S.colors[0], S.colors[1], this.night ? '#b9c3d9' : '#3a4356', '#c9543f'][k % 4]; ctx.fillRect(q[0] - 0.9, q[1] - 3.4, 1.8, 3.4);
      ctx.fillStyle = this.night ? '#c9b8a8' : '#f0d3b8'; ctx.beginPath(); ctx.arc(q[0], q[1] - 4.3, 1.1, 0, 7); ctx.fill();
    }
  }
  if (this.fade < 1 && this.prev) blit(this.prev, 'o', 1 - this.fade);
  blit(this.layers, 'o', this.fade < 1 && this.prev ? this.fade : 1);
  if (this.fade >= 1) this.prev = null;
  if (season(S) !== 'winter') { /* fountain on the quad */
    const f = iso(22.5, 25.2, 0); ctx.fillStyle = this.night ? 'rgba(200,220,255,.75)' : 'rgba(255,255,255,.9)';
    for (let k = 0; k < 9; k++) { const u = (this.t * 0.9 + k / 9) % 1, a = k * 2.4; ctx.beginPath(); ctx.arc(f[0] + Math.cos(a) * u * 4.5, f[1] - Math.sin(u * Math.PI) * 9 + Math.sin(a) * u * 1.6, 0.9, 0, 7); ctx.fill(); }
  }
  if (!this.night && season(S) !== 'winter') { /* glints on the river */
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.8;
    for (let k = 0; k < 14; k++) { const a = Math.sin(this.t * 1.8 + k * 1.7); if (a < 0.3) continue; const gi = hash(S.seed, k, 71) * 40, q = iso(gi, riverC(S.seed, gi - 0.5) + (hash(S.seed, k, 72) - 0.5) * 2, 0), z = a * 3; ctx.globalAlpha = a; ctx.beginPath(); ctx.moveTo(q[0] - z, q[1]); ctx.lineTo(q[0] + z, q[1]); ctx.moveTo(q[0], q[1] - z * 0.7); ctx.lineTo(q[0], q[1] + z * 0.7); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  if (!this.night) { /* a hot-air balloon in school colors drifts over town */
    const u = (this.t / 150 + 0.25) % 1, bx = -1000 + u * 2000, by = 300 + Math.sin(u * 9) * 60, bob = Math.sin(this.t * 0.8) * 2, hy = by - 150 + bob;
    ctx.fillStyle = 'rgba(25,40,70,.13)'; ctx.beginPath(); ctx.ellipse(bx + 20, by + 10, 15, 6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = S.colors[0]; ctx.beginPath(); ctx.ellipse(bx, hy, 13, 15.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = S.colors[1]; ctx.beginPath(); ctx.ellipse(bx, hy, 7.5, 15.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = S.colors[0]; ctx.beginPath(); ctx.ellipse(bx, hy, 2.6, 15.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.beginPath(); ctx.ellipse(bx - 5, hy - 5, 4, 7, 0.4, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(60,45,30,.8)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(bx - 6, hy + 13.5); ctx.lineTo(bx - 2.5, hy + 21); ctx.moveTo(bx + 6, hy + 13.5); ctx.lineTo(bx + 2.5, hy + 21); ctx.stroke();
    ctx.fillStyle = '#7a5a3c'; ctx.fillRect(bx - 3, hy + 21, 6, 4.5);
  }
  if (this.overlay !== 'none' && this.ovCanvas) { ctx.globalAlpha = this.overlay === 'reach' ? 0.7 : 0.62; ctx.drawImage(this.ovCanvas, -M_OX, -M_OY); ctx.globalAlpha = 1; }
  /* flags */
  const flag = (p, col, col2, h, w) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(p[0], p[1]); for (let s = 0; s <= 6; s++) ctx.lineTo(p[0] + s * w / 6, p[1] + Math.sin(this.t * 4 + s * 0.9) * 1.3 * s / 6); for (let s = 6; s >= 0; s--) ctx.lineTo(p[0] + s * w / 6, p[1] + h + Math.sin(this.t * 4 + s * 0.9) * 1.3 * s / 6); ctx.closePath(); ctx.fill(); if (col2) { ctx.fillStyle = col2; ctx.fillRect(p[0] + 1, p[1] + h * 0.38, w * 0.55, h * 0.24); } };
  const mh = FIXED_SITES.main, top = iso((mh[0] + mh[2]) / 2, (mh[1] + mh[3]) / 2, 61); ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.lineTo(top[0], top[1] - 13); ctx.stroke(); flag([top[0], top[1] - 13], S.colors[0], S.colors[1], 6.5, 12);
  flag(iso(22.5, 24.2, 30), S.colors[0], S.colors[1], 7, 13);
  for (const f of this.flags || []) flag(f.p, f.col, null, 5, f.h);
  /* cranes, smoke */
  for (const cr of this.cranes || []) { const a = Math.sin(this.t * 0.4) * 0.9, bx = cr.p[0], by = cr.p[1], ty = by - cr.h; ctx.strokeStyle = tone('#e2a53a', 1, this.night); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, ty); ctx.moveTo(bx - Math.cos(a) * 12, ty - Math.sin(a) * 3 + 1); ctx.lineTo(bx + Math.cos(a) * 34, ty + Math.sin(a) * 9); ctx.stroke(); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(bx + Math.cos(a) * 26, ty + Math.sin(a) * 7); ctx.lineTo(bx + Math.cos(a) * 26, ty + Math.sin(a) * 7 + 14 + Math.sin(this.t) * 3); ctx.stroke(); }
  const puff = (p, k, n) => { for (let q = 0; q < n; q++) { const u = ((this.t * 0.25 + q / n + k * 0.37) % 1); ctx.fillStyle = this.night ? 'rgba(170,180,205,' + (0.22 * (1 - u)) + ')' : 'rgba(255,255,255,' + (0.55 * (1 - u)) + ')'; ctx.beginPath(); ctx.arc(p[0] + u * 9 + Math.sin(u * 5 + k) * 2, p[1] - u * 22, 1.6 + u * 4, 0, 7); ctx.fill(); } };
  if (this.stack) puff(this.stack, 0, 5);
  if (season(S) === 'winter') (this.chimneys || []).forEach((p, k) => puff(p, k, 2));
  /* cloud shadows */
  if (!this.night) for (let k = 0; k < 4; k++) { const cx = ((this.t * 9 + k * 520) % 2600) - 1300, cy = 180 + k * 190; ctx.fillStyle = 'rgba(40,60,100,0.055)'; ctx.beginPath(); ctx.ellipse(cx, cy, 190, 62, 0, 0, 7); ctx.ellipse(cx + 120, cy + 30, 130, 48, 0, 0, 7); ctx.fill(); }
  /* celebrations */
  this.bursts = this.bursts.filter((b) => b.life < b.max);
  for (const b of this.bursts) { b.life += dt; if (b.life < 0) continue; b.x += b.vx * dt; b.y += b.vy * dt; b.vy += b.g * dt; if (!b.balloon) { b.vx *= 0.985; b.vy *= 0.985; } ctx.globalAlpha = clamp(1 - b.life / b.max, 0, 1); ctx.fillStyle = b.col; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); if (b.balloon) { ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(b.x, b.y + b.r); ctx.lineTo(b.x, b.y + b.r + 7); ctx.stroke(); } }
  ctx.globalAlpha = 1;
  /* hover outline */
  const hl = this.hover && this.hover.type === 'nb' ? this.hover.id : this.selected;
  if (hl != null) { const L = cityLayout(S.seed), G = CITY_G, n = hl; ctx.save(); ctx.transform(HW, HH, -HW, HH, 0, 0); ctx.fillStyle = 'rgba(255,190,60,0.26)'; for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) if (L.nb[j * G + i] === n) ctx.fillRect(i, j, 1.02, 1.02); ctx.restore(); }

  /* screen-space: weather and labels */
  ctx.setTransform(d, 0, 0, d, 0, 0);
  { /* distance haze at the far edge, and a soft vignette */
    const hc = hexRgb(this.night ? '#0e1a3c' : SKY[season(S)][1]), hz = ctx.createLinearGradient(0, 0, 0, this.vh * 0.5);
    hz.addColorStop(0, 'rgba(' + hc.join(',') + ',.5)'); hz.addColorStop(1, 'rgba(' + hc.join(',') + ',0)'); ctx.fillStyle = hz; ctx.fillRect(0, 0, this.vw, this.vh * 0.5);
    const vg = ctx.createRadialGradient(this.vw / 2, this.vh * 0.55, Math.min(this.vw, this.vh) * 0.45, this.vw / 2, this.vh * 0.55, Math.max(this.vw, this.vh) * 0.85);
    vg.addColorStop(0, 'rgba(10,18,40,0)'); vg.addColorStop(1, this.night ? 'rgba(0,0,0,.55)' : 'rgba(15,30,65,.26)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, this.vw, this.vh);
  }
  const se = season(S), wantP = se === 'winter' ? 90 : se === 'fall' ? 26 : se === 'spring' ? 18 : 0;
  while (this.particles.length < wantP) this.particles.push({ x: Math.random() * this.vw, y: Math.random() * this.vh, s: 0.6 + Math.random(), ph: Math.random() * 6 });
  if (this.particles.length > wantP) this.particles.length = wantP;
  for (const p of this.particles) {
    p.y += dt * (se === 'winter' ? 26 : 16) * p.s; p.x += dt * (Math.sin(this.t * 1.3 + p.ph) * 14 + 5); if (p.y > this.vh + 4) { p.y = -4; p.x = Math.random() * this.vw; } if (p.x > this.vw + 4) p.x = -4;
    if (se === 'winter') { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(p.x, p.y, 1.1 * p.s, 0, 7); ctx.fill(); }
    else { ctx.fillStyle = se === 'fall' ? ['#d98a2b', '#c9542b', '#e2b53a'][Math.floor(p.ph) % 3] : '#f6c4d2'; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(this.t * 2 + p.ph); ctx.fillRect(-2, -1, 4, 2); ctx.restore(); }
  }
  const label = (text, wx, wy, o) => {
    const [sx, sy] = this.toScreen(wx, wy); if (sx < -80 || sy < -20 || sx > this.vw + 80 || sy > this.vh + 20) return;
    ctx.font = (o.weight || 600) + ' ' + o.size + 'px ' + (o.font || '"Barlow Condensed", "Arial Narrow", sans-serif'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + o.size * 1.1, h = o.size * 1.75;
    ctx.fillStyle = o.bg; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(sx - w / 2, sy - h / 2, w, h, o.r == null ? h / 2 : o.r); else ctx.rect(sx - w / 2, sy - h / 2, w, h); ctx.fill();
    ctx.fillStyle = o.fg; ctx.fillText(text, sx, sy + 0.5);
  };
  const small = this.vw < 640, dim = 'rgba(18,21,27,0.84)', ink = '#f2f4f8';
  S.city.nbs.forEach((nb, n) => {
    const p = iso(nb.ci, nb.cj, 0), hov = hl === n, O = OVERLAYS[this.overlay];
    let text = nb.name.toUpperCase(); if (O) text += '  ' + O.fmt(O.val(S, nb), S, nb);
    if (S.focus.includes(n)) text = '◉ ' + text; if (S.bus.includes(n)) text += '  • BUS'; text += ' \u203A';
    label(text, p[0], p[1] - (nb.type === 'downtown' ? 70 : 22), { size: small ? 11 : 12.5, bg: hov ? '#ffb22e' : dim, fg: hov ? '#241600' : ink, weight: 700, r: 3 });
  });
  if (!small || this.cam.z > this.fit * 1.6) this.rivalSites().forEach((s) => { const r = S.city.rivals[s.k]; if (!r.open) return; const p = iso(s.i0 + 1, s.j0 + 1, 0); label(r.name, p[0], p[1] - 46, { size: 11, bg: 'rgba(255,255,255,0.88)', fg: '#1a2132', weight: 600, font: '"Barlow", system-ui, sans-serif', r: 3 }); });
  const mp = iso(22.5, 32.6, 0); label(S.name.toUpperCase() + ' \u203A', mp[0], mp[1] + 6, { size: small ? 11.5 : 13.5, bg: S.colors[0], fg: '#ffffff', weight: 400, font: '"Graduate", Rockwell, Georgia, serif', r: 3 });
};
