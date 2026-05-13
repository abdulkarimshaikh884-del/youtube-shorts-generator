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
   VIDEO GENERATOR — Premium Animated HTML preview  (v3 — FIXED)
   ------------------------------------------------------------
   ✦ Properly strips [HOOK]/[MAIN]/[CTA]/Scene labels
   ✦ Splits script into clean readable scenes (1–2 lines, ≤9 words)
   ✦ NEVER breaks words mid-letter (word-break:keep-all)
   ✦ Font sizes auto-scale to iframe container (cqw + clamp)
   ✦ Premium animated gradients, particles, progress bar, watermark
   ✦ Supports all dropdown styles, 9:16 + others
   ============================================================ */
const VIDEO_STATE = {
  mode: "paste",
  html: "",
  script: "",
  style: "viral-hook",
  aspect: "9:16",
  edit: { fontScale: 1, speed: 1, highlight: "", bgMode: "auto", align: "center", dense: true, minimal: false, premium: false }
};

/* ---------- Helper: escape HTML for iframe content ---------- */
function escapeHtmlV(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- Helper: clean script — remove labels & markdown ---------- */
function cleanScriptForVideo(raw) {
  if (!raw) return "";
  let s = String(raw);

  // Strip code fences / markdown bold/italic / headings
  s = s.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/^#{1,6}\s+/gm, "");
  s = s.replace(/\*\*(.+?)\*\*/g, "$1");
  s = s.replace(/\*(.+?)\*/g, "$1");
  s = s.replace(/__(.+?)__/g, "$1");
  s = s.replace(/_(.+?)_/g, "$1");

  // Strip section markers like === SCRIPT ===
  s = s.replace(/={2,}\s*[A-Z][A-Z\s]+={2,}/g, "\n");

  // Strip bracket labels: [HOOK] [MAIN] [CTA] [Intro] [Outro] [Scene 1] ...
  s = s.replace(/\[\s*(HOOK|MAIN|CTA|INTRO|OUTRO|BODY|END|START|TITLE|VOICEOVER|VO|NARRATOR|SCENE\s*\d*|PART\s*\d*|STEP\s*\d*|SHOT\s*\d*|CAPTION)\s*\]\s*:?/gi, "\n");

  // Strip "HOOK:", "MAIN:", "CTA:", "Scene 1:", "Scene 1 -", "Part 2 -" line prefixes
  s = s.replace(/^\s*(HOOK|MAIN|CTA|INTRO|OUTRO|BODY|TITLE|VOICEOVER|VO|NARRATOR|CAPTION)\s*[:\-–—]\s*/gim, "");
  s = s.replace(/^\s*(SCENE|PART|STEP|SHOT|CHAPTER)\s*\d+\s*[:\-–—]?\s*/gim, "");
  s = s.replace(/^\s*\d+\s*[).:\-–—]\s+/gm, ""); // "1. ", "1) "

  // Strip parenthetical stage directions (smile), (pause), (camera zoom)
  s = s.replace(/\(([^)]{1,40})\)/g, (m, inner) => {
    // keep if it looks like real content, drop if it looks like a direction
    if (/^(pause|smile|laugh|camera|zoom|cut|music|sfx|beat|silence|fade|transition|narrator|voice)/i.test(inner)) return " ";
    return m;
  });

  // Bullets and arrows → newline
  s = s.replace(/[•▪▫➜►▶►→·]/g, "\n");

  // Normalize whitespace
  s = s.replace(/\r/g, "\n");
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/\n{2,}/g, "\n");
  s = s.split("\n").map(l => l.trim()).filter(Boolean).join("\n");

  return s.trim();
}

