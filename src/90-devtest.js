/* Local only (left out of the published page): a scripted click-through of every panel and dialog.
   Open dist/index.html?auto=1&test=1 and read the TEST lines in the console. */
function runUiTest() {
  let pass = 0, fail = 0;
  function shut() { App.modal = null; $('modal').innerHTML = ''; }
  function step(name, fn) { try { if (App.modal) shut(); fn(); pass++; } catch (e) { fail++; console.log('TEST FAIL ' + name + ': ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); } }
  function click(sel, root) { const el = (root || document).querySelector(sel); if (!el) throw new Error('missing ' + sel); el.click(); return el; }
  function need(cond, msg) { if (!cond) throw new Error(msg); }
  const S = App.S;
  step('intro', () => { if (S.pending.some((p) => p.type === 'intro')) { showPending(); click('#modal [data-act="ok"]'); } need(!App.modal, 'intro did not close'); });
  for (const t of TABS) step('tab ' + t[0], () => { click('#tabs [data-arg="' + t[0] + '"]'); need($('panel').innerHTML.length > 500, 'empty panel'); });
  step('time', () => {
    click('#tabs [data-arg="desk"]');
    click('#panel [data-act="time"][data-arg="board,-1"]'); need(S.time.board === 1 && timeFree(S) === 1, 'day not freed');
    click('#panel [data-act="time"][data-arg="donors,1"]'); need(S.time.donors === 3 && timeFree(S) === 0, 'day not assigned');
    click('#panel [data-act="time"][data-arg="donors,1"]'); need(S.time.donors === 3, 'over-assigned');
    for (let k = 0; k < 4; k++) click('#panel [data-act="time"][data-arg="board,-1"]'); need(S.time.board === 0, 'below zero');
    click('#panel [data-act="banner"]');
  });
  step('settings', () => {
    click('#tabs [data-arg="people"]'); click('#panel [data-act="fac"][data-arg="0,1"]'); click('#panel [data-act="pd"][data-arg="1"]');
    click('#tabs [data-arg="program"]'); click('#panel [data-act="prog"][data-arg="arts,3"]');
    click('#tabs [data-arg="admissions"]'); click('#panel [data-act="focus"]'); click('#panel [data-act="bus"]'); click('#panel [data-act="nb"]'); click('#card [data-act="closeCard"]');
    click('#tabs [data-arg="giving"]'); const sl = $('sl-dr'); sl.value = 5; sl.dispatchEvent(new Event('input', { bubbles: true })); sl.dispatchEvent(new Event('change', { bubbles: true })); need(Math.abs(S.drawRate - 0.05) < 1e-9, 'draw slider');
  });
  for (const k of ['help', 'menu', 'year', 'hall']) step('modal ' + k, () => { showModal(k, null, { dismiss: true }); need($('modal').textContent.length > 40, 'empty'); click('#modal [data-act="closeModal"]'); need(!App.modal, 'did not close'); });
  for (const k of ['rep', 'sat', 'morale', 'board']) step('drivers ' + k, () => { ACT.drivers(k); click('#modal [data-act="closeModal"]'); });
  for (const r of ROLES) step('cands ' + r.id, () => { ACT.cands(r.id); need($('modal').querySelector('.person'), 'no candidates'); click('#modal [data-act="closeModal"]'); });
  for (const t of BUILD_ORDER) step('build ' + t, () => { ACT.buildOpen(t); click('#modal [data-act="closeModal"]'); });
  for (const e of EVENTS) for (let c = 0; c < e.choices.length; c++) step('event ' + e.id + ' ' + c, () => {
    S.pending = []; if (e.id === 'dinner' && !S.campaign) S.campaign = { goal: 1e6, final: 1e6, total: 96, left: 50, raised: 0, tier: 'modest' };
    queueEvent(S, e.id); showPending(); need(App.modal === 'event', 'no event dialog');
    need($('modal').querySelectorAll('.choice').length === e.choices.length, 'choices'); need(!/undefined|NaN/.test($('modal').textContent), 'bad text: ' + $('modal').textContent.slice(0, 200));
    $('modal').querySelectorAll('.choice')[c].click(); need($('modal').querySelector('.outcome').textContent.length > 3, 'no outcome'); need(!/undefined|NaN/.test($('modal').textContent), 'bad outcome');
    click('#modal [data-act="closeModal"]'); need(!App.modal, 'event did not close'); S.board = 60; S.cash = Math.max(S.cash, 1e6);
  });
  step('plan', () => { S.pending = [{ type: 'plan', block: true, opts: ['faculty', 'promise', 'global'] }]; showPending(); need(App.modal === 'plan', 'no plan dialog'); click('#modal [data-act="planPick"][data-arg="promise"]'); need(S.plan.includes('promise') && !App.modal, 'plan not adopted'); });
  step('year to budget', () => { S.pending = []; autoPlay(26 - wk(S) > 0 ? 26 - wk(S) : 26 + WPY - wk(S)); S.pending = S.pending.filter((p) => p.type === 'budget'); if (!S.pending.length) S.pending.push({ type: 'budget', block: true }); showPending(); need(App.modal === 'budget', 'no budget dialog'); const sl = $('m-tp'); need(+sl.max === maxTuition(S) && +sl.max < 10, 'tuition cap missing'); sl.value = sl.max; sl.dispatchEvent(new Event('input', { bubbles: true })); click('#modal [data-act="budgetOk"]'); need(S.lastTuitionPct <= maxTuition(S), 'cap broken'); });
  step('admit', () => { shut(); S.pending = []; let g = 0; while (!S.pending.some((p) => p.type === 'admit') && g++ < 30) { S.pending = S.pending.filter((p) => p.type === 'admit'); tick(S); } showPending(); need(App.modal === 'admit', 'no admit dialog'); const sl = $('m-ad0'); sl.value = Math.max(0, +sl.value - 3); sl.dispatchEvent(new Event('input', { bubbles: true })); click('#modal [data-act="admitOk"]'); });
  step('deposits and review', () => {
    shut(); let g = 0; while (!S.pending.some((p) => p.type === 'review') && g++ < 40 && !S.over) { for (const p of S.pending.slice()) { if (p.type === 'event') resolveEvent(S, p.id, 0); else if (p.type === 'deposits') { showPending(); need(App.modal === 'deposits', 'no deposits dialog'); click('#modal [data-act="ok"]'); shut(); } else clearPending(S, p.type); } tick(S); }
    S.pending = S.pending.filter((p) => p.type === 'review'); S.banners.full = S.week - 3; S.review.banners = ['full']; S.review.verdict = null; showPending(); need(App.modal === 'review', 'no review dialog'); need($('modal').querySelector('.bnr'), 'no banner on the report card'); click('#modal [data-act="reviewOk"]');
  });
  step('over', () => {
    shut(); S.pending = []; const before = hallLoad().length; endGame(S, 'retired'); showPending(); need(App.modal === 'over', 'no end screen');
    need(hallLoad().length === before + 1 || before >= 30, 'tenure not recorded'); need($('share').value.indexOf(S.name) >= 0, 'record text'); need(!/undefined|NaN/.test($('modal').textContent), 'bad end text');
    click('#modal [data-act="copyRecord"]');
  });
  console.log('TEST DONE ' + pass + ' passed, ' + fail + ' failed');
  document.title = 'TEST ' + pass + ' passed, ' + fail + ' failed';
}
