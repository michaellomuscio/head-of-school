/* Boot, the game loop, input, saving and sound. */
const SAVE_KEY = 'hos-save-1';
function save() { try { if (App.S && !App.setup) localStorage.setItem(SAVE_KEY, JSON.stringify(App.S)); } catch (e) { /* storage is optional */ } }
function loadSave() { try { const t = localStorage.getItem(SAVE_KEY); if (!t) return null; const S = JSON.parse(t); return S && S.v === 1 && !S.over && S.grades && S.city ? migrate(S) : null; } catch (e) { return null; } }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* fine */ } }

/* Interface memory (which hints were seen, first-steps progress). Separate from the saved school. */
const UI_KEY = 'hos-ui-1';
function saveUI() { try { localStorage.setItem(UI_KEY, JSON.stringify(App.ui)); } catch (e) { /* optional */ } }
function loadUI() { try { const u = JSON.parse(localStorage.getItem(UI_KEY) || 'null'); if (u && u.seen && u.tour) Object.assign(App.ui, u); } catch (e) { /* optional */ } }
function tourMark(k) { if (App.setup || App.ui.tour[k]) return; App.ui.tour[k] = 1; saveUI(); if (App.tab === 'desk' && !App.modal) renderPanel(); }
const receipt = (text) => toast({ kind: 'info', key: 'receipt', text });

/* Hall of Heads: every finished tenure on this device. Separate from the saved school, and optional like it. */
const HALL_KEY = 'hos-hall-1';
function hallLoad() { try { const h = JSON.parse(localStorage.getItem(HALL_KEY) || '[]'); return Array.isArray(h) ? h.filter((r) => r && r.name && isFinite(r.legacy)) : []; } catch (e) { return []; } }
function recordTenure(S) {
  if (!S.over || S.over.saved) return; S.over.saved = true;
  const h = hallLoad(); h.push({ name: S.name, sc: S.scenario, mission: S.mission, years: tenureYears(S), legacy: S.over.legacy.total, title: S.over.legacy.title, why: S.over.why, banners: bannerCount(S), at: Date.now() });
  h.sort((a, b) => b.legacy - a.legacy);
  try { localStorage.setItem(HALL_KEY, JSON.stringify(h.slice(0, 30))); } catch (e) { /* optional */ }
}
/* The public address of the game, when the page declares one. */
function playUrl() { const m = document.querySelector('meta[name="hos:url"]'); return m ? m.getAttribute('content') : ''; }

let AC = null;
function beep(kind) {
  if (!App.sound) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const t = AC.currentTime, tone1 = (f, d, g, type, at) => { const o = AC.createOscillator(), v = AC.createGain(); o.type = type; o.frequency.value = f; v.gain.setValueAtTime(0.0001, t + at); v.gain.linearRampToValueAtTime(g, t + at + 0.012); v.gain.exponentialRampToValueAtTime(0.0001, t + at + d); o.connect(v); v.connect(AC.destination); o.start(t + at); o.stop(t + at + d + 0.05); };
    if (kind === 'bell') { tone1(659, 1.5, 0.07, 'sine', 0); tone1(1318, 0.9, 0.025, 'sine', 0); tone1(988, 1.1, 0.02, 'sine', 0.02); }
    else if (kind === 'good') { tone1(523, 0.2, 0.045, 'triangle', 0); tone1(784, 0.34, 0.045, 'triangle', 0.11); }
    else if (kind === 'bad') tone1(185, 0.4, 0.05, 'triangle', 0);
    else tone1(740, 0.05, 0.018, 'triangle', 0);
  } catch (e) { /* no audio, no problem */ }
}

/* ---------- theme and school colors ---------- */
function isDark() { const t = document.documentElement.getAttribute('data-theme'); return t ? t === 'dark' : !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); }
const lumOf = (h) => { const c = hexRgb(h); return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; };
function applyTheme() {
  App.dark = isDark(); if (App.map) App.map.night = App.dark;
  const S = App.S; if (!S) return;
  const st = document.documentElement.style, c = S.colors[0];
  let acc = c; if (App.dark && lumOf(c) < 0.5) acc = mixHex(c, '#ffffff', 0.5); else if (!App.dark && lumOf(c) > 0.55) acc = mixHex(c, '#15233b', 0.45);
  st.setProperty('--school', c); st.setProperty('--school2', S.colors[1]); st.setProperty('--accent', acc); st.setProperty('--on-accent', lumOf(acc) > 0.55 ? '#15233b' : '#ffffff');
  $('t-crest').innerHTML = crest(S.colors, S.emblem, 34);
}

