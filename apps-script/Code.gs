/**
 * Mystic Tarot — Google Apps Script Backend
 * -----------------------------------------------
 * ทำหน้าที่:
 * 1. รับ prompt จาก frontend → เรียก Gemini API → ส่งคำตอบกลับ
 * 2. เก็บ Gemini API Key ไว้ใน Script Properties (ไม่โชว์ฝั่ง client)
 *
 * วิธีติดตั้ง:
 * 1. ไปที่ https://script.google.com → สร้างโปรเจกต์ใหม่
 * 2. คัดลอกโค้ดนี้ไปวาง
 * 3. ไปที่ Project Settings → Script Properties → เพิ่ม:
 *    - Key: GEMINI_API_KEY   Value: (API Key จาก https://aistudio.google.com)
 * 4. Deploy → New Deployment → Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. คัดลอก URL ที่ได้ไปใส่ใน frontend (CONFIG.API_URL)
 */

// ---------- Entry point ----------
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === "reading") {
      const result = callGemini(body.prompt);
      return jsonResponse({ ok: true, result: result });
    }

    if (action === "followup") {
      const result = callGemini(body.prompt);
      return jsonResponse({ ok: true, result: result });
    }

    return jsonResponse({ ok: false, error: "unknown action" });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

function doGet(e) {
  return jsonResponse({ ok: true, service: "Mystic Tarot API", version: "1.0" });
}

// ---------- Gemini API ----------
function callGemini(prompt) {
  const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not set in Script Properties");

  // ใช้ Gemini 2.5 Flash (free tier, เร็ว, โควตาสูง)
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=" + apiKey;

  const payload = {
    contents: [{
      role: "user",
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.85,
      topP: 0.95,
      maxOutputTokens: 2048,
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
    ]
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(url, options);
  const status = response.getResponseCode();
  const json = JSON.parse(response.getContentText());

  if (status !== 200) {
    const errMsg = json?.error?.message || "Gemini API error " + status;
    throw new Error(errMsg);
  }

  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned empty response");

  return text;
}

// ---------- Rate limiting (simple) ----------
// ป้องกันการเรียก API ถี่เกินไป: สูงสุด 10 ครั้ง/นาที/ผู้ใช้
function checkRateLimit() {
  const cache = CacheService.getScriptCache();
  const key = "rate_global";
  const count = parseInt(cache.get(key) || "0", 10);
  if (count >= 10) throw new Error("rate_limit: โปรดรอสักครู่ก่อนเปิดไพ่ครั้งถัดไป");
  cache.put(key, String(count + 1), 60);
}

// ---------- Helpers ----------
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
