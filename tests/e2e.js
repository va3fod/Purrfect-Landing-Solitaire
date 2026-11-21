// E2E: node tests/e2e.js [url]   (playwright-core + system Chrome)
// Desktop 1280x800 (mouse), phone portrait 412x915 and landscape 915x412 (touch). With a URL it runs against that site (no screenshots).
const { chromium } = require('../node_modules/playwright-core');
const path = require('path'), fs = require('fs');
const APP = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8'));
const URL = process.argv[2] || 'file://' + path.join(__dirname, '..', APP.FILE), SHOOT = !process.argv[2], KEY = APP.STORE_KEY;
const SHOTS = path.join(__dirname, '..', 'shots'); if (SHOOT) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0; const fails = [];
function check(name, cond) { if (cond) pass++; else { fail++; fails.push(name); } console.log((cond ? '  ✓ ' : '  ✗ ') + name); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = (p, f, a) => p.evaluate(f, a);
const st = p => ev(p, () => __PL.state());
const lastSound = p => ev(p, () => __PL.sounds[__PL.sounds.length - 1] || null);

async function grabPoint(p, c) {
  return ev(p, c => {
    const el = document.querySelector(`.card[data-id="${c}"]`), r = el.getBoundingClientRect();
    for (const fx of [0.5, 0.3, 0.7, 0.15]) for (let y = r.top + 3; y < r.bottom - 2; y += 3) { const x = r.left + r.width * fx; const hit = document.elementFromPoint(x, y); if (hit === el) return { x, y, left: r.left, top: r.top }; }
    return null;
  }, c);
}
async function targetBox(p, to) {
  return ev(p, to => {
    const s = __PL.state();
    if (to.t === 'f') { const f = s.found[to.i]; return f.length ? __PL.cardBox(f[f.length - 1]) : __PL.slotBox('f' + to.i); }
    const col = s.tab[to.i].cards; return col.length ? __PL.cardBox(col[col.length - 1]) : __PL.slotBox('t' + to.i);
  }, to);
}
function makeInput(p, cdp, touch) {
  return {
    async tap(x, y) { if (touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); },
    async drag(x1, y1, x2, y2) {
      if (!touch) { await p.mouse.move(x1, y1); await p.mouse.down(); for (let i = 1; i <= 8; i++) await p.mouse.move(x1 + (x2 - x1) * i / 8, y1 + (y2 - y1) * i / 8); await p.mouse.up(); return; }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y: y1 }] });
      for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x1 + (x2 - x1) * i / 8, y: y1 + (y2 - y1) * i / 8 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
  };
}
async function waitIdle(p) { await sleep(260); await p.waitForFunction(() => !__PL.busy()); }
/* perform one engine move through the UI */
async function uiMove(p, inp, mv, how) {
  const before = (await st(p)).moves, expect = await ev(p, mv => { const n = __PL.core.apply(__PL.state(), mv); return n && JSON.stringify([n.tab, n.found, n.stock, n.waste]); }, mv);
  if (mv.t === 'draw') {
    const box = await ev(p, () => { const s = __PL.state(); return s.stock.length ? __PL.cardBox(s.stock[s.stock.length - 1]) : __PL.slotBox('s'); });
    await inp.tap(box.x + box.w / 2, box.y + box.h / 2);
  } else {
    const lead = await ev(p, mv => __PL.core.picked(__PL.state(), mv.from, mv.n)[0], mv);
    const g = await grabPoint(p, lead), t = await targetBox(p, mv.to);
    if (how === 'dbl' && mv.to.t === 'f') await p.mouse.dblclick(g.x, g.y);
    else await inp.drag(g.x, g.y, g.x + (t.x - g.left), g.y + (t.y - g.top));
  }
  await p.waitForFunction(b => __PL.state().moves > b || __PL.meta().won, before, { timeout: 4000 }).catch(() => {});
  await waitIdle(p);
  const got = await ev(p, () => { const n = __PL.state(); return JSON.stringify([n.tab, n.found, n.stock, n.waste]); });
  if (got !== expect) console.log('    state differs from the engine after', JSON.stringify(mv), 'moves', before, '->', (await st(p)).moves);
  return (await st(p)).moves > before && got === expect;
}
async function closeModals(p) { await p.keyboard.press('Escape'); await sleep(120); }
async function visible(p, sel) { return p.isVisible(sel); }

