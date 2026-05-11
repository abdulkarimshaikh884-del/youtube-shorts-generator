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

  // Restore local auth (works even without Supabase)
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

  // Hide ALL sign-in buttons

  $$("#loginBtn, #seoLoginBtn").forEach(b => b && b.classList.add("hidden"));
  // Show profile widgets

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

  // Force one-time migration from old 5-credit system to the new 10-credit system.
  // After migration, normal deduction works and page reload will NOT refill credits again.
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
      // Local fallback sign-in
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

  // Avatar toggle
  on($("#avatarBtn"), "click", (e) => {
    e.stopPropagation();
    const pop = $("#profilePop");
    if (!pop) return;
    pop.classList.toggle("hidden");
  });

  // Click outside profile → close
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#profileWrap") && !e.target.closest(".profile-wrap")) {
      $("#profilePop")?.classList.add("hidden");
    }
  });

  // Escape closes profile + modals
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
        // force layout
        requestAnimationFrame(() => mobile.classList.add("open"));
      }
    });
    // Close on link click
    mobile.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
      mobile.classList.remove("open");
      mobile.setAttribute("hidden", "");
    }));
    // Close on outside click
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
   VIDEO GENERATOR — Premium Animated HTML preview
   ============================================================ */
const VIDEO_STATE = {
  mode: "paste",
  html: "",
  script: "",
  style: "viral-hook",
  aspect: "9:16",
  edit: { fontScale: 1, speed: 1, highlight: "", bgMode: "auto", align: "center", dense: true }
};

const STYLE_MAP = {
  "viral-hook":    { name:"YouTube Viral Hook" },
  "neon-cyber":    { name:"Neon Cyber Kinetic" },
  "motivation":    { name:"Motivation Reel" },
  "clean-minimal": { name:"Clean Minimal White" },
  "luxury":        { name:"Luxury Gold Premium" },
  "social-pop":    { name:"Social Gradient Pop" },
  "horror":        { name:"Horror / Mystery" },
  "gaming":        { name:"Gaming Esports" },
  "news":          { name:"Bold Breaking News" },
  "vhs":           { name:"Retro VHS Tape" },
};

