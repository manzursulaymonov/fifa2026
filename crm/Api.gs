/**
 * Web-klient chaqiradigan himoyalangan API.
 * Har bir funksiya birinchi bo'lib sessiyani tekshiradi.
 *
 * Ataylab YO'Q narsalar: getAllCustomers, eksport, umumiy soni.
 * Klientga bir so'rovda ko'pi bilan PAGE_SIZE ta yozuv,
 * telefon raqamlari esa faqat bitta mijoz kartasida qaytariladi.
 */

function statsFor_(username) {
  var limit = detailLimit_();
  var used = dailyCount_('detail:' + username);
  return {
    detailViewsToday: used,
    detailLimit: limit,
    remainingToday: Math.max(0, limit - used),
    notesToday: dailyCount_('note:' + username)
  };
}

/** Sahifa ochilganda token hali yaroqlimi tekshirish (xato tashlamaydi). */
function checkSession(token) {
  try {
    var user = requireSession_(token);
    return { ok: true, username: user.username, fullName: user.fullName, stats: statsFor_(user.username) };
  } catch (e) {
    return { ok: false };
  }
}

/** Filtr ro'yxatlari (viloyat va brendlar) — maxfiy ma'lumot emas. */
function getFilters(token) {
  requireSession_(token);
  var rows = getCustomers_();
  var vil = {};
  var br = {};
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].viloyat) vil[rows[i].viloyat] = true;
    if (rows[i].brand) br[rows[i].brand] = true;
  }
  return { ok: true, viloyatlar: Object.keys(vil).sort(), brandlar: Object.keys(br).sort() };
}

/**
 * Qidiruv: faqat mijoz nomi bo'yicha + viloyat/brend filtri.
 * Natijada telefon raqamlari YO'Q.
 */
function searchCustomers(token, query, viloyat, brand, page) {
  var user = requireSession_(token);
  if (!bumpMinute_('search:' + user.username, CONFIG.SEARCHES_PER_MINUTE)) {
    return { ok: false, error: 'THROTTLE' };
  }
  query = String(query || '').trim().toLowerCase();
  viloyat = String(viloyat || '').trim();
  brand = String(brand || '').trim();
  page = parseInt(page, 10);
  if (isNaN(page) || page < 0) page = 0;
  if (page > CONFIG.MAX_PAGE) page = CONFIG.MAX_PAGE;

  var matches = getCustomers_().filter(function (r) {
    if (query && r.mijoz.toLowerCase().indexOf(query) === -1) return false;
    if (viloyat && r.viloyat !== viloyat) return false;
    if (brand && r.brand !== brand) return false;
    return true;
  });

  var start = page * CONFIG.PAGE_SIZE;
  var slice = matches.slice(start, start + CONFIG.PAGE_SIZE).map(function (r) {
    return { id: r.id, mijoz: r.mijoz, davlat: r.davlat, viloyat: r.viloyat, tuman: r.tuman, brand: r.brand };
  });

  audit_(user.username, 'SEARCH', 'q="' + query + '" viloyat="' + viloyat + '" brand="' + brand + '" sahifa=' + page);
  return { ok: true, rows: slice, page: page, hasMore: matches.length > start + CONFIG.PAGE_SIZE };
}

/**
 * Mijoz kartasi: telefon raqamlari FAQAT shu yerda qaytariladi.
 * Kunlik limitga kiradi; bir kunda bitta mijozni qayta ochish limitni
 * ikki marta yemaydi (seen-belgi). Har bir ochilish auditga yoziladi.
 */
function getCustomerDetails(token, customerId) {
  var user = requireSession_(token);
  customerId = String(customerId || '').trim();
  if (!customerId) return { ok: false, error: 'NOT_FOUND' };

  var customer = findCustomerById_(customerId);
  if (!customer) return { ok: false, error: 'NOT_FOUND' };

  var limit = detailLimit_();
  var cache = CacheService.getScriptCache();
  var seenKey = 'seen:' + user.username + ':' + customerId;
  var alreadySeen = !!cache.get(seenKey);
  var used = dailyCount_('detail:' + user.username);

  if (!alreadySeen) {
    if (used >= limit) {
      audit_(user.username, 'LIMIT_HIT', 'ID=' + customerId + ' ' + customer.mijoz, 0);
      return { ok: false, error: 'LIMIT' };
    }
    used = bumpDaily_('detail:' + user.username);
  }
  cache.put(seenKey, '1', 21600);

  var remaining = Math.max(0, limit - used);
  audit_(user.username, 'VIEW_PHONE', 'ID=' + customerId + ' ' + customer.mijoz, remaining);

  return {
    ok: true,
    customer: {
      id: customer.id,
      mijoz: customer.mijoz,
      davlat: customer.davlat,
      viloyat: customer.viloyat,
      tuman: customer.tuman,
      brand: customer.brand,
      rahbar: customer.rahbar,
      nomer: customer.nomer,
      menejment: customer.menejment,
      nomeri: customer.nomeri
    },
    notes: recentNotes_(customerId, 5),
    remainingToday: remaining
  };
}

/** Suhbat xulosasini Izohlar varag'iga yozish. */
function addNote(token, customerId, withWhom, text) {
  var user = requireSession_(token);
  customerId = String(customerId || '').trim();
  text = String(text || '').trim();
  withWhom = String(withWhom || '').trim();

  if (!text) return { ok: false, error: 'EMPTY' };
  if (text.length > CONFIG.NOTE_MAX_LEN) return { ok: false, error: 'TOO_LONG' };
  if (['Rahbar', 'Menejment', 'Boshqa'].indexOf(withWhom) === -1) withWhom = 'Boshqa';

  // Faqat shu kuni kartasi ochilgan mijozga izoh yozish mumkin
  if (!CacheService.getScriptCache().get('seen:' + user.username + ':' + customerId)) {
    return { ok: false, error: 'NOT_SEEN' };
  }
  var customer = findCustomerById_(customerId);
  if (!customer) return { ok: false, error: 'NOT_FOUND' };

  appendRowLocked_(CONFIG.SHEET_NOTES, [now_(), user.username, customerId, customer.mijoz, withWhom, text]);
  bumpDaily_('note:' + user.username);
  audit_(user.username, 'ADD_NOTE', 'ID=' + customerId + ' ' + customer.mijoz + ' (' + text.length + ' belgi)');
  return { ok: true, note: { vaqt: now_(), username: user.username, kim: withWhom, matn: text } };
}

function getMyStats(token) {
  var user = requireSession_(token);
  return { ok: true, stats: statsFor_(user.username) };
}
