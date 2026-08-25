# Mystic Tarot — คู่มือติดตั้งและ Deploy

## ขั้นตอนที่ 1: Deploy Frontend (GitHub Pages) — ฟรี

1. สร้าง Repository บน GitHub (ชื่ออะไรก็ได้ เช่น `mystic-tarot`)
2. Push โค้ดขึ้น:
   ```bash
   cd ~/tarot-ai
   git remote add origin https://github.com/<your-username>/mystic-tarot.git
   git branch -M main
   git push -u origin main
   ```
3. ไปที่ GitHub Repository → Settings → Pages
4. Source: Deploy from a branch → Branch: `main` → Folder: `/ (root)`
5. กด Save → รอ 1-2 นาที → เว็บจะอยู่ที่:
   `https://<your-username>.github.io/mystic-tarot/`

**เสร็จแค่นี้ เว็บใช้งานได้แล้ว! (ยังใช้ผล AI จำลอง)**

---

## ขั้นตอนที่ 2: ตั้งค่า AI จริง (Gemini API ผ่าน Google Apps Script) — ฟรี

### 2a. ขอ Gemini API Key
1. ไปที่ https://aistudio.google.com
2. คลิก "Get API Key" → "Create API key"
3. คัดลอก API Key เก็บไว้ (**อย่าแชร์ให้ใครเด็ดขาด**)

### 2b. สร้าง Google Apps Script
1. ไปที่ https://script.google.com → "+ New Project"
2. ลบโค้ดเดิม → คัดลอกทั้งหมดจากไฟล์ `apps-script/Code.gs` ไปวาง
3. ตั้งชื่อโปรเจกต์ว่า "Mystic Tarot API"

### 2c. ใส่ API Key
1. คลิก ⚙️ Project Settings (ซ้ายล่าง)
2. เลื่อนลง → Script Properties → Add Script Property
3. Property: `GEMINI_API_KEY` → Value: (วาง API Key ของคุณ) → Save

### 2d. Deploy
1. คลิก Deploy → New deployment
2. Type: Web app
3. Description: "Mystic Tarot v1"
4. Execute as: **Me**
5. Who has access: **Anyone**
6. คลิก Deploy → Authorize → เลือกบัญชี → Allow
7. คัดลอก **Web app URL** (หน้าตาเช่น `https://script.google.com/macros/s/xxx.../exec`)

### 2e. เชื่อม Frontend กับ Backend
1. เปิดไฟล์ `js/app.js`
2. หาบรรทัด:
   ```js
   API_URL: null,
   ```
3. เปลี่ยนเป็น:
   ```js
   API_URL: "https://script.google.com/macros/s/xxx.../exec",
   ```
   (ใส่ URL จากขั้นตอน 2d)
4. Commit + Push ขึ้น GitHub
5. เสร็จ! ตอนนี้ AI จะตีความไพ่จริงผ่าน Gemini แล้ว

---

## สรุปค่าใช้จ่าย

| รายการ | ค่าใช้จ่าย |
|---|---|
| GitHub Pages | ฟรีถาวร |
| Google Apps Script | ฟรี (โควตา Google) |
| Gemini API (Free Tier) | ฟรี (มีลิมิตต่อวัน) |
| **รวม** | **0 บาท/เดือน** |

## ข้อควรระวัง
- Gemini Free Tier: prompt อาจถูก Google เอาไปปรับปรุงโมเดล
- หากชนลิมิต (250-1000 req/วัน): ผู้ใช้จะเห็นข้อความ "ไม่สามารถเชื่อมต่อ AI ได้" แต่ไพ่ยังใช้งานได้ปกติ
- API Key อยู่ใน Script Properties เท่านั้น → ไม่มีทางเห็นจาก frontend