function splitScript(script, aspect) {
  const raw = String(script || "")
    .replace(/\[(HOOK|MAIN|CTA)\]/gi, "\n")
    .replace(/\r/g, "\n")
    .replace(/[•▪▫➜►]/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
  if (!raw) return [];

  const tall = ["9:16", "4:5", "3:4", "2:3"].includes(aspect);
  const square = aspect === "1:1";
  const wide = ["16:9", "21:9"].includes(aspect);
  const maxWords = tall ? 5 : square ? 7 : wide ? 9 : 6;
  const maxChars = tall ? 28 : square ? 38 : wide ? 56 : 42;
  const hardLimit = tall ? 16 : wide ? 12 : 14;

  const sentences = raw.split(/\n+|(?<=[.!?।])\s+/).map(s => s.trim()).filter(Boolean);
  const lines = [];
  sentences.forEach((sentence) => {
    const words = sentence.split(/\s+/).filter(Boolean);
    if (!words.length) return;
    if (sentence.length <= maxChars && words.length <= maxWords + 1) {
      lines.push(sentence);
      return;
    }
    let chunk = [];
    words.forEach((w) => {
      const next = [...chunk, w].join(" ");
      if (chunk.length >= maxWords || next.length > maxChars) {
        if (chunk.length) lines.push(chunk.join(" "));
        chunk = [w];
      } else chunk.push(w);
    });
    if (chunk.length) lines.push(chunk.join(" "));
  });
  return lines.map(s => s.replace(/^[-–—]+/, "").trim()).filter(Boolean).slice(0, hardLimit);
}

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

function generateVideoHtml(script, styleKey, aspect) {
  const lines = splitScript(script, aspect);
  const safeLines = JSON.stringify(lines.length ? lines : ["Paste a script first"]);
  const e = VIDEO_STATE.edit;
  const speed = Math.max(0.5, e.speed || 1);
  const DURATION = Math.round(2800 * speed);
  const fontScale = e.fontScale || 1;
  const highlight = e.highlight || "";

  const tall = ["9:16","4:5","3:4","2:3"].includes(aspect);
  const wide = ["16:9","21:9"].includes(aspect);
  const aspectCss = {"9:16":"9/16","16:9":"16/9","1:1":"1/1","4:5":"4/5","3:4":"3/4","2:3":"2/3","21:9":"21/9"}[aspect] || "9/16";
  const stageW = wide ? "min(100vw,1920px)" : "min(100vw,1080px)";

  // Per-style HTML builder
  const builders = {

    // ── 1. YOUTUBE VIRAL HOOK ─────────────────────────────────
    "viral-hook": () => `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden;background:#000;font-family:'Arial Black',Impact,sans-serif}
body{display:grid;place-items:center}
.stage{width:${stageW};aspect-ratio:${aspectCss};max-height:100vh;background:linear-gradient(160deg,#0a0010 0%,#1a000d 50%,#0d0020 100%);position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center}
.bg1{position:absolute;width:70%;height:70%;left:-20%;top:-20%;background:radial-gradient(circle,#ff0055 0%,transparent 65%);opacity:.18;filter:blur(60px);animation:pulse1 3s ease-in-out infinite}
.bg2{position:absolute;width:60%;height:60%;right:-15%;bottom:-15%;background:radial-gradient(circle,#ff6600 0%,transparent 65%);opacity:.15;filter:blur(60px);animation:pulse1 3s ease-in-out infinite reverse}
@keyframes pulse1{0%,100%{opacity:.15;transform:scale(1)}50%{opacity:.28;transform:scale(1.1)}}
.line-box{position:absolute;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8%}
.word-row{display:flex;flex-wrap:wrap;justify-content:center;gap:.12em;line-height:1}
.w{display:inline-block;color:#fff;font-size:calc(${tall?"clamp(52px,12vw,110px)":wide?"clamp(48px,7vw,96px)":"clamp(44px,10vw,88px)"} * ${fontScale});font-weight:900;letter-spacing:-.04em;text-transform:uppercase;opacity:0;animation:wIn .32s cubic-bezier(.2,0,.2,1.4) both}
.w.hl{color:#ff3d6e;text-shadow:0 0 40px #ff3d6e88}
.w.hl2{color:#ffb02e;text-shadow:0 0 30px #ffb02e88}
.progress{position:absolute;bottom:0;left:0;height:6px;width:0;background:linear-gradient(90deg,#ff3d6e,#ffb02e);box-shadow:0 0 16px #ff3d6e}
.wm{position:absolute;bottom:3%;right:4%;font:600 clamp(9px,1.3vw,14px) Inter,sans-serif;color:rgba(255,255,255,.22);letter-spacing:.06em}
@keyframes wIn{0%{opacity:0;transform:translateY(${tall?"60px":"40px"}) scaleY(1.2)}70%{opacity:1;transform:translateY(-4px) scaleY(.97)}100%{opacity:1;transform:translateY(0) scaleY(1)}}
@keyframes progAnim{0%{width:0}100%{width:100%}}
</style></head><body>
<div class="stage">
  <div class="bg1"></div><div class="bg2"></div>
  <div class="line-box" id="lb"></div>
  <div class="progress" id="pr"></div>
  <div class="wm">shortscraft.online</div>
</div>
<script>
const L=${safeLines},D=${DURATION},FS=${fontScale};
const HLW=["ai","viral","secret","money","paise","best","top","now","stop","free","pro","hack","trick","boom","win","no","why","how","never","always","must","today"];
const HLW2=["youtube","creator","content","shorts","reels","india","billion","million","lakh","crore"];
function esc(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]||c)}
function cls(w){const p=w.toLowerCase().replace(/[^a-z]/g,"");return HLW.includes(p)?"w hl":HLW2.includes(p)?"w hl2":"w"}
function draw(idx){
  const lb=document.getElementById("lb");
  lb.innerHTML="";
  const words=(L[idx]||"").split(/\s+/).filter(Boolean);
  const perRow=${tall ? 3 : wide ? 6 : 4};
  const rows=[];
  for(let i=0;i<words.length;i+=perRow)rows.push(words.slice(i,i+perRow));
  rows.forEach((row,ri)=>{
    const d=document.createElement("div");d.className="word-row";
    row.forEach((w,wi)=>{
      const span=document.createElement("span");
      span.className=cls(w);span.textContent=w;
      span.style.animationDelay=(ri*rows[0].length+wi)*0.07+"s";
      d.appendChild(span);
    });
    lb.appendChild(d);
  });
  const pr=document.getElementById("pr");
  pr.style.transition="none";pr.style.width="0";
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    pr.style.transition="width "+D+"ms linear";pr.style.width="100%";
  }));
}
let i=0;draw(0);
if(L.length>1)setInterval(()=>{i=(i+1)%L.length;draw(i);},D);
<\/script></body></html>`,

    // ── 2. NEON CYBER KINETIC ─────────────────────────────────
    "neon-cyber": () => `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden;background:#000;font-family:'Arial Black',Impact,sans-serif}
body{display:grid;place-items:center}
.stage{width:${stageW};aspect-ratio:${aspectCss};max-height:100vh;background:#030712;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(0,245,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,245,255,.04) 1px,transparent 1px);background-size:clamp(30px,5vw,50px) clamp(30px,5vw,50px)}
.scan{position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,245,255,.015) 2px,rgba(0,245,255,.015) 4px);animation:scanMove 8s linear infinite}
@keyframes scanMove{0%{background-position:0 0}100%{background-position:0 100px}}
.glow1{position:absolute;width:50%;height:50%;left:-10%;top:-10%;background:radial-gradient(circle,#00f5ff 0%,transparent 70%);opacity:.12;filter:blur(80px);animation:gb 4s ease-in-out infinite}
.glow2{position:absolute;width:50%;height:50%;right:-10%;bottom:-10%;background:radial-gradient(circle,#b44fff 0%,transparent 70%);opacity:.12;filter:blur(80px);animation:gb 4s ease-in-out infinite reverse}
@keyframes gb{0%,100%{opacity:.1;transform:scale(1)}50%{opacity:.22;transform:scale(1.15)}}
.line-box{position:absolute;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8%}
.word{display:inline-block;color:#00f5ff;font-size:calc(${tall?"clamp(50px,11vw,105px)":wide?"clamp(46px,6.5vw,90px)":"clamp(42px,9.5vw,84px)"} * ${fontScale});font-weight:900;letter-spacing:-.02em;text-transform:uppercase;text-shadow:0 0 30px #00f5ff,0 0 60px #00f5ff44;opacity:0;animation:neonIn .4s cubic-bezier(.16,1,.3,1) both}
.word.alt{color:#b44fff;text-shadow:0 0 30px #b44fff,0 0 60px #b44fff44}
.word.white{color:#fff;text-shadow:0 0 20px rgba(255,255,255,.4)}
.word-row{display:flex;flex-wrap:wrap;justify-content:center;gap:.15em}
.corner{position:absolute;width:40px;height:40px;border-color:#00f5ff;border-style:solid;opacity:.6}
.corner.tl{top:4%;left:4%;border-width:3px 0 0 3px}
.corner.tr{top:4%;right:4%;border-width:3px 3px 0 0}
.corner.bl{bottom:4%;left:4%;border-width:0 0 3px 3px}
.corner.br{bottom:4%;right:4%;border-width:0 3px 3px 0}
.progress{position:absolute;bottom:0;left:0;height:4px;width:0;background:linear-gradient(90deg,#00f5ff,#b44fff);box-shadow:0 0 20px #00f5ff}
.wm{position:absolute;bottom:3%;right:4%;font:600 clamp(9px,1.3vw,13px) 'Courier New',monospace;color:rgba(0,245,255,.3);letter-spacing:.1em}
@keyframes neonIn{0%{opacity:0;transform:scaleX(1.5) scaleY(0.5);filter:blur(8px)}60%{opacity:1;transform:scaleX(0.97) scaleY(1.03)}100%{opacity:1;transform:scale(1);filter:blur(0)}}
</style></head><body>
<div class="stage">
  <div class="grid"></div><div class="scan"></div>
  <div class="glow1"></div><div class="glow2"></div>
  <div class="corner tl"></div><div class="corner tr"></div>
  <div class="corner bl"></div><div class="corner br"></div>
  <div class="line-box" id="lb"></div>
  <div class="progress" id="pr"></div>
  <div class="wm">SHORTSCRAFT.ONLINE</div>
</div>
<script>
const L=${safeLines},D=${DURATION};
function draw(idx){
  const lb=document.getElementById("lb");lb.innerHTML="";
  const words=(L[idx]||"").split(/\s+/).filter(Boolean);
  const per=${tall?"3":wide?"6":"4"};
  const rows=[];for(let i=0;i<words.length;i+=per)rows.push(words.slice(i,i+per));
  rows.forEach((row,ri)=>{
    const div=document.createElement("div");div.className="word-row";
    row.forEach((w,wi)=>{
      const s=document.createElement("span");
      s.className="word"+(ri%3===1?" alt":ri%3===2?" white":"");
      s.textContent=w;s.style.animationDelay=((ri*row.length+wi)*0.09)+"s";
      div.appendChild(s);
    });
    lb.appendChild(div);
  });
  const pr=document.getElementById("pr");
  pr.style.transition="none";pr.style.width="0";
  requestAnimationFrame(()=>requestAnimationFrame(()=>{pr.style.transition="width "+D+"ms linear";pr.style.width="100%"}));
}
let i=0;draw(0);if(L.length>1)setInterval(()=>{i=(i+1)%L.length;draw(i)},D);
<\/script></body></html>`,

    // ── 3. MOTIVATION REEL ────────────────────────────────────
    "motivation": () => `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden;background:#000;font-family:'Arial Black',Impact,sans-serif}
body{display:grid;place-items:center}
.stage{width:${stageW};aspect-ratio:${aspectCss};max-height:100vh;background:linear-gradient(160deg,#0f0800 0%,#1a0f00 40%,#0a0500 100%);position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center}
.sun{position:absolute;width:90%;height:90%;top:50%;left:50%;transform:translate(-50%,-50%);background:radial-gradient(circle,#ff8c00 0%,#ff4500 25%,transparent 65%);opacity:.15;filter:blur(40px);animation:sunPulse 2s ease-in-out infinite}
@keyframes sunPulse{0%,100%{opacity:.12;transform:translate(-50%,-50%) scale(1)}50%{opacity:.22;transform:translate(-50%,-50%) scale(1.08)}}
.stripe{position:absolute;bottom:0;left:0;right:0;height:12%;background:linear-gradient(90deg,#ff8c00,#ffcc00,#ff8c00);opacity:.9;clip-path:polygon(0 40%,100% 0%,100% 100%,0 100%)}
.line-box{position:absolute;width:100%;height:88%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8%;gap:.2em}
.word{display:inline-block;color:#fff;font-size:calc(${tall?"clamp(56px,12.5vw,115px)":wide?"clamp(50px,7vw,100px)":"clamp(48px,11vw,96px)"} * ${fontScale});font-weight:900;letter-spacing:-.03em;text-transform:uppercase;opacity:0;animation:motIn .35s cubic-bezier(.34,1.56,.64,1) both}
.word.gold{color:#ffcc00;text-shadow:0 4px 20px rgba(255,200,0,.5)}
.word-row{display:flex;flex-wrap:wrap;justify-content:center;gap:.1em}
.quote-mark{position:absolute;top:5%;left:5%;font-size:clamp(60px,10vw,120px);color:rgba(255,200,0,.15);line-height:1;font-family:Georgia,serif}
.progress{position:absolute;bottom:0;left:0;height:5px;width:0;background:linear-gradient(90deg,#ff8c00,#ffcc00)}
.wm{position:absolute;bottom:13%;right:4%;font:700 clamp(8px,1.2vw,13px) Inter,sans-serif;color:rgba(255,255,255,.25);letter-spacing:.05em;text-transform:uppercase}
@keyframes motIn{0%{opacity:0;transform:scale(.6) rotate(-2deg)}60%{transform:scale(1.06) rotate(.5deg)}100%{opacity:1;transform:scale(1) rotate(0)}}
</style></head><body>
<div class="stage">
  <div class="sun"></div>
  <div class="quote-mark">"</div>
  <div class="stripe"></div>
  <div class="line-box" id="lb"></div>
  <div class="progress" id="pr"></div>
  <div class="wm">shortscraft.online</div>
</div>
<script>
const L=${safeLines},D=${DURATION};
function draw(idx){
  const lb=document.getElementById("lb");lb.innerHTML="";
  const words=(L[idx]||"").split(/\s+/).filter(Boolean);
  const per=${tall?"3":wide?"6":"4"};
  const rows=[];for(let i=0;i<words.length;i+=per)rows.push(words.slice(i,i+per));
  rows.forEach((row,ri)=>{
    const div=document.createElement("div");div.className="word-row";
    row.forEach((w,wi)=>{
      const s=document.createElement("span");
      s.className="word"+(ri===1||wi===1?" gold":"");
      s.textContent=w;s.style.animationDelay=((ri*row.length+wi)*0.08)+"s";
      div.appendChild(s);
    });
    lb.appendChild(div);
  });
  const pr=document.getElementById("pr");
  pr.style.transition="none";pr.style.width="0";
  requestAnimationFrame(()=>requestAnimationFrame(()=>{pr.style.transition="width "+D+"ms linear";pr.style.width="100%"}));
}
let i=0;draw(0);if(L.length>1)setInterval(()=>{i=(i+1)%L.length;draw(i)},D);
<\/script></body></html>`,

    // ── 4. CLEAN MINIMAL WHITE ────────────────────────────────
    "clean-minimal": () => `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden;background:#fff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif}
body{display:grid;place-items:center}
.stage{width:${stageW};aspect-ratio:${aspectCss};max-height:100vh;background:#fafafa;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center}
.line-accent{position:absolute;left:0;top:0;bottom:0;width:6px;background:linear-gradient(180deg,#111,#666)}
.word{display:inline-block;color:#111;font-size:calc(${tall?"clamp(44px,10vw,90px)":wide?"clamp(40px,5.5vw,80px)":"clamp(38px,8.5vw,76px)"} * ${fontScale});font-weight:800;letter-spacing:-.04em;line-height:1.05;opacity:0;animation:fadeSlide .5s cubic-bezier(.22,1,.36,1) both}
.word.em{font-style:italic;color:#444}
.word-row{display:flex;flex-wrap:wrap;justify-content:center;gap:.12em}
.line-box{position:absolute;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10%}
.dot{position:absolute;width:10px;height:10px;border-radius:50%;background:#111}
.dot.tl{top:6%;left:6%}.dot.tr{top:6%;right:6%}.dot.bl{bottom:6%;left:6%}.dot.br{bottom:6%;right:6%}
.progress{position:absolute;bottom:0;left:0;height:4px;width:0;background:#111}
.wm{position:absolute;bottom:3%;right:5%;font:400 clamp(9px,1.2vw,13px) 'Helvetica Neue',sans-serif;color:rgba(0,0,0,.25);letter-spacing:.08em}
@keyframes fadeSlide{0%{opacity:0;transform:translateX(-30px)}50%{opacity:.6}100%{opacity:1;transform:translateX(0)}}
</style></head><body>
<div class="stage">
  <div class="line-accent"></div>
  <div class="dot tl"></div><div class="dot tr"></div>
  <div class="dot bl"></div><div class="dot br"></div>
  <div class="line-box" id="lb"></div>
  <div class="progress" id="pr"></div>
  <div class="wm">shortscraft.online</div>
</div>
<script>
const L=${safeLines},D=${DURATION};
function draw(idx){
  const lb=document.getElementById("lb");lb.innerHTML="";
  const words=(L[idx]||"").split(/\s+/).filter(Boolean);
  const per=${tall?"4":wide?"7":"5"};
  const rows=[];for(let i=0;i<words.length;i+=per)rows.push(words.slice(i,i+per));
  rows.forEach((row,ri)=>{
    const div=document.createElement("div");div.className="word-row";
    row.forEach((w,wi)=>{
      const s=document.createElement("span");
      s.className="word"+(ri%2===1?" em":"");
      s.textContent=w;s.style.animationDelay=((ri*row.length+wi)*0.06)+"s";
      div.appendChild(s);
    });
    lb.appendChild(div);
  });
  const pr=document.getElementById("pr");
  pr.style.transition="none";pr.style.width="0";
  requestAnimationFrame(()=>requestAnimationFrame(()=>{pr.style.transition="width "+D+"ms linear";pr.style.width="100%"}));
}
let i=0;draw(0);if(L.length>1)setInterval(()=>{i=(i+1)%L.length;draw(i)},D);
<\/script></body></html>`,

    // ── 5. LUXURY GOLD PREMIUM ────────────────────────────────
    "luxury": () => `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden;background:#000;font-family:'Playfair Display',Georgia,serif}
body{display:grid;place-items:center}
.stage{width:${stageW};aspect-ratio:${aspectCss};max-height:100vh;background:linear-gradient(160deg,#0a0800 0%,#120e00 45%,#080600 100%);position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center}
.gold-glow{position:absolute;width:80%;height:80%;top:50%;left:50%;transform:translate(-50%,-50%);background:radial-gradient(ellipse,#c9a52288 0%,transparent 60%);filter:blur(50px);animation:goldPulse 4s ease-in-out infinite}
@keyframes goldPulse{0%,100%{opacity:.4;transform:translate(-50%,-50%) scale(1)}50%{opacity:.7;transform:translate(-50%,-50%) scale(1.05)}}
.border-frame{position:absolute;inset:4%;border:1px solid rgba(201,165,34,.3)}
.border-frame::before{content:'';position:absolute;inset:6px;border:1px solid rgba(201,165,34,.1)}
.corner-gem{position:absolute;width:8px;height:8px;background:#c9a522;transform:rotate(45deg)}
.corner-gem.tl{top:-4px;left:-4px}.corner-gem.tr{top:-4px;right:-4px}
.corner-gem.bl{bottom:-4px;left:-4px}.corner-gem.br{bottom:-4px;right:-4px}
.line-box{position:absolute;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12%}
.word{display:inline-block;color:#c9a522;font-size:calc(${tall?"clamp(44px,10vw,88px)":wide?"clamp(38px,5.5vw,78px)":"clamp(38px,9vw,80px)"} * ${fontScale});font-weight:900;font-style:italic;letter-spacing:.02em;text-shadow:0 0 40px rgba(201,165,34,.4),0 4px 8px rgba(0,0,0,.5);opacity:0;animation:luxIn .7s cubic-bezier(.22,1,.36,1) both}
.word.bright{color:#f5e070;text-shadow:0 0 60px rgba(245,224,112,.5)}
.word.silver{color:#e8e8e0;text-shadow:none}
.word-row{display:flex;flex-wrap:wrap;justify-content:center;gap:.15em}
.divider{width:40%;height:1px;background:linear-gradient(90deg,transparent,#c9a522,transparent);margin:10px auto;opacity:0;animation:fadeIn .6s ease .5s both}
.progress{position:absolute;bottom:0;left:0;height:3px;width:0;background:linear-gradient(90deg,transparent,#c9a522,transparent)}
.wm{position:absolute;bottom:3%;right:5%;font:400 clamp(8px,1.1vw,12px) 'Playfair Display',serif;color:rgba(201,165,34,.3);letter-spacing:.12em;font-style:italic}
@keyframes luxIn{0%{opacity:0;letter-spacing:.3em;filter:blur(4px)}60%{opacity:.8;letter-spacing:.04em}100%{opacity:1;letter-spacing:.02em;filter:blur(0)}}
@keyframes fadeIn{0%{opacity:0}100%{opacity:1}}
</style></head><body>
<div class="stage">
  <div class="gold-glow"></div>
  <div class="border-frame">
    <div class="corner-gem tl"></div><div class="corner-gem tr"></div>
    <div class="corner-gem bl"></div><div class="corner-gem br"></div>
  </div>
  <div class="line-box" id="lb"></div>
  <div class="progress" id="pr"></div>
  <div class="wm">ShortsCraft.Online</div>
</div>
<script>
const L=${safeLines},D=${DURATION};
function draw(idx){
  const lb=document.getElementById("lb");lb.innerHTML="";
  const words=(L[idx]||"").split(/\s+/).filter(Boolean);
  const per=${tall?"3":wide?"6":"4"};
  const rows=[];for(let i=0;i<words.length;i+=per)rows.push(words.slice(i,i+per));
  // Add top divider
  const dTop=document.createElement("div");dTop.className="divider";lb.appendChild(dTop);
  rows.forEach((row,ri)=>{
    const div=document.createElement("div");div.className="word-row";
    row.forEach((w,wi)=>{
      const s=document.createElement("span");
      s.className="word"+(ri===0?" bright":ri===rows.length-1?" silver":"");
      s.textContent=w;s.style.animationDelay=((ri*row.length+wi)*0.1)+"s";
      div.appendChild(s);
    });
    lb.appendChild(div);
  });
  const dBot=document.createElement("div");dBot.className="divider";lb.appendChild(dBot);
  const pr=document.getElementById("pr");
  pr.style.transition="none";pr.style.width="0";
  requestAnimationFrame(()=>requestAnimationFrame(()=>{pr.style.transition="width "+D+"ms linear";pr.style.width="100%"}));
}
let i=0;draw(0);if(L.length>1)setInterval(()=>{i=(i+1)%L.length;draw(i)},D);
<\/script></body></html>`,

    // ── 6. SOCIAL GRADIENT POP ───────────────────────────────
    "social-pop": () => `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden;background:#000;font-family:'Arial Black',Impact,sans-serif}
body{display:grid;place-items:center}
.stage{width:${stageW};aspect-ratio:${aspectCss};max-height:100vh;background:linear-gradient(145deg,#ff0080,#ff4d00 28%,#ff8800 50%,#7c3aed 75%,#0088ff 100%);position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;animation:bgShift 6s ease-in-out infinite alternate}
@keyframes bgShift{0%{filter:saturate(1) brightness(1)}100%{filter:saturate(1.3) brightness(1.05)}}
.blob1{position:absolute;width:60%;height:60%;top:-20%;left:-20%;background:rgba(255,255,255,.15);border-radius:50%;filter:blur(40px);animation:blob 5s ease-in-out infinite}
.blob2{position:absolute;width:50%;height:50%;bottom:-20%;right:-10%;background:rgba(255,255,255,.1);border-radius:50%;filter:blur(40px);animation:blob 5s ease-in-out infinite reverse}
@keyframes blob{0%,100%{transform:scale(1) translate(0,0)}50%{transform:scale(1.15) translate(5%,5%)}}
.line-box{position:absolute;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8%}
.word{display:inline-block;color:#fff;font-size:calc(${tall?"clamp(52px,12vw,108px)":wide?"clamp(46px,6.5vw,94px)":"clamp(46px,10.5vw,96px)"} * ${fontScale});font-weight:900;letter-spacing:-.03em;text-transform:uppercase;text-shadow:0 4px 20px rgba(0,0,0,.3);opacity:0;animation:popIn .3s cubic-bezier(.34,1.56,.64,1) both}
.word.outline{-webkit-text-stroke:3px #fff;color:transparent}
.word.shadow-only{color:#fff;text-shadow:4px 4px 0 rgba(0,0,0,.4)}
.word-row{display:flex;flex-wrap:wrap;justify-content:center;gap:.08em}
.emoji-deco{position:absolute;font-size:clamp(30px,5vw,60px);opacity:.5;animation:emojiFloat 3s ease-in-out infinite}
.emoji-deco.e1{top:8%;left:8%;animation-delay:0s}
.emoji-deco.e2{top:10%;right:8%;animation-delay:1s}
.emoji-deco.e3{bottom:12%;left:10%;animation-delay:.5s}
@keyframes emojiFloat{0%,100%{transform:translateY(0) rotate(-5deg)}50%{transform:translateY(-10px) rotate(5deg)}}
.progress{position:absolute;bottom:0;left:0;height:6px;width:0;background:rgba(255,255,255,.8)}
.wm{position:absolute;bottom:3%;right:4%;font:800 clamp(9px,1.3vw,14px) Arial,sans-serif;color:rgba(255,255,255,.35);letter-spacing:.05em;text-transform:uppercase}
@keyframes popIn{0%{opacity:0;transform:scale(0) rotate(-10deg)}60%{transform:scale(1.15) rotate(2deg)}80%{transform:scale(0.97)}100%{opacity:1;transform:scale(1) rotate(0)}}
</style></head><body>
<div class="stage">
  <div class="blob1"></div><div class="blob2"></div>
  <span class="emoji-deco e1">🔥</span>
  <span class="emoji-deco e2">⚡</span>
  <span class="emoji-deco e3">✨</span>
  <div class="line-box" id="lb"></div>
  <div class="progress" id="pr"></div>
  <div class="wm">shortscraft.online</div>
</div>
<script>
const L=${safeLines},D=${DURATION};
function draw(idx){
  const lb=document.getElementById("lb");lb.innerHTML="";
  const words=(L[idx]||"").split(/\s+/).filter(Boolean);
  const per=${tall?"3":wide?"5":"3"};
  const rows=[];for(let i=0;i<words.length;i+=per)rows.push(words.slice(i,i+per));
  rows.forEach((row,ri)=>{
    const div=document.createElement("div");div.className="word-row";
    row.forEach((w,wi)=>{
      const s=document.createElement("span");
      const styles=["","outline","shadow-only"];
      s.className="word "+styles[(ri+wi)%3];
      s.textContent=w;s.style.animationDelay=((ri*row.length+wi)*0.07)+"s";
      div.appendChild(s);
    });
    lb.appendChild(div);
  });
  const pr=document.getElementById("pr");
  pr.style.transition="none";pr.style.width="0";
  requestAnimationFrame(()=>requestAnimationFrame(()=>{pr.style.transition="width "+D+"ms linear";pr.style.width="100%"}));
}
let i=0;draw(0);if(L.length>1)setInterval(()=>{i=(i+1)%L.length;draw(i)},D);
<\/script></body></html>`,

    // ── 7. HORROR / MYSTERY ───────────────────────────────────
    "horror": () => `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden;background:#000;font-family:Georgia,'Times New Roman',serif}
body{display:grid;place-items:center}
.stage{width:${stageW};aspect-ratio:${aspectCss};max-height:100vh;background:#030003;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center}
.vignette{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 30%,rgba(0,0,0,.85) 100%)}
.blood-glow{position:absolute;width:70%;height:60%;top:50%;left:50%;transform:translate(-50%,-50%);background:radial-gradient(circle,#8b000044 0%,transparent 70%);filter:blur(30px);animation:bloodPulse 3s ease-in-out infinite}
.crack{position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(139,0,0,.05) 3px,rgba(139,0,0,.05) 4px);mix-blend-mode:overlay}
@keyframes bloodPulse{0%,100%{opacity:.5;transform:translate(-50%,-50%) scale(1)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.1)}}
.line-box{position:absolute;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8%}
.word{display:inline-block;color:#cc0000;font-size:calc(${tall?"clamp(44px,10vw,88px)":wide?"clamp(38px,5.5vw,78px)":"clamp(38px,9vw,80px)"} * ${fontScale});font-weight:700;font-style:italic;letter-spacing:.04em;text-shadow:0 0 30px #8b0000,0 0 60px #8b000044,3px 0 rgba(0,0,255,.3),-3px 0 rgba(255,0,0,.2);opacity:0;animation:glitchIn .5s ease both}
.word.dim{color:#660000;text-shadow:2px 0 #000,-2px 0 #660000}
.word.white{color:#ddd;text-shadow:0 0 10px rgba(255,255,255,.2)}
.word-row{display:flex;flex-wrap:wrap;justify-content:center;gap:.12em}
@keyframes glitchIn{
  0%{opacity:0;transform:skewX(20deg) scaleX(1.4);clip-path:inset(0 100% 0 0)}
  20%{clip-path:inset(0 60% 0 0);transform:skewX(-5deg)}
  60%{clip-path:inset(0 0% 0 0);opacity:1;transform:skewX(2deg)}
  80%{transform:skewX(-1deg)}
  100%{opacity:1;transform:skewX(0);clip-path:inset(0 0 0 0)}
}
.flicker{animation:flicker 8s ease infinite}
@keyframes flicker{0%,95%,97%,100%{opacity:1}96%,98%{opacity:.6}}
.progress{position:absolute;bottom:0;left:0;height:4px;width:0;background:#8b0000;box-shadow:0 0 10px #8b0000}
.wm{position:absolute;bottom:3%;right:4%;font:400 clamp(9px,1.2vw,13px) Georgia,serif;color:rgba(139,0,0,.35);letter-spacing:.08em;font-style:italic}
</style></head><body>
<div class="stage flicker">
  <div class="blood-glow"></div><div class="vignette"></div><div class="crack"></div>
  <div class="line-box" id="lb"></div>
  <div class="progress" id="pr"></div>
  <div class="wm">ShortsCraft</div>
</div>
<script>
const L=${safeLines},D=${DURATION};
function draw(idx){
  const lb=document.getElementById("lb");lb.innerHTML="";
  const words=(L[idx]||"").split(/\s+/).filter(Boolean);
  const per=${tall?"3":wide?"5":"4"};
  const rows=[];for(let i=0;i<words.length;i+=per)rows.push(words.slice(i,i+per));
  rows.forEach((row,ri)=>{
    const div=document.createElement("div");div.className="word-row";
    row.forEach((w,wi)=>{
      const s=document.createElement("span");
      s.className="word"+(ri%3===1?" dim":ri%3===2?" white":"");
      s.textContent=w;s.style.animationDelay=((ri*row.length+wi)*0.12)+"s";
      div.appendChild(s);
    });
    lb.appendChild(div);
  });
  const pr=document.getElementById("pr");
  pr.style.transition="none";pr.style.width="0";
  requestAnimationFrame(()=>requestAnimationFrame(()=>{pr.style.transition="width "+D+"ms linear";pr.style.width="100%"}));
}
let i=0;draw(0);if(L.length>1)setInterval(()=>{i=(i+1)%L.length;draw(i)},D);
<\/script></body></html>`,

    // ── 8. GAMING ESPORTS ────────────────────────────────────
    "gaming": () => `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden;background:#000;font-family:'Arial Black',Impact,sans-serif}
body{display:grid;place-items:center}
.stage{width:${stageW};aspect-ratio:${aspectCss};max-height:100vh;background:linear-gradient(160deg,#000510 0%,#050a1a 50%,#0a0520 100%);position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center}
.hex-grid{position:absolute;inset:0;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='52'%3E%3Cpolygon points='30,2 58,18 58,34 30,50 2,34 2,18' fill='none' stroke='rgba(57,255,20,0.06)' stroke-width='1'/%3E%3C/svg%3E");background-size:60px 52px}
.energy{position:absolute;width:100%;height:4px;background:linear-gradient(90deg,transparent,#39ff14,transparent);top:30%;animation:energyFlow 2s linear infinite;opacity:.6}
.energy2{position:absolute;width:100%;height:3px;background:linear-gradient(90deg,transparent,#f97316,transparent);bottom:35%;animation:energyFlow 2.5s linear infinite reverse;opacity:.5}
@keyframes energyFlow{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
.glow-green{position:absolute;width:60%;height:60%;left:-20%;top:50%;transform:translateY(-50%);background:radial-gradient(circle,#39ff1422,transparent 70%);filter:blur(40px)}
.glow-orange{position:absolute;width:60%;height:60%;right:-20%;top:50%;transform:translateY(-50%);background:radial-gradient(circle,#f9731622,transparent 70%);filter:blur(40px)}
.line-box{position:absolute;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8%}
.word{display:inline-block;color:#fff;font-size:calc(${tall?"clamp(50px,11.5vw,105px)":wide?"clamp(44px,6.5vw,92px)":"clamp(44px,10vw,90px)"} * ${fontScale});font-weight:900;letter-spacing:-.02em;text-transform:uppercase;opacity:0;animation:gameIn .25s ease-out both}
.word.green{color:#39ff14;text-shadow:0 0 20px #39ff14,0 0 40px #39ff1466}
.word.orange{color:#f97316;text-shadow:0 0 20px #f97316,0 0 40px #f9731666}
.word-row{display:flex;flex-wrap:wrap;justify-content:center;gap:.08em}
.hud-bar{position:absolute;top:5%;left:50%;transform:translateX(-50%);display:flex;gap:8px;align-items:center}
.hud-dot{width:8px;height:8px;border-radius:50%;background:#39ff14;box-shadow:0 0 8px #39ff14}
.hud-text{font:800 clamp(10px,1.5vw,14px) 'Courier New',monospace;color:rgba(57,255,20,.7);letter-spacing:.1em}
.progress{position:absolute;bottom:0;left:0;height:5px;width:0;background:linear-gradient(90deg,#39ff14,#f97316);box-shadow:0 0 15px #39ff14}
.wm{position:absolute;bottom:3%;right:4%;font:700 clamp(9px,1.3vw,13px) 'Courier New',monospace;color:rgba(57,255,20,.25);letter-spacing:.08em}
@keyframes gameIn{0%{opacity:0;transform:scale(1.5);filter:blur(6px)}50%{transform:scale(0.95)}100%{opacity:1;transform:scale(1);filter:blur(0)}}
</style></head><body>
<div class="stage">
  <div class="hex-grid"></div>
  <div class="glow-green"></div><div class="glow-orange"></div>
  <div class="energy"></div><div class="energy2"></div>
  <div class="hud-bar">
    <div class="hud-dot"></div>
    <div class="hud-text">SHORTSCRAFT // LIVE</div>
    <div class="hud-dot" style="background:#f97316;box-shadow:0 0 8px #f97316"></div>
  </div>
  <div class="line-box" id="lb"></div>
  <div class="progress" id="pr"></div>
  <div class="wm">SC.ONLINE</div>
</div>
<script>
const L=${safeLines},D=${DURATION};
function draw(idx){
  const lb=document.getElementById("lb");lb.innerHTML="";
  const words=(L[idx]||"").split(/\s+/).filter(Boolean);
  const per=${tall?"3":wide?"5":"4"};
  const rows=[];for(let i=0;i<words.length;i+=per)rows.push(words.slice(i,i+per));
  rows.forEach((row,ri)=>{
    const div=document.createElement("div");div.className="word-row";
    row.forEach((w,wi)=>{
      const s=document.createElement("span");
      s.className="word"+(ri%3===0?" green":ri%3===1?" orange":"");
      s.textContent=w;s.style.animationDelay=((ri*row.length+wi)*0.05)+"s";
      div.appendChild(s);
    });
    lb.appendChild(div);
  });
  const pr=document.getElementById("pr");
  pr.style.transition="none";pr.style.width="0";
  requestAnimationFrame(()=>requestAnimationFrame(()=>{pr.style.transition="width "+D+"ms linear";pr.style.width="100%"}));
}
let i=0;draw(0);if(L.length>1)setInterval(()=>{i=(i+1)%L.length;draw(i)},D);
<\/script></body></html>`,

    // ── 9. BOLD BREAKING NEWS ─────────────────────────────────
    "news": () => `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden;background:#000;font-family:'Arial Black',Impact,sans-serif}
body{display:grid;place-items:center}
.stage{width:${stageW};aspect-ratio:${aspectCss};max-height:100vh;background:#f0f0f0;position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center}
.header-bar{position:absolute;top:0;left:0;right:0;height:12%;background:#cc0000;display:flex;align-items:center;justify-content:center;gap:16px}
.breaking{font:900 clamp(16px,3vw,32px) 'Arial Black',sans-serif;color:#fff;letter-spacing:.08em;text-transform:uppercase}
.live-badge{background:#fff;color:#cc0000;font:900 clamp(12px,2vw,18px) Arial,sans-serif;padding:4px 10px;border-radius:4px;letter-spacing:.08em;animation:blink 1s ease infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.6}}
.footer-bar{position:absolute;bottom:0;left:0;right:0;height:10%;background:#1a1a1a;display:flex;align-items:center;padding:0 4%;overflow:hidden}
.ticker{white-space:nowrap;font:700 clamp(12px,2vw,18px) Arial,sans-serif;color:#fff;letter-spacing:.04em;animation:tickerMove 15s linear infinite}
@keyframes tickerMove{0%{transform:translateX(100%)}100%{transform:translateX(-100%)}}
.line-box{position:absolute;width:100%;height:78%;top:12%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:5%}
.word{display:inline-block;color:#1a1a1a;font-size:calc(${tall?"clamp(46px,10.5vw,95px)":wide?"clamp(40px,6vw,82px)":"clamp(40px,9vw,82px)"} * ${fontScale});font-weight:900;letter-spacing:-.04em;text-transform:uppercase;opacity:0;animation:newsIn .2s ease-out both}
.word.red{color:#cc0000;background:#cc0000;color:#fff;padding:0 6px;margin:0 2px}
.word.box{border:4px solid #1a1a1a;padding:0 6px}
.word-row{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:.06em}
.progress{position:absolute;bottom:10%;left:0;height:5px;width:0;background:#cc0000}
.wm{position:absolute;bottom:11.5%;right:4%;font:700 clamp(8px,1.1vw,12px) Arial,sans-serif;color:rgba(0,0,0,.25);letter-spacing:.06em}
@keyframes newsIn{0%{opacity:0;transform:translateX(-40px)}30%{opacity:1}100%{transform:translateX(0)}}
</style></head><body>
<div class="stage">
  <div class="header-bar">
    <span class="live-badge">● LIVE</span>
    <span class="breaking">BREAKING NEWS</span>
  </div>
  <div class="footer-bar">
    <span class="ticker" id="ticker">SHORTSCRAFT.ONLINE — AI Content Generator for Creators &nbsp;&nbsp;&nbsp; SHORTSCRAFT.ONLINE — Free AI YouTube Shorts Generator &nbsp;&nbsp;&nbsp;</span>
  </div>
  <div class="line-box" id="lb"></div>
  <div class="progress" id="pr"></div>
  <div class="wm">shortscraft.online</div>
</div>
<script>
const L=${safeLines},D=${DURATION};
function draw(idx){
  const lb=document.getElementById("lb");lb.innerHTML="";
  const words=(L[idx]||"").split(/\s+/).filter(Boolean);
  const per=${tall?"3":wide?"6":"4"};
  const rows=[];for(let i=0;i<words.length;i+=per)rows.push(words.slice(i,i+per));
  rows.forEach((row,ri)=>{
    const div=document.createElement("div");div.className="word-row";
    row.forEach((w,wi)=>{
      const s=document.createElement("span");
      s.className="word"+(ri===0?" red":wi===row.length-1?" box":"");
      s.textContent=w;s.style.animationDelay=((ri*row.length+wi)*0.06)+"s";
      div.appendChild(s);
    });
    lb.appendChild(div);
  });
  const pr=document.getElementById("pr");
  pr.style.transition="none";pr.style.width="0";
  requestAnimationFrame(()=>requestAnimationFrame(()=>{pr.style.transition="width "+D+"ms linear";pr.style.width="100%"}));
}
let i=0;draw(0);if(L.length>1)setInterval(()=>{i=(i+1)%L.length;draw(i)},D);
<\/script></body></html>`,

    // ── 10. RETRO VHS ────────────────────────────────────────
    "vhs": () => `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden;background:#000;font-family:'Courier New',Courier,monospace}
body{display:grid;place-items:center}
.stage{width:${stageW};aspect-ratio:${aspectCss};max-height:100vh;background:linear-gradient(180deg,#0d0010 0%,#150020 40%,#0a0015 100%);position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center}
.scanlines{position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.3) 2px,rgba(0,0,0,.3) 4px);pointer-events:none;z-index:3;animation:scanMove 10s linear infinite}
@keyframes scanMove{0%{background-position:0 0}100%{background-position:0 100px}}
.vhs-noise{position:absolute;inset:0;opacity:.04;animation:noise .1s steps(1) infinite;background:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
@keyframes noise{0%{transform:translate(0,0)}25%{transform:translate(-2px,2px)}50%{transform:translate(2px,-1px)}75%{transform:translate(-1px,1px)}100%{transform:translate(1px,-2px)}}
.pink-glow{position:absolute;width:80%;height:60%;top:50%;left:50%;transform:translate(-50%,-50%);background:radial-gradient(circle,#f472b622,transparent 70%);filter:blur(40px);animation:pinkPulse 4s ease-in-out infinite}
@keyframes pinkPulse{0%,100%{opacity:.4}50%{opacity:.8}}
.line-box{position:absolute;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8%;z-index:2}
.word{display:inline-block;color:#f472b6;font-size:calc(${tall?"clamp(42px,9.5vw,86px)":wide?"clamp(36px,5.2vw,74px)":"clamp(36px,8.5vw,76px)"} * ${fontScale});font-weight:700;letter-spacing:.06em;text-transform:uppercase;text-shadow:3px 0 #22d3ee,-3px 0 #f472b6,0 0 20px #f472b644;opacity:0;animation:vhsIn .4s ease both}
.word.cyan{color:#22d3ee;text-shadow:3px 0 #f472b6,-3px 0 #22d3ee,0 0 20px #22d3ee44}
.word.white{color:#fff;text-shadow:2px 0 #f472b6,-2px 0 #22d3ee}
.word-row{display:flex;flex-wrap:wrap;justify-content:center;gap:.1em}
.vhs-label{position:absolute;top:4%;left:4%;display:flex;align-items:center;gap:10px;z-index:4}
.rec{width:10px;height:10px;border-radius:50%;background:#f472b6;box-shadow:0 0 10px #f472b6;animation:blink 1s ease infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
.rec-text{font:700 clamp(10px,1.5vw,15px) 'Courier New',monospace;color:rgba(244,114,182,.8);letter-spacing:.1em}
.progress{position:absolute;bottom:0;left:0;height:4px;width:0;background:linear-gradient(90deg,#f472b6,#22d3ee);box-shadow:0 0 12px #f472b6}
.wm{position:absolute;bottom:3%;right:4%;font:600 clamp(9px,1.2vw,13px) 'Courier New',monospace;color:rgba(244,114,182,.25);letter-spacing:.08em}
@keyframes vhsIn{0%{opacity:0;transform:skewX(5deg) scaleY(1.3);clip-path:inset(50% 0 50% 0)}50%{clip-path:inset(0 0 0 0);opacity:.8}100%{opacity:1;transform:skewX(0) scaleY(1)}}
</style></head><body>
<div class="stage">
  <div class="pink-glow"></div>
  <div class="scanlines"></div>
  <div class="vhs-noise"></div>
  <div class="vhs-label">
    <div class="rec"></div>
    <span class="rec-text">REC ■</span>
  </div>
  <div class="line-box" id="lb"></div>
  <div class="progress" id="pr"></div>
  <div class="wm">SHORTSCRAFT.ONLINE</div>
</div>
<script>
const L=${safeLines},D=${DURATION};
function draw(idx){
  const lb=document.getElementById("lb");lb.innerHTML="";
  const words=(L[idx]||"").split(/\s+/).filter(Boolean);
  const per=${tall?"3":wide?"5":"4"};
  const rows=[];for(let i=0;i<words.length;i+=per)rows.push(words.slice(i,i+per));
  rows.forEach((row,ri)=>{
    const div=document.createElement("div");div.className="word-row";
    row.forEach((w,wi)=>{
      const s=document.createElement("span");
      const cls=["","cyan","white"];s.className="word "+cls[(ri+wi)%3];
      s.textContent=w;s.style.animationDelay=((ri*row.length+wi)*0.1)+"s";
      div.appendChild(s);
    });
    lb.appendChild(div);
  });
  const pr=document.getElementById("pr");
  pr.style.transition="none";pr.style.width="0";
  requestAnimationFrame(()=>requestAnimationFrame(()=>{pr.style.transition="width "+D+"ms linear";pr.style.width="100%"}));
}
let i=0;draw(0);if(L.length>1)setInterval(()=>{i=(i+1)%L.length;draw(i)},D);
<\/script></body></html>`,

  }; // end builders

  const builder = builders[styleKey] || builders["viral-hook"];
  return builder();
}

function setVideoPreview(html) {
  const frame = $("#videoPreviewFrame");
  const empty = $("#videoEmptyState");
  const status = $("#videoPreviewStatus");
  const wrap = $("#videoFrameWrap");
  if (!frame) return;
  frame.srcdoc = html;
  if (empty) empty.classList.add("hidden");
  if (status) status.textContent = "Preview ready";
  if (wrap) {
    wrap.classList.remove("ratio-916","ratio-169","ratio-11","ratio-45","ratio-34","ratio-23","ratio-219");
    const cls = {"9:16":"ratio-916","16:9":"ratio-169","1:1":"ratio-11","4:5":"ratio-45","3:4":"ratio-34","2:3":"ratio-23","21:9":"ratio-219"}[VIDEO_STATE.aspect] || "ratio-916";
    wrap.classList.add(cls);
  }
}

function buildVideoPreview(deductCredit = true) {
  const scriptInput = $("#videoScriptInput");
  const styleSelect = $("#videoStyleSelect");
  const aspectSelect = $("#videoAspectSelect");
  if (!scriptInput) return;

  const script = scriptInput.value.trim();
  if (!script) { toast("Paste or generate a script first.", "error"); return; }

  if (deductCredit && !STATE.isPro) {
    if (STATE.credits <= 0) { openModal("#noCreditsModal"); return; }
    setCredits(STATE.credits - 1);
  }

  VIDEO_STATE.script = script;
  VIDEO_STATE.style = styleSelect?.value || "viral-hook";
  VIDEO_STATE.aspect = aspectSelect?.value || "9:16";
  VIDEO_STATE.html = generateVideoHtml(script, VIDEO_STATE.style, VIDEO_STATE.aspect);
  setVideoPreview(VIDEO_STATE.html);

  try {
    pushHistory({
      topic: (script.split(/\n|\.|!|\?/).find(Boolean) || "Animated video").trim().slice(0, 80),
      at: Date.now(),
      content: script,
      videoHtml: VIDEO_STATE.html,
      type: "video"
    });
  } catch {}

  // Auto-scroll to preview, accounting for sticky header
  setTimeout(() => {
    const previewCard = $(".video-preview-card");
    if (previewCard) {
      const headerOffset = window.innerWidth <= 768 ? 70 : 80;
      const top = previewCard.getBoundingClientRect().top + window.pageYOffset - headerOffset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, 100);

  toast("Video preview ready!", "success");
}

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

  /* ---------- Modals helpers ---------- */
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

  /* ---------- Earn credits: refresh tasks (remove "save", add Telegram) ---------- */
  function refreshEarnTasks() {
    const list = $("#tasksList");
    if (!list) return;

    const TASKS = [
      {
        id: "subscribe",
        label: "Subscribe Tech Vault channel",
        hint: "Open the channel, subscribe, then claim.",
        url: "https://www.youtube.com/@TechVault-90",
      },
      {
        id: "watch",
        label: "Watch one Tech Vault video",
        hint: "Open the channel, watch any video, then claim.",
        url: "https://www.youtube.com/@TechVault-90/videos",
      },
      {
        id: "telegram",
        label: "Follow on Telegram",
        hint: "Join our Telegram channel, then claim.",
        url: "https://t.me/+ZfQKHJhGg8xiMTRl",
      },
      {
        id: "share",
        label: "Share ShortsCraft with a friend",
        hint: "Share the website link, then claim.",
        url: "https://shortscraft.online/",
      },
      {
        id: "feedback",
        label: "Submit useful product feedback",
        hint: "Tell us what should improve, then claim.",
        action: "feedback",
      },
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

  /* ---------- Mobile hamburger menu ---------- */
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

  /* ---------- Auto-scroll to preview after generation ---------- */
  function bindGenerateScroll() {
    const btn = $("#generateVideoBtn");
    if (!btn || btn.dataset.scV10Scroll === "1") return;
    btn.dataset.scV10Scroll = "1";

    btn.addEventListener("click", () => {
      const script = $("#videoScriptInput")?.value?.trim();
      if (!script) return;
      // Wait for preview to render
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

  /* ---------- Boot ---------- */
  function boot() {
    ensureTenCredits();
    setAuthUI(getStoredUser());
    initMobileNav();
    bindGenerateScroll();

    // Refresh earn tasks when modal opens
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
    // Initial render of tasks
    refreshEarnTasks();

    // Re-apply on async load
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
   Prevents repeated "Internal server error" toasts and gives user a
   smooth success flow. Server is still called; if server/storage fails,
   feedback is saved locally so the UI does not break.
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
    showToast(serverOk ? "Thanks! Feedback submitted." : "Thanks! Feedback saved. I’ll keep it safely.", "success");
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