/* ---------- setup ---------- */
function randomName(seed) { const st = SCHOOL_STEMS[Math.floor(hash(seed, 1, 3) * SCHOOL_STEMS.length)], f = SCHOOL_FORMS[Math.floor(hash(seed, 2, 3) * SCHOOL_FORMS.length)]; return f.replace('{}', st); }
function previewGame() {
  const s = App.setup;
  App.S = newGame({ seed: s.seed, name: s.name || 'Your School', colors: s.colors, emblem: s.emblem, motto: s.motto, mission: s.mission, scenario: s.scenario });
  App.map.setState(App.S); applyTheme(); renderAll();
}
function openSetup() {
  const seed = (Date.now() % 2147483000) | 1, k = Math.floor(hash(seed, 9, 9) * SCHOOL_COLORS.length);
  App.setup = { seed, name: randomName(seed), colors: SCHOOL_COLORS[k], emblem: EMBLEMS[Math.floor(hash(seed, 8, 9) * EMBLEMS.length)], motto: MOTTOS[Math.floor(hash(seed, 7, 9) * MOTTOS.length)], mission: 'prep', scenario: 'turnaround' };
  App.speed = 0; App.card = null; App.tab = 'desk'; App.map.userMoved = false; App.map.overlay = 'none';
  previewGame(); App.map.resize();
  showModal('setup', null, { wide: true });
}
function startGame(S) {
  App.setup = null; App.S = S; App.speed = 0; App.acc = 0; App.card = null; App.tab = 'desk'; App.lastLog = S.log[S.log.length - 1] || null;
  App.map.setState(S); applyTheme(); closeModal(); save(); showPending();
}

