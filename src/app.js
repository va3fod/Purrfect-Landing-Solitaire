/* Purrfect Landing Solitaire — UI. Depends on PLCore, PLArt, SEEDS, APP_* constants. */
'use strict';
const C = PLCore, A = PLArt, $ = id => document.getElementById(id);
const KEY = APP_STORE_KEY;
const DEV_EMAIL = 'aschiuta@gmail.com';
let save, hist, meta, faces = [], backUrl = '', L = null, busy = false, cardEls = [], slotEls = {}, lastPos = [];
let lastMoveAt = 0, drag = null, tapLock = 0, tapAt = null, timerId = 0, hintTimer = 0, stuckShownFor = -1, bannerTimer = 0;

/* ---------------- persistence ---------------- */
function loadAll() {
  let raw = null; try { raw = localStorage.getItem(KEY); } catch (e) {}
  const r = C.loadSave(raw);
  if (r.corrupt) { try { localStorage.setItem(KEY + '_corrupt_backup', raw); } catch (e) {} }
  save = r.data; return r.corrupt;
}
let noSave = false;
function persist() {
  if (noSave) return;
  try {
    if (hist) {
      let list = hist.list, index = hist.index;
      if (list.length > 400) { const cut = list.length - 400; list = list.slice(cut); index = Math.max(0, index - cut); }
      save.game = Object.assign({}, meta, { list, index });
    }
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch (e) {}
}

/* ---------------- sound ---------------- */
const Sfx = (() => {
  let ctx = null, master = null, gestured = false;
  const mark = () => { gestured = true; };
  window.addEventListener('pointerdown', mark, true); window.addEventListener('keydown', mark, true);
  function ensure() {
    if (!save.settings.sound || !gestured) return null;
    try {
      if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination); }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { return null; }
    return ctx;
  }
  function noise(dur) { const b = ctx.createBuffer(1, Math.max(1, ctx.sampleRate * dur | 0), ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = ctx.createBufferSource(); s.buffer = b; return s; }
  function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  function tone(type, f0, f1, dur, vol, delay) {
    const t = ctx.currentTime + (delay || 0), o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, 0.01, vol, dur); o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function tick(freq, vol, dur) { const t = ctx.currentTime, n = noise(dur || 0.05), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2; env(g, t, 0.003, vol, dur || 0.05); n.connect(f).connect(g).connect(master); n.start(t); }
  function meow(pitch, delay) {
    const t = ctx.currentTime + (delay || 0), p = pitch || 1, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(420 * p, t); o.frequency.exponentialRampToValueAtTime(760 * p, t + 0.16); o.frequency.exponentialRampToValueAtTime(480 * p, t + 0.5);
    f.type = 'bandpass'; f.Q.value = 5; f.frequency.setValueAtTime(900 * p, t); f.frequency.exponentialRampToValueAtTime(1700 * p, t + 0.18); f.frequency.exponentialRampToValueAtTime(800 * p, t + 0.5);
    f2.type = 'lowpass'; f2.frequency.value = 3200; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.06); g.gain.setValueAtTime(0.45, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(f).connect(f2).connect(g).connect(master); o.start(t); o.stop(t + 0.6);
  }
  function purr(dur) {
    const t = ctx.currentTime, n = noise(dur), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    f.type = 'lowpass'; f.frequency.value = 220; lfo.frequency.value = 24; lg.gain.value = 0.22; g.gain.value = 0.25; lfo.connect(lg).connect(g.gain);
    const out = ctx.createGain(); env(out, t, 0.15, 0.9, dur); n.connect(f).connect(g).connect(out).connect(master); lfo.start(t); n.start(t); lfo.stop(t + dur + 0.2);
  }
  function chime(delay) { tone('sine', 880, 0, 0.55, 0.28, delay); tone('sine', 659, 0, 0.8, 0.26, (delay || 0) + 0.32); }
  function engine(dur) {
    const t = ctx.currentTime, n = noise(dur), f = ctx.createBiquadFilter(), g = ctx.createGain(), o = ctx.createOscillator(), og = ctx.createGain();
    f.type = 'bandpass'; f.Q.value = 0.8; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(1800, t + dur * 0.5); f.frequency.exponentialRampToValueAtTime(260, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.type = 'sawtooth'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(190, t + dur * 0.45); o.frequency.exponentialRampToValueAtTime(90, t + dur);
    og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.08, t + dur * 0.5); og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f).connect(g).connect(master); o.connect(og).connect(master); n.start(t); o.start(t); o.stop(t + dur);
  }
  const air = () => save.settings.theme === 'air';
  function hiss() { const t = ctx.currentTime, n = noise(0.45), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'highpass'; f.frequency.value = 3200; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42); n.connect(f).connect(g).connect(master); n.start(t); }
  function pawTap() { tone('sine', 220, 140, 0.07, 0.3); tick(900, 0.18, 0.04); }
  function whoosh(dur) { const t = ctx.currentTime, d = dur || 0.18, n = noise(d), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'bandpass'; f.Q.value = 1.5; f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(2600, t + d); env(g, t, d * 0.4, 0.3, d * 0.6); n.connect(f).connect(g).connect(master); n.start(t); }
  function horn() { tone('square', 520, 0, 0.16, 0.09); tone('square', 520, 0, 0.16, 0.09, 0.2); }
  function atcBeep() { tone('sine', 1000, 0, 0.09, 0.2); tone('sine', 1400, 0, 0.14, 0.2, 0.1); }
  function spool(dur) { const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(80, t); o.frequency.exponentialRampToValueAtTime(420, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400; o.connect(f).connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05); whoosh(dur); }
  /* every effect is named per theme; log keeps the last few for tests even when muted */
  const MAP = {
    cat: { move: 'paw-tap', flip: 'paw-tap', draw: 'paw-tap', found: 'purr', bad: 'hiss', deal: 'meow', win: 'meow+purr', hint: 'meow', theme: 'meow', stamp: 'chirp', auto: 'purr' },
    air: { move: 'whoosh', flip: 'whoosh', draw: 'whoosh', found: 'atc-chime', bad: 'warning-horn', deal: 'engine-spool', win: 'flyby', hint: 'atc-chime', theme: 'atc-chime', stamp: 'atc-chime', auto: 'atc-chime' }
  };
  const PLAY = {
    'paw-tap': pawTap, purr: () => purr(0.7), hiss, meow: () => meow(1), 'meow+purr': () => { meow(1); meow(1.2, 0.7); purr(2.4); }, chirp: () => { tone('triangle', 900, 1400, 0.09, 0.2); tone('triangle', 1300, 1000, 0.1, 0.16, 0.08); },
    whoosh: () => whoosh(), 'atc-chime': () => { atcBeep(); chime(0.25); }, 'warning-horn': horn, 'engine-spool': () => spool(1.1), flyby: () => { engine(3.2); chime(2.2); }
  };
  const log = [];
  function fx(ev) {
    const th = air() ? 'air' : 'cat', name = MAP[th][ev]; const on = !!ensure();
    log.push({ ev, theme: th, name, played: on }); if (log.length > 40) log.shift();
    if (on) try { PLAY[name](); } catch (e) {}
  }
  const api = { log };
  for (const ev of ['move', 'flip', 'draw', 'found', 'bad', 'deal', 'win', 'hint', 'theme', 'stamp', 'auto']) api[ev] = () => fx(ev);
  api.place = api.move; api.shuffle = api.deal; api.autoStart = api.auto;
  return api;
})();

