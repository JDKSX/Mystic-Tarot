/* =========================================================
   TAROT ENGINE — ระบบสุ่มไพ่ (client-side)
   Fisher–Yates shuffle · กันไพ่ซ้ำ · สุ่ม orientation
   สร้าง reading_id · ผูกตำแหน่งตาม spread
   ========================================================= */
const TarotEngine = (function () {
  "use strict";

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // Fisher–Yates shuffle (in-place)
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // สุ่ม orientation: reversed_chance = 0–1 (default 0.5)
  function randomOrientation(reversedChance) {
    return Math.random() < (reversedChance ?? 0.5) ? "reversed" : "upright";
  }

  /**
   * สร้าง Reading ใหม่
   * @param {Object} opts
   * @param {string} opts.spreadId   - id ของ spread (one/three/five)
   * @param {string} opts.topic      - id หัวข้อ
   * @param {string} opts.question   - คำถาม
   * @param {Object} opts.spread     - spread object { id, count, positions }
   * @param {Object[]} opts.deck     - ไพ่ทั้งสำรับ (TAROT_DECK)
   * @param {number} [opts.reversedChance=0.5]
   * @returns {Object} reading
   */
  function createReading(opts) {
    const { spread, topic, question, deck, reversedChance } = opts;
    const count = spread.count;

    // Shuffle ทั้งสำรับ แล้วหยิบ n ใบแรก (กันซ้ำโดยธรรมชาติ)
    const shuffled = shuffle(deck);
    const drawn = shuffled.slice(0, count);

    const cards = drawn.map((card, i) => ({
      position_index: i,
      position_label: spread.positions[i] || ("ใบที่ " + (i + 1)),
      card_id: card.id,
      card: card,
      orientation: randomOrientation(reversedChance),
    }));

    return {
      reading_id: generateId(),
      created_at: new Date().toISOString(),
      topic: topic,
      question: question,
      spread_id: spread.id,
      spread_name: spread.title,
      cards: cards,
      ai_result: null,
    };
  }

  /**
   * สร้าง Daily Reading (1 ใบ, ผูกกับวันที่ ไม่สุ่มใหม่ถ้าวันเดียวกัน)
   */
  function createDailyReading(deck, reversedChance) {
    const today = new Date().toISOString().slice(0, 10);
    const stored = localStorage.getItem("mystictarot_daily");
    if (stored) {
      try {
        const d = JSON.parse(stored);
        if (d.date === today) return d;
      } catch {}
    }
    const shuffled = shuffle(deck);
    const card = shuffled[0];
    const orientation = randomOrientation(reversedChance);
    const reading = {
      date: today,
      reading_id: generateId(),
      card_id: card.id,
      card: card,
      orientation: orientation,
    };
    localStorage.setItem("mystictarot_daily", JSON.stringify(reading));
    return reading;
  }

  return { createReading, createDailyReading, shuffle, generateId };
})();

if (typeof window !== "undefined") window.TarotEngine = TarotEngine;
