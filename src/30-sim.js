/* The simulation. One call to tick(S) advances one week. Everything here is plain data in, plain data out (no DOM),
   so the same code runs in the browser and in the headless balance tests. */
const K = { you: 2.25, rep: 0.47, beta: 0.55, dist: 0.045, pub: -1.35, apps: 1.6, aidApps: 2.6, yield: 0.42 };

const yr = (S) => Math.floor(S.week / WPY);
const wk = (S) => S.week % WPY;
function yearLabel(S, y) { const a = START_YEAR + (y == null ? yr(S) : y); return a + '–' + String((a + 1) % 100).padStart(2, '0'); }
function dateLabel(S) { const w = wk(S); return MONTHS[Math.floor(w / 4)] + ', week ' + ((w % 4) + 1); }
function season(S) { const m = Math.floor(wk(S) / 4); return m <= 1 || m === 11 ? 'summer' : m <= 4 ? 'fall' : m <= 7 ? 'winter' : 'spring'; }
const mission = (S) => MISSION_BY[S.mission];

function log(S, text, kind, fx) {
  S.log.push({ w: S.week, text, kind: kind || 'info', fx: fx || null });
  if (S.log.length > 90) S.log.splice(0, S.log.length - 90);
}

/* ---------- basic measures ---------- */
function students(S) { let s = 0; for (const g of S.grades) s += g.n; return s; }
function divStudents(S, d) { let s = 0; for (const g of DIV_GRADES[d]) s += S.grades[g].n; return s; }
const has = (S, t) => S.bld.some((b) => b.t === t);
function capacity(S, d) { let c = 0; for (const b of S.bld) { const B = BUILDINGS[b.t]; if (B.cap) c += B.cap[d]; } return c; }
const totalCapacity = (S) => capacity(S, 0) + capacity(S, 1) + capacity(S, 2);
const bValue = (S, b) => (BUILDINGS[b.t].value || BUILDINGS[b.t].cost) * S.costIdx;
function plantValue(S) { let v = 0; for (const b of S.bld) v += bValue(S, b); return v; }
function avgCond(S) { let v = 0, w = 0; for (const b of S.bld) { const x = bValue(S, b); v += b.cond * x; w += x; } return w ? v / w : 60; }
function deferred(S) { let v = 0; for (const b of S.bld) v += Math.max(0, 85 - b.cond) / 100 * bValue(S, b) * 0.45; return v; }
const sk = (S, r) => (S.team[r] ? S.team[r].skill : 0);
const ratio = (S, d) => divStudents(S, d) / Math.max(1, S.fac[d]);
const ratioAll = (S) => students(S) / Math.max(1, sum(S.fac));
const sigCount = (S) => SIGNATURES.filter((t) => has(S, t)).length;
function profileAvg(S) { let a = 0, n = 0; for (const g of S.grades) { a += g.q * g.n; n += g.n; } return n ? a / n : 50; }
function avgTuition(S) { let a = 0, n = 0; for (let g = 0; g < 13; g++) { a += S.grades[g].n * S.tuition[divOf(g)]; n += S.grades[g].n; } return n ? a / n : S.tuition[1]; }
function grossAid(S) { let gross = 0, aid = 0; for (let g = 0; g < 13; g++) { const t = S.tuition[divOf(g)]; gross += S.grades[g].n * t; aid += S.grades[g].aid * t; } return [gross, aid]; }
function discountRate(S) { const [g, a] = grossAid(S); return g ? a / g : 0; }
function aidShare(S) { let a = 0; for (const g of S.grades) a += g.an; const n = students(S); return n ? a / n : 0; }

function modSum(S, k) { let v = 0; for (const m of S.mods) if (m.k === k) v += m.v * Math.min(1, m.w / (m.w0 * 0.5)); return v; }
function addMod(S, k, v, w, label) { S.mods.push({ k, v, w, w0: w, label }); }
function modTerms(S, k, terms) { for (const m of S.mods) if (m.k === k) terms.push({ label: m.label, v: m.v * Math.min(1, m.w / (m.w0 * 0.5)), temp: true }); }
const termSum = (t) => clamp(sum(t.map((x) => x.v)), 0, 100);

/* Strategic plan pillars and the head's own calendar. Both feed the formulas below through these small readers. */
function pSum(S, k) { let v = 0; for (const id of S.plan || []) v += PILLAR_BY[id].fx[k] || 0; return v; }
function pillarTerms(S, k, t) { for (const id of S.plan || []) { const p = PILLAR_BY[id]; if (p.fx[k]) t.push({ label: p.name, v: p.fx[k] }); } }
const timeCurve = (d) => (d >= 2 ? 1.25 * Math.sqrt(d - 2) : d === 1 ? -1.2 : -2.6);
const te = (S, k) => (S.timeE && S.timeE[k]) || 0;
const timeFree = (S) => TIME_DAYS - sum(Object.values(S.time));
function setTime(S, k, delta) { if ((delta > 0 && timeFree(S) < delta) || S.time[k] + delta < 0) return false; S.time[k] += delta; return true; }

/* ---------- the four things everything else follows from ---------- */
const PW = { acad: 3, stem: 1.5, arts: 1.2, ath: 0.8, well: 1.2, coll: 0.8 };
function progScore(S, d) {
  const m = mission(S); let a = 0, b = 0;
  for (const k in PW) { if (k === 'coll' && d !== 2) continue; const w = PW[k] * ((m.pw && m.pw[k]) || 1); a += w * S.prog[k] / 5; b += w; }
  return 100 * a / b;
}
function facScore(S) { let n = 0; for (const t of ['science', 'arts', 'fieldhouse', 'library', 'dining']) if (has(S, t)) n++; return clamp(0.62 * avgCond(S) + 8 * n, 0, 100); }
function eqTerms(S, d) {
  const r = ratio(S, d), rs = clamp(100 - (r - 7) * 14, 0, 100), eff = 0.8 + 0.2 * S.morale / 100;
  const t = [
    { label: 'Faculty quality', v: S.fq * 0.47 * eff },
    { label: 'Class size (' + r.toFixed(1) + ' students per teacher)', v: rs * 0.25 },
    { label: 'Program depth', v: progScore(S, d) * 0.2 },
    { label: 'Facilities', v: facScore(S) * 0.1 },
  ];
  const p = profileAvg(S);
  if (p < 50) t.push({ label: 'Students who need more support', v: -(50 - p) * 0.5 * (1 - S.prog.well / 5) });
  const fill = divStudents(S, d) / Math.max(1, capacity(S, d));
  if (fill > 1) t.push({ label: 'Overcrowding', v: -(fill - 1) * 60 });
  pillarTerms(S, 'eq', t);
  modTerms(S, 'eq', t);
  return t;
}
const EQ = (S, d) => termSum(eqTerms(S, d));
function EQavg(S) { let a = 0, n = 0; for (let d = 0; d < 3; d++) { const s = divStudents(S, d); a += EQ(S, d) * s; n += s; } return n ? a / n : 0; }

function moraleTerms(S) {
  const m = mission(S), r = ratioAll(S), dean = sk(S, 'academic'), p = profileAvg(S);
  const t = [
    { label: 'Baseline', v: 55 },
    { label: 'Pay at ' + Math.round(S.salaryIdx * 100) + '% of market', v: clamp((S.salaryIdx - 1) * 120, -26, 24) },
    { label: 'Workload (' + r.toFixed(1) + ' students per teacher)', v: clamp((9 - r) * 5, -25, 8) },
    { label: 'Professional growth', v: S.pd * 2.5 - 2 },
    { label: 'Last raise vs. cost of living', v: clamp((S.lastRaisePct - S.infl * 100) * 2.5, -10, 6) },
    { label: dean ? 'Dean of Faculty' : 'No Dean of Faculty', v: dean ? dean * 1.5 : -3 },
    { label: 'Campus condition', v: (avgCond(S) - 60) * 0.12 },
  ];
  if (p < 50) t.push({ label: 'Students who need more support', v: -(50 - p) * 0.4 * (1 - S.prog.well / 5) });
  if (has(S, 'housing')) t.push({ label: 'Faculty housing', v: 5 });
  if (m.morale) t.push({ label: 'Mission fit', v: m.morale });
  if (S.prog.aux >= 4) t.push({ label: 'Campus never rests (auxiliary)', v: -2 });
  if (Math.abs(te(S, 'faculty')) > 0.05) t.push({ label: 'Your time in classrooms', v: 2.2 * te(S, 'faculty') });
  pillarTerms(S, 'morale', t);
  modTerms(S, 'morale', t);
  return t;
}
function satTerms(S) {
  const m = mission(S), eq = EQavg(S), rel = avgTuition(S) / S.city.mktTuition, exp = 55 + (rel - 1) * 70, ds = sk(S, 'students');
  const t = [
    { label: 'Baseline', v: 20 },
    { label: 'Teaching quality', v: eq * 0.55 },
    { label: 'Value for the price', v: eq >= exp ? Math.min(8, (eq - exp) * 0.25) : -(exp - eq) * 0.45 },
    { label: 'Class size', v: clamp((9.5 - ratioAll(S)) * 2.5, -12, 4) },
    { label: 'Student life (arts, athletics, wellness)', v: (S.prog.arts + S.prog.ath + S.prog.well) / 15 * 12 },
    { label: 'Campus', v: (avgCond(S) - 60) * 0.15 + (has(S, 'dining') ? 3 : 0) + (has(S, 'turf') ? 1 : 0) },
    { label: 'Tuition increase of ' + S.lastTuitionPct + '%', v: -Math.max(0, S.lastTuitionPct - S.infl * 100 - 1.5) * 2.2 },
    { label: 'College results', v: (S.college - 55) * 0.12 * (m.outcomeSat || 1) * (1 + pSum(S, 'outcome')) },
    { label: ds ? 'Dean of Students' : 'No Dean of Students', v: ds ? ds : -2 },
  ];
  let over = 0; for (let d = 0; d < 3; d++) over = Math.max(over, divStudents(S, d) / Math.max(1, capacity(S, d)) - 1);
  if (over > 0) t.push({ label: 'Overcrowding', v: -over * 80 });
  if (S.builds.length) t.push({ label: 'Construction noise', v: -Math.min(2, S.builds.length) });
  if (Math.abs(te(S, 'families')) > 0.05) t.push({ label: 'Your time with families', v: 1.8 * te(S, 'families') });
  pillarTerms(S, 'sat', t);
  if (pSum(S, 'satNeed') && S.prog.well < 3) t.push({ label: 'Students from abroad need more support', v: pSum(S, 'satNeed') });
  if (S.flags.chair === 'parent') t.push({ label: 'A parent chairs the board', v: 1.5 });
  modTerms(S, 'sat', t);
  return t;
}
function repTerms(S) {
  const m = mission(S), sigP = PROGRAMS.filter((p) => !p.revenue && S.prog[p.id] >= 5).length;
  const t = [
    { label: 'Baseline', v: 8 },
    { label: 'Teaching quality', v: EQavg(S) * 0.5 },
    { label: 'College results', v: (55 + (S.college - 55) * (m.collRep || 1)) * 0.18 },
    { label: 'Word of mouth from families', v: (S.sat - 50) * 0.25 },
    { label: 'Student profile', v: (profileAvg(S) - 50) * 0.2 },
    { label: 'School spirit', v: (S.prog.ath - 2) * 0.8 + (has(S, 'turf') ? 1 : 0) },
  ];
  if (sigCount(S)) t.push({ label: 'Signature buildings', v: 2.5 * sigCount(S) });
  if (sigP) t.push({ label: 'Signature programs', v: Math.min(8, 2 * sigP) });
  if (has(S, 'solar')) t.push({ label: 'Solar and geothermal', v: 1 });
  pillarTerms(S, 'rep', t);
  modTerms(S, 'rep', t);
  return t;
}

