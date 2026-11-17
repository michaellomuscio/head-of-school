/* Concatenates src/*.js into the page. Writes the publishable fragment, a full document for local play, and a Node module of the sim for tests. */
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, 'src'), dist = path.join(__dirname, 'dist');
const files = fs.readdirSync(src).filter((f) => f.endsWith('.js')).sort();
const read = (f) => fs.readFileSync(path.join(src, f), 'utf8');
fs.mkdirSync(dist, { recursive: true });
const simFiles = files.filter((f) => /^(0|1|2|3)\d-/.test(f));
fs.writeFileSync(path.join(dist, 'sim.cjs'), simFiles.map(read).join('\n') +
  '\nmodule.exports = { newGame, tick, budget, students, divStudents, capacity, EQavg, EQ, commitBudget, commitAdmissions, planAdmissions, defaultAdmit, defaultAid, maxAid, ackReview, resolveEvent, clearPending, setFac, setProg, canProg, hire, startBuild, canBuild, startCampaign, canCampaign, campaignCapacity, toggleBus, toggleFocus, projNet, projectNext, ratio, avgCond, discountRate, aidShare, legacy, alerts, yr, wk, sk, has, sum, money, pct, EVENT_BY, ROLES, PROGRAMS, BUILDINGS, DIV_GRADES, profileAvg, fundAnnual, borrowLimit, buildCost, freeSlots, appsRate, nbCalc, satTerms, moraleTerms, repTerms, eqTerms, renovate, renovCost, cashMonths, moveToEndow, payDebt, K, WPY, minRaise, nbMarket, yearLabel, creditLine, commitPlan, setTime, timeFree, PILLARS, PILLAR_BY, BANNERS, bannerCount, checkBanners, pSum, maxTuition, TIME_AREAS, busCost, EVENTS, te, later };\n');
if (fs.existsSync(path.join(src, 'page.html'))) {
  /* Files numbered 90 and up are local test helpers: they go into dist/index.html only. */
  const fill = (list) => read('page.html').replace('/*__JS__*/', () => list.map(read).join('\n'));
  const page = fill(files.filter((f) => !/^9\d-/.test(f))), devPage = fill(files);
  fs.writeFileSync(path.join(dist, 'head-of-school.html'), page);
  const shell = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px);box-sizing:border-box}body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>\n';
  fs.writeFileSync(path.join(dist, 'index.html'), shell + devPage + '\n</body></html>\n');
  /* The public page (GitHub Pages serves docs/): the same game with a real document head. */
  const SITE = 'https://michaellomuscio.github.io/head-of-school/';
  const DESC = 'Run an independent school in a living city. Fill the seats, keep the faculty, balance the books, and try to leave it better than you found it. A management sim that plays in your browser.';
  const ICON = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 46"><path d="M4 3h32v19c0 11-7.5 18-16 21C11.500 40 4 33 4 22z" fill="#1f4e8c"/><path d="M4 3h32v10H4z" fill="#e3ac2f"/><path fill="#fff" d="M20 21c-3-2-6.500-2.300-9.500-2v11c3-.3 6.500 0 9.500 2 3-2 6.500-2.300 9.500-2V19c-3-.3-6.500 0-9.500 2z"/></svg>');
  const cut = page.indexOf('<div class="app"'), docs = path.join(__dirname, 'docs');
  const pub = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' +
    '<meta name="description" content="' + DESC + '">\n<meta name="theme-color" content="#15181e">\n<meta name="hos:url" content="' + SITE + '">\n' +
    '<meta property="og:type" content="website">\n<meta property="og:title" content="Head of School">\n<meta property="og:description" content="' + DESC + '">\n<meta property="og:url" content="' + SITE + '">\n<meta property="og:image" content="' + SITE + 'og.png">\n<meta name="twitter:card" content="summary_large_image">\n' +
    '<link rel="icon" href="' + ICON + '">\n<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
    '<style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px);box-sizing:border-box}body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style>\n' +
    page.slice(0, cut).replace(/<meta name="claude:[^>]*>\n?/, '') + '</head>\n<body>\n' + page.slice(cut) + '\n</body>\n</html>\n';
  fs.mkdirSync(docs, { recursive: true });
  fs.writeFileSync(path.join(docs, 'index.html'), pub);
  fs.writeFileSync(path.join(docs, '.nojekyll'), '');
  console.log('built page', (page.length / 1024).toFixed(1) + ' KB');
}
console.log('built sim');
