/* ============================================================
   ShortsCraft v2.1 — Frontend Logic
   ============================================================ */
(() => {
"use strict";

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);
const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const STATE = {
  user: null,
  isPro: false,
  credits: 10,
  config: null,
  supabase: null,
  currentTopic: "",
  currentResults: null,
  currentTab: "script",
  history: [],
  saved: [],
};

const LS_KEYS = {
  HISTORY: "sc:history:v2",
  SAVED: "sc:saved:v2",
  CREDITS: "sc:credits:v2",
  CREDITS_DAY: "sc:credits:day",
  TASKS: "sc:tasks:v3",
  TASKS_OPENED: "sc:tasks-opened:v3",
  AUTH: "sc:auth:v2",
  CREDITS_VERSION: "sc:credits-version:v10",
};

const FREE_CREDITS = 10;
const CREDIT_VERSION = "10";

/* ── Toast ─────────────────────────────────────────── */
function toast(msg, type = "info", ms = 3000) {
  const wrap = $("#toasts");
  if (!wrap) return console.log(`[${type}]`, msg);
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  const icons = { success: "✅", error: "⚠️", info: "💡" };
  el.innerHTML = `<span class="toast-icon">${icons[type] || "💡"}</span><span>${escapeHtml(msg)}</span>`;
  wrap.appendChild(el);
  setTimeout(() => { el.classList.add("fade-out"); setTimeout(() => el.remove(), 300); }, ms);
}
window.scToast = toast;

/* ── API ───────────────────────────────────────────── */
async function api(path, { method = "GET", body, signal } = {}) {
  try {
    const r = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
    let data;
    try { data = await r.json(); } catch { data = {}; }
    if (!r.ok || data.success === false) throw new Error(data.error || `Request failed (${r.status})`);
    return data;
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new Error(err.message || "Network error");
  }
}

/* ── Auth state persistence ────────────────────────── */
function saveAuthLocal(user) {
  try {
    if (user) {
      const safe = {
        id: user.id || user.email || "local",
        email: user.email || "",
        user_metadata: user.user_metadata || {},
      };
      localStorage.setItem(LS_KEYS.AUTH, JSON.stringify(safe));
    } else {
      localStorage.removeItem(LS_KEYS.AUTH);
    }
  } catch {}
}
function loadAuthLocal() {
  try {
    const raw = localStorage.getItem(LS_KEYS.AUTH);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

/* ── Config + Supabase ─────────────────────────────── */
async function loadConfig() {
  try {
    STATE.config = await api("/api/config");
    if (window.supabase && STATE.config.supabaseUrl && STATE.config.supabaseAnonKey) {
      STATE.supabase = window.supabase.createClient(STATE.config.supabaseUrl, STATE.config.supabaseAnonKey);
      const { data: { session } } = await STATE.supabase.auth.getSession();
      if (session?.user) handleSignedIn(session.user);
      STATE.supabase.auth.onAuthStateChange((_e, sess) => {
        if (sess?.user) handleSignedIn(sess.user);
        else handleSignedOut();
      });
    }
  } catch (e) {
    console.warn("[config]", e.message);
  }

  if (!STATE.user) {
    const local = loadAuthLocal();
    if (local) handleSignedIn(local, /*persist*/ false);
  }
}

/* ── Auth UI ───────────────────────────────────────── */
function handleSignedIn(user, persist = true) {
  STATE.user = user;
  if (persist) saveAuthLocal(user);

  const meta = user.user_metadata || {};
  const name = meta.full_name || meta.name || (user.email || "").split("@")[0] || "Creator";
  const email = user.email || "";
  const avatarUrl = meta.avatar_url || meta.picture || "";
  const initial = (name[0] || "C").toUpperCase();


  $$("#loginBtn, #seoLoginBtn").forEach(b => b && b.classList.add("hidden"));

  $$(".profile-wrap").forEach(p => p && p.classList.remove("hidden"));

  if ($("#profileName")) $("#profileName").textContent = name;
  if ($("#profileEmail")) $("#profileEmail").textContent = email;
  if ($("#avatarInitial")) $("#avatarInitial").textContent = initial;
  if ($("#avatarInitialLg")) $("#avatarInitialLg").textContent = initial;
  if (avatarUrl) {
    ["#avatarImg", "#avatarImgLg"].forEach((sel) => {
      const img = $(sel);
      if (img) { img.src = avatarUrl; img.hidden = false; }
    });
  }

  closeModal("#authModal");
  if (persist) toast(`Welcome, ${name}!`, "success");
  loadCloudData();
}

function handleSignedOut() {
  STATE.user = null;
  STATE.isPro = false;
  saveAuthLocal(null);


  $$("#loginBtn, #seoLoginBtn").forEach(b => b && b.classList.remove("hidden"));

  $$(".profile-wrap").forEach(p => p && p.classList.add("hidden"));
  $("#profilePop")?.classList.add("hidden");
}

/* ── Credits ───────────────────────────────────────── */
function loadCredits() {
  const today = new Date().toISOString().slice(0, 10);
  const day = localStorage.getItem(LS_KEYS.CREDITS_DAY);
  const version = localStorage.getItem(LS_KEYS.CREDITS_VERSION);

  if (day !== today || version !== CREDIT_VERSION) {
    localStorage.setItem(LS_KEYS.CREDITS_DAY, today);
    localStorage.setItem(LS_KEYS.CREDITS_VERSION, CREDIT_VERSION);
    localStorage.setItem(LS_KEYS.CREDITS, String(FREE_CREDITS));
    STATE.credits = FREE_CREDITS;
  } else {
    let stored = parseInt(localStorage.getItem(LS_KEYS.CREDITS) || String(FREE_CREDITS), 10);
    if (isNaN(stored) || stored < 0) stored = FREE_CREDITS;
    STATE.credits = Math.min(stored, FREE_CREDITS);
  }
  renderCredits();
}
function setCredits(n) {
  STATE.credits = Math.max(0, n);
  localStorage.setItem(LS_KEYS.CREDITS, String(STATE.credits));
  renderCredits();
}
function renderCredits() {

  $$("#creditsPill").forEach(p => p && p.classList.remove("hidden"));

  $$("#creditsCount").forEach(c => { if (c) c.textContent = STATE.isPro ? "∞" : STATE.credits; });

  $$("#creditsInfoCount").forEach(ic => { if (ic) ic.textContent = STATE.isPro ? "Unlimited" : STATE.credits; });
}

/* ── Local lists ───────────────────────────────────── */
function loadLocalLists() {
  try { STATE.history = JSON.parse(localStorage.getItem(LS_KEYS.HISTORY) || "[]"); } catch { STATE.history = []; }
  try { STATE.saved = JSON.parse(localStorage.getItem(LS_KEYS.SAVED) || "[]"); } catch { STATE.saved = []; }
  renderLists();
}
function saveLocalLists() {
  localStorage.setItem(LS_KEYS.HISTORY, JSON.stringify(STATE.history.slice(0, 30)));
  localStorage.setItem(LS_KEYS.SAVED, JSON.stringify(STATE.saved.slice(0, 50)));
}
function pushHistory(entry) {
  STATE.history.unshift(entry);
  STATE.history = STATE.history.slice(0, 30);
  saveLocalLists();
  renderLists();
}
window.scPushHistory = pushHistory;

function renderLists() {
  const hList = $("#historyList");
  const sList = $("#savedList");

  const actionButtons = (kind, i) => `
    <div class="sb-actions">
      ${kind === "history" ? `<button class="sb-mini save" data-action="save" data-kind="${kind}" data-idx="${i}" title="Save" aria-label="Save">♡</button>` : ""}
      <button class="sb-mini del" data-action="delete" data-kind="${kind}" data-idx="${i}" title="Delete" aria-label="Delete">×</button>
    </div>`;

  if (hList) {
    hList.innerHTML = STATE.history.length
      ? STATE.history.map((h, i) => `
          <div class="sb-item" data-idx="${i}" data-kind="history">
            <div class="sb-item-main">
              <b>${escapeHtml(h.topic || "Untitled")}</b>
              <span>${new Date(h.at || Date.now()).toLocaleDateString()}</span>
            </div>
            ${actionButtons("history", i)}
          </div>`).join("")
      : `<div class="sb-empty">🎬<p>No scripts yet.</p></div>`;
  }

  if (sList) {
    sList.innerHTML = STATE.saved.length
      ? STATE.saved.map((h, i) => `
          <div class="sb-item" data-idx="${i}" data-kind="saved">
            <div class="sb-item-main">
              <b>${escapeHtml(h.topic || "Saved")}</b>
              <span>${new Date(h.at || Date.now()).toLocaleDateString()}</span>
            </div>
            ${actionButtons("saved", i)}
          </div>`).join("")
      : `<div class="sb-empty">🔖<p>No saved scripts.</p></div>`;
  }


  $$(".sb-mini").forEach((btn) =>
    on(btn, "click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const kind = btn.dataset.kind;
      const idx = parseInt(btn.dataset.idx, 10);
      const list = kind === "saved" ? STATE.saved : STATE.history;
      const item = list[idx];
      if (!item) return;

      if (btn.dataset.action === "delete") {
        list.splice(idx, 1);
        saveLocalLists(); renderLists();
        toast("Deleted.", "info");
        return;
      }
      if (btn.dataset.action === "save") {
        const exists = STATE.saved.some((s) => (s.content || "") === (item.content || ""));
        if (!exists) {
          STATE.saved.unshift({ ...item, at: Date.now() });
          STATE.saved = STATE.saved.slice(0, 50);
          saveLocalLists(); renderLists();
          toast("Script saved.", "success");
        } else toast("Already saved.", "info");
      }
    })
  );


  $$(".sb-item").forEach((el) =>
    on(el, "click", (e) => {
      if (e.target.closest(".sb-mini")) return;
      const kind = el.dataset.kind;
      const idx = parseInt(el.dataset.idx, 10);
      const item = (kind === "saved" ? STATE.saved : STATE.history)[idx];
      if (item) restoreEntry(item);
      closeSidebar();
    })
  );
}

async function loadCloudData() {
  if (!STATE.user || !STATE.supabase) return;
  try {
    const { data } = await STATE.supabase.from("saved_scripts").select("*").eq("user_id", STATE.user.id).order("created_at", { ascending: false }).limit(50);
    if (Array.isArray(data) && data.length) {
      STATE.saved = data.map((d) => ({ topic: d.topic, content: d.content, at: d.created_at, cloud: true }));
      renderLists();
    }
  } catch {}
}

/* ── Sidebar / Modals ──────────────────────────────── */
function openSidebar() { $("#sidebar")?.classList.add("open"); $("#sidebarVeil")?.classList.add("show"); }
function closeSidebar() { $("#sidebar")?.classList.remove("open"); $("#sidebarVeil")?.classList.remove("show"); }
function openModal(sel) { $(sel)?.classList.remove("hidden"); document.body.style.overflow = "hidden"; }
function closeModal(sel) { $(sel)?.classList.add("hidden"); document.body.style.overflow = ""; }

/* ── SEO Tools text generation ─────────────────────── */
let generating = false;
async function doGenerate() {
  if (generating) return;
  const topicInput = $("#topic");
  const topic = (topicInput?.value || "").trim();
  if (!topic) { toast("Type a topic first.", "error"); topicInput?.focus(); return; }
  if (topic.length < 3) { toast("Topic must be at least 3 characters.", "error"); return; }
  if (!STATE.isPro && STATE.credits <= 0) { openModal("#noCreditsModal"); return; }

  generating = true;
  STATE.currentTopic = topic;
  const btn = $("#generateBtn");
  const status = $("#status");
  if (btn) { btn.disabled = true; const lbl = btn.querySelector(".btn-label"); if (lbl) lbl.textContent = "Generating…"; }
  if (status) { status.className = "status"; status.textContent = "Crafting your content pack… ✨"; }
  showSkeletons();

  try {
    const data = await api("/api/generate", { method: "POST", body: { topic, type: "all" } });
    const parsed = parseAll(data.content);
    STATE.currentResults = { topic, raw: data.content, ...parsed };
    renderAll(parsed);
    if (!STATE.isPro) setCredits(STATE.credits - 1);
    pushHistory({ topic, at: Date.now(), content: data.content });
    if ($("#resultsTopic")) $("#resultsTopic").textContent = `Topic: ${topic}`;
    if ($("#regenerateBtn")) $("#regenerateBtn").hidden = false;
    if (status) { status.className = "status success"; status.textContent = "✨ Ready! Switch tabs to view all outputs."; }
    toast("Content pack generated!", "success");
  } catch (err) {
    if (status) { status.className = "status error"; status.textContent = `❌ ${err.message || "Generation failed"}`; }
    toast(err.message || "Generation failed.", "error");
    clearSkeletons();
  } finally {
    if (btn) { btn.disabled = false; const lbl = btn.querySelector(".btn-label"); if (lbl) lbl.textContent = "Generate ✦"; }
    generating = false;
  }
}

function showSkeletons() {
  const skel = `<div class="skeleton skel-line skel-w90"></div><div class="skeleton skel-line skel-w70"></div><div class="skeleton skel-line skel-w50"></div>`;
  ["#scriptSections", "#titlesContent", "#descContent", "#hashtagsContent", "#ideasContent", "#thumbnailContent"]
    .forEach((s) => { const el = $(s); if (el) el.innerHTML = skel; });
}
function clearSkeletons() {
  if ($("#scriptSections")) $("#scriptSections").innerHTML = `<div class="placeholder">Generation failed. Try again ⚠️</div>`;
}

function parseAll(text) {
  const out = { script: "", titles: [], description: "", hashtags: [], ideas: [], thumbnail: [] };
  const get = (label) => {
    const re = new RegExp(`===\\s*${label}\\s*===([\\s\\S]*?)(?====\\s*\\w+\\s*===|$)`, "i");
    const m = text.match(re);
    return m ? m[1].trim() : "";
  };
  out.script = get("SCRIPT") || extractScriptFallback(text);
  const titlesRaw = get("TITLES");
  out.titles = titlesRaw ? splitNumbered(titlesRaw) : [];
  out.description = get("DESCRIPTION");
  const hashRaw = get("HASHTAGS");
  out.hashtags = hashRaw ? hashRaw.match(/#\w+/g) || [] : [];
  const ideasRaw = get("IDEAS");
  out.ideas = ideasRaw ? splitNumbered(ideasRaw) : [];
  const thumbRaw = get("THUMBNAIL");
  out.thumbnail = thumbRaw ? splitNumbered(thumbRaw) : [];
  if (!out.script && !out.titles.length) out.script = text;
  return out;
}
function splitNumbered(t) {
  return t.split(/\n+/).map((l) => l.replace(/^\s*\d+[.)\]]\s*/, "").trim()).filter(Boolean);
}
function extractScriptFallback(text) {
  const idx = text.indexOf("[HOOK]");
  return idx >= 0 ? text.slice(idx) : "";
}

function renderAll({ script, titles, description, hashtags, ideas, thumbnail }) {
  const sEl = $("#scriptSections");
  if (sEl) {
    if (!script) sEl.innerHTML = `<div class="placeholder">No script returned.</div>`;
    else {
      const hook = pick(script, "[HOOK]", "[MAIN]");
      const main = pick(script, "[MAIN]", "[CTA]");
      const cta = pick(script, "[CTA]", null);
      if (hook || main || cta) {
        sEl.innerHTML = `
          ${hook ? `<div class="script-section hook"><b>🔥 Hook</b><p>${escapeHtml(hook)}</p></div>` : ""}
          ${main ? `<div class="script-section main"><b>📖 Main</b><p>${escapeHtml(main).replace(/\n/g, "<br>")}</p></div>` : ""}
          ${cta ? `<div class="script-section cta"><b>🎯 CTA</b><p>${escapeHtml(cta)}</p></div>` : ""}`;
      } else {
        sEl.innerHTML = `<div class="script-section main"><b>📖 Script</b><p>${escapeHtml(script).replace(/\n/g, "<br>")}</p></div>`;
      }
    }
  }
  fillList("#titlesContent", titles, "🎯", "No titles");
  const dEl = $("#descContent");
  if (dEl) dEl.innerHTML = description ? `<div class="desc-body">${escapeHtml(description)}</div>` : `<div class="placeholder">No description.</div>`;
  const hEl = $("#hashtagsContent");
  if (hEl) hEl.innerHTML = hashtags.length
    ? `<div class="hashtag-cloud">${hashtags.map((t) => `<span>${escapeHtml(t)}</span>`).join("")}</div>`
    : `<div class="placeholder">No hashtags.</div>`;
  fillList("#ideasContent", ideas, "💡", "No ideas");
  fillList("#thumbnailContent", thumbnail, "🖼", "No prompts");
}
function pick(text, start, end) {
  const i = text.indexOf(start);
  if (i < 0) return "";
  const j = end ? text.indexOf(end, i) : -1;
  return text.slice(i + start.length, j > 0 ? j : undefined).trim();
}
function fillList(sel, arr, ic, empty) {
  const el = $(sel);
  if (!el) return;
  el.innerHTML = arr.length
    ? arr.map((t, i) => `<div class="list-item"><span class="list-num">${i + 1}.</span><span class="list-text">${escapeHtml(t)}</span></div>`).join("")
    : `<div class="placeholder">${empty} ${ic}</div>`;
}

function restoreEntry(item) {
  if ($("#topic")) $("#topic").value = item.topic || "";
  STATE.currentTopic = item.topic;
  const parsed = parseAll(item.content || "");
  STATE.currentResults = { topic: item.topic, raw: item.content, ...parsed };
  renderAll(parsed);
  if ($("#resultsTopic")) $("#resultsTopic").textContent = `Topic: ${item.topic}`;
  toast("Loaded from history.", "info");
}

/* ── Tabs ──────────────────────────────────────────── */
function bindTabs() {

  $$(".tab").forEach((t) =>
    on(t, "click", () => {

      $$(".tab").forEach((x) => x.classList.remove("active"));

      $$(".panel").forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      STATE.currentTab = t.dataset.tab;
      $(`#panel-${t.dataset.tab}`)?.classList.add("active");
    })
  );
}

/* ── Copy / Download ───────────────────────────────── */
function copyText(t) {
  if (!t) { toast("Nothing to copy.", "error"); return; }
  navigator.clipboard.writeText(t).then(() => toast("Copied!", "success"), () => toast("Copy failed.", "error"));
}
function bindCopyButtons() {
  on($("#copyScriptBtn"), "click", () => copyText(STATE.currentResults?.script || ""));
  on($("#copyTitlesBtn"), "click", () => copyText((STATE.currentResults?.titles || []).join("\n")));
  on($("#copyDescBtn"), "click", () => copyText(STATE.currentResults?.description || ""));
  on($("#copyHashtagsBtn"), "click", () => copyText((STATE.currentResults?.hashtags || []).join(" ")));
  on($("#copyIdeasBtn"), "click", () => copyText((STATE.currentResults?.ideas || []).join("\n")));
  on($("#copyThumbnailBtn"), "click", () => copyText((STATE.currentResults?.thumbnail || []).join("\n\n")));
}
function downloadTxt() {
  if (!STATE.currentResults) { toast("Generate something first.", "error"); return; }
  const r = STATE.currentResults;
  const txt = `ShortsCraft — ${r.topic}\nGenerated: ${new Date().toLocaleString()}\n\n=== SCRIPT ===\n${r.script}\n\n=== TITLES ===\n${(r.titles||[]).map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\n=== DESCRIPTION ===\n${r.description}\n\n=== HASHTAGS ===\n${(r.hashtags||[]).join(" ")}\n\n=== IDEAS ===\n${(r.ideas||[]).map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\n=== THUMBNAIL PROMPTS ===\n${(r.thumbnail||[]).map((t, i) => `${i + 1}. ${t}`).join("\n\n")}\n`;
  const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: `shortscraft-${slug(r.topic)}.txt` });
  a.click();
  URL.revokeObjectURL(url);
  toast("Downloaded!", "success");
}
function slug(s) { return String(s || "topic").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40); }