/* ---------- money ---------- */
function progCost(S, k, lvl, st, ci) {
  const m = mission(S), eff = 1.04 - 0.02 * sk(S, 'business');
  return Math.pow(lvl, 1.25) * (28000 + 85 * st) * ci * ((m.disc && m.disc[k]) || 1) * eff;
}
function auxNet(S, st, ci) {
  const lvl = S.prog.aux; let v = lvl * (32000 + 90 * st) * ci * (1 + 0.04 * sk(S, 'business'));
  if (lvl >= 1) v += ((has(S, 'arts') ? 40000 : 0) + (has(S, 'fieldhouse') ? 60000 : 0) + (has(S, 'dining') ? 30000 : 0) + (has(S, 'turf') ? 50000 : 0)) * ci;
  if (has(S, 'elc')) v += 150000 * ci;
  return v * (1 + pSum(S, 'aux'));
}
function enrolledWealth(S) {
  let a = 0, n = 0; S.nbE.forEach((v, k) => { a += v * S.city.nbs[k].inc; n += v; });
  return n ? a / n / (110 * S.costIdx) : 1;
}
function fundAnnual(S, ignoreCampaign) {
  const st = students(S), fam = st / 1.55, m = mission(S), adv = sk(S, 'advancement');
  const part = fundParticipation(S);
  const gift = 1700 * Math.pow(enrolledWealth(S), 1.3) * S.costIdx * (1 + 0.25 * S.city.econ);
  const trustees = (100000 + 300 * st) * S.costIdx * (0.6 + S.board / 150);
  const alumni = S.alumni * 0.07 * (190 + 25 * S.prog.ath) * S.costIdx * (0.7 + S.rep / 160);
  let t = (fam * part * gift + trustees + alumni) * (0.7 + 0.14 * adv) * (1 + modSum(S, 'giving') / 100) * (1 + pSum(S, 'giving')) * (1 + 0.045 * te(S, 'donors')) * (S.flags.chair === 'alum' ? 1.06 : 1);
  if (S.campaign && !ignoreCampaign) t *= 0.86;
  return t;
}
function fundParticipation(S) { return clamp(0.34 + (S.sat - 50) * 0.008 + sk(S, 'advancement') * 0.03 + (mission(S).part || 0) + pSum(S, 'part'), 0.12, 0.95); }
const busCost = (S) => 85000 * S.costIdx * S.drift * (1 + pSum(S, 'bus'));
function teamCost(S) { let v = 0; for (const r of ROLES) if (S.team[r.id]) v += S.team[r.id].salary * 1.25; return v; }

/* Annualized budget at today's settings. Overrides let the budget meeting look a year ahead. */
function budget(S, o) {
  o = o || {};
  const tm = o.tuitionMul || 1, sm = o.salaryMul || 1, cm = o.costMul || 1, em = o.enrollMul || 1;
  const st = students(S) * em, ciR = S.costIdx * cm, ci = ciR * S.drift, eff = 1.04 - 0.02 * sk(S, 'business');
  const [g0, a0] = grossAid(S);
  const rev = { tuition: g0 * em * tm, aid: -a0 * em * tm, fund: fundAnnual(S), draw: S.endow * S.drawRate, aux: auxNet(S, st, ciR) };
  const facN = sum(S.fac);
  let program = 0; for (const p of PROGRAMS) if (!p.revenue) program += progCost(S, p.id, S.prog[p.id], st, ci);
  let upkeep = 0; for (const b of S.bld) upkeep += bValue(S, b) * cm * S.drift * 0.017;
  upkeep *= (has(S, 'solar') ? 0.88 : 1) * eff * (1 + pSum(S, 'upkeep'));
  const lean = 1 + pSum(S, 'admin');
  const exp = {
    faculty: facN * S.mktSalary * S.salaryIdx * sm * 1.27 + (S.pd * 900 + pSum(S, 'perFac')) * facN * ci,
    admin: (S.overhead + 2100 * st) * ci * eff * lean + teamCost(S) * sm,
    program,
    facilities: upkeep + plantValue(S) * cm * S.maint,
    outreach: S.marketing + S.bus.length * busCost(S) * cm,
    other: (240000 + 850 * st) * ci * eff * lean + (pSum(S, 'cost') + (S.flags.rink ? 150000 : 0) + (S.flags.remit ? 85000 : 0)) * ci,
    debt: S.debt * S.debtRate + S.debt / 22 + (S.cash < 0 ? -S.cash * 0.08 : 0),
  };
  const revT = rev.tuition + rev.aid + rev.fund + rev.draw + rev.aux, expT = sum(Object.values(exp));
  return { rev, exp, revT, expT, net: revT - expT, ntr: rev.tuition + rev.aid, students: st };
}
function ytdNet(S) { const y = S.ytd; return y.rev - y.exp + y.oneoff; }
function projNet(S) {
  const b = budget(S), w = wk(S), left = WPY - w;
  const fundLeft = b.rev.fund * clamp(46 - Math.max(w, 8), 0, 38) / 38;
  return ytdNet(S) + (b.revT - b.rev.fund - b.expT) / WPY * left + fundLeft;
}
function borrowLimit(S) { return Math.max(0, 1.1 * budget(S).revT - S.debt); }
function borrowRate(S) { return clamp(0.047 - 0.012 * S.city.econ - 0.001 * sk(S, 'business') + (S.cash < 0 ? 0.01 : 0) - (S.flags.chair === 'bank' ? 0.004 : 0), 0.03, 0.085); }
function cashMonths(S) { return S.cash / (budget(S).expT / 12); }
const creditLine = (S) => 0.08 * budget(S).expT;

/* ---------- demand ---------- */
function nbCalc(S, n, d) {
  const nb = S.city.nbs[n], m = mission(S), ci = S.costIdx;
  const beta = K.beta * Math.pow(110 * ci / nb.inc, 1.2);
  let fit = 0;
  if (m.id === 'stem' && nb.tech) fit += 0.3;
  if (nb.type === 'university') fit += 0.06 * (S.prog.acad - 2);
  if (nb.tech) fit += 0.06 * (S.prog.stem - 2);
  fit += 0.03 * (S.prog.arts + S.prog.ath - 4);
  for (const k of ['acad', 'stem', 'arts', 'ath']) if (S.prog[k] >= 5) fit += 0.08;
  const dist = nb.dist * (S.bus.includes(n) ? 0.45 : 1);
  const uY = K.you + K.rep * (S.rep - 50) / 10 + fit - beta * (m.beta || 1) * (1 + pSum(S, 'beta')) * S.tuition[d] / (1e4 * ci) - K.dist * dist;
  let eR = 0; const parts = [];
  for (const r of S.city.rivals) {
    if (!r.open || (r.k8 && d === 2)) continue;
    const dr = Math.hypot(nb.ci - r.ci, nb.cj - r.cj) + (nb.north !== r.north ? 3 : 0);
    const e = Math.exp((r.bias || 0) + 1.9 + K.rep * (r.rep - 50) / 10 - beta * r.tuition * [0.8, 0.97, 1.14][d] / (1e4 * ci) - K.dist * dr);
    eR += e; parts.push(e);
  }
  const eY = Math.exp(uY), eP = Math.exp(K.pub + 2.6 + K.rep * (nb.pq - 50) / 10);
  const tot = eY + eR + eP;
  return { share: eY / tot, priv: eY / (eY + eR), rivals: parts.map((e) => e / tot), pub: eP / tot };
}
function consider(S, nb) { return 0.42 * sig((nb.inc / S.costIdx - 105) / 32) * (nb.type === 'university' ? 1.25 : 1) * (1 + 0.1 * S.city.econ * (mission(S).econSwing || 1)); }
/* Expected applications per year from one neighborhood to one division: [full pay, needing aid]. */
function appsRate(S, n, d) {
  const nb = S.city.nbs[n], c = nbCalc(S, n, d), m = mission(S);
  const adm = (0.9 + 0.05 * sk(S, 'admissions')) * (1 + 0.035 * te(S, 'admissions')), buzz = 1 + modSum(S, 'apps') / 100, ef = [1.0, 0.42, 0.55][d];
  let fp = nb.kids * consider(S, nb) * c.share * nb.aware * ef * adm * buzz * K.apps * (1 + pSum(S, 'apps'));
  for (const id of S.plan || []) { const p = PILLAR_BY[id]; if (p.nbTypes && p.nbTypes.includes(nb.type)) fp *= 1 + p.fx.nbApps; }
  if (d === 0 && has(S, 'elc')) fp *= 1.25;
  const q = 0.055 * (1 - sig((nb.inc / S.costIdx - 105) / 32)), dist = nb.dist * (S.bus.includes(n) ? 0.45 : 1);
  let aid = nb.kids * q * nb.aware * ef * adm * buzz * (0.45 + 2.75 * discountRate(S)) * Math.exp(K.rep * 0.7 * (S.rep - 50) / 10 - 0.04 * dist) * (m.aidApps || 1) * K.aidApps * (1 + pSum(S, 'aidApps'));
  if (S.city.charter) aid *= 0.8;
  return [fp, aid];
}
function awareTarget(S, n) {
  const nb = S.city.nbs[n];
  const foc = S.focus.length ? (S.focus.includes(n) ? 1.9 : 0.55) : 1;
  const mk = 0.35 * (1 - Math.exp(-S.marketing / (220000 * S.costIdx))) * foc * (0.9 + 0.05 * sk(S, 'admissions'));
  const wom = Math.min(0.25, S.nbE[n] / (nb.kids * 13) * 6);
  return clamp(0.2 + 0.3 * S.rep / 100 + mk + (S.bus.includes(n) ? 0.08 : 0) + wom + pSum(S, 'aware'), 0.08, 1);
}
/* What the map card shows: of families who would consider private school, where do they land? */
function nbMarket(S, n) {
  let you = 0, pub = 0; const riv = S.city.rivals.map(() => 0);
  for (let d = 0; d < 3; d++) { const c = nbCalc(S, n, d); you += c.share / 3; pub += c.pub / 3; let k = 0; S.city.rivals.forEach((r, x) => { if (!r.open || (r.k8 && d === 2)) return; riv[x] += c.rivals[k++] / 3; }); }
  return { you, pub, riv };
}