/* ---------- Helper: split clean script into scenes ---------- */
function splitScriptIntoScenes(rawScript, aspect = "9:16") {
  const cleaned = cleanScriptForVideo(rawScript);
  if (!cleaned) return [];

  // Limits per aspect
  const tall = ["9:16", "4:5", "3:4", "2:3"].includes(aspect);
  const wide = ["16:9", "21:9"].includes(aspect);
  const MAX_WORDS = tall ? 7 : wide ? 9 : 8;
  const MIN_WORDS = 2;
  const MAX_CHARS = tall ? 42 : wide ? 64 : 52;
  const HARD_LIMIT = 20;

  // 1. Pre-split by line break, then by sentence end (.,!,?,।) — keep punctuation
  const pieces = [];
  cleaned.split(/\n+/).forEach(line => {
    line = line.trim();
    if (!line) return;
    // Split on sentence boundaries but keep them
    const parts = line.split(/(?<=[.!?।])\s+/);
    parts.forEach(p => { p = p.trim(); if (p) pieces.push(p); });
  });

  // 2. For each piece — if too long, split by commas / semicolons; if still long, by word-budget without breaking words
  const scenes = [];
  pieces.forEach(piece => {
    const words = piece.split(/\s+/).filter(Boolean);
    if (!words.length) return;

    if (words.length <= MAX_WORDS && piece.length <= MAX_CHARS) {
      scenes.push(piece);
      return;
    }

    // Try splitting on comma / semicolon / dash boundaries
    const subParts = piece.split(/(?<=[,;—–-])\s+/).map(s => s.trim()).filter(Boolean);
    const queue = (subParts.length > 1) ? subParts : [piece];

    queue.forEach(sub => {
      const subWords = sub.split(/\s+/).filter(Boolean);
      if (subWords.length <= MAX_WORDS && sub.length <= MAX_CHARS) {
        scenes.push(sub);
        return;
      }
      // Word-budget split — NEVER cut a word in half
      let chunk = [];
      let chunkLen = 0;
      subWords.forEach(w => {
        const projected = chunkLen + (chunk.length ? 1 : 0) + w.length;
        if (chunk.length >= MAX_WORDS || projected > MAX_CHARS) {
          if (chunk.length) scenes.push(chunk.join(" "));
          chunk = [w];
          chunkLen = w.length;
        } else {
          chunk.push(w);
          chunkLen = projected;
        }
      });
      if (chunk.length) scenes.push(chunk.join(" "));
    });
  });

  // 3. Combine very-short fragments (≤ MIN_WORDS) with next/prev if possible
  const merged = [];
  for (let i = 0; i < scenes.length; i++) {
    const cur = scenes[i];
    const curWords = cur.split(/\s+/).length;
    if (curWords < MIN_WORDS && merged.length) {
      const prev = merged[merged.length - 1];
      const candidate = prev + " " + cur;
      if (candidate.split(/\s+/).length <= MAX_WORDS + 1 && candidate.length <= MAX_CHARS + 4) {
        merged[merged.length - 1] = candidate;
        continue;
      }
    }
    if (curWords < MIN_WORDS && i < scenes.length - 1) {
      const nxt = scenes[i + 1];
      const candidate = cur + " " + nxt;
      if (candidate.split(/\s+/).length <= MAX_WORDS + 1 && candidate.length <= MAX_CHARS + 4) {
        merged.push(candidate);
        i++;
        continue;
      }
    }
    merged.push(cur);
  }

  // 4. Tidy + cap
  return merged
    .map(s => s.replace(/^[-–—,;:.\s]+/, "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, HARD_LIMIT);
}

/* ---------- Helper: highlight keywords inside a scene line ---------- */
function highlightKeywords(line, accentClass = "hl", accent2Class = "hl2") {
  const HIGH = new Set([
    "ai","viral","secret","money","paise","best","top","now","stop","free","pro","hack","trick","boom","win",
    "no","why","how","never","always","must","today","new","biggest","fastest","easy","powerful","truth","warning"
  ]);
  const HIGH2 = new Set([
    "youtube","creator","content","shorts","reels","india","billion","million","lakh","crore",
    "instagram","tiktok","facebook","google","amazon","apple"
  ]);
  return line.split(/(\s+)/).map(tok => {
    if (/^\s+$/.test(tok)) return tok;
    const clean = tok.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    if (HIGH.has(clean))  return `<span class="${accentClass}">${escapeHtmlV(tok)}</span>`;
    if (HIGH2.has(clean)) return `<span class="${accent2Class}">${escapeHtmlV(tok)}</span>`;
    return escapeHtmlV(tok);
  }).join("");
}

/* ---------- Parse text edits like "yellow highlight, slower" ---------- */
function parseEdits(prompt) {
  const p = String(prompt || "").toLowerCase();
  const e = VIDEO_STATE.edit;
  if (/bigger|large|big|bada/.test(p)) e.fontScale = 1.18;
  if (/smaller|small|chhota/.test(p)) e.fontScale = 0.9;
  if (/slow/.test(p)) e.speed = 1.4;
  if (/fast/.test(p)) e.speed = 0.75;
  if (/yellow|gold/.test(p)) e.highlight = "#facc15";
  else if (/\bred\b|pink/.test(p)) e.highlight = "#fb7185";
  else if (/\bblue\b|cyan/.test(p)) e.highlight = "#38bdf8";
  else if (/\bgreen\b/.test(p)) e.highlight = "#22c55e";
  else if (/purple|violet/.test(p)) e.highlight = "#a78bfa";
  if (/dark|darker|black/.test(p)) e.bgMode = "dark";
  if (/light|white|bright/.test(p)) e.bgMode = "light";
  if (/minimal|simple|clean/.test(p)) e.minimal = true;
  if (/premium|luxury|professional/.test(p)) e.premium = true;
}
function resetEdits() {
  VIDEO_STATE.edit = { fontScale: 1, speed: 1, highlight: "", bgMode: "auto", align: "center", dense: true, minimal: false, premium: false };
}

/* ============================================================
   STYLE THEMES — each returns { bg, text, accent, accent2, font, decoHTML, extraCss, enterAnim }
   ============================================================ */
function getStyleTheme(styleKey) {
  const themes = {
    "viral-hook": {
      bg: "radial-gradient(circle at 30% 20%, #2a0010 0%, transparent 55%), radial-gradient(circle at 70% 80%, #1a0015 0%, transparent 55%), linear-gradient(160deg, #0a0008 0%, #15000a 50%, #08000d 100%)",
      text: "#ffffff", accent: "#ff3d6e", accent2: "#ffb02e",
      font: "'Inter','Arial Black',Impact,sans-serif", weight: 900,
      decoHTML: `
        <div class="orb orb1"></div><div class="orb orb2"></div>
        <div class="particles" id="parts"></div>`,
      extraCss: `
        .orb{position:absolute;border-radius:50%;filter:blur(40px);opacity:.35;animation:orbF 6s ease-in-out infinite}
        .orb1{width:55%;aspect-ratio:1;left:-15%;top:-10%;background:radial-gradient(circle,#ff0055,transparent 70%)}
        .orb2{width:50%;aspect-ratio:1;right:-15%;bottom:-15%;background:radial-gradient(circle,#ff8a00,transparent 70%);animation-delay:-3s}
        @keyframes orbF{0%,100%{transform:scale(1) translate(0,0);opacity:.3}50%{transform:scale(1.15) translate(3%,-3%);opacity:.55}}
        .scene-text .hl{color:#ff3d6e;text-shadow:0 0 18px rgba(255,61,110,.55)}
        .scene-text .hl2{color:#ffb02e;text-shadow:0 0 16px rgba(255,176,46,.45)}
      `,
      enter: "vh"
    },
    "neon-cyber": {
      bg: "#03060f",
      text: "#e8faff", accent: "#00f5ff", accent2: "#b44fff",
      font: "'Inter','Arial Black',sans-serif", weight: 900,
      decoHTML: `
        <div class="grid"></div><div class="scan"></div>
        <div class="orb orb1"></div><div class="orb orb2"></div>
        <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>`,
      extraCss: `
        .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(0,245,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(0,245,255,.05) 1px,transparent 1px);background-size:8% 8%}
        .scan{position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,245,255,.025) 2px,rgba(0,245,255,.025) 4px);animation:scan 8s linear infinite}
        @keyframes scan{from{background-position:0 0}to{background-position:0 60px}}
        .orb{position:absolute;width:55%;aspect-ratio:1;border-radius:50%;filter:blur(50px);opacity:.35}
        .orb1{left:-15%;top:-10%;background:radial-gradient(circle,#00f5ff,transparent 70%)}
        .orb2{right:-15%;bottom:-10%;background:radial-gradient(circle,#b44fff,transparent 70%)}
        .corner{position:absolute;width:8%;aspect-ratio:1;border-color:#00f5ff;border-style:solid;opacity:.65}
        .corner.tl{top:4%;left:4%;border-width:3px 0 0 3px}
        .corner.tr{top:4%;right:4%;border-width:3px 3px 0 0}
        .corner.bl{bottom:4%;left:4%;border-width:0 0 3px 3px}
        .corner.br{bottom:4%;right:4%;border-width:0 3px 3px 0}
        .scene-text{text-shadow:0 0 24px rgba(0,245,255,.55),0 0 60px rgba(0,245,255,.2)}
        .scene-text .hl{color:#00f5ff}
        .scene-text .hl2{color:#b44fff;text-shadow:0 0 24px rgba(180,79,255,.55)}
      `,
      enter: "neon"
    },
    "motivation": {
      bg: "linear-gradient(165deg,#100800 0%,#1a0e00 45%,#0a0500 100%)",
      text: "#ffffff", accent: "#ffcc00", accent2: "#ff8c00",
      font: "'Inter','Arial Black',sans-serif", weight: 900,
      decoHTML: `<div class="sun"></div><div class="stripe"></div>`,
      extraCss: `
        .sun{position:absolute;width:90%;aspect-ratio:1;top:50%;left:50%;transform:translate(-50%,-50%);background:radial-gradient(circle,#ff8c0066 0%,#ff450033 25%,transparent 65%);filter:blur(30px);animation:sunP 3s ease-in-out infinite}
        @keyframes sunP{0%,100%{opacity:.5;transform:translate(-50%,-50%) scale(1)}50%{opacity:.85;transform:translate(-50%,-50%) scale(1.07)}}
        .stripe{position:absolute;bottom:0;left:0;right:0;height:8%;background:linear-gradient(90deg,#ff8c00,#ffcc00,#ff8c00);clip-path:polygon(0 35%,100% 0,100% 100%,0 100%);opacity:.85}
        .scene-text .hl{color:#ffcc00;text-shadow:0 4px 18px rgba(255,200,0,.45)}
        .scene-text .hl2{color:#ff8c00}
      `,
      enter: "mot"
    },
    "clean-minimal": {
      bg: "#fafafa",
      text: "#111111", accent: "#111111", accent2: "#666666",
      font: "'Inter','Helvetica Neue',Helvetica,Arial,sans-serif", weight: 800,
      decoHTML: `
        <div class="dot tl"></div><div class="dot tr"></div><div class="dot bl"></div><div class="dot br"></div>
        <div class="accent-bar"></div>`,
      extraCss: `
        .accent-bar{position:absolute;left:0;top:0;bottom:0;width:5px;background:linear-gradient(180deg,#111,#888)}
        .dot{position:absolute;width:8px;height:8px;border-radius:50%;background:#111;opacity:.85}
        .dot.tl{top:6%;left:6%}.dot.tr{top:6%;right:6%}.dot.bl{bottom:6%;left:6%}.dot.br{bottom:6%;right:6%}
        .scene-text .hl{color:#111;text-decoration:underline;text-decoration-thickness:.08em;text-underline-offset:.12em}
        .scene-text .hl2{color:#444;font-style:italic}
        .wm{color:rgba(0,0,0,.35) !important}
        .progress{background:#111 !important}
      `,
      enter: "fade"
    },
    "luxury": {
      bg: "linear-gradient(160deg,#0a0800 0%,#120e00 45%,#080600 100%)",
      text: "#f5e070", accent: "#c9a522", accent2: "#e8e8e0",
      font: "'Playfair Display',Georgia,serif", weight: 900,
      decoHTML: `
        <div class="gold-glow"></div>
        <div class="frame"><span class="gem tl"></span><span class="gem tr"></span><span class="gem bl"></span><span class="gem br"></span></div>`,
      extraCss: `
        .gold-glow{position:absolute;width:80%;aspect-ratio:1;top:50%;left:50%;transform:translate(-50%,-50%);background:radial-gradient(ellipse,rgba(201,165,34,.45) 0%,transparent 60%);filter:blur(40px);animation:gp 4s ease-in-out infinite}
        @keyframes gp{0%,100%{opacity:.45}50%{opacity:.75}}
        .frame{position:absolute;inset:4%;border:1px solid rgba(201,165,34,.35)}
        .frame::before{content:'';position:absolute;inset:5px;border:1px solid rgba(201,165,34,.12)}
        .gem{position:absolute;width:8px;height:8px;background:#c9a522;transform:rotate(45deg)}
        .gem.tl{top:-4px;left:-4px}.gem.tr{top:-4px;right:-4px}.gem.bl{bottom:-4px;left:-4px}.gem.br{bottom:-4px;right:-4px}
        .scene-text{font-style:italic;text-shadow:0 0 30px rgba(201,165,34,.4),0 3px 6px rgba(0,0,0,.5)}
        .scene-text .hl{color:#f5e070;text-shadow:0 0 30px rgba(245,224,112,.6)}
        .scene-text .hl2{color:#e8e8e0;text-shadow:none}
      `,
      enter: "lux"
    },
    "social-pop": {
      bg: "linear-gradient(145deg,#ff0080,#ff4d00 28%,#ff8800 50%,#7c3aed 75%,#0088ff 100%)",
      text: "#ffffff", accent: "#ffffff", accent2: "#ffe066",
      font: "'Inter','Arial Black',sans-serif", weight: 900,
      decoHTML: `<div class="blob b1"></div><div class="blob b2"></div>
        <span class="emo e1">🔥</span><span class="emo e2">⚡</span><span class="emo e3">✨</span>`,
      extraCss: `
        .blob{position:absolute;width:55%;aspect-ratio:1;border-radius:50%;filter:blur(35px);background:rgba(255,255,255,.18);animation:bf 5s ease-in-out infinite}
        .b1{top:-15%;left:-15%}.b2{bottom:-15%;right:-12%;background:rgba(255,255,255,.12);animation-delay:-2.5s}
        @keyframes bf{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}
        .emo{position:absolute;font-size:clamp(18px,4cqw,40px);opacity:.75;animation:emf 3s ease-in-out infinite}
        .e1{top:8%;left:8%}.e2{top:9%;right:8%;animation-delay:1s}.e3{bottom:14%;left:9%;animation-delay:.5s}
        @keyframes emf{0%,100%{transform:translateY(0) rotate(-5deg)}50%{transform:translateY(-8px) rotate(6deg)}}
        .scene-text{text-shadow:0 4px 18px rgba(0,0,0,.3)}
        .scene-text .hl{-webkit-text-stroke:2px #fff;color:transparent}
        .scene-text .hl2{color:#fff;text-shadow:3px 3px 0 rgba(0,0,0,.35)}
      `,
      enter: "pop"
    },
    "horror": {
      bg: "#030003",
      text: "#cc0000", accent: "#ff2222", accent2: "#dddddd",
      font: "Georgia,'Times New Roman',serif", weight: 700,
      decoHTML: `<div class="vignette"></div><div class="blood"></div><div class="crack"></div>`,
      extraCss: `
        .vignette{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 25%,rgba(0,0,0,.9) 100%)}
        .blood{position:absolute;width:75%;aspect-ratio:1;top:50%;left:50%;transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(139,0,0,.4) 0%,transparent 70%);filter:blur(25px);animation:bp 3s ease-in-out infinite}
        .crack{position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(139,0,0,.06) 3px,rgba(139,0,0,.06) 4px);mix-blend-mode:overlay}
        @keyframes bp{0%,100%{opacity:.5}50%{opacity:.95}}
        .scene-text{font-style:italic;text-shadow:0 0 22px rgba(139,0,0,.7),2px 0 rgba(0,0,255,.2),-2px 0 rgba(255,0,0,.18)}
        .scene-text .hl{color:#ff2222}
        .scene-text .hl2{color:#ddd;text-shadow:0 0 8px rgba(255,255,255,.25)}
        .stage{animation:flick 8s ease infinite}
        @keyframes flick{0%,95%,97%,100%{opacity:1}96%,98%{opacity:.65}}
      `,
      enter: "glitch"
    },
    "gaming": {
      bg: "linear-gradient(160deg,#000510 0%,#050a1a 50%,#0a0520 100%)",
      text: "#ffffff", accent: "#39ff14", accent2: "#f97316",
      font: "'Inter','Arial Black',sans-serif", weight: 900,
      decoHTML: `
        <div class="hex"></div>
        <div class="energy e1"></div><div class="energy e2"></div>
        <div class="orb og"></div><div class="orb oo"></div>
        <div class="hud"><span class="hudDot"></span><span class="hudT">SHORTSCRAFT // LIVE</span><span class="hudDot o"></span></div>`,
      extraCss: `
        .hex{position:absolute;inset:0;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='52'%3E%3Cpolygon points='30,2 58,18 58,34 30,50 2,34 2,18' fill='none' stroke='rgba(57,255,20,0.08)' stroke-width='1'/%3E%3C/svg%3E");background-size:7% auto}
        .energy{position:absolute;width:100%;height:3px;opacity:.6}
        .e1{top:28%;background:linear-gradient(90deg,transparent,#39ff14,transparent);animation:ef 2s linear infinite}
        .e2{bottom:33%;background:linear-gradient(90deg,transparent,#f97316,transparent);animation:ef 2.6s linear infinite reverse}
        @keyframes ef{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
        .orb{position:absolute;width:55%;aspect-ratio:1;border-radius:50%;filter:blur(45px);opacity:.4;top:50%;transform:translateY(-50%)}
        .og{left:-20%;background:radial-gradient(circle,#39ff14,transparent 70%)}
        .oo{right:-20%;background:radial-gradient(circle,#f97316,transparent 70%)}
        .hud{position:absolute;top:5%;left:50%;transform:translateX(-50%);display:flex;gap:8px;align-items:center;z-index:3}
        .hudDot{width:7px;height:7px;border-radius:50%;background:#39ff14;box-shadow:0 0 8px #39ff14}
        .hudDot.o{background:#f97316;box-shadow:0 0 8px #f97316}
        .hudT{font:800 clamp(8px,1.6cqw,14px) 'Courier New',monospace;color:rgba(57,255,20,.8);letter-spacing:.12em}
        .scene-text .hl{color:#39ff14;text-shadow:0 0 18px rgba(57,255,20,.7)}
        .scene-text .hl2{color:#f97316;text-shadow:0 0 18px rgba(249,115,22,.7)}
      `,
      enter: "game"
    },
    "news": {
      bg: "#f0f0f0",
      text: "#111111", accent: "#cc0000", accent2: "#111111",
      font: "'Inter','Arial Black',sans-serif", weight: 900,
      decoHTML: `
        <div class="news-hdr"><span class="liveBdg">● LIVE</span><span class="break">BREAKING NEWS</span></div>
        <div class="news-ftr"><span class="ticker">SHORTSCRAFT.ONLINE — AI Content Generator &nbsp; • &nbsp; Free Animated Reel Maker &nbsp; • &nbsp; AI YouTube Shorts &nbsp;</span></div>`,
      extraCss: `
        .news-hdr{position:absolute;top:0;left:0;right:0;height:10%;background:#cc0000;display:flex;align-items:center;justify-content:center;gap:12px;z-index:3}
        .liveBdg{background:#fff;color:#cc0000;font:900 clamp(8px,1.7cqw,16px) 'Arial Black',sans-serif;padding:3px 8px;border-radius:3px;letter-spacing:.08em;animation:bk 1s ease infinite}
        .break{font:900 clamp(10px,2.4cqw,24px) 'Arial Black',sans-serif;color:#fff;letter-spacing:.06em}
        @keyframes bk{0%,100%{opacity:1}50%{opacity:.55}}
        .news-ftr{position:absolute;bottom:0;left:0;right:0;height:8%;background:#1a1a1a;display:flex;align-items:center;padding:0 4%;overflow:hidden;z-index:3}
        .ticker{white-space:nowrap;font:700 clamp(8px,1.6cqw,16px) 'Inter',sans-serif;color:#fff;letter-spacing:.04em;animation:tk 16s linear infinite}
        @keyframes tk{0%{transform:translateX(100%)}100%{transform:translateX(-100%)}}
        .stage{padding-top:10%;padding-bottom:8%}
        .scene-text .hl{background:#cc0000;color:#fff;padding:0 .12em;border-radius:2px}
        .scene-text .hl2{border:3px solid #111;padding:0 .12em}
        .progress{bottom:8% !important;background:#cc0000 !important}
        .wm{bottom:9% !important;color:rgba(0,0,0,.45) !important}
      `,
      enter: "slide"
    },
    "vhs": {
      bg: "linear-gradient(180deg,#0d0010 0%,#150020 40%,#0a0015 100%)",
      text: "#f472b6", accent: "#22d3ee", accent2: "#ffffff",
      font: "'Courier New',Courier,monospace", weight: 700,
      decoHTML: `
        <div class="scanlines"></div>
        <div class="vhs-noise"></div>
        <div class="pink-glow"></div>
        <div class="rec-label"><span class="rec-dot"></span><span class="rec-t">REC ■</span></div>`,
      extraCss: `
        .scanlines{position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.3) 2px,rgba(0,0,0,.3) 4px);pointer-events:none;z-index:3;animation:scvhs 10s linear infinite}
        @keyframes scvhs{from{background-position:0 0}to{background-position:0 80px}}
        .vhs-noise{position:absolute;inset:0;opacity:.04;mix-blend-mode:overlay;background:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
        .pink-glow{position:absolute;width:80%;height:60%;top:50%;left:50%;transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(244,114,182,.25),transparent 70%);filter:blur(40px);animation:pp 4s ease-in-out infinite}
        @keyframes pp{0%,100%{opacity:.45}50%{opacity:.85}}
        .rec-label{position:absolute;top:4%;left:4%;display:flex;align-items:center;gap:8px;z-index:4}
        .rec-dot{width:9px;height:9px;border-radius:50%;background:#f472b6;box-shadow:0 0 8px #f472b6;animation:bk 1s ease infinite}
        .rec-t{font:700 clamp(8px,1.6cqw,14px) 'Courier New',monospace;color:rgba(244,114,182,.85);letter-spacing:.1em}
        @keyframes bk{0%,100%{opacity:1}50%{opacity:.25}}
        .scene-text{text-shadow:2px 0 #22d3ee,-2px 0 #f472b6,0 0 18px rgba(244,114,182,.4);letter-spacing:.04em}
        .scene-text .hl{color:#22d3ee;text-shadow:2px 0 #f472b6,-2px 0 #22d3ee}
        .scene-text .hl2{color:#fff;text-shadow:2px 0 #f472b6,-2px 0 #22d3ee}
      `,
      enter: "vhs"
    },
    "documentary": {
      bg: "linear-gradient(180deg,#000 0%,#0a0a0a 100%)",
      text: "#ffffff", accent: "#fbbf24", accent2: "#9ca3af",
      font: "'Inter',Helvetica,Arial,sans-serif", weight: 700,
      decoHTML: `<div class="bar bar-top"></div><div class="bar bar-bot"></div>`,
      extraCss: `
        .bar{position:absolute;left:0;right:0;height:13%;background:#000;z-index:3}
        .bar-top{top:0}.bar-bot{bottom:0}
        .scene-text{letter-spacing:.02em;text-shadow:0 2px 12px rgba(0,0,0,.8)}
        .scene-text .hl{color:#fbbf24}
        .scene-text .hl2{color:#9ca3af}
      `,
      enter: "fade"
    },
    "tech-blueprint": {
      bg: "#03162a",
      text: "#e0f2fe", accent: "#38bdf8", accent2: "#a5f3fc",
      font: "'Inter','Courier New',monospace", weight: 800,
      decoHTML: `<div class="bp-grid"></div><div class="bp-cross tl"></div><div class="bp-cross tr"></div><div class="bp-cross bl"></div><div class="bp-cross br"></div>`,
      extraCss: `
        .bp-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(56,189,248,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(56,189,248,.12) 1px,transparent 1px);background-size:6% 6%}
        .bp-cross{position:absolute;width:22px;height:22px;border:1.5px solid #38bdf8;opacity:.55}
        .bp-cross.tl{top:5%;left:5%;border-right:none;border-bottom:none}
        .bp-cross.tr{top:5%;right:5%;border-left:none;border-bottom:none}
        .bp-cross.bl{bottom:5%;left:5%;border-right:none;border-top:none}
        .bp-cross.br{bottom:5%;right:5%;border-left:none;border-top:none}
        .scene-text{text-shadow:0 0 14px rgba(56,189,248,.5)}
        .scene-text .hl{color:#38bdf8}
        .scene-text .hl2{color:#a5f3fc}
      `,
      enter: "neon"
    },
    "podcast": {
      bg: "linear-gradient(180deg,#11131a 0%,#1a1d28 100%)",
      text: "#ffffff", accent: "#fb7185", accent2: "#fbbf24",
      font: "'Inter',Helvetica,Arial,sans-serif", weight: 700,
      decoHTML: `<div class="wave"></div>`,
      extraCss: `
        .wave{position:absolute;left:6%;right:6%;bottom:14%;height:30%;display:flex;align-items:flex-end;justify-content:center;gap:3px;opacity:.5}
        .wave::before{content:'';width:100%;height:100%;background:repeating-linear-gradient(90deg,#fb7185 0,#fb7185 3px,transparent 3px,transparent 8px);mask:linear-gradient(180deg,transparent,#000 30%,#000 70%,transparent);-webkit-mask:linear-gradient(180deg,transparent,#000 30%,#000 70%,transparent)}
        .scene-text{background:rgba(0,0,0,.45);border-left:4px solid #fb7185;padding:.4em .6em !important;border-radius:.2em;backdrop-filter:blur(8px)}
        .scene-text .hl{color:#fb7185}
        .scene-text .hl2{color:#fbbf24}
      `,
      enter: "slide"
    },
  };
  return themes[styleKey] || themes["viral-hook"];
}

/* ============================================================
   createVideoPreviewHTML — builds the complete iframe document
   ============================================================ */
function createVideoPreviewHTML(scenes, styleKey, aspect) {
  const theme = getStyleTheme(styleKey);
  const e = VIDEO_STATE.edit;
  const speed = Math.max(0.5, Math.min(2.5, e.speed || 1));
  const sceneMs = Math.round(2800 * speed);
  const fontScale = e.fontScale || 1;
  const customHL = e.highlight || "";

  const safeScenes = (scenes.length ? scenes : ["Paste a script first"])
    .map(line => highlightKeywords(line));

  const tall = ["9:16","4:5","3:4","2:3"].includes(aspect);
  const wide = ["16:9","21:9"].includes(aspect);
  const aspectCss = {"9:16":"9/16","16:9":"16/9","1:1":"1/1","4:5":"4/5","3:4":"3/4","2:3":"2/3","21:9":"21/9"}[aspect] || "9/16";

  // Container-query based font size — scales to iframe's actual width
  // tall iframes typically narrow → use larger cqw value
  const baseFont = tall
    ? `clamp(18px, 8.2cqw, 64px)`
    : wide
      ? `clamp(18px, 4.6cqw, 56px)`
      : `clamp(18px, 6.4cqw, 60px)`;

  const enter = theme.enter || "fade";
  const enterKeyframes = {
    vh: `@keyframes en-vh{0%{opacity:0;transform:translateY(22px) scale(.96)}55%{opacity:1;transform:translateY(-3px) scale(1.01)}100%{opacity:1;transform:translateY(0) scale(1)}}`,
    neon: `@keyframes en-neon{0%{opacity:0;transform:scaleX(1.25);filter:blur(6px)}60%{opacity:1;filter:blur(0)}100%{opacity:1;transform:scaleX(1)}}`,
    mot: `@keyframes en-mot{0%{opacity:0;transform:scale(.7)}55%{transform:scale(1.04)}100%{opacity:1;transform:scale(1)}}`,
    fade: `@keyframes en-fade{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}`,
    lux: `@keyframes en-lux{0%{opacity:0;letter-spacing:.25em;filter:blur(4px)}60%{opacity:.85}100%{opacity:1;letter-spacing:.02em;filter:blur(0)}}`,
    pop: `@keyframes en-pop{0%{opacity:0;transform:scale(.5) rotate(-6deg)}55%{transform:scale(1.07) rotate(2deg)}100%{opacity:1;transform:scale(1) rotate(0)}}`,
    glitch: `@keyframes en-glitch{0%{opacity:0;transform:skewX(12deg);clip-path:inset(0 100% 0 0)}20%{clip-path:inset(0 60% 0 0)}60%{clip-path:inset(0 0 0 0);opacity:1}100%{opacity:1;transform:skewX(0);clip-path:inset(0 0 0 0)}}`,
    game: `@keyframes en-game{0%{opacity:0;transform:scale(1.25);filter:blur(5px)}55%{transform:scale(.97)}100%{opacity:1;transform:scale(1);filter:blur(0)}}`,
    slide: `@keyframes en-slide{0%{opacity:0;transform:translateX(-28px)}100%{opacity:1;transform:translateX(0)}}`,
    vhs: `@keyframes en-vhs{0%{opacity:0;transform:skewX(4deg) scaleY(1.2);clip-path:inset(45% 0 45% 0)}50%{clip-path:inset(0)}100%{opacity:1;transform:skewX(0) scaleY(1)}}`
  };

  const customHLcss = customHL
    ? `.scene-text .hl,.scene-text .hl2{color:${customHL} !important;text-shadow:0 0 18px ${customHL}66 !important}`
    : "";

  // Build the inner HTML
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>ShortsCraft Preview</title>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html,body{width:100%;height:100%;overflow:hidden;background:#000;font-family:${theme.font};-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;scrollbar-width:none}
  html::-webkit-scrollbar,body::-webkit-scrollbar{display:none;width:0;height:0}
  body{display:flex;align-items:center;justify-content:center}
  .stage{
    position:relative;width:100%;height:100%;max-width:100vw;max-height:100vh;
    aspect-ratio:${aspectCss};
    background:${theme.bg};
    overflow:hidden;
    display:flex;align-items:center;justify-content:center;
    container-type:inline-size;
  }
  /* preserve aspect if container too wide (wide aspects in tall iframe) */
  @media (min-aspect-ratio: ${aspectCss}){
    .stage{width:auto;height:100%}
  }
  @media (max-aspect-ratio: ${aspectCss}){
    .stage{width:100%;height:auto}
  }
  .scene-wrap{
    position:absolute;inset:0;
    display:flex;align-items:center;justify-content:center;
    padding:8% 7%;
    z-index:2;
  }
  .scene-text{
    color:${theme.text};
    font-size:calc(${baseFont} * ${fontScale});
    font-weight:${theme.weight};
    line-height:1.15;
    letter-spacing:-.01em;
    text-align:center;
    max-width:100%;
    /* CRITICAL: never break words */
    word-break:keep-all;
    overflow-wrap:normal;
    hyphens:none;
    white-space:normal;
    text-wrap:balance;
    animation:en-${enter} .55s cubic-bezier(.2,.7,.2,1.05) both;
  }
  ${enterKeyframes[enter]}
  .progress{
    position:absolute;left:0;bottom:0;height:5px;width:0;
    background:linear-gradient(90deg,${theme.accent},${theme.accent2});
    box-shadow:0 0 14px ${theme.accent}99;
    z-index:5;
  }
  .wm{
    position:absolute;right:3.5%;bottom:2.5%;
    font:600 clamp(8px,1.5cqw,13px) 'Inter','Helvetica Neue',Arial,sans-serif;
    color:rgba(255,255,255,.4);letter-spacing:.06em;
    z-index:5;text-transform:lowercase;
    pointer-events:none;
  }
  .scene-counter{
    position:absolute;left:3.5%;bottom:2.5%;
    font:700 clamp(8px,1.5cqw,12px) 'Inter',sans-serif;
    color:rgba(255,255,255,.35);letter-spacing:.1em;
    z-index:5;
  }
  /* Theme decorations */
  ${theme.extraCss || ""}
  ${customHLcss}
</style>
</head><body>
<div class="stage">
  ${theme.decoHTML || ""}
  <div class="scene-wrap" id="sw">
    <div class="scene-text" id="st"></div>
  </div>
  <div class="progress" id="pr"></div>
  <div class="scene-counter" id="sc">1 / ${safeScenes.length}</div>
  <div class="wm">shortscraft.online</div>
</div>
<script>
(function(){
  var SCENES = ${JSON.stringify(safeScenes)};
  var DUR = ${sceneMs};
  var idx = 0;
  var st = document.getElementById('st');
  var pr = document.getElementById('pr');
  var sc = document.getElementById('sc');
  function render(i){
    if(!SCENES.length) return;
    st.style.animation = 'none';
    void st.offsetWidth; /* reflow */
    st.innerHTML = SCENES[i];
    st.style.animation = '';
    sc.textContent = (i+1) + ' / ' + SCENES.length;
    pr.style.transition = 'none';
    pr.style.width = '0%';
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        pr.style.transition = 'width ' + DUR + 'ms linear';
        pr.style.width = '100%';
      });
    });
  }
  render(0);
  if(SCENES.length > 1){
    setInterval(function(){
      idx = (idx + 1) % SCENES.length;
      render(idx);
    }, DUR);
  }
})();
<\/script>
</body></html>`;
}

/* ---------- Push HTML into the iframe + update wrap class ---------- */
function setVideoPreview(html) {
  const frame = $("#videoPreviewFrame");
  const empty = $("#videoEmptyState");
  const status = $("#videoPreviewStatus");
  const wrap = $("#videoFrameWrap");
  if (!frame) return;
  frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
  frame.srcdoc = html;
  if (empty) empty.classList.add("hidden");
  if (status) status.textContent = "Preview ready";
  if (wrap) {
    wrap.classList.remove("ratio-916","ratio-169","ratio-11","ratio-45","ratio-34","ratio-23","ratio-219");
    const cls = {"9:16":"ratio-916","16:9":"ratio-169","1:1":"ratio-11","4:5":"ratio-45","3:4":"ratio-34","2:3":"ratio-23","21:9":"ratio-219"}[VIDEO_STATE.aspect] || "ratio-916";
    wrap.classList.add(cls);
  }
}

/* ============================================================
   buildVideoPreview — main entry called by Generate Video button
   ============================================================ */
function buildVideoPreview(deductCredit = true) {
  const scriptInput = $("#videoScriptInput");
  const styleSelect = $("#videoStyleSelect");
  const aspectSelect = $("#videoAspectSelect");
  if (!scriptInput) return;

  const rawScript = scriptInput.value.trim();
  if (!rawScript) { toast("Paste or generate a script first.", "error"); return; }

  // Credits gate
  if (deductCredit && !STATE.isPro) {
    if (STATE.credits <= 0) { openModal("#noCreditsModal"); return; }
    setCredits(STATE.credits - 1);
  }

  VIDEO_STATE.script = rawScript;
  VIDEO_STATE.style = styleSelect?.value || "viral-hook";
  VIDEO_STATE.aspect = aspectSelect?.value || "9:16";

  // 1. Clean   2. Split into scenes   3. Build HTML
  const scenes = splitScriptIntoScenes(rawScript, VIDEO_STATE.aspect);

  if (!scenes.length) {
    toast("Script could not be parsed. Try a different text.", "error");
    return;
  }

  VIDEO_STATE.html = createVideoPreviewHTML(scenes, VIDEO_STATE.style, VIDEO_STATE.aspect);
  setVideoPreview(VIDEO_STATE.html);

  // History entry
  try {
    pushHistory({
      topic: (cleanScriptForVideo(rawScript).split(/\n|\.|!|\?/).find(Boolean) || "Animated video").trim().slice(0, 80),
      at: Date.now(),
      content: rawScript,
      videoHtml: VIDEO_STATE.html,
      type: "video"
    });
  } catch {}

  // Auto-scroll to Live Preview card
  setTimeout(() => {
    const previewCard = $(".video-preview-card") || $("#videoFrameWrap");
    if (previewCard) {
      const headerOffset = window.innerWidth <= 768 ? 70 : 80;
      const top = previewCard.getBoundingClientRect().top + window.pageYOffset - headerOffset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, 150);

  toast(`Video preview ready — ${scenes.length} scene${scenes.length > 1 ? "s" : ""}!`, "success");
}

/* ---------- Generate Script from topic (server) ---------- */
async function generateScriptForVideo() {
  const topicInput = $("#videoTopicInput");
  const scriptInput = $("#videoScriptInput");
  const topic = topicInput?.value.trim();
  if (!topic) { toast("Enter a topic first.", "error"); return; }
  if (!STATE.isPro && STATE.credits <= 0) { openModal("#noCreditsModal"); return; }

  const btn = $("#videoGenerateScriptBtn");
  const old = btn?.textContent;
  if (btn) { btn.textContent = "Generating..."; btn.disabled = true; }
  try {
    const data = await api("/api/generate", { method: "POST", body: { topic, type: "script" } });
    let script = (data.content || "").replace(/=== SCRIPT ===/gi, "").replace(/=== TITLES ===[\s\S]*/gi, "").trim();
    if (scriptInput) scriptInput.value = script;


    $$(".video-mode").forEach(b => b.classList.toggle("active", b.dataset.mode === "paste"));
    $("#videoPastePanel")?.classList.add("active");
    $("#videoGeneratePanel")?.classList.remove("active");
    VIDEO_STATE.mode = "paste";
    if (!STATE.isPro) setCredits(STATE.credits - 1);
    toast("Script generated. Now create video preview.", "success");
  } catch (e) {
    toast(e.message, "error");
  } finally {
    if (btn) { btn.textContent = old || "Generate Script"; btn.disabled = false; }
  }
}

function showProDownloadModal() {
  const note = $("#upgradeNote");
  if (note) note.textContent = "Download Video is a Pro feature. Upgrade to export your animated video.";
  openModal("#upgradeModal");
}

function initVideoFirst() {
  if (!$("#videoGenerator")) return;


  $$(".video-mode").forEach(btn => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode || "paste";
      VIDEO_STATE.mode = mode;

      $$(".video-mode").forEach(b => b.classList.toggle("active", b === btn));
      $("#videoPastePanel")?.classList.toggle("active", mode === "paste");
      $("#videoGeneratePanel")?.classList.toggle("active", mode === "generate");
    });
  });

  on($("#videoGenerateScriptBtn"), "click", generateScriptForVideo);
  on($("#generateVideoBtn"), "click", () => buildVideoPreview(true));

  on($("#resetVideoBtn"), "click", () => {
    if ($("#videoScriptInput")) $("#videoScriptInput").value = "";
    if ($("#videoTopicInput")) $("#videoTopicInput").value = "";
    resetEdits();
    VIDEO_STATE.html = "";
    if ($("#videoPreviewFrame")) $("#videoPreviewFrame").srcdoc = "";
    $("#videoEmptyState")?.classList.remove("hidden");
    if ($("#videoPreviewStatus")) $("#videoPreviewStatus").textContent = "No video generated yet";
  });

  on($("#applyVideoEditBtn"), "click", () => {
    resetEdits();
    parseEdits($("#videoEditPrompt")?.value || "");
    buildVideoPreview(false);
  });

  on($("#resetVideoEditBtn"), "click", () => {
    resetEdits();
    if ($("#videoEditPrompt")) $("#videoEditPrompt").value = "";
    buildVideoPreview(false);
  });


  $$(".quick-edit-chips button").forEach(chip => {
    chip.addEventListener("click", () => {
      const val = (chip.dataset.edit || chip.textContent || "").trim();
      const p = $("#videoEditPrompt");
      const merged = p && p.value.trim() ? (p.value.trim() + ", " + val) : val;
      if (p) p.value = merged;
      resetEdits();
      parseEdits(merged);
      buildVideoPreview(false);
    });
  });

  on($("#copyVideoHtmlBtn"), "click", async () => {
    if (!VIDEO_STATE.html) { toast("Generate a video first.", "error"); return; }
    try {
      await navigator.clipboard.writeText(VIDEO_STATE.html);
      toast("HTML copied!", "success");
    } catch { toast("Copy failed.", "error"); }
  });

  on($("#openVideoPreviewBtn"), "click", () => {
    if (!VIDEO_STATE.html) { toast("Generate a video first.", "error"); return; }
    const w = window.open("", "_blank");
    if (w) { w.document.open(); w.document.write(VIDEO_STATE.html); w.document.close(); }
  });

  on($("#downloadVideoBtn"), "click", () => {
    if (!VIDEO_STATE.html) { toast("Generate a video first.", "error"); return; }
    showProDownloadModal();
  });
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initVideoFirst);
} else {
  initVideoFirst();
}

/* ── Extra safe profile action delegation ─────────────────── */
document.addEventListener("click", (e) => {
  const btn = e.target.closest("#profilePop .pp-item, #profilePop #earnCreditsLink");
  if (!btn) return;
  if (btn.id === "earnCreditsLink") { e.preventDefault(); closeModal("#upgradeModal"); $("#profilePop")?.classList.add("hidden"); openModal("#earnModal"); }
  if (btn.id === "upgradeBtn") { e.preventDefault(); $("#profilePop")?.classList.add("hidden"); openModal("#upgradeModal"); }
  if (btn.id === "viewSavedBtn" || btn.id === "viewHistoryBtn") { e.preventDefault(); $("#profilePop")?.classList.add("hidden"); openSidebar(); }
  if (btn.id === "profileFeedbackBtn") { e.preventDefault(); $("#profilePop")?.classList.add("hidden"); openModal("#feedbackModal"); }
}, true);

})();


/* ===== APPENDED LATEST GENSPARK PATCH ===== */
/* ============================================================
   FINAL v10 PATCH — auth state, credits=10, earn tasks,
   improved video preview, scroll-to-preview, profile fixes
   ============================================================ */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const AUTH_KEY = "sc:auth:v2";
  const CREDITS_KEY = "sc:credits:v2";
  const CREDITS_DAY = "sc:credits:day";
  const CREDITS_RULE = "sc:credits:rule:v10";
  const FREE_PER_DAY = 10;

  /* ---------- Force credits to 10 ---------- */
  function ensureTenCredits() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const day = localStorage.getItem(CREDITS_DAY);
      const rule = localStorage.getItem(CREDITS_RULE);
      if (day !== today || rule !== "v10-10") {
        localStorage.setItem(CREDITS_DAY, today);
        localStorage.setItem(CREDITS_RULE, "v10-10");
        localStorage.setItem(CREDITS_KEY, String(FREE_PER_DAY));
        localStorage.setItem("sc:credits:max", String(FREE_PER_DAY));
        localStorage.setItem("sc:credits:max-version", "10");
      } else {
        const cur = parseInt(localStorage.getItem(CREDITS_KEY) || "10", 10);
        if (isNaN(cur) || cur < 0) {
          localStorage.setItem(CREDITS_KEY, String(FREE_PER_DAY));
        }
      }
    } catch {}
    const cur = parseInt(localStorage.getItem(CREDITS_KEY) || "10", 10);

    $$("#creditsCount, #creditsInfoCount").forEach((el) => {
      if (el) el.textContent = String(isNaN(cur) ? 10 : cur);
    });
    const pill = $("#creditsPill");
    if (pill) pill.classList.remove("hidden");
  }

  /* ---------- Auth state UI ---------- */
  function getStoredUser() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); }
    catch { return null; }
  }
  function setAuthUI(user) {
    const signed = !!user;
    document.body.classList.toggle("sc-signed-in", signed);

    $$("#loginBtn, #seoLoginBtn").forEach((btn) => {
      if (!btn) return;
      btn.classList.toggle("hidden", signed);
      btn.style.display = signed ? "none" : "";
    });

    $$("#profileWrap").forEach((wrap) => {
      if (!wrap) return;
      wrap.classList.toggle("hidden", !signed);
      wrap.style.display = signed ? "block" : "none";
    });
    if (signed) {
      const meta = user.user_metadata || {};
      const name = user.name || user.full_name || meta.full_name || meta.name || (user.email ? user.email.split("@")[0] : "Creator");
      const email = user.email || "";
      const initial = (name.trim()[0] || "C").toUpperCase();

      $$("#profileName").forEach((el) => el.textContent = name);

      $$("#profileEmail").forEach((el) => el.textContent = email);

      $$("#avatarInitial, #avatarInitialLg").forEach((el) => el.textContent = initial);
    } else {

      $$("#profilePop").forEach((p) => p.classList.add("hidden"));
      document.body.classList.remove("sc-profile-open");
    }
  }

  function openModal(sel) {
    const m = $(sel);
    if (!m) return;
    m.classList.remove("hidden");
    document.body.classList.add("modal-open");
  }
  function closeModal(sel) {
    const m = typeof sel === "string" ? $(sel) : sel;
    if (!m) return;
    m.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }

  function refreshEarnTasks() {
    const list = $("#tasksList");
    if (!list) return;

    const TASKS = [
      { id: "subscribe", label: "Subscribe Tech Vault channel", hint: "Open the channel, subscribe, then claim.", url: "https://www.youtube.com/@TechVault-90" },
      { id: "watch", label: "Watch one Tech Vault video", hint: "Open the channel, watch any video, then claim.", url: "https://www.youtube.com/@TechVault-90/videos" },
      { id: "telegram", label: "Follow on Telegram", hint: "Join our Telegram channel, then claim.", url: "https://t.me/+ZfQKHJhGg8xiMTRl" },
      { id: "share", label: "Share ShortsCraft with a friend", hint: "Share the website link, then claim.", url: "https://shortscraft.online/" },
      { id: "feedback", label: "Submit useful product feedback", hint: "Tell us what should improve, then claim.", action: "feedback" },
    ];

    let done = {};
    let opened = {};
    try { done = JSON.parse(localStorage.getItem("sc:tasks:v2") || "{}"); } catch {}
    try { opened = JSON.parse(localStorage.getItem("sc:tasks-opened:v2") || "{}"); } catch {}

    list.innerHTML = TASKS.map((t) => {
      const isDone = !!done[t.id];
      const isOpened = !!opened[t.id];
      const btn = isDone ? "Done ✓" : isOpened ? "Claim +1" : (t.action === "feedback" ? "Open" : "Open");
      return `
        <div class="task premium-task ${isDone ? "task-done" : ""}">
          <div class="task-info">
            <b>${escapeHtmlSafe(t.label)}</b>
            <span>${escapeHtmlSafe(t.hint)}</span>
            <small>+1 credit</small>
          </div>
          <button data-id="${t.id}" data-action="${t.action || "open"}" data-url="${t.url || ""}" ${isDone ? "disabled" : ""}>${btn}</button>
        </div>`;
    }).join("");


    $$("#tasksList button").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        const url = btn.dataset.url;

        let doneState = {};
        let openedState = {};
        try { doneState = JSON.parse(localStorage.getItem("sc:tasks:v2") || "{}"); } catch {}
        try { openedState = JSON.parse(localStorage.getItem("sc:tasks-opened:v2") || "{}"); } catch {}

        if (doneState[id]) return;

        if (action === "feedback" && !openedState[id]) {
          openedState[id] = true;
          localStorage.setItem("sc:tasks-opened:v2", JSON.stringify(openedState));
          closeModal("#earnModal");
          openModal("#feedbackModal");
          refreshEarnTasks();
          return;
        }

        if (!openedState[id]) {
          openedState[id] = true;
          localStorage.setItem("sc:tasks-opened:v2", JSON.stringify(openedState));
          if (url) window.open(url, "_blank", "noopener,noreferrer");
          if (window.scToast) window.scToast("Task opened. Complete it, then come back to claim.", "info");
          refreshEarnTasks();
          return;
        }

        doneState[id] = true;
        localStorage.setItem("sc:tasks:v2", JSON.stringify(doneState));
        const cur = parseInt(localStorage.getItem(CREDITS_KEY) || "10", 10) || 0;
        const nv = cur + 1;
        localStorage.setItem(CREDITS_KEY, String(nv));

        $$("#creditsCount, #creditsInfoCount").forEach((el) => el.textContent = String(nv));
        if (window.scToast) window.scToast("+1 credit added!", "success");
        refreshEarnTasks();
      });
    });
  }

  function escapeHtmlSafe(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function initMobileNav() {
    const burger = $("#navBurger");
    const nav = $("#navMobile");
    if (!burger || !nav || burger.dataset.scV10 === "1") return;
    burger.dataset.scV10 = "1";

    const close = () => {
      nav.classList.remove("open");
      nav.setAttribute("hidden", "");
      burger.classList.remove("active");
      burger.setAttribute("aria-expanded", "false");
    };
    const open = () => {
      nav.removeAttribute("hidden");
      nav.classList.add("open");
      burger.classList.add("active");
      burger.setAttribute("aria-expanded", "true");
    };

    burger.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (nav.classList.contains("open")) close();
      else open();
    }, true);

    nav.addEventListener("click", (e) => e.stopPropagation(), true);


    $$(".nav-mobile a").forEach((a) => a.addEventListener("click", close));
    document.addEventListener("click", (e) => {
      if (nav.classList.contains("open") && !e.target.closest(".nav") && !e.target.closest("#navMobile")) {
        close();
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && nav.classList.contains("open")) close();
    });
  }

  function bindGenerateScroll() {
    const btn = $("#generateVideoBtn");
    if (!btn || btn.dataset.scV10Scroll === "1") return;
    btn.dataset.scV10Scroll = "1";

    btn.addEventListener("click", () => {
      const script = $("#videoScriptInput")?.value?.trim();
      if (!script) return;
      setTimeout(() => {
        const target = $(".video-preview-card") || $("#videoFrameWrap") || $("#videoPreviewFrame");
        if (target) {
          const headerOffset = window.innerWidth <= 768 ? 64 : 70;
          const rect = target.getBoundingClientRect();
          const offsetTop = rect.top + window.scrollY - headerOffset - 12;
          window.scrollTo({ top: offsetTop, behavior: "smooth" });
        }
      }, 380);
    }, false);
  }

  function boot() {
    ensureTenCredits();
    setAuthUI(getStoredUser());
    initMobileNav();
    bindGenerateScroll();

    const earnTriggers = ["#earnCreditsLink", "#noCreditsEarnBtn"];
    earnTriggers.forEach((sel) => {
      const btn = $(sel);
      if (btn && btn.dataset.scV10Earn !== "1") {
        btn.dataset.scV10Earn = "1";
        btn.addEventListener("click", () => {
          setTimeout(refreshEarnTasks, 60);
        });
      }
    });
    refreshEarnTasks();

    setTimeout(ensureTenCredits, 600);
    setTimeout(() => setAuthUI(getStoredUser()), 800);
    setTimeout(refreshEarnTasks, 900);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();


/* ============================================================
   FINAL FEEDBACK SUBMIT FIX
   ============================================================ */
(() => {
  "use strict";
  const $ = (s, root = document) => root.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const showToast = (msg, type = "info") => {
    if (window.scToast) return window.scToast(msg, type, 3500);
    const wrap = $("#toasts");
    if (!wrap) return console.log(`[${type}] ${msg}`);
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="toast-icon">${type === "success" ? "✅" : type === "error" ? "⚠️" : "💡"}</span><span>${esc(msg)}</span>`;
    wrap.appendChild(el);
    setTimeout(() => { el.classList.add("fade-out"); setTimeout(() => el.remove(), 300); }, 3500);
  };
  const closeFeedbackModal = () => {
    const modal = $("#feedbackModal");
    if (modal) modal.classList.add("hidden");
    document.body.classList.remove("modal-open");
    document.body.style.overflow = "";
  };
  const saveLocalFeedback = (payload) => {
    try {
      const key = "sc:feedback:pending:v1";
      const arr = JSON.parse(localStorage.getItem(key) || "[]");
      arr.unshift({ ...payload, at: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(arr.slice(0, 25)));
    } catch {}
  };
  async function submitFeedback(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const btn = $("#feedbackSubmit");
    const nameEl = $("#feedbackName");
    const emailEl = $("#feedbackEmail");
    const msgEl = $("#feedbackMessage");
    const name = (nameEl?.value || "").trim();
    const email = (emailEl?.value || "").trim();
    const message = (msgEl?.value || "").trim();
    if (!name) return showToast("Enter your name.", "error");
    if (message.length < 5) return showToast("Message too short.", "error");
    const payload = { name, email, subject: "Studio feedback", message };
    const oldText = btn?.textContent || "Submit";
    if (btn) { btn.disabled = true; btn.textContent = "Submitting..."; }
    let serverOk = false;
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);
      serverOk = true;
    } catch (err) {
      console.warn("[feedback fallback]", err?.message || err);
      saveLocalFeedback(payload);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = oldText; }
    }
    if (msgEl) msgEl.value = "";
    closeFeedbackModal();
    showToast(serverOk ? "Thanks! Feedback submitted." : "Thanks! Feedback saved. I'll keep it safely.", "success");
  }
  function bindFinalFeedbackFix() {
    const btn = $("#feedbackSubmit");
    if (!btn || btn.dataset.scFinalFeedbackFix === "1") return;
    btn.dataset.scFinalFeedbackFix = "1";
    btn.addEventListener("click", submitFeedback, true);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindFinalFeedbackFix);
  else bindFinalFeedbackFix();
})();

