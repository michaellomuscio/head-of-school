/* The name generator: every seed gives a clean school name and a city of distinct competitors. node test/names.js [samples] */
const G = require('../dist/sim.cjs');
const N = 20000, names = new Set(), stems = new Set(); let fail = 0;
const bad = (s, why) => { fail++; if (fail < 12) console.log('FAIL', why, JSON.stringify(s)); };
for (let seed = 1; seed <= N; seed++) {
  const stem = G.nameStem(seed * 7919, 1), name = G.schoolName(seed * 7919);
  stems.add(stem); names.add(name);
  if (!/^[A-Z][a-z]+$/.test(stem) || /(.)\1\1/.test(stem) || stem.length < 5 || stem.length > 14) bad(stem, 'stem');
  if (!name || /undefined|\{|\}/.test(name) || name.length > 30) bad(name, 'name');
}
const kinds = {}; let cities = 0, longest = '';
for (let seed = 1; seed <= 3000; seed++) {
  const S = G.newGame({ seed: seed * 104729, name: G.schoolName(seed * 104729), colors: ['#1f4e8c', '#e3ac2f'], emblem: 'book', motto: 'x', mission: 'prep', scenario: 'turnaround' });
  const charter = G.rivalName(S.seed, 7, 'charter', [S.name.toLowerCase()].concat(S.city.rivals.map((r) => r.name.toLowerCase())))[0];
  const all = S.city.rivals.map((r) => r.name).concat([charter]); cities++;
  all.forEach((n, k) => { (kinds[k] = kinds[k] || new Set()).add(n); if (n.length > longest.length) longest = n; if (!n || /undefined|\{|\}/.test(n) || n.length > 32) bad(n, 'rival'); });
  if (new Set(all.concat([S.name])).size !== all.length + 1) bad(all.concat([S.name]), 'duplicate in a city');
  const word = S.name.replace(/^The /, '').split(' ')[0].toLowerCase();
  if (all.some((n) => n.toLowerCase().indexOf(word) >= 0)) bad([S.name].concat(all), 'competitor shares the player\'s stem');
}
console.log(stems.size + ' distinct stems and ' + names.size + ' distinct school names from ' + N + ' seeds');
console.log('competitor names seen across ' + cities + ' cities: elite ' + kinds[0].size + ', progressive ' + kinds[1].size + ', parish ' + kinds[2].size + ', charter ' + kinds[3].size + '; longest "' + longest + '"');
const show = +(process.argv[2] || 12);
for (let k = 0; k < show; k++) { const seed = 1000003 * (k + 1), S = G.newGame({ seed, name: G.schoolName(seed), colors: ['#1f4e8c', '#e3ac2f'], emblem: 'book', motto: 'x', mission: 'prep', scenario: 'turnaround' }); console.log('  ' + S.name.padEnd(28) + '| ' + S.city.rivals.map((r) => r.name).join(' · ')); }
console.log(fail ? fail + ' failed' : 'all name checks passed');
process.exit(fail ? 1 : 0);