/* ---------- new game ---------- */
function makePerson(S, role, skill) {
  return { name: pick(S, FIRST_NAMES) + ' ' + pick(S, LAST_NAMES), skill, bio: pick(S, ROLE_BY[role].bios), since: yr(S),
    salary: Math.round((70000 + 18000 * skill + rr(S, -5000, 5000)) * S.costIdx / 1000) * 1000 };
}
function rollCands(S) {
  S.cands = {};
  for (const r of ROLES) {
    S.cands[r.id] = [0, 1, 2].map(() => makePerson(S, r.id, clamp(Math.round(rn(S, 2.7 + (S.rep - 50) / 22, 1.05)), 1, 5)));
    S.cands[r.id].sort((a, b) => b.skill - a.skill);
  }
}
const blankYtd = () => ({ rev: 0, exp: 0, oneoff: 0, tuition: 0, aid: 0, fund: 0, draw: 0, aux: 0, capital: 0 });
const blankAdm = (S) => ({ stage: 0, acc: S.city.nbs.map(() => [[0, 0], [0, 0], [0, 0]]), pool: null, plan: null, incoming: null, nbIn: null, results: null, apps: 0 });

function newGame(o) {
  const sc = SCENARIO_BY[o.scenario] || SCENARIOS[0];
  const S = {
    v: 1, seed: o.seed >>> 0, rs: Math.imul(o.seed | 0, 2654435761) | 0, name: o.name, colors: o.colors, emblem: o.emblem, motto: o.motto,
    mission: o.mission, scenario: sc.id, week: 0, over: null, overhead: sc.overhead,
    cash: sc.cash, endow: sc.endow, debt: sc.debt, debtRate: 0.048, campaignFund: 0,
    tuition: sc.tuition.slice(), lastTuitionPct: 3.5, lastRaisePct: 2.5, next: { tuitionPct: 3.5, raisePct: 2.5 },
    salaryIdx: sc.salaryIdx, mktSalary: 62000, costIdx: 1, drift: 1, infl: 0.03,
    fac: sc.fac.slice(), fq: sc.fq, morale: sc.morale, sat: sc.sat, rep: sc.rep, board: sc.board, college: 55, alumni: sc.alumni,
    prog: Object.assign({}, sc.prog), bld: [], builds: [],
    maint: sc.maint || 0.01, marketing: 120000, focus: [], bus: [], pd: 1, drawRate: 0.045,
    team: {}, cands: {}, mods: [], grades: [], nbE: [], returning: null, lastRetention: 0.9,
    ytd: blankYtd(), years: [], hist: { students: [], cash: [], endow: [], rep: [], sat: [], morale: [], board: [], eq: [] },
    log: [], pending: [], goals: [], flags: { surplusYears: 0 }, evLast: {}, nextEvent: 5, campaign: null, lastCampaignEnd: -999,
    facLeaving: 0, lastApps: 150, lastYield: 0.6, lastAdmitRate: 0.75, prevOpen: 0, lastFund: 0,
    time: {}, timeE: {}, plan: [], banners: {}, follow: [],
  };
  for (const a of TIME_AREAS) { S.time[a.id] = 2; S.timeE[a.id] = 0; }
  for (const t of ['ls', 'main', 'us', 'gym']) S.bld.push({ t, cond: clamp(sc.cond + rr(S, -6, 6), 20, 100), slot: -1 });
  S.grades = BASE_GRADES.map((n) => { const k = Math.round(n * sc.scale); return { n: k, q: 50 + (sc.rep - 50) * 0.3, aid: k * sc.aid, an: k * sc.aid / 0.6 }; });
  S.city = makeCity(S);
  for (const r of ROLES) S.team[r.id] = sc.team[r.id] ? makePerson(S, r.id, sc.team[r.id]) : null;
  /* Where today's families live follows where demand comes from. */
  const w = S.city.nbs.map((nb, n) => { let a = 0; for (let d = 0; d < 3; d++) { const r = appsRate(S, n, d); a += r[0] + r[1] * 0.5; } return a; });
  const st = students(S), ws = sum(w);
  S.nbE = w.map((x) => st * x / ws);
  S.city.nbs.forEach((nb, n) => (nb.aware = awareTarget(S, n)));
  S.nbE = S.city.nbs.map((nb, n) => { let a = 0; for (let d = 0; d < 3; d++) { const r = appsRate(S, n, d); a += r[0] + r[1] * 0.5; } return a; });
  const ws2 = sum(S.nbE); S.nbE = S.nbE.map((x) => st * x / ws2);
  S.adm = blankAdm(S);
  S.prevOpen = st; S.lastFund = fundAnnual(S);
  S.start = { students: st, worth: S.cash + S.endow - S.debt, rep: S.rep, endow: S.endow };
  S.start.fracs = {}; legacy(S).parts.forEach((p) => (S.start.fracs[p.name] = p.frac));
  { const b0 = budget(S); S.expect = areaScores(S, { growth: 0, margin: b0.net / b0.revT, net: b0.net, fundG: 0, endG: 0, fund: b0.rev.fund }).map((a) => clamp(a.score - 2, 45, 80)); }
  rollCands(S);
  newGoals(S, true);
  S.pending.push({ type: 'intro', block: true });
  log(S, 'You begin as Head of ' + S.name + '.', 'info');
  return S;
}

