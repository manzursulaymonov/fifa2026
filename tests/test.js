// index.html ichidagi skriptni stub DOM bilan ishga tushirib,
// ma'lumotlar va mantiq invariantlarini tekshiradi.
// Ishga tushirish: node tests/test.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.error('FAIL: <script> blok topilmadi'); process.exit(1); }

function makeEl() {
  const attrs = {};
  return {
    innerHTML: '', textContent: '', className: '',
    classList: { add() {}, remove() {}, contains() { return false; } },
    addEventListener() {},
    setAttribute(k, v) { attrs[k] = v; },
    getAttribute(k) { return attrs[k]; }
  };
}
const elements = {};
const sandbox = {
  document: {
    documentElement: makeEl(),
    getElementById(id) { if (!elements[id]) elements[id] = makeEl(); return elements[id]; },
    querySelectorAll() { return []; },
    addEventListener() {}
  },
  // API chaqiruvlari testda bo'sh javob qaytaradi
  fetch() { return Promise.resolve({ json: () => Promise.resolve({}) }); },
  setTimeout, clearTimeout, console, Promise, Object, Date, Math, String, parseInt, isNaN
};
vm.createContext(sandbox);
vm.runInContext(m[1], sandbox);

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.error('  ✗ ' + name + (detail ? ' — ' + detail : '')); }
}

const { GROUPS, SCHEDULE, FIXTURES, FLAGS } = sandbox;

console.log('\n[1] Guruhlar ma\'lumotlari');
const groupKeys = Object.keys(GROUPS);
check('12 ta guruh', groupKeys.length === 12, 'topildi: ' + groupKeys.length);
const allTeams = groupKeys.flatMap(g => GROUPS[g]);
check('48 ta jamoa', allTeams.length === 48, 'topildi: ' + allTeams.length);
const dupes = allTeams.filter((t, i) => allTeams.indexOf(t) !== i);
check('takrorlangan jamoa yo\'q', dupes.length === 0, 'takror: ' + dupes.join(', '));
groupKeys.forEach(g => {
  if (GROUPS[g].length !== 4) check('Guruh ' + g + ' 4 jamoadan iborat', false, GROUPS[g].length);
});

console.log('\n[2] O\'yinlar jadvali');
check('72 ta guruh o\'yini', FIXTURES.length === 72, 'topildi: ' + FIXTURES.length);
groupKeys.forEach(g => {
  const fx = FIXTURES.filter(f => f.group === g);
  if (fx.length !== 6) check('Guruh ' + g + ': 6 o\'yin', false, fx.length);
  // har bir juftlik faqat bir marta o'ynaydi
  const pairs = new Set(fx.map(f => [f.home, f.away].sort().join('|')));
  if (pairs.size !== 6) check('Guruh ' + g + ': juftliklar unikal', false, pairs.size + ' ta juftlik');
  // har bir jamoa 3 o'yin
  GROUPS[g].forEach(t => {
    const n = fx.filter(f => f.home === t || f.away === t).length;
    if (n !== 3) check('Guruh ' + g + ' / ' + t + ': 3 o\'yin', false, n);
  });
  // 3-tur o'yinlari bir vaqtda
  const sorted = fx.slice().sort((a, b) => a.utc.localeCompare(b.utc));
  if (sorted[4].utc !== sorted[5].utc) check('Guruh ' + g + ': 3-tur bir vaqtda', false, sorted[4].utc + ' vs ' + sorted[5].utc);
});
check('guruh ichi tekshiruvlari o\'tdi', true);
const badDates = FIXTURES.filter(f => {
  const d = new Date(f.utc);
  return isNaN(d) || d < new Date('2026-06-11T00:00:00Z') || d > new Date('2026-06-28T12:00:00Z');
});
check('sanalar 11–28 iyun oralig\'ida va to\'g\'ri', badDates.length === 0,
  badDates.map(f => f.home + '-' + f.away + ':' + f.utc).join(', '));
check('hamma o\'yinda stadion bor', FIXTURES.every(f => f.venue && f.venue.length > 3));
check('ochilish o\'yini: Mexico vs South Africa, Azteca',
  FIXTURES[0].home === 'Mexico' && FIXTURES[0].away === 'South Africa' && /Azteca/.test(FIXTURES[0].venue));

console.log('\n[3] Bayroqlar');
const noFlag = allTeams.filter(t => !FLAGS[t]);
check('hamma jamoaning bayrog\'i bor', noFlag.length === 0, 'yo\'q: ' + noFlag.join(', '));
check('Angliya va Shotlandiya bayroqlari har xil', FLAGS['England'] !== FLAGS['Scotland']);
check('Angliya bayrog\'i tag-sequence', /e0065-e006e-e0067/.test(FLAGS['England']));
check('Shotlandiya bayrog\'i tag-sequence', /e0073-e0063-e0074/.test(FLAGS['Scotland']));

