/**
 * Kirish tizimi: parol hash (SHA-256 + salt), sessiyalar (CacheService),
 * bloklash (5 ta xato urinish -> 15 daqiqa), admin funksiyalari.
 *
 * Parollar HECH QACHON ochiq ko'rinishda saqlanmaydi — faqat salt va hash.
 */

function sha256Hex_(s) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = (bytes[i] + 256) % 256;
    hex += (b < 16 ? '0' : '') + b.toString(16);
  }
  return hex;
}

function hashPassword_(password, salt) {
  return sha256Hex_(salt + password);
}

function randomSalt_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 16);
}

/**
 * Web-ilovadan chaqiriladi. Xato xabari ataylab umumiy —
 * login bormi-yo'qmi bilib bo'lmasligi kerak.
 */
function login(username, password) {
  username = String(username || '').trim().toLowerCase();
  password = String(password || '');
  if (!username || !password) {
    return { ok: false, error: 'Login va parolni kiriting' };
  }

  var cache = CacheService.getScriptCache();
  if (cache.get('lock:' + username)) {
    audit_(username, 'LOGIN_FAIL', 'bloklangan holatda urinish');
    return { ok: false, error: 'Juda ko‘p xato urinish. ' + CONFIG.LOCKOUT_MINUTES + ' daqiqadan keyin qayta urinib ko‘ring.' };
  }

  var user = findUser_(username);
  var valid = !!user && user.active && hashPassword_(password, user.salt) === user.hash;

  if (!valid) {
    var fails = parseInt(cache.get('fail:' + username) || '0', 10) + 1;
    cache.put('fail:' + username, String(fails), CONFIG.LOCKOUT_MINUTES * 60);
    if (fails >= CONFIG.MAX_FAILED_LOGINS) {
      cache.put('lock:' + username, '1', CONFIG.LOCKOUT_MINUTES * 60);
    }
    audit_(username, 'LOGIN_FAIL', fails + '-xato urinish');
    return { ok: false, error: 'Login yoki parol noto‘g‘ri' };
  }

  cache.remove('fail:' + username);
  var token = Utilities.getUuid() + Utilities.getUuid();
  cache.put('sess:' + token, JSON.stringify({ u: user.username, n: user.fullName }), CONFIG.SESSION_TTL_SEC);
  audit_(user.username, 'LOGIN', '');
  return {
    ok: true,
    token: token,
    username: user.username,
    fullName: user.fullName,
    stats: statsFor_(user.username)
  };
}

function logout(token) {
  var cache = CacheService.getScriptCache();
  var raw = cache.get('sess:' + token);
  if (raw) {
    var s = JSON.parse(raw);
    cache.remove('sess:' + token);
    audit_(s.u, 'LOGOUT', '');
  }
  return { ok: true };
}

/**
 * Har bir himoyalangan API funksiyasining birinchi qatori.
 * Sessiya topilmasa SESSION_EXPIRED tashlaydi — klient buni ushlab
 * login oynasini ko'rsatadi. Har muvaffaqiyatli tekshiruvda muddat
 * yangilanadi (sliding window: 6 soat harakatsizlikdan keyin tugaydi).
 */
function requireSession_(token) {
  if (!token) throw new Error('SESSION_EXPIRED');
  var cache = CacheService.getScriptCache();
  var raw = cache.get('sess:' + String(token));
  if (!raw) throw new Error('SESSION_EXPIRED');
  cache.put('sess:' + String(token), raw, CONFIG.SESSION_TTL_SEC);
  var s = JSON.parse(raw);
  return { username: s.u, fullName: s.n };
}

/* ============================================================
 * ADMIN FUNKSIYALARI — faqat Apps Script muharriridan ishga
 * tushiriladi. Web orqali chaqirilsa ADMIN_EMAIL tekshiruvi
 * to'xtatadi (anonim foydalanuvchida email bo'lmaydi).
 * ============================================================ */

function assertAdmin_() {
  var adminEmail = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
  var current = Session.getActiveUser().getEmail();
  if (!adminEmail || !current || current.toLowerCase() !== adminEmail.toLowerCase()) {
    throw new Error('Ruxsat yo‘q: bu funksiya faqat admin uchun');
  }
}

/** Yangi foydalanuvchi qo'shish. Parol hash qilinib yoziladi, ochiq saqlanmaydi. */
function admin_addUser(username, plainPassword, fullName) {
  assertAdmin_();
  username = String(username || '').trim().toLowerCase();
  plainPassword = String(plainPassword || '');
  if (!username || plainPassword.length < 6) {
    throw new Error('Login bo‘sh bo‘lmasin, parol kamida 6 belgi bo‘lsin');
  }
  if (findUser_(username)) {
    throw new Error('Bu login allaqachon mavjud: ' + username);
  }
  var salt = randomSalt_();
  appendRowLocked_(CONFIG.SHEET_USERS, [
    username, salt, hashPassword_(plainPassword, salt),
    String(fullName || '').trim(), true, now_()
  ]);
  Logger.log('OK: foydalanuvchi qo‘shildi: ' + username);
}

/** Parolni yangilash (foydalanuvchi unutganda admin ishlatadi). */
function admin_setPassword(username, newPlainPassword) {
  assertAdmin_();
  username = String(username || '').trim().toLowerCase();
  newPlainPassword = String(newPlainPassword || '');
  if (newPlainPassword.length < 6) throw new Error('Parol kamida 6 belgi bo‘lsin');
  var user = findUser_(username);
  if (!user) throw new Error('Foydalanuvchi topilmadi: ' + username);
  var salt = randomSalt_();
  var sh = getSheet_(CONFIG.SHEET_USERS);
  sh.getRange(user.row, 2).setValue(salt);
  sh.getRange(user.row, 3).setValue(hashPassword_(newPlainPassword, salt));
  Logger.log('OK: parol yangilandi: ' + username);
}

/** Xodim ketganda akkauntini darhol o'chirib qo'yish. */
function admin_deactivateUser(username) {
  assertAdmin_();
  username = String(username || '').trim().toLowerCase();
  var user = findUser_(username);
  if (!user) throw new Error('Foydalanuvchi topilmadi: ' + username);
  getSheet_(CONFIG.SHEET_USERS).getRange(user.row, 5).setValue(false);
  Logger.log('OK: o‘chirildi (faol emas): ' + username);
}

/**
 * BIRINCHI SOZLASH UCHUN QORALAMA FUNKSIYA.
 * Quyidagi qatorlarni o'zingizning xodimlaringizga moslab yozing,
 * muharrirda shu funksiyani tanlab "Run" bosing, keyin esa
 * !!! PAROLLARNI BU YERDAN ALBATTA O'CHIRIB TASHLANG !!!
 */
function setupFirstUsers() {
  // admin_addUser('aziza', 'BU_YERGA_PAROL_YOZING', 'Aziza Karimova');
  // admin_addUser('bobur', 'BU_YERGA_PAROL_YOZING', 'Bobur Aliyev');
}
