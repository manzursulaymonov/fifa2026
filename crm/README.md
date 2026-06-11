# Mijozlar CRM — Google Sheets asosidagi himoyalangan kontaktlar ilovasi

Xodimlar login-parol bilan kiradigan, mijozlarni qidirib telefon raqamlarini ko'radigan va
telefon suhbatidan keyin qisqa xulosa yozib qo'yadigan web-ilova. Barcha ma'lumot sizning
Google Sheets jadvalingizda turadi — ilova undan o'qiydi va izohlarni unga yozadi.

**Server yoki hosting kerak emas, hammasi bepul** — ilova Google Apps Script'da, sizning
Google hisobingizda ishlaydi. Xodimlar jadvalning o'ziga **hech qachon** kira olmaydi.

---

## Himoya qanday ishlaydi (va chegaralari)

Ilova quyidagicha himoyalangan:

| Himoya | Tavsif |
|---|---|
| Sahifalab berish | Bir so'rovda ko'pi bilan 10 ta mijoz, telefon raqamlarisiz |
| Raqam faqat kartada | Telefon faqat "Ko'rish" bosilganda, bitta mijoz uchun ko'rinadi |
| Kunlik limit | Har bir xodim kuniga ko'pi bilan 30 ta karta ochadi (sozlanadi) |
| To'liq audit | Kim, qachon, kimning raqamini ko'rgani `Audit` varag'ida |
| Watermark | Ekranda xodim logini va vaqt yozilgan — skrinshot kimdan chiqqani ma'lum |
| Nusxa bloklash | Matn belgilash, o'ng tugma, Ctrl+C/P/S, chop etish bloklangan |
| Eksport yo'q | Ilovada yuklab olish/eksport funksiyasi umuman mavjud emas |
| Sessiya | 6 soat harakatsizlikdan keyin avtomatik chiqariladi |

> ⚠️ **Halol eslatma:** ekranni telefonda suratga olishni yoki qo'lda ko'chirib yozishni
> hech qanday texnologiya 100% to'sa olmaydi. Bu ilova kafolat beradigan narsalar:
> sizib chiqish **tezligi cheklanadi** (kuniga ~30 yozuv/akkaunt), har bir kirish
> **kimligi bilan** jurnalga yoziladi, watermark skrinshotda **aybdorni ko'rsatadi**,
> jadvalning o'zi esa hech kimga ochilmaydi.
>
> Maslahatlar: har bir xodimga **alohida akkaunt** bering (umumiy login bermang),
> xodim ketsa darhol `admin_deactivateUser` bilan o'chiring, `Audit` varag'ini
> haftada bir ko'zdan kechiring.

---

## O'rnatish (taxminan 20 daqiqa)

### 1-qadam. Google Sheets jadvalini tayyorlash