async function run(cfg) {
  console.log(`\n=== ${cfg.tag} ${cfg.vp.width}x${cfg.vp.height} ${cfg.touch ? 'touch' : 'mouse'} ===`);
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: cfg.vp, hasTouch: cfg.touch, isMobile: cfg.touch, deviceScaleFactor: cfg.touch ? 2 : 1 });
  const p = await ctx.newPage(), errors = [];
  p.on('pageerror', e => errors.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const cdp = await ctx.newCDPSession(p), inp = makeInput(p, cdp, cfg.touch);
  await p.goto(URL); await p.waitForFunction(() => window.__PL);
  const T = cfg.tag;

  // --- first run: name, then How to play ---
  check(`${T}: asks for a player name on first visit`, await visible(p, '#name-modal'));
  check(`${T}: open-in-browser tip hidden in a normal browser`, !(await visible(p, '#browser-tip')));
  await p.click('#name-ok'); check(`${T}: empty name rejected`, await visible(p, '#name-error'));
  await p.fill('#name-input', 'Val'); await p.keyboard.press('Enter'); await sleep(150);
  check(`${T}: name saved and shown`, (await p.textContent('#hud-player-name')) === 'Val' && (await ev(p, () => __PL.core.player(__PL.save()).name)) === 'Val');
  check(`${T}: How to play shows after the name`, await visible(p, '#help-modal') && (await p.textContent('#help-title')).includes('How to play Purrfect Landing Solitaire'));
  await p.click('#help-modal .close'); check(`${T}: help closes`, !(await visible(p, '#help-modal')));
  await p.click('#btn-help'); check(`${T}: ? button opens How to play`, await visible(p, '#help-modal') && (await p.textContent('#help-modal')).includes('warning horn'));
  await closeModals(p);
  await p.click('#btn-about'); const about = await p.textContent('#about-modal');
  check(`${T}: About shows version, credit and tip line`, await visible(p, '#about-modal') && about.includes('Version ' + (await ev(p, () => __PL.version))) && about.includes('Made by Val, VA3FOD') && about.includes('Interac e-Transfer to aschiuta@gmail.com'));
  check(`${T}: About links back to Val's Apps`, (await p.getAttribute('#about-hub', 'href')) === 'https://va3fod.github.io/');
  if (SHOOT && cfg.tag === 'phone') await p.screenshot({ path: path.join(SHOTS, 'phone_about.png') });
  await closeModals(p);
  check(`${T}: Val's Apps brand + footer links`, (await p.getAttribute('#brand-hub', 'href')) === 'https://va3fod.github.io/' && (await p.getAttribute('#foot-hub', 'href')) === 'https://va3fod.github.io/' && (await p.textContent('.app-credit')).includes('Made by Val, VA3FOD'));
  const html = await p.content(), emails = (html.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []).filter(e => e !== 'aschiuta@gmail.com');
  check(`${T}: no other email addresses on the page`, emails.length === 0);
  const fit = await ev(p, () => ({ sh: document.documentElement.scrollHeight, ih: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth }));
  check(`${T}: layout fits the screen (no page scroll needed)`, fit.sh <= fit.ih + 1 && fit.sw <= fit.iw + 1);

  // --- deterministic deal ---
  const seed = await ev(p, () => SEEDS.d1[5]);
  await ev(p, s => __PL.newDeal({ seed: s, draw: 1, mode: 'winnable' }), seed); await sleep(900);
  let s0 = await st(p);
  check(`${T}: new deal laid out (7 columns, 24 in stock)`, s0.stock.length === 24 && s0.tab.every((c, i) => c.cards.length === i + 1));
  const cardsInside = await ev(p, () => { const b = document.getElementById('board').getBoundingClientRect(); return [...document.querySelectorAll('.card')].every(e => { const r = e.getBoundingClientRect(); return r.left >= b.left - 1 && r.right <= b.right + 1 && r.top >= b.top - 1 && r.bottom <= b.bottom + 1; }); });
  check(`${T}: all cards inside the board`, cardsInside);
  check(`${T}: deal sound is the cat meow`, (await ev(p, () => __PL.sounds.filter(x => x.ev === 'deal').pop() || {})).name === 'meow');

  // --- draw by tapping the stock ---
  check(`${T}: tapping the stock turns a card`, await uiMove(p, inp, { t: 'draw' }) && (await st(p)).waste.length === 1);
  const snd1 = await lastSound(p); check(`${T}: cat paw-tap on card move, really played`, snd1 && snd1.name === 'paw-tap' && snd1.theme === 'cat' && snd1.played);
  // --- undo / redo (buttons + keys) ---
  await p.click('#btn-undo'); await waitIdle(p); check(`${T}: undo button restores the stock`, (await st(p)).waste.length === 0 && (await st(p)).stock.length === 24);
  await p.click('#btn-redo'); await waitIdle(p); check(`${T}: redo button replays it`, (await st(p)).waste.length === 1);
  await p.keyboard.press('u'); await waitIdle(p); check(`${T}: U key undoes`, (await st(p)).waste.length === 0);
  await p.keyboard.press('r'); await waitIdle(p); check(`${T}: R key redoes`, (await st(p)).waste.length === 1);
  // --- illegal drag snaps back with a hiss ---
  s0 = await st(p);
  const wc = s0.waste[s0.waste.length - 1];
  const bad = await ev(p, wc => { const s = __PL.state(); for (let i = 0; i < 7; i++) { if (!__PL.core.legal(s, { t: 'move', from: { t: 'w' }, to: { t: 't', i }, n: 1 })) return i; } return -1; }, wc);
  const gb = await grabPoint(p, wc), tb = await targetBox(p, { t: 't', i: bad });
  await inp.drag(gb.x, gb.y, gb.x + (tb.x - gb.left), gb.y + (tb.y - gb.top)); await waitIdle(p);
  const back = await ev(p, c => __PL.cardBox(c), wc);
  check(`${T}: illegal drop is refused and the card snaps back`, (await st(p)).moves === s0.moves && Math.abs(back.x - gb.left) < 2 && Math.abs(back.y - gb.top) < 2);
  check(`${T}: illegal move hisses (cat)`, (await lastSound(p)).name === 'hiss');
  check(`${T}: page did not scroll during the drag`, (await ev(p, () => [scrollX, scrollY, document.scrollingElement.scrollTop])).every(v => v === 0));
  // --- hint ---
  await p.click('#btn-hint'); await sleep(150);
  check(`${T}: hint highlights a move`, (await p.$$('.hl')).length >= 1);
  await p.keyboard.press('h'); await sleep(100); check(`${T}: H key hints too`, (await p.$$('.hl')).length >= 1 && (await ev(p, () => __PL.meta().hints)) === 2);
  // --- tap-to-move ---
  const tapPick = await ev(p, () => { const s = __PL.state(); for (let i = 0; i < 7; i++) { const col = s.tab[i]; for (let k = col.down; k < col.cards.length; k++) { const m = __PL.smartMove(col.cards[k]); if (m) return { c: col.cards[k], m }; } } const w = s.waste[s.waste.length - 1]; const m = w != null && __PL.smartMove(w); return m ? { c: w, m } : null; });
  if (tapPick) {
    const g = await grabPoint(p, tapPick.c), mv0 = (await st(p)).moves; await inp.tap(g.x, g.y); await waitIdle(p);
    const after = await st(p); const where = tapPick.m.to.t === 'f' ? after.found[tapPick.m.to.i] : after.tab[tapPick.m.to.i].cards;
    check(`${T}: tap-to-move sends the card to the best spot`, after.moves === mv0 + 1 && where.includes(tapPick.c));
    await p.click('#btn-undo'); await waitIdle(p);
  } else check(`${T}: tap-to-move candidate exists`, false);

  // --- theme: aviation sounds and persistence ---
  await p.click('#btn-theme'); await sleep(250);
  check(`${T}: theme switches to aviation`, (await ev(p, () => document.body.className)) === 'theme-air' && (await ev(p, () => __PL.save().settings.theme)) === 'air');
  check(`${T}: theme switch plays a radio chime`, (await lastSound(p)).name === 'atc-chime');
  await uiMove(p, inp, { t: 'draw' }); check(`${T}: aviation whoosh on move`, (await lastSound(p)).name === 'whoosh' && (await lastSound(p)).theme === 'air');
  await p.click('#btn-undo'); await waitIdle(p);
  const ill = await ev(p, () => __PL.state().waste.slice(-1)[0]);
  { const g = await grabPoint(p, ill), b2 = await ev(p, () => __PL.state()), badI = await ev(p, () => { const s = __PL.state(); for (let i = 0; i < 7; i++) if (!__PL.core.legal(s, { t: 'move', from: { t: 'w' }, to: { t: 't', i }, n: 1 })) return i; return 0; });
    const t = await targetBox(p, { t: 't', i: badI }); await inp.drag(g.x, g.y, g.x + (t.x - g.left), g.y + (t.y - g.top)); await waitIdle(p);
    check(`${T}: aviation warning horn on illegal move`, (await lastSound(p)).name === 'warning-horn' && (await st(p)).moves === b2.moves); }
  if (SHOOT) await p.screenshot({ path: path.join(SHOTS, `${cfg.tag}_air.png`) });
  await p.reload(); await p.waitForFunction(() => window.__PL); await sleep(400);
  check(`${T}: theme remembered after reload`, (await ev(p, () => document.body.className)) === 'theme-air');
  check(`${T}: game resumes after reload`, (await st(p)).seed === seed);
  check(`${T}: no name prompt on return visit`, !(await visible(p, '#name-modal')));
  await ev(p, () => __PL.newDeal({ mode: 'random' })); await sleep(300);
  check(`${T}: aviation deal = engine spool`, (await ev(p, () => __PL.sounds.filter(x => x.ev === 'deal').pop() || {})).name === 'engine-spool');
  await p.click('#btn-sound'); await uiMove(p, inp, { t: 'draw' });
  check(`${T}: mute stops sounds`, (await lastSound(p)).played === false && (await ev(p, () => __PL.save().settings.sound)) === false);
  await p.click('#btn-sound');
  await p.click('#btn-theme'); await sleep(200);
  check(`${T}: back to cats`, (await ev(p, () => document.body.className)) === 'theme-cat');
  if (SHOOT) { await ev(p, s => __PL.newDeal({ seed: s, draw: 1, mode: 'winnable' }), seed); await sleep(900); await p.screenshot({ path: path.join(SHOTS, `${cfg.tag}_cat.png`) }); }

  // --- players ---
  await p.click('#hud-player'); check(`${T}: player chip opens Players`, await visible(p, '#players-modal'));
  await p.click('#pl-add'); await p.fill('#name-input', 'Zoran'); await p.click('#name-ok'); await sleep(100);
  check(`${T}: second player added and active`, (await p.textContent('#hud-player-name')) === 'Zoran' && (await ev(p, () => Object.keys(__PL.save().players).length)) === 2);
  await p.click('#hud-player'); await p.click('#players-list [data-play]'); await sleep(100);
  check(`${T}: switch back to Val`, (await p.textContent('#hud-player-name')) === 'Val');
  await p.click('#pl-rename'); await p.fill('#name-input', 'Zoran'); await p.click('#name-ok');
  check(`${T}: rename to an existing name is refused`, await visible(p, '#name-error'));
  await p.fill('#name-input', 'Val B'); await p.click('#name-ok'); await sleep(100);
  check(`${T}: rename works`, (await p.textContent('#hud-player-name')) === 'Val B');
  await closeModals(p);

  // --- settings: left-handed, large, colour-blind ---
  await p.click('#btn-menu'); await p.click('#menu-modal [data-open="settings-modal"]');
  check(`${T}: settings shows the player`, (await p.textContent('#set-player-name')) === 'Val B');
  await p.check('#set-left'); await sleep(150);
  const lx = await ev(p, () => [__PL.slotBox('s').x, __PL.slotBox('f0').x]);
  check(`${T}: left-handed puts the stock on the right`, lx[0] > lx[1]);
  const face0 = await ev(p, () => { const s = __PL.state(), c = s.tab[6].cards[6]; return document.querySelector(`.card[data-id="${c}"]`).style.backgroundImage; });
  await p.check('#set-large'); await p.check('#set-cb'); await sleep(150);
  const face1 = await ev(p, () => { const s = __PL.state(), c = s.tab[6].cards[6]; return document.querySelector(`.card[data-id="${c}"]`).style.backgroundImage; });
  check(`${T}: large + colour-blind cards redraw`, face0 !== face1);
  if (SHOOT && cfg.tag === 'phone') { await closeModals(p); await p.screenshot({ path: path.join(SHOTS, 'phone_lefty_large_cb.png') }); }
  await closeModals(p); await p.reload(); await p.waitForFunction(() => window.__PL);
  const set = await ev(p, () => __PL.save().settings);
  check(`${T}: settings remembered`, set.leftHanded && set.large && set.colorblind);
  await ev(p, () => { const s = __PL.save().settings; s.leftHanded = s.large = s.colorblind = false; }); await p.reload(); await p.waitForFunction(() => window.__PL);
  await ev(p, () => { localStorage.setItem(APP_STORE_KEY, JSON.stringify(Object.assign(__PL.save(), { settings: Object.assign(__PL.save().settings, { leftHanded: false, large: false, colorblind: false }) }))); });
  await p.reload(); await p.waitForFunction(() => window.__PL);

  // --- draw 3 + daily challenge ---
  await p.click('#btn-new'); await p.click('#nd-draw3'); await p.click('#nd-deal'); await sleep(700);
  check(`${T}: Draw 3 deal from the New dialog`, (await st(p)).draw === 3 && (await p.textContent('#hud-mode')).includes('Draw 3'));
  await uiMove(p, inp, { t: 'draw' }); const w3 = await st(p);
  const fan = await ev(p, () => { const s = __PL.state(); return s.waste.slice(-3).map(c => __PL.cardBox(c).x); });
  check(`${T}: Draw 3 turns three cards, fanned`, w3.waste.length === 3 && fan[0] < fan[1] && fan[1] < fan[2]);
  await p.click('#btn-menu'); await p.click('#menu-daily'); await sleep(600);
  const dly = await ev(p, () => ({ seed: __PL.state().seed, want: __PL.core.dailySeed(__PL.core.dateKey(new Date()), __PL.state().draw === 3 ? SEEDS.d3 : SEEDS.d1), mode: __PL.meta().mode }));
  check(`${T}: daily challenge deals today's winnable seed`, dly.mode === 'daily' && dly.seed === dly.want && (await p.textContent('#hud-mode')).includes('Daily'));
  const ls = await ev(p, () => __PL.core.player(__PL.save()).stats);
  check(`${T}: abandoned games count as played`, ls.played >= 1);
  await p.click('#btn-new'); await p.click('#nd-draw1'); await closeModals(p);

  // --- full game won through the UI ---
  if (cfg.full) {
    if (cfg.fullTheme === 'air') { await p.click('#btn-theme'); await sleep(150); }
    const ws = await ev(p, () => SEEDS.d1[11]);
    await ev(p, s => __PL.newDeal({ seed: s, draw: 1, mode: 'winnable' }), ws); await sleep(1000);
    const sol = await ev(p, () => __PL.core.solve(__PL.state(), { maxNodes: 60000 }));
    check(`${T}: solver finds a solution for the winnable deal`, sol.solved);
    let ok = true, n = 0, usedAuto = false;
    for (const mv of sol.moves) {
      if (cfg.useAuto && await p.isVisible('#btn-auto')) { await p.click('#btn-auto', { force: true }); usedAuto = true; break; }
      const how = !cfg.touch && n % 2 ? 'dbl' : 'drag';
      if (!(await uiMove(p, inp, mv, how))) {
        ok = false; console.log('    failed move', n, JSON.stringify(mv));
        console.log(JSON.stringify(await ev(p, mv => { const s = __PL.state(), c = __PL.core.picked(s, mv.from, mv.n); return { c, legal: __PL.core.legal(s, mv), box: c && __PL.cardBox(c[0]), waste: s.waste.slice(-3), stock: s.stock.length, banner: document.getElementById('banner').textContent, auto: !document.getElementById('btn-auto').hidden, modals: [...document.querySelectorAll('.modal')].filter(m => !m.hidden).map(m => m.id) }; }, mv)));
        if (SHOOT) await p.screenshot({ path: path.join(SHOTS, 'debug_fail.png') });
        break;
      }
      n++;
    }
    check(`${T}: all ${n} solver moves played by ${cfg.touch ? 'touch' : 'mouse'} drags/taps${cfg.touch ? '' : '/double-clicks'}`, ok);
    if (cfg.useAuto) check(`${T}: auto-finish button appeared and finished the game`, usedAuto);
    await p.waitForFunction(() => __PL.meta().won, null, { timeout: 30000 }).catch(() => {});
    check(`${T}: game won`, await ev(p, () => __PL.meta().won && __PL.core.isWon(__PL.state())));
    check(`${T}: win celebration plays (${cfg.fullTheme === 'air' ? 'plane flyby' : 'cats chase cards'})`, await ev(p, () => document.getElementById('fx').classList.contains('on')));
    check(`${T}: win sound ${cfg.fullTheme === 'air' ? 'flyby' : 'meow+purr'}`, (await ev(p, () => __PL.sounds.filter(x => x.ev === 'win').pop() || {})).name === (cfg.fullTheme === 'air' ? 'flyby' : 'meow+purr'));
    if (SHOOT) { await sleep(1500); await p.screenshot({ path: path.join(SHOTS, `${cfg.tag}_celebration_${cfg.fullTheme}.png`) }); }
    await p.waitForSelector('#win-modal:not([hidden])', { timeout: 9000 }).catch(() => {});
    check(`${T}: win dialog shows`, await visible(p, '#win-modal'));
    check(`${T}: win dialog announces the high score`, (await p.textContent('#win-rank')).includes('Val B'));
    if (SHOOT) await p.screenshot({ path: path.join(SHOTS, `${cfg.tag}_win.png`) });
    const stats = await ev(p, () => __PL.core.player(__PL.save()).stats);
    check(`${T}: stats record the win`, stats.won === 1 && stats.streak === 1 && stats.bestTime > 0);
    check(`${T}: first-win stamp earned`, await ev(p, () => !!__PL.core.player(__PL.save()).stamps.first));
    if (await visible(p, '#win-modal')) await p.click('#win-modal .close');
    await p.click('#btn-stats'); await sleep(100);
    check(`${T}: high-score table lists the win`, await visible(p, '#panel-scores') && (await p.textContent('#lb-body')).includes('Val B') && (await p.$$('#lb-body tr')).length === 1);
    if (SHOOT) await p.screenshot({ path: path.join(SHOTS, `${cfg.tag}_highscores.png`) });
    await p.click('#tab-players'); const plt = await p.textContent('#pl-body');
    check(`${T}: per-player stats table shows both players`, plt.includes('Val B') && plt.includes('Zoran') && (await p.$$('#pl-body tr')).length === 2);
    await p.click('#tab-mine'); check(`${T}: my stats tab shows stamps`, (await p.$$('#stamps .stamp.got')).length >= 1);
    await p.click('#tab-scores'); await p.click('#lb-reset'); await p.click('#lb-reset-yes'); await sleep(100);
    check(`${T}: reset high scores`, (await p.$$('#lb-body tr')).length === 0 && await visible(p, '#lb-empty'));
    await closeModals(p);
    await p.reload(); await p.waitForFunction(() => window.__PL);
    check(`${T}: stats persist after reload`, (await ev(p, () => __PL.core.player(__PL.save()).stats.won)) === 1);
  }

  // --- stuck = game over (seeded dead ends) ---
  for (const sc of [{ theme: 'cat', seed: 5763, draw: 1, mv: { t: 'move', from: { t: 't', i: 1 }, to: { t: 't', i: 6 }, n: 1 }, title: 'Cat nap time', snd: 'yawn' },
                    { theme: 'air', seed: 201, draw: 3, mv: { t: 'move', from: { t: 't', i: 3 }, to: { t: 't', i: 5 }, n: 1 }, title: 'Holding pattern', snd: 'holding-pattern' }]) {
    const L = `${T} [${sc.theme} stuck, draw ${sc.draw}]`;
    await closeModals(p);
    for (let k = 0; k < 2 && (await ev(p, () => document.body.className)) !== 'theme-' + sc.theme; k++) { await p.click('#btn-theme'); await sleep(150); }
    if (!(await ev(p, () => __PL.save().settings.sound))) { await p.keyboard.press('m'); await sleep(80); }
    await ev(p, o => __PL.newDeal({ seed: o.seed, draw: o.draw, mode: 'random' }), sc); await sleep(1300);
    check(`${L}: fresh deal is not flagged`, !(await visible(p, '#stuck-modal')) && !(await ev(p, () => __PL.meta().stuck)));
    const before = await ev(p, () => ({ st: __PL.core.player(__PL.save()).stats, rows: __PL.save().scores.d1.length + __PL.save().scores.d3.length }));
    await uiMove(p, inp, { t: 'draw' }); await p.keyboard.press('u'); await waitIdle(p); await sleep(2600);   // clock running, toasts gone
    check(`${L}: dead-end move played through the UI`, await uiMove(p, inp, sc.mv, 'drag'));
    await p.waitForSelector('#stuck-modal:not([hidden])', { timeout: 4000 }).catch(() => {});
    check(`${L}: game-over screen shows`, await visible(p, '#stuck-modal') && (await p.textContent('#stuck-title')).includes(sc.title));
    const ss = await p.textContent('#stuck-stats');
    check(`${L}: game-over shows time, moves and score`, ss.includes('Time') && ss.includes('Moves') && ss.includes('Score') && ss.includes('1Moves'));
    const sn = await ev(p, () => __PL.sounds.filter(x => x.ev === 'stuck').pop() || {});
    check(`${L}: themed game-over sound (${sc.snd})`, sn.name === sc.snd && sn.theme === sc.theme && sn.played);
    if (SHOOT && cfg.tag === 'phone') await p.screenshot({ path: path.join(SHOTS, `phone_stuck_${sc.theme}.png`) });
    const e0 = await ev(p, () => __PL.meta().elapsed); check(`${L}: game-over time matches the frozen clock`, e0 >= 2 && (await p.textContent('#stuck-stats')).includes((await p.textContent('#hud-time')).trim()));
    const h0 = await p.textContent('#hud-time'); await sleep(1600);
    check(`${L}: clock stopped`, (await ev(p, () => __PL.meta().elapsed)) === e0 && (await p.textContent('#hud-time')) === h0);
    await p.keyboard.press('Escape'); await p.mouse.click(5, 5); await sleep(150);
    check(`${L}: game-over can't be dismissed by Escape or tapping outside`, await visible(p, '#stuck-modal'));
    await ev(p, () => { const s = __PL.state(); for (const col of s.tab) if (col.cards.length) __PL.smartMove(col.cards[col.cards.length - 1]); });
    check(`${L}: no move possible while stuck`, (await ev(p, () => __PL.state().moves)) === 1);
    check(`${L}: streak untouched while the screen is open`, (await ev(p, () => __PL.core.player(__PL.save()).stats.streak)) === before.st.streak);
    await p.reload(); await p.waitForFunction(() => window.__PL); await sleep(400);
    check(`${L}: still game over after reload`, await visible(p, '#stuck-modal') && (await ev(p, () => __PL.meta().stuck)) === true);
    await p.click('#stuck-undo'); await waitIdle(p);
    check(`${L}: Undo closes the screen and reopens play`, !(await visible(p, '#stuck-modal')) && (await ev(p, () => __PL.state().moves)) === 0 && (await ev(p, () => __PL.meta().stuck)) === false);
    await sleep(1600);
    check(`${L}: clock runs again after Undo`, (await ev(p, () => __PL.meta().elapsed)) > e0 + 0.8);
    check(`${L}: Undo records no loss`, (await ev(p, () => __PL.core.player(__PL.save()).stats.streak)) === before.st.streak);
    await p.click('#btn-redo'); await p.waitForSelector('#stuck-modal:not([hidden])', { timeout: 4000 }).catch(() => {});
    check(`${L}: Redo into the dead end → game over again`, await visible(p, '#stuck-modal'));
    await p.click('#stuck-replay'); await sleep(1300);
    const rp = await ev(p, () => ({ s: __PL.state(), m: __PL.meta(), st: __PL.core.player(__PL.save()).stats, rows: __PL.save().scores.d1.length + __PL.save().scores.d3.length }));
    check(`${L}: Replay deals the same deal again`, !(await visible(p, '#stuck-modal')) && rp.s.seed === sc.seed && rp.s.draw === sc.draw && rp.s.moves === 0 && !rp.m.stuck);
    check(`${L}: leaving records a loss (streak ${before.st.streak} → 0, best streak kept, played +1)`, rp.st.streak === 0 && rp.st.bestStreak === before.st.bestStreak && rp.st.played === before.st.played + 1 && rp.st.won === before.st.won);
    check(`${L}: game over adds no high score`, rp.rows === before.rows);
    check(`${L}: replayed deal is playable`, await uiMove(p, inp, { t: 'draw' }) && (await ev(p, () => __PL.state().moves)) === 1);
    await p.keyboard.press('u'); await waitIdle(p);
    check(`${L}: replayed deal → dead end again`, await uiMove(p, inp, sc.mv, 'drag') && await p.waitForSelector('#stuck-modal:not([hidden])', { timeout: 4000 }).then(() => true).catch(() => false));
    await p.click('#stuck-new'); await sleep(1300);
    const nw = await ev(p, () => ({ s: __PL.state(), m: __PL.meta(), st: __PL.core.player(__PL.save()).stats }));
    check(`${L}: New game closes the screen with a fresh deal`, !(await visible(p, '#stuck-modal')) && nw.s.moves === 0 && !nw.m.stuck && nw.s.stock.length === 24);
    check(`${L}: loss counted once per game`, nw.st.played === before.st.played + 2 && nw.st.streak === 0);
  }
  await p.click('#btn-help'); const helpTxt = await p.textContent('#help-modal');
  check(`${T}: How to play explains game over and scoring`, helpTxt.includes('Stuck = game over') && helpTxt.includes('1000 × 240') && helpTxt.includes('Only wins go on the high-score table'));
  await closeModals(p);

  // --- corrupt save ---
  await ev(p, k => { __PL.suspendSave(); localStorage.setItem(k, '{definitely not json'); }, KEY); await p.reload(); await p.waitForFunction(() => window.__PL); await sleep(300);
  check(`${T}: corrupt save → fresh start, backup kept`, (await ev(p, k => localStorage.getItem(k + '_corrupt_backup'), KEY)) === '{definitely not json' && (await st(p)).stock.length === 24);
  check(`${T}: after corrupt save, asks for name again`, await visible(p, '#name-modal'));
  await p.keyboard.press('Escape'); await sleep(100);
  check(`${T}: closing the name prompt uses a default player`, (await p.textContent('#hud-player-name')) === 'Player');
  check(`${T}: no console errors`, errors.length === 0); if (errors.length) console.log(errors);
  await browser.close();
}
async function inAppTip() {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 WhatsApp/2.24' });
  const p = await ctx.newPage(); await p.goto(URL); await sleep(300);
  check('in-app: open-in-browser tip shows inside WhatsApp', await p.isVisible('#browser-tip'));
  await browser.close();
}
(async () => {
  await run({ tag: 'desktop', vp: { width: 1280, height: 800 }, touch: false, full: true, fullTheme: 'cat' });
  await run({ tag: 'phone', vp: { width: 412, height: 915 }, touch: true, full: true, fullTheme: 'air', useAuto: true });
  await run({ tag: 'landscape', vp: { width: 915, height: 412 }, touch: true, full: false });
  await inAppTip();
  console.log(`\nE2E ${pass} passed, ${fail} failed${fail ? '\n - ' + fails.join('\n - ') : ''}`);
  fs.writeFileSync(path.join(__dirname, '..', SHOOT ? 'e2e_results.json' : 'e2e_live_results.json'), JSON.stringify({ url: URL, pass, fail, fails, at: new Date().toISOString() }, null, 2));
  process.exit(fail ? 1 : 0);
})();