/* ---------- player actions ---------- */
function hireQuality(S) {
  return clamp(45 + (S.salaryIdx - 0.85) * 100 + (S.rep - 50) * 0.2 + sk(S, 'academic') * 1.5 + (has(S, 'housing') ? 3 : 0) + pSum(S, 'hire') + (S.flags.remit ? 2 : 0) + rn(S, 0, 3), 25, 96);
}
function setFac(S, d, delta) {
  const N = sum(S.fac), w = wk(S), mid = w > 7 && w < 44;
  if (delta > 0) {
    const q = hireQuality(S) - (mid ? 6 : 0);
    S.fq = (S.fq * N + q * delta) / (N + delta); S.fac[d] += delta;
    oneoff(S, -3500 * S.costIdx * delta);
  } else if (delta < 0 && S.fac[d] + delta >= 2) {
    S.fac[d] += delta;
    addMod(S, 'morale', -1.6 * -delta, 44, 'Faculty cuts');
    oneoff(S, -(mid ? 0.14 : 0.04) * S.mktSalary * S.salaryIdx * -delta);
  }
}
function canProg(S, k, lvl) { const p = PROGRAM_BY[k]; return !(lvl > 3 && p.gate && !has(S, p.gate)); }
function setProg(S, k, lvl) {
  lvl = clamp(lvl, 0, 5);
  if (!canProg(S, k, lvl)) return false;
  const cur = S.prog[k];
  if (lvl > cur) oneoff(S, -12000 * (lvl - cur) * S.costIdx);
  if (lvl < cur && k !== 'aux') { addMod(S, 'sat', -1.6 * (cur - lvl), 36, PROGRAM_BY[k].name + ' cut'); addMod(S, 'morale', -1 * (cur - lvl), 30, 'Program cuts'); }
  S.prog[k] = lvl; return true;
}
function oneoff(S, amt) { S.cash += amt; S.ytd.oneoff += amt; }
function hire(S, role, idx) {
  const c = S.cands[role][idx]; if (!c) return;
  if (S.team[role]) oneoff(S, -0.2 * S.team[role].salary);
  c.since = yr(S); S.team[role] = c; S.cands[role].splice(idx, 1);
  log(S, c.name + ' joins as ' + ROLE_BY[role].title + '.', 'good');
}
function freeSlots(S) { const used = new Set(); S.bld.forEach((b) => b.slot >= 0 && used.add(b.slot)); S.builds.forEach((b) => b.slot >= 0 && used.add(b.slot)); const out = []; for (let i = 0; i < SLOTS.length; i++) if (!used.has(i)) out.push(i); return out; }
function canBuild(S, t) {
  const B = BUILDINGS[t];
  if (!B.multi && (has(S, t) || S.builds.some((b) => b.t === t))) return 'Already built';
  if (!B.noSlot && !B.replaces && !freeSlots(S).length) return 'No open sites on campus';
  if (B.replaces && S.builds.some((b) => b.t === t)) return 'Already underway';
  return null;
}
const buildCost = (S, t) => BUILDINGS[t].cost * S.costIdx * (S.flags.land && (t === 'housing' || t === 'turf') ? 0.6 : 1);
/* Campaign money is used first. The rest comes from cash or a new bond. */
function startBuild(S, t, mode) {
  if (canBuild(S, t)) return false;
  const B = BUILDINGS[t]; let cost = buildCost(S, t);
  const fromCamp = Math.min(S.campaignFund, cost); const rest = cost - fromCamp;
  if (mode === 'debt') { if (rest > borrowLimit(S)) return false; takeDebt(S, rest); S.cash -= rest; }
  else { if (rest > S.cash) return false; S.cash -= rest; }
  S.campaignFund -= fromCamp; S.ytd.capital += cost;
  let slot = -1; if (!B.noSlot && !B.replaces) slot = freeSlots(S)[0];
  S.builds.push({ t, slot, left: B.weeks, total: B.weeks });
  log(S, 'Ground broken on the ' + B.name + '.', 'good');
  return true;
}
function takeDebt(S, amt) { const r = borrowRate(S); S.debtRate = (S.debt * S.debtRate + amt * r) / (S.debt + amt); S.debt += amt; S.cash += amt; }
function payDebt(S, amt) { amt = Math.min(amt, S.debt, Math.max(0, S.cash)); S.debt -= amt; S.cash -= amt; }
function renovCost(S, b) { return Math.max(0, 96 - b.cond) / 100 * bValue(S, b) * 0.38; }
function renovate(S, idx) { const b = S.bld[idx], c = renovCost(S, b); if (c > S.cash + S.campaignFund) return false; const fc = Math.min(S.campaignFund, c); S.campaignFund -= fc; S.cash -= c - fc; S.ytd.capital += c; b.cond = 96; log(S, BUILDINGS[b.t].name + ' renovated.', 'good'); return true; }
function toggleBus(S, n) { const k = S.bus.indexOf(n); if (k >= 0) { S.bus.splice(k, 1); addMod(S, 'sat', -1.5, 24, 'Bus route cut'); } else S.bus.push(n); }
function toggleFocus(S, n) { const k = S.focus.indexOf(n); if (k >= 0) S.focus.splice(k, 1); else { S.focus.push(n); if (S.focus.length > 3) S.focus.shift(); } }

function campaignCapacity(S) {
  return fundAnnual(S, true) * 12 * (0.7 + S.rep / 170) * (0.85 + 0.06 * sk(S, 'advancement')) * (1 + 0.15 * S.city.econ);
}
const CAMPAIGN_TIERS = [
  { id: 'modest', name: 'Modest', mult: 0.65, weeks: 96, odds: 'Very likely to succeed' },
  { id: 'ambitious', name: 'Ambitious', mult: 0.95, weeks: 96, odds: 'Could go either way' },
  { id: 'stretch', name: 'Stretch', mult: 1.3, weeks: 144, odds: 'A long shot that inspires bigger gifts' },
];
function canCampaign(S) { if (S.campaign) return 'A campaign is already running'; if (yr(S) * WPY + wk(S) - S.lastCampaignEnd < 96) return 'Donors need two years between campaigns'; return null; }
function startCampaign(S, tierId) {
  if (canCampaign(S)) return false;
  const tier = CAMPAIGN_TIERS.find((t) => t.id === tierId), cap = campaignCapacity(S);
  const goal = Math.round(cap * tier.mult / 50000) * 50000;
  const final = Math.min(goal * 1.12, cap * Math.pow(goal / cap, 0.35) * Math.exp(rn(S, 0, 0.16)));
  S.campaign = { goal, final, total: tier.weeks, left: tier.weeks, raised: 0, tier: tier.id };
  log(S, 'The board launches a ' + money(goal) + ' capital campaign.', 'good');
  return true;
}
function moveToEndow(S, amt) { amt = Math.min(amt, S.campaignFund); S.campaignFund -= amt; S.endow += amt; }

/* ---------- admissions ---------- */
function capG(S, g) { const d = divOf(g); return capacity(S, d) / DIV_GRADES[d].length; }
function seatsNext(S) {
  const ret = S.returning || S.grades.map((g) => g.n), out = [];
  for (let g = 0; g < 13; g++) out.push(Math.max(0, capG(S, g) * 1.06 - (g > 0 ? ret[g - 1] : 0)));
  return out;
}
function pickGrade(S, d) {
  const gs = DIV_GRADES[d];
  if (rnd(S) < [0.6, 0.6, 0.68][d]) return gs[0];
  const rest = gs.slice(1).filter((g) => g !== 12);
  return pick(S, rest);
}
function buildPool(S) {
  const pool = [], m = mission(S);
  for (let n = 0; n < S.city.nbs.length; n++) {
    const nb = S.city.nbs[n];
    for (let d = 0; d < 3; d++) {
      const c = nbCalc(S, n, d);
      for (let k = 0; k < 2; k++) {
        const cnt = S.adm.acc[n][d][k], N = Math.floor(cnt) + (rnd(S) < cnt % 1 ? 1 : 0);
        for (let x = 0; x < N; x++) {
          const q = clamp(rn(S, 50 + 0.3 * (S.rep - 50) + 0.03 * (nb.inc / S.costIdx - 110) + (k ? 3 : 0) + pSum(S, 'q'), 13), 5, 99);
          let need = 0;
          if (k) need = clamp(rn(S, clamp(1 - nb.inc * 1000 * 0.105 / S.tuition[d], 0.15, 0.9), 0.16), 0.1, 0.95);
          const y = clamp(K.yield + 0.5 * c.priv + 0.012 * sk(S, 'admissions') - 0.0025 * (q - 50) + (k ? 0.2 + (m.id === 'access' ? 0.05 : 0) + pSum(S, 'aidYield') : 0) + (d === 0 && has(S, 'elc') ? 0.06 : 0) + 0.008 * te(S, 'admissions'), 0.12, 0.93);
          pool.push({ n, d, g: pickGrade(S, d), q, need, y });
        }
      }
    }
  }
  /* Students from abroad (Global Campus): full pay, Upper School, counted with the neighborhood nearest campus. */
  const home = S.city.nbs.findIndex((nb) => nb.type === 'south');
  for (let x = 0, N = Math.round(pSum(S, 'intl') * rr(S, 0.75, 1.25)); x < N; x++) pool.push({ n: home, d: 2, g: pickGrade(S, 2), q: clamp(rn(S, 56, 11), 5, 99), need: 0, y: 0.72 });
  pool.sort((a, b) => b.q - a.q);
  S.adm.pool = pool; S.adm.apps = pool.length; S.adm.stage = 2;
}
/* Walks each division's applicants from strongest to weakest, admitting until the target, the seats or the aid runs out. */
function planAdmissions(S, admit, aidBudget) {
  const pool = S.adm.pool || [], seats = seatsNext(S), T = S.tuition;
  const o = { list: [], cnt: [0, 0, 0], exp: [0, 0, 0], q: [0, 0, 0], wait: [0, 0, 0], unfunded: [0, 0, 0], apps: [0, 0, 0], aidExp: 0, expG: new Array(13).fill(0), revExp: 0, aided: 0 };
  let aidLeft = aidBudget;
  for (let x = 0; x < pool.length; x++) {
    const a = pool[x], d = a.d; o.apps[d]++;
    if (o.cnt[d] >= admit[d]) continue;
    if (o.expG[a.g] + a.y > seats[a.g]) { o.wait[d]++; continue; }
    if (a.need > 0) { const cost = a.need * T[d] * a.y; if (cost > aidLeft) { o.unfunded[d]++; continue; } aidLeft -= cost; o.aidExp += cost; o.aided++; }
    o.list.push(x); o.cnt[d]++; o.exp[d] += a.y; o.q[d] += a.q; o.expG[a.g] += a.y; o.revExp += a.y * T[d] * (1 - a.need);
  }
  for (let d = 0; d < 3; d++) o.q[d] = o.cnt[d] ? o.q[d] / o.cnt[d] : 0;
  return o;
}
function defaultAdmit(S) {
  const pool = S.adm.pool || [], a = [0, 0, 0];
  for (const p of pool) if (p.q >= 36) a[p.d]++;
  return a;
}
function defaultAid(S) {
  const pool = S.adm.pool || []; let rev = 0;
  for (const p of pool) rev += p.y * S.tuition[p.d] * 0.7;
  return Math.round(Math.max(discountRate(S), 0.1) * rev / 10000) * 10000;
}
function maxAid(S) { const pool = S.adm.pool || []; let v = 0; for (const p of pool) v += p.need * S.tuition[p.d] * p.y; return Math.ceil(v / 10000) * 10000; }
function commitAdmissions(S, admit, aidBudget) {
  const plan = planAdmissions(S, admit, aidBudget);
  S.adm.plan = { admit: admit.slice(), aid: aidBudget, list: plan.list, cnt: plan.cnt.slice(), apps: plan.apps.slice() };
  S.adm.stage = 3;
  const tot = sum(plan.cnt), rate = S.adm.apps ? tot / S.adm.apps : 1;
  S.lastAdmitRate = rate;
  log(S, 'Decisions mailed: ' + tot + ' of ' + S.adm.apps + ' applicants admitted.', 'info');
  clearPending(S, 'admit');
}
function resolveAdmissions(S) {
  const pool = S.adm.pool, plan = S.adm.plan, inc = []; for (let g = 0; g < 13; g++) inc.push({ n: 0, qs: 0, aid: 0, an: 0 });
  const nbIn = S.city.nbs.map(() => 0), res = { adm: [0, 0, 0], enr: [0, 0, 0], aid: 0, q: 0 };
  if (plan) for (const x of plan.list) {
    const a = pool[x]; res.adm[a.d]++;
    if (rnd(S) < a.y) { const I = inc[a.g]; I.n++; I.qs += a.q; I.aid += a.need; if (a.need > 0) I.an++; nbIn[a.n]++; res.enr[a.d]++; res.aid += a.need * S.tuition[a.d]; res.q += a.q; }
  }
  const e = sum(res.enr), ad = sum(res.adm);
  res.q = e ? res.q / e : 0; res.yield = ad ? e / ad : 0;
  S.lastYield = res.yield || S.lastYield; S.lastApps = S.adm.apps;
  S.adm.incoming = inc; S.adm.nbIn = nbIn; S.adm.results = res; S.adm.stage = 4; S.adm.pool = null;
  S.pending.push({ type: 'deposits', block: true });
}
function doRetention(S) {
  const m = mission(S), ret = []; let stay = 0, base = 0;
  for (let g = 0; g < 12; g++) {
    let p = g === 5 ? 0.86 : g === 8 ? 0.84 : g >= 9 ? 0.945 : 0.925;
    p += 0.0024 * (S.sat - 58) - 0.007 * Math.max(0, S.next.tuitionPct - S.infl * 100 - 1) + 0.025 * S.city.econ * (m.econSwing || 1)
      + 0.004 * (S.prog.well - 2) + 0.003 * sk(S, 'students') + (m.ret || 0) + (g >= 8 ? 0.004 * (S.prog.ath - 2) : 0) + modSum(S, 'ret') / 100
      + pSum(S, 'ret') + (g === 5 || g === 8 ? pSum(S, 'trans') : 0);
    const k = binom(S, S.grades[g].n, clamp(p, 0.55, 0.975));
    ret.push(k); stay += k; base += S.grades[g].n;
  }
  ret.push(0);
  S.returning = ret; S.lastRetention = base ? stay / base : 0.9;
  log(S, 'Re-enrollment contracts are in: ' + pct(S.lastRetention) + ' of families are returning.', S.lastRetention >= 0.91 ? 'good' : S.lastRetention < 0.87 ? 'bad' : 'info');
}

