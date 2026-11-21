// Clean screenshots for README / hub: node tests/shots.js
const { chromium } = require('../node_modules/playwright-core');
const C = require('../src/core.js'), SEEDS = require('../src/seeds.json'), path = require('path'), fs = require('fs');
const APP = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8'));
const URL = 'file://' + path.join(__dirname, '..', APP.FILE), OUT = path.join(__dirname, '..', 'shots');
function saveFor(theme, steps, draw) {
  const seed = (draw === 3 ? SEEDS.d3 : SEEDS.d1)[2]; let s = C.newGame(seed, draw); const sol = C.solve(s, { maxNodes: 60000 }).moves; const list = [s];
  for (const m of sol.slice(0, steps)) { s = C.apply(s, m); list.push(s); }
  const sv = C.defaultSave(); C.addPlayer(sv, 'Val'); sv.settings.theme = theme; sv.settings.draw = draw; sv.settings.seenHelp = true;
  sv.game = { list, index: list.length - 1, mode: 'winnable', daily: null, elapsed: 154, undos: 0, hints: 0, counted: true, won: false, pid: sv.current };
  return JSON.stringify(sv);
}
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  for (const [tag, vp, touch] of [['desktop', { width: 1280, height: 800 }, false], ['phone', { width: 412, height: 915 }, true]])
    for (const theme of ['cat', 'air']) {
      const ctx = await b.newContext({ viewport: vp, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 2 : 1 });
      const data = saveFor(theme, theme === 'cat' ? 34 : 52, theme === 'cat' ? 1 : 3);
      await ctx.addInitScript(([k, d]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, d); sessionStorage.setItem('seeded', '1'); } }, [APP.STORE_KEY, data]);
      const p = await ctx.newPage(); await p.goto(URL); await p.waitForTimeout(900);
      await p.screenshot({ path: path.join(OUT, `readme_${tag}_${theme}.png`) }); await ctx.close();
    }
  await b.close(); console.log('ok');
})();
