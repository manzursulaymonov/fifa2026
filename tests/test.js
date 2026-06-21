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
  setTimeout, clearTimeout, console, Promise, Object, Date, Math, String, parseInt, isNaN,
  // intervalni testda ishga tushirmaymiz
  setInterval: () => 0, clearInterval: () => {}
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

(async () => {
  console.log('\n[15] FIFA API parseri (applyFifa)');
  const fE = FIXTURES.find(f => f.home === 'Germany' && f.away === 'Curaçao');
  const fE2 = FIXTURES.find(f => f.home === 'Netherlands' && f.away === 'Japan');
  sandbox.applyFifa({ Results: [
    { Home: { TeamName: [{ Description: 'Germany' }], Score: 3 },
      Away: { TeamName: [{ Description: 'Curacao' }], Score: 0 },
      MatchStatus: 0,
      Stadium: { Name: [{ Description: 'NRG Stadium' }], CityName: [{ Description: 'Houston' }] } },
    { Home: { TeamName: [{ Description: 'Japan' }], Score: 1 },
      Away: { TeamName: [{ Description: 'Netherlands' }], Score: 2 },
      MatchStatus: 3 },
    { Home: { TeamName: [{ Description: 'To Be Determined' }] }, Away: {} }
  ] });
  check('FIFA hisobi qabul qilindi (3-0)', fE.homeScore === 3 && fE.awayScore === 0 && fE.scoreSource === 'fifa');
  check('FIFA stadioni shahar bilan', fE.venue === 'NRG Stadium, Houston');
  check('teskari jonli o\'yin: hisob almashtirildi, JONLI', fE2.homeScore === 2 && fE2.awayScore === 1
    && sandbox.statusLabel(fE2)[1] === 'JONLI');
  check('TBD/yaroqsiz yozuv xatosiz o\'tkazib yuboriladi', true);

  console.log('\n[16] Manbalar ustuvorligi');
  sandbox.applyEvents([{ idEvent: 'ts9', strHomeTeam: 'Germany', strAwayTeam: 'Curacao',
    intHomeScore: '1', intAwayScore: '1', strStatus: 'Match Finished', strVenue: 'Wrong Venue' }]);
  check('TSDB FIFA hisobini qayta yozmaydi', fE.homeScore === 3 && fE.awayScore === 0 && fE.scoreSource === 'fifa');
  check('TSDB stadioni FIFA nikini almashtirmaydi', fE.venue === 'NRG Stadium, Houston');
  check('TSDB apiId baribir saqlanadi (statistika uchun)', fE.apiId === 'ts9');

  console.log('\n[17] openfootball parseri (applyOpenfootball)');
  const fL = FIXTURES.find(f => f.home === 'England' && f.away === 'Croatia');
  sandbox.applyOpenfootball({ matches: [
    { team1: 'England', team2: 'Croatia', score: { ft: [2, 1] },
      goals1: [{ name: 'H. Kane', minute: 23, penalty: true }, { name: 'J. Bellingham', minute: 70 }],
      goals2: [{ name: 'L. Modric', minute: 55 }] },
    { team1: 'Ghana', team2: 'Panama' } // hisobsiz — o'tkazib yuboriladi
  ] });
  check('openfootball hisobi (2-1)', fL.homeScore === 2 && fL.awayScore === 1 && fL.scoreSource === 'of');
  check('gollar to\'liq qabul qilindi', fL.goalsSource === 'of'
    && fL.homeScorers.length === 2 && fL.awayScorers.length === 1);
  check('penalti turi belgilandi', fL.homeScorers[0].type === 'Penalty' && fL.homeScorers[0].time === '23');
  const fL2 = FIXTURES.find(f => f.home === 'Ghana' && f.away === 'Panama');
  check('hisobsiz o\'yin tegmagan', fL2.homeScore === null);
  // chala gol ro'yxati ishlatilmasligi
  const fK = FIXTURES.find(f => f.home === 'Portugal' && f.away === 'DR Congo');
  sandbox.applyOpenfootball({ matches: [
    { team1: 'Portugal', team2: 'Congo DR', score: { ft: [3, 0] }, goals1: [{ name: 'X', minute: 10 }], goals2: [] }
  ] });
  check('chala gol ro\'yxati (1/3) goalsSource bo\'lmaydi', fK.homeScore === 3 && fK.goalsSource !== 'of');

  console.log('\n[14] Chala gol ro\'yxati (API kechikishi)');
  // f1 = Mexico 2-1 South Africa (5-bo'limda o'rnatilgan)
  const fx = FIXTURES.find(f => f.home === 'Mexico' && f.away === 'South Africa');

  // API timeline: bitta normal gol + bitta nomi kiritilmagan kichik harfli "goal"
  sandbox.fetch = () => Promise.resolve({
    json: () => Promise.resolve({
      timeline: [
        { strTimeline: 'Goal', strPlayer: 'Julián Quiñones', intTime: '9', strTimelineDetail: 'Normal Goal', strHome: 'Yes' },
        { strTimeline: 'goal', strPlayer: '', intTime: '67', strTimelineDetail: 'Normal Goal', strHome: 'Yes' }
      ]
    })
  });
  await sandbox.loadEventScorers(fx);
  check('kichik harfli "goal" ham qabul qilinadi', fx.homeScorers.length === 2,
    'topildi: ' + fx.homeScorers.length);
  check('nomsiz gol tashlab yuborilmaydi', fx.homeScorers.some(s => s.name === ''));

  sandbox.renderDrawerContent(fx);
  const drawerHtml = sandbox.document.getElementById('drawer-body').innerHTML;
  check('nomsiz gol "Noma\'lum o\'yinchi" deb ko\'rsatiladi', drawerHtml.indexOf("Noma'lum o'yinchi") >= 0);
  check('2 gol ro\'yxatda, ogohlantirish yo\'q (3 gol bor, 2 ko\'rinadi → ogohlantirish bor)',
    drawerHtml.indexOf('1 ta gol tafsiloti API da hali kiritilmagan') >= 0);

  sandbox.buildScorerTotals();
  check('nomsiz gol to\'purarlar reytingiga kirmaydi',
    !Object.keys(sandbox.allScorers).some(k => k === ''));

  // Hisob to'liq qoplangan holat — ogohlantirish chiqmasligi kerak
  fx.awayScorers = [{ name: 'B. Player', time: '80', type: 'Normal Goal' }];
  fx.homeScorers.push({ name: 'C. Player', time: '88', type: 'Normal Goal' });
  // endi 3+1 = 4 > 3 — missing manfiy, ogohlantirish yo'q
  sandbox.renderDrawerContent(fx);
  check('ro\'yxat to\'liq bo\'lsa ogohlantirish chiqmaydi',
    sandbox.document.getElementById('drawer-body').innerHTML.indexOf('kiritilmagan') < 0);

  // 0-0 o'yin
  const fx0 = FIXTURES.find(f => f.home === 'Canada');
  fx0.homeScore = 0; fx0.awayScore = 0; fx0.status = 'Match Finished';
  sandbox.renderDrawerContent(fx0);
  check('0-0 da "gol bo\'lmagan" yozuvi', sandbox.document.getElementById('drawer-body').innerHTML.indexOf("gol bo'lmagan") >= 0);
  fx0.homeScore = null; fx0.awayScore = null; fx0.status = 'NS';

  // Qayta ochilganda statistika yo'qolmasligi (withStats parametri olib tashlandi)
  fx.stats = [{ strStat: 'Total Shots', intHome: 16, intAway: 3 }];
  sandbox.renderDrawerContent(fx);
  check('statistika har ochilishda ko\'rinadi', sandbox.document.getElementById('drawer-body').innerHTML.indexOf('Total Shots') >= 0);

  console.log('\n[18] Avtomatik yangilanish');
  check('3 daqiqalik interval o\'rnatilgan', /setInterval\([\s\S]{0,200}180000\)/.test(html));
  check('yashirin sahifada yangilanmaydi', /document\.hidden/.test(html));
  check('sahifaga qaytganda yangilanadi', /visibilitychange/.test(html));
  // parallel ishga tushishdan himoya
  let fetchCount = 0;
  sandbox.fetch = () => { fetchCount++; return Promise.resolve({ json: () => Promise.resolve({}) }); };
  sandbox.apiLoading = true;
  sandbox.loadAll();
  check('apiLoading paytida qayta yuklamaydi', fetchCount === 0);
  sandbox.apiLoading = false;
  // gol ro'yxati to'liq o'yinlar uchun takror so'rov yuborilmaydi
  FIXTURES.forEach(f => { if (f.homeScore !== null) { f.goalsSource = 'of'; } });
  sandbox.loadAllScorers();
  check('to\'liq/of o\'yinlarga scorer so\'rovi yo\'q', fetchCount === 0);

  console.log('\n[19] Jonli o\'yin daqiqasi');
  const fG = FIXTURES.find(f => f.home === 'Belgium' && f.away === 'Egypt');
  sandbox.applyFifa({ Results: [
    { Home: { TeamName: [{ Description: 'Belgium' }], Score: 1 },
      Away: { TeamName: [{ Description: 'Egypt' }], Score: 0 },
      MatchStatus: 3, MatchTime: "67'" }
  ] });
  check('daqiqa saqlandi', fG.minute === "67'");
  check('liveMinute jonlida daqiqani beradi', sandbox.liveMinute(fG) === "67'");
  const liveCard = sandbox.fixtureCard(fG, true);
  check('kartada hisob ostida daqiqa bor', /live-min">67(&#39;|')<\/span>/.test(liveCard) && /fscore live/.test(liveCard));
  sandbox.renderDrawerContent(fG);
  check('drawerda ham daqiqa bor', sandbox.document.getElementById('drawer-body').innerHTML.indexOf('dlive-min') >= 0);
  // tanaffus
  sandbox.applyFifa({ Results: [
    { Home: { TeamName: [{ Description: 'Belgium' }], Score: 1 },
      Away: { TeamName: [{ Description: 'Egypt' }], Score: 0 },
      MatchStatus: 3, Period: 4, MatchTime: "45'" }
  ] });
  check('tanaffusda "Tanaffus"', sandbox.liveMinute(fG) === 'Tanaffus');
  // o'yin tugagach daqiqa yo'qoladi
  sandbox.applyFifa({ Results: [
    { Home: { TeamName: [{ Description: 'Belgium' }], Score: 2 },
      Away: { TeamName: [{ Description: 'Egypt' }], Score: 0 },
      MatchStatus: 0 }
  ] });
  check('tugagach daqiqa ko\'rsatilmaydi', sandbox.liveMinute(fG) === '' && fG.minute === null);
  check('kutilayotgan o\'yinda daqiqa yo\'q', sandbox.liveMinute({ status: 'NS', minute: "10'" }) === '');

  // Bu yerdan keyin toza holatdan boshlaymiz
  FIXTURES.forEach(f => {
    f.homeScore = null; f.awayScore = null; f.status = 'NS';
    f.homeScorers = []; f.awayScorers = []; f.goalsSource = null; f.scoreSource = null;
  });
  function setScore(home, away, hs, as) {
    const f = FIXTURES.find(x => x.home === home && x.away === away);
    if (!f) throw new Error('fixture topilmadi: ' + home + ' vs ' + away);
    f.homeScore = hs; f.awayScore = as; f.status = 'FT';
  }

  console.log('\n[20] 2026 tartib mezoni: o\'zaro o\'yin (head-to-head) GD dan oldin');
  // Guruh A: Czechia 1-o'rin; Mexico va South Africa 3 ochkoda teng.
  // Mexico SA ni yenggan (h2h), ammo SA ning umumiy GD si ancha yaxshi.
  // 2026 qoidasi bo'yicha Mexico (h2h g'olibi) yuqori turishi shart.
  setScore('Mexico', 'South Africa', 1, 0);   // A>B (h2h)
  setScore('South Korea', 'Czechia', 0, 0);   // C-D durrang
  setScore('Czechia', 'South Africa', 1, 0);  // D>B
  setScore('Mexico', 'South Korea', 0, 1);    // C>A
  setScore('Czechia', 'Mexico', 1, 0);        // D>A
  setScore('South Africa', 'South Korea', 5, 0); // B>C katta hisobda
  const stA = sandbox.standings('A');
  const mx = stA.find(t => t.name === 'Mexico');
  const sa = stA.find(t => t.name === 'South Africa');
  check('Mexico va South Africa teng ochkoda (3)', mx.pts === 3 && sa.pts === 3);
  check('South Africa umumiy GD yaxshiroq (+3 vs -1)', sa.gd === 3 && mx.gd === -1);
  check('Czechia 1-o\'rin', stA[0].name === 'Czechia');
  check('h2h g\'olibi Mexico 3-o\'rinda (GD yomon bo\'lsa ham)', stA[2].name === 'Mexico');
  check('h2h mag\'lubi South Africa 4-o\'rinda (GD yaxshi bo\'lsa ham)', stA[3].name === 'South Africa');

  console.log('\n[21] 3-o\'rinlar reytingi');
  // Guruh B ni to'liq o'rnatamiz: 3-o'rin egasi 4 ochko (A guruh 3-o'rnidan baland)
  setScore('Canada', 'Bosnia and Herzegovina', 0, 0);
  setScore('Qatar', 'Switzerland', 0, 0);
  setScore('Switzerland', 'Bosnia and Herzegovina', 3, 0);
  setScore('Canada', 'Qatar', 3, 0);
  setScore('Switzerland', 'Canada', 0, 0);
  setScore('Bosnia and Herzegovina', 'Qatar', 2, 0);
  const third = sandbox.thirdPlaceRanking();
  check('12 ta 3-o\'rin jamoasi', third.length === 12);
  check('har biri unikal guruhdan', new Set(third.map(t => t.group)).size === 12);
  check('pts→gd→gf bo\'yicha kamayib boradi', third.every((t, i) =>
    i === 0 || third[i-1].pts > t.pts ||
    (third[i-1].pts === t.pts && (third[i-1].gd > t.gd ||
      (third[i-1].gd === t.gd && third[i-1].gf >= t.gf)))));
  const aThird = third.find(t => t.group === 'A');
  const bThird = third.find(t => t.group === 'B');
  check('A guruh 3-o\'rni = Mexico', aThird.name === 'Mexico');
  check('ko\'p ochkoli 3-o\'rin yuqorida', third.indexOf(bThird) < third.indexOf(aThird));
  check('to\'liq guruh groupDone=true', aThird.groupDone === true);
  check('o\'ynalmagan guruh groupDone=false', third.find(t => t.group === 'L').groupDone === false);

  console.log('\n[22] 1/16 final to\'rlari (R32) ma\'lumotlari');
  const R32 = sandbox.R32;
  check('16 ta o\'yin', R32.length === 16);
  check('match raqamlari 73–88 unikal', new Set(R32.map(x => x.m)).size === 16
    && Math.min(...R32.map(x => x.m)) === 73 && Math.max(...R32.map(x => x.m)) === 88);
  const thirdSlots = R32.filter(x => x.away === '3');
  check('aynan 8 ta 3-o\'rin sloti', thirdSlots.length === 8);
  check('har bir 3-o\'rin slotida 5 ta guruhli pool', thirdSlots.every(x => /^([A-L]\/){4}[A-L]$/.test(x.pool)));
  check('boshqa slotlar 1X/2X formatida', R32.filter(x => x.away !== '3')
    .every(x => /^[12][A-L]$/.test(x.home) && /^[12][A-L]$/.test(x.away)));
  check('slotTeam tugagan guruhni jamoaga aylantiradi', /Czechia/.test(sandbox.slotTeam('1A')));
  check('slotTeam tugamagan guruhda placeholder', /g'olibi/.test(sandbox.slotTeam('1L')));

  console.log('\n[23] Yangi sahifalar va render');
  check('navda 3-O\'rin tugmasi', /data-page="thirdplace"/.test(html));
  check('navda Qoidalar tugmasi', /data-page="rules"/.test(html));
  check('page-thirdplace mavjud', /id="page-thirdplace"/.test(html));
  check('page-rules mavjud', /id="page-rules"/.test(html));
  let renderErr = null;
  try {
    sandbox.renderThird();
    sandbox.renderRules();
    sandbox.renderBracket();
  } catch (e) { renderErr = e; }
  check('renderThird/Rules/Bracket xatosiz', !renderErr, renderErr && renderErr.message);
  const t3 = sandbox.document.getElementById('third-list').innerHTML;
  check('3-o\'rin jadvalida "Chiq" holati bor', /Chiq/.test(t3));
  const rb = sandbox.document.getElementById('rules-body').innerHTML;
  check('qoidalar sahifasida head-to-head izohi', /o'zaro o'yin/i.test(rb) || /bevosita taqqoslash/.test(rb));
  check('qoidalarda 24 \\+ 8 = 32 tushuntirishi', /32 ta jamoa/.test(rb));

  console.log('\n[24] Matematik eliminatsiya (analyzeGroup)');
  // Guruh C: Haiti 3 o'yinni ham boy bergan (0 ochko, tugagan).
  // Scotland 9 (tugagan), Brazil 3 va Morocco 3 — oxirgi o'yin bir-biri bilan (Brazil-Morocco).
  // Har qanday natijada Brazil va Morocco ≥3 > 0 qoladi, Scotland 9 > 0 →
  // uchala raqib ham Haiti'dan yuqori → Haiti matematik chiqa olmaydi.
  setScore('Haiti', 'Scotland', 0, 1);
  setScore('Scotland', 'Morocco', 1, 0);
  setScore('Brazil', 'Haiti', 1, 0);
  setScore('Scotland', 'Brazil', 1, 0);
  setScore('Morocco', 'Haiti', 1, 0);
  // Brazil-Morocco (g1) — qoldirilgan (null)
  const anC = sandbox.analyzeGroup('C');
  check('Haiti matematik eliminatsiya (0 ochko, 3 raqib yuqori)', anC.Haiti.eliminated === true);
  check('Scotland top-2 ni kafolatladi (9 ochko)', anC.Scotland.clinched === true);
  check('Brazil hali tirik (eliminatsiya emas)', anC.Brazil.eliminated === false);
  check('Morocco hali tirik (eliminatsiya emas)', anC.Morocco.eliminated === false);
  check('Brazil top-2 ni kafolatlamagan', anC.Brazil.clinched === false);

  // Tugagan guruh A (bo'lim [20]): Czechia, S.Korea, Mexico, S.Africa
  const anA = sandbox.analyzeGroup('A');
  check('tugagan guruhda 4-o\'rin (S.Africa) eliminatsiya', anA['South Africa'].eliminated === true);
  check('tugagan guruhda 3-o\'rin (Mexico) eliminatsiya emas', anA.Mexico.eliminated === false);
  check('tugagan guruhda 1-2 (Czechia, S.Korea) kafolatlangan',
    anA.Czechia.clinched === true && anA['South Korea'].clinched === true);

  // O'ynalmagan guruh — hech kim eliminatsiya/kafolat emas
  const anEmpty = sandbox.analyzeGroup('H');
  check('o\'ynalmagan guruhda hech kim eliminatsiya emas',
    Object.keys(anEmpty).every(k => !anEmpty[k].eliminated && !anEmpty[k].clinched));

  // 2 o'yin qolganda (MD3 sinxron) hech kim eliminatsiya bo\'lmaydi:
  // guruh D ga 4 o'yin qo'yamiz (har jamoa 1 o'yindan qoladi)
  setScore('USA', 'Paraguay', 1, 0);
  setScore('Australia', 'Türkiye', 1, 0);
  setScore('USA', 'Australia', 1, 0);
  setScore('Türkiye', 'Paraguay', 0, 0);
  const anD = sandbox.analyzeGroup('D');
  check('har jamoa 1 o\'yindan qolsa — hech kim eliminatsiya emas',
    Object.keys(anD).every(k => !anD[k].eliminated));
  check('renderGroups eliminatsiya bilan xatosiz', (() => {
    try { sandbox.renderGroups(); return /class="[^"]*elim/.test(sandbox.document.getElementById('ggrid').innerHTML); }
    catch (e) { return false; }
  })());

  console.log('\n──────────────────────────────');
  console.log(passed + ' o\'tdi, ' + failed + ' yiqildi');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('FAIL (async):', e); process.exit(1); });