/* ---------- the year's fixed moments ---------- */
function clearPending(S, type) { S.pending = S.pending.filter((p) => p.type !== type); }
function minRaise(S) { return S.flags.union ? Math.ceil(S.infl * 200) / 2 : 0; }
/* The Tuition Promise caps increases; otherwise the ceiling is 10%. */
function maxTuition(S) { const cap = pSum(S, 'tuitionCap'); return cap ? Math.max(0, Math.floor((S.infl * 100 + cap) * 2) / 2) : 10; }
function commitBudget(S, tp, rp) {
  rp = Math.max(rp, minRaise(S)); tp = Math.min(tp, maxTuition(S));
  if (S.flags.payPromise) {
    if (yr(S) >= S.flags.payPromise || S.salaryIdx >= 1) S.flags.payPromise = 0;
    else if (rp < S.infl * 100 + 1) { addMod(S, 'morale', -10, 90, 'Broken pay promise'); S.flags.payPromise = 0; log(S, 'The faculty notice that the promised raises did not come.', 'bad'); }
  }
  S.next = { tuitionPct: tp, raisePct: rp }; S.lastTuitionPct = tp; S.lastRaisePct = rp;
  const p = projectNext(S, tp, rp);
  if (p.b.net < -0.03 * p.b.revT) { S.board = clamp(S.board - (S.flags.chair === 'bank' ? 4 : 2), 0, 100); log(S, 'The finance committee approves a deficit budget, reluctantly.', 'bad'); }
  if (tp > 7) S.board = clamp(S.board - 1, 0, 100);
  if (tp > 5 && S.flags.chair === 'parent') { S.board = clamp(S.board - 2, 0, 100); log(S, 'The board chair hears about the tuition increase from other parents before she hears it from you.', 'bad'); }
  log(S, 'Budget set for next year: tuition +' + tp + '%, salary pool +' + rp + '%.', 'info');
  clearPending(S, 'budget');
}
function projectNext(S, tp, rp) {
  const hit = Math.max(0, tp - S.infl * 100 - 1) * 0.007;
  const last = S.years.length ? S.years[S.years.length - 1] : null;
  const trend = last && last.students ? clamp((students(S) / last.students - 1) * 0.5, -0.05, 0.05) : 0;
  const em = 1 - hit + trend;
  const b = budget(S, { tuitionMul: 1 + tp / 100, salaryMul: 1 + rp / 100, costMul: (1 + S.infl) * 1.01, enrollMul: em });
  return { b, em, band: (0.05 - 0.007 * sk(S, 'admissions')) * b.ntr, payIdx: S.salaryIdx * (1 + rp / 100) / (1 + S.infl + 0.01) };
}
function openingDay(S) {
  let melt = 0, late = 0;
  for (const g of S.grades) { const m = binom(S, g.n, 0.012 + 0.012 * Math.max(0, -S.city.econ)); if (g.n > 0) { g.aid *= (g.n - m) / g.n; g.an *= (g.n - m) / g.n; } g.n -= m; melt += m; }
  const want = Math.round(S.lastApps * 0.025 * (S.rep / 50));
  for (let x = 0; x < want; x++) {
    const g = ri(S, 0, 11); if (S.grades[g].n + 1 > capG(S, g) * 1.06) continue;
    const G = S.grades[g]; G.q = (G.q * G.n + (profileAvg(S) - 4)) / (G.n + 1); G.n++; late++;
  }
  const n = students(S), prev = S.prevOpen;
  if (n >= 0.95 * totalCapacity(S)) S.flags.fullHouse = true;
  S.pending.push({ type: 'opening', block: true, n, prev, melt, late });
  log(S, 'Opening Day: ' + n + ' students (' + (n >= prev ? '+' : '−') + Math.abs(n - prev) + ').', n >= prev ? 'good' : 'bad', 'opening');
  S.prevOpen = n;
}
function facultySeason(S) {
  const N = sum(S.fac);
  const rate = clamp(0.1 + (55 - S.morale) * 0.003 + (1 - S.salaryIdx) * 0.25 - (has(S, 'housing') ? 0.02 : 0), 0.04, 0.35);
  const leave = binom(S, N, rate);
  if (leave > 0) {
    const a = leave / N, q = hireQuality(S);
    let fq = S.fq * (1 - a) + q * a;
    if (S.morale < 45) fq -= a * 30 * (45 - S.morale) / 45;
    S.fq = fq; oneoff(S, -3000 * S.costIdx * leave);
    log(S, leave + ' teachers are leaving this year. Replacements hired (quality ' + Math.round(q) + ').', leave / N > 0.16 ? 'bad' : 'info');
  }
  S.fq = clamp(S.fq + 0.4 + S.pd * 0.55 + sk(S, 'academic') * 0.18 + pSum(S, 'fq') + 0.12 * te(S, 'faculty'), 20, 96);
  S.facLeaving = leave;
}
function graduation(S) {
  const sr = S.grades[12], m = mission(S);
  const score = clamp(0.5 * sr.q + 0.3 * EQ(S, 2) + S.prog.coll * 4 * (m.collMul || 1) + rn(S, 0, 4), 0, 100);
  S.college = 0.6 * S.college + 0.4 * score;
  S.alumni += sr.n;
  const top = Math.round(sr.n * clamp((score - 38) / 95, 0.02, 0.7));
  log(S, 'Commencement: ' + sr.n + ' seniors graduate. ' + top + ' are headed to highly selective colleges.', score >= 62 ? 'good' : 'info', 'graduation');
}
const LETTERS = [[93, 'A'], [90, 'A−'], [87, 'B+'], [83, 'B'], [80, 'B−'], [77, 'C+'], [73, 'C'], [70, 'C−'], [60, 'D'], [0, 'F']];
const letter = (s) => LETTERS.find((l) => s >= l[0])[1];
/* The board grades six areas. Scores are 0-100 and turn into letters. */
function areaScores(S, c) {
  const st = students(S), fill = st / totalCapacity(S), eq = EQavg(S);
  return [
    ['Enrollment', 74 + clamp(c.growth * 3, -15, 15) + clamp((fill - 0.82) * 40, -8, 8), st + ' students, ' + (c.growth >= 0 ? 'up ' : 'down ') + Math.abs(c.growth).toFixed(1) + '%'],
    ['Finances', 76 + clamp(c.margin * 500, -30, 14) + clamp((cashMonths(S) - 2) * 2, -8, 6), 'Operating result ' + money(c.net, true)],
    ['Program', 38 + eq * 0.62, 'Teaching quality ' + Math.round(eq)],
    ['Faculty', 36 + (S.morale * 0.5 + S.fq * 0.5) * 0.62, 'Morale ' + Math.round(S.morale) + ', pay at ' + Math.round(S.salaryIdx * 100) + '% of market'],
    ['Families', 36 + S.sat * 0.62 + (S.lastRetention - 0.9) * 100, 'Satisfaction ' + Math.round(S.sat) + ', retention ' + pct(S.lastRetention)],
    ['Advancement', 72 + clamp(c.fundG * 0.5, -10, 10) + clamp(c.endG * 0.4, -8, 8) - (S.team.advancement ? 0 : 6), 'Annual fund ' + money(c.fund)],
  ].map((a) => ({ name: a[0], score: clamp(a[1], 0, 100), grade: letter(clamp(a[1], 0, 100)), note: a[2] }));
}
function yearEnd(S) {
  const y = yr(S), net = ytdNet(S), last = S.years.length ? S.years[S.years.length - 1] : null;
  const st = students(S), growth = last ? (st / last.students - 1) * 100 : (st / S.start.students - 1) * 100;
  const margin = net / Math.max(1, S.ytd.rev);
  const fundG = S.lastFund ? (S.ytd.fund / S.lastFund - 1) * 100 : 0, endG = last ? (S.endow / last.endow - 1) * 100 : 0;
  const eq = EQavg(S);
  const areas = areaScores(S, { growth, margin, net, fundG, endG, fund: S.ytd.fund });
  /* The board expects steady progress from wherever you started, not perfection in year one. */
  let delta = 0;
  areas.forEach((a, i) => { a.expect = S.expect[i]; delta += clamp((a.score - S.expect[i]) / 6, -4, 3); S.expect[i] += (78 - S.expect[i]) * (S.expect[i] < 78 ? 0.22 : 0.1); });

  delta *= 0.8;
  if (S.flags.chair === 'alum' && !S.team.advancement) delta -= 2;
  S.flags.surplusYears = net >= 0 ? S.flags.surplusYears + 1 : 0;
  if (net >= 0 && S.flags.recession && S.week - S.flags.recession < 60) S.flags.storm = true;
  if (areas.every((a) => a.score >= 90)) S.flags.honor = true;
  const goalNotes = [];
  for (const g of S.goals) {
    if (g.done || g.failed) continue;
    const v = GOALS[g.type].val(S);
    if (v >= g.x) { g.done = true; delta += 6; goalNotes.push({ ok: true, text: goalText(g) }); }
    else if (y >= g.due) { g.failed = true; delta -= 4; goalNotes.push({ ok: false, text: goalText(g) }); }
  }
  const before = S.board;
  S.board = clamp(S.board + delta, 0, 100);
  const contract = (y + 1) % 3 === 0;
  let verdict = null;
  if (contract) verdict = S.board >= 35 ? 'renewed' : 'ended';
  S.years.push({ y, students: st, net, ntr: S.ytd.tuition + S.ytd.aid, rev: S.ytd.rev, fund: S.ytd.fund, apps: S.lastApps, yield: S.lastYield, retention: S.lastRetention,
    rep: S.rep, sat: S.sat, morale: S.morale, fq: S.fq, eq, cash: S.cash, endow: S.endow, debt: S.debt, tuition: avgTuition(S), discount: discountRate(S), board: S.board, legacy: legacy(S).total });
  S.lastFund = S.ytd.fund || S.lastFund;
  S.review = { y, areas, delta: S.board - before, board: S.board, net, goalNotes, contract, verdict, retire: y >= 9 };
  S.pending.push({ type: 'review', block: true });
  checkBanners(S);
  S.review.banners = BANNERS.filter((b) => S.banners[b.id] != null && S.banners[b.id] > S.week - WPY).map((b) => b.id);
}
function ackReview(S, retire) {
  clearPending(S, 'review');
  if (S.review.verdict === 'ended') return endGame(S, 'nonrenewal');
  if (retire) return endGame(S, 'retired');
  if (S.goals.every((g) => g.done || g.failed)) newGoals(S);
  /* A strategic plan after the first year, then a new pillar with each renewed contract. */
  if (S.review.y === 0 || S.review.verdict === 'renewed') {
    const pool = PILLARS.filter((p) => !S.plan.includes(p.id)).map((p) => p.id), opts = [];
    while (opts.length < 3 && pool.length) opts.push(pool.splice(Math.floor(rnd(S) * pool.length), 1)[0]);
    if (opts.length) S.pending.push({ type: 'plan', block: true, opts });
  }
}
function commitPlan(S, id) {
  const p = PILLAR_BY[id]; if (!p || S.plan.includes(id)) return false;
  S.plan.push(id); if (p.fx.once) oneoff(S, -p.fx.once * S.costIdx);
  log(S, 'The board adopts a strategic plan pillar: ' + p.name + '.', 'good');
  clearPending(S, 'plan'); return true;
}