async function saveCurrent() {
  if (!STATE.currentResults) { toast("Generate something first.", "error"); return; }
  if (!STATE.user) { toast("Sign in to save.", "info"); openModal("#authModal"); return; }
  const entry = { topic: STATE.currentResults.topic, content: STATE.currentResults.raw, at: Date.now() };
  STATE.saved.unshift(entry); saveLocalLists(); renderLists();
  toast("Saved!", "success");
  if (STATE.supabase) {
    try { await STATE.supabase.from("saved_scripts").insert({ user_id: STATE.user.id, topic: entry.topic, content: entry.content }); } catch {}
  }
}

/* ── Auth ──────────────────────────────────────────── */
function bindAuth() {
  on($("#loginBtn"), "click", (e) => { e.preventDefault(); openModal("#authModal"); });
  on($("#seoLoginBtn"), "click", (e) => { e.preventDefault(); openModal("#authModal"); });
  on($("#authModalClose"), "click", () => closeModal("#authModal"));


  $$(".m-tab").forEach((t) =>
    on(t, "click", () => {

      $$(".m-tab").forEach((x) => x.classList.remove("active"));

      $$(".auth-form").forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      $(`#auth-${t.dataset.auth}`)?.classList.add("active");
    })
  );

  on($("#googleSignInBtn"), "click", googleAuth);
  on($("#googleSignUpBtn"), "click", googleAuth);

  on($("#loginSubmit"), "click", async () => {
    const email = $("#loginEmail").value.trim();
    const pw = $("#loginPassword").value;
    const err = $("#loginError");
    if (err) err.classList.add("hidden");
    if (!email || !pw) { if (err) { err.textContent = "Enter email and password."; err.classList.remove("hidden"); } return; }

    if (STATE.supabase) {
      try {
        const { data, error } = await STATE.supabase.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
        if (data?.user) handleSignedIn(data.user);
      } catch (e) { if (err) { err.textContent = e.message; err.classList.remove("hidden"); } }
    } else {
      const local = { id: email, email, user_metadata: { full_name: email.split("@")[0] } };
      handleSignedIn(local);
    }
  });

  on($("#signupSubmit"), "click", async () => {
    const name = $("#signupName").value.trim();
    const email = $("#signupEmail").value.trim();
    const pw = $("#signupPassword").value;
    const err = $("#signupError");
    if (err) err.classList.add("hidden");
    if (!email) { if (err) { err.textContent = "Enter your email."; err.classList.remove("hidden"); } return; }
    if (pw.length < 6) { if (err) { err.textContent = "Password must be 6+ chars."; err.classList.remove("hidden"); } return; }

    if (STATE.supabase) {
      try {
        const { data, error } = await STATE.supabase.auth.signUp({ email, password: pw, options: { data: { full_name: name } } });
        if (error) throw error;
        if (data?.user) {
          handleSignedIn(data.user);
          toast("Account created!", "success");
        } else {
          toast("Account created! Check email.", "success");
          closeModal("#authModal");
        }
      } catch (e) { if (err) { err.textContent = e.message; err.classList.remove("hidden"); } }
    } else {
      const local = { id: email, email, user_metadata: { full_name: name || email.split("@")[0] } };
      handleSignedIn(local);
    }
  });

  on($("#logoutBtn"), "click", async () => {
    if (STATE.supabase) { try { await STATE.supabase.auth.signOut(); } catch {} }
    handleSignedOut();
    toast("Signed out.", "info");
  });

  on($("#avatarBtn"), "click", (e) => {
    e.stopPropagation();
    const pop = $("#profilePop");
    if (!pop) return;
    pop.classList.toggle("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest("#profileWrap") && !e.target.closest(".profile-wrap")) {
      $("#profilePop")?.classList.add("hidden");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      $("#profilePop")?.classList.add("hidden");
    }
  });
}

