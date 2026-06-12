# fifa2026
Jahon chempionati 2026 online natijalarni kuzatish

Bitta `index.html` fayl — guruhlar, o'yinlar jadvali, turnir jadvali va to'purarlar.
Sana va vaqtlar foydalanuvchining mahalliy vaqtida ko'rsatiladi. Dark/Light rejimlar bor
(tizim sozlamasiga moslashadi, `?theme=light|dark` bilan majburlash mumkin).

## Ma'lumot manbalari

Uch mustaqil ochiq manba, ustuvorlik tartibida (kalit talab qilinmaydi):

1. **api.fifa.com** — hisob, jonli holat, stadionlar
2. **openfootball/worldcup.json** (GitHub) — tasdiqlangan gol ro'yxatlari
3. **TheSportsDB** — o'yin statistikasi, gol timeline'i va to'liq zaxira

Har qanday manba ishlamay qolsa, qolganlari ishlayveradi; hammasi yiqilsa
statik jadval ko'rsatiladi. Headerdagi indikator qaysi manbalar
ulanganini ko'rsatadi (masalan, `FIFA+TSDB · 5 natija`).

## Test

```
node tests/test.js
```