/* ---------- banners for the gym ---------- */
const BANNERS = [
  { id: 'full', name: 'Full House', how: 'Open the year with 95% of seats filled.', test: (S) => S.flags.fullHouse },
  { id: 'black', name: 'In the Black', how: 'Finish three straight years with a surplus.', test: (S) => S.flags.surplusYears >= 3 },
  { id: 'pay', name: 'Market Pay', how: 'Bring faculty pay to 100% of market.', test: (S) => S.salaryIdx >= 1 },
  { id: 'rep', name: 'Talk of the Town', how: 'Reach a reputation of 70.', test: (S) => S.rep >= 70 },
  { id: 'first', name: 'First Choice', how: 'Hold a higher reputation than every competitor.', test: (S) => S.city.rivals.every((r) => !r.open || S.rep > r.rep) },
  { id: 'teach', name: 'Master Teachers', how: 'Reach a teaching quality of 80.', test: (S) => EQavg(S) >= 80 },
  { id: 'select', name: 'Hard to Get Into', how: 'Admit fewer than half of your applicants with 90% of seats filled.', test: (S) => yr(S) >= 1 && S.lastAdmitRate < 0.5 && students(S) >= 0.9 * totalCapacity(S) },
  { id: 'stay', name: 'They Stay', how: 'See 94% of families re-enroll.', test: (S) => S.lastRetention >= 0.94 },
  { id: 'doors', name: 'Open Doors', how: 'Have 30% of students on financial aid.', test: (S) => aidShare(S) >= 0.3 },
  { id: 'city', name: 'The Whole City', how: 'Enroll at least 15 students from every neighborhood.', test: (S) => S.nbE.every((v) => v >= 15) },
  { id: 'sig', name: 'Signature Campus', how: 'Open all four signature buildings.', test: (S) => sigCount(S) >= 4 },
  { id: 'endow', name: 'Twice the Endowment', how: 'Double the endowment you inherited, after inflation.', test: (S) => S.endow / S.costIdx >= 2 * S.start.endow },
  { id: 'debt', name: 'Mortgage Burned', how: 'Pay off every dollar of debt.', test: (S) => S.debt < 1 },
  { id: 'camp', name: 'Over the Top', how: 'Close a capital campaign above its goal.', test: (S) => S.flags.campOver },
  { id: 'storm', name: 'Weathered the Storm', how: 'Finish a recession year with a surplus.', test: (S) => S.flags.storm },
  { id: 'honor', name: 'Honor Roll', how: 'Earn a report card with nothing below an A−.', test: (S) => S.flags.honor },
];
function checkBanners(S) {
  for (const b of BANNERS) if (S.banners[b.id] == null && b.test(S)) { S.banners[b.id] = S.week; log(S, 'A new banner for the gym: ' + b.name + '.', 'good', 'ribbon'); }
}
const bannerCount = (S) => Object.keys(S.banners || {}).length;
const perkText = (S, s) => s.replace(/\{\$(\d+)(t?)\}/g, (m, v, t) => money(+v * S.costIdx * (t ? sum(S.fac) : 1)));
/* Fills in anything a school saved by an earlier build of the game does not have. */
function migrate(S) {
  if (!S.time) { S.time = {}; S.timeE = {}; for (const a of TIME_AREAS) { S.time[a.id] = 2; S.timeE[a.id] = 0; } }
  S.plan = S.plan || []; S.banners = S.banners || {}; S.follow = S.follow || [];
  if (S.start && S.start.endow == null) S.start.endow = S.endow / S.costIdx;
  return S;
}
/* What the head's days in one place are doing right now, in words. */
function timeNote(S, k) {
  const e = te(S, k), tgt = timeCurve(S.time[k]), sg = (v, d) => (v >= 0 ? '+' : '\u2212') + Math.abs(v).toFixed(d);
  const F = { faculty: ['Faculty morale ', 2.2, 1, ''], families: ['Family satisfaction ', 1.8, 1, ''], donors: ['Giving ', 4.5, 0, '%'], admissions: ['Applications ', 3.5, 0, '%'], board: ['Board confidence ', 0.012 * WPY, 1, ' a year'] }[k];
  const val = (v) => sg(F[1] * v, F[2]) + F[3];
  if (Math.abs(e) < 0.08 && Math.abs(tgt) < 0.08) return 'The two days people expect. No effect either way.';
  return F[0] + val(e) + (Math.abs(tgt - e) > 0.15 ? ', heading to ' + val(tgt) : '');
}

/* Queues a dilemma to arrive some weeks from now (follow-ups to earlier choices). */
function later(S, id, weeks) { S.follow.push({ id, at: S.week + weeks }); }

function endGame(S, why) { if (S.over) return; S.over = { why, week: S.week, legacy: legacy(S) }; S.pending = [{ type: 'over', block: true }]; }

function rollYear(S) {
  const prevTotal = students(S), ret = S.returning || S.grades.map((g, i) => (i < 12 ? Math.round(g.n * 0.9) : 0));
  const inc = S.adm.incoming || S.grades.map(() => ({ n: 0, qs: 0, aid: 0, an: 0 }));
  const ng = [];
  for (let g = 0; g < 13; g++) {
    const prev = g > 0 ? S.grades[g - 1] : null, stay = g > 0 ? ret[g - 1] : 0, frac = prev && prev.n > 0 ? stay / prev.n : 0, I = inc[g], n = stay + I.n;
    ng.push({ n, q: n > 0 ? ((prev ? prev.q * stay : 0) + I.qs) / n : 50, aid: (prev ? prev.aid * frac : 0) + I.aid, an: (prev ? prev.an * frac : 0) + I.an });
  }
  const f = prevTotal > 0 ? sum(ret) / prevTotal : 0;
  S.nbE = S.nbE.map((v, n) => v * f + (S.adm.nbIn ? S.adm.nbIn[n] : 0));
  S.grades = ng;
  S.tuition = S.tuition.map((t) => Math.round(t * (1 + S.next.tuitionPct / 100) / 50) * 50);
  const wage = S.infl + 0.01;
  S.drift *= 1.01;
  S.salaryIdx *= (1 + S.next.raisePct / 100) / (1 + wage);
  for (const r of ROLES) if (S.team[r.id]) S.team[r.id].salary = Math.round(S.team[r.id].salary * (1 + S.next.raisePct / 100));
  S.mktSalary *= 1 + wage; S.costIdx *= 1 + S.infl;
  const c = S.city;
  c.mktTuition *= 1 + S.infl + 0.012;
  for (const r of c.rivals) { if (!r.tuition) continue; r.tuition *= 1 + S.infl + 0.012 + rr(S, -0.005, 0.01); r.rep = clamp(r.rep + (r.rep0 - r.rep) * 0.15 + rn(S, 0, 1.4), 20, 95); }
  for (const nb of c.nbs) {
    nb.kids = Math.round(nb.kids * (1 + nb.growth + rn(S, 0, 0.008)));
    nb.inc *= 1 + S.infl + nb.incTrend + 0.01 * c.econ;
    nb.density = clamp(nb.density + nb.growth * 2.2, 0.2, 1);
    nb.pq = clamp(nb.pq + (nb.pq0 - nb.pq) * 0.2 + rn(S, 0, 1.6), 20, 92);
  }
  S.infl = clamp(0.028 + 0.012 * c.econ + rn(S, 0, 0.004), 0.012, 0.07);
  /* Senior staff sometimes move on. */
  for (const r of ROLES) {
    const p = S.team[r.id]; if (!p) continue;
    if (rnd(S) < 0.07 + (p.skill >= 4 ? 0.05 : 0) - (S.salaryIdx > 1.04 ? 0.03 : 0) - (S.morale > 65 ? 0.02 : 0)) {
      log(S, p.name + ', your ' + r.title + ', has taken a job elsewhere. The role is vacant.', 'bad'); S.team[r.id] = null;
    }
  }
  rollCands(S);
  S.returning = null; S.adm = blankAdm(S); S.ytd = blankYtd(); S.facLeaving = 0;
  rivalMoves(S);
  log(S, 'The ' + yearLabel(S) + ' school year begins. Tuition and salaries reset.', 'info');
}

