# Mystic Tarot — Personal Tarot AI Web App

เว็บแอปเปิดไพ่ทาโรต์ส่วนตัว · ทำงานบนทรัพยากรฟรี (GitHub Pages + Google Apps Script + Gemini AI)

## สถานะการพัฒนา
- [x] **Phase 1** — UI (15 view, กรอกชื่อเข้าใช้, SPA router)
- [x] **Phase 2** — Tarot Data (ไพ่ครบ 78 ใบ พร้อมความหมายไทย)
- [x] **Phase 3** — Tarot Engine (Fisher–Yates shuffle, กันไพ่ซ้ำ, สุ่ม orientation)
- [x] **Phase 4** — Google Apps Script backend (Gemini API proxy, เก็บ key ปลอดภัย)
- [x] **Phase 5** — AI Reading (Gemini prompt, parse ผลลัพธ์ 6 หัวข้อ, follow-up)
- [x] **Phase 6** — History (localStorage, ดู/ลบ/ลบทั้งหมด, กดเปิดดูย้อนหลัง)
- [x] **Phase 7** — Daily Tarot (ไพ่ประจำวัน, cache ไม่สุ่มซ้ำในวันเดียวกัน)
- [x] **Phase 8** — Animation (shuffle, card flip, glow, result slide-in, reduced motion)
- [x] **Phase 9** — Deploy (SETUP.md + GitHub Pages ready)

## โครงสร้างไฟล์
```
tarot-ai/
├── index.html              # โครงหน้าเว็บ + gate + shell
├── css/style.css            # ธีม Dark Fantasy (mobile-first)
├── js/
│   ├── tarot-deck.js        # ไพ่ 78 ใบ (ข้อมูลหลัก)
│   ├── tarot-engine.js      # ระบบสุ่มไพ่ (Fisher–Yates)
│   ├── mock-data.js         # หัวข้อ/spread/ผล AI จำลอง
│   └── app.js               # SPA router + ทุก view + AI integration
├── apps-script/
│   └── Code.gs              # Google Apps Script backend (Gemini proxy)
├── assets/
│   └── TarotCards.csv       # export สำหรับ import เข้า Google Sheets
├── SETUP.md                 # คู่มือติดตั้ง + Deploy
└── README.md
```

## ทดสอบบนเครื่อง (local)
```bash
cd ~/tarot-ai
python3 -m http.server 4599
```
เปิด http://localhost:4599 · กรอกชื่ออะไรก็ได้เพื่อเข้าใช้งาน

## Deploy
ดู [SETUP.md](SETUP.md) สำหรับขั้นตอนเต็ม (GitHub Pages + Gemini API)

## ค่าใช้จ่าย
**0 บาท/เดือน** — GitHub Pages ฟรี, Google Apps Script ฟรี, Gemini API Free Tier ฟรี
