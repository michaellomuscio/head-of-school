const G = require('../dist/sim.cjs');
const S = G.newGame({ seed: +(process.argv[2] || 7), name: 'T', colors: ['#1f4e8c', '#e3ac2f'], emblem: 'book', motto: 'x', mission: 'prep', scenario: process.argv[3] || 'turnaround' });
let tot = [0, 0];
S.city.nbs.forEach((nb, n) => {
  let fp = 0, aid = 0; for (let d = 0; d < 3; d++) { const a = G.appsRate(S, n, d); fp += a[0]; aid += a[1]; }
  const c = G.nbCalc(S, n, 0);
  tot[0] += fp; tot[1] += aid;
  console.log(nb.name.padEnd(20), 'kids', nb.kids, 'inc', nb.inc, 'dist', nb.dist.toFixed(1), 'aware', nb.aware.toFixed(2), 'share', c.share.toFixed(3), 'priv', c.priv.toFixed(2), 'pub', c.pub.toFixed(2), 'fp', fp.toFixed(1), 'aid', aid.toFixed(1), 'enr', S.nbE[n].toFixed(0));
});
console.log('total fp', tot[0].toFixed(0), 'aid', tot[1].toFixed(0));
const b = G.budget(S); console.log(b.rev, b.exp, G.money(b.net));
