/* Build the single-file app: node build.js  → Purrfect_Landing_Solitaire_V1.0.html + index.html */
const fs = require('fs'), path = require('path');
const APP = { NAME: 'Purrfect Landing Solitaire', TAGLINE: 'Klondike solitaire with cats and airplanes', VERSION: '1.1', STORE_KEY: 'purrfectLandingV1' };
APP.SLUG = APP.NAME.replace(/[^A-Za-z0-9]+/g, '-');
APP.FILE = APP.SLUG.replace(/-/g, '_') + '_V' + APP.VERSION + '.html';
const d = __dirname, src = f => fs.readFileSync(path.join(d, 'src', f), 'utf8');
const fill = t => t.replace(/__APP_NAME__/g, APP.NAME).replace(/__TAGLINE__/g, APP.TAGLINE).replace(/__VERSION__/g, APP.VERSION);
const icon = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='16' fill='#f4a95c'/><rect x='14' y='10' width='28' height='40' rx='5' fill='#fff' stroke='#2b2040' stroke-width='2.5' transform='rotate(-10 28 30)'/><g fill='#2b2040' transform='translate(40 40) scale(.3)'><ellipse cx='0' cy='18' rx='26' ry='22'/><ellipse cx='-30' cy='-12' rx='11' ry='14'/><ellipse cx='-11' cy='-30' rx='11' ry='14'/><ellipse cx='11' cy='-30' rx='11' ry='14'/><ellipse cx='30' cy='-12' rx='11' ry='14'/></g></svg>`;
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#2b2040">
<meta name="description" content="${APP.NAME}: free Klondike solitaire with a cat theme and an aviation theme. Draw 1 or 3, winnable deals, daily challenge, unlimited undo, smart hints and stamps. Works offline, no ads.">
<title>${APP.NAME}</title>
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(icon).replace(/'/g, '%27')}">
<style>
${src('style.css')}</style>
</head>
<body>
${fill(src('body.html'))}
<script id="pl-core">
${src('core.js')}</script>
<script id="pl-art">
${src('art.js')}</script>
<script id="pl-app">
const APP_VERSION = '${APP.VERSION}', APP_STORE_KEY = '${APP.STORE_KEY}';
const SEEDS = ${fs.readFileSync(path.join(d, 'src', 'seeds.json'), 'utf8').trim()};
${src('app.js')}
init();
</script>
</body>
</html>
`;
if (/__[A-Z_]+__/.test(html)) throw new Error('unfilled placeholder');
for (const f of fs.readdirSync(d)) if (/_V[\d.]+\.html$/.test(f) && f !== APP.FILE) fs.unlinkSync(path.join(d, f));
fs.writeFileSync(path.join(d, APP.FILE), html); fs.writeFileSync(path.join(d, 'index.html'), html);
fs.writeFileSync(path.join(d, 'app.json'), JSON.stringify(APP, null, 2) + '\n');
console.log('built', APP.FILE, Buffer.byteLength(html), 'bytes');
