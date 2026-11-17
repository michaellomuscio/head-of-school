const G = require('../dist/sim.cjs');
for (const seed of [7, 21, 44]) {
  const S = G.newGame({ seed, name: 'T', colors: ['#1f4e8c', '#e3ac2f'], emblem: 'book', motto: 'x', mission: 'prep', scenario: 'turnaround' });
  let p12 = 0, p30 = 0, b12 = 0; const out = [];
  while (S.week < 6 * 48 && !S.over) {
    for (const p of S.pending.slice()) {
      if (p.type === 'budget') G.commitBudget(S, Math.round((S.infl * 100 + 1.5) * 2) / 2, Math.round((S.infl * 100 + 0.5) * 2) / 2);
      else if (p.type === 'admit') G.commitAdmissions(S, G.defaultAdmit(S), Math.min(G.maxAid(S), G.defaultAid(S)));
      else if (p.type === 'review') { out.push(`Y${S.review.y + 1}: stud ${G.students(S)} proj@Oct ${G.money(p12)} budget@Oct ${G.money(b12)} proj@Feb ${G.money(p30)} actual ${G.money(S.review.net)} oneoff ${G.money(S.ytd.oneoff)} board ${S.board.toFixed(0)}`); G.ackReview(S, false); }
      else if (p.type === 'event') G.resolveEvent(S, p.id, 0);
      else G.clearPending(S, p.type);
    }
    G.tick(S);
    if (G.wk(S) === 12) { p12 = G.projNet(S); b12 = G.budget(S).net; } if (G.wk(S) === 30) p30 = G.projNet(S);
  }
  console.log('seed', seed, S.over ? S.over.why : ''); console.log(out.join('\n'));
}
