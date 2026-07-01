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

  // O'ZARO O'YIN orqali eliminatsiya (foydalanuvchi misoli, guruh D):
  // USA 6, Australia 3, Paraguay 3, Türkiye 0. Qolgan: Türkiye-USA, Paraguay-Australia.
  // Türkiye AQShni yutsa ham 3 ochko; Paraguay/Australiadan biri 3 ochkoda qoladi,
  // Türkiye esa ularning IKKALASIGA ham o'zaro o'yinda yutqazgan → har doim 4-o'rin.
  setScore('USA', 'Paraguay', 4, 1);
  setScore('Australia', 'Türkiye', 2, 0);
  setScore('USA', 'Australia', 2, 0);
  setScore('Türkiye', 'Paraguay', 0, 1);
  const anD = sandbox.analyzeGroup('D');
  check('Türkiye o\'zaro o\'yin hisobiga matematik eliminatsiya', anD['Türkiye'].eliminated === true);
  check('USA top-2 ni kafolatladi', anD['USA'].clinched === true);
  check('Australia hali tirik', anD['Australia'].eliminated === false);
  check('Paraguay hali tirik', anD['Paraguay'].eliminated === false);

  // NOTO'G'RI eliminatsiya bo'lmasligi: agar 4-o'rindagi jamoa raqibini
  // o'zaro o'yinda YUTGAN bo'lsa (o'zaro o'yin sikli) — u hali tirik.
  // Guruh E: Germany 6; Ivory Coast Ecuador'ni yutgan, Ecuador Curaçao'ni yutgan,
  // Curaçao Ivory Coast'ni yutgan (sikl), hammasi 3 ochko bo'lishi mumkin.
  setScore('Germany', 'Curaçao', 3, 0);
  setScore('Ivory Coast', 'Ecuador', 1, 0);
  setScore('Germany', 'Ivory Coast', 2, 0);
  setScore('Ecuador', 'Curaçao', 1, 0);   // Ecuador Curaçao'ni yutdi
  // qolgan: Germany-Ecuador, Curaçao-Ivory Coast
  const anE = sandbox.analyzeGroup('E');
  check('o\'zaro o\'yinda yutgan jamoa noto\'g\'ri eliminatsiya qilinmaydi',
    anE['Curaçao'].eliminated === false || anE['Ecuador'].eliminated === false);

  check('renderGroups eliminatsiya bilan xatosiz', (() => {
    try { sandbox.renderGroups(); return /class="[^"]*elim/.test(sandbox.document.getElementById('ggrid').innerHTML); }
    catch (e) { return false; }
  })());

  console.log('\n[25] 3-o\'rin: matematik kafolat / imkonsizlik (thirdAdvanceStatus)');
  function resetAll() {
    FIXTURES.forEach(f => { f.homeScore = null; f.awayScore = null; f.status = 'NS'; f.scoreSource = null; });
  }
  // Guruhni "chiziqli" tugatadi: yuqori seed pastini yutadi → ochko 9,6,3,0; 3-o'rin = 3 ochko
  function completeLinear(g) {
    const T = GROUPS[g];
    FIXTURES.filter(f => f.group === g).forEach(f => {
      if (T.indexOf(f.home) < T.indexOf(f.away)) { f.homeScore = 1; f.awayScore = 0; }
      else { f.homeScore = 0; f.awayScore = 1; }
      f.status = 'FT';
    });
  }
  check('completeLinear → 3-o\'rin oralig\'i {3,3}', (() => {
    resetAll(); completeLinear('B');
    const rng = sandbox.thirdPointsRange('B');
    return rng.min === 3 && rng.max === 3;
  })());
  check('o\'ynalmagan guruh 3-o\'rin maksimumi 6', (() => {
    resetAll();
    return sandbox.thirdPointsRange('A').max === 6;
  })());

  // KAFOLAT: guruh A 3-o'rni 6 ochko (6-6-6-0 sikli), qolgan 11 guruh 3-o'rni 3 ochko.
  resetAll();
  // Guruh A: Czechia pastda (0), Mexico/SA/SKorea sikl (har biri 6)
  setScore('Mexico', 'South Africa', 1, 0);
  setScore('Mexico', 'South Korea', 0, 1);
  setScore('Czechia', 'Mexico', 0, 1);
  setScore('Czechia', 'South Africa', 0, 1);
  setScore('South Africa', 'South Korea', 1, 0);
  setScore('South Korea', 'Czechia', 1, 0);
  ['B','C','D','E','F','G','H','I','J','K','L'].forEach(completeLinear);
  const ts1 = sandbox.thirdAdvanceStatus();
  check('A guruh 3-o\'rni (6 ochko) — chiqishi KAFOLATLANGAN', ts1.A === 'clinched');
  check('3 ochkoli 3-o\'rinlar hali kafolatlanmagan', ts1.B === null && ts1.L === null);
  check('hech bir 3-o\'rin noto\'g\'ri eliminatsiya emas',
    Object.keys(ts1).every(g => ts1[g] !== 'eliminated'));

  // IMKONSIZ: guruh A 3-o'rni 1 ochko, 8 ta boshqa guruh 3-o'rni 3 ochko (aniq yuqori).
  resetAll();
  // Guruh A: Mexico 9, SA 6, SKorea 1, Czechia 1 (SKorea-Czechia durang)
  setScore('Mexico', 'South Africa', 1, 0);
  setScore('Mexico', 'South Korea', 1, 0);
  setScore('Czechia', 'Mexico', 0, 1);
  setScore('Czechia', 'South Africa', 0, 1);
  setScore('South Africa', 'South Korea', 1, 0);
  setScore('South Korea', 'Czechia', 0, 0);
  ['B','C','D','E','F','G','H','I'].forEach(completeLinear); // 8 ta guruh, 3-o'rin = 3
  const ts2 = sandbox.thirdAdvanceStatus();
  check('A guruh 3-o\'rni (1 ochko) — 8 talikka IMKONSIZ', ts2.A === 'eliminated');
  check('3 ochkoli 3-o\'rin imkonsiz emas', ts2.B !== 'eliminated');
  check('renderThird kafolat/imkonsiz bilan xatosiz', (() => {
    try { sandbox.renderThird(); const h = sandbox.document.getElementById('third-list').innerHTML;
      return /Kafolat|Imkonsiz/.test(h); }
    catch (e) { return false; }
  })());

  console.log('\n[26] Uzbekistan chiqish stsenariysi (real joriy holat, MD2 dan keyin)');
  FIXTURES.forEach(f => { f.homeScore = null; f.awayScore = null; f.status = 'NS'; f.scoreSource = null; });
  function setM(t1, t2, s1, s2) {
    const f = FIXTURES.find(x => (x.home === t1 && x.away === t2) || (x.home === t2 && x.away === t1));
    if (!f) throw new Error('topilmadi: ' + t1 + ' / ' + t2);
    if (f.home === t1) { f.homeScore = s1; f.awayScore = s2; } else { f.homeScore = s2; f.awayScore = s1; }
    f.status = 'FT';
  }
  // Barcha 12 guruh, MD1-2 natijalari (openfootball)
  setM('Mexico','South Africa',2,0); setM('South Korea','Czechia',2,1); setM('Czechia','South Africa',1,1); setM('Mexico','South Korea',1,0);
  setM('Canada','Bosnia and Herzegovina',1,1); setM('Qatar','Switzerland',1,1); setM('Switzerland','Bosnia and Herzegovina',4,1); setM('Canada','Qatar',6,0);
  setM('Brazil','Morocco',1,1); setM('Haiti','Scotland',0,1); setM('Scotland','Morocco',0,1); setM('Brazil','Haiti',3,0);
  setM('USA','Paraguay',4,1); setM('Australia','Türkiye',2,0); setM('USA','Australia',2,0); setM('Türkiye','Paraguay',0,1);
  setM('Germany','Curaçao',7,1); setM('Ivory Coast','Ecuador',1,0); setM('Germany','Ivory Coast',2,1); setM('Ecuador','Curaçao',0,0);
  setM('Netherlands','Japan',2,2); setM('Sweden','Tunisia',5,1); setM('Netherlands','Sweden',5,1); setM('Tunisia','Japan',0,4);
  setM('Belgium','Egypt',1,1); setM('Iran','New Zealand',2,2); setM('Belgium','Iran',0,0); setM('New Zealand','Egypt',1,3);
  setM('Spain','Cape Verde',0,0); setM('Saudi Arabia','Uruguay',1,1); setM('Spain','Saudi Arabia',4,0); setM('Uruguay','Cape Verde',2,2);
  setM('France','Senegal',3,1); setM('Iraq','Norway',1,4); setM('France','Iraq',3,0); setM('Norway','Senegal',3,2);
  setM('Argentina','Algeria',3,0); setM('Austria','Jordan',3,1); setM('Argentina','Austria',2,0); setM('Jordan','Algeria',1,2);
  setM('Portugal','DR Congo',1,1); setM('Uzbekistan','Colombia',1,3); setM('Portugal','Uzbekistan',5,0); setM('Colombia','DR Congo',1,0);
  setM('England','Croatia',4,2); setM('Ghana','Panama',1,0); setM('England','Ghana',0,0); setM('Panama','Croatia',0,1);

  const A = sandbox.chancesAnalysis('Uzbekistan');
  check('verdikt: TIRIK — faqat 3-o\'rin orqali', A.verdict === 'alive-third');
  check('to\'g\'ridan-to\'g\'ri (1-2) imkonsiz', A.canTop2 === false);
  check('3-o\'rin uchun faqat g\'alaba kerak', sandbox.reqLabel(A.own.top3) === "faqat g'alaba");
  check('Uzbekistan oxirgi o\'yini DR Congo bilan',
    A.own.ownMatch && A.own.ownMatch.indexOf('DR Congo') >= 0 && A.own.ownMatch.indexOf('Uzbekistan') >= 0);
  const lockedG = A.locked.map(x => x.g).sort().join('');
  const softG = A.soft.map(x => x.g).sort().join('');
  check('qulflangan guruhlar = C,D,F,J,L', lockedG === 'CDFJL', 'oldi: ' + lockedG);
  check('yumshoq guruhlar = A,B,E,G,H,I', softG === 'ABEGHI', 'oldi: ' + softG);
  check('kamida 4 ta yumshoq guruh qulashi kerak', A.need === 4);
  check('yumshoq guruhlar 3-o\'rni ≤2 ochkoga tushadi', A.soft.every(s => s.info.minPts <= 2));
  check('qulflangan guruhlar 3-o\'rni ≥3 ochko', A.locked.every(l => l.info.minPts >= 3));
  check('FIFA reyting: Uzbekistan 50, DR Congo 43', sandbox.fifaRank('Uzbekistan') === 50 && sandbox.fifaRank('DR Congo') === 43);

  // Minimal shartlar (ahamiyatsiz o'yinlar tashlanadi, eng zaif yetarli natija)
  const condB = sandbox.collapseCondition('B', 2);
  check('B sharti: faqat 1 ta o\'yin muhim (Switzerland o\'yini emas)',
    condB.parts && condB.parts.length === 1 && condB.parts[0].m.indexOf('Qatar') >= 0);
  check('B sharti: Bosnia–Qatar DURANG (faqat D)',
    condB.parts[0].allowed.length === 1 && condB.parts[0].allowed[0] === 'D');
  const condA = sandbox.collapseCondition('A', 2);
  check('A sharti: 2 o\'yin, "yutadi yoki durang" (D va A)',
    condA.parts && condA.parts.length === 2 &&
    condA.parts.every(p => p.allowed.length === 2 && p.allowed.indexOf('D') >= 0));
  const condG = sandbox.collapseCondition('G', 2);
  check('G sharti: faqat "Egypt yutadi" (1 o\'yin, H)',
    condG.parts && condG.parts.length === 1 && condG.parts[0].allowed.join('') === 'H');
  const condI = sandbox.collapseCondition('I', 2);
  check('I sharti: faqat "Senegal–Iraq durang"',
    condI.parts && condI.parts.length === 1 && condI.parts[0].allowed.join('') === 'D'
    && condI.parts[0].m.indexOf('Iraq') >= 0);
  const lm = sandbox.lockedMin3GD('D');
  check('lockedMin3GD(D): Paraguay eng yomon gol farqi -7', lm.name === 'Paraguay' && lm.gd === -7);

  let cErr = null;
  try { sandbox.renderChances(); } catch (e) { cErr = e; }
  check('renderChances xatosiz', !cErr, cErr && cErr.message);
  const cb = sandbox.document.getElementById('chances-body').innerHTML;
  check('sahifada DR Congo o\'yini va g\'alaba sharti', /DR Congo/.test(cb) && /3-o'rin/.test(cb));
  check('sahifada "yutadi yoki durang" minimal shart', /yutadi yoki durang/.test(cb));
  check('sahifada gol farqi narvoni va ehtimol', /to'p farqi|gol farqi/.test(cb) && /%/.test(cb));

  // Monte-Karlo keshi: hisob o'zgarmasa qayta hisoblanmaydi (finding #16, perf)
  let simCalls = 0; const realSimChances = sandbox.simChances;
  sandbox.simChances = function() { simCalls++; return realSimChances.apply(this, arguments); };
  sandbox._mcCache = { sig: null, val: null };
  sandbox.renderChances(); // miss (Uzbekistan hali TIRIK) → simChances chaqiriladi
  const mcSig = FIXTURES.map(f => f.homeScore === null ? '-' : (f.homeScore + ':' + f.awayScore)).join(',');
  const callsA = simCalls;
  check('Monte-Karlo: alive holatda simChances chaqirildi', callsA >= 1);
  check('Monte-Karlo kesh imzosi FIXTURES hisobiga mos', sandbox._mcCache.sig === mcSig);
  sandbox.renderChances(); // hit — hisob o'zgarmadi → qayta chaqirilmaydi
  check('Monte-Karlo keshi: imzo o\'zgarmasa qayta hisoblanmaydi', simCalls === callsA);
  sandbox._mcCache.sig = 'FORCE-DIFF'; // imzo farqli → qayta hisob
  sandbox.renderChances();
  check('Monte-Karlo keshi: imzo o\'zgarsa qayta hisoblanadi',
    simCalls === callsA + 1 && sandbox._mcCache.sig === mcSig);
  sandbox.simChances = realSimChances;

  console.log('\n[27] Pley-off — yakuniy holat (barcha 72 o\'yin tugagan)');
  // [26] dan keyin MD3 natijalarini qo'shamiz (yakuniy holat)
  setM('Czechia','Mexico',0,3); setM('South Africa','South Korea',1,0);
  setM('Switzerland','Canada',2,1); setM('Bosnia and Herzegovina','Qatar',3,1);
  setM('Scotland','Brazil',0,3); setM('Morocco','Haiti',4,2);
  setM('Türkiye','USA',3,2); setM('Paraguay','Australia',0,0);
  setM('Curaçao','Ivory Coast',0,2); setM('Ecuador','Germany',2,1);
  setM('Japan','Sweden',1,1); setM('Tunisia','Netherlands',1,3);
  setM('Egypt','Iran',1,1); setM('New Zealand','Belgium',1,5);
  setM('Cape Verde','Saudi Arabia',0,0); setM('Uruguay','Spain',0,1);
  setM('Norway','France',1,4); setM('Senegal','Iraq',5,0);
  setM('Algeria','Austria',3,3); setM('Jordan','Argentina',1,3);
  setM('Colombia','Portugal',0,0); setM('DR Congo','Uzbekistan',3,1);
  setM('Panama','England',0,2); setM('Croatia','Ghana',2,1);

  check('barcha guruhlar tugadi', sandbox.allGroupsDone() === true);
  check('saralangan 8 ta 3-o\'rin guruhi = BDEFIJKL',
    sandbox.qualifiedThirdGroups().slice().sort().join('') === 'BDEFIJKL');
  const ta = sandbox.thirdAssign();
  check('FIFA Annexe C taqsimoti to\'g\'ri (BDEFIJKL→DFEKBIJL)',
    ta[74]==='D' && ta[77]==='F' && ta[79]==='E' && ta[80]==='K'
    && ta[81]==='B' && ta[82]==='I' && ta[85]==='J' && ta[87]==='L');
  check('g\'olib/2-o\'rin slotlari to\'g\'ri', sandbox.slotName('1A')==='Mexico'
    && sandbox.slotName('2A')==='South Africa' && sandbox.slotName('1K')==='Colombia'
    && sandbox.slotName('2B')==='Canada');
  check('3-o\'rin slot jamoasi: M80 (Guruh K) = DR Congo', sandbox.thirdTeamForMatch(80)==='DR Congo');
  check('3-o\'rin slot jamoasi: M74 (Guruh D) = Paraguay', sandbox.thirdTeamForMatch(74)==='Paraguay');
  let pErr=null; try { sandbox.renderPlayoff(); } catch(e){ pErr=e; }
  check('renderPlayoff xatosiz', !pErr, pErr && pErr.message);
  const pb = sandbox.document.getElementById('playoff-body').innerHTML;
  check('pley-off sahifasida FINAL va R32 jamoalari', /FINAL/.test(pb) && /Germany/.test(pb) && /DR Congo/.test(pb));
  check('pley-off: keyingi bosqich placeholderlari (M.. g\'olibi)', /g'olibi/.test(pb));
  check('pley-off: vizual setka (svg + chiziqlar)', /<svg class="brksvg"/.test(pb) && /<line /.test(pb));
  check('pley-off: o\'yin soatlari ko\'rsatilgan', /\d\d:\d\d/.test(pb));
  check('koTime mahalliy vaqt formati (HH:MM)', /^\d\d:\d\d$/.test(sandbox.koTime('2026-06-29T17:00:00Z')));
  check('koDateLabel rasmiy o\'yin kuni (kun-oy)', sandbox.koDateLabel('2026-06-29') === '29-iyun');

  // 3-o'rin sahifasi yakuniy
  sandbox.renderThird();
  const t3f = sandbox.document.getElementById('third-list').innerHTML;
  check('3-o\'rin yakuniy: "✓ Chiqdi" va "✗ Chiqmadi"', /✓ Chiqdi/.test(t3f) && /✗ Chiqmadi/.test(t3f));

  // Uzbekistan endi chiqib ketgan
  check('Uzbekistan verdikt = eliminated (oxirgi o\'rin)',
    sandbox.chancesAnalysis('Uzbekistan').verdict === 'eliminated');

  // Overview pley-off ko'rsatadi
  sandbox.renderOverviewLists();
  const up = sandbox.document.getElementById('upcoming-list').innerHTML;
  check('Umumiy: guruh tugagach pley-off o\'yinlari', /pley-off|Pley-off/i.test(up) && !/Barcha o'yinlar o'ynaldi/.test(up));

  console.log('\n[28] Jonli pley-off (g\'oliblar keyingi bosqichга o\'tadi)');
  check('ofKoRound turlari', sandbox.ofKoRound('Round of 32')==='R32' && sandbox.ofKoRound('Semi-final')==='SF'
    && sandbox.ofKoRound('Match for third place')==='3RD' && sandbox.ofKoRound('Final')==='FIN'
    && sandbox.ofKoRound('Matchday 1')===null);
  // R32 natijalari ingestKO orqali
  sandbox.ingestKO([{h:'Germany',a:'Paraguay',hs:3,as:0},{h:'France',a:'Sweden',hs:2,as:1}]);
  check('M74 g\'olibi Germany (1E vs 3-D)', sandbox.koWinner(74)==='Germany');
  check('M77 g\'olibi France (1I vs 3-F)', sandbox.koWinner(77)==='France');
  check('resolveSlot W74 → Germany', sandbox.resolveSlot('W74',89)==='Germany');
  check('M89 jamoalari W74 vs W77 = Germany–France', (() => {
    var t=sandbox.koTeams(89); return t.home==='Germany' && t.away==='France';
  })());
  // penalti bilan g'olib
  sandbox.ingestKO([{h:'England',a:'DR Congo',hs:1,as:1,ph:4,pa:2}]);
  check('penaltida g\'olib (M80 England)', sandbox.koWinner(80)==='England');
  // kaskad: keyingi bosqichgа o'tish
  sandbox.ingestKO([{h:'Germany',a:'Paraguay',hs:3,as:0},{h:'France',a:'Sweden',hs:2,as:1},{h:'Germany',a:'France',hs:1,as:0}]);
  check('M89 g\'olibi Germany → M97 ga o\'tadi', sandbox.koWinner(89)==='Germany' && sandbox.resolveSlot('W89',97)==='Germany');
  // render natija va g'olibni ko'rsatadi
  sandbox.renderPlayoff();
  const pb2=sandbox.document.getElementById('playoff-body').innerHTML;
  check('pley-off natija (koscore) va g\'olib (win) ko\'rinadi', /koscore/.test(pb2) && /\bwin\b/.test(pb2));
  // manba ajratish: openfootball KO ni _koEv ga yig'adi, guruh o'yinini emas
  sandbox._koEv = [];
  sandbox.applyOpenfootball({ matches:[
    { round:'Group A', team1:'Mexico', team2:'South Africa', score:{ft:[2,0]} },
    { round:'Round of 32', team1:'Germany', team2:'Paraguay', score:{ft:[3,0]} }
  ]});
  check('applyOpenfootball: faqat KO yig\'iladi (guruh emas)',
    sandbox._koEv.length===1 && sandbox._koEv[0].h==='Germany');

  console.log('\n[29] Chuqur tekshiruv — dates, ET, penalti, to\'purarlar, FIFA tartibi, data-flow');
  // Bu bo'lim [27]/[28] yakuniy holatidan (barcha 72 o'yin, setka to'lgan) boshlanadi.

  // (1) Pley-off gollari to'purarlarga qo'shiladi (issue #3, findings #5/#13)
  const koT75 = sandbox.koTeams(75);
  sandbox.koResults[75] = { hs:2, as:1, ph:null, pa:null, aet:false, decisive:true, done:true,
    homeScorers:[{name:'KO Tester Bir', type:'Normal Goal'}, {name:'KO Tester Bir', type:'Normal Goal'}],
    awayScorers:[{name:'KO Tester Ikki', type:'Normal Goal'}, {name:'KO Avtogol', type:'Own Goal'}] };
  sandbox.buildScorerTotals();
  check('pley-off goli to\'purarlarga qo\'shildi (2 gol)',
    sandbox.allScorers['KO Tester Bir'] && sandbox.allScorers['KO Tester Bir'].goals === 2);
  check('pley-off golida jamoa nomi to\'g\'ri', sandbox.allScorers['KO Tester Bir'] &&
    sandbox.allScorers['KO Tester Bir'].team === koT75.home);
  check('pley-off raqib goli ham hisoblanadi',
    sandbox.allScorers['KO Tester Ikki'] && sandbox.allScorers['KO Tester Ikki'].goals === 1);
  check('avtogol to\'purarlarga qo\'shilmaydi', !sandbox.allScorers['KO Avtogol']);

  // (2) Qo'shimcha vaqt (ET) — openfootball et hisobini oladi (issue #2)
  sandbox._koEv = [];
  sandbox.applyOpenfootball({ matches:[
    { round:'Quarter-final', team1:'Germany', team2:'France', score:{ ft:[1,1], et:[2,1] } }
  ]});
  check('applyOpenfootball: ET hisobi (2-1) va aet bayrog\'i olinadi',
    sandbox._koEv.length===1 && sandbox._koEv[0].hs===2 && sandbox._koEv[0].as===1 && sandbox._koEv[0].aet===true);

  // (3) Penaltilar (p) olinadi
  sandbox._koEv = [];
  sandbox.applyOpenfootball({ matches:[
    { round:'Round of 16', team1:'Germany', team2:'France', score:{ ft:[1,1], p:[4,2] } }
  ]});
  check('applyOpenfootball: penalti hisobi (4-2) olinadi', sandbox._koEv.length===1 &&
    sandbox._koEv[0].hs===1 && sandbox._koEv[0].as===1 && sandbox._koEv[0].ph===4 && sandbox._koEv[0].pa===2);

  // (4) Durang + penaltisiz => fantom g'olib yo'q; boyroq manba keyin to'ldiradi (issue #2, finding #3)
  const koT76 = sandbox.koTeams(76);
  sandbox.ingestKO([{ h:koT76.home, a:koT76.away, hs:1, as:1 }]); // durang, penaltisiz
  check('durang (penaltisiz) — g\'olib yozilmaydi', sandbox.koWinner(76) === null);
  check('durang natija done, lekin decisive emas',
    sandbox.koResults[76] && sandbox.koResults[76].done===true && sandbox.koResults[76].decisive===false);
  sandbox.ingestKO([{ h:koT76.home, a:koT76.away, hs:1, as:1, ph:5, pa:4 }]); // penalti keldi
  check('penalti kelgach g\'olib yoziladi (uy egasi)', sandbox.koWinner(76) === koT76.home);

  // (5) ET bilan hal bo'lgan o'yin g'olibi (hisob bo'yicha, aet bayrog'i)
  const koT78 = sandbox.koTeams(78);
  sandbox.ingestKO([{ h:koT78.home, a:koT78.away, hs:2, as:1, aet:true }]);
  check('ET bilan hal bo\'lgan o\'yin g\'olibi (2-1 q.v.)',
    sandbox.koWinner(78) === koT78.home && sandbox.koResults[78].aet===true);

  // (6) Aniq natijani noaniqga tushirmaydi (merge himoyasi)
  sandbox.ingestKO([{ h:koT78.home, a:koT78.away, hs:0, as:0 }]); // xato "durang" keldi
  check('aniq natija noaniqga tushmaydi', sandbox.koWinner(78) === koT78.home);

  // (7) Bo'sh yangilanish natijalarni o'chirmaydi (merge — finding #11)
  const koCountBefore = Object.keys(sandbox.koResults).length;
  sandbox.ingestKO([]);
  check('bo\'sh ingestKO natijalarni saqlaydi', Object.keys(sandbox.koResults).length === koCountBefore && koCountBefore > 0);

  // (8) Guruh/pley-off ajratish: juftlik + sana yaqinligi (finding #1 — Guruh J muzlashi)
  const jf = FIXTURES.find(f => f.group === 'J');
  check('groupMatchOf: Guruh J juftligi o\'z sanasida guruh o\'yini',
    !!sandbox.groupMatchOf(jf.home, jf.away, jf.utc.slice(0,10)));
  check('groupMatchOf: xuddi shu juftlik uzoq (pley-off) sanada guruh emas',
    sandbox.groupMatchOf(jf.home, jf.away, '2026-07-10') === null);
  check('withinDays: ±3 kun ichida true, tashqarida false',
    sandbox.withinDays('2026-06-28','2026-06-27T18:00:00Z',3) === true &&
    sandbox.withinDays('2026-07-10','2026-06-27T18:00:00Z',3) === false);

  // (9) Rasmiy o'yin kuni to'g'ridan-to'g'ri 'date' maydonidan (mintaqa siljishisiz — findings #6/#14)
  check('koDateLabel M76 = 29-iyun (utc 30-iyun bo\'lsa ham drift yo\'q)',
    sandbox.koDateLabel(sandbox.R32.find(x => x.m===76).date) === '29-iyun');
  check('koDateLabel M74 = 29-iyun', sandbox.koDateLabel(sandbox.R32.find(x => x.m===74).date) === '29-iyun');
  check('koDateLabel M104 (final) = 19-iyul',
    sandbox.koDateLabel(sandbox.KO_LATER.find(x => x.m===104).date) === '19-iyul');

  // (10) Barcha 32 KO o'yinida stadion + rasmiy sana + utc (findings #7/#15)
  const allKo = sandbox.koAllMatches();
  check('32 ta KO o\'yini (R32 + keyingi bosqichlar)', allKo.length === 32);
  check('har bir KO o\'yinida stadion bor', allKo.every(x => x.venue && x.venue.length > 3));
  check('har bir KO o\'yinida rasmiy sana (YYYY-MM-DD)', allKo.every(x => /^\d{4}-\d{2}-\d{2}$/.test(x.date)));
  check('har bir KO o\'yinida utc bor', allKo.every(x => /^\d{4}-\d{2}-\d{2}T/.test(x.utc)));

  // (11) koMiniCard: penalti/q.v. hisobi va g'olib ko'rsatiladi (issue #2 display)
  const mc76 = sandbox.koMiniCard(allKo.find(x => x.m===76));
  check('koMiniCard: penalti hisobi va koscore', /pen/.test(mc76) && /koscore/.test(mc76));
  check('koMiniCard: g\'olib belgilanadi (win klass)', /\bwin\b/.test(mc76));
  const mc78 = sandbox.koMiniCard(allKo.find(x => x.m===78));
  check('koMiniCard: qo\'shimcha vaqt (q.v.) belgisi', /q\.v\./.test(mc78));

  // (12) Eskirgan JONLI holat FT ga tushadi; kelajakdagi o'yin JONLI qoladi (finding #12)
  const sf = FIXTURES[0];
  const sv = { s:sf.status, u:sf.utc, m:sf.minute, h:sf.homeScore, a:sf.awayScore };
  sf.status='LIVE'; sf.minute="67'"; sf.homeScore=1; sf.awayScore=0; sf.utc='2020-01-01T00:00:00Z';
  sandbox.demoteStaleLive();
  check('eskirgan JONLI => FT (start + 2.5s dan oshgan)', sf.status==='FT' && sf.minute===null);
  const sf2 = FIXTURES[1];
  const sv2 = { s:sf2.status, u:sf2.utc, m:sf2.minute, h:sf2.homeScore, a:sf2.awayScore };
  sf2.status='LIVE'; sf2.minute="10'"; sf2.homeScore=0; sf2.awayScore=0; sf2.utc='2099-01-01T00:00:00Z';
  sandbox.demoteStaleLive();
  check('kelajakdagi JONLI o\'yin JONLI qoladi', sf2.status==='LIVE');
  sf.status=sv.s; sf.utc=sv.u; sf.minute=sv.m; sf.homeScore=sv.h; sf.awayScore=sv.a;
  sf2.status=sv2.s; sf2.utc=sv2.u; sf2.minute=sv2.m; sf2.homeScore=sv2.h; sf2.awayScore=sv2.a;

  // (13) Render xato bersa ham apiLoading tiklanadi + koResults saqlanadi (findings #10/#11)
  const realRenderAll = sandbox.renderAll;
  sandbox.renderAll = function(){ throw new Error('render portlashi (test)'); };
  sandbox.apiLoading = false;
  const koBeforeLoad = Object.keys(sandbox.koResults).length;
  sandbox.loadAll();
  await new Promise(r => setTimeout(r, 80));
  check('render xato bersa ham apiLoading=false (muzlamaydi)', sandbox.apiLoading === false);
  check('to\'liq muvaffaqiyatsiz yangilanish koResults ni saqlaydi',
    Object.keys(sandbox.koResults).length === koBeforeLoad && koBeforeLoad > 0);
  sandbox.renderAll = realRenderAll;

  // (14) Jonli pley-off natijasi ERTA yig'ilmaydi (re-audit: FIFA MatchStatus 3, TSDB live status)
  //   Germany vs France — guruh juftligi emas, shuning uchun groupMatchOf null → KO tarmog'i.
  sandbox._koEv = [];
  sandbox.applyFifa({ Results: [
    { Home:{TeamName:[{Description:'Germany'}], Score:1}, Away:{TeamName:[{Description:'France'}], Score:0}, MatchStatus:3 }
  ]});
  check('applyFifa: JONLI KO o\'yini yig\'ilmaydi (MatchStatus 3)', sandbox._koEv.length === 0);
  sandbox._koEv = [];
  sandbox.applyFifa({ Results: [
    { Home:{TeamName:[{Description:'Germany'}], Score:2}, Away:{TeamName:[{Description:'France'}], Score:1},
      MatchStatus:0, HomeScorePenalty:5, AwayScorePenalty:4 }
  ]});
  check('applyFifa: TUGAGAN KO yig\'iladi + penalti/aet',
    sandbox._koEv.length===1 && sandbox._koEv[0].hs===2 && sandbox._koEv[0].ph===5 && sandbox._koEv[0].aet===true);

  sandbox._koEv = [];
  sandbox.applyEvents([{ strHomeTeam:'Germany', strAwayTeam:'France', intHomeScore:'2', intAwayScore:'1', strStatus:'2H' }]);
  check('applyEvents: JONLI KO o\'yini yig\'ilmaydi (2H)', sandbox._koEv.length === 0);
  sandbox._koEv = [];
  sandbox.applyEvents([{ strHomeTeam:'Germany', strAwayTeam:'France', intHomeScore:'2', intAwayScore:'1', strStatus:'AET' }]);
  check('applyEvents: TUGAGAN KO (AET) yig\'iladi + aet',
    sandbox._koEv.length===1 && sandbox._koEv[0].hs===2 && sandbox._koEv[0].aet===true);
  sandbox._koEv = [];
  sandbox.applyEvents([{ strHomeTeam:'Germany', strAwayTeam:'France', intHomeScore:'1', intAwayScore:'1',
    strStatus:'Match Finished', intHomeScorePenalty:'4', intAwayScorePenalty:'2' }]);
  check('applyEvents: penalti KO yig\'iladi + aet',
    sandbox._koEv.length===1 && sandbox._koEv[0].ph===4 && sandbox._koEv[0].aet===true);

  // (15) Eskirgan JONLI + hisobsiz => NS (muzlab qolmaydi) (re-audit: findings #895/#1000)
  const nsf = FIXTURES[2];
  const nv = { s:nsf.status, u:nsf.utc, m:nsf.minute, h:nsf.homeScore, a:nsf.awayScore };
  nsf.status='1H'; nsf.minute="20'"; nsf.homeScore=null; nsf.awayScore=null; nsf.utc='2020-01-01T00:00:00Z';
  sandbox.demoteStaleLive();
  check('eskirgan JONLI + hisobsiz => NS (JONLI muzlab qolmaydi)', nsf.status==='NS' && nsf.minute===null);
  nsf.status=nv.s; nsf.utc=nv.u; nsf.minute=nv.m; nsf.homeScore=nv.h; nsf.awayScore=nv.a;

  // (16) Yuqori bosqich g'olibi o'zgarsa, eskirgan pastki natija fantom g'olib bermaydi (re-audit #2085)
  const t74 = sandbox.koTeams(74);
  sandbox.ingestKO([{ h:t74.home, a:t74.away, hs:3, as:0 }]);   // W74 = t74.home
  const t77 = sandbox.koTeams(77);
  sandbox.ingestKO([{ h:t77.home, a:t77.away, hs:2, as:1 }]);   // W77 = t77.home
  const t89 = sandbox.koTeams(89);                              // {home:W74, away:W77}
  sandbox.ingestKO([{ h:t89.home, a:t89.away, hs:4, as:0 }]);   // M89 g'olibi = t89.home
  check('M89 g\'olibi yozildi va yangi (fresh)', sandbox.koWinner(89) === t89.home && sandbox.koIsFresh(89) === true);
  sandbox.ingestKO([{ h:t74.home, a:t74.away, hs:0, as:3 }]);   // M74 teskari → W74 = t74.away
  check('M74 g\'olibi o\'zgardi (t74.away)', sandbox.koWinner(74) === t74.away);
  check('M89 saqlangan natija eskirdi (koIsFresh false)', sandbox.koIsFresh(89) === false);
  check('eskirgan M89 fantom g\'olib bermaydi', sandbox.koWinner(89) === null);
  check('eskirgan M89 keyingi bosqichga jamoa o\'tkazmaydi', sandbox.resolveSlot('W89', 97) === null);
  // holatni tiklaymiz (M74 haqiqiy g'olibi t74.home, M89 to'g'ri qayta yoziladi)
  sandbox.ingestKO([{ h:t74.home, a:t74.away, hs:3, as:0 }]);
  const t89b = sandbox.koTeams(89);
  sandbox.ingestKO([{ h:t89b.home, a:t89b.away, hs:4, as:0 }]);
  check('tiklangach M89 yana fresh', sandbox.koIsFresh(89) === true && sandbox.koWinner(89) === t89b.home);

  // (17) FIFA Modda 13: o'zaro o'yin (h2h) QAYTA qo'llanishi umumiy GD dan ustun (finding #3)
  //   Guruh A: Mexico, South Korea, South Africa — uchtasi 6 ochkoda (siklik), Czechia 0.
  //   h2h: Mexico ajralib chiqadi; SK va SA h2h da teng → QAYTA qo'llash (SK–SA) SK ni yuqori qiladi.
  //   Umumiy GD: SA (+4) > Mexico (+3) > SK (0) — ya'ni h2h umumiy GD ni bekor qiladi.
  FIXTURES.forEach(f => { f.homeScore=null; f.awayScore=null; f.status='NS'; f.scoreSource=null; });
  setM('Mexico','South Korea',3,0);
  setM('South Korea','South Africa',3,1);
  setM('South Africa','Mexico',2,1);
  setM('Mexico','Czechia',1,0);
  setM('South Korea','Czechia',1,0);
  setM('South Africa','Czechia',5,0);
  const stA2 = sandbox.standings('A');
  check('h2h: uchala jamoa 6 ochkoda', stA2[0].pts===6 && stA2[1].pts===6 && stA2[2].pts===6);
  check('h2h re-application tartibi: Mexico, South Korea, South Africa',
    stA2[0].name==='Mexico' && stA2[1].name==='South Korea' && stA2[2].name==='South Africa',
    stA2.map(t => t.name).join(','));
  check('h2h umumiy GD dan ustun: eng yaxshi GD (South Africa +4) 3-o\'rinda',
    stA2[2].name==='South Africa' && stA2[2].gd===4 && stA2[0].gd===3);
  const rs = sandbox.rankSim(['Mexico','South Korea','South Africa','Czechia'], [
    ['Mexico','South Korea',3,0], ['South Korea','South Africa',3,1], ['South Africa','Mexico',2,1],
    ['Mexico','Czechia',1,0], ['South Korea','Czechia',1,0], ['South Africa','Czechia',5,0]
  ]);
  check('rankSim h2h tartibi = sortGroupTeams tartibi (chances/Monte-Karlo mosligi)',
    rs[0].n==='Mexico' && rs[1].n==='South Korea' && rs[2].n==='South Africa' && rs[3].n==='Czechia',
    rs.map(t => t.n).join(','));

  // (15) 3-o'rinlar reytingi: teng pts/gd/gf da FIFA reytingi hal qiladi (finding #8)
  //   Guruh A 3-o'rni (South Korea, r.25) va Guruh L 3-o'rni (Panama, r.34) bir xil pts3/gd-4/gf1.
  FIXTURES.forEach(f => { f.homeScore=null; f.awayScore=null; f.status='NS'; f.scoreSource=null; });
  setM('Mexico','South Africa',2,1); setM('Mexico','South Korea',3,0); setM('Mexico','Czechia',1,0);
  setM('South Africa','South Korea',2,0); setM('South Africa','Czechia',1,0); setM('South Korea','Czechia',1,0);
  setM('England','Croatia',2,1); setM('England','Panama',3,0); setM('England','Ghana',1,0);
  setM('Croatia','Panama',2,0); setM('Croatia','Ghana',1,0); setM('Panama','Ghana',1,0);
  const tr = sandbox.thirdPlaceRanking();
  const sk3 = tr.find(t => t.group==='A');
  const pn3 = tr.find(t => t.group==='L');
  check('3-o\'rin A = South Korea, L = Panama', sk3.name==='South Korea' && pn3.name==='Panama');
  check('3-o\'rinlar teng ko\'rsatkichda (pts3/gd-4/gf1)',
    sk3.pts===3 && sk3.gd===-4 && sk3.gf===1 && pn3.pts===3 && pn3.gd===-4 && pn3.gf===1);
  check('FIFA reyting tay-brek: South Korea (25) Panama (34) dan yuqori', tr.indexOf(sk3) < tr.indexOf(pn3));
  check('FIFA reyting tay-brek: South Korea 3-o\'rinlar reytingi 1-chi', tr[0].name==='South Korea' && tr[0].group==='A');

  console.log('\n──────────────────────────────');
  console.log(passed + ' o\'tdi, ' + failed + ' yiqildi');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('FAIL (async):', e); process.exit(1); });
