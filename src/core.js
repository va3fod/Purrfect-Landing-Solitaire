/* Purrfect Landing Solitaire — rules engine, solver, history, save/load, stats & stamps.
   Pure JS, no DOM. Works in the browser (window.PLCore) and in Node (require). */
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m; else root.PLCore = m;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const SUITS = ['S', 'H', 'D', 'C'];              // 0 ♠  1 ♥  2 ♦  3 ♣
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const suitOf = c => (c / 13) | 0, rankOf = c => (c % 13) + 1;
  const isRed = c => { const s = suitOf(c); return s === 1 || s === 2; };
  const cardName = c => RANKS[rankOf(c) - 1] + SUITS[suitOf(c)];

  /* ---------- seeded deck ---------- */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffledDeck(seed) {
    const r = rng(seed), d = []; for (let i = 0; i < 52; i++) d.push(i);
    for (let i = 51; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = d[i]; d[i] = d[j]; d[j] = t; }
    return d;
  }
  function newGame(seed, draw) {
    seed = seed >>> 0; const d = shuffledDeck(seed); let k = 0; const tab = [];
    for (let i = 0; i < 7; i++) { const cards = []; for (let j = 0; j <= i; j++) cards.push(d[k++]); tab.push({ cards, down: i }); }
    return { seed, draw: draw === 3 ? 3 : 1, tab, found: [[], [], [], []], stock: d.slice(k).reverse(), waste: [], moves: 0, score: 0, recycles: 0 };
  }
  function clone(s) {
    return { seed: s.seed, draw: s.draw, tab: s.tab.map(c => ({ cards: c.cards.slice(), down: c.down })), found: s.found.map(f => f.slice()),
      stock: s.stock.slice(), waste: s.waste.slice(), moves: s.moves, score: s.score, recycles: s.recycles };
  }

  /* ---------- rules ---------- */
  const SCORE = { wasteToTab: 5, toFound: 10, flip: 5, foundToTab: -15, recycle1: -100, recycle3: -20 };
  const top = a => a.length ? a[a.length - 1] : -1;
  function canFound(s, c) { const f = s.found[suitOf(c)]; return rankOf(c) === f.length + 1; }
  function canTab(s, c, i) {
    const col = s.tab[i]; if (!col.cards.length) return rankOf(c) === 13;
    const t = top(col.cards); return col.down < col.cards.length && isRed(t) !== isRed(c) && rankOf(t) === rankOf(c) + 1;
  }
  /* cards that would leave `from` when moving n cards (n only matters for tableau) */
  function picked(s, from, n) {
    if (!from) return null;
    if (from.t === 'w') return s.waste.length ? [top(s.waste)] : null;
    if (from.t === 'f') { const f = s.found[from.i]; return f && f.length ? [top(f)] : null; }
    if (from.t === 't') {
      const col = s.tab[from.i]; if (!col) return null; n = n || 1;
      if (n < 1 || n > col.cards.length - col.down) return null;
      return col.cards.slice(col.cards.length - n);
    }
    return null;
  }
  function legal(s, mv) {
    if (!mv) return false;
    if (mv.t === 'draw') return s.stock.length > 0 || s.waste.length > 0;
    if (mv.t !== 'move' || !mv.to) return false;
    const cards = picked(s, mv.from, mv.n); if (!cards) return false;
    const lead = cards[0];
    if (mv.to.t === 'f') return cards.length === 1 && mv.to.i === suitOf(lead) && mv.from.t !== 'f' && canFound(s, lead);
    if (mv.to.t === 't') { if (!s.tab[mv.to.i] || (mv.from.t === 't' && mv.from.i === mv.to.i)) return false; return canTab(s, lead, mv.to.i); }
    return false;
  }
  /* returns a NEW state, or null if illegal. Adds s.last = {flipped, recycled} info. */
  function apply(s, mv) {
    if (!legal(s, mv)) return null;
    const n = clone(s); n.moves++; let gained = 0; const info = { flipped: -1, recycled: false };
    if (mv.t === 'draw') {
      if (n.stock.length) { const k = Math.min(n.draw, n.stock.length); for (let i = 0; i < k; i++) n.waste.push(n.stock.pop()); }
      else {
        n.stock = n.waste.reverse(); n.waste = []; info.recycled = true;
        if (n.draw === 1 ? n.recycles >= 1 : n.recycles >= 3) gained += n.draw === 1 ? SCORE.recycle1 : SCORE.recycle3;
        n.recycles++;
      }
    } else {
      const cnt = mv.from.t === 't' ? (mv.n || 1) : 1; let cards;
      if (mv.from.t === 'w') cards = [n.waste.pop()];
      else if (mv.from.t === 'f') cards = [n.found[mv.from.i].pop()];
      else cards = n.tab[mv.from.i].cards.splice(n.tab[mv.from.i].cards.length - cnt, cnt);
      if (mv.to.t === 'f') n.found[mv.to.i].push(cards[0]); else n.tab[mv.to.i].cards.push(...cards);
      if (mv.to.t === 'f') gained += SCORE.toFound;
      else if (mv.from.t === 'w') gained += SCORE.wasteToTab;
      else if (mv.from.t === 'f') gained += SCORE.foundToTab;
      if (mv.from.t === 't') {
        const col = n.tab[mv.from.i];
        if (col.down > 0 && col.down >= col.cards.length) { col.down = col.cards.length - 1; info.flipped = col.cards[col.down]; gained += SCORE.flip; }
      }
    }
    n.score = Math.max(0, n.score + gained); n.last = info;
    return n;
  }
  const isWon = s => s.found.every(f => f.length === 13);
  const faceDownCount = s => s.tab.reduce((a, c) => a + c.down, 0);

  /* every legal move (draw last) */
  function listMoves(s) {
    const out = [];
    const tryMv = mv => { if (legal(s, mv)) out.push(mv); };
    for (let i = 0; i < 7; i++) {
      const col = s.tab[i];
      if (col.cards.length > col.down) tryMv({ t: 'move', from: { t: 't', i }, to: { t: 'f', i: suitOf(top(col.cards)) }, n: 1 });
      for (let n = 1; n <= col.cards.length - col.down; n++) for (let j = 0; j < 7; j++) if (j !== i) tryMv({ t: 'move', from: { t: 't', i }, to: { t: 't', i: j }, n });
    }
    if (s.waste.length) {
      const c = top(s.waste); tryMv({ t: 'move', from: { t: 'w' }, to: { t: 'f', i: suitOf(c) }, n: 1 });
      for (let j = 0; j < 7; j++) tryMv({ t: 'move', from: { t: 'w' }, to: { t: 't', i: j }, n: 1 });
    }
    for (let f = 0; f < 4; f++) if (s.found[f].length) for (let j = 0; j < 7; j++) tryMv({ t: 'move', from: { t: 'f', i: f }, to: { t: 't', i: j }, n: 1 });
    tryMv({ t: 'draw' });
    return out;
  }

  /* ---------- auto-finish: only foundation moves + draws; returns plan or null ---------- */
  function autoFinishPlan(s0) {
    if (isWon(s0) || faceDownCount(s0) > 0) return null;
    let s = s0; const plan = []; let idle = 0;
    const limit = 2 * (s.stock.length + s.waste.length + 2) + 8;
    while (!isWon(s)) {
      let mv = null;
      for (let i = 0; i < 7 && !mv; i++) { const c = top(s.tab[i].cards); if (c >= 0 && canFound(s, c)) mv = { t: 'move', from: { t: 't', i }, to: { t: 'f', i: suitOf(c) }, n: 1 }; }
      if (!mv && s.waste.length && canFound(s, top(s.waste))) mv = { t: 'move', from: { t: 'w' }, to: { t: 'f', i: suitOf(top(s.waste)) }, n: 1 };
      if (mv) idle = 0; else { if (!(s.stock.length || s.waste.length) || ++idle > limit) return null; mv = { t: 'draw' }; }
      s = apply(s, mv); plan.push(mv);
    }
    return plan;
  }

  /* ---------- solver (sound, not complete: a found solution is always valid) ---------- */
  function talonReach(s) {
    const res = [], seen = new Set(), seenCards = new Set();
    let st = s.stock.slice(), wa = s.waste.slice(), draws = 0;
    if (wa.length) { res.push({ draws: 0, stock: st.slice(), waste: wa.slice(), recycles: s.recycles }); seenCards.add(top(wa)); }
    if (!st.length && !wa.length) return res;
    let rec = s.recycles; seen.add(wa.length + ':' + 0);
    for (let guard = 0; guard < 200; guard++) {
      if (st.length) { const k = Math.min(s.draw, st.length); for (let i = 0; i < k; i++) wa.push(st.pop()); }
      else { st = wa.reverse(); wa = []; rec++; }
      draws++;
      const key = wa.length + ':' + (draws > 0 ? 1 : 0);
      if (wa.length === s.waste.length && st.length === s.stock.length) break;
      if (seen.has(key) && guard > 0) break; seen.add(key);
      if (wa.length && !seenCards.has(top(wa))) { seenCards.add(top(wa)); res.push({ draws, stock: st.slice(), waste: wa.slice(), recycles: rec }); }
    }
    return res;
  }
  function stateKey(s) {
    const cols = s.tab.map(c => c.down + ':' + c.cards.join(',')).sort();
    return cols.join('|') + '#' + s.found.map(f => f.length).join(',') + '#' + s.stock.join(',') + '/' + s.waste.join(',');
  }
  function safeToFound(s, c) {
    if (!canFound(s, c)) return false; const r = rankOf(c); if (r <= 2) return true;
    const red = isRed(c); const opp = red ? [0, 3] : [1, 2];
    return Math.min(s.found[opp[0]].length, s.found[opp[1]].length) >= r - 1;
  }
  function children(s) {
    const out = []; // {moves, state, pri}
    const push = (moves, pri) => { let t = s; for (const m of moves) { t = apply(t, m); if (!t) return; } out.push({ moves, state: t, pri }); };
    const firstEmpty = s.tab.findIndex(c => !c.cards.length);
    // tableau sources
    for (let i = 0; i < 7; i++) {
      const col = s.tab[i], L = col.cards.length; if (L === col.down) continue;
      const tc = col.cards[L - 1];
      if (canFound(s, tc)) push([{ t: 'move', from: { t: 't', i }, to: { t: 'f', i: suitOf(tc) }, n: 1 }], L - 1 === col.down && col.down ? 90 + col.down : 70);
      for (let k = col.down; k < L; k++) {
        const c = col.cards[k], n = L - k;
        for (let j = 0; j < 7; j++) {
          if (j === i) continue; const dst = s.tab[j];
          if (!dst.cards.length && j !== firstEmpty) continue;
          if (!canTab(s, c, j)) continue;
          let pri;
          if (k === col.down) {
            if (col.down > 0) pri = 60 + col.down;                       // reveals a card
            else if (!dst.cards.length) continue;                        // king shuffle between empties: useless
            else pri = 20;                                               // empties a column
          } else {
            const under = col.cards[k - 1];
            if (canFound(s, under)) pri = 50; else continue;             // exposes a foundation card
          }
          push([{ t: 'move', from: { t: 't', i }, to: { t: 't', i: j }, n }], pri);
        }
      }
    }
    // talon
    for (const r of talonReach(s)) {
      const pre = []; for (let d = 0; d < r.draws; d++) pre.push({ t: 'draw' });
      const c = top(r.waste), cost = r.draws ? 1 : 0;
      if (canFoundAfter(s, c)) push(pre.concat([{ t: 'move', from: { t: 'w' }, to: { t: 'f', i: suitOf(c) }, n: 1 }]), 65 - cost);
      for (let j = 0; j < 7; j++) {
        if (!s.tab[j].cards.length && j !== firstEmpty) continue;
        if (canTab(s, c, j)) push(pre.concat([{ t: 'move', from: { t: 'w' }, to: { t: 't', i: j }, n: 1 }]), 40 - cost);
      }
    }
    // foundation -> tableau (lets a waiting card land)
    for (let f = 0; f < 4; f++) {
      const c = top(s.found[f]); if (c < 0 || rankOf(c) < 3) continue;
      for (let j = 0; j < 7; j++) if (s.tab[j].cards.length && canTab(s, c, j)) push([{ t: 'move', from: { t: 'f', i: f }, to: { t: 't', i: j }, n: 1 }], 5);
    }
    out.sort((a, b) => b.pri - a.pri);
    return out;
  }
  function canFoundAfter(s, c) { return rankOf(c) === s.found[suitOf(c)].length + 1; }
  function solve(start, opts) {
    opts = opts || {}; const maxNodes = opts.maxNodes || 100000;
    const seen = new Set(); let nodes = 0, aborted = false; const path = [];
    function forced(s) {
      let moved = true;
      while (moved) {
        moved = false;
        for (let i = 0; i < 7; i++) { const col = s.tab[i]; const c = top(col.cards); if (c >= 0 && col.cards.length > col.down && safeToFound(s, c)) { const m = { t: 'move', from: { t: 't', i }, to: { t: 'f', i: suitOf(c) }, n: 1 }; s = apply(s, m); path.push(m); moved = true; } }
        const w = top(s.waste); if (w >= 0 && safeToFound(s, w)) { const m = { t: 'move', from: { t: 'w' }, to: { t: 'f', i: suitOf(w) }, n: 1 }; s = apply(s, m); path.push(m); moved = true; }
      }
      return s;
    }
    function dfs(s) {
      if (aborted) return false;
      const mark = path.length; s = forced(s);
      if (isWon(s)) return true;
      if (faceDownCount(s) === 0) { const plan = autoFinishPlan(s); if (plan) { path.push(...plan); return true; } }
      const k = stateKey(s); if (seen.has(k)) { path.length = mark; return false; }
      seen.add(k); if (++nodes > maxNodes) { aborted = true; path.length = mark; return false; }
      for (const ch of children(s)) {
        const m2 = path.length; path.push(...ch.moves);
        if (dfs(ch.state)) return true;
        path.length = m2; if (aborted) break;
      }
      path.length = mark; return false;
    }
    const ok = dfs(clone(start));
    return { solved: ok, moves: ok ? path.slice() : null, nodes, exhausted: !ok && !aborted };
  }
  function replay(s, moves) { for (const m of moves) { s = apply(s, m); if (!s) return null; } return s; }

  /* ---------- hint ---------- */
  function hint(s, opts) {
    if (isWon(s)) return null;
    const r = solve(s, { maxNodes: (opts && opts.maxNodes) || 6000 });
    if (r.solved && r.moves.length) return { move: r.moves[0], source: 'solver' };
    const ch = children(s).filter(c => c.moves.length === 1);
    if (ch.length) return { move: ch[0].moves[0], source: 'heuristic' };
    if (talonReach(s).some(t => t.draws > 0)) return { move: { t: 'draw' }, source: 'heuristic' };
    return null;
  }
  /* true when nothing productive is left (only cycling the stock, no playable card anywhere) */
  function isStuck(s) {
    if (isWon(s)) return false;
    const mv = listMoves(s).filter(m => m.t !== 'draw' && !(m.from.t === 'f'));
    const useful = mv.filter(m => !(m.from.t === 't' && m.to.t === 't' && s.tab[m.from.i].down === s.tab[m.from.i].cards.length - m.n && s.tab[m.from.i].down === 0 && !s.tab[m.to.i].cards.length));
    if (useful.length) return false;
    for (const r of talonReach(s)) { const c = top(r.waste); if (canFound(s, c)) return false; for (let j = 0; j < 7; j++) if (canTab(s, c, j)) return false; }
    return true;
  }

  /* ---------- history (unlimited undo/redo) ---------- */
  class History {
    constructor(state, list, index) { this.list = list || [state]; this.index = index == null ? this.list.length - 1 : index; this.undos = 0; }
    get state() { return this.list[this.index]; }
    play(mv) { const n = apply(this.state, mv); if (!n) return null; this.list.length = this.index + 1; this.list.push(n); this.index++; return n; }
    canUndo() { return this.index > 0; }
    canRedo() { return this.index < this.list.length - 1; }
    undo() { if (!this.canUndo()) return null; this.index--; this.undos++; return this.state; }
    redo() { if (!this.canRedo()) return null; this.index++; return this.state; }
  }

  /* ---------- validation, save / load ---------- */
  function validState(s) {
    try {
      if (!s || typeof s !== 'object' || !Array.isArray(s.tab) || s.tab.length !== 7 || !Array.isArray(s.found) || s.found.length !== 4) return false;
      if (!Array.isArray(s.stock) || !Array.isArray(s.waste) || (s.draw !== 1 && s.draw !== 3)) return false;
      const all = [];
      for (const c of s.tab) { if (!c || !Array.isArray(c.cards) || !Number.isInteger(c.down) || c.down < 0 || (c.cards.length ? c.down >= c.cards.length : c.down !== 0)) return false; all.push(...c.cards); }
      for (let f = 0; f < 4; f++) { const a = s.found[f]; if (!Array.isArray(a)) return false; for (let r = 0; r < a.length; r++) if (a[r] !== f * 13 + r) return false; all.push(...a); }
      all.push(...s.stock, ...s.waste);
      if (all.length !== 52) return false;
      const set = new Set(all); if (set.size !== 52) return false;
      for (const c of all) if (!Number.isInteger(c) || c < 0 || c > 51) return false;
      return ['moves', 'score', 'recycles'].every(k => Number.isFinite(s[k]) && s[k] >= 0);
    } catch (e) { return false; }
  }
  const DEFAULT_SETTINGS = { theme: 'cat', draw: 1, winnable: true, sound: true, leftHanded: false, large: false, colorblind: false, seenHelp: false };
  function defaultStats() { return { played: 0, won: 0, streak: 0, bestStreak: 0, bestTime: null, fewestMoves: null, bestScore: 0, wonDraw1: 0, wonDraw3: 0, dailyDone: [] }; }
  function defaultSave() { return { v: 2, settings: Object.assign({}, DEFAULT_SETTINGS), players: {}, current: null, scores: { d1: [], d3: [] }, game: null }; }
  const num = (v, d, min, max) => (Number.isFinite(v) && v >= (min == null ? -Infinity : min) && v <= (max == null ? Infinity : max) ? v : d);
  const MAX_PLAYERS = 12, MAX_SCORES = 10;
  function cleanName(n) { if (typeof n !== 'string') return ''; return n.replace(/[\u0000-\u001f\u007f<>&"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20); }
  function sanitizeStats(s) {
    s = s && typeof s === 'object' ? s : {}; const d = defaultStats();
    for (const k of ['played', 'won', 'streak', 'bestStreak', 'bestScore', 'wonDraw1', 'wonDraw3']) d[k] = Math.floor(num(s[k], 0, 0, 1e9));
    d.bestTime = s.bestTime == null ? null : num(s.bestTime, null, 0, 1e7);
    d.fewestMoves = s.fewestMoves == null ? null : num(s.fewestMoves, null, 0, 1e7);
    if (d.won > d.played) d.played = d.won;
    if (d.bestStreak < d.streak) d.bestStreak = d.streak;
    if (Array.isArray(s.dailyDone)) d.dailyDone = s.dailyDone.filter(x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)).slice(-60);
    return d;
  }
  function sanitizeStamps(st) { const o = {}; if (st && typeof st === 'object') for (const a of STAMPS) if (Number.isFinite(st[a.id])) o[a.id] = st[a.id]; return o; }
  function validScore(e) { return e && typeof e === 'object' && cleanName(e.name) && Number.isFinite(e.score) && e.score >= 0 && Number.isFinite(e.time) && e.time >= 0 && Number.isInteger(e.moves) && e.moves >= 0 && typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date); }
  const scoreOrder = (a, b) => b.score - a.score || a.time - b.time || a.moves - b.moves || a.at - b.at;
  function sanitize(raw) {
    const out = defaultSave(); if (!raw || typeof raw !== 'object') return out;
    const st = raw.settings || {};
    out.settings.theme = st.theme === 'air' ? 'air' : 'cat';
    out.settings.draw = st.draw === 3 ? 3 : 1;
    for (const k of ['winnable', 'sound', 'leftHanded', 'large', 'colorblind', 'seenHelp']) if (typeof st[k] === 'boolean') out.settings[k] = st[k];
    if (raw.players && typeof raw.players === 'object' && !Array.isArray(raw.players)) {
      for (const id of Object.keys(raw.players)) {
        if (Object.keys(out.players).length >= MAX_PLAYERS) break;
        const p = raw.players[id]; if (!p || typeof p !== 'object' || !/^[\w-]{1,40}$/.test(id)) continue;
        out.players[id] = { name: cleanName(p.name) || 'Player', stats: sanitizeStats(p.stats), stamps: sanitizeStamps(p.stamps), created: num(p.created, 0, 0) };
      }
    } else if (raw.stats || raw.stamps) {                       // v1 save: single unnamed player
      out.players.p1 = { name: 'Player', stats: sanitizeStats(raw.stats), stamps: sanitizeStamps(raw.stamps), created: 0 };
    }
    out.current = typeof raw.current === 'string' && out.players[raw.current] ? raw.current : (Object.keys(out.players)[0] || null);
    if (raw.scores && typeof raw.scores === 'object') for (const k of ['d1', 'd3']) if (Array.isArray(raw.scores[k]))
      out.scores[k] = raw.scores[k].filter(validScore).map(e => ({ name: cleanName(e.name), pid: typeof e.pid === 'string' ? e.pid : null, score: Math.floor(e.score), time: Math.floor(e.time), moves: e.moves, date: e.date, at: num(e.at, 0, 0), daily: !!e.daily }))
        .sort(scoreOrder).slice(0, MAX_SCORES);
    const g = raw.game;
    if (g && typeof g === 'object' && Array.isArray(g.list) && g.list.length && g.list.every(validState) && Number.isInteger(g.index) && g.index >= 0 && g.index < g.list.length) {
      out.game = { list: g.list, index: g.index, mode: ['random', 'winnable', 'daily'].includes(g.mode) ? g.mode : 'random', daily: typeof g.daily === 'string' ? g.daily : null,
        elapsed: num(g.elapsed, 0, 0, 1e8), undos: Math.floor(num(g.undos, 0, 0, 1e9)), hints: Math.floor(num(g.hints, 0, 0, 1e9)), counted: !!g.counted, won: !!g.won,
        pid: typeof g.pid === 'string' && out.players[g.pid] ? g.pid : null, final: num(g.final, 0, 0) };
    }
    return out;
  }
  /* ---------- players ---------- */
  function addPlayer(save, name, now) {
    name = cleanName(name); if (!name) return null;
    const ex = Object.keys(save.players).find(id => save.players[id].name.toLowerCase() === name.toLowerCase());
    if (ex) { save.current = ex; return ex; }
    if (Object.keys(save.players).length >= MAX_PLAYERS) return null;
    let id; do { id = 'p' + Math.floor(Math.random() * 1e9).toString(36); } while (save.players[id]);
    save.players[id] = { name, stats: defaultStats(), stamps: {}, created: now || Date.now() }; save.current = id; return id;
  }
  function renamePlayer(save, id, name) {
    name = cleanName(name); const p = save.players[id]; if (!p || !name) return false;
    if (Object.keys(save.players).some(k => k !== id && save.players[k].name.toLowerCase() === name.toLowerCase())) return false;
    p.name = name; for (const k of ['d1', 'd3']) for (const e of save.scores[k]) if (e.pid === id) e.name = name; return true;
  }
  function switchPlayer(save, id) { if (!save.players[id]) return false; save.current = id; return true; }
  function removePlayer(save, id) {
    if (!save.players[id] || Object.keys(save.players).length <= 1) return false;
    delete save.players[id]; if (save.current === id) save.current = Object.keys(save.players)[0]; return true;
  }
  const player = (save, pid) => save.players[pid] || save.players[save.current] || null;
  function ensurePlayer(save) { if (!player(save)) addPlayer(save, 'Player'); return player(save); }
  function addScore(save, draw, e) {
    const k = draw === 3 ? 'd3' : 'd1', list = save.scores[k];
    const entry = { name: cleanName(e.name) || 'Player', pid: e.pid || null, score: Math.floor(e.score), time: Math.floor(e.time), moves: e.moves, date: e.date, at: e.at || Date.now(), daily: !!e.daily };
    list.push(entry); list.sort(scoreOrder); save.scores[k] = list.slice(0, MAX_SCORES);
    const rank = save.scores[k].indexOf(entry) + 1; return rank;
  }
  function resetScores(save) { save.scores = { d1: [], d3: [] }; }
  function resetPlayerStats(save, pid) { const p = player(save, pid); if (p) { p.stats = defaultStats(); p.stamps = {}; } }
  /* parse a raw localStorage string. corrupt=true when it existed but could not be read. */
  function loadSave(str) {
    if (str == null || str === '') return { data: defaultSave(), corrupt: false };
    try { const raw = JSON.parse(str); if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('bad'); return { data: sanitize(raw), corrupt: false }; }
    catch (e) { return { data: defaultSave(), corrupt: true }; }
  }

  /* ---------- stats & stamps ---------- */
  const STAMPS = [
    { id: 'first', cat: 'Cat Nap', air: 'First Solo', desc: 'Win your first game' },
    { id: 'noundo', cat: 'Nine Lives Spare', air: 'Clean Landing', desc: 'Win without using undo' },
    { id: 'nohint', cat: 'Sharp Whiskers', air: 'Instrument Rated', desc: 'Win without a hint' },
    { id: 'fast', cat: 'Zoomies', air: 'Afterburner', desc: 'Win in under 3 minutes' },
    { id: 'lean', cat: 'Light Paws', air: 'Fuel Saver', desc: 'Win in 110 moves or fewer' },
    { id: 'draw3', cat: 'Top Cat', air: 'Ace Pilot', desc: 'Win a Draw 3 game' },
    { id: 'streak3', cat: 'Purr Streak', air: 'Barrel Roll', desc: 'Win 3 games in a row' },
    { id: 'daily', cat: 'Morning Stretch', air: 'Dawn Patrol', desc: 'Finish a daily challenge' },
    { id: 'ten', cat: 'Clowder Captain', air: 'Frequent Flyer', desc: 'Win 10 games' }
  ];
  /* g: {timeSec, moves, undos, hints, draw, daily(date|null), score, pid?, date?}. Updates the player's stats & stamps and the leaderboard. */
  function recordWin(save, g, now) {
    const p = ensurePlayer(save, g.pid); const pl = save.players[g.pid] ? save.players[g.pid] : p, s = pl.stats, rec = [];
    s.won++; if (s.played < s.won) s.played = s.won;
    s.streak++; if (s.streak > s.bestStreak) s.bestStreak = s.streak;
    if (g.draw === 3) s.wonDraw3++; else s.wonDraw1++;
    if (s.bestTime == null || g.timeSec < s.bestTime) { if (s.bestTime != null) rec.push('time'); s.bestTime = g.timeSec; }
    if (s.fewestMoves == null || g.moves < s.fewestMoves) { if (s.fewestMoves != null) rec.push('moves'); s.fewestMoves = g.moves; }
    if (g.score > s.bestScore) { if (s.bestScore > 0) rec.push('score'); s.bestScore = g.score; }
    if (g.daily && !s.dailyDone.includes(g.daily)) { s.dailyDone.push(g.daily); s.dailyDone = s.dailyDone.slice(-60); }
    const earn = [];
    const want = { first: true, noundo: g.undos === 0, nohint: g.hints === 0, fast: g.timeSec < 180, lean: g.moves <= 110, draw3: g.draw === 3, streak3: s.streak >= 3, daily: !!g.daily, ten: s.won >= 10 };
    for (const a of STAMPS) if (want[a.id] && !pl.stamps[a.id]) { pl.stamps[a.id] = now || Date.now(); earn.push(a.id); }
    const pid = Object.keys(save.players).find(k => save.players[k] === pl);
    const rank = addScore(save, g.draw, { name: pl.name, pid, score: g.score, time: g.timeSec, moves: g.moves, date: g.date || dateKey(new Date(now || Date.now())), at: now, daily: !!g.daily });
    return { records: rec, newStamps: earn, rank };
  }
  function recordStart(save, pid) { ensurePlayer(save).stats; player(save, pid).stats.played++; }
  function recordLoss(save, pid) { const p = player(save, pid); if (p) p.stats.streak = 0; }
  function timeBonus(sec) { return sec >= 30 ? Math.round(700000 / sec) : 0; }

  /* ---------- daily / winnable seeds ---------- */
  function dateKey(d) { const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  function hashStr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function dailySeed(key, list) { const h = hashStr('purrfect-' + key); return list && list.length ? list[h % list.length] : h; }

  return { SUITS, RANKS, suitOf, rankOf, isRed, cardName, rng, shuffledDeck, newGame, clone, SCORE, canFound, canTab, picked, legal, apply, isWon, faceDownCount,
    listMoves, autoFinishPlan, talonReach, stateKey, solve, replay, hint, isStuck, History, validState, DEFAULT_SETTINGS, defaultStats, defaultSave, sanitize, loadSave,
    STAMPS, recordWin, recordStart, recordLoss, cleanName, addPlayer, renamePlayer, switchPlayer, removePlayer, player, ensurePlayer, addScore, resetScores, resetPlayerStats, MAX_PLAYERS, MAX_SCORES, timeBonus, dateKey, hashStr, dailySeed };
});