/* ---------- board goals ---------- */
const GOALS = {
  enroll: { val: (S) => students(S), text: (g) => 'Enroll ' + g.x + ' students', fmt: (v) => Math.round(v) },
  reserve: { val: (S) => S.cash, text: (g) => 'Build cash reserves to ' + money(g.x), fmt: (v) => money(v) },
  surplus: { val: (S) => S.flags.surplusYears, text: (g) => 'Finish ' + (g.x === 1 ? 'a year' : g.x + ' straight years') + ' in the black', fmt: (v) => v + ' so far' },
  rep: { val: (S) => S.rep, text: (g) => 'Raise reputation to ' + g.x, fmt: (v) => Math.round(v) },
  pay: { val: (S) => S.salaryIdx * 100, text: (g) => 'Bring faculty pay to ' + g.x + '% of market', fmt: (v) => Math.round(v) + '%' },
  sig: { val: (S) => sigCount(S), text: () => 'Open a signature building', fmt: (v) => v + ' built' },
  endow: { val: (S) => S.endow, text: (g) => 'Grow the endowment to ' + money(g.x), fmt: (v) => money(v) },
  cond: { val: (S) => avgCond(S), text: (g) => 'Bring campus condition to ' + g.x, fmt: (v) => Math.round(v) },
  sat: { val: (S) => S.sat, text: (g) => 'Lift family satisfaction to ' + g.x, fmt: (v) => Math.round(v) },
  access: { val: (S) => aidShare(S) * 100, text: (g) => 'Have ' + g.x + '% of students on financial aid', fmt: (v) => Math.round(v) + '%' },
};
const goalText = (g) => GOALS[g.type].text(g);
function goalProgress(S, g) { const v = GOALS[g.type].val(S); return clamp((v - g.base) / Math.max(1e-9, g.x - g.base), 0, 1); }
function newGoals(S, first) {
  const y = yr(S), st = students(S), c = [], ci = S.costIdx;
  c.push({ type: 'enroll', x: Math.min(Math.round(st * 1.1 / 5) * 5, Math.floor(totalCapacity(S) * 0.98)) });
  c.push({ type: 'rep', x: Math.min(92, Math.round(S.rep + 6)) });
  if (S.salaryIdx < 0.99) c.push({ type: 'pay', x: 100 });
  if (avgCond(S) < 66) c.push({ type: 'cond', x: 70 });
  if (sigCount(S) < 4) c.push({ type: 'sig', x: sigCount(S) + 1 });
  c.push({ type: 'endow', x: Math.round(S.endow * 1.3 / 1e5) * 1e5 });
  if (S.sat < 72) c.push({ type: 'sat', x: Math.min(82, Math.round(S.sat + 8)) });
  if (S.mission === 'access' || rnd(S) < 0.3) c.push({ type: 'access', x: Math.round(aidShare(S) * 100 + 5) });
  const fin = rnd(S) < 0.5 ? { type: 'reserve', x: Math.round((Math.max(S.cash, 0) + 650000 * ci) / 50000) * 50000 } : { type: 'surplus', x: S.flags.surplusYears + 2 };
  const pool = c.filter((g) => GOALS[g.type].val(S) < g.x), out = [fin];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rnd(S) * pool.length), 1)[0]);
  for (const g of out) { g.base = GOALS[g.type].val(S); g.due = y + (first ? 2 : 3) - (first ? 0 : 1); g.done = false; g.failed = false; }
  S.goals = out;
  if (!first) log(S, 'The board has set three new goals.', 'info');
}

/* ---------- city news ---------- */
function rivalMoves(S) {
  const c = S.city, y = yr(S);
  for (const r of c.rivals) {
    if (!r.open || r.id === 'charter') continue;
    const x = rnd(S);
    if (x < 0.1) { r.rep = clamp(r.rep + 5, 20, 95); log(S, r.name + ' opens a new building. Their reputation climbs.', 'city'); }
    else if (x < 0.17) { r.rep = clamp(r.rep - 6, 20, 95); log(S, r.name + ' is in the news for the wrong reasons. Their reputation slips.', 'city'); }
    else if (x < 0.24 && S.rep > r.rep) { r.tuition *= 0.95; log(S, r.name + ' freezes tuition to win families back from you.', 'city'); }
  }
  if (!c.charter && y >= 3 && rnd(S) < 0.22) {
    c.charter = true; const home = c.nbs.find((n) => n.type === 'working');
    c.rivals.push({ id: 'charter', name: 'Meridian Charter Academy', nb: home.id, ci: home.ci + 2, cj: home.cj - 2, north: false, tuition: 0, rep: 52, rep0: 52, bias: -1.1, k8: false, open: true, blurb: 'Free, new and oversubscribed. Draws families who would have needed aid.' });
    log(S, 'Meridian Charter Academy opens in ' + home.name + '. It is free, and it is good.', 'city');
  }
  const x = rnd(S);
  if (x < 0.12) { const nb = pick(S, c.nbs.filter((n) => n.tech)); nb.growth += 0.012; nb.incTrend += 0.008; log(S, 'A software company is moving its headquarters to ' + nb.name + '. Young families will follow.', 'city'); }
  else if (x < 0.2) { const nb = pick(S, c.nbs); nb.pq0 = clamp(nb.pq0 + 6, 20, 90); log(S, 'Voters in ' + nb.name + ' pass a school levy. The public schools there will improve.', 'city'); }
  else if (x < 0.28) { const nb = pick(S, c.nbs); nb.pq0 = clamp(nb.pq0 - 6, 20, 90); log(S, 'Budget cuts hit the public schools in ' + nb.name + '. Families are looking around.', 'city'); }
}

