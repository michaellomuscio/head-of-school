/* Smoke test: every choice of every dilemma resolves without throwing or producing NaN, in an early and a late game state.
   Also plays each pillar and checks the banner tests run. node test/events.js */
const G = require('../dist/sim.cjs');
const { run } = require('./sim.js');
const bad = (S) => ['cash', 'endow', 'rep', 'sat', 'morale', 'fq', 'board', 'debt', 'campaignFund'].find((k) => !isFinite(S[k]));
let n = 0, fail = 0;
for (const years of [1, 5]) for (const e of G.EVENTS) for (let c = 0; c < e.choices.length; c++) for (const seed of [3, 11]) {
  const S = run('smart', years, seed, 'turnaround', 'prep', true);
  if (S.over) continue;
  S.pending = [];
  if (e.id === 'dinner' && !S.campaign) G.startCampaign(S, 'modest') || (S.campaign = { goal: 1e6, final: 1e6, total: 96, left: 50, raised: 0, tier: 'modest' });
  try {
    const text = e.text(S); S.pending.push({ type: 'event', id: e.id, block: true });
    const out = G.resolveEvent(S, e.id, c);
    if (typeof text !== 'string' || !text || typeof out !== 'string' || !out) throw new Error('empty text');
    for (let w = 0; w < 60; w++) { S.pending = S.pending.filter((p) => p.type === 'over'); G.tick(S); }
    const b = bad(S); if (b) throw new Error('NaN in ' + b);
    n++;
  } catch (err) { fail++; console.log('FAIL', e.id, 'choice', c, 'years', years, err.message); }
}
for (const p of G.PILLARS) {
  const S = run('idle', 1, 5, 'steady', 'prep', true); S.pending = [];
  G.commitPlan(S, p.id);
  for (let w = 0; w < 100 && !S.over; w++) { for (const q of S.pending.slice()) { if (q.type === 'budget') G.commitBudget(S, 9, 3); else if (q.type === 'admit') G.commitAdmissions(S, G.defaultAdmit(S), G.defaultAid(S)); else if (q.type === 'review') G.ackReview(S, false); else if (q.type === 'event') G.resolveEvent(S, q.id, 0); else if (q.type === 'plan') G.commitPlan(S, q.opts[0]); else G.clearPending(S, q.type); } G.tick(S); }
  const b = bad(S); if (b || !S.plan.includes(p.id)) { fail++; console.log('FAIL pillar', p.id, b); } else n++;
  if (p.id === 'promise' && S.lastTuitionPct > G.maxTuition(S) + 2) { fail++; console.log('FAIL promise cap', S.lastTuitionPct); }
}
console.log(n + ' checks passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