Mavjud jadvalingizda **Mijozlar** varag'i shu ko'rinishda bo'lishi kerak
(sizning hozirgi jadvalingiz aynan shunday, hech narsani o'zgartirish shart emas):

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| Mijoz | Davlat | Viloyat | Tuman / Shahar | BRAND | Rahbar | Nomer | Menejment | Nomeri |

- Varaq nomi aynan **`Mijozlar`** bo'lsin (pastdagi yorliqni qayta nomlang).
- J ustuniga keyinroq ID raqamlari avtomatik yoziladi (4-qadamda) — qo'lda to'ldirmang.
- Bitta katakda bir nechta raqam vergul bilan tursa ham bo'ladi ("90455..., 93990...").

Keyin shu jadvalda yana **3 ta yangi varaq** yarating (pastdagi "+" tugmasi bilan) va
har biriga 1-qatorga sarlavhalarni yozing:

**`Foydalanuvchilar`** varag'i:

| A | B | C | D | E | F |
|---|---|---|---|---|---|
| Username | Salt | ParolHash | To'liq ism | Faol | Sana |

**`Izohlar`** varag'i:

| A | B | C | D | E | F |
|---|---|---|---|---|---|
| Vaqt | Username | MijozID | Mijoz | Kim bilan | Xulosa |

**`Audit`** varag'i:

| A | B | C | D | E |
|---|---|---|---|---|
| Vaqt | Username | Amal | Tafsilot | Qolgan limit |

> Varaq nomlarini aynan shunday yozing: `Mijozlar`, `Foydalanuvchilar`, `Izohlar`, `Audit`.
> Keyinchalik ularni **qayta nomlamang** — ilova ishlamay qoladi.

### 2-qadam. Apps Script loyihasini ochish va kodni qo'yish

1. Jadval ochiq holda: menyudan **Kengaytmalar (Extensions) → Apps Script** ni tanlang.
2. Ochilgan muharrirda chapdagi **Project Settings (⚙️)** ga kirib,
   **"Show 'appsscript.json' manifest file in editor"** katagini belgilang.
3. **Editor (`< >`)** bo'limiga qayting. Endi quyidagi fayllarni yarating va shu repodagi
   mos fayl mazmunini to'liq ko'chirib qo'ying:

   | Muharrirdagi fayl | Repodagi fayl | Qanday yaratish |
   |---|---|---|
   | `appsscript.json` | `appsscript.json` | Allaqachon bor — mazmunini almashtiring |
   | `Code.gs` | `Code.gs` | `Code.gs` allaqachon bor — mazmunini almashtiring |
   | `Sheets.gs` | `Sheets.gs` | **+** → Script → nomi: `Sheets` |
   | `Auth.gs` | `Auth.gs` | **+** → Script → nomi: `Auth` |
   | `RateLimit.gs` | `RateLimit.gs` | **+** → Script → nomi: `RateLimit` |
   | `Api.gs` | `Api.gs` | **+** → Script → nomi: `Api` |
   | `Index.html` | `Index.html` | **+** → HTML → nomi: `Index` |
   | `Stylesheet.html` | `Stylesheet.html` | **+** → HTML → nomi: `Stylesheet` |
   | `JavaScript.html` | `JavaScript.html` | **+** → HTML → nomi: `JavaScript` |

4. Hammasini saqlang (Ctrl+S).

### 3-qadam. Sozlamalarni kiritish (Script Properties)

1. **Project Settings (⚙️) → Script properties → Add script property**.
2. Quyidagi ikkita (xohlasangiz uchinchi) xususiyatni qo'shing:

   | Property | Qiymat |
   |---|---|
   | `SPREADSHEET_ID` | Jadval URL'idagi uzun kod: `docs.google.com/spreadsheets/d/`**`SHU_QISM`**`/edit` |
   | `ADMIN_EMAIL` | O'zingizning Gmail manzilingiz (admin funksiyalari faqat sizga ishlaydi) |
   | `DETAIL_VIEWS_PER_DAY` | Ixtiyoriy. Kunlik karta limiti (yozmasangiz: 30) |

### 4-qadam. Mijozlarga ID berish

1. Muharrirda yuqoridagi funksiya tanlash ro'yxatidan **`admin_assignIds`** ni tanlang.
2. **Run** tugmasini bosing. Birinchi marta Google ruxsat so'raydi —
   o'z hisobingizni tanlab, **Advanced → Go to ... (unsafe) → Allow** qiling
   (bu sizning shaxsiy skriptingiz, "unsafe" ogohlantirishi normal holat).
3. Funksiya `Mijozlar` varag'ining J ustuniga ID raqamlarini yozib chiqadi.

> Keyinchalik yangi mijozlar qo'shsangiz, shu funksiyani yana bir marta ishga tushiring —
> faqat yangi qatorlarga ID beriladi, eskilari o'zgarmaydi.

### 5-qadam. Xodimlarga akkaunt ochish

1. Muharrirda `Auth.gs` faylini oching, pastdagi `setupFirstUsers` funksiyasini toping.
2. Izohga olingan qatorlarni o'z xodimlaringizga moslab yozing:

   ```js
   function setupFirstUsers() {
     admin_addUser('aziza', 'mahfiy_parol_123', 'Aziza Karimova');
     admin_addUser('bobur', 'boshqa_parol_456', 'Bobur Aliyev');
   }
   ```

3. Funksiya ro'yxatidan `setupFirstUsers` ni tanlab **Run** bosing.
4. ⚠️ **MUHIM:** ishga tushgandan keyin parollarni bu yerdan O'CHIRIB tashlang va saqlang —
   jadvalda faqat hash saqlanadi, ochiq parol hech qayerda qolmasligi kerak.
5. Parollarni xodimlarga og'zaki yoki xavfsiz kanalda yetkazing.

### 6-qadam. Web-ilovani e'lon qilish (Deploy)

1. O'ng yuqorida **Deploy → New deployment**.
2. ⚙️ belgisidan **Web app** turini tanlang.
3. Sozlamalar:
   - **Execute as:** `Me (sizning email)` — bu juda muhim!
   - **Who has access:** `Anyone` — xavotir olmang, ilovaning o'z login tizimi bor.
4. **Deploy** bosing va chiqqan **Web app URL** ni nusxalang.
5. Shu URL'ni xodimlarga yuboring — ular telefon yoki kompyuterda ochib,
   login-parol bilan kirishadi. (Qulaylik uchun URL'ni qisqartirish xizmatidan
   o'tkazsangiz ham bo'ladi.)

> ⚠️ **Eng ko'p adashiladigan joy:** keyinchalik kodga o'zgartirish kiritsangiz,
> u avtomatik ishga tushmaydi! **Deploy → Manage deployments → ✏️ (Edit) →
> Version: New version → Deploy** qilishingiz kerak. URL o'zgarmaydi.

### 7-qadam (ixtiyoriy). Haftalik tozalash triggeri

Eski kunlik hisoblagichlar to'planib qolmasligi uchun:
**Triggers (⏰) → Add Trigger → funksiya: `cleanupOldCounters` →
Time-driven → Week timer → Save**.

---

## Tekshirish ro'yxati (deploydan keyin)

1. ✅ Web app URL'ni **incognito oynada** oching → login oynasi chiqishi kerak
   (Google akkaunt so'ramasligi kerak).
2. ✅ Ataylab 5 marta xato parol kiriting → "15 daqiqadan keyin..." xabari chiqadi,
   `Audit` varag'ida `LOGIN_FAIL` qatorlari paydo bo'ladi.
3. ✅ To'g'ri login → yuqorida ism va "Bugungi limit: 30/30" ko'rinadi,
   fonda xira watermark bor.
4. ✅ Mijoz qidiring → ro'yxatda raqamlar YO'Q, faqat nom/viloyat/brend.
5. ✅ "Ko'rish" bosing → karta ochiladi, raqamlar bosib qo'ng'iroq qilinadigan
   havola ko'rinishida; limit 29 ga tushadi; `Audit`da `VIEW_PHONE` qatori.
6. ✅ Xulosa yozib "Saqlash" bosing → `Izohlar` varag'ida yangi qator paydo bo'ladi.
7. ✅ Mijoz nomini sichqoncha bilan belgilashga, o'ng tugma bosishga,
   Ctrl+C / Ctrl+P bosishga urinib ko'ring → ishlamaydi, chop etishda bo'sh sahifa.
8. ✅ Sinov uchun `DETAIL_VIEWS_PER_DAY` ni `2` qilib, 3 ta karta oching →
   uchinchisi "limit tugadi" deydi, `Audit`da `LIMIT_HIT`. Keyin qiymatni qaytaring.
9. ✅ Brauzer tabini yopib qayta oching → qayta login so'raladi.
10. ✅ Xodim o'z Google akkauntida jadval URL'ini ochib ko'rsin → "ruxsat yo'q"
    chiqishi kerak (jadval hech kimga ulashilmagan).

---

## Kundalik boshqaruv (FAQ)

**Yangi xodim qo'shish** — muharrirda `setupFirstUsers` ichiga bitta `admin_addUser(...)`
yozib Run qiling (keyin parolni o'chiring).

**Xodim parolni unutdi** — `admin_setPassword('login', 'yangi_parol')` ni Run qiling.

**Xodim ishdan ketdi** — darhol `admin_deactivateUser('login')` ni Run qiling.
Uning sessiyasi maksimum 6 soatda o'chadi; xavotir bo'lsa, `Foydalanuvchilar`
varag'ida `Faol` ustunini `FALSE` qilganingizdan keyin u qayta kira olmaydi.

**Kunlik limitni o'zgartirish** — Script Properties'da `DETAIL_VIEWS_PER_DAY`
qiymatini o'zgartiring. Deploy shart emas, darhol kuchga kiradi.

**Yangi mijozlar qo'shdim** — `Mijozlar` varag'iga oddiy qator qo'shing,
keyin `admin_assignIds` ni bir marta Run qiling. Ilova 5 daqiqa ichida ko'radi
(kesh muddati).

**"Sessiya tugadi" deb chiqyapti** — bu normal: 6 soat ishlatilmasa yoki tab yopilsa
qayta kirish kerak.

**Kim nimani ko'rganini qanday bilaman?** — `Audit` varag'ini oching:
`VIEW_PHONE` qatorlari kim qachon kimning raqamini ochganini ko'rsatadi.
Bitta xodimda qisqa vaqtda juda ko'p `SEARCH`/`VIEW_PHONE`/`LIMIT_HIT`
bo'lsa — bu ma'lumot yig'ishga urinish belgisi.

**Ilova sekin ishlayapti** — birinchi so'rov keshni to'ldirgani uchun 2-3 soniya
olishi mumkin, keyingilari tez. `Audit` varag'i juda katta bo'lib ketsa
(yuz minglab qator), eski qatorlarni alohida faylga ko'chirib arxivlang.
