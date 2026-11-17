/* Headless balance runs. node test/sim.js <policy> <years> <seed> [scenario] [mission] */
const G = require('../dist/sim.cjs');
const [policyName = 'idle', years = '10', seed = '7', scenario = 'turnaround', missionId = 'prep', quiet] = process.argv.slice(2);

const POLICY = {
  idle: {
    budget: (S) => [Math.round((S.infl * 100 + 1.5) * 2) / 2, Math.round((S.infl * 100 + 1) * 2) / 2], admit: (S) => [G.defaultAdmit(S), G.defaultAid(S)], event: () => 0, weekly: () => {},
  },
  greedy: {
    budget: () => [9, 0], admit: (S) => [G.defaultAdmit(S).map((x) => x + 50), 0], event: (S, e) => e.choices.length - 1,
    weekly: (S) => { S.maint = 0; S.marketing = 0; S.pd = 0; if (G.wk(S) === 1) for (let d = 0; d < 3; d++) while (G.ratio(S, d) < 12.5 && S.fac[d] > 3) G.setFac(S, d, -1); },
  },
  crisis: {
    budget: (S) => { const i = S.infl * 100; return [Math.round((i + 2.5) * 2) / 2, Math.round(Math.max(0, i - 0.5 + (G.projNet(S) > 200000 ? 2 : 0)) * 2) / 2]; },
    admit: (S) => [G.defaultAdmit(S), G.defaultAid(S) * 0.85], event: (S, e) => POLICY.smart.event(S, e),
    weekly: (S) => {
      const w = G.wk(S); if (w !== 1 && w !== 20) return;
      const net = G.budget(S).net;
      if (S.prog.aux < 3) G.setProg(S, 'aux', 3);
      for (let d = 0; d < 3; d++) { while (G.ratio(S, d) < 9.6 && S.fac[d] > 3) G.setFac(S, d, -1); while (G.ratio(S, d) > 10.6) G.setFac(S, d, 1); }
      S.drawRate = net < 0 ? 0.055 : 0.045; S.maint = net < 100000 ? 0.007 : 0.015; S.marketing = 150000 * S.costIdx;
      if (!S.team.admissions) G.hire(S, 'admissions', 0);
      if (net > 150000) for (const r of ['advancement', 'students', 'academic']) if (!S.team[r] && G.budget(S).net > 150000) G.hire(S, r, 0);
    },
  },
  smart: {
    budget: (S) => { const i = S.infl * 100; const net = G.projNet(S); return [Math.round((i + (S.sat > 60 ? 2.5 : 1.5)) * 2) / 2, Math.round((i + (S.salaryIdx < 1 ? (net > 100000 ? 2.5 : 0.5) : 0.5)) * 2) / 2]; },
    admit: (S) => { const a = G.defaultAdmit(S); const aid = Math.min(G.maxAid(S), G.defaultAid(S) * 1.1); return [a, aid]; },
    event: (S, e) => { let best = 0, bv = -1e9; e.choices.forEach((c, i) => { let v = 0; const fx = c.fx || {}; for (const k in fx) { const x = Array.isArray(fx[k]) ? fx[k][0] : fx[k]; v += k === 'cash' || k === 'endow' || k === 'campaign' ? x / 40000 : x; } if (c.risk) v -= 2; if (v > bv) { bv = v; best = i; } }); return best; },
    weekly: (S) => {
      const w = G.wk(S);
      if (w !== 1 && w !== 20) return;
      const net = () => G.budget(S).net, room = (x) => net() > x && S.cash > 250000;
      for (let d = 0; d < 3; d++) { while (G.ratio(S, d) > 9.6) G.setFac(S, d, 1); while (G.ratio(S, d) < 8.6 && S.fac[d] > 3) G.setFac(S, d, -1); }
      S.marketing = Math.max(S.marketing, 170000 * S.costIdx);
      const want = ['admissions', 'advancement', 'students', 'business', 'academic'];
      for (const r of want) { const c = S.cands[r][0]; if (!c) continue; if (!S.team[r] && (r === 'admissions' || r === 'advancement' || room(-150000))) G.hire(S, r, 0); else if (S.team[r] && c.skill > S.team[r].skill + 1 && room(0)) G.hire(S, r, 0); }
      if (room(60000)) S.maint = Math.max(S.maint, 0.015);
      if (room(60000)) S.pd = Math.max(S.pd, 2);
      if (room(120000) && !S.bus.length) G.toggleBus(S, 4);
      if (room(200000)) { const order = ['acad', 'coll', 'well', 'stem', 'arts', 'ath', 'aux']; for (const k of order) { if (S.prog[k] < 5 && G.canProg(S, k, S.prog[k] + 1)) { G.setProg(S, k, S.prog[k] + 1); break; } } }
      if (S.prog.aux < 3 && w === 1) G.setProg(S, 'aux', S.prog.aux + 1);
      if (!G.canCampaign(S) && S.team.advancement && G.yr(S) >= 1) G.startCampaign(S, 'modest');
      for (const t of ['library', 'science', 'wingU', 'wingL', 'wingM', 'arts', 'fieldhouse', 'dining']) {
        if (G.canBuild(S, t)) continue;
        if ((t === 'wingU' && G.divStudents(S, 2) / G.capacity(S, 2) < 0.93) || (t === 'wingL' && G.divStudents(S, 0) / G.capacity(S, 0) < 0.93) || (t === 'wingM' && G.divStudents(S, 1) / G.capacity(S, 1) < 0.93)) continue;
        const cost = G.buildCost(S, t);
        if (S.campaignFund + Math.max(0, S.cash - 1.5e6) >= cost) { G.startBuild(S, t, 'cash'); break; }
        if (S.campaignFund >= cost * 0.5 && G.borrowLimit(S) >= cost - S.campaignFund && net() > 300000) { G.startBuild(S, t, 'debt'); break; }
      }
    },
  },
};