console.log('\n[4] Jamoa nomlarini moslashtirish (API aliaslari)');
const cases = [
  [{ strHomeTeam: 'Mexico', strAwayTeam: 'South Africa' }, 'Mexico', 'South Africa', false],
  [{ strHomeTeam: 'South Africa', strAwayTeam: 'Korea Republic' }, 'South Africa', 'South Korea', false],
  [{ strHomeTeam: 'United States', strAwayTeam: 'Paraguay' }, 'USA', 'Paraguay', false],
  [{ strHomeTeam: 'Czech Republic', strAwayTeam: 'South Africa' }, 'Czechia', 'South Africa', false],
  [{ strHomeTeam: 'Turkey', strAwayTeam: 'Australia' }, 'Australia', 'Türkiye', true],
  [{ strHomeTeam: "Cote d'Ivoire", strAwayTeam: 'Ecuador' }, 'Ivory Coast', 'Ecuador', false],
  [{ strHomeTeam: 'Congo DR', strAwayTeam: 'Portugal' }, 'Portugal', 'DR Congo', true],
  [{ strHomeTeam: 'Bosnia-Herzegovina', strAwayTeam: 'Qatar' }, 'Bosnia and Herzegovina', 'Qatar', false],
  [{ strHomeTeam: 'Curacao', strAwayTeam: 'Germany' }, 'Germany', 'Curaçao', true]
];
cases.forEach(([ev, home, away, swapped]) => {
  const r = sandbox.matchFixture(ev);
  const ok = r && r.fix.home === home && r.fix.away === away && r.swapped === swapped;
  check(ev.strHomeTeam + ' vs ' + ev.strAwayTeam + ' → ' + home + '/' + away + (swapped ? ' (swap)' : ''),
    ok, r ? 'oldi: ' + r.fix.home + '/' + r.fix.away + ' swap=' + r.swapped : 'mos kelmadi');
});
check('mavjud bo\'lmagan juftlik null qaytaradi',
  sandbox.matchFixture({ strHomeTeam: 'Mexico', strAwayTeam: 'Brazil' }) === null);
check('TBD/bo\'sh nomlar null qaytaradi',
  sandbox.matchFixture({ strHomeTeam: '', strAwayTeam: '' }) === null);

console.log('\n[5] applyEvents — hisoblarni qabul qilish');
sandbox.applyEvents([
  { idEvent: 'e1', strHomeTeam: 'Mexico', strAwayTeam: 'South Africa', intHomeScore: '2', intAwayScore: '1', strStatus: 'Match Finished', strVenue: 'Estadio Azteca' },
  { idEvent: 'e2', strHomeTeam: 'Korea Republic', strAwayTeam: 'Czech Republic', intHomeScore: null, intAwayScore: null, strStatus: 'Not Started' },
  { idEvent: 'e3', strHomeTeam: 'Turkey', strAwayTeam: 'Australia', intHomeScore: '0', intAwayScore: '3', strStatus: 'Match Finished' }
]);
const f1 = FIXTURES.find(f => f.home === 'Mexico' && f.away === 'South Africa');
check('hisob saqlandi (2-1)', f1.homeScore === 2 && f1.awayScore === 1);
const f2 = FIXTURES.find(f => f.home === 'South Korea' && f.away === 'Czechia');
check('null hisob NaN bo\'lmadi', f2.homeScore === null && f2.awayScore === null);
const f3 = FIXTURES.find(f => f.home === 'Australia' && f.away === 'Türkiye');
check('teskari o\'yin hisobi almashtirildi (3-0)', f3.homeScore === 3 && f3.awayScore === 0 && f3.apiSwapped === true);

console.log('\n[6] Holat belgisi (statusLabel)');
check('"Match Finished" → Tugadi', sandbox.statusLabel({ status: 'Match Finished', homeScore: 1 })[1] === 'Tugadi');
check('"FT" → Tugadi', sandbox.statusLabel({ status: 'FT', homeScore: 1 })[1] === 'Tugadi');
check('"1st Half" → JONLI', sandbox.statusLabel({ status: '1st Half', homeScore: 0 })[1] === 'JONLI');
check('"HT" → JONLI', sandbox.statusLabel({ status: 'HT', homeScore: 1 })[1] === 'JONLI');
check('"Not Started" → Kutilmoqda', sandbox.statusLabel({ status: 'Not Started', homeScore: null })[1] === 'Kutilmoqda');

console.log('\n[7] Turnir jadvali (standings)');
const stA = sandbox.standings('A');
const mex = stA.find(t => t.name === 'Mexico');
check('Mexico: 1 o\'yin, 3 ochko, GD +1', mex.p === 1 && mex.pts === 3 && mex.gd === 1,
  JSON.stringify(mex));
check('Mexico jadval boshida', stA[0].name === 'Mexico');
const rsa = stA.find(t => t.name === 'South Africa');
check('South Africa: 1 mag\'lubiyat, 0 ochko', rsa.l === 1 && rsa.pts === 0);

console.log('\n[8] XSS himoyasi (esc)');
check('teglar qochiriladi', sandbox.esc('<img src=x onerror=alert(1)>') === '&lt;img src=x onerror=alert(1)&gt;');
check('qo\'shtirnoq qochiriladi', sandbox.esc('a"b\'c') === 'a&quot;b&#39;c');
check('null bo\'sh satr', sandbox.esc(null) === '');

