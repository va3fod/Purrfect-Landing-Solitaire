// Unit tests for the rules engine: node --test tests/
const test = require('node:test'), assert = require('node:assert/strict');
const C = require('../src/core.js'), SEEDS = require('../src/seeds.json');
const card = (r, s) => s * 13 + r - 1;            // r 1..13, s 0♠ 1♥ 2♦ 3♣
const S = 0, H = 1, D = 2, CL = 3;
const mv = (from, to, n) => ({ t: 'move', from, to, n: n || 1 });
const T = i => ({ t: 't', i }), F = i => ({ t: 'f', i }), W = { t: 'w' };
/* build a custom state; any card not placed goes to the stock (or foundations when fill=true) */
function make(o) {
  const s = { seed: 1, draw: o.draw || 1, tab: [], found: [[], [], [], []], stock: [], waste: o.waste || [], moves: 0, score: o.score || 0, recycles: o.recycles || 0 };
  for (let i = 0; i < 7; i++) { const c = (o.tab || [])[i] || { cards: [], down: 0 }; s.tab.push({ cards: c.cards.slice(), down: c.down || 0 }); }
  if (o.found) o.found.forEach((n, f) => { for (let r = 0; r < n; r++) s.found[f].push(f * 13 + r); });
  const used = new Set([...s.tab.flatMap(c => c.cards), ...s.found.flat(), ...s.waste, ...(o.stock || [])]);
  s.stock = (o.stock || []).slice(); for (let c = 0; c < 52; c++) if (!used.has(c)) s.stock.unshift(c);
  return s;
}