/* ---------- actions ---------- */
const SETTERS = {
  marketing: (S, v) => (S.marketing = v * 1000 * S.costIdx),
  maint: (S, v) => (S.maint = v / 1000),
  draw: (S, v) => (S.drawRate = v / 100),
};
const ACT = {
  tab(a) {
    if (App.tab !== a) { App.ui.seen[App.tab] = 1; saveUI(); }
    App.tab = a; document.querySelector('.stage').classList.remove('mapfull'); renderPanel(); $('panel').scrollTop = 0;
    if (a === 'people') tourMark('people'); if (a === 'admissions') tourMark('enroll');
    const sel = $('tabs').querySelector('[aria-selected="true"]'); if (sel && document.activeElement === document.body) sel.focus({ preventScroll: true });
  },
  speed(a) { App.speed = +a; App.acc = 0; if (App.speed) { App.lastSpeed = App.speed; tourMark('play'); } renderTop(); beep('tick'); },
  overlay(a) { App.map.overlay = a; App.map.ovKey = ''; renderTabs(); },
  zoom(a) { App.map.zoomAt(App.map.vw / 2, App.map.vh / 2, +a); },
  center() { App.map.home(); },
  mapfull() { document.querySelector('.stage').classList.toggle('mapfull'); },
  closeCard() { App.card = null; renderCard(); renderMapChrome(); if (App.tab === 'admissions') renderPanel(); },
  nb(a, S) { const nb = S.city.nbs[+a]; App.card = { type: 'nb', id: +a }; App.map.centerOn(nb.ci, nb.cj); App.ui.mapHint = true; saveUI(); tourMark('map'); renderCard(); renderMapChrome(); renderPanel(); },
  focus(a, S) { toggleFocus(S, +a); const nb = S.city.nbs[+a]; receipt(S.focus.includes(+a) ? 'Marketing focus on ' + nb.name + '. Awareness there builds over the coming weeks.' : 'Marketing focus off for ' + nb.name + '.'); renderAll(); },
  bus(a, S) { toggleBus(S, +a); App.map.syncCars(); const nb = S.city.nbs[+a]; receipt(S.bus.includes(+a) ? 'Bus route to ' + nb.name + ' is running: ' + money(85000 * S.costIdx) + ' a year. The drive now counts as half as long.' : 'Bus route to ' + nb.name + ' cancelled. Families there will grumble.'); renderAll(); },
  fac(a, S) {
    const p = a.split(',').map(Number), before = S.fac[p[0]]; setFac(S, p[0], p[1]);
    if (S.fac[p[0]] === before) receipt('A division needs at least two teachers.');
    else receipt(DIV_NAMES[p[0]] + ' School: ' + S.fac[p[0]] + ' teachers, ' + ratio(S, p[0]).toFixed(1) + ' students each. ' + (p[1] > 0 ? 'Adds ' : 'Saves ') + money(S.mktSalary * S.salaryIdx * 1.27) + ' a year.');
    renderAll();
  },
  time(a, S) {
    const p = a.split(','), A = TIME_AREAS.find((x) => x.id === p[0]);
    if (!setTime(S, p[0], +p[1])) receipt(+p[1] > 0 ? 'All ten days are spoken for. Take a day from somewhere else first.' : 'That is already zero.');
    else { tourMark('time'); const d = S.time[p[0]]; receipt(A.name + ': ' + d + (d === 1 ? ' day' : ' days') + ' a month. ' + A.does); }
    renderAll(); save();
  },
  banner(a, S) { const b = BANNERS.find((x) => x.id === a); receipt(b.name + (S.banners[a] != null ? ' (earned ' + bannerYear(S.banners[a]) + '). ' : ': ') + b.how); },
  planPick(a, S) { if (commitPlan(S, a)) { beep('good'); closeModal(); save(); receipt(PILLAR_BY[a].name + ' is in the strategic plan. It appears on the Overview tab.'); showPending(); } },
  hall() { showModal('hall', null, { dismiss: true }); },
  copyRecord(a, S) {
    const el = $('share'), done = () => receipt('Copied.');
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(el.value).then(done, () => { el.select(); receipt('Select the text and copy it.'); }); else { el.select(); if (document.execCommand('copy')) done(); } } catch (e) { el.select(); receipt('Select the text and copy it.'); }
  },
  pd(a, S) { S.pd = clamp(S.pd + +a, 0, 4); receipt('Professional growth: ' + money(S.pd * 900 * S.costIdx) + ' per teacher, ' + money(S.pd * 900 * S.costIdx * sum(S.fac)) + ' a year in all.'); renderAll(); },
  prog(a, S) {
    const p = a.split(','), P = PROGRAM_BY[p[0]], before = S.prog[p[0]];
    if (!setProg(S, p[0], +p[1])) receipt('Levels 4 and 5 of ' + P.name + ' need the ' + BUILDINGS[P.gate].name + '. Build it on the Campus tab.');
    else if (S.prog[p[0]] !== before) receipt(P.name + (S.prog[p[0]] > before ? ' raised to ' : ' cut to ') + LEVEL_WORDS[S.prog[p[0]]] + (S.prog[p[0]] < before && !P.revenue ? '. Families will notice.' : '.'));
    renderAll();
  },
  cands(a) { showModal('cands', a, { dismiss: true }); },
  hire(a, S) { const p = a.split(','); hire(S, p[0], +p[1]); beep('good'); closeModal(); },
  buildOpen(a) { showModal('build', a, { dismiss: true }); },
  build(a, S) { const p = a.split(','); if (startBuild(S, p[0], p[1])) { beep('good'); closeModal(); } },
  renovate(a, S) { if (renovate(S, +a)) beep('good'); renderAll(); },
  campaign(a, S) { if (startCampaign(S, a)) beep('good'); renderAll(); },
  toEndow(a, S) { const v = S.campaignFund; moveToEndow(S, v); receipt(money(v) + ' moved from the building fund to the endowment.'); renderAll(); },
  borrow(a, S) { if (borrowLimit(S) >= 500000) { const r = borrowRate(S); takeDebt(S, 500000); receipt('Borrowed $500k at ' + pct(r, 1) + '. Payments rise about ' + money(500000 * (r + 1 / 22)) + ' a year.'); } renderAll(); },
  repay(a, S) { payDebt(S, 250000); receipt('Repaid $250k of debt.'); renderAll(); },
  menu() { showModal('menu', null, { dismiss: true }); },
  year() { showModal('year', null, { dismiss: true }); },
  nudge(a) { const p = a.split(','), el = $(p[0]); if (!el) return; el.value = clamp(+el.value + (+el.step || 1) * +p[1], +el.min, +el.max); el.dispatchEvent(new Event('input', { bubbles: true })); if (el.dataset.set) el.dispatchEvent(new Event('change', { bubbles: true })); },
  tipOk() { App.ui.seen[App.tab] = 1; saveUI(); renderPanel(); },
  tourOff() { App.ui.tourOff = true; saveUI(); renderPanel(); },
  tourOn() { App.ui.tourOff = false; App.ui.tour = {}; App.ui.mapHint = false; saveUI(); App.tab = 'desk'; closeModal(); },
  tourGo(a) { if (a === 'time') { const b = $('panel').querySelector('[data-act="time"]'); if (b) b.scrollIntoView({ block: 'center' }); receipt('Use \u2212 and + to move your days. All ten are yours to spend.'); } else if (a === 'people') ACT.tab('people'); else if (a === 'enroll') ACT.tab('admissions'); else if (a === 'why') ACT.drivers('sat'); else if (a === 'play') ACT.speed(1); else { App.ui.mapHint = false; renderMapChrome(); receipt('Click any neighborhood name on the map.'); } },
  okGo(a, S) { const p = a.split(','); clearPending(S, p[0]); closeModal(); save(); showPending(); if (!App.modal) ACT.tab(p[1]); },
  drivers(a) { tourMark('why'); showModal('drivers', a, { dismiss: true }); },
  help() { showModal('help', null, { dismiss: true }); },
  closeModal() { closeModal(); showPending(); },
  ok(a, S) { clearPending(S, a); closeModal(); save(); renderTop(); showPending(); },
  evChoice(a, S) { const p = a.split(','), text = resolveEvent(S, p[0], +p[1]); $('ev-body').innerHTML = '<div class="outcome">' + esc(text) + '</div><div class="foot"><button class="btn pri" data-act="closeModal">Continue</button></div>'; renderTop(); save(); },
  budgetOk(a, S) { commitBudget(S, App.m.tp, App.m.rp); closeModal(); save(); showPending(); },
  admitOk(a, S) { commitAdmissions(S, App.m.admit, App.m.aid); closeModal(); save(); showPending(); },
  reviewOk(a, S) { ackReview(S, a === 'retire'); closeModal(); if (S.over) clearSave(); else save(); showPending(); },
  retireAsk() { showModal('confirm', { title: 'Retire now?', text: 'You will step down at once and see your final legacy. This ends the game.', act: 'retireNow', yes: 'Retire' }, { dismiss: true }); },
  retireNow(a, S) { endGame(S, 'retired'); clearSave(); closeModal(); showPending(); },
  newGame() { showModal('confirm', { title: 'Start a new school?', text: 'Your current school will be replaced. This cannot be undone.', act: 'newGameNow', yes: 'Start over' }, { dismiss: true }); },
  newGameNow() { clearSave(); App.modal = null; openSetup(); },
  sound() { App.sound = !App.sound; beep('good'); if (App.modal === 'menu') showModal('menu', null, { dismiss: true }); else renderPanel(); },
  suShuffle() { const s = App.setup; s.name = randomName((Math.random() * 1e9) | 0); App.S.name = s.name; showModal('setup', null, { wide: true }); renderTop(); },
  suColor(a) { App.setup.colors = SCHOOL_COLORS[+a]; App.S.colors = App.setup.colors; applyTheme(); showModal('setup', null, { wide: true }); },
  suEmblem(a) { App.setup.emblem = a; App.S.emblem = a; applyTheme(); showModal('setup', null, { wide: true }); },
  suMission(a) { App.setup.mission = a; keepScroll(() => showModal('setup', null, { wide: true })); },
  suScenario(a) { App.setup.scenario = a; previewGame(); keepScroll(() => showModal('setup', null, { wide: true })); },
  suCity() { App.setup.seed = ((Math.random() * 2147483000) | 1); previewGame(); keepScroll(() => showModal('setup', null, { wide: true })); },
  suBegin() { const s = App.setup; s.name = (s.name || '').trim() || randomName(s.seed); startGame(newGame({ seed: s.seed, name: s.name, colors: s.colors, emblem: s.emblem, motto: s.motto, mission: s.mission, scenario: s.scenario })); beep('bell'); },
  continue() { const S = loadSave(); if (S) startGame(S); },
};
function keepScroll(fn) { const m = $('modal').querySelector('.modal'), y = m ? m.scrollTop : 0; fn(); const n = $('modal').querySelector('.modal'); if (n) n.scrollTop = y; }

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (el) {
    if (el.disabled) return; const f = ACT[el.dataset.act]; if (!f) return;
    const act = el.dataset.act, arg = el.dataset.arg;
    f(arg, App.S, el);
    if (App.S && !App.setup && !App.S.over) consumeLog();
    /* Re-rendering replaces the button that was pressed; hand keyboard focus to its replacement. */
    if (document.activeElement === document.body || !document.contains(document.activeElement)) {
      const again = Array.from(document.querySelectorAll('[data-act="' + act + '"]')).find((x) => x.dataset.arg === arg);
      if (again && !again.disabled) again.focus({ preventScroll: true });
    }
    return;
  }
  if (ev.target.classList && ev.target.classList.contains('scrim') && $('modal').querySelector('.x')) ACT.closeModal();
});
document.addEventListener('input', (ev) => {
  const el = ev.target, S = App.S;
  if (el.id === 'su-name') { App.setup.name = el.value; S.name = el.value || 'Your School'; renderTop(); return; }
  if (el.dataset.set) { SETTERS[el.dataset.set](S, +el.value); refreshLive(); renderTop(); return; }
  if (el.dataset.m) {
    const k = el.dataset.m, v = +el.value;
    if (k.indexOf('admit') === 0) App.m.admit[+k.slice(5)] = v; else App.m[k] = v;
    modalLive(MODALS[App.modal](S, S.pending.find((p) => p.block)));
  }
});
document.addEventListener('change', (ev) => { if (ev.target.dataset && ev.target.dataset.set) { App.dragging = false; renderAll(); save(); } });
document.addEventListener('pointerdown', (ev) => { if (ev.target.type === 'range') App.dragging = true; });
document.addEventListener('pointerup', () => { App.dragging = false; });
document.addEventListener('keydown', (ev) => {
  const t = ev.target, tag = t.tagName || '';
  if (tag === 'INPUT' && t.type === 'text') return;
  if (ev.key === 'Tab' && App.modal) {
    const box = $('modal').querySelector('.modal'), f = Array.from(box.querySelectorAll('button:not(:disabled), input, summary, [href]'));
    if (!f.length) return; const a = document.activeElement, first = f[0], last = f[f.length - 1];
    if (!box.contains(a) || a === box) { ev.preventDefault(); (ev.shiftKey ? last : first).focus(); }
    else if (ev.shiftKey && a === first) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && a === last) { ev.preventDefault(); first.focus(); }
    return;
  }
  if (ev.key === 'Escape') { if (App.modal) { if ($('modal').querySelector('.x')) ACT.closeModal(); } else if (App.card) ACT.closeCard(); return; }
  if (App.modal || App.setup || ev.metaKey || ev.ctrlKey || ev.altKey) return;
  const onControl = tag === 'BUTTON' || tag === 'INPUT' || tag === 'SUMMARY' || tag === 'A', k = ev.key;
  const step = (d) => { const i = TABS.findIndex((x) => x[0] === App.tab); ACT.tab(TABS[(i + d + TABS.length) % TABS.length][0]); };
  if (k === ' ') { if (onControl) return; ev.preventDefault(); ACT.speed(App.speed ? 0 : (App.lastSpeed || 1)); }
  else if (tag === 'INPUT') return;
  else if (k === '1' || k === '2' || k === '3') ACT.speed(+k);
  else if (k === '[' || k === ']') step(k === '[' ? -1 : 1);
  else if ((k === 'ArrowLeft' || k === 'ArrowRight') && t.getAttribute && t.getAttribute('role') === 'tab') { ev.preventDefault(); step(k === 'ArrowLeft' ? -1 : 1); const sel = $('tabs').querySelector('[aria-selected="true"]'); if (sel) sel.focus(); }
  else if (k === '+' || k === '=') ACT.zoom(1.3);
  else if (k === '-' || k === '_') ACT.zoom(0.77);
  else if (k === '0' || k === 'Home') ACT.center();
  else if (t.id === 'map' && k.indexOf('Arrow') === 0) { ev.preventDefault(); App.map.pan(k === 'ArrowLeft' ? -70 : k === 'ArrowRight' ? 70 : 0, k === 'ArrowUp' ? -70 : k === 'ArrowDown' ? 70 : 0); }
});

