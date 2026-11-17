/* Concatenates src/*.js into the page. Writes the publishable fragment, a full document for local play, and a Node module of the sim for tests. */
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, 'src'), dist = path.join(__dirname, 'dist');
const files = fs.readdirSync(src).filter((f) => f.endsWith('.js')).sort();
const read = (f) => fs.readFileSync(path.join(src, f), 'utf8');
fs.mkdirSync(dist, { recursive: true });
const simFiles = files.filter((f) => /^(0|1|2|3)\d-/.test(f));
fs.writeFileSync(path.join(dist, 'sim.cjs'), simFiles.map(read).join('\n') +
  '\nmodule.exports = { newGame, tick, budget, students, divStudents, capacity, EQavg, EQ, commitBudget, commitAdmissions, planAdmissions, defaultAdmit, defaultAid, maxAid, ackReview, resolveEvent, clearPending, setFac, setProg, canProg, hire, startBuild, canBuild, startCampaign, canCampaign, campaignCapacity, toggleBus, toggleFocus, projNet, projectNext, ratio, avgCond, discountRate, aidShare, legacy, alerts, yr, wk, sk, has, sum, money, pct, EVENT_BY, ROLES, PROGRAMS, BUILDINGS, DIV_GRADES, profileAvg, fundAnnual, borrowLimit, buildCost, freeSlots, appsRate, nbCalc, satTerms, moraleTerms, repTerms, eqTerms, renovate, renovCost, cashMonths, moveToEndow, payDebt, K, WPY, minRaise, nbMarket, yearLabel, creditLine };\n');
if (fs.existsSync(path.join(src, 'page.html'))) {
  const js = files.map(read).join('\n');
  const page = read('page.html').replace('/*__JS__*/', () => js);
  fs.writeFileSync(path.join(dist, 'head-of-school.html'), page);
  const shell = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px);box-sizing:border-box}body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>\n';
  fs.writeFileSync(path.join(dist, 'index.html'), shell + page + '\n</body></html>\n');
  console.log('built page', (page.length / 1024).toFixed(1) + ' KB');
}
console.log('built sim');