async function googleAuth() {
  if (!STATE.supabase) {
    toast("Google sign-in is not configured.", "error", 4000);
    return;
  }
  try {
    await STATE.supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/generator" }
    });
  } catch (e) { toast(e.message, "error"); }
}

/* ── Razorpay upgrade ──────────────────────────────── */
async function upgradePro() {
  if (!STATE.user) { toast("Sign in first.", "info"); openModal("#authModal"); return; }
  if (!window.Razorpay) { toast("Payment system loading…", "error"); return; }
  const note = $("#upgradeNote");
  if (note) note.textContent = "Creating order…";
  try {
    const data = await api("/api/razorpay/order", { method: "POST", body: { userId: STATE.user.id } });
    const opts = {
      key: data.keyId, amount: data.amount, currency: data.currency, order_id: data.orderId,
      name: "ShortsCraft Pro", description: "Monthly Pro subscription",
      prefill: { name: STATE.user.user_metadata?.full_name || "", email: STATE.user.email || "" },
      theme: { color: "#ff3d6e" },
      handler: async (resp) => {
        try {
          await api("/api/razorpay/verify", { method: "POST", body: resp });
          STATE.isPro = true;
          renderCredits();
          closeModal("#upgradeModal");
          toast("🎉 Welcome to Pro!", "success", 5000);
        } catch (e) { toast(`Verification failed: ${e.message}`, "error", 5000); }
      },
      modal: { ondismiss: () => { if (note) note.textContent = ""; } }
    };
    new Razorpay(opts).open();
    if (note) note.textContent = "";
  } catch (e) {
    if (note) note.textContent = "";
    toast(e.message || "Could not start payment.", "error");
  }
}

/* ── Feedback ──────────────────────────────────────── */
function bindFeedback() {
  const open = (e) => { if (e) e.preventDefault(); openModal("#feedbackModal"); };
  on($("#feedbackBtn"), "click", open);
  on($("#seoFeedbackBtn"), "click", open);
  on($("#profileFeedbackBtn"), "click", open);
  on($("#feedbackModalClose"), "click", () => closeModal("#feedbackModal"));
  on($("#feedbackCancelBtn"), "click", () => closeModal("#feedbackModal"));

  on($("#feedbackSubmit"), "click", async () => {
    const name = $("#feedbackName").value.trim();
    const email = $("#feedbackEmail").value.trim();
    const message = $("#feedbackMessage").value.trim();
    if (!name) { toast("Enter your name.", "error"); return; }
    if (message.length < 5) { toast("Message too short.", "error"); return; }
    try {
      await api("/api/feedback", { method: "POST", body: { name, email, subject: "Studio feedback", message } });
      toast("Thanks! Feedback submitted.", "success");
      closeModal("#feedbackModal");
      if ($("#feedbackMessage")) $("#feedbackMessage").value = "";
    } catch (e) { toast(e.message, "error"); }
  });
}

