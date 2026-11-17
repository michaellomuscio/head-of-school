/* The city: a 41x41 tile grid with a river, a street grid, nine neighborhoods and the campus. Pure data, no drawing. */
const CITY_G = 41;
const T_LOT = 0, T_ROAD = 1, T_WATER = 2, T_BRIDGE = 3, T_CAMPUS = 5;

function riverC(seed, i) {
  const p = hash(seed, 1, 7) * 6.283, q = hash(seed, 2, 7) * 6.283;
  return 9.6 + 2.0 * Math.sin(i / 5 + p) + 0.7 * Math.sin(i / 2.3 + q);
}
const inCampus = (i, j) => i >= CAMPUS.i0 && i < CAMPUS.i1 && j >= CAMPUS.j0 && j < CAMPUS.j1;

const _layouts = {};
function cityLayout(seed) {
  if (_layouts[seed]) return _layouts[seed];
  const G = CITY_G, type = new Uint8Array(G * G), nb = new Int8Array(G * G);
  const cent = NB_TYPES.map((t, k) => ({ i: t.c[0] + (hash(seed, k, 11) - 0.5) * 2.4, j: t.c[1] + (hash(seed, k, 12) - 0.5) * (t.north ? 1 : 2.4) }));
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const k = j * G + i, rc = riverC(seed, i);
    let t = T_LOT;
    if (inCampus(i, j)) t = T_CAMPUS;
    else if (Math.abs(j + 0.5 - rc) < 1.45) t = i % 4 === 0 ? T_BRIDGE : T_WATER;
    else if (i % 4 === 0 || j % 4 === 0) t = T_ROAD;
    type[k] = t;
    if (t === T_CAMPUS) { nb[k] = -2; continue; }
    if (t === T_WATER) { nb[k] = -1; continue; }
    const north = j + 0.5 < rc;
    let best = -1, bd = 1e9;
    for (let n = 0; n < NB_TYPES.length; n++) {
      if (!!NB_TYPES[n].north !== north) continue;
      const d = Math.hypot(i - cent[n].i, j - cent[n].j) / NB_TYPES[n].w;
      if (d < bd) { bd = d; best = n; }
    }
    nb[k] = best;
  }
  /* Centroids of the land each neighborhood actually got. */
  const acc = NB_TYPES.map(() => [0, 0, 0]);
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const n = nb[j * G + i];
    if (n >= 0 && type[j * G + i] === T_LOT) { acc[n][0] += i + 0.5; acc[n][1] += j + 0.5; acc[n][2]++; }
  }
  const centroid = acc.map((a, n) => (a[2] ? { i: a[0] / a[2], j: a[1] / a[2], tiles: a[2] } : { i: cent[n].i, j: cent[n].j, tiles: 1 }));
  return (_layouts[seed] = { G, type, nb, centroid, seed });
}

/* Rolls the living part of the city that the sim tracks and saves. */
function makeCity(S) {
  const L = cityLayout(S.seed);
  const nbs = NB_TYPES.map((t, n) => {
    const c = L.centroid[n];
    const dist = Math.hypot(c.i - CAMPUS.ci, c.j - CAMPUS.cj) + (t.north ? 3 : 0);
    return {
      id: n, type: t.type, name: t.names[Math.floor(hash(S.seed, n, 21) * t.names.length)],
      kids: Math.round(rr(S, t.kids[0], t.kids[1])), inc: Math.round(rr(S, t.inc[0], t.inc[1])),
      growth: t.growth, incTrend: t.incTrend || 0, pq: Math.round(rr(S, t.pq[0], t.pq[1])), pq0: 0,
      density: t.density, dist, tech: !!t.tech, north: !!t.north, ci: c.i, cj: c.j, aware: 0.5,
    };
  });
  nbs.forEach((n) => (n.pq0 = n.pq));
  const rivals = RIVAL_DEFS.map((r, k) => {
    const home = nbs.find((n) => n.type === r.home);
    return {
      id: r.id, name: r.names[Math.floor(hash(S.seed, k, 31) * r.names.length)], nb: home.id, ci: home.ci, cj: home.cj, north: home.north,
      tuition: 24000 * r.price, rep: r.rep + rr(S, -2, 2), rep0: r.rep, bias: r.bias, k8: !!r.k8, open: true, blurb: r.blurb,
    };
  });
  return { name: CITY_NAMES[Math.floor(hash(S.seed, 5, 41) * CITY_NAMES.length)], nbs, rivals, econ: 0.15, mktTuition: 24000, charter: false };
}