/* ---------- one week ---------- */
function tick(S) {
  if (S.over || S.pending.some((p) => p.block)) return false;
  S.week++;
  const w = wk(S), c = S.city;
  if (w === 0) rollYear(S);

  /* economy and markets */
  c.econ = clamp(c.econ * 0.988 + rn(S, 0, 0.03), -1, 1);
  if (!S.flags.recession && yr(S) >= 1 && rnd(S) < 0.0026) { c.econ = clamp(c.econ - 0.85, -1, 1); S.flags.recession = S.week; S.endow *= 0.86; log(S, 'Recession. Layoffs across the city, and the endowment drops 14% in a week.', 'bad'); queueEvent(S, 'recession'); }
  if (S.flags.recession && S.week - S.flags.recession > 200) S.flags.recession = 0;
  S.endow *= 1 + (0.068 + 0.06 * c.econ) / WPY + rn(S, 0, 0.011);

  /* cash */
  const b = budget(S), r = b.rev;
  const fundW = w >= 8 && w < 46 ? r.fund / 38 * (0.55 + 0.9 * rnd(S)) : 0;
  const draw = r.draw / WPY, revW = (r.tuition + r.aid + r.aux) / WPY + draw + fundW, expW = b.expT / WPY;
  S.cash += revW - expW; S.endow -= draw; S.debt = Math.max(0, S.debt - S.debt / 22 / WPY);
  const y = S.ytd; y.rev += revW; y.exp += expW; y.tuition += r.tuition / WPY; y.aid += r.aid / WPY; y.fund += fundW; y.draw += draw; y.aux += r.aux / WPY;

  /* construction, campaign */
  for (const x of S.builds.slice()) {
    if (--x.left <= 0) {
      const B = BUILDINGS[x.t];
      S.builds.splice(S.builds.indexOf(x), 1);
      if (B.replaces) { const k = S.bld.findIndex((q) => q.t === B.replaces); if (k >= 0) S.bld.splice(k, 1); }
      S.bld.push({ t: x.t, cond: 100, slot: x.slot });
      addMod(S, 'sat', 2.5, 48, 'New ' + B.name);
      if (B.sig) addMod(S, 'apps', 10, 96, 'New ' + B.name);
      log(S, 'The ' + B.name + ' opens. Ribbon cut, photos taken.', 'good', 'ribbon');
    }
  }
  if (S.campaign) {
    const k = S.campaign, t0 = 1 - k.left / k.total; k.left--;
    const t1 = 1 - k.left / k.total, sm = (t) => t * t * (3 - 2 * t), d = k.final * (sm(t1) - sm(t0)) * (1 + modSum(S, 'giving') / 200);
    k.raised += d; S.campaignFund += d; oneoff(S, -k.goal * 0.05 / k.total);
    if (k.left <= 0) {
      const ok = k.raised >= k.goal * 0.98;
      if (ok) { S.flags.campOver = true; S.board = clamp(S.board + 7, 0, 100); addMod(S, 'rep', 2, 96, 'Successful campaign'); log(S, 'The campaign closes at ' + money(k.raised) + ', over its ' + money(k.goal) + ' goal.', 'good', 'ribbon'); }
      else { const short = k.raised < k.goal * 0.8; S.board = clamp(S.board - (short ? 8 : 3), 0, 100); log(S, 'The campaign closes at ' + money(k.raised) + ', short of its ' + money(k.goal) + ' goal.', 'bad'); }
      S.campaign = null; S.lastCampaignEnd = S.week;
    }
  }

  /* slow-moving feelings */
  S.morale += (termSum(moraleTerms(S)) - S.morale) * 0.05;
  S.sat += (termSum(satTerms(S)) - S.sat) * 0.05;
  S.rep += (termSum(repTerms(S)) - S.rep) * 0.012;
  for (const m of S.mods) m.w--;
  S.mods = S.mods.filter((m) => m.w > 0);
  const dc = (-4 + (S.maint / 0.015) * 4) / WPY;
  const wear = pSum(S, 'wear') / WPY;
  for (const q of S.bld) q.cond = clamp(q.cond + dc - (S.prog.aux >= 4 ? 0.01 : 0) - wear, 5, 100);
  for (const a of TIME_AREAS) S.timeE[a.id] += (timeCurve(S.time[a.id]) - S.timeE[a.id]) * 0.07;
  S.board = clamp(S.board + 0.012 * te(S, 'board'), 0, 100);
  c.nbs.forEach((nb, n) => (nb.aware += (awareTarget(S, n) - nb.aware) * 0.03));
  if (S.drawRate > 0.055) S.board = clamp(S.board - (S.drawRate - 0.055) * 8, 0, 100);

  /* admissions season: applications arrive September through January */
  if (w >= 8 && w < 30) {
    S.adm.stage = 1;
    for (let n = 0; n < c.nbs.length; n++) for (let d = 0; d < 3; d++) { const a = appsRate(S, n, d); S.adm.acc[n][d][0] += a[0] / 22; S.adm.acc[n][d][1] += a[1] / 22; }
  }

  /* fixed moments */
  if (w === 6) openingDay(S);
  else if (w === 8) log(S, 'Admission season opens. Inquiries will arrive through January.', 'info');
  else if (w === 26) S.pending.push({ type: 'budget', block: true });
  else if (w === 30) { buildPool(S); log(S, 'The application deadline passes: ' + S.adm.apps + ' applications.', S.adm.apps >= S.lastApps ? 'good' : 'info'); }
  else if (w === 32) doRetention(S);
  else if (w === 34) S.pending.push({ type: 'admit', block: true });
  else if (w === 38) { resolveAdmissions(S); facultySeason(S); }
  else if (w === 45) graduation(S);
  else if (w === 47) yearEnd(S);

  /* dilemmas */
  if (![5, 6, 25, 26, 33, 34, 37, 38, 46, 47].includes(w) && !S.pending.length) {
    const due = S.follow.findIndex((f) => S.week >= f.at);
    if (due >= 0) queueEvent(S, S.follow.splice(due, 1)[0].id);
    else if (S.week >= S.nextEvent) {
      const ev = pickEvent(S);
      if (ev) queueEvent(S, ev.id);
      S.nextEvent = S.week + ri(S, 7, 11);
    }
  }

  /* trouble */
  if (S.cash < 0) {
    if (!S.flags.red) { S.flags.red = true; log(S, 'The operating account is overdrawn. You are living on the credit line.', 'bad'); S.board = clamp(S.board - 2, 0, 100); }
    S.board = clamp(S.board - 0.08, 0, 100);
    if (S.cash < -creditLine(S)) {
      if (!S.flags.bailout) { S.flags.bailout = true; const need = -S.cash + 0.02 * b.expT; S.cash += need; S.board = clamp(S.board - 12, 0, 100); log(S, 'The credit line is exhausted. Trustees write personal checks for ' + money(need) + ' to make payroll. They will not do it twice.', 'bad'); }
      else endGame(S, 'insolvent');
    }
  } else S.flags.red = false;
  if (S.board <= 10) endGame(S, 'fired');
  if (students(S) < 110) endGame(S, 'closed');

  if (w % 4 === 0) {
    checkBanners(S);
    const h = S.hist; h.students.push(students(S)); h.cash.push(S.cash); h.endow.push(S.endow); h.rep.push(S.rep); h.sat.push(S.sat); h.morale.push(S.morale); h.board.push(S.board); h.eq.push(EQavg(S));
    for (const k in h) if (h[k].length > 240) h[k].shift();
  }
  return true;
}

/* ---------- guidance and scoring ---------- */
function alerts(S) {
  const a = [], add = (sev, text, tab) => a.push({ sev, text, tab });
  const pn = projNet(S), b = budget(S), w = wk(S);
  if (S.cash < 0) add(2, 'The school is overdrawn by ' + money(-S.cash) + '. Trustees will step in once, then the doors close.', 'money');
  else if (cashMonths(S) < 1) add(2, 'Less than one month of cash on hand.', 'money');
  if (pn < -0.02 * b.revT) add(pn < -0.05 * b.revT ? 2 : 1, 'This year is heading for a ' + money(-pn) + ' deficit.', 'money');
  for (let d = 0; d < 3; d++) {
    const r = ratio(S, d), fill = divStudents(S, d) / capacity(S, d);
    if (r > 11) add(r > 13 ? 2 : 1, DIV_NAMES[d] + ' School has ' + r.toFixed(1) + ' students per teacher. Quality and morale are suffering.', 'people');
    else if (r < 6.5) add(0, DIV_NAMES[d] + ' School is richly staffed at ' + r.toFixed(1) + ' students per teacher.', 'people');
    if (fill > 0.96) add(1, DIV_NAMES[d] + ' School is ' + pct(fill) + ' full. New applicants will be wait-listed.', 'campus');
  }
  if (S.salaryIdx < 0.93) add(S.salaryIdx < 0.88 ? 2 : 1, 'Faculty pay is ' + Math.round((1 - S.salaryIdx) * 100) + '% under market. Your best teachers are taking calls.', 'people');
  if (S.morale < 40) add(2, 'Faculty morale is low (' + Math.round(S.morale) + ').', 'people');
  if (S.sat < 45) add(2, 'Families are unhappy (' + Math.round(S.sat) + '). Expect departures at re-enrollment.', 'program');
  if (avgCond(S) < 50) add(avgCond(S) < 40 ? 2 : 1, 'The campus is wearing out (condition ' + Math.round(avgCond(S)) + ').', 'campus');
  else if (S.maint < 0.0145) add(0, 'Maintenance spending is below what it takes to hold the campus steady.', 'campus');
  for (const r of ROLES) if (!S.team[r.id]) add(1, 'No ' + r.title + '. You are covering the job yourself.', 'people');
  if (S.drawRate > 0.055) add(1, 'The endowment draw is above 5.5%. The board sees it as spending the future.', 'giving');
  if (S.board < 40) add(2, 'Board confidence is low (' + Math.round(S.board) + '). Your contract is at risk.', 'desk');
  if (!S.campaign && !canCampaign(S) && S.team.advancement && yr(S) >= 1) add(0, 'Donors are rested. A capital campaign is possible.', 'giving');
  if (S.campaignFund > 500000) add(0, money(S.campaignFund) + ' of campaign money is waiting to be used.', 'campus');
  if (w >= 8 && w < 30 && S.marketing < 60000 * S.costIdx) add(0, 'Admission season is open and marketing is nearly dark.', 'admissions');
  if (timeFree(S) > 0) add(0, timeFree(S) + (timeFree(S) === 1 ? ' day' : ' days') + ' a month on your calendar ' + (timeFree(S) === 1 ? 'is' : 'are') + ' unassigned.', 'desk');
  for (const a of TIME_AREAS) if (S.time[a.id] === 0) add(1, 'You are spending no time ' + a.name.toLowerCase() + '. People notice an absent head.', 'desk');
  a.sort((x, y) => y.sev - x.sev);
  return a;
}
function legacy(S) {
  const s0 = S.start, worth = (S.cash + S.endow + S.campaignFund - S.debt) / S.costIdx;
  const reach = S.nbE.filter((v) => v / Math.max(1, students(S)) >= 0.05).length;
  const parts = [
    ['Enrollment', 150, clamp((students(S) / s0.students - 0.8) / 0.9, 0, 1)],
    ['Financial strength', 200, clamp((worth - s0.worth + 3e6) / 25e6, 0, 1)],
    ['Reputation', 200, clamp((S.rep - 35) / 55, 0, 1)],
    ['Teaching', 150, clamp((EQavg(S) - 45) / 45, 0, 1)],
    ['Faculty', 100, clamp(((S.morale + S.fq) / 2 - 45) / 45, 0, 1)],
    ['Access', 100, clamp(aidShare(S) / 0.4, 0, 1) * 0.6 + reach / 9 * 0.4],
    ['Campus', 100, clamp((avgCond(S) - 40) / 50, 0, 1) * 0.5 + sigCount(S) / 4 * 0.5],
  ].map((p) => ({ name: p[0], max: p[1], pts: Math.round(p[1] * p[2]), frac: p[2] }));
  const total = sum(parts.map((p) => p.pts));
  const f0 = (S.start && S.start.fracs) || {};
  const top = parts.slice().sort((a, b) => (b.frac - (f0[b.name] || 0)) - (a.frac - (f0[a.name] || 0)))[0].name;
  const titles = { Enrollment: 'The Grower', 'Financial strength': 'The Steward', Reputation: 'The Standard-Bearer', Teaching: 'The Teacher’s Head', Faculty: 'The Faculty’s Champion', Access: 'The Door-Opener', Campus: 'The Builder' };
  return { parts, total, title: titles[top] };
}
