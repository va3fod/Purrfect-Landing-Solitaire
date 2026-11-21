/* Purrfect Landing Solitaire — all card art drawn in code (SVG). */
(function (root, factory) {
  const m = factory(); if (typeof module === 'object' && module.exports) module.exports = m; else root.PLArt = m;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const SUIT_PATH = [
    'M50 4C40 22 6 40 6 62c0 14 11 22 23 22 8 0 14-4 17-10-1 10-5 18-12 22h32c-7-4-11-12-12-22 3 6 9 10 17 10 12 0 23-8 23-22C94 40 60 22 50 4z',
    'M50 90C20 66 4 49 4 31 4 16 16 6 28 6c10 0 18 6 22 14C54 12 62 6 72 6c12 0 24 10 24 25 0 18-16 35-46 59z',
    'M50 3l38 47-38 47-38-47z',
    'M50 8a20 20 0 0 1 17 30 20 20 0 1 1-9 36c1 9 5 16 12 22H30c7-6 11-13 12-22a20 20 0 1 1-9-36A20 20 0 0 1 50 8z'
  ];
  const COLORS = { normal: ['#1d1d22', '#c8202f', '#c8202f', '#1d1d22'], cb: ['#16161a', '#d55e00', '#a65f00', '#0062a8'] };
  const color = (s, cb) => (cb ? COLORS.cb : COLORS.normal)[s];
  const suitOf = c => (c / 13) | 0, rankOf = c => (c % 13) + 1;
  function suit(s, x, y, size, fill, rot) {
    const k = size / 100;
    return `<path d="${SUIT_PATH[s]}" fill="${fill}" transform="translate(${x - size / 2} ${y - size / 2}) ${rot ? `rotate(180 ${size / 2} ${size / 2})` : ''} scale(${k})"/>`;
  }
  const paw = (x, y, sz, fill, op) => `<g transform="translate(${x} ${y}) scale(${sz / 100})" fill="${fill}" opacity="${op == null ? 1 : op}"><ellipse cx="0" cy="18" rx="26" ry="22"/><ellipse cx="-30" cy="-12" rx="11" ry="14"/><ellipse cx="-11" cy="-30" rx="11" ry="14"/><ellipse cx="11" cy="-30" rx="11" ry="14"/><ellipse cx="30" cy="-12" rx="11" ry="14"/></g>`;
  const jetTop = (x, y, sz, fill, rot, op) => `<g transform="translate(${x} ${y}) rotate(${rot || 0}) scale(${sz / 100})" fill="${fill}" opacity="${op == null ? 1 : op}"><path d="M0-50C6-44 6-30 6-20V30c0 10-3 18-6 20-3-2-6-10-6-20V-20c0-10 0-24 6-30z"/><path d="M6-8 50 14v7L6 12zM-6-8-50 14v7L-6 12zM5 33l17 11v5L4 45zM-5 33-22 44v5L-4 45z"/></g>`;
  /* side-view airliner, nose to the right, ~200 x 80 box */
  const airliner = (livery, body) => `<path d="M24 40 8 12h17l24 26z" fill="${livery}"/><path d="M10 48c0-8 12-12 32-12h110c16 0 28 6 36 12-8 6-20 10-36 10H42c-20 0-32-2-32-10z" fill="${body || '#f4f7fb'}" stroke="#5b6b7d" stroke-width="1.5"/><path d="M22 51h150c-6 3-12 5-20 5H42c-10 0-16-2-20-5z" fill="${livery}"/><path d="M172 41c5 1 9 3 12 6h-14z" fill="#28435f"/>${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => `<circle cx="${56 + i * 12}" cy="44" r="2.6" fill="#28435f"/>`).join('')}<path d="M78 52h44L98 74H86z" fill="#9fb0c2" stroke="#5b6b7d" stroke-width="1.2"/><rect x="94" y="62" width="16" height="6" rx="3" fill="#71849a"/>`;
  const propPlane = (livery) => `<path d="M30 38 18 16h14l18 22z" fill="${livery}"/><path d="M18 46c0-6 10-9 26-9h80c14 0 24 4 30 9-6 5-16 8-30 8H44c-16 0-26-2-26-8z" fill="#fdf6e8" stroke="#6b5a45" stroke-width="1.5"/><path d="M56 36h52l-6-10H66z" fill="#7dc3e8" stroke="#6b5a45" stroke-width="1.2"/><path d="M40 46h112" stroke="${livery}" stroke-width="5"/><path d="M62 49h60l-14 16H74z" fill="${livery}" stroke="#6b5a45" stroke-width="1.2"/><rect x="152" y="40" width="7" height="12" rx="3" fill="#6b5a45"/><ellipse cx="162" cy="46" rx="3" ry="22" fill="#6b5a45" opacity=".55"/><circle cx="160" cy="46" r="3.5" fill="#cfa646"/>`;

  /* ---------- cats ---------- */
  const FUR = [
    { fur: '#9aa1ab', stripe: '#626973', ear: '#f2b8c6', eye: '#7cc36b', muzzle: '#e6e8ec' },  // ♠ silver tabby
    { fur: '#f29a46', stripe: '#c35f18', ear: '#ffc1cf', eye: '#5fbf6a', muzzle: '#fde3c6' },  // ♥ ginger
    { fur: '#f2e2c2', stripe: '#6b4a3a', ear: '#e9a0b0', eye: '#4fa3e0', muzzle: '#fff6e6', points: true },  // ♦ siamese
    { fur: '#2c2c31', stripe: '#2c2c31', ear: '#f0a3b6', eye: '#e8c547', muzzle: '#ffffff' }   // ♣ tuxedo
  ];
  function catHead(cx, cy, r, f, kind) {
    const er = r * (kind === 'J' ? 0.24 : 0.19), ey = cy - r * 0.08, ex = r * 0.4;
    const ears = `<path d="M${cx - r * 0.95} ${cy - r * 0.15} L${cx - r * 0.85} ${cy - r * 1.25} L${cx - r * 0.25} ${cy - r * 0.78}Z M${cx + r * 0.95} ${cy - r * 0.15} L${cx + r * 0.85} ${cy - r * 1.25} L${cx + r * 0.25} ${cy - r * 0.78}Z" fill="${f.points ? f.stripe : f.fur}" stroke="#3a2f2a" stroke-width="2" stroke-linejoin="round"/>
      <path d="M${cx - r * 0.8} ${cy - r * 0.35} L${cx - r * 0.78} ${cy - r * 1.02} L${cx - r * 0.42} ${cy - r * 0.74}Z M${cx + r * 0.8} ${cy - r * 0.35} L${cx + r * 0.78} ${cy - r * 1.02} L${cx + r * 0.42} ${cy - r * 0.74}Z" fill="${f.ear}"/>`;
    const head = `<ellipse cx="${cx}" cy="${cy}" rx="${r * (kind === 'K' ? 1.08 : 1)}" ry="${r * 0.88}" fill="${f.fur}" stroke="#3a2f2a" stroke-width="2"/>`;
    const stripes = f.points ? `<ellipse cx="${cx}" cy="${cy + r * 0.3}" rx="${r * 0.5}" ry="${r * 0.42}" fill="${f.stripe}" opacity=".55"/>`
      : f.fur === f.stripe ? `<path d="M${cx} ${cy - r * 0.6} L${cx - r * 0.3} ${cy + r * 0.2} L${cx} ${cy + r * 0.85} L${cx + r * 0.3} ${cy + r * 0.2}Z" fill="${f.muzzle}"/>`
      : `<path d="M${cx} ${cy - r * 0.86} v${r * 0.32} M${cx - r * 0.22} ${cy - r * 0.82} l${r * 0.06} ${r * 0.26} M${cx + r * 0.22} ${cy - r * 0.82} l${-r * 0.06} ${r * 0.26} M${cx - r} ${cy + r * 0.05} h${r * 0.25} M${cx + r} ${cy + r * 0.05} h${-r * 0.25}" stroke="${f.stripe}" stroke-width="${r * 0.08}" stroke-linecap="round"/>`;
    const muzzle = `<ellipse cx="${cx - r * 0.2}" cy="${cy + r * 0.38}" rx="${r * 0.26}" ry="${r * 0.2}" fill="${f.muzzle}"/><ellipse cx="${cx + r * 0.2}" cy="${cy + r * 0.38}" rx="${r * 0.26}" ry="${r * 0.2}" fill="${f.muzzle}"/>`;
    const pupil = kind === 'J' ? (x) => `<circle cx="${x}" cy="${ey}" r="${er * 0.62}" fill="#1b1b1b"/><circle cx="${x - er * 0.25}" cy="${ey - er * 0.3}" r="${er * 0.25}" fill="#fff"/>`
      : (x) => `<ellipse cx="${x}" cy="${ey}" rx="${er * 0.22}" ry="${er * 0.8}" fill="#1b1b1b"/><circle cx="${x - er * 0.3}" cy="${ey - er * 0.35}" r="${er * 0.18}" fill="#fff"/>`;
    const lids = kind === 'Q' ? `<path d="M${cx - ex - er} ${ey - er * 0.6} l-6 -6 M${cx - ex - er * 0.4} ${ey - er * 0.95} l-3 -7 M${cx + ex + er} ${ey - er * 0.6} l6 -6 M${cx + ex + er * 0.4} ${ey - er * 0.95} l3 -7" stroke="#2a2a2a" stroke-width="2" stroke-linecap="round"/>` : '';
    const eyes = `<ellipse cx="${cx - ex}" cy="${ey}" rx="${er}" ry="${er * 0.95}" fill="${f.eye}" stroke="#2a2a2a" stroke-width="1.5"/><ellipse cx="${cx + ex}" cy="${ey}" rx="${er}" ry="${er * 0.95}" fill="${f.eye}" stroke="#2a2a2a" stroke-width="1.5"/>${pupil(cx - ex)}${pupil(cx + ex)}${lids}`;
    const nose = `<path d="M${cx - r * 0.12} ${cy + r * 0.18} h${r * 0.24} l${-r * 0.12} ${r * 0.14}z" fill="#e57a95" stroke="#7a3b4a" stroke-width="1"/><path d="M${cx} ${cy + r * 0.32} v${r * 0.08} q${-r * 0.1} ${r * 0.14} ${-r * 0.22} ${r * 0.04} M${cx} ${cy + r * 0.4} q${r * 0.1} ${r * 0.14} ${r * 0.22} ${r * 0.04}" stroke="#3a2f2a" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
    const wcol = f.fur === f.stripe ? '#eee' : '#3a2f2a';
    const whiskers = `<path d="M${cx - r * 0.45} ${cy + r * 0.36} l${-r * 0.75} ${-r * 0.12} M${cx - r * 0.45} ${cy + r * 0.44} l${-r * 0.75} ${r * 0.06} M${cx - r * 0.45} ${cy + r * 0.52} l${-r * 0.68} ${r * 0.22} M${cx + r * 0.45} ${cy + r * 0.36} l${r * 0.75} ${-r * 0.12} M${cx + r * 0.45} ${cy + r * 0.44} l${r * 0.75} ${r * 0.06} M${cx + r * 0.45} ${cy + r * 0.52} l${r * 0.68} ${r * 0.22}" stroke="${wcol}" stroke-width="1.3" stroke-linecap="round" opacity=".8"/>`;
    const cheeks = kind === 'K' ? `<path d="M${cx - r * 1.08} ${cy + r * 0.1} l${-r * 0.18} ${r * 0.18} l${r * 0.22} ${r * 0.02} l${-r * 0.12} ${r * 0.2} l${r * 0.25} ${-r * 0.04}" fill="${f.fur}" stroke="#3a2f2a" stroke-width="1.5"/><path d="M${cx + r * 1.08} ${cy + r * 0.1} l${r * 0.18} ${r * 0.18} l${-r * 0.22} ${r * 0.02} l${r * 0.12} ${r * 0.2} l${-r * 0.25} ${-r * 0.04}" fill="${f.fur}" stroke="#3a2f2a" stroke-width="1.5"/>` : '';
    return ears + cheeks + head + stripes + muzzle + eyes + nose + whiskers;
  }
  function catFace(s, rank, sc) {
    const f = FUR[s], cx = 100;
    if (rank === 13) {   // King: big tomcat with crown and ermine robe
      return `<path d="M34 262c4-44 30-62 66-62s62 18 66 62z" fill="${sc}"/><path d="M58 214c12 10 26 14 42 14s30-4 42-14l8 8c-14 14-30 20-50 20s-36-6-50-20z" fill="#fff" stroke="#ccc"/>${[66, 84, 100, 116, 134].map((x, i) => `<path d="M${x} ${226 + (i % 2) * 4} l-2 6 h4z" fill="#222"/>`).join('')}
        ${catHead(cx, 166, 46, f, 'K')}<path d="M68 118l-6-30 18 14 20-22 20 22 18-14-6 30z" fill="#f5c542" stroke="#9c7412" stroke-width="2" stroke-linejoin="round"/><circle cx="100" cy="106" r="5" fill="${sc === '#1d1d22' || sc === '#16161a' ? '#3b82f6' : sc}"/><circle cx="78" cy="110" r="3" fill="#fff"/><circle cx="122" cy="110" r="3" fill="#fff"/>`;
    }
    if (rank === 12) {   // Queen: elegant cat with tiara and pearls
      return `<path d="M42 262c4-40 26-56 58-56s54 16 58 56z" fill="${sc}"/><path d="M62 212q38 26 76 0" fill="none" stroke="#fff" stroke-width="0" />${[0, 1, 2, 3, 4, 5, 6, 7].map(i => { const t = i / 7, x = 66 + t * 68, y = 214 + Math.sin(t * Math.PI) * 14; return `<circle cx="${x}" cy="${y}" r="4" fill="#fffaf0" stroke="#bbb"/>`; }).join('')}
        ${catHead(cx, 164, 40, f, 'Q')}<path d="M74 126q26-18 52 0l-6 4q-20-12-40 0z" fill="#e8e8f0" stroke="#8b8ba0" stroke-width="1.5"/><path d="M100 108l6 12h-12z" fill="${sc}" stroke="#666" stroke-width="1"/><circle cx="100" cy="113" r="3" fill="#fff"/>
        <path d="M128 196c8 2 14 8 14 14" fill="none" stroke="${f.fur}" stroke-width="0"/>`;
    }
    // Jack: kitten with a ball of yarn
    return `<path d="M50 262c2-34 22-50 50-50s48 16 50 50z" fill="${f.fur}" stroke="#3a2f2a" stroke-width="2"/>${f.points ? '' : `<ellipse cx="100" cy="246" rx="22" ry="20" fill="${f.muzzle}"/>`}
      <path d="M150 238c18-4 22-24 10-34" fill="none" stroke="${f.points ? f.stripe : f.fur}" stroke-width="9" stroke-linecap="round"/>
      ${catHead(cx, 168, 40, f, 'J')}<g transform="translate(58 232)"><circle r="20" fill="${sc}"/><path d="M-18-6q18 10 36 0M-17 7q17-10 34 0M-6-19q10 19 0 38M7-19q-12 19 0 38" stroke="#fff" stroke-width="1.6" fill="none" opacity=".7"/><path d="M18 6q20 4 26 24" stroke="${sc}" stroke-width="2" fill="none"/></g>
      <ellipse cx="78" cy="216" rx="11" ry="9" fill="${f.points ? f.stripe : f.fur}" stroke="#3a2f2a" stroke-width="1.6"/>`;
  }

  /* ---------- pilots ---------- */
  const SKIN = ['#f1c9a0', '#e0a872', '#b97a4b', '#8a5634'];
  const HAIR = ['#2b2b2b', '#a8432a', '#d9b45a', '#4a2f1f'];
  function pilotFace(s, rank, sc) {
    const sk = SKIN[s], hair = HAIR[s];
    if (rank === 13) {   // Captain
      return `<path d="M30 262c4-40 30-58 70-58s66 18 70 58z" fill="#1d2b44"/><path d="M84 206l16 40 16-40z" fill="#fff"/><path d="M96 210h8l4 34-8 10-8-10z" fill="${sc}"/>
        <g fill="#e8b93a">${[0, 1, 2, 3].map(i => `<rect x="36" y="${222 + i * 7}" width="26" height="4" rx="1"/><rect x="138" y="${222 + i * 7}" width="26" height="4" rx="1"/>`).join('')}</g>
        <rect x="88" y="186" width="24" height="22" fill="${sk}"/><ellipse cx="100" cy="160" rx="36" ry="40" fill="${sk}" stroke="#5a3a26" stroke-width="2"/>
        <ellipse cx="64" cy="162" rx="6" ry="10" fill="${sk}" stroke="#5a3a26" stroke-width="1.5"/><ellipse cx="136" cy="162" rx="6" ry="10" fill="${sk}" stroke="#5a3a26" stroke-width="1.5"/>
        <path d="M70 158h26a4 4 0 0 1 4 4v2a12 12 0 0 1-24 0v-2zM104 158h26v4a12 12 0 0 1-24 0v-4z" fill="#22303f" stroke="#c9a227" stroke-width="2"/><path d="M96 161h8" stroke="#c9a227" stroke-width="2"/>
        <path d="M80 182q20 10 40 0q-4 10-20 10t-20-10z" fill="#7a7a7a"/><path d="M90 192q10 4 20 0" stroke="#5a3a26" stroke-width="2" fill="none"/>
        <path d="M58 132q42-34 84 0l-4 10H62z" fill="#1d2b44" stroke="#0e1726" stroke-width="2"/><path d="M60 140h80l8 10H52z" fill="#0e1726"/><rect x="62" y="134" width="76" height="6" fill="${sc}"/>
        <path d="M86 122l14-6 14 6-14 4z" fill="#e8b93a"/><path d="M72 124q14-6 26-2M128 124q-14-6-26-2" stroke="#e8b93a" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    }
    if (rank === 12) {   // First Officer with headset
      return `<path d="M34 262c4-38 28-54 66-54s62 16 66 54z" fill="#1d2b44"/><path d="M86 210l14 34 14-34z" fill="#fff"/><path d="M95 214h10l3 26-8 8-8-8z" fill="${sc}"/>
        <g fill="#e8b93a">${[0, 1, 2].map(i => `<rect x="40" y="${226 + i * 7}" width="24" height="4" rx="1"/><rect x="136" y="${226 + i * 7}" width="24" height="4" rx="1"/>`).join('')}</g>
        <path d="M58 168q-6-60 42-62 48 2 42 62l-8 36H66z" fill="${hair}"/>
        <rect x="89" y="188" width="22" height="22" fill="${sk}"/><ellipse cx="100" cy="162" rx="33" ry="38" fill="${sk}" stroke="#5a3a26" stroke-width="2"/>
        <path d="M68 150q8-34 34-34 22 0 30 30-20-14-42-12-12 2-22 16z" fill="${hair}"/>
        <ellipse cx="87" cy="160" rx="4" ry="5" fill="#2a2a2a"/><ellipse cx="113" cy="160" rx="4" ry="5" fill="#2a2a2a"/><path d="M80 150q7-4 13 0M107 150q7-4 13 0" stroke="#3b2a20" stroke-width="2" fill="none"/>
        <path d="M100 164v10h-4" stroke="#8a5a3c" stroke-width="2" fill="none"/><path d="M88 184q12 9 24 0" stroke="#b03a48" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M62 164q0-58 38-58t38 58" fill="none" stroke="#2f3a48" stroke-width="7"/><rect x="56" y="152" width="14" height="24" rx="6" fill="#2f3a48"/><rect x="130" y="152" width="14" height="24" rx="6" fill="#2f3a48"/>
        <path d="M64 174q0 20 22 18" stroke="#2f3a48" stroke-width="3" fill="none"/><circle cx="88" cy="192" r="4" fill="#2f3a48"/><circle cx="137" cy="164" r="3" fill="${sc}"/>`;
    }
    // Jack: an aircraft in the sky
    const plane = s % 2 === 0 ? airliner(sc) : propPlane(sc);
    return `<rect x="26" y="84" width="148" height="174" rx="8" fill="url(#sky)"/><g fill="#fff" opacity=".9"><ellipse cx="60" cy="226" rx="26" ry="10"/><ellipse cx="80" cy="220" rx="18" ry="11"/><ellipse cx="140" cy="118" rx="22" ry="8"/><ellipse cx="154" cy="112" rx="14" ry="8"/></g>
      <g transform="translate(16 128) scale(.84)">${plane}</g><path d="M34 196q30-8 60-4" stroke="#fff" stroke-width="3" stroke-dasharray="6 6" fill="none" opacity=".8"/>`;
  }

  function pips(rank, s, fill) {
    const L = 52, R = 148, C = 100, T = 100, B = 252, H = B - T;
    const at = { 2: [[C, 0], [C, 1]], 3: [[C, 0], [C, .5], [C, 1]], 4: [[L, 0], [R, 0], [L, 1], [R, 1]] };
    at[5] = at[4].concat([[C, .5]]); at[6] = at[4].concat([[L, .5], [R, .5]]); at[7] = at[6].concat([[C, .25]]); at[8] = at[7].concat([[C, .75]]);
    at[9] = [[L, 0], [L, 1 / 3], [L, 2 / 3], [L, 1], [R, 0], [R, 1 / 3], [R, 2 / 3], [R, 1], [C, .5]];
    at[10] = [[L, 0], [L, 1 / 3], [L, 2 / 3], [L, 1], [R, 0], [R, 1 / 3], [R, 2 / 3], [R, 1], [C, 1 / 6], [C, 5 / 6]];
    const sz = rank >= 9 ? 34 : 38;
    return at[rank].map(([x, t]) => suit(s, x, T + t * H, sz, fill, t > .55)).join('');
  }

  function cardFace(card, theme, opt) {
    opt = opt || {};
    const s = suitOf(card), r = rankOf(card), sc = color(s, opt.colorblind), large = !!opt.large;
    const bg = theme === 'air' ? '#f7fafd' : '#fffaf1', edge = theme === 'air' ? '#9fb3c8' : '#d8c3a5';
    const rs = large ? 72 : 54, ss = large ? 50 : 40, rank = RANKS[r - 1];
    const idx = `<text x="${large ? 10 : 14}" y="${large ? 66 : 54}" font-family="Arial Black,Arial,Helvetica,sans-serif" font-weight="900" font-size="${rs}" fill="${sc}" ${rank === '10' ? `textLength="${large ? 92 : 70}" lengthAdjust="spacingAndGlyphs"` : ''}>${rank}</text>${suit(s, 200 - (large ? 36 : 34), large ? 40 : 34, ss, sc)}`;
    let mid = '';
    if (r === 1) {
      mid = theme === 'air'
        ? `<path d="M100 168c-26-8-58-6-84-18 8 14 30 24 56 28-14 2-28 0-40-4 10 10 34 16 64 14zM100 168c26-8 58-6 84-18-8 14-30 24-56 28 14 2 28 0 40-4-10 10-34 16-64 14z" fill="#d4a62a" stroke="#8c6a12" stroke-width="1.5"/>${suit(s, 100, 172, 78, sc)}<circle cx="100" cy="172" r="48" fill="none" stroke="#d4a62a" stroke-width="2" stroke-dasharray="4 5"/>`
        : `<path d="M62 128l6-36 22 24zM138 128l-6-36-22 24z" fill="${sc}"/>${suit(s, 100, 174, 96, sc)}${paw(100, 184, 30, '#fff', .9)}`;
    } else if (r <= 10) mid = pips(r, s, sc);
    else mid = `<rect x="22" y="${large ? 86 : 80}" width="156" height="${large ? 180 : 186}" rx="10" fill="${theme === 'air' ? '#e8f0f8' : '#fbefdc'}" stroke="${sc}" stroke-width="2.5"/><g>${theme === 'air' ? pilotFace(s, r, sc) : catFace(s, r, sc)}</g>${suit(s, 38, large ? 104 : 98, 22, sc)}${suit(s, 162, 248, 22, sc, true)}`;
    const mark = r >= 2 && r <= 10 ? (theme === 'air' ? jetTop(178, 262, 22, sc, 45, .16) : paw(178, 262, 20, sc, .16)) : '';
    const defs = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fc4f0"/><stop offset="1" stop-color="#d9effc"/></linearGradient></defs>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 280">${defs}<rect x="1.5" y="1.5" width="197" height="277" rx="16" fill="${bg}" stroke="${edge}" stroke-width="3"/>${mid}${mark}${idx}</svg>`;
  }

  function cardBack(theme) {
    if (theme === 'air') {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 280"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#123a63"/><stop offset="1" stop-color="#0b2240"/></linearGradient>
        <pattern id="p" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1.2" fill="#9cc7f0" opacity=".45"/><circle cx="18" cy="16" r=".8" fill="#fff" opacity=".4"/></pattern></defs>
        <rect x="1.5" y="1.5" width="197" height="277" rx="16" fill="url(#g)" stroke="#e1b84a" stroke-width="3"/><rect x="12" y="12" width="176" height="256" rx="10" fill="url(#p)" stroke="#e1b84a" stroke-width="1.5" opacity=".95"/>
        <path d="M70 268 92 12h16l22 256z" fill="#1d2f42" opacity=".85"/><path d="M100 30v14M100 60v14M100 90v14M100 196v14M100 226v14M100 250v12" stroke="#fff" stroke-width="3" opacity=".8"/>
        <circle cx="100" cy="150" r="44" fill="#0b2240" stroke="#e1b84a" stroke-width="2.5"/>${jetTop(100, 150, 70, '#f3f6fa', 0)}
        <path d="M48 150h-26M152 150h26" stroke="#e1b84a" stroke-width="2"/><path d="M22 142l10 8-10 8M178 142l-10 8 10 8" fill="none" stroke="#e1b84a" stroke-width="2"/></svg>`;
    }
    const paws = [];
    for (let y = 26; y < 270; y += 40) for (let x = (y / 40) % 2 ? 28 : 48; x < 190; x += 40) paws.push(paw(x, y, 13, '#f6d9ff', .28));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 280"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7b55b8"/><stop offset="1" stop-color="#4b2f80"/></linearGradient></defs>
      <rect x="1.5" y="1.5" width="197" height="277" rx="16" fill="url(#g)" stroke="#f7e3b5" stroke-width="3"/><rect x="12" y="12" width="176" height="256" rx="10" fill="none" stroke="#f7e3b5" stroke-width="1.5" opacity=".9"/>${paws.join('')}
      <circle cx="100" cy="146" r="50" fill="#f7e3b5" stroke="#d9b56a" stroke-width="3"/><circle cx="122" cy="122" r="11" fill="#fff8e6"/><circle cx="127" cy="119" r="10" fill="#f7e3b5"/>
      <g fill="#3b2463"><path d="M100 104l-14-14 4 20zM112 106l12-16-2 22z" transform="translate(-6 8)"/><circle cx="100" cy="128" r="17"/><path d="M78 186c-2-30 6-46 22-46s26 16 24 46z"/><path d="M122 180c18 4 22-14 10-20" fill="none" stroke="#3b2463" stroke-width="7" stroke-linecap="round"/></g>
      <circle cx="94" cy="126" r="2.4" fill="#f7e3b5"/><circle cx="106" cy="126" r="2.4" fill="#f7e3b5"/></svg>`;
  }

  function slot(kind, theme, s, cb) {
    const ink = theme === 'air' ? '#cfe3f7' : '#fff1d6';
    let inner = '';
    if (kind === 'f') inner = suit(s, 100, 140, 70, ink) + (theme === 'air' ? jetTop(100, 232, 26, ink, 0, .8) : paw(100, 234, 24, ink, .8));
    else if (kind === 'recycle') inner = `<path d="M100 92a50 50 0 1 1-46 30" fill="none" stroke="${ink}" stroke-width="12" stroke-linecap="round"/><path d="M38 108l18 22 22-18z" fill="${ink}"/>`;
    else if (kind === 'empty') inner = `<path d="M70 110l60 60M130 110l-60 60" stroke="${ink}" stroke-width="8" stroke-linecap="round" opacity=".6"/>`;
    else if (kind === 'king') inner = `<text x="100" y="166" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="64" fill="${ink}">K</text>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 280"><rect x="4" y="4" width="192" height="272" rx="16" fill="${ink}" fill-opacity=".08" stroke="${ink}" stroke-opacity=".55" stroke-width="5" stroke-dasharray="14 10"/><g opacity=".5">${inner}</g></svg>`;
  }
  function feltTile(theme) {
    if (theme === 'air') return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><path d="M60 0v40M60 80v40" stroke="#ffffff" stroke-opacity=".06" stroke-width="6"/><circle cx="14" cy="96" r="1.5" fill="#9fd0ff" fill-opacity=".18"/></svg>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140">${paw(36, 40, 18, '#ffffff', .05)}${paw(104, 108, 14, '#ffffff', .045)}</svg>`;
  }
  const url = svg => 'url("data:image/svg+xml,' + encodeURIComponent(svg).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29') + '")';
  return { cardFace, cardBack, slot, feltTile, url, suit, paw, jetTop, airliner, propPlane, SUIT_PATH, color, COLORS, catHead, FUR };
});
