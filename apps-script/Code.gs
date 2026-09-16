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

    if (action === "reading" || action === "followup") {
      checkRateLimit();
      const r = callGemini(body.prompt, body.model);
      return jsonResponse({ ok: true, result: r.text, model: r.model, ms: r.ms });
    }

    return jsonResponse({ ok: false, error: "unknown action" });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

function doGet(e) {
  return jsonResponse({ ok: true, service: "Mystic Tarot API", version: "1.0" });
}

// ---------- Gemini API (multi-model fallback) ----------
// Measured: lite answers in 3-10s, 3.7-flash in 60-180s (often past the
// client timeout), and 3.5-flash is reliably overloaded and burns ~50s before
// saying so. Lite leads; 3.7-flash is the fallback when lite is unavailable.
const GEMINI_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.7-flash",
];

// Apps Script web apps are cut off by Google at ~60s, which surfaces to the
// browser as an HTML error page instead of JSON. Stop before that so the
// client always gets a parseable response.
const DEADLINE_MS = 40000;

function callGemini(prompt, forceModel) {
  const started = Date.now();
  const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not set in Script Properties");

  function buildOptions(withThinking) {
    const generationConfig = {
      temperature: 0.85,
      topP: 0.95,
      maxOutputTokens: 3000,
    };
    // Gemini 3.x spends maxOutputTokens on internal reasoning first, which both
    // slows the call and truncates the reading. Not every model accepts the
    // knob, so callers fall back to omitting it.
    if (withThinking) generationConfig.thinkingConfig = { thinkingBudget: 0 };

    return {
      method: "post",
      contentType: "application/json",
      muteHttpExceptions: true,
      payload: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: generationConfig,
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
        ]
      }),
    };
  }

  let lastError = "";
  // forceModel comes from the request body, so only ever honour a name we ship.
  const candidates = GEMINI_MODELS.indexOf(forceModel) !== -1 ? [forceModel] : GEMINI_MODELS;
  for (const model of candidates) {
    if (Date.now() - started > DEADLINE_MS) {
      lastError = "หมดเวลารอ (" + lastError + ")";
      break;
    }
    const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;
    try {
      let response = UrlFetchApp.fetch(url, buildOptions(true));
      let status = response.getResponseCode();
      let json = JSON.parse(response.getContentText());

      if (status === 400) {
        response = UrlFetchApp.fetch(url, buildOptions(false));
        status = response.getResponseCode();
        json = JSON.parse(response.getContentText());
      }

      if (status === 429 || status === 503) {
        lastError = model + ": " + (json?.error?.message || "overloaded");
        continue;
      }
      if (status !== 200) {
        lastError = model + ": " + (json?.error?.message || "error " + status);
        continue;
      }

      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        lastError = model + ": empty response";
        continue;
      }

      return { text: text, model: model, ms: Date.now() - started };
    } catch (e) {
      lastError = model + ": " + e.message;
      continue;
    }
  }

  throw new Error("ทุกโมเดลไม่ว่าง: " + lastError);
}

// ---------- Rate limiting (simple) ----------
// ป้องกันการเรียก API ถี่เกินไป: สูงสุด 10 ครั้ง/นาที/ผู้ใช้
const RATE_PER_MINUTE = 10;
const RATE_PER_DAY = 200;
const RATE_TIMEZONE = "Asia/Bangkok";

function checkRateLimit() {
  const lock = LockService.getScriptLock();
  // Without the lock, parallel requests read the same count and the cap leaks.
  if (!lock.tryLock(5000)) {
    throw new Error("ขณะนี้มีผู้ใช้งานพร้อมกันจำนวนมาก โปรดลองใหม่อีกครั้ง");
  }
  try {
    const cache = CacheService.getScriptCache();
    const perMinute = parseInt(cache.get("rate_min") || "0", 10);
    if (perMinute >= RATE_PER_MINUTE) {
      throw new Error("โปรดรอสักครู่ก่อนเปิดไพ่ครั้งถัดไป");
    }

    // CacheService tops out at 6 hours, so the daily tally lives in Properties.
    const props = PropertiesService.getScriptProperties();
    const today = Utilities.formatDate(new Date(), RATE_TIMEZONE, "yyyyMMdd");
    const parts = (props.getProperty("rate_day") || "").split(":");
    const perDay = parts[0] === today ? (parseInt(parts[1], 10) || 0) : 0;
    if (perDay >= RATE_PER_DAY) {
      throw new Error("วันนี้ใช้งานครบโควตาแล้ว โปรดลองใหม่พรุ่งนี้");
    }

    cache.put("rate_min", String(perMinute + 1), 60);
    props.setProperty("rate_day", today + ":" + (perDay + 1));
  } finally {
    lock.releaseLock();
  }
}

// ---------- Helpers ----------
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