/* ---------------- art & theme ---------------- */
function buildArt() {
  const st = save.settings; faces = [];
  for (let c = 0; c < 52; c++) faces.push(A.url(A.cardFace(c, st.theme, { colorblind: st.colorblind, large: st.large })));
  backUrl = A.url(A.cardBack(st.theme));
  const app = $('app'); app.className = 'theme-' + st.theme; document.body.className = 'theme-' + st.theme;
  app.style.setProperty('--feltimg', A.url(A.feltTile(st.theme)));
  document.querySelector('.logo').style.backgroundImage = A.url(logoSvg(st.theme));
  $('btn-theme').textContent = st.theme === 'air' ? '🐱' : '✈️';
  $('btn-theme').setAttribute('aria-label', st.theme === 'air' ? 'Switch to the cat theme' : 'Switch to the aviation theme');
  $('auto-i').textContent = st.theme === 'air' ? '🛬' : '🐾'; $('auto-t').textContent = st.theme === 'air' ? 'Land it' : 'Finish';
  $('set-sound-sub').textContent = st.theme === 'air' ? 'Engine spool, radio chimes, whooshes, warning horn, flyby' : 'Meows, purrs, paw taps and a hiss';
  const tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.content = st.theme === 'air' ? '#0b1a2c' : '#2b2040';
  for (const el of cardEls) el._face = null;
  for (const k in slotEls) slotEls[k]._img = null;
}
function logoSvg(theme) {
  return theme === 'air'
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#f2c14e"/><rect x="14" y="10" width="28" height="40" rx="5" fill="#fff" stroke="#0b1a2c" stroke-width="2.5" transform="rotate(-10 28 30)"/>${A.jetTop(38, 34, 34, '#0b1a2c', 40)}</svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#f4a95c"/><rect x="14" y="10" width="28" height="40" rx="5" fill="#fff" stroke="#2b2040" stroke-width="2.5" transform="rotate(-10 28 30)"/>${A.paw(40, 40, 30, '#2b2040')}</svg>`;
}