/* ── Command palette ───────────────────────────────── */
function bindCmdPalette() {
  const palette = $("#cmdPalette");
  if (!palette) return;
  const open = () => { palette.classList.remove("hidden"); $("#cmdInput")?.focus(); };
  const close = () => palette.classList.add("hidden");


  $$("#studioSearchInput, #seoStudioSearchInput").forEach(i => {
    on(i, "focus", open);
    on(i, "click", open);
  });
  on($("#cmdCloseBtn"), "click", (e) => { e.preventDefault(); close(); });
  on(palette, "click", (e) => { if (e.target === palette) close(); });

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); open(); }
    if (e.key === "Escape") close();
  });


  $$("#cmdList li").forEach((li) => on(li, "click", () => {
    const a = li.dataset.action;
    close();
    runAction(a);
  }));
}
function runAction(a) {
  switch (a) {
    case "video":
      if (location.pathname.includes("/generator")) {
        $("#videoGenerator")?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.location.href = "/generator";
      }
      break;
    case "tools": window.location.href = "/seo-tools"; break;
    case "generate":
      if ($("#generateBtn")) doGenerate();
      else $("#generateVideoBtn")?.click();
      break;
    case "copy": $(`#copy${capitalize(STATE.currentTab)}Btn`)?.click(); break;
    case "download": downloadTxt(); break;
    case "history": openSidebar(); break;
    case "upgrade": openModal("#upgradeModal"); break;
  }
}
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* ── Earn credits / tasks ──────────────────────────── */
function bindEarn() {
  on($("#earnCreditsLink"), "click", () => { $("#profilePop")?.classList.add("hidden"); openModal("#earnModal"); });
  on($("#noCreditsEarnBtn"), "click", () => { closeModal("#noCreditsModal"); openModal("#earnModal"); });
  on($("#noCreditsUpgradeBtn"), "click", () => { closeModal("#noCreditsModal"); openModal("#upgradeModal"); });
  on($("#earnModalClose"), "click", () => closeModal("#earnModal"));
  renderTasks();
}

function renderTasks() {
  const list = $("#tasksList");
  if (!list) return;
  let done, opened;
  try { done = JSON.parse(localStorage.getItem(LS_KEYS.TASKS) || "{}"); } catch { done = {}; }
  try { opened = JSON.parse(localStorage.getItem(LS_KEYS.TASKS_OPENED) || "{}"); } catch { opened = {}; }

  const tasks = [
    { id: "telegram", label: "Follow on Telegram", hint: "Join our Telegram channel for tips and updates.", credits: 1, url: "https://t.me/+ZfQKHJhGg8xiMTRl" },
    { id: "subscribe", label: "Subscribe Tech Vault channel", hint: "Subscribe and come back to claim.", credits: 1, url: "https://www.youtube.com/@TechVault-90" },
    { id: "watch", label: "Watch one Tech Vault video", hint: "Open and watch any helpful video.", credits: 1, url: "https://www.youtube.com/@TechVault-90/videos" },
    { id: "share", label: "Share ShortsCraft with a friend", hint: "Share the website link, then claim.", credits: 1, url: "https://shortscraft.online/" },
    { id: "feedback", label: "Submit useful feedback", hint: "Tell us what to improve, then claim.", credits: 1, action: "feedback" },
  ];

  list.innerHTML = tasks.map((t) => {
    const isDone = !!done[t.id];
    const isOpened = !!opened[t.id];
    const btnText = isDone ? "Done ✓" : isOpened ? "Claim +1" : (t.action === "feedback" ? "Open feedback" : "Open task");
    return `
      <div class="task premium-task ${isDone ? "task-done" : ""}">
        <div class="task-info">
          <b>${escapeHtml(t.label)}</b>
          <span>${escapeHtml(t.hint)}</span>
          <small>+${t.credits} credit</small>
        </div>
        <button data-id="${t.id}" data-action="${t.action || "open"}" ${isDone ? "disabled" : ""}>${btnText}</button>
      </div>`;
  }).join("");


  $$("#tasksList button").forEach((btn) => on(btn, "click", () => {
    const id = btn.dataset.id;
    const task = tasks.find(t => t.id === id);
    if (!task || done[id]) return;

    if (task.action === "feedback" && !opened[id]) {
      opened[id] = true;
      localStorage.setItem(LS_KEYS.TASKS_OPENED, JSON.stringify(opened));
      closeModal("#earnModal");
      openModal("#feedbackModal");
      renderTasks();
      return;
    }

    if (!opened[id]) {
      opened[id] = true;
      localStorage.setItem(LS_KEYS.TASKS_OPENED, JSON.stringify(opened));
      if (task.url) window.open(task.url, "_blank", "noopener,noreferrer");
      toast("Task opened. Complete it, then claim.", "info", 4500);
      renderTasks();
      return;
    }

    done[id] = true;
    localStorage.setItem(LS_KEYS.TASKS, JSON.stringify(done));
    setCredits(STATE.credits + (task.credits || 1));
    toast(`+${task.credits || 1} credit added!`, "success");
    renderTasks();
  }));
}

/* ── Mobile nav (landing page) ────────────────────── */
function bindNav() {
  const burger = $("#navBurger");
  const mobile = $("#navMobile");
  if (burger && mobile) {
    burger.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const isOpen = mobile.classList.contains("open");
      if (isOpen) {
        mobile.classList.remove("open");
        mobile.setAttribute("hidden", "");
      } else {
        mobile.removeAttribute("hidden");
        requestAnimationFrame(() => mobile.classList.add("open"));
      }
    });
    mobile.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
      mobile.classList.remove("open");
      mobile.setAttribute("hidden", "");
    }));
    document.addEventListener("click", (e) => {
      if (!mobile.contains(e.target) && !burger.contains(e.target) && mobile.classList.contains("open")) {
        mobile.classList.remove("open");
        mobile.setAttribute("hidden", "");
      }
    });
  }

  on(window, "scroll", () => {
    const bar = $("#scrollBar");
    if (!bar) return;
    const h = document.documentElement;
    const pct = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
    bar.style.width = `${pct}%`;
  }, { passive: true });
}

/* ── Studio bindings ───────────────────────────────── */
function bindStudio() {
  on($("#generateBtn"), "click", doGenerate);
  on($("#topic"), "keydown", (e) => { if (e.key === "Enter") doGenerate(); });


  $$(".chip[data-topic]").forEach((c) => on(c, "click", () => { if ($("#topic")) $("#topic").value = c.dataset.topic; doGenerate(); }));
  on($("#regenerateBtn"), "click", doGenerate);
  on($("#downloadTxtBtn"), "click", downloadTxt);
  on($("#saveScriptBtn"), "click", saveCurrent);

  on($("#sidebarToggle"), "click", openSidebar);
  on($("#seoSidebarToggle"), "click", openSidebar);
  on($("#sidebarClose"), "click", closeSidebar);
  on($("#sidebarVeil"), "click", closeSidebar);

  on($("#clearHistoryBtn"), "click", () => {
    if (confirm("Clear all local history?")) {
      STATE.history = []; saveLocalLists(); renderLists();
      toast("History cleared.", "info");
    }
  });

  on($("#viewHistoryBtn"), "click", () => { $("#profilePop")?.classList.add("hidden"); openSidebar(); });
  on($("#viewSavedBtn"), "click", () => { $("#profilePop")?.classList.add("hidden"); openSidebar(); });
  on($("#upgradeBtn"), "click", () => { $("#profilePop")?.classList.add("hidden"); openModal("#upgradeModal"); });
  on($("#upgradeModalClose"), "click", () => closeModal("#upgradeModal"));
  on($("#upgradeSubmit"), "click", upgradePro);
  on($("#noCreditsModalClose"), "click", () => closeModal("#noCreditsModal"));


  $$(".modal-veil").forEach((v) => on(v, "click", (e) => { if (e.target === v) v.classList.add("hidden"); }));

  bindTabs();
  bindCopyButtons();
  bindAuth();
  bindFeedback();
  bindCmdPalette();
  bindEarn();
}

/* ── Init ──────────────────────────────────────────── */
async function init() {
  bindNav();
  if ($("#generateBtn") || $("#videoGenerator")) bindStudio();
  loadLocalLists();
  await loadConfig();
  if (!STATE.user) handleSignedOut();
  loadCredits();
}
document.addEventListener("DOMContentLoaded", init);


