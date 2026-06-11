/**
 * Google Sheets bilan barcha ishlash shu yerda.
 *
 * "Mijozlar" varag'i ustunlari (mavjud jadval, o'zgartirilmaydi):
 *   A: Mijoz | B: Davlat | C: Viloyat | D: Tuman / Shahar | E: BRAND
 *   F: Rahbar | G: Nomer | H: Menejment | I: Nomeri | J: ID (admin_assignIds to'ldiradi)
 */

function getSS_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('SPREADSHEET_ID Script Properties da sozlanmagan');
  return SpreadsheetApp.openById(id);
}

function getSheet_(name) {
  var sh = getSS_().getSheetByName(name);
  if (!sh) throw new Error('Varaq topilmadi: ' + name);
  return sh;
}

/**
 * Katak qiymatini tozalash: faqat chiziqcha ("—", "-") yoki probeldan
 * iborat kataklar bo'sh hisoblanadi (jadvalda bo'sh joylar "—" bilan belgilangan).
 */
function cleanCell_(v) {
  var s = String(v).trim();
  return /^[-–—\s]*$/.test(s) ? '' : s;
}

/**
 * Mijozlar ro'yxati. 5 daqiqa keshlanadi (CacheService 100KB chegarasi
 * sababli JSON bo'laklarga bo'lib saqlanadi).
 * Telefonlar getDisplayValues bilan o'qiladi — Sheets'dagi formati saqlanadi.
 */
function getCustomers_() {
  var cache = CacheService.getScriptCache();
  var meta = cache.get('cust:meta');
  if (meta) {
    var n = parseInt(meta, 10);
    var keys = [];
    for (var i = 0; i < n; i++) keys.push('cust:' + i);
    var parts = cache.getAll(keys);
    var json = '';
    var complete = true;
    for (var j = 0; j < n; j++) {
      var part = parts['cust:' + j];
      if (part === undefined || part === null) { complete = false; break; }
      json += part;
    }
    if (complete) {
      try { return JSON.parse(json); } catch (e) { /* kesh buzilgan — qayta o'qiymiz */ }
    }
  }

  var sh = getSheet_(CONFIG.SHEET_CUSTOMERS);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  var values = sh.getRange(2, 1, lastRow - 1, 10).getDisplayValues();
  var rows = [];
  for (var r = 0; r < values.length; r++) {
    var v = values[r];
    if (!cleanCell_(v[0])) continue; // bo'sh qatorlar tashlab ketiladi
    rows.push({
      mijoz: cleanCell_(v[0]),
      davlat: cleanCell_(v[1]),
      viloyat: cleanCell_(v[2]),
      tuman: cleanCell_(v[3]),
      brand: cleanCell_(v[4]),
      rahbar: cleanCell_(v[5]),
      nomer: cleanCell_(v[6]),
      menejment: cleanCell_(v[7]),
      nomeri: cleanCell_(v[8]),
      id: String(v[9]).trim()
    });
  }

  var full = JSON.stringify(rows);
  var CHUNK = 90000;
  var toCache = {};
  var count = 0;
  for (var p = 0; p < full.length; p += CHUNK) {
    toCache['cust:' + count] = full.substr(p, CHUNK);
    count++;
  }
  toCache['cust:meta'] = String(count);
  try { cache.putAll(toCache, CONFIG.CUSTOMER_CACHE_SEC); } catch (e) { /* kesh sig'masa ham ishlayveramiz */ }
  return rows;
}

function findCustomerById_(id) {
  var all = getCustomers_();
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === id) return all[i];
  }
  return null;
}

/** Parallel foydalanuvchilar yozuvi aralashib ketmasligi uchun lock bilan qo'shish. */
function appendRowLocked_(sheetName, row) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    getSheet_(sheetName).appendRow(row);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Audit yozuvi. Ataylab xato yutilmaydi: agar Audit varag'i yozilmasa,
 * amal ham bajarilmaydi (himoya jurnalsiz qolmasin).
 */
function audit_(username, action, detail, remaining) {
  appendRowLocked_(CONFIG.SHEET_AUDIT, [
    now_(),
    username,
    action,
    detail || '',
    remaining === undefined || remaining === null ? '' : remaining
  ]);
}

/** Mijozning oxirgi N ta izohi (eng yangisi birinchi). */
function recentNotes_(customerId, limit) {
  var sh = getSheet_(CONFIG.SHEET_NOTES);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  var values = sh.getRange(2, 1, lastRow - 1, 6).getDisplayValues();
  var notes = [];
  for (var i = values.length - 1; i >= 0 && notes.length < limit; i--) {
    if (String(values[i][2]).trim() === customerId) {
      notes.push({
        vaqt: String(values[i][0]),
        username: String(values[i][1]),
        kim: String(values[i][4]),
        matn: String(values[i][5])
      });
    }
  }
  return notes;
}

/** Foydalanuvchini login bo'yicha topish. Varaq kichik — keshsiz o'qiladi. */
function findUser_(username) {
  var sh = getSheet_(CONFIG.SHEET_USERS);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return null;
  var values = sh.getRange(2, 1, lastRow - 1, 6).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]).trim().toLowerCase() === username) {
      return {
        username: String(values[i][0]).trim().toLowerCase(),
        salt: String(values[i][1]),
        hash: String(values[i][2]),
        fullName: String(values[i][3]).trim(),
        active: values[i][4] === true || String(values[i][4]).trim().toUpperCase() === 'TRUE',
        row: i + 2
      };
    }
  }
  return null;
}

/**
 * ADMIN: Mijozlar varag'ida J ustuniga ID raqamlarini to'ldiradi.
 * Muharrirdan bir marta ishga tushiriladi; yangi mijozlar qo'shilganda
 * qayta ishga tushirsa, faqat bo'sh ID kataklar to'ldiriladi —
 * mavjud IDlar o'zgarmaydi (izohlar bog'lanishi buzilmasligi uchun).
 */
function admin_assignIds() {
  assertAdmin_();
  var sh = getSheet_(CONFIG.SHEET_CUSTOMERS);
  if (!String(sh.getRange(1, 10).getValue()).trim()) {
    sh.getRange(1, 10).setValue('ID');
  }
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return;
  var names = sh.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
  var ids = sh.getRange(2, 10, lastRow - 1, 1).getValues();
  var maxId = 0;
  for (var i = 0; i < ids.length; i++) {
    var n = parseInt(String(ids[i][0]), 10);
    if (!isNaN(n) && n > maxId) maxId = n;
  }
  var assigned = 0;
  for (var r = 0; r < ids.length; r++) {
    if (String(names[r][0]).trim() && !String(ids[r][0]).trim()) {
      maxId++;
      ids[r][0] = maxId;
      assigned++;
    }
  }
  if (assigned > 0) {
    sh.getRange(2, 10, lastRow - 1, 1).setValues(ids);
    CacheService.getScriptCache().remove('cust:meta'); // keshni yangilash
  }
  Logger.log('OK: ' + assigned + ' ta yangi ID berildi (jami maksimal ID: ' + maxId + ')');
}