/* ---------------- board & layout ---------------- */
function initBoard() {
  const b = $('board');
  const mk = (k, kind, s) => { const d = document.createElement('div'); d.className = 'slot'; d.dataset.slot = k; d._kind = kind; d._suit = s; b.appendChild(d); slotEls[k] = d; };
  mk('s', 'stock'); mk('w', 'none'); for (let f = 0; f < 4; f++) mk('f' + f, 'f', f); for (let i = 0; i < 7; i++) mk('t' + i, 'king');
  for (let c = 0; c < 52; c++) { const d = document.createElement('div'); d.className = 'card'; d.dataset.id = c; b.appendChild(d); cardEls.push(d); lastPos.push(null); }
}
function computeLayout() {
  const b = $('board'), W = b.clientWidth, H = b.clientHeight, st = save.settings;
  const g = Math.max(4, Math.min(14, W * 0.012));
  let cw = Math.min((W - 8 * g) / 7, (H - 3 * g) / (1.4 * 3.05), 116);
  cw = Math.max(30, Math.floor(cw)); const ch = Math.round(cw * 1.4);
  const totalW = 7 * cw + 6 * g, x0 = Math.floor((W - totalW) / 2);
  const colX = i => x0 + i * (cw + g);
  const lefty = st.leftHanded;
  const pos = lefty ? { s: 6, w: 5, f: [0, 1, 2, 3] } : { s: 0, w: 1, f: [3, 4, 5, 6] };
  L = { W, H, g, cw, ch, colX, topY: g, tabY: g * 2 + ch, lefty, stockX: colX(pos.s), wasteX: colX(pos.w), fX: pos.f.map(colX), fan: cw * 0.3 * (lefty ? -1 : 1),
    downOff: ch * 0.12, upOff: ch * (st.large ? 0.33 : 0.27) * (H / ch > 7 ? 1.25 : 1) };
  b.style.setProperty('--cw', cw + 'px'); b.style.setProperty('--ch', ch + 'px');
}
function positions(s) {
  const P = new Array(52), l = L;
  s.stock.forEach((c, i) => { P[c] = { x: l.stockX, y: l.topY, z: 10 + i, up: false, buried: i < s.stock.length - 1 }; });
  const wn = s.waste.length, show = s.draw === 3 ? Math.min(3, wn) : 1;
  s.waste.forEach((c, i) => { const k = i - (wn - show); P[c] = { x: l.wasteX + (k > 0 ? k * l.fan : 0), y: l.topY, z: 100 + i, up: true, buried: k < 0 }; });
  s.found.forEach((f, fi) => f.forEach((c, i) => { P[c] = { x: l.fX[fi], y: l.topY, z: 200 + i, up: true, buried: i < f.length - 1 }; }));
  s.tab.forEach((col, i) => {
    const n = col.cards.length, up = n - col.down; let dOff = l.downOff, uOff = l.upOff;
    const need = col.down * dOff + Math.max(0, up - 1) * uOff, avail = l.H - l.tabY - l.ch - l.g;
    if (need > avail && need > 0) { const k = avail / need; dOff *= k; uOff *= k; }
    let y = l.tabY;
    col.cards.forEach((c, j) => { P[c] = { x: l.colX(i), y, z: 300 + j, up: j >= col.down }; y += j < col.down ? dOff : uOff; });
  });
  return P;
}
function slotRect(k) {
  if (k === 's') return { x: L.stockX, y: L.topY }; if (k === 'w') return { x: L.wasteX, y: L.topY };
  if (k[0] === 'f') return { x: L.fX[+k[1]], y: L.topY }; return { x: L.colX(+k.slice(1)), y: L.tabY };
}
function render(opts) {
  opts = opts || {};
  const s = hist.state, P = positions(s), st = save.settings;
  for (const k in slotEls) {
    const el = slotEls[k], r = slotRect(k); el.style.transform = `translate(${r.x}px,${r.y}px)`;
    let kind = el._kind; if (k === 's') kind = s.waste.length ? 'recycle' : 'empty';
    const img = kind === 'none' ? 'none' : A.url(A.slot(kind, st.theme, el._suit, st.colorblind));
    if (el._img !== kind + st.theme) { el.style.backgroundImage = img; el._img = kind + st.theme; }
  }
  for (let c = 0; c < 52; c++) {
    const el = cardEls[c], p = P[c], face = p.up ? 'u' : 'd';
    if (el._face !== face) {
      el.style.backgroundImage = p.up ? faces[c] : backUrl;
      if (el._face === 'd' && p.up && !opts.instant) { el.classList.remove('flipin'); void el.offsetWidth; el.classList.add('flipin'); }
      el._face = face; el.classList.toggle('down', !p.up);
    }
    const prev = lastPos[c], moved = !prev || prev.x !== p.x || prev.y !== p.y;
    if (opts.instant) el.style.transition = 'none';
    el.style.transform = `translate(${p.x}px,${p.y}px)`;
    if (moved && prev && !opts.instant) { el.style.zIndex = 1000 + p.z; clearTimeout(el._zt); el._zt = setTimeout(() => { el.style.zIndex = p.z; }, 230); }
    else { clearTimeout(el._zt); el.style.zIndex = p.z; }
    if (opts.instant) { void el.offsetWidth; el.style.transition = ''; }
    el.dataset.up = p.up ? '1' : '0';
    el.classList.toggle('buried', !!p.buried);
    lastPos[c] = p;
  }
  const sc = $('stock-count'); sc.textContent = s.stock.length || ''; sc.style.display = s.stock.length ? '' : 'none';
  sc.style.transform = `translate(${L.stockX + L.cw / 2 - 12}px,${L.topY + L.ch - 20}px)`;
  updateHud();
}
function updateHud() {
  const s = hist.state;
  $('hud-moves').textContent = s.moves; $('hud-score').textContent = s.score; $('hud-time').textContent = fmtTime(meta.elapsed);
  $('hud-mode').textContent = (meta.mode === 'daily' ? 'Daily · ' : '') + 'Draw ' + s.draw + (meta.mode === 'winnable' ? ' · Winnable' : '');
  $('hud-mode').title = 'Deal #' + s.seed;
  $('btn-undo').disabled = !hist.canUndo() || meta.won; $('btn-redo').disabled = !hist.canRedo() || meta.won;
  $('btn-hint').disabled = meta.won;
  const plan = !meta.won && C.faceDownCount(s) === 0 ? C.autoFinishPlan(s) : null;
  $('btn-auto').hidden = !plan;
}
const fmtTime = t => { t = Math.floor(t); const m = Math.floor(t / 60), s = t % 60; return m >= 60 ? Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0') + ':' + String(s).padStart(2, '0') : m + ':' + String(s).padStart(2, '0'); };

/* ---------------- game flow ---------------- */
function freshMeta(mode, daily) { return { mode, daily: daily || null, elapsed: 0, undos: 0, hints: 0, counted: false, won: false }; }
function pickWinnable(draw) { const list = draw === 3 ? SEEDS.d3 : SEEDS.d1; return list[Math.floor(Math.random() * list.length)]; }
function newDeal(o) {
  o = o || {};
  if (meta && meta.counted && !meta.won) C.recordLoss(save, meta.pid);
  const draw = o.draw || save.settings.draw; let seed, mode = o.mode || (save.settings.winnable ? 'winnable' : 'random'), daily = null;
  if (o.seed != null) seed = o.seed >>> 0;
  else if (mode === 'daily') { daily = C.dateKey(new Date()); seed = C.dailySeed(daily, draw === 3 ? SEEDS.d3 : SEEDS.d1); }
  else if (mode === 'winnable') seed = pickWinnable(draw);
  else seed = (Math.random() * 9000000 + 1000) | 0;
  if (mode === 'daily' && o.daily) daily = o.daily;
  hist = new C.History(C.newGame(seed, draw)); meta = freshMeta(mode, daily); stuckShownFor = -1;
  clearHints(); hideBanner(); closeAllModals();
  // deal animation: start all cards at the stock
  for (let c = 0; c < 52; c++) lastPos[c] = null;
  const s = hist.state;
  for (let c = 0; c < 52; c++) { const el = cardEls[c]; el.style.transition = 'none'; el.style.transform = `translate(${L.stockX}px,${L.topY}px)`; el.style.backgroundImage = backUrl; el._face = 'd'; }
  void $('board').offsetWidth;
  const P = positions(s); let order = 0;
  s.tab.forEach(col => col.cards.forEach(c => { cardEls[c].style.transitionDelay = (order++ * 22) + 'ms'; }));
  for (let c = 0; c < 52; c++) cardEls[c].style.transition = '';
  render(); Sfx.shuffle();
  setTimeout(() => { for (const el of cardEls) el.style.transitionDelay = ''; }, 1200);
  persist(); return P;
}
function play(mv, why) {
  if (meta.won || busy) return false;
  const before = hist.state, n = hist.play(mv);
  if (!n) { Sfx.bad(); return false; }
  lastMoveAt = performance.now();
  if (!meta.counted) { meta.counted = true; C.ensurePlayer(save); meta.pid = save.current; C.recordStart(save, meta.pid); }
  clearHints();
  if (mv.t === 'draw') Sfx.draw(); else if (mv.to.t === 'f') Sfx.found(); else Sfx.place();
  if (n.last && n.last.flipped >= 0) setTimeout(() => Sfx.flip(), 120);
  render(); afterMove(); return true;
}
function afterMove() {
  const s = hist.state;
  if (C.isWon(s)) { onWin(); return; }
  persist();
  if (hist.index !== stuckShownFor && C.isStuck(s)) { stuckShownFor = hist.index; showBanner('No more useful moves.', 'Undo', () => doUndo()); }
  else if (!C.isStuck(s)) hideBanner();
}
function doUndo() { if (busy || meta.won || !hist.canUndo()) return; hist.undo(); meta.undos++; clearHints(); hideBanner(); Sfx.place(); render(); persist(); }
function doRedo() { if (busy || meta.won || !hist.canRedo()) return; hist.redo(); clearHints(); Sfx.place(); render(); afterMove(); }
function doDraw() { const s = hist.state; if (!s.stock.length && !s.waste.length) { Sfx.bad(); return; } play({ t: 'draw' }); }

/* where is a card? */
function locate(s, c) {
  let i = s.stock.indexOf(c); if (i >= 0) return { t: 's', i };
  i = s.waste.indexOf(c); if (i >= 0) return { t: 'w', idx: i, top: i === s.waste.length - 1 };
  for (let f = 0; f < 4; f++) { i = s.found[f].indexOf(c); if (i >= 0) return { t: 'f', i: f, top: i === s.found[f].length - 1 }; }
  for (let t = 0; t < 7; t++) { i = s.tab[t].cards.indexOf(c); if (i >= 0) return { t: 't', i: t, idx: i, up: i >= s.tab[t].down, n: s.tab[t].cards.length - i }; }
  return null;
}
function sourceFor(c) {
  const s = hist.state, loc = locate(s, c); if (!loc) return null;
  if (loc.t === 'w' && loc.top) return { from: { t: 'w' }, n: 1, cards: [c] };
  if (loc.t === 'f' && loc.top) return { from: { t: 'f', i: loc.i }, n: 1, cards: [c] };
  if (loc.t === 't' && loc.up) return { from: { t: 't', i: loc.i }, n: loc.n, cards: s.tab[loc.i].cards.slice(loc.idx) };
  return null;
}
function smartMove(c) {
  const s = hist.state, src = sourceFor(c); if (!src) return null;
  const tryM = to => { const mv = { t: 'move', from: src.from, to, n: src.n }; return C.legal(s, mv) ? mv : null; };
  let mv = null;
  if (src.n === 1 && src.from.t !== 'f') mv = tryM({ t: 'f', i: C.suitOf(c) });
  if (!mv) {
    const order = []; for (let k = 1; k <= 7; k++) { const i = src.from.t === 't' ? (src.from.i + k) % 7 : k - 1; if (src.from.t === 't' && i === src.from.i) continue; order.push(i); }
    for (const i of order) if (s.tab[i].cards.length) { mv = tryM({ t: 't', i }); if (mv) break; }
    if (!mv) {
      const pointless = src.from.t === 't' && s.tab[src.from.i].down === 0 && s.tab[src.from.i].cards.length === src.n;
      if (!pointless) for (const i of order) if (!s.tab[i].cards.length) { mv = tryM({ t: 't', i }); if (mv) break; }
    }
  }
  return mv;
}
function foundationMove(c) { const src = sourceFor(c); if (!src || src.n !== 1 || src.from.t === 'f') return null; const mv = { t: 'move', from: src.from, to: { t: 'f', i: C.suitOf(c) }, n: 1 }; return C.legal(hist.state, mv) ? mv : null; }
function shake(c) { const el = cardEls[c]; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 350); }
function tapCard(c, pt) {
  if (meta.won || busy) return;
  if (performance.now() < tapLock && (!pt || !tapAt || Math.hypot(pt.x - tapAt.x, pt.y - tapAt.y) < 40)) return;
  tapAt = pt || null;
  const loc = locate(hist.state, c);
  if (loc && loc.t === 's') { doDraw(); tapLock = performance.now() + 180; return; }
  const mv = smartMove(c);
  if (mv) { play(mv, 'tap'); tapLock = performance.now() + 300; } else { shake(c); Sfx.bad(); }
}