/* ============================================================
   SHORTSCRAFT PREMIUM VIDEO PREVIEW PATCH v4
   Append at END of public/script.js
   Fixes: distinct styles, aspect scaling, edit prompt, word reveal,
   watermark, autoplay, scene dots, credits gate, preview scroll.
   ============================================================ */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const CREDIT_KEY = "sc:credits:v2";
  const DAY_KEY = "sc:credits:day";
  const FREE_PER_DAY = 10;
  const STYLE_KEY = "sc:premiumVideo:lastHtml";
  const STATE = {
    html: "",
    script: "",
    style: "viral-hook",
    aspect: "9:16",
    editText: "",
    mods: { fontScale: 1, speed: 1, yellow: false, darker: false, minimal: false, premium: false }
  };

  const toast = (msg, type = "info") => {
    if (window.scToast) return window.scToast(msg, type, 3200);
    console[type === "error" ? "error" : "log"](msg);
  };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  function todayISO(){ return new Date().toISOString().slice(0,10); }
  function ensureCredits(){
    try{
      if(localStorage.getItem(DAY_KEY) !== todayISO()){
        localStorage.setItem(DAY_KEY, todayISO());
        localStorage.setItem(CREDIT_KEY, String(FREE_PER_DAY));
      }
    }catch{}
    renderCredits();
  }
  function getCredits(){
    ensureCredits();
    const n = parseInt(localStorage.getItem(CREDIT_KEY) || String(FREE_PER_DAY), 10);
    return Number.isFinite(n) ? n : FREE_PER_DAY;
  }
  function setCredits(n){
    const v = Math.max(0, Number(n) || 0);
    try{ localStorage.setItem(CREDIT_KEY, String(v)); }catch{}
    renderCredits();
  }
  function renderCredits(){
    const v = parseInt(localStorage.getItem(CREDIT_KEY) || String(FREE_PER_DAY), 10);
    $$("#creditsCount,#creditsInfoCount").forEach(el => { if(el) el.textContent = String(Number.isFinite(v) ? v : FREE_PER_DAY); });
    const pill = $("#creditsPill");
    if(pill) pill.classList.remove("hidden");
  }
  function isPro(){ return document.body.classList.contains("sc-pro") || /true/i.test(localStorage.getItem("sc:isPro") || ""); }
  function openNoCredits(){
    const m = $("#noCreditsModal");
    if(m){ m.classList.remove("hidden"); document.body.classList.add("modal-open"); document.body.style.overflow = "hidden"; }
    else toast("No credits left. Come back tomorrow or upgrade.", "error");
  }

  function cleanScript(raw){
    return String(raw || "")
      .replace(/```[\s\S]*?```/g," ")
      .replace(/={2,}\s*[A-Z][A-Z\s]+={2,}/g,"\n")
      .replace(/\[\s*(HOOK|MAIN|CTA|INTRO|OUTRO|BODY|END|START|TITLE|VOICEOVER|VO|NARRATOR|SCENE\s*\d*|PART\s*\d*|STEP\s*\d*|SHOT\s*\d*|CAPTION)\s*\]\s*:?/gi,"\n")
      .replace(/^\s*(HOOK|MAIN|CTA|INTRO|OUTRO|BODY|TITLE|VOICEOVER|VO|NARRATOR|CAPTION)\s*[:\-–—]\s*/gim,"")
      .replace(/^\s*(SCENE|PART|STEP|SHOT|CHAPTER)\s*\d+\s*[:\-–—]?\s*/gim,"")
      .replace(/^\s*\d+\s*[).:\-–—]\s+/gm,"")
      .replace(/[•▪▫➜►▶→·]/g,"\n")
      .replace(/\*\*(.*?)\*\*/g,"$1")
      .replace(/__(.*?)__/g,"$1")
      .replace(/^#{1,6}\s+/gm,"")
      .replace(/\((pause|camera|zoom|cut|music|sfx|beat|transition|fade|smile|laugh)[^)]{0,40}\)/gi," ")
      .replace(/\r/g,"\n")
      .replace(/[\t ]+/g," ")
      .replace(/\n{2,}/g,"\n")
      .trim();
  }

  function splitIntoScenes(raw, aspect){
    const text = cleanScript(raw);
    if(!text) return [];
    const tall = ["9:16","4:5","3:4","2:3"].includes(aspect);
    const wide = ["16:9","21:9"].includes(aspect);
    const maxWords = tall ? 7 : wide ? 10 : 8;
    const maxChars = tall ? 46 : wide ? 78 : 58;
    const parts = [];
    text.split(/\n+/).forEach(line => {
      line.split(/(?<=[.!?।])\s+|(?<=[,;:])\s+/).forEach(p => { p = p.trim(); if(p) parts.push(p); });
    });
    const scenes = [];
    for(const p of parts){
      const words = p.split(/\s+/).filter(Boolean);
      if(!words.length) continue;
      let chunk = [], len = 0;
      for(const w of words){
        const nextLen = len + (chunk.length ? 1 : 0) + w.length;
        if(chunk.length && (chunk.length >= maxWords || nextLen > maxChars)){
          scenes.push(chunk.join(" "));
          chunk = [w]; len = w.length;
        }else{
          chunk.push(w); len = nextLen;
        }
      }
      if(chunk.length) scenes.push(chunk.join(" "));
    }
    const merged = [];
    for(let i=0;i<scenes.length;i++){
      const cur = scenes[i].trim();
      if(!cur) continue;
      if(merged.length && cur.split(/\s+/).length <= 2){
        const candidate = merged[merged.length-1] + " " + cur;
        if(candidate.split(/\s+/).length <= maxWords + 1 && candidate.length <= maxChars + 8){ merged[merged.length-1] = candidate; continue; }
      }
      merged.push(cur);
    }
    return merged.slice(0, 24);
  }

  function keywordClass(word, i, total){
    const clean = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu,"");
    const power = new Set(["ai","viral","secret","money","paise","free","pro","hack","trick","views","youtube","shorts","creator","income","earn","earning","warning","truth","today","now","kaise","kyu","best"]);
    if(power.has(clean) || clean.length >= 8 || /[!?]$/.test(word) || i === total - 1) return "kw";
    if(i === 0 || /^[A-Z]/.test(word)) return "kw2";
    return "";
  }
  function lineToWordSpans(line){
    const words = line.split(/\s+/).filter(Boolean);
    return words.map((w,i)=>`<span class="word ${keywordClass(w,i,words.length)}" style="--i:${i}">${esc(w)}</span>`).join(" ");
  }

  function parseEdits(text){
    const p = String(text || "").toLowerCase();
    const m = { fontScale: 1, speed: 1, yellow: false, darker: false, minimal: false, premium: false };
    if(/bigger|large|big|text bada|bada|font/.test(p)) m.fontScale = 1.22;
    if(/smaller|small|chhota/.test(p)) m.fontScale = .9;
    if(/slow|slower/.test(p)) m.speed = 1.45;
    if(/fast|faster/.test(p)) m.speed = .72;
    if(/yellow|highlight/.test(p)) m.yellow = true;
    if(/dark|darker|black/.test(p)) m.darker = true;
    if(/minimal|simple|clean/.test(p)) m.minimal = true;
    if(/premium|luxury|gold|professional/.test(p)) m.premium = true;
    return m;
  }

  function themeFor(style, mods){
    if(mods.minimal) style = "clean-minimal";
    if(mods.premium) style = "luxury";
    const base = {
      "viral-hook": {
        bg:"radial-gradient(circle at 20% 20%,#ff3d6e33,transparent 34%),radial-gradient(circle at 82% 78%,#ffb02e33,transparent 38%),linear-gradient(145deg,#050505,#111)",
        text:"#fff", a:"#ff3d6e", b:"#ffb02e", font:"Inter, 'Arial Black', 'Noto Sans Devanagari', 'Nirmala UI', Mangal, sans-serif", anim:"flyUp", weight:950, deco:"<div class='slash'></div><div class='grain'></div>", placement:"center"
      },
      "clean-minimal": {
        bg:"#fafafa", text:"#111", a:"#111", b:"#666", font:"Inter, 'Helvetica Neue', 'Noto Sans Devanagari', 'Nirmala UI', Mangal, sans-serif", anim:"softFade", weight:760, deco:"<i class='dot d1'></i><i class='dot d2'></i><i class='dot d3'></i><i class='dot d4'></i>", placement:"center"
      },
      "neon-cyber": {
        bg:"#000", text:"#eaffff", a:"#00f5ff", b:"#b44fff", font:"Inter, 'Arial Black', 'Noto Sans Devanagari', 'Nirmala UI', Mangal, sans-serif", anim:"neonZoom", weight:950, deco:"<div class='grid'></div><div class='scan'></div><div class='orb cyan'></div><div class='orb purple'></div>", placement:"center"
      },
      "motivation": {
        bg:"linear-gradient(135deg,#ff3d2e,#ff7a18 48%,#b91372)", text:"#fff", a:"#fff200", b:"#fff", font:"Inter, 'Arial Black', 'Noto Sans Devanagari', 'Nirmala UI', Mangal, sans-serif", anim:"bounceIn", weight:950, deco:"<div class='sunburst'></div>", placement:"center"
      },
      "podcast": {
        bg:"#171717", text:"#fff", a:"#FFD60A", b:"#FFD60A", font:"Inter, 'Noto Sans Devanagari', 'Nirmala UI', Mangal, sans-serif", anim:"subtitleUp", weight:820, deco:"<div class='wave'></div>", placement:"bottom"
      },
      "news": {
        bg:"#f4f4f4", text:"#111", a:"#d60000", b:"#fff", font:"Inter, Georgia, 'Times New Roman', 'Noto Sans Devanagari', serif", anim:"flashIn", weight:980, deco:"<div class='newsTop'>BREAKING NEWS</div><div class='ticker'>SHORTSCRAFT • AI VIDEO • LATEST UPDATE •</div>", placement:"center"
      },
      "horror": {
        bg:"#000", text:"#8B0000", a:"#ff0000", b:"#fff", font:"Georgia, 'Times New Roman', 'Noto Sans Devanagari', 'Nirmala UI', serif", anim:"glitch", weight:900, deco:"<div class='fog'></div><div class='vignette'></div>", placement:"center"
      },
      "luxury": {
        bg:"radial-gradient(circle at 50% 25%,#d4af3726,transparent 38%),linear-gradient(145deg,#050400,#141006)", text:"#f7e7a0", a:"#D4AF37", b:"#fff6c7", font:"Georgia, 'Times New Roman', 'Noto Sans Devanagari', 'Nirmala UI', serif", anim:"shimmerIn", weight:900, deco:"<div class='goldFrame'></div><div class='goldDust'></div>", placement:"center"
      },
      "social-pop": {
        bg:"linear-gradient(135deg,#7c3aed,#ec4899 48%,#fb7185)", text:"#fff", a:"#fff200", b:"#ffffff", font:"Inter, 'Arial Black', 'Noto Sans Devanagari', 'Nirmala UI', Mangal, sans-serif", anim:"popScale", weight:950, deco:"<div class='bubble b1'></div><div class='bubble b2'></div><div class='bubble b3'></div>", placement:"center"
      },
      "documentary": {
        bg:"linear-gradient(180deg,#050505,#111)", text:"#f5f5f5", a:"#fbbf24", b:"#a3a3a3", font:"Inter, 'Noto Sans Devanagari', 'Nirmala UI', Mangal, sans-serif", anim:"softFade", weight:760, deco:"<div class='letter top'></div><div class='letter bottom'></div>", placement:"center"
      },
      "tech-blueprint": {
        bg:"#03162a", text:"#e0f2fe", a:"#38bdf8", b:"#a5f3fc", font:"Inter, 'Courier New', 'Noto Sans Devanagari', 'Nirmala UI', monospace", anim:"techSlide", weight:850, deco:"<div class='blueGrid'></div><div class='hud'>SYSTEM ONLINE</div>", placement:"center"
      },
      "gaming": {
        bg:"linear-gradient(145deg,#090a12,#111827)", text:"#fff", a:"#39ff14", b:"#f97316", font:"Inter, 'Arial Black', 'Noto Sans Devanagari', 'Nirmala UI', sans-serif", anim:"popScale", weight:980, deco:"<div class='energy e1'></div><div class='energy e2'></div>", placement:"center"
      },
      "classroom": {
        bg:"linear-gradient(160deg,#f8fafc,#e2e8f0)", text:"#0f172a", a:"#2563eb", b:"#f97316", font:"Inter, 'Noto Sans Devanagari', 'Nirmala UI', Mangal, sans-serif", anim:"softFade", weight:820, deco:"<div class='paper'></div>", placement:"center"
      },
      "vhs": {
        bg:"linear-gradient(180deg,#140018,#08000f)", text:"#f472b6", a:"#22d3ee", b:"#fff", font:"'Courier New','Noto Sans Devanagari','Nirmala UI',monospace", anim:"glitch", weight:800, deco:"<div class='scanlines'></div><div class='rec'>● REC</div>", placement:"center"
      },
      "startup": {
        bg:"linear-gradient(145deg,#ffffff,#eef2ff)", text:"#101828", a:"#4f46e5", b:"#0ea5e9", font:"Inter, 'Noto Sans Devanagari', 'Nirmala UI', sans-serif", anim:"softFade", weight:850, deco:"<div class='cardGrid'></div>", placement:"center"
      }
    };
    const t = base[style] || base["viral-hook"];
    if(mods.darker) t.bg = "linear-gradient(145deg,#000,#05000a)";
    if(mods.yellow){ t.a = "#FFD60A"; t.b = "#FFD60A"; }
    return t;
  }

  function buildHTML(scenes, style, aspect, mods){
    const t = themeFor(style, mods);
    const dims = {"9:16":[1080,1920],"16:9":[1920,1080],"1:1":[1080,1080],"4:5":[1080,1350],"3:4":[1080,1440],"2:3":[1080,1620],"21:9":[1920,823]}[aspect] || [1080,1920];
    const [W,H] = dims;
    const tall = H > W;
    const font = Math.round((tall ? 84 : 76) * (mods.fontScale || 1));
    const sceneMs = Math.round(3000 * (mods.speed || 1));
    const sceneData = scenes.map((s,i) => ({ html: lineToWordSpans(s), anim: [t.anim,"techSlide","softFade","popScale","flyUp"][i % 5] || t.anim }));
    const dots = sceneData.map((_,i)=>`<span class='sd' data-i='${i}'></span>`).join("");
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"><style>
      *{box-sizing:border-box;margin:0;padding:0} html,body{width:100%;height:100%;overflow:hidden;background:#000;font-family:${t.font};-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility} body::-webkit-scrollbar{display:none}
      .viewport{position:fixed;inset:0;overflow:hidden;background:#000;display:grid;place-items:center}
      .canvas{position:absolute;left:50%;top:50%;width:${W}px;height:${H}px;transform-origin:center center;overflow:hidden;background:${t.bg};color:${t.text};}
      .canvas:after{content:"";position:absolute;inset:0;box-shadow:inset 0 0 0 2px rgba(255,255,255,.05);pointer-events:none;z-index:8}
      .deco,.deco>*{position:absolute;pointer-events:none}.deco{inset:0;z-index:1}.content{position:absolute;inset:0;display:flex;align-items:${t.placement==='bottom'?'flex-end':'center'};justify-content:center;text-align:center;padding:${t.placement==='bottom'?'0 90px 210px':'160px 95px'};z-index:3}.scene{display:none;max-width:${t.placement==='bottom'?'86%':'92%'};font-weight:${t.weight};font-size:${font}px;line-height:1.04;letter-spacing:-.035em;word-break:keep-all;overflow-wrap:normal;hyphens:none;text-wrap:balance;text-shadow:0 8px 30px rgba(0,0,0,.30)}.scene.active{display:block}.word{display:inline-block;opacity:0;margin:.02em .035em;animation-duration:.72s;animation-fill-mode:both;animation-timing-function:cubic-bezier(.18,.82,.2,1);animation-delay:calc(var(--i)*70ms)}.scene.active .word{animation-name:var(--anim)}.kw{color:${t.a};font-size:1.12em;text-shadow:0 0 24px color-mix(in srgb, ${t.a} 60%, transparent)}.kw2{color:${t.b}} ${mods.yellow?`.kw,.kw2{background:#FFD60A;color:#111;padding:.02em .13em;border-radius:.12em;text-shadow:none}`:""}
      .progress{position:absolute;left:0;bottom:0;width:0;height:10px;background:linear-gradient(90deg,${t.a},${t.b});z-index:7;box-shadow:0 0 22px ${t.a}}.watermark{position:absolute;right:42px;bottom:38px;font:700 22px Inter,Arial,sans-serif;color:${t.text==="#111"||t.text==="#101828"||t.text==="#0f172a"?'rgba(0,0,0,.28)':'rgba(255,255,255,.33)'};letter-spacing:.08em;z-index:7}.counter{position:absolute;left:42px;bottom:38px;font:800 22px Inter,Arial,sans-serif;color:${t.text==="#111"||t.text==="#101828"||t.text==="#0f172a"?'rgba(0,0,0,.32)':'rgba(255,255,255,.38)'};z-index:7}.dots{position:absolute;left:50%;bottom:58px;transform:translateX(-50%);display:flex;gap:12px;z-index:7}.sd{width:12px;height:12px;border-radius:99px;background:${t.text==="#111"?'rgba(0,0,0,.2)':'rgba(255,255,255,.2)'}}.sd.on{width:34px;background:${t.a}}
      @keyframes flyUp{0%{opacity:0;transform:translateY(110px) scale(.92)}65%{opacity:1;transform:translateY(-10px) scale(1.03)}100%{opacity:1;transform:translateY(0) scale(1)}}@keyframes softFade{0%{opacity:0;transform:translateY(38px)}100%{opacity:1;transform:translateY(0)}}@keyframes neonZoom{0%{opacity:0;transform:scale(1.5);filter:blur(12px)}60%{opacity:1;filter:blur(0)}100%{opacity:1;transform:scale(1)}}@keyframes bounceIn{0%{opacity:0;transform:scale(.35) rotate(-4deg)}55%{opacity:1;transform:scale(1.09) rotate(1deg)}100%{opacity:1;transform:scale(1)}}@keyframes subtitleUp{0%{opacity:0;transform:translateY(70px)}100%{opacity:1;transform:translateY(0)}}@keyframes flashIn{0%,18%,32%{opacity:0}12%,25%,100%{opacity:1;transform:scale(1)}}@keyframes glitch{0%{opacity:0;transform:skewX(18deg);filter:blur(5px)}25%{opacity:1;transform:translateX(-14px) skewX(-8deg)}40%{transform:translateX(12px) skewX(8deg)}100%{opacity:1;transform:none;filter:blur(0)}}@keyframes shimmerIn{0%{opacity:0;letter-spacing:.22em;filter:blur(8px)}70%{opacity:.9}100%{opacity:1;letter-spacing:-.02em;filter:blur(0)}}@keyframes popScale{0%{opacity:0;transform:scale(.2) rotate(-8deg)}70%{opacity:1;transform:scale(1.12) rotate(2deg)}100%{opacity:1;transform:scale(1)}}@keyframes techSlide{0%{opacity:0;transform:translateX(-90px);clip-path:inset(0 100% 0 0)}100%{opacity:1;transform:none;clip-path:inset(0)}}
      .slash{inset:auto -120px 12% -120px;height:180px;background:linear-gradient(90deg,${t.a},${t.b});transform:skewY(-10deg);opacity:.22}.grain{inset:0;background:radial-gradient(circle,rgba(255,255,255,.12) 1px,transparent 1px);background-size:42px 42px;opacity:.12}.dot{position:absolute;width:24px;height:24px;border-radius:50%;background:#111}.d1{left:70px;top:90px}.d2{right:70px;top:90px}.d3{left:70px;bottom:90px}.d4{right:70px;bottom:90px}.grid,.blueGrid{inset:0;background-image:linear-gradient(rgba(0,245,255,.13) 1px,transparent 1px),linear-gradient(90deg,rgba(0,245,255,.13) 1px,transparent 1px);background-size:85px 85px}.scan,.scanlines{inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 4px,rgba(255,255,255,.04) 4px,rgba(255,255,255,.04) 8px);animation:scan 9s linear infinite}@keyframes scan{to{background-position:0 150px}}.orb{width:700px;height:700px;border-radius:50%;filter:blur(90px);opacity:.45}.cyan{left:-220px;top:-170px;background:#00f5ff}.purple{right:-220px;bottom:-170px;background:#b44fff}.sunburst{inset:-20%;background:conic-gradient(from 0deg,transparent 0 12deg,rgba(255,255,255,.12) 12deg 18deg,transparent 18deg 30deg);animation:rot 16s linear infinite}@keyframes rot{to{transform:rotate(360deg)}}.wave{left:12%;right:12%;bottom:120px;height:90px;background:repeating-linear-gradient(90deg,#FFD60A 0 8px,transparent 8px 24px);opacity:.23}.newsTop{top:0;left:0;right:0;height:130px;background:#d60000;color:white;display:grid;place-items:center;font:950 48px Inter,Arial,sans-serif;letter-spacing:.08em}.ticker{bottom:0;left:0;right:0;height:105px;background:#111;color:white;display:grid;place-items:center;font:850 28px Inter,Arial,sans-serif}.fog{inset:0;background:radial-gradient(circle at 50% 70%,rgba(139,0,0,.22),transparent 45%);animation:fog 6s ease-in-out infinite}@keyframes fog{50%{opacity:.55;transform:scale(1.08)}}.vignette{inset:0;box-shadow:inset 0 0 260px #000}.goldFrame{inset:70px;border:3px solid rgba(212,175,55,.45)}.goldDust{inset:0;background:radial-gradient(circle,rgba(212,175,55,.45) 1px,transparent 2px);background-size:90px 90px;opacity:.13}.bubble{border-radius:50%;background:rgba(255,255,255,.18);filter:blur(2px)}.b1{width:260px;height:260px;left:70px;top:140px}.b2{width:360px;height:360px;right:-80px;bottom:140px}.b3{width:150px;height:150px;right:160px;top:100px}.letter.top,.letter.bottom{left:0;right:0;height:180px;background:#000;z-index:2}.letter.top{top:0}.letter.bottom{bottom:0}.hud{top:58px;left:58px;color:${t.a};font:800 26px Inter,monospace;letter-spacing:.16em}.energy{left:-20%;width:140%;height:8px;background:linear-gradient(90deg,transparent,${t.a},transparent)}.e1{top:28%;animation:energy 2.2s linear infinite}.e2{bottom:30%;animation:energy 2.8s linear infinite reverse;background:linear-gradient(90deg,transparent,${t.b},transparent)}@keyframes energy{to{transform:translateX(45%)}}.paper{inset:70px;background:rgba(255,255,255,.45);border:1px solid rgba(15,23,42,.12);border-radius:36px}.rec{top:45px;left:45px;color:#f472b6;font:800 28px 'Courier New',monospace}.cardGrid{inset:0;background:radial-gradient(circle at 20% 20%,rgba(79,70,229,.15),transparent 35%),radial-gradient(circle at 80% 70%,rgba(14,165,233,.14),transparent 35%)}
    </style></head><body><div class="viewport"><div class="canvas" id="cv"><div class="deco">${t.deco}</div><div class="content" id="content"></div><div class="progress" id="progress"></div><div class="counter" id="counter"></div><div class="dots" id="dots">${dots}</div><div class="watermark">shortscraft.online</div></div></div><script>
      const W=${W}, H=${H}, DUR=${sceneMs};
      const SCENES=${JSON.stringify(sceneData)};
      const cv=document.getElementById('cv'), content=document.getElementById('content'), progress=document.getElementById('progress'), counter=document.getElementById('counter'), dots=[...document.querySelectorAll('.sd')];
      function fit(){ const s=Math.min(innerWidth/W, innerHeight/H); cv.style.transform='translate(-50%,-50%) scale('+s+')'; }
      addEventListener('resize',fit,{passive:true}); fit();
      let idx=0;
      function render(){ const s=SCENES[idx]||SCENES[0]; content.innerHTML='<div class="scene active" style="--anim:'+s.anim+'">'+s.html+'</div>'; counter.textContent=(idx+1)+' / '+SCENES.length; dots.forEach((d,i)=>d.classList.toggle('on',i===idx)); progress.style.transition='none'; progress.style.width='0%'; requestAnimationFrame(()=>requestAnimationFrame(()=>{progress.style.transition='width '+DUR+'ms linear'; progress.style.width='100%'})); }
      render(); if(SCENES.length>1) setInterval(()=>{idx=(idx+1)%SCENES.length; render();}, DUR);
    <\/script></body></html>`;
  }

  function setRatioClass(aspect){
    const wrap = $("#videoFrameWrap");
    if(!wrap) return;
    wrap.classList.remove("ratio-916","ratio-169","ratio-11","ratio-45","ratio-34","ratio-23","ratio-219");
    wrap.classList.add({"9:16":"ratio-916","16:9":"ratio-169","1:1":"ratio-11","4:5":"ratio-45","3:4":"ratio-34","2:3":"ratio-23","21:9":"ratio-219"}[aspect] || "ratio-916");
  }
  function renderPreview({deduct=false, applyEdits=false} = {}){
    const input = $("#videoScriptInput");
    if(!input || !input.value.trim()){ toast("Paste or generate a script first.", "error"); return; }
    if(deduct && !isPro()){
      const c = getCredits();
      if(c <= 0){ openNoCredits(); return; }
      setCredits(c - 1);
    }
    STATE.script = input.value.trim();
    STATE.style = $("#videoStyleSelect")?.value || "viral-hook";
    STATE.aspect = $("#videoAspectSelect")?.value || "9:16";
    STATE.editText = $("#videoEditPrompt")?.value || "";
    STATE.mods = applyEdits ? parseEdits(STATE.editText) : STATE.mods;
    // ── Premium template system — pass RAW script directly ──
    let generatedHTML = null;
    if(window.SC_VIDEO_TEMPLATES && window.SC_VIDEO_TEMPLATES.build){
      try{
        generatedHTML = window.SC_VIDEO_TEMPLATES.build(
          STATE.script, STATE.style, STATE.aspect, STATE.mods
        );
      }catch(e){ console.warn("Template build failed, using fallback:", e); }
    }

    // Fallback: old system
    if(!generatedHTML){
      const scenes = splitIntoScenes(STATE.script, STATE.aspect);
      if(!scenes.length){ toast("Script could not be parsed.", "error"); return; }
      generatedHTML = buildHTML(scenes, STATE.style, STATE.aspect, STATE.mods);
    }
    STATE.html = generatedHTML;

    try{ localStorage.setItem(STYLE_KEY, STATE.html); }catch{}
    setRatioClass(STATE.aspect);
    const frame = $("#videoPreviewFrame");
    if(frame){ frame.setAttribute("sandbox","allow-scripts allow-same-origin"); frame.srcdoc = STATE.html; }
    $("#videoEmptyState")?.classList.add("hidden");
    const st = $("#videoPreviewStatus"); if(st) st.textContent = "Preview ready";
    setTimeout(()=> ($(".video-preview-card") || $("#videoFrameWrap"))?.scrollIntoView({behavior:"smooth",block:"center"}), 180);
    const sceneCount = (window.SC_VIDEO_TEMPLATES && window.SC_VIDEO_TEMPLATES.splitScript) ? window.SC_VIDEO_TEMPLATES.splitScript(STATE.script, STATE.aspect).length : 0;
    toast(`Premium video preview ready${sceneCount ? ` — ${sceneCount} scenes` : ""}`, "success");
  }

  function bindPremiumVideoPatch(){
    ensureCredits();
    const gen = $("#generateVideoBtn");
    if(gen && gen.dataset.premiumPatch !== "1"){
      gen.dataset.premiumPatch = "1";
      gen.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); STATE.mods = parseEdits($("#videoEditPrompt")?.value || ""); renderPreview({deduct:true, applyEdits:true}); }, true);
    }
    const apply = $("#applyVideoEditBtn");
    if(apply && apply.dataset.premiumPatch !== "1"){
      apply.dataset.premiumPatch = "1";
      apply.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); renderPreview({deduct:false, applyEdits:true}); }, true);
    }
    const reset = $("#resetVideoEditBtn");
    if(reset && reset.dataset.premiumPatch !== "1"){
      reset.dataset.premiumPatch = "1";
      reset.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); const p=$("#videoEditPrompt"); if(p) p.value=""; STATE.mods={fontScale:1,speed:1,yellow:false,darker:false,minimal:false,premium:false}; if($("#videoScriptInput")?.value.trim()) renderPreview({deduct:false, applyEdits:false}); }, true);
    }
    $$(".quick-edit-chips button").forEach(chip=>{
      if(chip.dataset.premiumPatch === "1") return;
      chip.dataset.premiumPatch = "1";
      chip.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); const p=$("#videoEditPrompt"); const val=(chip.dataset.edit||chip.textContent||"").trim(); if(p){ p.value = p.value.trim() ? p.value.trim()+", "+val : val; } renderPreview({deduct:false, applyEdits:true}); }, true);
    });
    const aspect = $("#videoAspectSelect");
    if(aspect && aspect.dataset.premiumPatch !== "1"){
      aspect.dataset.premiumPatch = "1";
      aspect.addEventListener("change", ()=>{ setRatioClass(aspect.value); if($("#videoScriptInput")?.value.trim()) renderPreview({deduct:false, applyEdits:true}); });
    }
    const copy = $("#copyVideoHtmlBtn");
    if(copy && copy.dataset.premiumPatch !== "1"){
      copy.dataset.premiumPatch = "1";
      copy.addEventListener("click", async (e)=>{ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); if(!STATE.html){ toast("Generate a video first.","error"); return; } try{ await navigator.clipboard.writeText(STATE.html); toast("HTML copied!","success"); }catch{ toast("Copy failed.","error"); } }, true);
    }
    const open = $("#openVideoPreviewBtn");
    if(open && open.dataset.premiumPatch !== "1"){
      open.dataset.premiumPatch = "1";
      open.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); if(!STATE.html){ toast("Generate a video first.","error"); return; } const w=window.open("","_blank"); if(w){ w.document.open(); w.document.write(STATE.html); w.document.close(); } }, true);
    }
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindPremiumVideoPatch); else bindPremiumVideoPatch();
  setTimeout(bindPremiumVideoPatch, 800);
})();
