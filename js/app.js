/* =========================================================
   Mystic Tarot — App
   Vanilla JS SPA · ใช้ TarotEngine + localStorage history
   ========================================================= */
(function () {
  "use strict";

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const cardById = (id) => TAROT_DECK.find((c) => c.id === id);
  function cardImgPath(id) {
    const m = id.match(/^(maj)(\d+)$|^(wa)(\d+)$|^(cu)(\d+)$|^(sw)(\d+)$|^(pe)(\d+)$/);
    if (!m) return "";
    if (m[1]) return "assets/cards/m" + m[2] + ".jpg";
    if (m[3]) return "assets/cards/w" + m[4] + ".jpg";
    if (m[5]) return "assets/cards/c" + m[6] + ".jpg";
    if (m[7]) return "assets/cards/s" + m[8] + ".jpg";
    if (m[9]) return "assets/cards/p" + m[10] + ".jpg";
    return "";
  }
  const topicById = (id) => MOCK_TOPICS.find((t) => t.id === id);
  const spreadById = (id) => MOCK_SPREADS.find((s) => s.id === id);

  // ---------- CONFIG ----------
  const CONFIG = {
    API_URL: "https://script.google.com/macros/s/AKfycbxIE19_2ApKHKaA0GtR_bKG2ALfhb-1-knN9gG33EbOF4qBaj-iZvOIalVdOgYSC008-w/exec",
  };

  // ---------- state ----------
  const state = {
    view: "home",
    stack: [],
    draft: { topic: null, spread: null, question: "", picked: [] },
    currentReading: null,
    settings: loadSettings(),
  };

  const els = {
    gate: $("#gate"),
    app: $("#app"),
    view: $("#view"),
    back: $("#btnBack"),
    drawer: $("#drawer"),
  };

  // ---------- Settings persistence ----------
  function loadSettings() {
    try { return { animations: true, reduceReversed: false, ...JSON.parse(localStorage.getItem("mystictarot_settings")) }; }
    catch { return { animations: true, reduceReversed: false }; }
  }
  function saveSettings() { localStorage.setItem("mystictarot_settings", JSON.stringify(state.settings)); }

  // ---------- Name gate ----------
  const AUTH_KEY = "mystictarot_user";
  function isLoggedIn() { return !!localStorage.getItem(AUTH_KEY); }
  function login(name) { localStorage.setItem(AUTH_KEY, JSON.stringify({ name, at: Date.now() })); }
  function logout() { localStorage.removeItem(AUTH_KEY); location.reload(); }
  function getUserName() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY))?.name || "ผู้เดินทาง"; }
    catch { return "ผู้เดินทาง"; }
  }

  function initGate() {
    if (isLoggedIn()) { showApp(); return; }
    els.gate.hidden = false;
    $("#gateForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("#userName").value.trim();
      if (name.length >= 1) { login(name); showApp(); }
      else { $("#gateError").hidden = false; }
    });
  }

  function showApp() {
    els.gate.hidden = true;
    els.app.hidden = false;
    navigate("home", true);
  }

  // ---------- History (localStorage) ----------
  const HISTORY_KEY = "mystictarot_history";
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch { return []; }
  }
  function saveHistory(list) { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); }
  function addToHistory(reading) {
    const list = loadHistory();
    list.unshift({
      id: reading.reading_id,
      topic: reading.topic,
      question: reading.question,
      spread: reading.spread_id,
      cards: reading.cards.map(c => ({ id: c.card_id, orient: c.orientation, pos: c.position_label })),
      ai_result: reading.ai_result,
      date: reading.created_at.slice(0, 10),
    });
    if (list.length > 100) list.length = 100;
    saveHistory(list);
  }
  function deleteFromHistory(id) {
    const list = loadHistory().filter(h => h.id !== id);
    saveHistory(list);
  }

  // ---------- AI integration ----------
  function buildAIPrompt(reading) {
    const spread = spreadById(reading.spread_id);
    const topic = topicById(reading.topic);
    const cardsText = reading.cards.map(c => {
      const card = c.card;
      return `ตำแหน่ง: ${c.position_label}
ไพ่: ${card.name_th} (${card.name_en})
สถานะ: ${c.orientation === "reversed" ? "กลับหัว (Reversed)" : "ตั้งตรง (Upright)"}
คำสำคัญ: ${card.keywords.join(", ")}
ความหมาย: ${c.orientation === "reversed" ? card.reversed : card.upright}`;
    }).join("\n\n");

    return `คุณคือนักตีความไพ่ทาโรต์ที่เชี่ยวชาญ สุภาพ อ่อนโยน ลึกลับเล็กน้อย
ใช้ภาษาไทยทั้งหมด ให้คำตอบเน้นการสะท้อนตนเอง ไม่ฟันธงอนาคต ไม่ทำให้กลัว
ห้ามให้คำตัดสินเด็ดขาดเรื่อง: โรคภัย การรักษา การเสียชีวิต การลงทุน การพนัน คดีความ การทำร้ายตัวเอง

หัวข้อ: ${topic ? topic.title : "ทั่วไป"}
คำถาม: ${reading.question || "ไม่ได้ระบุคำถาม"}
รูปแบบ: ${spread ? spread.title : "ไพ่ใบเดียว"} (${reading.cards.length} ใบ)

ไพ่ที่เปิดได้:
${cardsText}

กรุณาวิเคราะห์และตอบในรูปแบบต่อไปนี้ (ใช้ ## เป็นหัวข้อ):

## ภาพรวม
(วิเคราะห์ภาพรวมของ reading นี้ 2-3 ประโยค)

## ไพ่แต่ละใบ
(วิเคราะห์ไพ่แต่ละใบในบริบทของคำถามและตำแหน่ง)

## ความสัมพันธ์ระหว่างไพ่
(วิเคราะห์ความเชื่อมโยงระหว่างไพ่ทุกใบ)

## ประเด็นสำคัญ
(สรุปประเด็นที่โดดเด่นที่สุด)

## คำแนะนำ
(ให้คำแนะนำเชิงสะท้อนตนเอง)

## คำถามสำหรับใคร่ครวญ
(ตั้งคำถาม 1-2 ข้อให้ผู้ใช้คิดต่อ)`;
  }

  async function callAI(prompt) {
    if (CONFIG.API_URL) {
      const res = await fetch(CONFIG.API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reading", prompt }),
      });
      if (!res.ok) throw new Error("API error " + res.status);
      const data = await res.json();
      return data.result || data.text || data;
    }
    return null;
  }

  function parseAIResult(text) {
    if (!text) return null;
    const sections = {};
    const keys = [
      ["ภาพรวม", "overview"],
      ["ไพ่แต่ละใบ", "perCard"],
      ["ความสัมพันธ์ระหว่างไพ่", "relation"],
      ["ประเด็นสำคัญ", "key"],
      ["คำแนะนำ", "advice"],
      ["คำถามสำหรับใคร่ครวญ", "followup"],
      ["คำถามต่อ", "followup"],
    ];
    for (const [label, key] of keys) {
      const re = new RegExp("##\\s*" + label + "\\s*\\n([\\s\\S]*?)(?=\\n##|$)", "i");
      const m = text.match(re);
      if (m) sections[key] = m[1].trim();
    }
    if (Object.keys(sections).length === 0) {
      sections.overview = text;
    }
    return sections;
  }

  function renderAIBlock(sections) {
    const titles = {
      overview: "ภาพรวม", perCard: "ไพ่แต่ละใบ",
      relation: "ความสัมพันธ์ระหว่างไพ่", key: "ประเด็นสำคัญ",
      advice: "คำแนะนำ", followup: "คำถามสำหรับใคร่ครวญ",
    };
    return Object.entries(sections).map(([k, v]) =>
      `<h4>${esc(titles[k] || k)}</h4><p>${esc(v)}</p>`
    ).join("");
  }

  // ---------- navigation ----------
  function navigate(view, replace = false) {
    if (!replace && state.view !== view) state.stack.push(state.view);
    state.view = view;
    render();
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function goBack() {
    const prev = state.stack.pop();
    if (prev) { state.view = prev; render(); }
    else navigate("home", true);
  }

  function render() {
    const fn = VIEWS[state.view] || VIEWS.home;
    els.view.innerHTML = fn();
    els.view.className = "view" + (NEEDS_ACTION.has(state.view) ? " view--with-action" : "");
    els.back.hidden = ["home", "daily", "history", "library"].includes(state.view);
    $$(".tabbar__item").forEach((b) => {
      const n = b.dataset.nav;
      b.classList.toggle("is-active", n === state.view || (["topic","spread","question","shuffle","draw","result","followup"].includes(state.view) && n === "topic"));
    });
    bindViewEvents();
  }

  // ---------- VIEWS ----------
  const NEEDS_ACTION = new Set(["topic", "spread", "question", "shuffle", "draw"]);

  const VIEWS = {
    home: () => `
      <div class="hero">
        <div class="hero__moon"></div>
        <p class="section-label" style="justify-self:center;margin:0">ยินดีต้อนรับ, ${esc(getUserName())}</p>
        <h1 class="hero__title">Mystic Tarot</h1>
        <p class="hero__quote">"คำตอบที่คุณตามหา อาจซ่อนอยู่ในคำถามที่คุณกล้าถาม"</p>
        <button class="btn btn--gold" data-nav="topic">✦ เริ่มเปิดไพ่</button>
      </div>
      <div class="section-label">ทางลัด</div>
      <div class="tiles">
        <button class="tile" data-nav="daily">
          <div class="tile__ico">☀️</div><div class="tile__name">ไพ่ประจำวัน</div>
          <div class="tile__note">สุ่ม 1 ใบสำหรับวันนี้</div>
        </button>
        <button class="tile" data-nav="library">
          <div class="tile__ico">📚</div><div class="tile__name">คลังไพ่</div>
          <div class="tile__note">เรียนรู้ไพ่ 78 ใบ</div>
        </button>
        <button class="tile" data-nav="history">
          <div class="tile__ico">📜</div><div class="tile__name">ประวัติ</div>
          <div class="tile__note">การเปิดไพ่ที่ผ่านมา</div>
        </button>
        <button class="tile" data-nav="about">
          <div class="tile__ico">ℹ️</div><div class="tile__name">เกี่ยวกับ</div>
          <div class="tile__note">คำเตือนการใช้งาน</div>
        </button>
      </div>`,

    topic: () => `
      <h2 class="h-title">เลือกหัวข้อ</h2>
      <p class="h-sub">สิ่งใดที่อยู่ในใจคุณตอนนี้?</p>
      <div class="choice-grid">
        ${MOCK_TOPICS.map((t) => `
          <button class="choice ${state.draft.topic === t.id ? "is-selected" : ""}" data-topic="${t.id}">
            <div class="choice__icon">${t.icon}</div>
            <div class="choice__body">
              <div class="choice__title">${esc(t.title)}</div>
              <div class="choice__desc">${esc(t.desc)}</div>
            </div>
          </button>`).join("")}
      </div>
      <div class="view-actions">
        <button class="btn btn--gold" id="topicNext" ${state.draft.topic ? "" : "disabled style='opacity:.5'"}>ถัดไป ›</button>
      </div>`,

    spread: () => `
      <h2 class="h-title">รูปแบบการเปิดไพ่</h2>
      <p class="h-sub">เลือกจำนวนไพ่ที่เหมาะกับคำถาม</p>
      <div class="choice-grid">
        ${MOCK_SPREADS.map((s) => `
          <button class="choice ${state.draft.spread === s.id ? "is-selected" : ""}" data-spread="${s.id}">
            <div class="choice__icon">${s.icon}</div>
            <div class="choice__body">
              <div class="choice__title">${esc(s.title)} <span class="faint">· ${s.count} ใบ</span></div>
              <div class="choice__desc">${esc(s.desc)}</div>
            </div>
          </button>`).join("")}
      </div>
      <div class="view-actions">
        <button class="btn btn--gold" id="spreadNext" ${state.draft.spread ? "" : "disabled style='opacity:.5'"}>ถัดไป ›</button>
      </div>`,

    question: () => `
      <h2 class="h-title">ตั้งคำถาม</h2>
      <p class="h-sub">เขียนสิ่งที่อยากรู้ ยิ่งชัดเจน คำทำนายยิ่งลึกซึ้ง</p>
      <label class="field-label">คำถามของคุณ</label>
      <textarea class="textarea" id="qInput" placeholder="เช่น ฉันควรโฟกัสอะไรในความสัมพันธ์นี้...">${esc(state.draft.question)}</textarea>
      <div class="chips">
        ${["ฉันควรโฟกัสอะไรตอนนี้", "สิ่งนี้จะเป็นอย่างไรต่อไป", "อะไรที่ฉันมองข้ามอยู่", "พลังงานรอบตัวฉันเป็นเช่นไร"]
          .map((q) => `<button class="chip" data-chip="${esc(q)}">${esc(q)}</button>`).join("")}
      </div>
      <div class="view-actions">
        <button class="btn btn--gold" id="qNext">สับไพ่ ›</button>
      </div>`,

    shuffle: () => `
      <h2 class="h-title center">สับไพ่</h2>
      <p class="h-sub center">ตั้งจิตให้นิ่ง แล้วกดสับไพ่เมื่อพร้อม</p>
      <div class="deck" id="shuffleDeck">
        ${Array.from({ length: 7 }).map(() => `<div class="deck__card">✦</div>`).join("")}
      </div>
      <div class="view-actions">
        <button class="btn btn--purple" id="btnShuffle">🔀 สับไพ่</button>
        <div style="height:10px"></div>
        <button class="btn btn--gold" id="shuffleNext" hidden>เลือกไพ่ ›</button>
      </div>`,

    draw: () => {
      const need = spreadById(state.draft.spread)?.count || 1;
      return `
        <h2 class="h-title center">เลือกไพ่</h2>
        <p class="h-sub center">เลือกไพ่ <b>${need}</b> ใบตามสัญชาตญาณ · เลือกแล้ว <span id="pickCount">${state.draft.picked.length}</span>/${need}</p>
        <div class="deck" id="drawDeck">
          ${Array.from({ length: 21 }).map((_, i) => `<div class="deck__card" data-idx="${i}">✦</div>`).join("")}
        </div>
        <div class="view-actions">
          <button class="btn btn--gold" id="drawReveal" ${state.draft.picked.length >= need ? "" : "disabled style='opacity:.5'"}>เปิดไพ่ ✦</button>
        </div>`;
    },

    result: () => {
      const reading = state.currentReading;
      if (!reading) return `<div class="empty"><p>ไม่พบข้อมูล</p></div>`;
      const spread = spreadById(reading.spread_id) || MOCK_SPREADS[0];
      const topic = topicById(reading.topic);
      const spreadClass = "spread--" + (spread.count === 1 ? "1" : spread.count === 3 ? "3" : "5");
      return `
        <div class="center">
          <div class="section-label" style="justify-self:center">${topic ? topic.icon + " " + esc(topic.title) : "คำทำนาย"}</div>
          <h2 class="h-title">${esc(reading.question || "คำทำนายของคุณ")}</h2>
          <p class="faint">${esc(spread.title)} · ${new Date(reading.created_at).toLocaleDateString("th-TH")}</p>
        </div>

        <div class="spread ${spreadClass}">
          ${reading.cards.map((c) => `
            <div class="spread-slot">
              ${miniCardHTML(c.card, c.orientation === "reversed")}
              <div class="spread-slot__label">${esc(c.position_label)}</div>
            </div>`).join("")}
        </div>

        <div class="section-label">คำทำนายจากไพ่</div>
        ${reading.cards.map((c, i) => resultCardHTML(c, i)).join("")}

        <div class="card-panel ai-block" id="aiBlock">
          <div class="spinner"></div>
          <p class="loading-text">กำลังตีความไพ่...</p>
        </div>

        <div style="height:16px"></div>
        <button class="btn btn--purple" data-nav="followup">💬 ถามต่อ</button>
        <div style="height:10px"></div>
        <button class="btn btn--ghost" id="newReading">✦ เปิดไพ่ใหม่</button>
        <div style="height:14px"></div>
        <p class="faint center">${esc(DISCLAIMER_TEXT)}</p>`;
    },

    historydetail: () => {
      const reading = state.currentReading;
      if (!reading) return `<div class="empty"><p>ไม่พบข้อมูล</p></div>`;
      const spread = spreadById(reading.spread) || MOCK_SPREADS[0];
      const topic = topicById(reading.topic);
      const cards = reading.cards.map(c => ({
        card: cardById(c.id), orientation: c.orient, position_label: c.pos,
      })).filter(c => c.card);
      const spreadClass = "spread--" + (cards.length === 1 ? "1" : cards.length === 3 ? "3" : "5");
      return `
        <div class="center">
          <div class="section-label" style="justify-self:center">${topic ? topic.icon + " " + esc(topic.title) : ""}</div>
          <h2 class="h-title">${esc(reading.question)}</h2>
          <p class="faint">${esc(spread.title)} · ${esc(reading.date)}</p>
        </div>
        <div class="spread ${spreadClass}">
          ${cards.map((c) => `
            <div class="spread-slot">
              ${miniCardHTML(c.card, c.orientation === "reversed", true)}
              <div class="spread-slot__label">${esc(c.position_label)}</div>
            </div>`).join("")}
        </div>
        <div class="section-label">คำทำนายจากไพ่</div>
        ${cards.map((c, i) => resultCardHTML(c, i)).join("")}
        ${reading.ai_result ? `<div class="card-panel ai-block">${renderAIBlock(reading.ai_result)}</div>` : ""}
        <div style="height:14px"></div>
        <p class="faint center">${esc(DISCLAIMER_TEXT)}</p>`;
    },

    followup: () => `
      <h2 class="h-title">ถามต่อ</h2>
      <p class="h-sub">ถามเจาะลึกจากการเปิดไพ่ครั้งล่าสุด (AI จะจำบริบทเดิม)</p>
      <div class="card-panel" style="margin-bottom:14px">
        <p class="faint">การเปิดไพ่อ้างอิง</p>
        <p>${esc(state.currentReading?.question || state.draft.question || "การเปิดไพ่ล่าสุด")}</p>
      </div>
      <label class="field-label">คำถามเพิ่มเติม</label>
      <textarea class="textarea" id="fuInput" placeholder="เช่น แล้วฉันควรเริ่มจากตรงไหนก่อน..."></textarea>
      <div style="height:14px"></div>
      <button class="btn btn--gold" id="fuSend">ส่งคำถาม ›</button>
      <div id="fuAnswer"></div>`,

    daily: () => {
      const revChance = state.settings.reduceReversed ? 0.2 : 0.5;
      const d = TarotEngine.createDailyReading(TAROT_DECK, revChance);
      const card = d.card || cardById(d.card_id);
      const reversed = d.orientation === "reversed";
      return `
        <h2 class="h-title center">ไพ่ประจำวัน</h2>
        <p class="h-sub center">${new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        <div class="spread spread--1">
          <div class="spread-slot">${miniCardHTML(card, reversed)}</div>
        </div>
        ${resultCardHTML({ card, orientation: d.orientation, position_label: "ข้อความสำหรับวันนี้" }, 0)}
        <div class="card-panel">
          <h4 style="color:var(--gold-300);font-family:var(--font-display)">คำแนะนำ</h4>
          <p>${esc(reversed ? card.reversed : card.upright)}</p>
        </div>
        <div style="height:14px"></div>
        <p class="faint center">${esc(DISCLAIMER_TEXT)}</p>`;
    },

    library: () => `
      <h2 class="h-title">คลังไพ่</h2>
      <p class="h-sub">แตะที่ไพ่เพื่อดูความหมาย · ครบทั้งสำรับ ${TAROT_DECK.length} ใบ</p>
      <div class="lib-filter" id="libFilter">
        ${["ทั้งหมด", "Major", "Wands", "Cups", "Swords", "Pentacles"]
          .map((f, i) => `<button data-filter="${f}" class="${i === 0 ? "is-active" : ""}">${f}</button>`).join("")}
      </div>
      <div class="lib-grid" id="libGrid">
        ${TAROT_DECK.map((c) => libCardHTML(c)).join("")}
      </div>`,

    carddetail: () => {
      const c = cardById(state.draft._detailId) || TAROT_DECK[0];
      return `
        <div class="center">
          <div class="spread spread--1"><div class="spread-slot">${miniCardHTML(c, false, true)}</div></div>
          <h2 class="h-title">${esc(c.name_th)}</h2>
          <p class="faint">${esc(c.name_en)} · ${esc(c.arcana)}${c.suit !== "-" ? " · " + c.suit : ""}</p>
        </div>
        <div class="chips" style="justify-content:center">
          ${c.keywords.map((k) => `<span class="chip">${esc(k)}</span>`).join("")}
        </div>
        <div class="card-panel" style="margin-top:16px">
          <h4 style="color:var(--gold-300);font-family:var(--font-display)">🔆 ตั้งตรง (Upright)</h4>
          <p>${esc(c.upright)}</p>
        </div>
        <div class="card-panel" style="margin-top:12px">
          <h4 style="color:var(--gold-300);font-family:var(--font-display)">🔄 กลับหัว (Reversed)</h4>
          <p>${esc(c.reversed)}</p>
        </div>`;
    },

    history: () => {
      const list = loadHistory();
      return `
        <h2 class="h-title">ประวัติการเปิดไพ่</h2>
        <p class="h-sub">การเปิดไพ่ที่ผ่านมาของคุณ · เก็บในเครื่องเท่านั้น</p>
        ${list.length ? list.map((h) => {
          const topic = topicById(h.topic);
          return `
            <div class="hist-item" data-hist="${esc(h.id)}">
              <div class="hist-item__ico">${topic ? topic.icon : "🔮"}</div>
              <div class="hist-item__body">
                <div class="hist-item__q">${esc(h.question)}</div>
                <div class="hist-item__meta">${esc(spreadById(h.spread)?.title || "")} · ${esc(h.date)}</div>
              </div>
              <button class="hist-item__del" data-del="${esc(h.id)}" aria-label="ลบ">🗑</button>
            </div>`;
        }).join("") :
          `<div class="empty"><div class="empty__ico">📜</div><p>ยังไม่มีประวัติการเปิดไพ่</p></div>`}
        ${list.length ? `<div style="height:12px"></div><button class="btn btn--ghost" id="clearHistory">ลบประวัติทั้งหมด</button>` : ""}`;
    },

    settings: () => `
      <h2 class="h-title">ตั้งค่า</h2>
      <p class="h-sub">ปรับแต่งประสบการณ์การใช้งาน</p>
      <div class="row">
        <div><div class="row__label">แอนิเมชัน</div><div class="row__val">เอฟเฟกต์สับไพ่และเปิดไพ่</div></div>
        <div class="switch ${state.settings.animations ? "is-on" : ""}" data-toggle="animations"></div>
      </div>
      <div class="row">
        <div><div class="row__label">ลดไพ่กลับหัว</div><div class="row__val">สุ่มเฉพาะไพ่ตั้งตรงเป็นหลัก</div></div>
        <div class="switch ${state.settings.reduceReversed ? "is-on" : ""}" data-toggle="reduceReversed"></div>
      </div>
      <div class="row">
        <div><div class="row__label">ชื่อของคุณ</div><div class="row__val">${esc(getUserName())}</div></div>
      </div>
      <div style="height:20px"></div>
      <button class="btn btn--ghost" id="settingsLogout">เปลี่ยนชื่อ / ออกจากระบบ</button>`,

    about: () => `
      <h2 class="h-title">เกี่ยวกับ</h2>
      <p class="h-sub">Mystic Tarot · เวอร์ชัน 1.0</p>
      <div class="disclaimer">
        <b style="color:var(--gold-300)">⚠️ คำเตือนสำคัญ</b><br><br>
        ${esc(DISCLAIMER_TEXT)}<br><br>
        AI จะไม่ให้คำตัดสินเด็ดขาดเกี่ยวกับ โรคภัย การรักษา การเสียชีวิต การลงทุน การพนัน คดีความ หรือการทำร้ายตัวเอง
        หากคุณกำลังเผชิญเรื่องเหล่านี้ โปรดปรึกษาผู้เชี่ยวชาญที่เกี่ยวข้องโดยตรง
      </div>
      <div class="section-label">ความเป็นส่วนตัว</div>
      <p class="muted" style="font-size:.9rem">ระบบนี้ไม่เก็บข้อมูลส่วนตัวของคุณ · คุณใช้ชื่อสมมติได้ · ชื่อ ประวัติ และการตั้งค่าถูกบันทึกไว้ในเครื่องของคุณเท่านั้น (localStorage) และคุณลบประวัติได้ทุกเมื่อ</p>
      <div class="section-label">สร้างด้วย</div>
      <p class="muted" style="font-size:.9rem">GitHub Pages · Google Apps Script · Google Sheets · Gemini AI — ทำงานบนทรัพยากรฟรี</p>`,
  };

  // ---------- component builders ----------
  function miniCardHTML(card, reversed, revealed = false) {
    return `
      <div class="card ${revealed ? "is-flipped" : ""} ${reversed ? "is-reversed" : ""}" data-card>
        <div class="card__face card__back"><span class="card__back-glyph">✦</span></div>
        <div class="card__face card__front">
          <div class="card__art"><img src="${cardImgPath(card.id)}" alt="${esc(card.name_en)}" loading="lazy"></div>
          <div>
            <div class="card__name">${esc(card.name_th)}</div>
            <div class="card__orient">${reversed ? "กลับหัว" : "ตั้งตรง"}</div>
          </div>
        </div>
      </div>`;
  }

  function resultCardHTML(c, i) {
    const card = c.card;
    const reversed = c.orientation === "reversed";
    return `
      <div class="result-card">
        <div class="result-card__mini">${miniCardHTML(card, reversed, true)}</div>
        <div>
          <div class="result-card__pos">${esc(c.position_label || ("ใบที่ " + (i + 1)))}</div>
          <div class="result-card__name">${esc(card.name_th)}</div>
          <span class="result-card__orient">${reversed ? "🔄 กลับหัว" : "🔆 ตั้งตรง"}</span>
          <div class="result-card__kw">${card.keywords.map(esc).join(" · ")}</div>
        </div>
      </div>`;
  }

  function libCardHTML(c) {
    return `
      <button class="lib-card" data-detail="${c.id}" data-arcana="${c.arcana}" data-suit="${c.suit}">
        <div class="lib-card__art"><img src="${cardImgPath(c.id)}" alt="${esc(c.name_en)}" loading="lazy"></div>
        <div class="lib-card__name">${esc(c.name_th)}</div>
      </button>`;
  }

  // ---------- per-view event binding ----------
  function bindViewEvents() {
    const v = state.view;

    if (v === "topic") {
      $$("[data-topic]").forEach((b) => b.onclick = () => {
        state.draft.topic = b.dataset.topic; render();
      });
      $("#topicNext")?.addEventListener("click", () => state.draft.topic && navigate("spread"));
    }

    if (v === "spread") {
      $$("[data-spread]").forEach((b) => b.onclick = () => {
        state.draft.spread = b.dataset.spread; render();
      });
      $("#spreadNext")?.addEventListener("click", () => state.draft.spread && navigate("question"));
    }

    if (v === "question") {
      const ta = $("#qInput");
      ta.addEventListener("input", () => state.draft.question = ta.value);
      $$("[data-chip]").forEach((b) => b.onclick = () => {
        ta.value = b.dataset.chip; state.draft.question = b.dataset.chip;
      });
      $("#qNext")?.addEventListener("click", () => navigate("shuffle"));
    }

    if (v === "shuffle") {
      $("#btnShuffle")?.addEventListener("click", () => {
        const deck = $("#shuffleDeck");
        if (state.settings.animations) deck.classList.add("is-shuffling");
        setTimeout(() => {
          deck.classList.remove("is-shuffling");
          $("#shuffleNext").hidden = false;
          $("#btnShuffle").textContent = "🔀 สับอีกครั้ง";
        }, state.settings.animations ? 1400 : 200);
      });
      $("#shuffleNext")?.addEventListener("click", () => {
        state.draft.picked = []; navigate("draw");
      });
    }

    if (v === "draw") {
      const need = spreadById(state.draft.spread)?.count || 1;
      $$("#drawDeck .deck__card").forEach((el) => el.onclick = () => {
        if (el.classList.contains("is-picked")) return;
        if (state.draft.picked.length >= need) return;
        el.classList.add("is-picked");
        state.draft.picked.push(el.dataset.idx);
        $("#pickCount").textContent = state.draft.picked.length;
        if (state.draft.picked.length >= need) {
          const btn = $("#drawReveal");
          btn.disabled = false; btn.style.opacity = 1;
        }
      });
      $("#drawReveal")?.addEventListener("click", () => {
        if (state.draft.picked.length >= need) {
          const spread = spreadById(state.draft.spread);
          const revChance = state.settings.reduceReversed ? 0.2 : 0.5;
          const reading = TarotEngine.createReading({
            spread, topic: state.draft.topic, question: state.draft.question,
            deck: TAROT_DECK, reversedChance: revChance,
          });
          state.currentReading = reading;
          navigate("result");
        }
      });
    }

    if (v === "result") {
      revealCardsSequentially();
      loadAIReading();
      $("#newReading")?.addEventListener("click", () => {
        state.draft = { topic: null, spread: null, question: "", picked: [] };
        state.currentReading = null;
        state.stack = []; navigate("topic", true);
      });
    }

    if (v === "followup") {
      $("#fuSend")?.addEventListener("click", () => {
        const q = $("#fuInput").value.trim();
        if (!q) return;
        const box = $("#fuAnswer");
        box.innerHTML = `<div class="card-panel ai-block" style="margin-top:14px"><div class="spinner"></div><p class="loading-text">กำลังพิจารณา...</p></div>`;

        const reading = state.currentReading;
        if (CONFIG.API_URL && reading) {
          const followupPrompt = buildAIPrompt(reading) + "\n\n--- คำถามเพิ่มเติมจากผู้ใช้ ---\n" + q;
          callAI(followupPrompt).then(text => {
            const sections = parseAIResult(text);
            box.innerHTML = `<div class="card-panel ai-block" style="margin-top:14px">${sections ? renderAIBlock(sections) : `<p>${esc(text)}</p>`}<p class="faint">${esc(DISCLAIMER_TEXT)}</p></div>`;
          }).catch(() => {
            box.innerHTML = `<div class="card-panel ai-block" style="margin-top:14px"><p>ไม่สามารถเชื่อมต่อ AI ได้ในขณะนี้</p></div>`;
          });
        } else {
          setTimeout(() => {
            box.innerHTML = `<div class="card-panel ai-block" style="margin-top:14px">
              <h4>คำตอบเพิ่มเติม</h4>
              <p>จากไพ่ที่คุณเปิด สิ่งที่ควรเริ่มก่อนคือการยอมรับความรู้สึกของตัวเองอย่างตรงไปตรงมา แล้วค่อย ๆ ก้าวทีละขั้น โดยไม่กดดันตัวเองให้ได้คำตอบทั้งหมดในทันที</p>
              <p class="faint">${esc(DISCLAIMER_TEXT)}</p></div>`;
          }, 1200);
        }
      });
    }

    if (v === "daily") {
      setTimeout(() => $$(".card[data-card]").forEach((c) => c.classList.add("is-flipped")),
        state.settings.animations ? 400 : 50);
    }

    if (v === "library") {
      $$("#libFilter button").forEach((b) => b.onclick = () => {
        $$("#libFilter button").forEach((x) => x.classList.remove("is-active"));
        b.classList.add("is-active");
        const f = b.dataset.filter;
        $$("#libGrid .lib-card").forEach((card) => {
          const show = f === "ทั้งหมด" || card.dataset.arcana === f || card.dataset.suit === f;
          card.style.display = show ? "" : "none";
        });
      });
      $$("[data-detail]").forEach((b) => b.onclick = () => {
        state.draft._detailId = b.dataset.detail; navigate("carddetail");
      });
    }

    if (v === "history") {
      $$("[data-hist]").forEach((el) => el.onclick = (e) => {
        if (e.target.closest("[data-del]")) return;
        const h = loadHistory().find(h => h.id === el.dataset.hist);
        if (h) { state.currentReading = h; navigate("historydetail"); }
      });
      $$("[data-del]").forEach((b) => b.onclick = (e) => {
        e.stopPropagation();
        if (confirm("ต้องการลบการเปิดไพ่นี้หรือไม่?")) {
          deleteFromHistory(b.dataset.del);
          render();
        }
      });
      $("#clearHistory")?.addEventListener("click", () => {
        if (confirm("ต้องการลบประวัติทั้งหมดหรือไม่?")) {
          saveHistory([]);
          render();
        }
      });
    }

    if (v === "settings") {
      $$("[data-toggle]").forEach((sw) => sw.onclick = () => {
        const k = sw.dataset.toggle;
        state.settings[k] = !state.settings[k];
        sw.classList.toggle("is-on");
        saveSettings();
      });
      $("#settingsLogout")?.addEventListener("click", logout);
    }
  }

  function revealCardsSequentially() {
    const cards = $$(".spread .card[data-card]");
    cards.forEach((c, i) => {
      setTimeout(() => c.classList.add("is-flipped"),
        state.settings.animations ? 300 + i * 400 : 50);
    });
  }

  async function loadAIReading() {
    const block = $("#aiBlock");
    if (!block || !state.currentReading) return;
    const reading = state.currentReading;

    if (CONFIG.API_URL) {
      try {
        const prompt = buildAIPrompt(reading);
        const text = await callAI(prompt);
        const sections = parseAIResult(text);
        reading.ai_result = sections;
        addToHistory(reading);
        block.innerHTML = sections ? renderAIBlock(sections) : `<p>${esc(text)}</p>`;
      } catch {
        block.innerHTML = `<p style="color:var(--cream-dim)">ไม่สามารถเชื่อมต่อ AI ได้ · แสดงข้อมูลไพ่อย่างเดียว</p>`;
        addToHistory(reading);
      }
    } else {
      const delay = state.settings.animations ? 1800 : 400;
      setTimeout(() => {
        const r = MOCK_AI_RESULT;
        reading.ai_result = r;
        addToHistory(reading);
        block.innerHTML = renderAIBlock(r);
      }, delay);
    }
  }

  // ---------- global nav wiring ----------
  function initShell() {
    document.body.addEventListener("click", (e) => {
      const nav = e.target.closest("[data-nav]");
      if (nav) {
        closeDrawer();
        if (nav.dataset.nav === "topic") {
          state.draft = { topic: null, spread: null, question: "", picked: [] };
          state.currentReading = null;
        }
        navigate(nav.dataset.nav);
      }
      if (e.target.closest("[data-close-drawer]")) closeDrawer();
    });
    $("#btnBack").addEventListener("click", goBack);
    $("#btnMenu").addEventListener("click", openDrawer);
    $("#btnLogout").addEventListener("click", logout);
  }
  function openDrawer() { els.drawer.hidden = false; }
  function closeDrawer() { els.drawer.hidden = true; }

  // ---------- boot ----------
  document.addEventListener("DOMContentLoaded", () => {
    initShell();
    initGate();
  });

  // Expose CONFIG for setup
  window.MysticTarotConfig = CONFIG;
})();