/* ---------------- pointer input (mouse, touch, pen) ---------------- */
function boardPoint(e) { const r = $('board').getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
function onDown(e) {
  if (busy || meta.won || drag) return;
  if (e.button != null && e.button > 0) return;
  const el = e.target.closest('.card, .slot'); if (!el) return;
  e.preventDefault();
  try { $('board').setPointerCapture(e.pointerId); } catch (er) {}
  Sfx; const p = boardPoint(e);
  if (el.classList.contains('slot')) { drag = { slot: el.dataset.slot, pid: e.pointerId, sx: p.x, sy: p.y, started: false }; return; }
  const c = +el.dataset.id, src = sourceFor(c);
  drag = { c, pid: e.pointerId, sx: p.x, sy: p.y, started: false, src, type: e.pointerType };
}
function onMove(e) {
  if (!drag || e.pointerId !== drag.pid) return;
  const p = boardPoint(e), dx = p.x - drag.sx, dy = p.y - drag.sy;
  if (!drag.started) {
    if (!drag.src || Math.hypot(dx, dy) < (drag.type === 'touch' ? 9 : 5)) return;
    drag.started = true; clearHints();
    drag.items = drag.src.cards.map((c, i) => ({ c, x: lastPos[c].x, y: lastPos[c].y, el: cardEls[c] }));
    drag.items.forEach((it, i) => { it.el.classList.add('lift'); clearTimeout(it.el._zt); it.el.style.zIndex = 3000 + i; });
  }
  e.preventDefault();
  for (const it of drag.items) it.el.style.transform = `translate(${it.x + dx}px,${it.y + dy}px)`;
}
function dropTarget(lx, ly, src) {
  const s = hist.state, cw = L.cw, ch = L.ch; let best = null, bestA = 0;
  const consider = (to, x, y, h) => {
    const mv = { t: 'move', from: src.from, to, n: src.n }; if (!C.legal(s, mv)) return;
    const ox = Math.max(0, Math.min(lx + cw, x + cw) - Math.max(lx, x)), oy = Math.max(0, Math.min(ly + ch, y + h) - Math.max(ly, y)), a = ox * oy;
    if (a > bestA) { bestA = a; best = mv; }
  };
  if (src.n === 1) for (let f = 0; f < 4; f++) consider({ t: 'f', i: f }, L.fX[f], L.topY, ch);
  for (let i = 0; i < 7; i++) {
    const col = s.tab[i]; let y = L.tabY;
    if (col.cards.length) { const t = col.cards[col.cards.length - 1]; y = lastPos[t].y; }
    consider({ t: 't', i }, L.colX(i), y, ch + (col.cards.length ? L.upOff : 0));
  }
  return bestA > cw * ch * 0.08 ? best : null;
}
function onUp(e) {
  if (!drag || e.pointerId !== drag.pid) return;
  const d = drag; drag = null;
  try { $('board').releasePointerCapture(e.pointerId); } catch (er) {}
  if (d.slot) { if (d.slot === 's' && !d.started) { if (performance.now() >= tapLock || !tapAt || Math.hypot(d.sx - tapAt.x, d.sy - tapAt.y) >= 40) { doDraw(); tapLock = performance.now() + 180; tapAt = { x: d.sx, y: d.sy }; } } return; }
  if (!d.started) { tapCard(d.c, { x: d.sx, y: d.sy }); return; }
  for (const it of d.items) it.el.classList.remove('lift');
  const p = boardPoint(e), lead = d.items[0], mv = dropTarget(lead.x + p.x - d.sx, lead.y + p.y - d.sy, d.src);
  if (mv && play(mv, 'drag')) return;
  if (!mv) Sfx.bad();
  for (const it of d.items) lastPos[it.c] = { x: -9999, y: -9999 };
  render();
}
function onCancel(e) { if (!drag || e.pointerId !== drag.pid) return; const d = drag; drag = null; if (d.items) { for (const it of d.items) { it.el.classList.remove('lift'); lastPos[it.c] = null; } render(); } }

/* ---------------- hints, auto-finish ---------------- */
function clearHints() { clearTimeout(hintTimer); document.querySelectorAll('.hl').forEach(e => e.classList.remove('hl')); }
function showHint() {
  if (meta.won || busy) return; clearHints();
  const s = hist.state, h = C.hint(s);
  meta.hints++; persist();
  if (!h) { showBanner('No useful moves left. Try undo or a new deal.'); Sfx.bad(); return null; }
  const mv = h.move; const hl = [];
  if (mv.t === 'draw') hl.push(s.stock.length ? cardEls[s.stock[s.stock.length - 1]] : slotEls.s);
  else {
    const cards = C.picked(s, mv.from, mv.n); cards.forEach(c => hl.push(cardEls[c]));
    if (mv.to.t === 'f') { const f = s.found[mv.to.i]; hl.push(f.length ? cardEls[f[f.length - 1]] : slotEls['f' + mv.to.i]); }
    else { const col = s.tab[mv.to.i].cards; hl.push(col.length ? cardEls[col[col.length - 1]] : slotEls['t' + mv.to.i]); }
  }
  hl.forEach(e => e.classList.add('hl')); Sfx.hint();
  hintTimer = setTimeout(clearHints, 2200);
  return h;
}
function autoFinish() {
  if (busy || meta.won) return; const plan = C.autoFinishPlan(hist.state); if (!plan) return;
  busy = true; Sfx.autoStart(); clearHints(); let i = 0;
  const step = () => {
    if (i >= plan.length) { busy = false; return; }
    const mv = plan[i++]; busy = false; const ok = play(mv); busy = true;
    if (!ok || meta.won) { busy = false; return; }
    setTimeout(step, mv.t === 'draw' ? 70 : 95);
  };
  step();
}

/* ---------------- win, stats, stamps ---------------- */
function onWin() {
  meta.won = true; clearInterval(timerId);
  const s = hist.state, sec = Math.max(1, Math.round(meta.elapsed)), bonus = C.timeBonus(sec);
  const final = s.score + bonus;
  const res = C.recordWin(save, { pid: meta.pid, timeSec: sec, moves: s.moves, undos: meta.undos, hints: meta.hints, draw: s.draw, daily: meta.mode === 'daily' ? meta.daily : null, score: final });
  meta.final = final; meta.bonus = bonus; persist(); updateHud(); $('hud-score').textContent = final;
  celebrate(() => showWin(sec, final, bonus, res));
}
function stampName(a) { return save.settings.theme === 'air' ? a.air : a.cat; }
const STAMP_IC = { first: ['😺', '🛩️'], noundo: ['🧶', '🛬'], nohint: ['🐈', '🧭'], fast: ['💨', '🔥'], lean: ['🐾', '⛽'], draw3: ['👑', '🎖️'], streak3: ['🌀', '🔄'], daily: ['🌅', '🌄'], ten: ['🏠', '🎫'] };
const stampIc = id => STAMP_IC[id][save.settings.theme === 'air' ? 1 : 0];
function showWin(sec, final, bonus, res) {
  const s = hist.state, air = save.settings.theme === 'air';
  $('win-badge').textContent = air ? '🛬' : '😻';
  $('win-title').textContent = air ? 'Touchdown! Perfect landing.' : 'Purrfect! You won!';
  $('win-stats').innerHTML = [['Time', fmtTime(sec) + (res.records.includes('time') ? ' 🏆' : '')], ['Moves', s.moves + (res.records.includes('moves') ? ' 🏆' : '')], ['Score', final + (res.records.includes('score') ? ' 🏆' : '')],
    ['Time bonus', '+' + bonus], ['Win streak', winner().stats.streak], ['Games won', winner().stats.won]].map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('');
  $('win-stamps').innerHTML = res.newStamps.length ? '<h4>New stamps!</h4>' + res.newStamps.map(id => { const a = C.STAMPS.find(x => x.id === id); return `<div class="stamp got"><span class="s-ic">${stampIc(id)}</span><b>${stampName(a)}</b>${a.desc}</div>`; }).join('') : '';
  if (res.newStamps.length) setTimeout(() => Sfx.stamp(), 300);
  const wr = $('win-rank'); wr.hidden = !res.rank;
  if (res.rank) wr.textContent = (res.rank === 1 ? '🏆 New top score' : '🏅 High score #' + res.rank) + ' in Draw ' + s.draw + ', ' + winner().name + '!';
  lastRank = res.rank ? { draw: s.draw, rank: res.rank } : null;
  openModal('win-modal');
}
const winner = () => C.player(save, meta && meta.pid) || C.ensurePlayer(save);
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let statsTab = 'mine', lbDraw = 1, lastRank = null;
function renderStats() {
  const pl = C.ensurePlayer(save), t = pl.stats, pct = t.played ? Math.round(100 * t.won / t.played) : 0;
  $('stats-player').textContent = pl.name;
  $('stats-grid').innerHTML = [['Played', t.played], ['Won', t.won], ['Win rate', pct + '%'], ['Streak', t.streak], ['Best streak', t.bestStreak], ['Best time', t.bestTime == null ? '—' : fmtTime(t.bestTime)],
    ['Fewest moves', t.fewestMoves == null ? '—' : t.fewestMoves], ['Best score', t.bestScore], ['Daily wins', t.dailyDone.length], ['Draw 1 wins', t.wonDraw1], ['Draw 3 wins', t.wonDraw3], ['Stamps', Object.keys(pl.stamps).length + '/' + C.STAMPS.length]]
    .map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('');
  $('stamps').innerHTML = C.STAMPS.map(a => `<div class="stamp${pl.stamps[a.id] ? ' got' : ''}" data-stamp="${a.id}"><span class="s-ic">${stampIc(a.id)}</span><b>${stampName(a)}</b>${a.desc}</div>`).join('');
  $('stats-reset-confirm').hidden = true; $('stats-reset').hidden = false; $('lb-reset-confirm').hidden = true; $('lb-reset').hidden = false;
  const list = save.scores[lbDraw === 3 ? 'd3' : 'd1'];
  $('lb-d1').setAttribute('aria-checked', lbDraw === 1); $('lb-d3').setAttribute('aria-checked', lbDraw === 3);
  $('lb-body').innerHTML = list.map((e, i) => `<tr class="${e.pid === save.current ? 'me' : ''}${lastRank && lastRank.draw === lbDraw && lastRank.rank === i + 1 ? ' new' : ''}"><td>${i + 1}</td><td class="nm">${esc(e.name)}${e.daily ? ' 📅' : ''}</td><td><b>${e.score}</b></td><td>${fmtTime(e.time)}</td><td>${e.moves}</td><td>${e.date.slice(5)}</td></tr>`).join('');
  $('lb-empty').hidden = list.length > 0;
  $('pl-body').innerHTML = Object.keys(save.players).map(id => { const p = save.players[id], x = p.stats; return `<tr class="${id === save.current ? 'me' : ''}"><td class="nm">${esc(p.name)}</td><td>${x.played}</td><td>${x.won}</td><td>${x.played ? Math.round(100 * x.won / x.played) : 0}%</td><td>${x.streak}</td><td>${x.bestStreak}</td><td>${x.bestTime == null ? '—' : fmtTime(x.bestTime)}</td></tr>`; }).join('');
  for (const tb of ['mine', 'scores', 'players']) { $('tab-' + tb).setAttribute('aria-selected', statsTab === tb); $('panel-' + tb).hidden = statsTab !== tb; }
}
function renderPlayers() {
  $('players-list').innerHTML = Object.keys(save.players).map(id => { const p = save.players[id], cur = id === save.current;
    return `<div class="player-row${cur ? ' cur' : ''}" data-pid="${id}"><span class="pn"><b>${cur ? '★ ' : ''}${esc(p.name)}</b><small>${p.stats.won} wins · ${p.stats.played} games</small></span>${cur ? '<small>Playing</small>' : `<button type="button" data-play="${id}">Play as</button>`}</div>`; }).join('');
  $('pl-add').disabled = Object.keys(save.players).length >= C.MAX_PLAYERS;
  $('players-list').querySelectorAll('[data-play]').forEach(b => b.onclick = () => { C.switchPlayer(save, b.dataset.play); persist(); updatePlayerUI(); renderPlayers(); toast('👤 Now playing: ' + C.player(save).name); });
}
function updatePlayerUI() { const p = C.player(save); const n = p ? p.name : 'Player'; $('hud-player-name').textContent = n; $('set-player-name').textContent = n; }
let nameMode = 'first';
function askName(mode) {
  nameMode = mode; const p = C.player(save);
  $('name-title').textContent = mode === 'add' ? 'Add a player' : mode === 'rename' ? 'Change your name' : 'Who’s playing?';
  $('name-input').value = mode === 'rename' && p ? p.name : ''; $('name-error').hidden = true;
  $('name-cancel').hidden = mode === 'first';
  openModal('name-modal'); setTimeout(() => { try { $('name-input').focus(); } catch (e) {} }, 50);
}
function submitName() {
  const v = C.cleanName($('name-input').value), err = m => { $('name-error').textContent = m; $('name-error').hidden = false; };
  if (!v) return err('Please type a name.');
  if (nameMode === 'rename') { if (!C.renamePlayer(save, save.current, v)) return err('Another player already has that name.'); }
  else { const exists = Object.values(save.players).some(p => p.name.toLowerCase() === v.toLowerCase()); const id = C.addPlayer(save, v); if (!id) return err('That’s the most players this device can hold.'); if (exists && nameMode === 'add') toast('👤 Switched to ' + C.player(save).name); }
  persist(); updatePlayerUI(); const first = nameMode === 'first'; closeAllModals();
  if (nameMode !== 'first') toast('👤 Now playing: ' + C.player(save).name);
  if (first && !save.settings.seenHelp) { save.settings.seenHelp = true; persist(); openModal('help-modal'); }
}

/* ---------------- celebrations ---------------- */
function celebrate(done) {
  const cv = $('fx'), ctx = cv.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = innerWidth, H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cv.classList.add('on'); Sfx.win();
  const air = save.settings.theme === 'air', imgs = [], cw = Math.max(34, Math.min(70, W / 12)), chh = cw * 1.4;
  for (const c of [0, 13, 26, 39, 12, 25, 38, 51, 11, 24]) { const im = new Image(); im.src = faces[c].slice(5, -2); imgs.push(im); }
  const plane = new Image(); plane.src = A.url(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80">${A.airliner('#f2c14e')}</svg>`).slice(5, -2);
  const parts = [], start = performance.now(), DUR = 4300; let raf = 0, finished = false;
  const finish = () => { if (finished) return; finished = true; cancelAnimationFrame(raf); cv.classList.remove('on'); ctx.clearRect(0, 0, W, H); cv.onclick = null; done(); };
  cv.onclick = () => { if (performance.now() - start > 700) finish(); };
  const cats = [0, 1, 2].map(i => ({ x: -160 - i * 190, y: H * (0.55 + i * 0.13), sp: W / 2.6 + i * 40, col: ['#f29a46', '#9aa1ab', '#2c2c31'][i], ph: i }));
  const balls = [0, 1, 2].map(i => ({ x: -40 - i * 190, y: 0, im: imgs[i * 3 % imgs.length], rot: 0 }));
  function drawCat(k, t) {
    const leg = Math.sin(t * 18 + k.ph) * 10; ctx.save(); ctx.translate(k.x, k.y); ctx.fillStyle = k.col; ctx.strokeStyle = k.col; ctx.lineCap = 'round';
    ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-34, -6); ctx.quadraticCurveTo(-62, -30 + leg, -54, -48); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 38, 17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 8; [[-24, leg], [-12, -leg], [16, -leg], [28, leg]].forEach(([x, d]) => { ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x + d, 30); ctx.stroke(); });
    ctx.beginPath(); ctx.arc(40, -14, 16, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(30, -24); ctx.lineTo(32, -42); ctx.lineTo(42, -28); ctx.moveTo(44, -28); ctx.lineTo(54, -40); ctx.lineTo(54, -22); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(46, -17, 3.5, 0, 7); ctx.fill(); ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(47, -17, 2, 0, 7); ctx.fill();
    ctx.restore();
  }
  function frame(now) {
    const t = (now - start) / 1000; ctx.clearRect(0, 0, W, H);
    if (air) {
      const passes = [{ t0: 0, y: H * 0.32, roll: false, dir: 1 }, { t0: 1.6, y: H * 0.6, roll: true, dir: -1 }];
      for (const ps of passes) {
        const u = (t - ps.t0) / 2.4; if (u < 0 || u > 1.15) continue;
        const x = ps.dir > 0 ? -220 + u * (W + 440) : W + 220 - u * (W + 440), y = ps.y + Math.sin(u * Math.PI * 2) * H * 0.05;
        if (Math.random() < 0.7) parts.push({ x: x - ps.dir * 70, y: y + 10, vx: -ps.dir * (20 + Math.random() * 40), vy: 30 + Math.random() * 60, r: Math.random() * 6, vr: (Math.random() - .5) * 6, im: imgs[(Math.random() * imgs.length) | 0], life: 0, trail: true });
        ctx.save(); ctx.translate(x, y); if (ps.dir < 0) ctx.scale(-1, 1);
        if (ps.roll) { const a = Math.max(0, Math.min(1, (u - 0.35) / 0.3)) * Math.PI * 2; ctx.scale(1, Math.cos(a)); }
        ctx.drawImage(plane, -110, -44, 220, 88); ctx.restore();
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const k = cats[i], b = balls[i]; k.x += k.sp / 60; b.x = k.x + 120; const hop = Math.abs(Math.sin(t * 5 + i)) * H * 0.18;
        b.y = k.y - 30 - hop; b.rot += 0.12;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot); if (b.im.complete) ctx.drawImage(b.im, -cw / 2, -chh / 2, cw, chh); ctx.restore();
        drawCat(k, t);
        if (Math.random() < 0.15) parts.push({ x: k.x, y: k.y + 30, paw: true, life: 0 });
      }
      if (Math.random() < 0.4) parts.push({ x: Math.random() * W, y: -60, vx: (Math.random() - .5) * 40, vy: 90 + Math.random() * 80, r: 0, vr: (Math.random() - .5) * 4, im: imgs[(Math.random() * imgs.length) | 0], life: 0 });
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life += 1 / 60;
      if (p.paw) { ctx.globalAlpha = Math.max(0, 1 - p.life / 1.5); ctx.fillStyle = '#fff4e2'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 7, 6, 0, 0, 7); ctx.fill(); [-8, -3, 3, 8].forEach((dx, j) => { ctx.beginPath(); ctx.arc(p.x + dx, p.y - 9 - (j % 3 === 0 ? 0 : 3), 2.6, 0, 7); ctx.fill(); }); ctx.globalAlpha = 1; if (p.life > 1.5) parts.splice(i, 1); continue; }
      p.x += p.vx / 60; p.y += p.vy / 60; p.r += p.vr / 60;
      if (p.trail) { ctx.globalAlpha = Math.max(0, 0.6 - p.life * 0.25); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x + 10, p.y - 4, 10 + p.life * 14, 0, 7); ctx.fill(); }
      ctx.globalAlpha = Math.max(0, 1 - p.life / 2.6); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); if (p.im && p.im.complete) ctx.drawImage(p.im, -cw / 3, -chh / 3, cw / 1.5, chh / 1.5); ctx.restore(); ctx.globalAlpha = 1;
      if (p.life > 2.6 || p.y > H + 80) parts.splice(i, 1);
    }
    if (now - start < DUR) raf = requestAnimationFrame(frame); else finish();
  }
  raf = requestAnimationFrame(frame);
  setTimeout(finish, DUR + 1500); // safety if rAF is throttled
}