test('deck: seeded shuffle is a deterministic permutation', () => {
  const a = C.shuffledDeck(42), b = C.shuffledDeck(42), c = C.shuffledDeck(43);
  assert.equal(new Set(a).size, 52); assert.deepEqual(a, b); assert.notDeepEqual(a, c);
  assert.deepEqual([...a].sort((x, y) => x - y), [...Array(52).keys()]);
});
test('deck: rng is in [0,1) and well spread', () => {
  const r = C.rng(7); let lo = 0; for (let i = 0; i < 10000; i++) { const v = r(); assert.ok(v >= 0 && v < 1); if (v < .5) lo++; }
  assert.ok(lo > 4700 && lo < 5300);
});
test('deal: 7 columns 1..7 cards, top face up, 24 in stock', () => {
  for (const seed of [1, 99, 123456]) {
    const s = C.newGame(seed, 1);
    s.tab.forEach((c, i) => { assert.equal(c.cards.length, i + 1); assert.equal(c.down, i); });
    assert.equal(s.stock.length, 24); assert.equal(s.waste.length, 0); assert.ok(C.validState(s));
  }
  assert.equal(C.newGame(5, 3).draw, 3); assert.equal(C.newGame(5, 2).draw, 1);
});
test('rules: foundation needs Ace first then same suit in order', () => {
  const s = make({ found: [0, 1, 0, 0] });
  assert.ok(C.canFound(s, card(1, S))); assert.ok(!C.canFound(s, card(2, S)));
  assert.ok(C.canFound(s, card(2, H))); assert.ok(!C.canFound(s, card(3, H))); assert.ok(!C.canFound(s, card(1, H)));
});
test('rules: tableau needs alternating colour, one lower; empty takes only a King', () => {
  const s = make({ tab: [{ cards: [card(8, S)] }, { cards: [] }] });
  assert.ok(C.canTab(s, card(7, H), 0)); assert.ok(C.canTab(s, card(7, D), 0));
  assert.ok(!C.canTab(s, card(7, CL), 0)); assert.ok(!C.canTab(s, card(6, H), 0)); assert.ok(!C.canTab(s, card(9, H), 0));
  assert.ok(C.canTab(s, card(13, H), 1)); assert.ok(!C.canTab(s, card(12, H), 1));
});
test('moves: runs move together; face-down cards cannot be picked', () => {
  const s = make({ tab: [{ cards: [card(5, D), card(9, S), card(8, H), card(7, CL)], down: 1 }, { cards: [card(10, H)] }] });
  assert.ok(C.legal(s, mv(T(0), T(1), 3)));
  assert.ok(!C.legal(s, mv(T(0), T(1), 4)));            // includes a face-down card
  assert.ok(!C.legal(s, mv(T(0), T(1), 2)));            // 8♥ on 10♥ is wrong
  const n = C.apply(s, mv(T(0), T(1), 3));
  assert.deepEqual(n.tab[1].cards, [card(10, H), card(9, S), card(8, H), card(7, CL)]);
  assert.equal(n.tab[0].down, 0); assert.equal(n.last.flipped, card(5, D)); assert.equal(n.score, 5); assert.equal(n.moves, 1);
});
test('moves: illegal moves rejected and never mutate the state', () => {
  const s = make({ tab: [{ cards: [card(3, H)] }, { cards: [card(3, S)] }], found: [2, 1, 0, 0] });
  const snap = JSON.stringify(s);
  assert.equal(C.apply(s, mv(T(0), T(1))), null);                // same rank
  assert.equal(C.apply(s, mv(T(0), T(0))), null);                // same column
  assert.equal(C.apply(s, mv(T(0), F(0))), null);                // wrong foundation pile
  assert.equal(C.apply(s, mv(F(0), F(2))), null);                // foundation to foundation
  assert.equal(C.apply(s, mv(T(5), T(0))), null);                // empty source
  assert.equal(C.apply(s, { t: 'jump' }), null); assert.equal(C.apply(s, null), null);
  assert.equal(JSON.stringify(s), snap);
  const n = C.apply(s, mv(T(1), F(0))); assert.ok(n); assert.equal(JSON.stringify(s), snap);
});
test('scoring: waste→table +5, →foundation +10, foundation→table −15, floor at 0', () => {
  let s = make({ tab: [{ cards: [card(8, S)] }, { cards: [card(4, CL)] }], waste: [card(7, H)], found: [0, 0, 3, 0] });
  s = C.apply(s, mv(W, T(0))); assert.equal(s.score, 5);
  s = C.apply(s, mv(F(2), T(1))); assert.equal(s.score, 0);       // 5 − 15 → floored at 0
  s.score = 30; s = C.apply(s, mv(T(1), F(2))); assert.equal(s.score, 40);
  let w = make({ waste: [card(1, H)] }); w = C.apply(w, mv(W, F(1))); assert.equal(w.score, 10);
});
test('stock: draw 1 turns one card, draw 3 turns three (third is on top)', () => {
  const s1 = C.newGame(9, 1), a = C.apply(s1, { t: 'draw' });
  assert.equal(a.waste.length, 1); assert.equal(a.waste[0], s1.stock[23]); assert.equal(a.stock.length, 23);
  const s3 = C.newGame(9, 3), b = C.apply(s3, { t: 'draw' });
  assert.deepEqual(b.waste, [s3.stock[23], s3.stock[22], s3.stock[21]]);
  const short = make({ draw: 3, stock: [card(2, S), card(3, S)], tab: [] });
  const keep = short.stock.slice(-2); short.stock = keep; // only 2 cards left
  const z = C.apply(Object.assign(short, { tab: short.tab }), { t: 'draw' });
  assert.equal(z.waste.length, 2); assert.equal(z.stock.length, 0);
});
test('stock: recycling keeps the order, and repeats the same sequence', () => {
  for (const draw of [1, 3]) {
    let s = C.newGame(77, draw); const seq1 = [];
    while (s.stock.length) { s = C.apply(s, { t: 'draw' }); seq1.push(s.waste[s.waste.length - 1]); }
    const wasteBefore = s.waste.slice();
    s = C.apply(s, { t: 'draw' }); assert.ok(s.last.recycled); assert.equal(s.waste.length, 0); assert.deepEqual(s.stock, wasteBefore.slice().reverse());
    const seq2 = []; while (s.stock.length) { s = C.apply(s, { t: 'draw' }); seq2.push(s.waste[s.waste.length - 1]); }
    assert.deepEqual(seq2, seq1);
  }
});
test('stock: recycle penalties (draw 1 after first pass −100, draw 3 after third −20)', () => {
  const cycle = s => { while (s.stock.length) s = C.apply(s, { t: 'draw' }); return C.apply(s, { t: 'draw' }); };
  let s = C.newGame(3, 1); s.score = 500; s = cycle(s); assert.equal(s.score, 500); s = cycle(s); assert.equal(s.score, 400); assert.equal(s.recycles, 2);
  let t = C.newGame(3, 3); t.score = 500; for (let i = 0; i < 3; i++) t = cycle(t); assert.equal(t.score, 500); t = cycle(t); assert.equal(t.score, 480);
});
test('stock: drawing with empty stock and waste is illegal', () => {
  const s = make({ tab: [] }); s.stock = []; s.found = [[], [], [], []];
  assert.equal(C.legal(s, { t: 'draw' }), false);
});
test('history: unlimited undo/redo returns exact states', () => {
  const h = new C.History(C.newGame(2024, 3)), r = C.rng(5), snaps = [JSON.stringify(h.state)];
  for (let i = 0; i < 400; i++) { const ms = C.listMoves(h.state); if (!ms.length) break; const m = ms[Math.floor(r() * ms.length)]; assert.ok(h.play(m)); snaps.push(JSON.stringify(h.state)); }
  const end = snaps.length - 1;
  for (let i = end - 1; i >= 0; i--) { h.undo(); assert.equal(JSON.stringify(h.state), snaps[i]); }
  assert.equal(h.undo(), null); assert.equal(h.undos, end);
  for (let i = 1; i <= end; i++) { h.redo(); assert.equal(JSON.stringify(h.state), snaps[i]); }
  assert.equal(h.redo(), null);
});
test('history: a new move after undo drops the redo branch; illegal play is ignored', () => {
  const h = new C.History(C.newGame(11, 1)); h.play({ t: 'draw' }); h.play({ t: 'draw' }); h.undo();
  assert.ok(h.canRedo()); h.play({ t: 'draw' }); assert.ok(!h.canRedo()); assert.equal(h.list.length, 3);
  const before = h.index; assert.equal(h.play(mv(T(0), T(0))), null); assert.equal(h.index, before);
});
test('history: every state in a long random game stays valid (52 unique cards)', () => {
  for (const seed of [1, 2, 3]) { let s = C.newGame(seed, seed === 2 ? 3 : 1); const r = C.rng(seed);
    for (let i = 0; i < 300; i++) { const ms = C.listMoves(s); s = C.apply(s, ms[Math.floor(r() * ms.length)]); assert.ok(C.validState(s)); } }
});
test('win: detected only when all 52 cards are home', () => {
  const won = make({ found: [13, 13, 13, 13] }); assert.ok(C.isWon(won));
  const almost = make({ found: [13, 13, 13, 12], tab: [{ cards: [card(13, CL)] }] }); assert.ok(!C.isWon(almost));
  const n = C.apply(almost, mv(T(0), F(3))); assert.ok(C.isWon(n));
});
test('auto-finish: all face up → plan that really wins', () => {
  const s = make({ found: [9, 9, 9, 9], tab: [{ cards: [card(13, S), card(12, H), card(11, S), card(10, H)] }, { cards: [card(13, H), card(12, S), card(11, H), card(10, S)] }, { cards: [card(13, D), card(12, CL)] }, { cards: [card(13, CL), card(12, D), card(11, CL)] }], waste: [card(10, D)], stock: [card(11, D), card(10, CL)] });
  assert.ok(C.validState(s));
  const plan = C.autoFinishPlan(s); assert.ok(plan); const end = C.replay(s, plan); assert.ok(end && C.isWon(end));
  assert.ok(plan.every(m => m.t === 'draw' || m.to.t === 'f'));
});
test('auto-finish: not offered while face-down cards remain or when already won', () => {
  assert.equal(C.autoFinishPlan(C.newGame(1, 1)), null); assert.equal(C.autoFinishPlan(make({ found: [13, 13, 13, 13] })), null);
});
test('auto-finish: random near-end states never produce an invalid plan', () => {
  const r = C.rng(99);
  for (let k = 0; k < 200; k++) {
    const draw = k % 2 ? 3 : 1, f = [0, 1, 2, 3].map(() => 6 + Math.floor(r() * 7)), rest = [];
    for (let s = 0; s < 4; s++) for (let rr = f[s] + 1; rr <= 13; rr++) rest.push(card(rr, s));
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    const st = make({ draw, found: f, tab: [], stock: rest }); const plan = C.autoFinishPlan(st);
    if (plan) assert.ok(C.isWon(C.replay(st, plan)));
    else assert.equal(draw, 3);                       // draw 1 can always cycle to every card
  }
});
test('solver: solutions replay to a win in both draw modes', () => {
  for (const [draw, list] of [[1, SEEDS.d1], [3, SEEDS.d3]]) for (const seed of list.slice(0, 8)) {
    const s = C.newGame(seed, draw), r = C.solve(s, { maxNodes: 40000 }); assert.ok(r.solved, 'seed ' + seed);
    const end = C.replay(s, r.moves); assert.ok(end && C.isWon(end));
  }
});
test('winnable deals: list is unique and a random sample is re-verified by the solver', () => {
  for (const [draw, list] of [[1, SEEDS.d1], [3, SEEDS.d3]]) {
    assert.ok(list.length >= 300); assert.equal(new Set(list).size, list.length); assert.ok(list.every(Number.isInteger));
    const r = C.rng(draw * 31);
    for (let k = 0; k < 25; k++) { const seed = list[Math.floor(r() * list.length)], s = C.newGame(seed, draw), res = C.solve(s, { maxNodes: 40000 }); assert.ok(res.solved && C.isWon(C.replay(s, res.moves)), 'seed ' + seed); }
  }
});
test('solver: respects the node budget and reports it', () => {
  const r = C.solve(C.newGame(SEEDS.d3[0], 3), { maxNodes: 5 }); assert.ok(r.nodes <= 6); if (!r.solved) assert.equal(r.exhausted, false);
});
test('talon reach: draw 3 only exposes every third card on first pass', () => {
  const s = C.newGame(4, 3), reach = C.talonReach(s), tops = reach.map(x => x.waste[x.waste.length - 1]);
  assert.ok(tops.includes(s.stock[21])); assert.ok(!tops.includes(s.stock[22]) || tops.length > 8);
  for (const x of reach) { let t = s; for (let i = 0; i < x.draws; i++) t = C.apply(t, { t: 'draw' }); assert.deepEqual(t.waste, x.waste); }
});
test('hint: legal suggestion on a fresh deal; none when won', () => {
  for (const seed of [SEEDS.d1[3], 12345, 777]) { const s = C.newGame(seed, 1), h = C.hint(s); assert.ok(h && C.legal(s, h.move)); }
  assert.equal(C.hint(make({ found: [13, 13, 13, 13] })), null);
});
test('stuck: detects a dead end, not a fresh deal', () => {
  assert.equal(C.isStuck(C.newGame(SEEDS.d1[0], 1)), false);
  // two blocked columns, nothing in stock: 2♠ and 2♥ wait on red/black 3s and Aces that are buried
  const hid = r => [card(r, S), card(r, H)];
  const s = make({ found: [0, 0, 13, 13], tab: [{ cards: [card(1, H), ...[3, 4, 5, 6, 7, 8].flatMap(hid), card(2, S)], down: 13 },
    { cards: [card(1, S), ...[9, 10, 11, 12, 13].flatMap(hid), card(2, H)], down: 11 }] });
  assert.ok(C.validState(s)); assert.equal(s.stock.length, 0); assert.ok(C.isStuck(s));
});
test('save: missing, corrupt and wrong-shaped data fall back to defaults', () => {
  assert.equal(C.loadSave(null).corrupt, false); assert.deepEqual(C.loadSave(null).data, C.defaultSave());
  for (const bad of ['{oops', 'null', '[1,2]', '"str"', '42']) { const r = C.loadSave(bad); assert.equal(r.corrupt, true, bad); assert.deepEqual(r.data, C.defaultSave()); }
});
test('save: fields are sanitised', () => {
  const r = C.loadSave(JSON.stringify({ settings: { theme: 'xyz', draw: 2, sound: 'yes', leftHanded: true, large: 1, colorblind: true }, stats: { played: -4, won: 9, streak: 'a', bestTime: -1, dailyDone: ['2026-11-20', 'bad', 5] }, stamps: { first: 123, hacker: 1, nohint: 'x' } }));
  const d = r.data; assert.equal(r.corrupt, false);
  assert.equal(d.settings.theme, 'cat'); assert.equal(d.settings.draw, 1); assert.equal(d.settings.sound, true); assert.equal(d.settings.leftHanded, true); assert.equal(d.settings.large, false); assert.equal(d.settings.colorblind, true);
  const pl = d.players[d.current];                       // v1 save migrates into one player
  assert.equal(pl.name, 'Player'); assert.equal(pl.stats.played, 9); assert.equal(pl.stats.won, 9); assert.equal(pl.stats.streak, 0); assert.equal(pl.stats.bestTime, null); assert.deepEqual(pl.stats.dailyDone, ['2026-11-20']);
  assert.deepEqual(pl.stamps, { first: 123 });
});
test('save: valid game round-trips; tampered games are dropped', () => {
  const h = new C.History(C.newGame(8, 3)); h.play({ t: 'draw' }); h.play({ t: 'draw' });
  const good = { settings: { theme: 'air', draw: 3 }, game: { list: h.list, index: 1, mode: 'daily', daily: '2026-11-20', elapsed: 33, undos: 1, hints: 2, counted: true } };
  const d = C.loadSave(JSON.stringify(good)).data;
  assert.equal(d.settings.theme, 'air'); assert.equal(d.game.index, 1); assert.equal(d.game.mode, 'daily'); assert.deepEqual(d.game.list, JSON.parse(JSON.stringify(h.list)));
  const dup = JSON.parse(JSON.stringify(good)); dup.game.list[0].stock[0] = dup.game.list[0].stock[1];
  assert.equal(C.loadSave(JSON.stringify(dup)).data.game, null);
  const idx = JSON.parse(JSON.stringify(good)); idx.game.index = 9; assert.equal(C.loadSave(JSON.stringify(idx)).data.game, null);
  const badF = JSON.parse(JSON.stringify(good)); badF.game.list[0].found[0] = [5]; assert.equal(C.loadSave(JSON.stringify(badF)).data.game, null);
});
test('validState: rejects broken states', () => {
  const s = C.newGame(1, 1); assert.ok(C.validState(s));
  const a = C.clone(s); a.tab[3].down = 9; assert.ok(!C.validState(a));
  const b = C.clone(s); b.stock.pop(); assert.ok(!C.validState(b));
  const c = C.clone(s); c.draw = 2; assert.ok(!C.validState(c));
  const d = C.clone(s); d.stock[0] = 60; assert.ok(!C.validState(d));
  assert.ok(!C.validState(null)); assert.ok(!C.validState({}));
});
test('stats: wins, streaks, records and stamps (per player)', () => {
  const sv = C.defaultSave(); C.addPlayer(sv, 'Val'); const st = () => C.player(sv).stats, sp = () => C.player(sv).stamps;
  C.recordStart(sv); let r = C.recordWin(sv, { timeSec: 150, moves: 100, undos: 0, hints: 0, draw: 1, daily: null, score: 900 }, 1);
  assert.deepEqual(r.newStamps.sort(), ['fast', 'first', 'lean', 'nohint', 'noundo'].sort()); assert.deepEqual(r.records, []); assert.equal(r.rank, 1);
  assert.equal(st().won, 1); assert.equal(st().streak, 1); assert.equal(st().bestTime, 150);
  C.recordStart(sv); r = C.recordWin(sv, { timeSec: 400, moves: 90, undos: 3, hints: 1, draw: 3, daily: '2026-11-20', score: 800 }, 2);
  assert.deepEqual(r.newStamps.sort(), ['daily', 'draw3']); assert.deepEqual(r.records, ['moves']);
  C.recordStart(sv); r = C.recordWin(sv, { timeSec: 100, moves: 120, undos: 1, hints: 1, draw: 1, daily: null, score: 1000 }, 3);
  assert.ok(r.newStamps.includes('streak3')); assert.deepEqual(r.records.sort(), ['score', 'time']);
  C.recordStart(sv); C.recordLoss(sv); assert.equal(st().streak, 0); assert.equal(st().bestStreak, 3);
  assert.equal(st().played, 4); assert.equal(st().wonDraw3, 1); assert.deepEqual(st().dailyDone, ['2026-11-20']);
  for (let i = 0; i < 7; i++) r = C.recordWin(sv, { timeSec: 500, moves: 200, undos: 1, hints: 1, draw: 1, daily: null, score: 1 }, 9);
  assert.ok(sp().ten); assert.equal(Object.keys(sp()).length, C.STAMPS.length);
  r = C.recordWin(sv, { timeSec: 1, moves: 1, undos: 0, hints: 0, draw: 3, daily: '2026-11-21', score: 1 }); assert.deepEqual(r.newStamps, []);
});
test('players: add, dedupe, rename, switch, remove, limits', () => {
  const sv = C.defaultSave(); assert.equal(C.player(sv), null);
  assert.equal(C.addPlayer(sv, '   '), null); assert.equal(C.addPlayer(sv, 42), null);
  const a = C.addPlayer(sv, '  Val  <b>'); assert.equal(sv.players[a].name, 'Val b'); assert.equal(sv.current, a);
  const b = C.addPlayer(sv, 'Zoran'); assert.equal(sv.current, b); assert.equal(C.addPlayer(sv, 'zoran'), b);
  assert.equal(C.addPlayer(sv, 'A very very long name that goes on'), sv.current); assert.equal(C.player(sv).name.length, 20);
  assert.ok(C.switchPlayer(sv, a)); assert.equal(C.player(sv).name, 'Val b'); assert.ok(!C.switchPlayer(sv, 'nope'));
  assert.ok(C.renamePlayer(sv, a, 'Val')); assert.ok(!C.renamePlayer(sv, a, 'ZORAN')); assert.ok(!C.renamePlayer(sv, a, ''));
  C.recordStart(sv); C.recordWin(sv, { timeSec: 99, moves: 99, undos: 0, hints: 0, draw: 1, score: 50 });
  assert.equal(sv.players[a].stats.won, 1); assert.equal(sv.players[b].stats.won, 0);
  C.renamePlayer(sv, a, 'Valentin'); assert.equal(sv.scores.d1[0].name, 'Valentin');
  assert.ok(C.removePlayer(sv, b)); assert.ok(!sv.players[b]);
  const only = C.defaultSave(); const o = C.addPlayer(only, 'Solo'); assert.ok(!C.removePlayer(only, o));
  for (let i = 0; i < 20; i++) C.addPlayer(only, 'P' + i); assert.equal(Object.keys(only.players).length, C.MAX_PLAYERS);
});
test('players: game credit goes to the player who started it', () => {
  const sv = C.defaultSave(); const a = C.addPlayer(sv, 'Ana'), b = C.addPlayer(sv, 'Bob');
  C.recordStart(sv, a); C.recordWin(sv, { pid: a, timeSec: 60, moves: 80, undos: 0, hints: 0, draw: 3, score: 700 });
  assert.equal(sv.players[a].stats.won, 1); assert.equal(sv.players[b].stats.played, 0); assert.equal(sv.scores.d3[0].name, 'Ana');
});
test('leaderboard: top 10 per mode, ordered by score then time, rank returned', () => {
  const sv = C.defaultSave();
  const add = (draw, score, time, name) => C.addScore(sv, draw, { name: name || 'X', score, time, moves: 100, date: '2026-11-20' });
  for (let i = 1; i <= 12; i++) add(1, i * 100, 300);
  assert.equal(sv.scores.d1.length, 10); assert.equal(sv.scores.d1[0].score, 1200); assert.equal(sv.scores.d1[9].score, 300);
  assert.equal(add(1, 50, 10), 0);                               // too low: not placed
  assert.equal(add(1, 1200, 200, 'Fast'), 1);                     // tie on score, faster wins
  assert.equal(sv.scores.d1[1].score, 1200); assert.equal(sv.scores.d1[0].name, 'Fast');
  assert.equal(add(3, 10, 10), 1); assert.equal(sv.scores.d3.length, 1);
  C.resetScores(sv); assert.deepEqual(sv.scores, { d1: [], d3: [] });
});
test('save: players and leaderboard survive a round trip; garbage is filtered', () => {
  const sv = C.defaultSave(); const a = C.addPlayer(sv, 'Val'); C.addPlayer(sv, 'Zoran'); C.switchPlayer(sv, a);
  C.recordStart(sv); C.recordWin(sv, { timeSec: 120, moves: 95, undos: 0, hints: 0, draw: 1, score: 1234 });
  const back = C.loadSave(JSON.stringify(sv)).data;
  assert.equal(back.current, a); assert.equal(Object.keys(back.players).length, 2); assert.equal(back.players[a].stats.won, 1);
  assert.equal(back.scores.d1[0].score, 1234); assert.equal(back.scores.d1[0].name, 'Val');
  const junk = JSON.parse(JSON.stringify(sv));
  junk.players['bad id!'] = { name: 'x' }; junk.players.q = null; junk.players.z = { name: '', stats: 'no' }; junk.current = 'ghost';
  junk.scores.d1.push({ name: '', score: 5, time: 1, moves: 1, date: '2026-11-20' }, { name: 'n', score: -1, time: 1, moves: 1, date: '2026-11-20' }, { name: 'n', score: 1, time: 1, moves: 1.5, date: 'x' }, 'str');
  junk.scores.d3 = 'nope';
  const j = C.loadSave(JSON.stringify(junk)).data;
  assert.ok(!j.players['bad id!'] && !j.players.q); assert.equal(j.players.z.name, 'Player'); assert.equal(j.players.z.stats.played, 0);
  assert.ok(j.players[j.current]); assert.equal(j.scores.d1.length, 1); assert.deepEqual(j.scores.d3, []);
  C.resetPlayerStats(j, a); assert.equal(j.players[a].stats.won, 0); assert.deepEqual(j.players[a].stamps, {});
});
test('stamps: each has cat and aviation names, including Cat Nap and Barrel Roll', () => {
  for (const a of C.STAMPS) { assert.ok(a.cat && a.air && a.desc); }
  assert.ok(C.STAMPS.some(a => a.cat === 'Cat Nap')); assert.ok(C.STAMPS.some(a => a.air === 'Barrel Roll'));
});
test('daily: same date → same winnable deal; time bonus', () => {
  const k = C.dateKey(new Date(2026, 10, 20)); assert.equal(k, '2026-11-20');
  assert.equal(C.dailySeed(k, SEEDS.d1), C.dailySeed(k, SEEDS.d1)); assert.ok(SEEDS.d1.includes(C.dailySeed(k, SEEDS.d1)));
  assert.notEqual(C.dailySeed('2026-11-21', SEEDS.d1), undefined);
  assert.equal(C.timeBonus(20), 0); assert.equal(C.timeBonus(100), 7000);
});
test('listMoves: every listed move is legal and fresh deals have the draw', () => {
  for (const seed of [1, 2, 3, 4, 5]) { const s = C.newGame(seed, 1), ms = C.listMoves(s); assert.ok(ms.some(m => m.t === 'draw')); for (const m of ms) assert.ok(C.legal(s, m)); }
});