/* ============================================================
   SCRIPT TO VIDEO — RELIABLE PROFESSIONAL STYLE ENGINE (v5.1)
   ------------------------------------------------------------
   Fixes: visible dynamic text, distinct style layouts, clean scene
   splitting, aspect ratio classes, edit prompt actions, credits.
   ============================================================ */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const FREE_CREDITS_VIDEO = 10;
  const LS_CREDIT = "sc:credits:v2";
  const LS_DAY = "sc:credits:day";
  const LS_VER = "sc:credits-version:v10";
  const CREDIT_VER = "v10";

  const VIDEO_STATE = { html: "", scenes: [], style: "viral-hook", aspect: "9:16" };

  const STYLE_NAMES = {
    "viral-hook": "YouTube Viral Hook",
    "typography-premium": "Premium Typography",
    "clean-minimal": "Clean Minimal White",
    "neon-cyber": "Neon Cyber Kinetic",
    "motivation": "Motivation Reel",
    "podcast": "Modern Podcast Subtitle",
    "news": "Bold Breaking News",
    "horror": "Horror / Mystery",
    "luxury": "Luxury Gold Premium",
    "social-pop": "Social Gradient Pop",
    "documentary": "Faceless Documentary",
    "tech-blueprint": "Tech Explainer Blueprint",
    "gaming": "Gaming Esports",
    "classroom": "Classroom Educational",
    "vhs": "Retro VHS Tape",
    "startup": "Startup SaaS Clean"
  };

  function toast(message, type = "info", ms = 3200) {
    if (typeof window.scToast === "function") return window.scToast(message, type, ms);
    const wrap = $("#toasts") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "toasts", className: "toasts" }));
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 280); }, ms);
  }

  function todayKey() { return new Date().toISOString().slice(0, 10); }

  function normalizeCredits() {
    const t = todayKey();
    const day = localStorage.getItem(LS_DAY);
    const ver = localStorage.getItem(LS_VER);
    if (day !== t || ver !== CREDIT_VER) {
      localStorage.setItem(LS_DAY, t);
      localStorage.setItem(LS_VER, CREDIT_VER);
      localStorage.setItem(LS_CREDIT, String(FREE_CREDITS_VIDEO));
      return FREE_CREDITS_VIDEO;
    }
    const n = parseInt(localStorage.getItem(LS_CREDIT) || String(FREE_CREDITS_VIDEO), 10);
    return Number.isFinite(n) ? Math.max(0, Math.min(FREE_CREDITS_VIDEO, n)) : FREE_CREDITS_VIDEO;
  }

  function setCredits(n) {
    n = Math.max(0, Math.min(FREE_CREDITS_VIDEO, Number(n) || 0));
    localStorage.setItem(LS_DAY, todayKey());
    localStorage.setItem(LS_VER, CREDIT_VER);
    localStorage.setItem(LS_CREDIT, String(n));
    ["#creditsCount", "#creditsInfoCount"].forEach(sel => { const el = $(sel); if (el) el.textContent = n; });
    const pill = $("#creditsPill"); if (pill) pill.classList.remove("hidden");
    return n;
  }

  function deductCredit() {
    const isPro = document.body.classList.contains("sc-pro") || localStorage.getItem("sc:isPro") === "true";
    if (isPro) return true;
    const current = normalizeCredits();
    if (current <= 0) {
      if (typeof window.openModal === "function") window.openModal("#noCreditsModal");
      else $("#noCreditsModal")?.classList.remove("hidden");
      return false;
    }
    setCredits(current - 1);
    return true;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[ch]));
  }

  function cleanScript(raw) {
    return String(raw || "")
      .replace(/\r/g, "\n")
      .replace(/\[(hook|main|body|cta|intro|outro|scene\s*\d+|part\s*\d+)\]/gi, "\n")
      .replace(/(^|\n)\s*(hook|main|body|cta|intro|outro|scene\s*\d+|part\s*\d+)\s*[:：-]\s*/gi, "\n")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/\s+\n/g, "\n")
      .replace(/\n{2,}/g, "\n")
      .trim();
  }

  function splitSentences(text) {
    const cleaned = cleanScript(text);
    if (!cleaned) return [];
    const lines = cleaned.split(/\n+/).map(x => x.trim()).filter(Boolean);
    const out = [];
    lines.forEach(line => {
      const parts = line
        .replace(/([.!?।])\s+/g, "$1|SPLIT|")
        .split("|SPLIT|")
        .map(x => x.trim())
        .filter(Boolean);
      out.push(...parts);
    });
    return out;
  }

  function chunkWords(sentence, maxWords) {
    const words = sentence.split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) return [sentence.trim()];
    const chunks = [];
    let buf = [];
    words.forEach(w => {
      buf.push(w);
      if (buf.length >= maxWords || /[,;:!?।]$/.test(w)) {
        chunks.push(buf.join(" "));
        buf = [];
      }
    });
    if (buf.length) chunks.push(buf.join(" "));
    return chunks;
  }

  function splitScenes(raw, aspect) {
    const maxWords = aspect === "16:9" ? 9 : 7;
    const pieces = [];
    splitSentences(raw).forEach(s => pieces.push(...chunkWords(s, maxWords)));
    const scenes = [];
    let carry = "";
    pieces.forEach(p => {
      p = p.trim();
      if (!p) return;
      const count = p.split(/\s+/).length;
      if (count <= 2 && carry) {
        carry = `${carry} ${p}`.trim();
        scenes.push(carry); carry = "";
      } else if (count <= 2) {
        carry = p;
      } else {
        if (carry) { scenes.push(carry); carry = ""; }
        scenes.push(p);
      }
    });
    if (carry) scenes.push(carry);
    return scenes.slice(0, 14).map(s => s.replace(/^[-–—•]+\s*/, "").trim()).filter(Boolean);
  }

  function parseMods() {
    const value = ($("#videoEditPrompt")?.value || "").toLowerCase();
    return {
      bigger: /big|bigger|large|larger|text bada|font/i.test(value),
      slower: /slow|slower|धीरे|dheere/i.test(value),
      faster: /fast|faster|speed/i.test(value),
      yellow: /yellow|highlight|हाइलाइट/i.test(value),
      dark: /dark|darker|black/i.test(value),
      minimal: /minimal|clean|simple/i.test(value),
      premium: /premium|luxury|gold|rich/i.test(value)
    };
  }

  function setRatio(aspect) {
    const wrap = $("#videoFrameWrap");
    if (!wrap) return;
    wrap.classList.remove("ratio-916", "ratio-169", "ratio-11", "ratio-45", "ratio-34", "ratio-23", "ratio-219");
    const map = { "9:16": "ratio-916", "16:9": "ratio-169", "1:1": "ratio-11", "4:5": "ratio-45", "3:4": "ratio-34", "2:3": "ratio-23", "21:9": "ratio-219" };
    wrap.classList.add(map[aspect] || "ratio-916");
  }

  function keywordize(text, style) {
    const words = String(text).split(/\s+/).filter(Boolean);
    return words.map((word, i) => {
      const clean = word.replace(/[.,!?।:;"']/g, "");
      const key = clean.length >= 6 || i === words.length - 1 || /^[A-Z]/.test(clean) || /AI|YouTube|Shorts|Pro|SEO/i.test(clean);
      const cls = key ? "word kw" : "word";
      return `<span class="${cls}" style="--i:${i}">${escapeHtml(word)}</span>`;
    }).join(" ");
  }

  function styleDecor(style) {
    const decor = {
      "viral-hook": `<div class="ghost g1">KINETIC TYPE • STRONG HOOK • VIRAL SHORTS</div><div class="ghost g2">BOLD WORDS • FAST CUTS • RETENTION</div><i class="slash s1"></i><i class="slash s2"></i>`,
      "typography-premium": `<div class="ghost g1">TYPOGRAPHY • MOTION DESIGN • PREMIUM</div><div class="ghost g2">CLEAN TYPE • STRONG COMPOSITION</div><i class="rule r1"></i><i class="rule r2"></i><i class="orb o1"></i>`,
      "clean-minimal": `<i class="min-line l1"></i><i class="min-line l2"></i><i class="min-dot d1"></i><i class="min-dot d2"></i>`,
      "neon-cyber": `<div class="grid"></div><i class="laser l1"></i><i class="laser l2"></i><i class="cy-dot d1"></i><i class="cy-dot d2"></i><div class="terminal">SYSTEM ONLINE</div>`,
      motivation: `<i class="blob b1"></i><i class="blob b2"></i><i class="blob b3"></i><div class="rays"></div>`,
      podcast: `<div class="mic"><i></i><i></i><i></i></div><div class="pod-card">PODCAST CLIP</div><div class="soundbars"><i></i><i></i><i></i><i></i></div>`,
      news: `<div class="ticker">BREAKING NEWS • SHORTSCRAFT LIVE • VIRAL UPDATE</div><div class="news-box"></div><div class="news-grid"></div>`,
      horror: `<div class="moon"></div><div class="fog f1"></div><div class="fog f2"></div><div class="case">CASE FILE // 09</div><div class="scratch"></div>`,
      luxury: `<div class="gold-line gl1"></div><div class="gold-line gl2"></div><div class="crest">◆</div><div class="lux-grid"></div>`,
      "social-pop": `<i class="pop p1"></i><i class="pop p2"></i><i class="pop p3"></i><i class="pop p4"></i><div class="emoji e1">✦</div><div class="emoji e2">●</div>`,
      documentary: `<div class="letter top"></div><div class="letter bottom"></div><div class="grain"></div><div class="timecode">REC 00:12:08</div><div class="docline"></div>`,
      "tech-blueprint": `<div class="bluegrid"></div><div class="hud h1"></div><div class="hud h2"></div><svg class="circuit" viewBox="0 0 100 100"><path d="M5 70 L35 70 L35 45 L70 45 L70 20 L95 20"/></svg>`,
      gaming: `<div class="crosshair"></div><div class="hudbar top">PLAYER 01</div><div class="hudbar bottom">COMBO READY</div><i class="angle a1"></i><i class="angle a2"></i>`,
      classroom: `<div class="paper-grid"></div><div class="note n1">TIP</div><div class="note n2">LEARN</div><i class="draw d1"></i><i class="draw d2"></i>`,
      vhs: `<div class="scan"></div><div class="vhs-frame"></div><div class="rec">● REC</div><div class="tape">TAPE A-07</div><div class="noise"></div>`,
      startup: `<div class="dash-card c1"></div><div class="dash-card c2"></div><div class="dash-card c3"></div><div class="kpi">+42%</div><div class="saas-grid"></div>`
    };
    return decor[style] || decor["viral-hook"];
  }

  function sceneClass(style, index) {
    const variants = ["center", "left", "right", "bottom", "top", "center"];
    if (style === "podcast") return "bottom subtitle";
    if (style === "news") return index % 2 ? "left news-text" : "center news-text";
    if (style === "gaming") return index % 2 ? "right punch" : "left punch";
    if (style === "startup") return index % 2 ? "right carded" : "left carded";
    if (style === "documentary") return "bottom subtitle";
    if (style === "horror") return index % 2 ? "left eerie" : "center eerie";
    if (style === "viral-hook" || style === "typography-premium") return variants[index % variants.length] + " kinetic";
    return variants[index % variants.length];
  }

  function buildScenesMarkup(scenes, style) {
    return scenes.map((scene, i) => `
      <section class="scene ${sceneClass(style, i)}" data-scene="${i}">
        <div class="copy">
          <div class="eyebrow">${String(i + 1).padStart(2, "0")} / ${String(scenes.length).padStart(2, "0")}</div>
          <div class="main-text">${keywordize(scene, style)}</div>
        </div>
      </section>`).join("");
  }

  function css() {
    return `
*{box-sizing:border-box;margin:0;padding:0}html,body{width:100%;height:100%;overflow:hidden}body{font-family:Inter,"Noto Sans Devanagari","Nirmala UI",Mangal,Arial,sans-serif;background:#05050a;color:#fff;-webkit-font-smoothing:antialiased}.video{position:fixed;inset:0;overflow:hidden;isolation:isolate;background:#090910}.decor{position:absolute;inset:0;z-index:1;pointer-events:none}.scene{position:absolute;inset:0;z-index:3;display:flex;align-items:center;justify-content:center;padding:8vh 8vw;opacity:0;visibility:hidden;transform:translateY(18px) scale(.985);transition:opacity .42s ease,transform .42s ease,visibility .42s}.scene.active{opacity:1;visibility:visible;transform:translateY(0) scale(1)}.scene.left{justify-content:flex-start;text-align:left}.scene.right{justify-content:flex-end;text-align:right}.scene.top{align-items:flex-start}.scene.bottom{align-items:flex-end}.copy{max-width:min(88vw,980px);position:relative;z-index:5}.eyebrow{font:900 clamp(11px,1.7vw,24px)/1 Inter,sans-serif;letter-spacing:.18em;text-transform:uppercase;opacity:.62;margin-bottom:1.5vh}.main-text{font-weight:1000;font-size:var(--fs,clamp(34px,7.8vw,122px));line-height:.92;letter-spacing:-.055em;text-wrap:balance}.word{display:inline-block;opacity:0;transform:translateY(46px) scale(.92);filter:blur(8px);animation:wordIn var(--wordDur,.72s) cubic-bezier(.19,1,.22,1) forwards;animation-delay:calc(var(--i)*70ms + 80ms);margin:.02em .035em}.kw{color:var(--accent,#ffb02e);text-shadow:0 0 24px color-mix(in srgb,var(--accent,#ffb02e) 38%,transparent)}.progress{position:absolute;left:6%;right:6%;bottom:3.4%;height:5px;background:rgba(255,255,255,.14);border-radius:999px;z-index:10;overflow:hidden}.progress i{display:block;width:0;height:100%;background:linear-gradient(90deg,#ff3d6e,#ffb02e,#00f5ff);animation:progress var(--hold,3600ms) linear forwards}.dots{position:absolute;left:50%;bottom:5.2%;transform:translateX(-50%);display:flex;gap:8px;z-index:11}.dots i{width:8px;height:8px;border-radius:99px;background:rgba(255,255,255,.28)}.dots i.on{background:var(--accent,#ffb02e);box-shadow:0 0 16px var(--accent,#ffb02e)}.watermark{position:absolute;right:6%;bottom:6.4%;z-index:10;font:800 clamp(8px,1.3vw,17px)/1 Inter,sans-serif;letter-spacing:.08em;color:rgba(255,255,255,.36)}.flash{position:absolute;inset:0;z-index:12;pointer-events:none;opacity:0;background:#fff}.flash.hit{animation:flash .2s ease}.mod-bigger{--fs:clamp(42px,9.6vw,150px)}.mod-slower{--wordDur:1.05s}.mod-faster{--wordDur:.42s}.mod-yellow .kw{background:#FFD60A;color:#111;text-shadow:none;padding:.03em .13em;border-radius:.16em}.mod-dark .video{filter:brightness(.78) contrast(1.08)}@keyframes wordIn{to{opacity:1;transform:translateY(0) scale(1);filter:blur(0)}}@keyframes progress{to{width:100%}}@keyframes flash{0%,100%{opacity:0}45%{opacity:.12}}

/* Premium Typography / Viral */
.style-viral-hook,.style-typography-premium{--accent:#111;background:#f3eee4;color:#101010}.style-viral-hook .video,.style-typography-premium .video{background:radial-gradient(circle at 20% 12%,#fff 0 8%,transparent 30%),linear-gradient(135deg,#f8f2e7,#eee7dc)}.style-viral-hook .main-text,.style-typography-premium .main-text{font-family:"Arial Black",Impact,Inter,sans-serif;text-transform:uppercase;color:#111;text-shadow:none}.style-viral-hook .kw,.style-typography-premium .kw{color:#111;background:#111;color:#f8f2e7;padding:.02em .11em;border-radius:.13em}.ghost{position:absolute;left:-12%;width:130%;white-space:nowrap;font:1000 9vw/.8 "Arial Black";letter-spacing:-.06em;color:rgba(0,0,0,.045);text-transform:uppercase}.g1{top:11%;transform:rotate(-8deg);animation:ghostMove 18s linear infinite}.g2{bottom:12%;transform:rotate(7deg);animation:ghostMove2 20s linear infinite}.slash{position:absolute;width:28%;height:12px;border-radius:99px;background:#111;opacity:.12;transform:rotate(-12deg)}.slash.s1{left:-8%;top:23%}.slash.s2{right:-10%;bottom:24%}.rule{position:absolute;height:1px;background:rgba(0,0,0,.12);left:8%;right:8%}.r1{top:9%}.r2{bottom:9%}.orb{position:absolute;width:28%;aspect-ratio:1;border-radius:50%;right:-8%;top:12%;background:rgba(0,0,0,.035)}@keyframes ghostMove{to{transform:translateX(-180px) rotate(-8deg)}}@keyframes ghostMove2{to{transform:translateX(180px) rotate(7deg)}}

/* Clean Minimal */
.style-clean-minimal .video{background:#fff;color:#111}.style-clean-minimal .main-text{font-weight:900;letter-spacing:-.045em;color:#111;text-shadow:0 14px 28px rgba(0,0,0,.12)}.style-clean-minimal .kw{color:#111;text-shadow:none}.min-line{position:absolute;height:1px;width:48%;background:rgba(0,0,0,.08);transform:rotate(-8deg)}.min-line.l1{top:23%;left:8%}.min-line.l2{bottom:22%;right:8%}.min-dot{position:absolute;width:10%;aspect-ratio:1;border-radius:50%;border:1px solid rgba(0,0,0,.08)}.min-dot.d1{right:12%;top:12%}.min-dot.d2{left:10%;bottom:16%}.style-clean-minimal .eyebrow,.style-startup .eyebrow{color:#111}

/* Neon */
.style-neon-cyber .video{background:radial-gradient(circle at 80% 25%,rgba(180,79,255,.22),transparent 30%),radial-gradient(circle at 20% 70%,rgba(0,245,255,.15),transparent 34%),#02030a;color:#cfffff}.style-neon-cyber{--accent:#00f5ff}.style-neon-cyber .main-text{color:#dfffff;text-shadow:0 0 18px #00f5ff,0 0 42px rgba(180,79,255,.7);text-transform:uppercase}.grid,.bluegrid{position:absolute;inset:0;background-image:linear-gradient(rgba(0,245,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(180,79,255,.06) 1px,transparent 1px);background-size:44px 44px;opacity:.55}.laser{position:absolute;height:2px;width:120%;background:linear-gradient(90deg,transparent,#00f5ff,#b44fff,transparent);filter:blur(.2px);opacity:.65}.laser.l1{top:28%;left:-10%;transform:rotate(-12deg)}.laser.l2{bottom:22%;left:-10%;transform:rotate(10deg)}.cy-dot{position:absolute;width:8px;height:8px;border-radius:50%;background:#00f5ff;box-shadow:0 0 22px #00f5ff}.cy-dot.d1{left:18%;top:21%}.cy-dot.d2{right:18%;bottom:25%}.terminal{position:absolute;left:6%;top:6%;font:800 14px monospace;color:#00f5ff;opacity:.7}

/* Motivation */
.style-motivation .video{background:linear-gradient(145deg,#ffd36a 0%,#ff7a18 42%,#f72555 100%);color:white}.style-motivation{--accent:#fff}.style-motivation .main-text{text-transform:uppercase;text-shadow:0 16px 34px rgba(0,0,0,.26)}.style-motivation .word{animation-name:bounceWord}.blob{position:absolute;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.12);border-radius:28px;transform:rotate(14deg)}.b1{width:22%;height:9%;right:8%;top:16%}.b2{width:26%;height:8%;right:-8%;bottom:26%}.b3{width:12%;height:12%;left:12%;bottom:18%;border-radius:50%}.rays{position:absolute;inset:-20%;background:repeating-linear-gradient(115deg,rgba(255,255,255,.08) 0 2px,transparent 2px 28px);opacity:.35}@keyframes bounceWord{0%{opacity:0;transform:translateY(60px) scale(.76)}65%{opacity:1;transform:translateY(-5px) scale(1.05);filter:blur(0)}100%{opacity:1;transform:translateY(0) scale(1);filter:blur(0)}}

/* Podcast */
.style-podcast .video{background:#141414;color:#fff}.style-podcast{--accent:#FFD60A}.style-podcast .scene{align-items:flex-end;padding-bottom:18vh}.style-podcast .copy{background:rgba(0,0,0,.72);border:1px solid rgba(255,255,255,.13);border-radius:28px;padding:28px 34px;box-shadow:0 24px 60px rgba(0,0,0,.36);max-width:90%}.style-podcast .main-text{font-size:clamp(28px,5.3vw,78px);line-height:1.08;text-align:center}.style-podcast .kw{color:#FFD60A;text-shadow:none}.mic{position:absolute;left:50%;top:18%;width:180px;height:180px;border-radius:50%;transform:translateX(-50%);border:2px solid rgba(255,214,10,.25);display:grid;place-items:center}.mic:before{content:"";width:62px;height:104px;border-radius:40px;background:#FFD60A;box-shadow:0 0 40px rgba(255,214,10,.35)}.pod-card{position:absolute;left:8%;top:7%;font:900 14px Inter;color:#FFD60A;letter-spacing:.18em}.soundbars{position:absolute;right:9%;top:15%;display:flex;gap:8px;align-items:end}.soundbars i{width:9px;background:#FFD60A;border-radius:99px;animation:bar 1s ease-in-out infinite alternate}.soundbars i:nth-child(1){height:35px}.soundbars i:nth-child(2){height:76px}.soundbars i:nth-child(3){height:50px}.soundbars i:nth-child(4){height:96px}@keyframes bar{to{transform:scaleY(.45);opacity:.45}}

/* News */
.style-news .video{background:#f7f7f7;color:#111}.style-news{--accent:#e50914}.style-news .main-text{font-family:Georgia,"Times New Roman",serif;font-weight:1000;color:#111;line-height:.98}.style-news .kw{background:#e50914;color:#fff;text-shadow:none;padding:.01em .1em}.ticker{position:absolute;left:0;right:0;top:0;height:74px;background:#e50914;color:#fff;display:flex;align-items:center;padding-left:5%;font:1000 22px Inter;letter-spacing:.12em}.news-box{position:absolute;left:7%;right:7%;bottom:8%;height:120px;border-top:5px solid #111;border-bottom:1px solid rgba(0,0,0,.15)}.news-grid{position:absolute;inset:0;background:linear-gradient(90deg,transparent 49%,rgba(0,0,0,.04) 50%,transparent 51%);background-size:120px 100%;opacity:.4}

/* Horror */
.style-horror .video{background:radial-gradient(circle at 72% 18%,rgba(255,255,255,.16),transparent 7%),radial-gradient(circle at 50% 50%,rgba(139,0,0,.18),transparent 38%),#030303;color:#f0dede}.style-horror{--accent:#8B0000}.style-horror .main-text{font-family:Georgia,serif;color:#ead7d7;text-shadow:0 0 24px #8B0000;animation:flicker 3s infinite}.style-horror .kw{color:#ff3333}.moon{position:absolute;right:12%;top:12%;width:90px;height:90px;border-radius:50%;background:rgba(255,255,255,.22);filter:blur(1px)}.fog{position:absolute;left:-20%;right:-20%;height:18%;background:rgba(255,255,255,.06);filter:blur(30px);animation:fog 8s linear infinite}.f1{bottom:18%}.f2{top:40%;animation-duration:11s}.case{position:absolute;left:7%;top:6%;font:800 14px monospace;color:#8B0000}.scratch{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.025) 0 1px,transparent 1px 5px)}@keyframes fog{to{transform:translateX(18%)}}@keyframes flicker{0%,95%,100%{opacity:1}96%{opacity:.45}97%{opacity:.92}98%{opacity:.32}}

/* Luxury */
.style-luxury .video{background:radial-gradient(circle at 50% 30%,rgba(212,175,55,.14),transparent 36%),#050403;color:#f8e7a1}.style-luxury{--accent:#D4AF37}.style-luxury .main-text{font-family:Georgia,"Times New Roman",serif;font-weight:700;letter-spacing:-.035em;color:#f6e6a8;text-shadow:0 0 22px rgba(212,175,55,.35)}.gold-line{position:absolute;height:1px;width:80%;background:linear-gradient(90deg,transparent,#D4AF37,transparent);opacity:.55}.gl1{top:22%;left:10%;transform:rotate(-10deg)}.gl2{bottom:20%;left:10%;transform:rotate(-10deg)}.crest{position:absolute;top:11%;left:50%;transform:translateX(-50%);font-size:50px;color:#D4AF37}.lux-grid{position:absolute;inset:0;background:repeating-linear-gradient(115deg,rgba(212,175,55,.06) 0 1px,transparent 1px 28px)}

/* Social */
.style-social-pop .video{background:linear-gradient(135deg,#7c3aed,#ec4899 55%,#fb7185);color:white}.style-social-pop{--accent:#fff}.style-social-pop .main-text{text-shadow:0 16px 30px rgba(0,0,0,.22)}.style-social-pop .word{animation-name:bounceWord}.pop{position:absolute;border-radius:40%;background:rgba(255,255,255,.18);filter:blur(.2px);animation:float 5s ease-in-out infinite}.p1{width:28%;height:20%;left:7%;top:12%}.p2{width:22%;height:17%;right:8%;bottom:12%}.p3{width:14%;height:14%;right:14%;top:18%}.p4{width:16%;height:16%;left:12%;bottom:20%}.emoji{position:absolute;font-size:55px;color:rgba(255,255,255,.35)}.e1{right:18%;top:22%}.e2{left:19%;bottom:28%}@keyframes float{50%{transform:translateY(-22px) rotate(8deg)}}

/* Documentary */
.style-documentary .video{background:#050505;color:#eee}.style-documentary .main-text{font-family:Inter,sans-serif;font-size:clamp(28px,5.1vw,80px);line-height:1.12;text-shadow:0 0 28px rgba(255,255,255,.4)}.style-documentary{--accent:#e6e1d8}.letter{position:absolute;left:0;right:0;height:13%;background:#000;z-index:2}.letter.top{top:0}.letter.bottom{bottom:0}.grain,.noise,.scan{position:absolute;inset:0;opacity:.14;background:repeating-linear-gradient(0deg,rgba(255,255,255,.05) 0 1px,transparent 1px 3px)}.timecode{position:absolute;left:7%;top:16%;font:800 14px monospace;color:#ddd}.docline{position:absolute;left:7%;right:7%;bottom:17%;height:1px;background:rgba(255,255,255,.22)}

/* Tech */
.style-tech-blueprint .video{background:radial-gradient(circle at 50% 60%,rgba(0,245,255,.14),transparent 35%),#071522;color:#dffcff}.style-tech-blueprint{--accent:#00f5ff}.style-tech-blueprint .main-text{text-transform:uppercase;text-shadow:0 0 24px #00f5ff}.hud{position:absolute;border:1px solid rgba(0,245,255,.25);border-radius:20px}.h1{left:8%;top:12%;width:28%;height:13%}.h2{right:8%;bottom:14%;width:38%;height:16%}.circuit{position:absolute;inset:0;width:100%;height:100%;opacity:.38}.circuit path{fill:none;stroke:#00f5ff;stroke-width:.4;stroke-dasharray:4 2}

/* Gaming */
.style-gaming .video{background:radial-gradient(circle at 76% 24%,rgba(255,48,86,.28),transparent 32%),radial-gradient(circle at 20% 78%,rgba(0,245,255,.18),transparent 32%),#090914;color:#fff}.style-gaming{--accent:#ff3056}.style-gaming .main-text{font-family:"Arial Black",Impact,Inter,sans-serif;text-transform:uppercase;font-style:italic;text-shadow:5px 5px 0 #000,0 0 28px #ff3056}.crosshair{position:absolute;left:50%;top:50%;width:220px;height:220px;border:2px solid rgba(255,255,255,.16);border-radius:50%;transform:translate(-50%,-50%)}.crosshair:before,.crosshair:after{content:"";position:absolute;background:rgba(255,255,255,.16)}.crosshair:before{left:50%;top:-50px;width:2px;height:320px}.crosshair:after{top:50%;left:-50px;height:2px;width:320px}.hudbar{position:absolute;padding:12px 20px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.42);font:900 14px Inter}.hudbar.top{left:6%;top:6%}.hudbar.bottom{right:6%;bottom:7%}.angle{position:absolute;width:30%;height:18%;border:4px solid #ff3056;opacity:.38}.angle.a1{left:-4%;top:20%;border-right:0}.angle.a2{right:-4%;bottom:20%;border-left:0}

/* Classroom */
.style-classroom .video{background:#f7fbff;color:#0f172a}.style-classroom{--accent:#2563eb}.style-classroom .main-text{color:#0f172a;text-shadow:0 10px 20px rgba(15,23,42,.13)}.style-classroom .kw{color:#2563eb}.paper-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(37,99,235,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(37,99,235,.08) 1px,transparent 1px);background-size:44px 44px}.note{position:absolute;background:#fde68a;color:#111;padding:14px 18px;border-radius:8px;box-shadow:0 14px 28px rgba(0,0,0,.08);font:900 15px Inter;transform:rotate(-6deg)}.n1{left:10%;top:14%}.n2{right:10%;bottom:18%;transform:rotate(7deg)}.draw{position:absolute;height:3px;background:#2563eb;opacity:.18;border-radius:99px}.draw.d1{width:42%;left:9%;bottom:24%;transform:rotate(-8deg)}.draw.d2{width:36%;right:10%;top:29%;transform:rotate(7deg)}

/* VHS */
.style-vhs .video{background:linear-gradient(135deg,#2b0828,#092c33);color:#dff}.style-vhs{--accent:#ff4fd8}.style-vhs .main-text{text-transform:uppercase;font-family:monospace;text-shadow:2px 0 #ff4fd8,-2px 0 #00e5ff,0 0 18px #fff}.vhs-frame{position:absolute;inset:6%;border:1px solid rgba(255,255,255,.24);box-shadow:inset 0 0 80px rgba(0,0,0,.55)}.rec,.tape{position:absolute;top:7%;font:900 14px monospace;color:#fff}.rec{left:7%;color:#ff4f6d}.tape{right:7%;color:#bff}.scan{background:repeating-linear-gradient(0deg,rgba(255,255,255,.08) 0 1px,transparent 1px 5px);opacity:.22}.noise{background:repeating-radial-gradient(circle,rgba(255,255,255,.12) 0 1px,transparent 1px 4px);opacity:.08}

/* Startup */
.style-startup .video{background:#f8fbff;color:#111}.style-startup{--accent:#16a34a}.style-startup .copy{background:rgba(255,255,255,.86);border:1px solid rgba(15,23,42,.08);border-radius:28px;padding:34px;box-shadow:0 28px 80px rgba(15,23,42,.12)}.style-startup .main-text{font-size:clamp(30px,5.8vw,86px);color:#0f172a}.style-startup .kw{color:#16a34a;text-shadow:none}.saas-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(15,23,42,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(15,23,42,.05) 1px,transparent 1px);background-size:50px 50px}.dash-card{position:absolute;background:white;border:1px solid rgba(15,23,42,.08);border-radius:20px;box-shadow:0 20px 50px rgba(15,23,42,.1)}.c1{left:8%;top:12%;width:32%;height:12%}.c2{right:8%;top:20%;width:26%;height:18%}.c3{left:10%;bottom:14%;width:38%;height:14%}.kpi{position:absolute;right:12%;bottom:17%;font:1000 42px Inter;color:#16a34a}

.aspect-wide .main-text{font-size:var(--fs,clamp(30px,5.4vw,92px))}.aspect-wide .scene{padding:8vh 10vw}.aspect-square .main-text{font-size:clamp(30px,7vw,90px)}
`;
  }

  function buildVideoHtml(style, scenes, aspect, mods) {
    if (mods.minimal) style = "clean-minimal";
    if (mods.premium) style = "luxury";
    const hold = mods.slower ? 5200 : mods.faster ? 2400 : 3600;
    const aspectClass = aspect === "16:9" || aspect === "21:9" ? "aspect-wide" : aspect === "1:1" ? "aspect-square" : "aspect-portrait";
    const modClasses = [mods.bigger && "mod-bigger", mods.slower && "mod-slower", mods.faster && "mod-faster", mods.yellow && "mod-yellow", mods.dark && "mod-dark"].filter(Boolean).join(" ");
    const dots = scenes.map((_, i) => `<i ${i === 0 ? 'class="on"' : ""}></i>`).join("");
    const safeStyle = style in STYLE_NAMES ? style : "viral-hook";
    const jsScenes = JSON.stringify(scenes);
    return `<!doctype html><html lang="hi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ShortsCraft Preview</title><style>${css()}</style></head><body class="style-${safeStyle} ${aspectClass} ${modClasses}" style="--hold:${hold}ms"><main class="video"><div class="decor">${styleDecor(safeStyle)}</div>${buildScenesMarkup(scenes, safeStyle)}<div class="progress"><i></i></div><div class="dots">${dots}</div><div class="watermark">shortscraft.online</div><div class="flash"></div></main><script>
(function(){
const scenes=[...document.querySelectorAll('.scene')];
const dots=[...document.querySelectorAll('.dots i')];
const bar=document.querySelector('.progress i');
const flash=document.querySelector('.flash');
const HOLD=${hold};
let i=0;
function restartWords(scene){scene.querySelectorAll('.word').forEach(w=>{w.style.animation='none';void w.offsetWidth;w.style.animation='';});}
function show(n){scenes.forEach((s,k)=>s.classList.toggle('active',k===n));dots.forEach((d,k)=>d.classList.toggle('on',k===n));if(bar){bar.style.animation='none';void bar.offsetWidth;bar.style.animation='progress '+HOLD+'ms linear forwards';}if(flash){flash.classList.remove('hit');void flash.offsetWidth;flash.classList.add('hit');}restartWords(scenes[n]);}
show(0);
if(scenes.length>1){setInterval(()=>{i=(i+1)%scenes.length;show(i)},HOLD);}
})();<\/script></body></html>`;
  }

  function renderVideo({ deduct = false } = {}) {
    const input = $("#videoScriptInput");
    const raw = input?.value?.trim() || "";
    if (raw.length < 2) { toast("Paste or generate a script first.", "error"); input?.focus(); return; }
    if (deduct && !deductCredit()) return;
    const style = $("#videoStyleSelect")?.value || "viral-hook";
    const aspect = $("#videoAspectSelect")?.value || "9:16";
    const mods = parseMods();
    const scenes = splitScenes(raw, aspect);
    if (!scenes.length) { toast("Script could not be parsed.", "error"); return; }
    setRatio(aspect);
    const html = buildVideoHtml(style, scenes, aspect, mods);
    VIDEO_STATE.html = html; VIDEO_STATE.scenes = scenes; VIDEO_STATE.style = style; VIDEO_STATE.aspect = aspect;
    const frame = $("#videoPreviewFrame");
    if (frame) {
      frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
      frame.srcdoc = html;
    }
    $("#videoEmptyState")?.classList.add("hidden");
    const status = $("#videoPreviewStatus"); if (status) status.textContent = "Preview ready";
    setTimeout(() => ($(".video-preview-card") || $("#videoFrameWrap"))?.scrollIntoView({ behavior: "smooth", block: "center" }), 90);
    toast(`${STYLE_NAMES[(mods.premium ? "luxury" : mods.minimal ? "clean-minimal" : style)] || "Video"} ready — ${scenes.length} scenes`, "success");
  }

  function bindVideoEngine() {
    setCredits(normalizeCredits());
    setRatio($("#videoAspectSelect")?.value || "9:16");

    const gen = $("#generateVideoBtn");
    if (gen) gen.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); renderVideo({ deduct: true }); }, true);

    const apply = $("#applyVideoEditBtn");
    if (apply) apply.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); renderVideo({ deduct: false }); }, true);

    const resetEdit = $("#resetVideoEditBtn");
    if (resetEdit) resetEdit.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); const p = $("#videoEditPrompt"); if (p) p.value = ""; if ($("#videoPreviewFrame")?.srcdoc) renderVideo({ deduct: false }); }, true);

    $$(".quick-edit-chips button").forEach(chip => {
      chip.addEventListener("click", e => {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        const p = $("#videoEditPrompt");
        const val = (chip.dataset.edit || chip.textContent || "").trim();
        if (p) p.value = p.value.trim() ? `${p.value.trim()}, ${val}` : val;
        if ($("#videoScriptInput")?.value.trim()) renderVideo({ deduct: false });
      }, true);
    });

    const styleSel = $("#videoStyleSelect");
    if (styleSel) styleSel.addEventListener("change", () => { if ($("#videoPreviewFrame")?.srcdoc && $("#videoScriptInput")?.value.trim()) renderVideo({ deduct: false }); });

    const aspectSel = $("#videoAspectSelect");
    if (aspectSel) aspectSel.addEventListener("change", () => { setRatio(aspectSel.value); if ($("#videoPreviewFrame")?.srcdoc && $("#videoScriptInput")?.value.trim()) renderVideo({ deduct: false }); });

    const copy = $("#copyVideoHtmlBtn");
    if (copy) copy.addEventListener("click", async e => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); if (!VIDEO_STATE.html) { toast("Generate a video first.", "error"); return; } try { await navigator.clipboard.writeText(VIDEO_STATE.html); toast("HTML copied!", "success"); } catch { toast("Copy failed.", "error"); } }, true);

    const open = $("#openVideoPreviewBtn");
    if (open) open.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); if (!VIDEO_STATE.html) { toast("Generate a video first.", "error"); return; } const w = window.open("", "_blank"); if (w) { w.document.open(); w.document.write(VIDEO_STATE.html); w.document.close(); } }, true);

    const reset = $("#resetVideoBtn");
    if (reset) reset.addEventListener("click", e => {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      const input = $("#videoScriptInput"); if (input) input.value = "";
      const edit = $("#videoEditPrompt"); if (edit) edit.value = "";
      const frame = $("#videoPreviewFrame"); if (frame) frame.srcdoc = "";
      VIDEO_STATE.html = "";
      $("#videoEmptyState")?.classList.remove("hidden");
      const status = $("#videoPreviewStatus"); if (status) status.textContent = "No video generated yet";
      toast("Reset complete.", "info");
    }, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindVideoEngine);
  else bindVideoEngine();
})();

})();