/* ---------------- modals, banner, toast ---------------- */
let modalPrev = null;
function openModal(id) {
  closeAllModals(true); const m = $(id); if (!m) return;
  if (id === 'stats-modal') { if (lastRank && meta.won) { statsTab = 'scores'; lbDraw = lastRank.draw; } renderStats(); }
  if (id === 'players-modal') renderPlayers();
  if (id === 'settings-modal') { syncSettingsUI(); updatePlayerUI(); }
  if (id === 'new-modal') syncNewUI();
  if (id === 'about-modal') $('about-copy').textContent = 'Copy email';
  modalPrev = document.activeElement; m.hidden = false;
  const f = m.querySelector('button.primary, button'); try { f && f.focus({ preventScroll: true }); } catch (e) {}
}
function closeAllModals(keepFocus) {
  if (!$('name-modal').hidden && nameMode === 'first' && !C.player(save)) { C.ensurePlayer(save); persist(); updatePlayerUI(); } let was = false; document.querySelectorAll('.modal').forEach(m => { if (!m.hidden) was = true; m.hidden = true; }); if (was && !keepFocus && modalPrev) try { modalPrev.focus({ preventScroll: true }); } catch (e) {} return was; }
const anyModal = () => [...document.querySelectorAll('.modal')].some(m => !m.hidden);
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200); }
function showBanner(msg, label, fn) {
  const b = $('banner'); b.innerHTML = ''; b.append(document.createTextNode(msg));
  if (label) { const bt = document.createElement('button'); bt.type = 'button'; bt.textContent = label; bt.onclick = ev => { ev.stopPropagation(); hideBanner(); fn(); }; b.append(bt); }
  b.classList.add('show'); clearTimeout(bannerTimer); bannerTimer = setTimeout(hideBanner, 6000);
}
function hideBanner() { $('banner').classList.remove('show'); }
function syncSettingsUI() {
  const st = save.settings;
  $('set-theme-cat').setAttribute('aria-checked', st.theme === 'cat'); $('set-theme-air').setAttribute('aria-checked', st.theme === 'air');
  $('set-sound').checked = st.sound; $('set-left').checked = st.leftHanded; $('set-large').checked = st.large; $('set-cb').checked = st.colorblind; $('set-winnable').checked = st.winnable;
}
function syncNewUI() {
  const st = save.settings;
  $('nd-draw1').setAttribute('aria-checked', st.draw === 1); $('nd-draw3').setAttribute('aria-checked', st.draw === 3);
  $('nd-winnable').checked = st.winnable; $('nd-forfeit').hidden = !(meta.counted && !meta.won);
}
function setTheme(th) {
  if (save.settings.theme === th) return; save.settings.theme = th; buildArt(); render({ instant: true }); persist(); Sfx.theme();
  syncSettingsUI(); toast(th === 'air' ? '✈️ Aviation theme — cleared for takeoff!' : '🐱 Cat theme — meow!');
}
function applyVisualSettings() { buildArt(); computeLayout(); render({ instant: true }); persist(); }

