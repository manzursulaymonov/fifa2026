/**
 * Mijozlar CRM — Google Apps Script web-ilova.
 * Kirish nuqtasi va umumiy sozlamalar.
 *
 * MUHIM: SPREADSHEET_ID va ADMIN_EMAIL Script Properties orqali sozlanadi
 * (Project Settings -> Script properties). Kodga yozilmaydi.
 */

var CONFIG = {
  SHEET_CUSTOMERS: 'Mijozlar',
  SHEET_USERS: 'Foydalanuvchilar',
  SHEET_NOTES: 'Izohlar',
  SHEET_AUDIT: 'Audit',

  PAGE_SIZE: 10,            // bir sahifada nechta mijoz
  MAX_PAGE: 50,             // sahifa indeksining yuqori chegarasi
  DEFAULT_DETAIL_LIMIT: 30, // kuniga nechta mijoz kartasi ochish mumkin (Script Property: DETAIL_VIEWS_PER_DAY)
  SEARCHES_PER_MINUTE: 20,  // qidiruv so'rovlari chastotasi chegarasi

  SESSION_TTL_SEC: 21600,   // 6 soat — CacheService maksimumi; har so'rovda yangilanadi
  MAX_FAILED_LOGINS: 5,
  LOCKOUT_MINUTES: 15,

  NOTE_MAX_LEN: 500,
  CUSTOMER_CACHE_SEC: 300,  // Mijozlar varag'i keshining muddati
  TZ: 'Asia/Tashkent'
};

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Mijozlar CRM')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

function getProp_(key, fallback) {
  var v = PropertiesService.getScriptProperties().getProperty(key);
  return v === null || v === '' ? fallback : v;
}

function detailLimit_() {
  var n = parseInt(getProp_('DETAIL_VIEWS_PER_DAY', CONFIG.DEFAULT_DETAIL_LIMIT), 10);
  return isNaN(n) || n < 1 ? CONFIG.DEFAULT_DETAIL_LIMIT : n;
}

function now_() {
  return Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd HH:mm:ss');
}

function today_() {
  return Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd');
}