console.log('\n[9] Render funksiyalari xatosiz ishlaydi');
try {
  sandbox.renderAll();
  sandbox.renderGroups();
  sandbox.renderMatches();
  sandbox.renderScorers();
  const card = sandbox.fixtureCard(FIXTURES[0], true);
  check('renderlar ishladi', true);
  check('kartada sana/vaqt bor', /\d\d\.\d\d\.2026/.test(card) && /\d\d:\d\d/.test(card));
  check('kartada hisob bor (2 — 1)', card.indexOf('2 &mdash; 1') >= 0);
} catch (e) {
  check('renderlar ishladi', false, e.message);
}

console.log('\n[10] Gol uruvchilar hisobi');
f1.homeScorers = [{ name: 'R. Jiménez', time: '12', type: 'Normal Goal' }, { name: 'R. Jiménez', time: '55', type: 'Penalty' }];
f1.awayScorers = [{ name: 'X. Defender', time: '80', type: 'Own Goal' }];
sandbox.buildScorerTotals();
const scorers = Object.values(sandbox.allScorers);
check('avtogol hisobga olinmaydi', !scorers.some(s => s.name === 'X. Defender'));
const jim = scorers.find(s => s.name === 'R. Jiménez');
check('penalti ham gol sanaladi (2 gol)', jim && jim.goals === 2, JSON.stringify(jim));

console.log('\n[11] Mavzu (dark/light)');
check('standart mavzu dark', sandbox.getPreferredTheme() === 'dark');
sandbox.applyTheme('light');
check('light qo\'llanadi', sandbox.curTheme === 'light'
  && sandbox.document.documentElement.getAttribute('data-theme') === 'light');
sandbox.toggleTheme();
check('toggle dark ga qaytaradi', sandbox.curTheme === 'dark'
  && sandbox.document.documentElement.getAttribute('data-theme') === 'dark');
const themeBtn = sandbox.document.getElementById('themebtn');
check('tugma ikonkasi yangilanadi', themeBtn.textContent === '☀️');
const lightVars = html.match(/\[data-theme="light"\]\s*{([^}]*)}/);
const darkVars = html.match(/:root\s*{([^}]*)}/);
check('light va dark bir xil o\'zgaruvchilar to\'plamiga ega', (() => {
  if (!lightVars || !darkVars) return false;
  const names = b => new Set([...b.matchAll(/--[\w-]+/g)].map(x => x[0]));
  const d = names(darkVars[1]), l = names(lightVars[1]);
  return d.size === l.size && [...d].every(n => l.has(n));
})());
check('hardcoded oq/qora rang qolmagan (CSS asosiy bloklarda)', (() => {
  const css = html.match(/<style>([\s\S]*)<\/style>/)[1];
  // faqat var ta'riflaridan tashqarida qidiramiz
  const body = css.replace(/:root\s*{[^}]*}/, '').replace(/\[data-theme="light"\]\s*{[^}]*}/, '');
  return !/rgba\(255,255,255/.test(body) && !/rgba\(240,192,64/.test(body);
})());

console.log('\n[12] Kirish imkoniyati (a11y)');
const card2 = sandbox.fixtureCard(FIXTURES[0], true);
check('kartada tabindex va role bor', /tabindex="0"/.test(card2) && /role="button"/.test(card2));
check('kartada aria-label bor', /aria-label="/.test(card2));
check('drawer dialog roli bilan', /role="dialog"/.test(html) && /aria-modal="true"/.test(html));
check('toast aria-live', /aria-live="polite"/.test(html));
check('reduced-motion qo\'llab-quvvatlanadi', /prefers-reduced-motion/.test(html));

console.log('\n[13] Guruh jadvali — uzun nomlar ochkolarni siqib chiqarmasligi');
sandbox.renderGroups();
const ggridHtml = sandbox.document.getElementById('ggrid').innerHTML;
check('Bosniya qisqa nom bilan ko\'rsatiladi', />Bosnia</.test(ggridHtml));
check('to\'liq nom title atributida saqlanadi', /title="Bosnia and Herzegovina"/.test(ggridHtml));
check('nom hujayrasi tname klassi bilan (ellipsis)', /class="tname"/.test(ggridHtml));
check('CSS: birinchi ustun cho\'ziluvchan, raqamlar nowrap', (() => {
  const css = html.match(/<style>([\s\S]*)<\/style>/)[1];
  return /\.gtbl td:first-child[^}]*max-width: 0/.test(css)
    && /\.gtbl td[^:}]*{[^}]*white-space: nowrap/.test(css)
    && /\.gtbl \.tname[^}]*text-overflow: ellipsis/.test(css);
})());
check('shortName boshqa nomlarni o\'zgartirmaydi', sandbox.shortName('Uzbekistan') === 'Uzbekistan');

console.log('\n──────────────────────────────');
console.log(passed + ' o\'tdi, ' + failed + ' yiqildi');
process.exit(failed ? 1 : 0);