/* ---------------- timer ---------------- */
function startTimer() {
  clearInterval(timerId); let lastT = performance.now();
  timerId = setInterval(() => {
    const now = performance.now(), dt = (now - lastT) / 1000; lastT = now;
    if (meta.counted && !meta.won && !document.hidden && dt < 5) { meta.elapsed += dt; $('hud-time').textContent = fmtTime(meta.elapsed); if (Math.floor(meta.elapsed) % 10 === 0) persist(); }
  }, 500);
}

/* ---------------- about ---------------- */
function copyDevEmail() {
  const btn = $('about-copy'); let finished = false;
  const finish = fail => { if (finished) return; finished = true; btn.textContent = fail ? 'Select the email above' : 'Copied ✓'; };
  try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(DEV_EMAIL).then(() => finish(false), () => fallback()); setTimeout(() => finish(true), 800); return; } } catch (e) {}
  fallback();
  function fallback() { try { const ta = document.createElement('textarea'); ta.value = DEV_EMAIL; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); finish(!ok); } catch (e) { finish(true); } }
}

/* ---------------- wiring ---------------- */
function init() {
  const wasCorrupt = loadAll();
  initBoard(); buildArt(); computeLayout();
  if (save.game) { hist = new C.History(null, save.game.list, save.game.index); meta = Object.assign(freshMeta('random'), save.game); delete meta.list; delete meta.index; render({ instant: true }); if (meta.won) $('hud-score').textContent = meta.final || hist.state.score; }
  else { meta = null; newDeal({}); }
  updatePlayerUI();
  if (!C.player(save)) askName('first');
  else if (!save.settings.seenHelp) { save.settings.seenHelp = true; persist(); openModal('help-modal'); }
  if (wasCorrupt) toast('Saved data could not be read, so a fresh game was started.');
  startTimer();
  const b = $('board');
  b.addEventListener('pointerdown', onDown); b.addEventListener('pointermove', onMove); b.addEventListener('pointerup', onUp); b.addEventListener('pointercancel', onCancel);
  b.addEventListener('lostpointercapture', e => { if (drag && drag.pid === e.pointerId) onCancel(e); });
  b.addEventListener('dblclick', e => { const el = e.target.closest('.card'); if (!el || performance.now() - lastMoveAt < 600) return; const mv = foundationMove(+el.dataset.id); if (mv) play(mv); });
  b.addEventListener('contextmenu', e => e.preventDefault());
  $('btn-new').onclick = () => openModal('new-modal');
  $('btn-undo').onclick = doUndo; $('btn-redo').onclick = doRedo; $('btn-hint').onclick = showHint; $('btn-auto').onclick = autoFinish;
  $('btn-stats').onclick = () => openModal('stats-modal'); $('btn-menu').onclick = () => openModal('menu-modal');
  $('btn-about-foot').onclick = () => openModal('about-modal');
  $('btn-help').onclick = () => openModal('help-modal'); $('btn-about').onclick = () => openModal('about-modal');
  $('btn-theme').onclick = () => setTheme(save.settings.theme === 'air' ? 'cat' : 'air');
  const syncSound = () => { $('btn-sound').textContent = save.settings.sound ? '🔊' : '🔇'; $('btn-sound').setAttribute('aria-pressed', save.settings.sound); };
  $('btn-sound').onclick = () => { save.settings.sound = !save.settings.sound; syncSound(); persist(); if (save.settings.sound) Sfx.place(); toast(save.settings.sound ? 'Sound on' : 'Sound off'); };
  syncSound();
  document.querySelectorAll('.modal').forEach(m => { m.addEventListener('click', e => { if (e.target === m || e.target.closest('.close')) closeAllModals(); }); });
  document.querySelectorAll('[data-open]').forEach(bt => bt.onclick = () => openModal(bt.dataset.open));
  $('menu-daily').onclick = () => newDeal({ mode: 'daily' });
  document.querySelectorAll('#new-modal [data-draw]').forEach(bt => bt.onclick = () => { save.settings.draw = +bt.dataset.draw; syncNewUI(); persist(); });
  $('nd-winnable').onchange = e => { save.settings.winnable = e.target.checked; persist(); };
  $('nd-deal').onclick = () => newDeal({});
  $('nd-daily').onclick = () => newDeal({ mode: 'daily' });
  document.querySelectorAll('#settings-modal [data-theme]').forEach(bt => bt.onclick = () => setTheme(bt.dataset.theme));
  $('set-sound').onchange = e => { save.settings.sound = e.target.checked; syncSound(); persist(); };
  $('set-left').onchange = e => { save.settings.leftHanded = e.target.checked; applyVisualSettings(); };
  $('set-large').onchange = e => { save.settings.large = e.target.checked; applyVisualSettings(); };
  $('set-cb').onchange = e => { save.settings.colorblind = e.target.checked; applyVisualSettings(); };
  $('set-winnable').onchange = e => { save.settings.winnable = e.target.checked; persist(); };
  $('stats-reset').onclick = () => { $('stats-reset-confirm').hidden = false; $('stats-reset').hidden = true; };
  $('stats-reset-no').onclick = () => { $('stats-reset-confirm').hidden = true; $('stats-reset').hidden = false; };
  $('stats-reset-yes').onclick = () => { C.resetPlayerStats(save); persist(); renderStats(); toast('Stats cleared'); };
  $('lb-reset').onclick = () => { $('lb-reset-confirm').hidden = false; $('lb-reset').hidden = true; };
  $('lb-reset-no').onclick = () => { $('lb-reset-confirm').hidden = true; $('lb-reset').hidden = false; };
  $('lb-reset-yes').onclick = () => { C.resetScores(save); lastRank = null; persist(); renderStats(); toast('High scores cleared'); };
  document.querySelectorAll('#stats-modal [data-tab]').forEach(b => b.onclick = () => { statsTab = b.dataset.tab; renderStats(); });
  document.querySelectorAll('#stats-modal [data-lb]').forEach(b => b.onclick = () => { lbDraw = +b.dataset.lb; renderStats(); });
  $('stats-switch').onclick = () => openModal('players-modal');
  $('hud-player').onclick = () => openModal('players-modal'); $('set-player-btn').onclick = () => openModal('players-modal');
  $('pl-add').onclick = () => askName('add'); $('pl-rename').onclick = () => askName('rename');
  $('name-ok').onclick = submitName; $('name-input').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submitName(); } });
  $('win-new').onclick = () => newDeal({});
  $('about-copy').onclick = copyDevEmail;
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (closeAllModals()) e.preventDefault(); return; }
    if (anyModal() || e.altKey || e.metaKey) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase(), ctrl = e.ctrlKey;
    if ((k === 'z' && ctrl && !e.shiftKey) || (k === 'u' && !ctrl)) { e.preventDefault(); doUndo(); }
    else if ((k === 'y' && ctrl) || (k === 'z' && ctrl && e.shiftKey) || (k === 'r' && !ctrl)) { e.preventDefault(); doRedo(); }
    else if (ctrl) return;
    else if (k === 'h') showHint();
    else if (k === 'n') openModal('new-modal');
    else if (k === ' ' || k === 'd') { e.preventDefault(); if (!busy && !meta.won) doDraw(); }
    else if (k === 'a') autoFinish();
    else if (k === 't') setTheme(save.settings.theme === 'air' ? 'cat' : 'air');
    else if (k === 'm') $('btn-sound').click();
    else if (k === '?') openModal('help-modal');
  });
  let rz = 0; const relayout = () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { computeLayout(); render({ instant: true }); }); };
  window.addEventListener('resize', relayout); window.addEventListener('orientationchange', relayout);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', relayout);
  document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
  window.addEventListener('pagehide', persist);
  window.__PL = { core: C, state: () => hist.state, meta: () => meta, save: () => save, hist: () => hist, layout: () => L, busy: () => busy,
    cardBox: c => { const r = cardEls[c].getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; },
    slotBox: k => { const r = slotEls[k].getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; },
    newDeal, sounds: Sfx.log, suspendSave: () => { noSave = true; }, hint: () => C.hint(hist.state), smartMove, version: APP_VERSION };
}
