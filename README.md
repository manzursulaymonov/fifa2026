# fifa2026
Jahon chempionati 2026 online natijalarni kuzatish

Bitta `index.html` fayl. Sahifalar:
- **Umumiy** — statistika, yaqinlashayotgan o'yinlar va oxirgi natijalar
- **Guruhlar** — 12 guruh jadvali; chiqish o'rinlari, top-2 ni **kafolatlagan** (✓) va
  matematik **imkoni qolmagan** (✗) jamoalar belgilanadi
- **3-O'rin** — eng yaxshi 8 ta 3-o'rin jamoasi reytingi (onlayn yangilanadi)
- **Pley-off** — to'liq chiqaruv bosqichi (1/16 → final), guruhlar tugagach jamoalar
  bilan to'ladi; 3-o'rinlar FIFA Annexe C taqsimot jadvali bo'yicha joylashtiriladi
- **Imkoniyat** — Uzbekistan'ning pley-offga chiqish stsenariylari: o'z o'yinida kerakli
  natija (to'plar nisbati bilan), qaysi guruhlardagi qaysi o'yinlar qanday tugashi kerak,
  va tay-brek zanjiri (gol farqi → urilgan gol → FIFA jahon reytingi)
- **O'yinlar** — barcha 72 guruh o'yini, sana bo'yicha
- **To'purarlar** — gol uruvchilar reytingi
- **Qoidalar** — turnir formati, saralash mezonlari va pley-off tartibi

Sana/vaqtlar foydalanuvchining mahalliy vaqtida. Dark/Light rejimlar bor.
Ma'lumotlar har 3 daqiqada avtomatik yangilanadi; jonli o'yinda hisob ostida daqiqa ko'rsatiladi.

## Turnir reglamenti (kodga singdirilgan)

- 48 jamoa, 12 guruh × 4 jamoa, aylanma tizim (72 o'yin).
- Har guruhdan **1 va 2-o'rin** + 12 ta 3-o'rindan **eng yaxshi 8 tasi** = 32 jamoa 1/16 finalga.
- Guruh ichida teng ochkoda saralash (FIFA 2026, Modda 13): ochko → **o'zaro o'yin**
  (ochko, gol farqi, gol) → umumiy gol farqi → umumiy gol → fair-play → FIFA reytingi.
  *2026-yildan o'zaro o'yin umumiy gol farqidan oldin keladi — bu yangilik.*
- 3-o'rinlar reytingi: ochko → umumiy gol farqi → urilgan gol → fair-play → FIFA reytingi.
- 1/16 final to'rlari (M73–M88) kodda mavjud; guruh tugagach jamoalar avtomatik to'ldiriladi.

## Ma'lumot manbalari

Uch mustaqil ochiq manba, ustuvorlik tartibida (kalit talab qilinmaydi):
1. **api.fifa.com** — hisob, jonli holat/daqiqa, stadionlar
2. **openfootball/worldcup.json** (GitHub) — tasdiqlangan gol ro'yxatlari
3. **TheSportsDB** — o'yin statistikasi, gol timeline'i va to'liq zaxira

## Test

```
node tests/test.js
```
