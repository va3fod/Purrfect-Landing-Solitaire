// Build-time: find deals the solver proves winnable (solution replayed through the rules engine).
const C = require('../src/core.js'), fs = require('fs'), path = require('path');
const N = +process.argv[2] || 400, out = { 1: [], 3: [] }; const r = C.rng(20261120);
for (const draw of [1, 3]) {
  const used = new Set();
  while (out[draw].length < N) {
    const seed = 1000 + Math.floor(r() * 8999000); if (used.has(seed)) continue; used.add(seed);
    const s = C.newGame(seed, draw), res = C.solve(s, { maxNodes: 40000 });
    if (res.solved) { const e = C.replay(s, res.moves); if (e && C.isWon(e)) out[draw].push(seed); }
  }
  console.log('draw', draw, out[draw].length, 'tried', used.size);
}
fs.writeFileSync(path.join(__dirname, '..', 'src', 'seeds.json'), JSON.stringify({ d1: out[1], d3: out[3] }));