function run(policyName, years, seed, scenario, missionId, quiet) {
  const P = POLICY[policyName];
  const S = G.newGame({ seed, name: 'Test School', colors: ['#1f4e8c', '#e3ac2f'], emblem: 'book', motto: 'x', mission: missionId, scenario });
  const b0 = G.budget(S);
  if (!quiet) console.log(`start: students ${G.students(S)} rev ${G.money(b0.revT)} exp ${G.money(b0.expT)} net ${G.money(b0.net)} fund ${G.money(b0.rev.fund)} discount ${G.pct(G.discountRate(S))} EQ ${G.EQavg(S).toFixed(1)}`);
  if (!quiet) console.log('yr  stud  apps adm% yld% ret%   net      cash    endow   debt  rep sat mor  fq  eq brd  T(avg) disc pay  leg');
  let guard = 0;
  while (S.week < years * G.WPY && !S.over && guard++ < 100000) {
    for (const p of S.pending.slice()) {
      if (p.type === 'budget') { const [t, r] = P.budget(S); G.commitBudget(S, t, r); }
      else if (p.type === 'admit') { const [a, aid] = P.admit(S); G.commitAdmissions(S, a, aid); }
      else if (p.type === 'review') { if (!quiet) { const y = S.years[S.years.length - 1]; console.log(`${String(y.y + 1).padStart(2)} ${String(y.students).padStart(5)} ${String(y.apps).padStart(5)} ${(S.lastAdmitRate * 100).toFixed(0).padStart(4)} ${(y.yield * 100).toFixed(0).padStart(4)} ${(y.retention * 100).toFixed(0).padStart(4)} ${G.money(y.net).padStart(7)} ${G.money(y.cash).padStart(8)} ${G.money(y.endow).padStart(8)} ${G.money(y.debt).padStart(6)} ${y.rep.toFixed(0).padStart(4)} ${y.sat.toFixed(0).padStart(3)} ${y.morale.toFixed(0).padStart(3)} ${y.fq.toFixed(0).padStart(3)} ${y.eq.toFixed(0).padStart(3)} ${y.board.toFixed(0).padStart(3)} ${G.money(y.tuition).padStart(6)} ${(y.discount * 100).toFixed(0).padStart(4)} ${(S.salaryIdx * 100).toFixed(0).padStart(4)} ${String(y.legacy).padStart(4)}  ${S.review.areas.map((a) => a.grade).join(' ')} ${S.review.verdict || ''}`); } G.ackReview(S, false); }
      else if (p.type === 'event') { const e = G.EVENT_BY[p.id]; G.resolveEvent(S, p.id, P.event(S, e)); }
      else if (p.type === 'over') break;
      else G.clearPending(S, p.type);
    }
    if (S.over) break;
    P.weekly(S);
    G.tick(S);
    for (const k of ['cash', 'endow', 'rep', 'sat', 'morale', 'fq', 'board']) if (!isFinite(S[k])) throw new Error('NaN in ' + k + ' at week ' + S.week);
  }
  if (!quiet) console.log(S.over ? `OVER: ${S.over.why} in year ${G.yr(S) + 1}, legacy ${S.over.legacy.total} (${S.over.legacy.title})` : `survived ${years} years, legacy ${G.legacy(S).total} (${G.legacy(S).title}) buildings: ${S.bld.map((b) => b.t).join(',')}`);
  return S;
}
if (require.main === module) {
  if (policyName === 'matrix') {
    for (const sc of ['turnaround', 'steady', 'brink']) for (const pol of ['idle', 'smart', 'crisis', 'greedy']) {
      const res = [];
      for (let s = 1; s <= 8; s++) { const S = run(pol, +years, s * 31, sc, missionId, true); res.push(S.over ? S.over.why[0].toUpperCase() + (G.yr(S) + 1) : String(G.legacy(S).total)); }
      console.log(sc.padEnd(11), pol.padEnd(7), res.join('  '));
    }
  } else run(policyName, +years, +seed, scenario, missionId, quiet);
}
module.exports = { run };