/* ---------- map input ---------- */
function bindMap(cv) {
  const pts = new Map(); let moved = 0, pinch = 0;
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, pos(e)); moved = 0; if (pts.size === 2) { const a = Array.from(pts.values()); pinch = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); } cv.classList.add('drag'); });
  cv.addEventListener('pointermove', (e) => {
    const p = pos(e), m = App.map;
    if (!pts.has(e.pointerId)) { const h = m.pickAt(p[0], p[1]); m.hover = h && h.type === 'nb' ? h : null; cv.style.cursor = h ? 'pointer' : 'grab'; return; }
    const prev = pts.get(e.pointerId); pts.set(e.pointerId, p);
    if (pts.size === 1) { const dx = p[0] - prev[0], dy = p[1] - prev[1]; moved += Math.abs(dx) + Math.abs(dy); m.cam.x -= dx / m.cam.z; m.cam.y -= dy / m.cam.z; m.userMoved = true; m.clampCam(); }
    else if (pts.size === 2) { const a = Array.from(pts.values()), d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); if (pinch > 0) m.zoomAt((a[0][0] + a[1][0]) / 2, (a[0][1] + a[1][1]) / 2, d / pinch); pinch = d; moved += 10; }
  });
  const up = (e) => {
    if (!pts.has(e.pointerId)) return; const p = pts.get(e.pointerId); pts.delete(e.pointerId); cv.classList.remove('drag');
    if (moved < 10 && pts.size === 0 && !App.setup) {
      const h = App.map.pickAt(p[0], p[1]);
      if (h && !App.ui.mapHint) { App.ui.mapHint = true; saveUI(); }
      if (!h) App.card = null;
      else if (h.type === 'campus') { ACT.tab('campus'); return; }
      else { App.card = h; if (h.type === 'nb') tourMark('map'); }
      renderCard(); renderMapChrome(); if (App.tab === 'admissions') renderPanel();
    }
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', () => { App.map.hover = null; });
  cv.addEventListener('wheel', (e) => { e.preventDefault(); const p = pos(e); App.map.zoomAt(p[0], p[1], Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
}

/* ---------- loop ---------- */
function consumeLog() {
  const S = App.S, i = S.log.lastIndexOf(App.lastLog), fresh = S.log.slice(i + 1);
  for (const l of fresh) {
    if (l.kind === 'good' || l.kind === 'bad' || l.kind === 'city') toast(l);
    if (l.fx) { App.map.burst(l.fx); beep(l.fx === 'opening' ? 'bell' : 'good'); } else if (l.kind === 'bad') beep('bad');
  }
  if (S.log.length) App.lastLog = S.log[S.log.length - 1];
}
function afterTick() {
  const S = App.S; consumeLog(); renderTop();
  if (wk(S) % 4 === 0) {
    save();
    if (App.dragging) refreshLive();
    else { const open = Array.from($('panel').querySelectorAll('details')).map((d) => d.open); renderPanel(); $('panel').querySelectorAll('details').forEach((d, k) => { if (open[k]) d.open = true; }); }
    renderCard();
  } else refreshLive();
  showPending();
}
let lastTs = 0;
function frame(ts) {
  const dt = Math.min(0.1, (ts - lastTs) / 1000 || 0); lastTs = ts;
  const S = App.S;
  if (S && !App.setup && !App.modal && App.speed > 0 && !S.over) {
    App.acc += dt; const per = [0, 1.5, 0.7, 0.28][App.speed]; let n = 0;
    while (App.acc >= per && n < 2) { App.acc -= per; n++; if (!tick(S)) { App.acc = 0; break; } afterTick(); if (S.pending.some((p) => p.block) || S.over) { App.acc = 0; break; } }
  }
  App.map.draw(dt, App.speed > 0 && !App.modal && !App.setup);
  requestAnimationFrame(frame);
}

/* Fast-forwards with default choices. Used by the local test page (?auto=1&ff=60). */
function autoPlay(weeks) {
  const S = App.S; let guard = 0;
  while (weeks > 0 && !S.over && guard++ < 5000) {
    for (const p of S.pending.slice()) {
      if (p.type === 'budget') commitBudget(S, Math.round((S.infl * 100 + 1.5) * 2) / 2, Math.round((S.infl * 100 + 0.5) * 2) / 2);
      else if (p.type === 'admit') commitAdmissions(S, defaultAdmit(S), Math.min(maxAid(S), defaultAid(S)));
      else if (p.type === 'review') ackReview(S, false);
      else if (p.type === 'event') resolveEvent(S, p.id, 0);
      else if (p.type === 'plan') commitPlan(S, p.opts[0]);
      else clearPending(S, p.type);
    }
    if (tick(S)) weeks--;
  }
  App.lastLog = S.log[S.log.length - 1];
}

function boot(data) {
  loadUI();
  const cv = $('map'); App.map = new MapView(cv); bindMap(cv);
  App.dark = isDark(); App.map.night = App.dark;
  if (window.ResizeObserver) new ResizeObserver(() => App.map.resize()).observe(cv.parentNode); else window.addEventListener('resize', () => App.map.resize());
  if (window.matchMedia) { const mq = window.matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', applyTheme); }
  if (window.MutationObserver) new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const q = new URLSearchParams(location.search);
  if (q.get('theme')) { document.documentElement.setAttribute('data-theme', q.get('theme')); App.dark = isDark(); App.map.night = App.dark; }
  if (data && data.S && data.S.v === 1) { App.map.resize(); startGame(migrate(data.S)); }
  else if (q.get('auto')) {
    { const st = document.createElement('style'); st.textContent = '*{animation:none!important}'; document.head.appendChild(st); }
    const seed = +(q.get('seed') || 7);
    App.map.resize();
    startGame(newGame({ seed, name: q.get('name') || 'Hawthorne Academy', colors: SCHOOL_COLORS[+(q.get('col') || 0)], emblem: 'tree', motto: 'Learn by Doing', mission: q.get('mission') || 'prep', scenario: q.get('sc') || 'turnaround' }));
    if (q.get('ff')) { clearPending(App.S, 'intro'); closeModal(); autoPlay(+q.get('ff')); }
    if (q.get('build')) for (const t of q.get('build').split(',')) { App.S.campaignFund += 2e7; startBuild(App.S, t, 'cash'); if (q.get('done')) { App.S.builds.forEach((b) => (b.left = 1)); autoPlay(1); } }
    if (q.get('ev')) queueEvent(App.S, q.get('ev'));
    if (q.get('pillars')) for (const id of q.get('pillars').split(',')) commitPlan(App.S, id);
    if (q.get('plan')) App.S.pending.push({ type: 'plan', block: true, opts: PILLARS.filter((p) => !App.S.plan.includes(p.id)).slice(+q.get('plan') - 1, +q.get('plan') + 2).map((p) => p.id) });
    if (q.get('ban')) BANNERS.slice(0, +q.get('ban')).forEach((b, k) => (App.S.banners[b.id] = App.S.week - k * 30));
    if (q.get('days')) q.get('days').split(',').forEach((d, k) => { App.S.time[TIME_AREAS[k].id] = +d; App.S.timeE[TIME_AREAS[k].id] = timeCurve(+d) * 0.6; });
    if (q.get('over')) endGame(App.S, q.get('over'));
    if (q.get('fresh')) App.ui = { seen: {}, tour: {}, tourOff: false, mapHint: false };
    if (q.get('seen')) { App.ui.tourOff = true; App.ui.mapHint = true; TABS.forEach((t) => (App.ui.seen[t[0]] = 1)); }
    if (q.get('tab')) App.tab = q.get('tab');
    if (q.get('ov')) App.map.overlay = q.get('ov');
    if (q.get('z')) { App.map.cam.z = +q.get('z'); App.map.userMoved = true; }
    if (q.get('nb')) App.card = { type: 'nb', id: +q.get('nb') };
    if (q.get('speed')) App.speed = +q.get('speed');
    renderAll();
    if (q.get('test') && typeof runUiTest === 'function') { runUiTest(); requestAnimationFrame(frame); return; }
    if (q.get('show')) { const k = q.get('show'); if (k === 'help' || k === 'drivers' || k === 'cands' || k === 'build' || k === 'menu' || k === 'year') showModal(k, q.get('arg'), { dismiss: true }); else { App.modal = null; $('modal').innerHTML = ''; showPending(); } }
  } else openSetup();
  if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => ({ S: App.setup ? null : App.S }));
  requestAnimationFrame(frame);
}
if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(boot); else boot((window.claude && window.claude.hot && window.claude.hot.data) || {});
