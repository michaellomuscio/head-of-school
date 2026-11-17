/* Core helpers: seeded randomness that lives on the game state, math, and number formatting. No DOM. */
const WPY = 48; // weeks per school year (4 per month, July to June)
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const sig = (x) => 1 / (1 + Math.exp(-x));
const sum = (a) => { let s = 0; for (const x of a) s += x; return s; };

/* Stateless hash for anything visual (same seed, same city). Returns 0..1. */
function hash(a, b, c) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul((c | 0) + 101, 2147483629);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/* Game randomness: the generator state is S.rs, so a saved game replays the same way. */
function rnd(S) {
  let t = (S.rs = (S.rs + 0x6D2B79F5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rr = (S, a, b) => a + (b - a) * rnd(S);
const ri = (S, a, b) => Math.floor(rr(S, a, b + 1));
function rn(S, mu, sd) {
  const u = Math.max(1e-9, rnd(S)), v = rnd(S);
  return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307 * v);
}
const pick = (S, arr) => arr[Math.floor(rnd(S) * arr.length)];
function binom(S, n, p) {
  n = Math.round(n);
  if (n <= 0) return 0;
  p = clamp(p, 0, 1);
  if (n > 60) return clamp(Math.round(rn(S, n * p, Math.sqrt(n * p * (1 - p)))), 0, n);
  let k = 0;
  for (let i = 0; i < n; i++) if (rnd(S) < p) k++;
  return k;
}

function money(x, signed) {
  const neg = x < 0, a = Math.abs(x);
  let s;
  if (a >= 1e6) s = '$' + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2) + 'M';
  else if (a >= 1e3) s = '$' + Math.round(a / 1e3) + 'k';
  else s = '$' + Math.round(a);
  return (neg ? '−' : signed ? '+' : '') + s;
}
const pct = (x, d) => (x * 100).toFixed(d || 0) + '%';
const num = (x) => Math.round(x).toLocaleString('en-US');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
