/**
 * Limitlar:
 *  - daqiqalik throttle (qidiruv) — CacheService (tezkor, taxminiy yetarli)
 *  - kunlik hisoblagichlar (karta ochish) — PropertiesService (ishonchli,
 *    kesh tozalansa ham yo'qolmaydi)
 */

/** true = ruxsat, false = limit oshdi. */
function bumpMinute_(key, limit) {
  var cache = CacheService.getScriptCache();
  var k = 'min:' + key;
  var n = parseInt(cache.get(k) || '0', 10) + 1;
  cache.put(k, String(n), 60);
  return n <= limit;
}

function dailyCount_(key) {
  var v = PropertiesService.getScriptProperties().getProperty('day:' + key + ':' + today_());
  return parseInt(v || '0', 10);
}

/** Hisoblagichni oshiradi va yangi qiymatni qaytaradi. */
function bumpDaily_(key) {
  var props = PropertiesService.getScriptProperties();
  var k = 'day:' + key + ':' + today_();
  var n = parseInt(props.getProperty(k) || '0', 10) + 1;
  props.setProperty(k, String(n));
  return n;
}

/**
 * Eski kunlik hisoblagich kalitlarini o'chiradi (Properties kvotasi
 * to'lib qolmasligi uchun). Haftalik vaqt-trigger qilib qo'ying:
 * Triggers -> Add Trigger -> cleanupOldCounters -> Time-driven -> Week timer.
 */
function cleanupOldCounters() {
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  var today = today_();
  for (var k in all) {
    var m = k.match(/^day:.*:(\d{4}-\d{2}-\d{2})$/);
    if (m && m[1] < today) props.deleteProperty(k);
  }
}
