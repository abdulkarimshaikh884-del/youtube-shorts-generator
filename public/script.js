/* ============================================================
   ShortsCraft v2.0 — Frontend logic
   ============================================================ */
(() => {
"use strict";

// ── Tiny helpers ─────────────────────────────────────────────
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);
const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ── State ────────────────────────────────────────────────────
const STATE = {
  user: null,
  isPro: false,
  credits: 5,
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
  TASKS: "sc:tasks:v2",
};

// ── Toast ────────────────────────────────────────────────────
function toast(msg, type = "info", ms = 3200) {
  const wrap = $("#toasts");
  if (!wrap) return console.log(`[${type}]`, msg);
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  const icons = { success: "✅", error: "⚠️", info: "💡" };
  el.innerHTML = `<span class="toast-icon">${icons[type] || "💡"}</span><span>${escapeHtml(msg)}</span>`;
  wrap.appendChild(el);
  setTimeout(() => {
    el.classList.add("fade-out");
    setTimeout(() => el.remove(), 320);
  }, ms);
}
window.scToast = toast;

// ── Fetch helpers ────────────────────────────────────────────
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
    if (!r.ok || data.success === false) {
      throw new Error(data.error || `Request failed (${r.status})`);
    }
    return data;
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new Error(err.message || "Network error");
  }
}

// ── Load config + Supabase ───────────────────────────────────
async function loadConfig() {
  try {
    try { localStorage.removeItem("sc:local-user:v2"); } catch {}
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
}

// ── Auth UI updates ──────────────────────────────────────────
function handleSignedIn(user) {
  STATE.user = user;
  const meta = user.user_metadata || {};
  const name = meta.full_name || meta.name || user.email?.split("@")[0] || "Creator";
  const email = user.email || "";
  const avatarUrl = meta.avatar_url || meta.picture || "";
  const initial = (name[0] || "C").toUpperCase();

  $("#loginBtn")?.classList.add("hidden");
  $("#profileWrap")?.classList.remove("hidden");
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
  toast(`Welcome back, ${name}!`, "success");
  loadCloudData();
}

function handleSignedOut() {
  STATE.user = null;
  STATE.isPro = false;
  $("#loginBtn")?.classList.remove("hidden");
  $("#profileWrap")?.classList.add("hidden");
}

// ── Credits ──────────────────────────────────────────────────
function loadCredits() {
  const today = new Date().toISOString().slice(0, 10);
  const day = localStorage.getItem(LS_KEYS.CREDITS_DAY);
  if (day !== today) {
    const max = STATE.config?.freeCreditsPerDay || 5;
    localStorage.setItem(LS_KEYS.CREDITS_DAY, today);
    localStorage.setItem(LS_KEYS.CREDITS, String(max));
    STATE.credits = max;
  } else {
    STATE.credits = parseInt(localStorage.getItem(LS_KEYS.CREDITS) || "5", 10);
  }
  renderCredits();
}
function setCredits(n) {
  STATE.credits = Math.max(0, n);
  localStorage.setItem(LS_KEYS.CREDITS, String(STATE.credits));
  renderCredits();
}
function renderCredits() {
  const pill = $("#creditsPill");
  if (pill) pill.classList.remove("hidden");
  const c = $("#creditsCount");
  if (c) c.textContent = STATE.isPro ? "∞" : STATE.credits;
  const ic = $("#creditsInfoCount");
  if (ic) ic.textContent = STATE.isPro ? "Unlimited" : STATE.credits;
}

// ── History & Saved (local) ──────────────────────────────────
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
window.scSaveLocalLists = saveLocalLists;
function renderLists() {
  const hList = $("#historyList");
  const sList = $("#savedList");

  const actionButtons = (kind, i) => `
    <div class="sb-actions">
      ${kind === "history" ? `<button class="sb-mini save" data-action="save" data-kind="${kind}" data-idx="${i}" title="Save this script" aria-label="Save this script">♡</button>` : ""}
      <button class="sb-mini del" data-action="delete" data-kind="${kind}" data-idx="${i}" title="Delete this item" aria-label="Delete this item">×</button>
    </div>`;

  if (hList) {
    hList.innerHTML = STATE.history.length
      ? STATE.history.map((h, i) => `
          <div class="sb-item" data-idx="${i}" data-kind="history">
            <div class="sb-item-main">
              <b>${escapeHtml(h.topic || "Untitled script")}</b>
              <span>${new Date(h.at || Date.now()).toLocaleString()}</span>
            </div>
            ${actionButtons("history", i)}
          </div>`).join("")
      : `<div class="sb-empty">🎬<p>No scripts yet.<br>Generate one!</p></div>`;
  }

  if (sList) {
    sList.innerHTML = STATE.saved.length
      ? STATE.saved.map((h, i) => `
          <div class="sb-item" data-idx="${i}" data-kind="saved">
            <div class="sb-item-main">
              <b>${escapeHtml(h.topic || "Saved script")}</b>
              <span>Saved ${new Date(h.at || Date.now()).toLocaleDateString()}</span>
            </div>
            ${actionButtons("saved", i)}
          </div>`).join("")
      : `<div class="sb-empty">🔖<p>No saved scripts.<br>Click ♡ to save.</p></div>`;
  }

  $$(".sb-mini").forEach((btn) =>
    on(btn, "click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const kind = btn.dataset.kind;
      const idx = parseInt(btn.dataset.idx, 10);
      const list = kind === "saved" ? STATE.saved : STATE.history;
      const item = list[idx];
      if (!item) return;

      if (btn.dataset.action === "delete") {
        list.splice(idx, 1);
        saveLocalLists();
        renderLists();
        toast(kind === "saved" ? "Saved script deleted." : "History item deleted.", "info");
        return;
      }

      if (btn.dataset.action === "save") {
        const exists = STATE.saved.some((s) => (s.content || s.raw || "") === (item.content || item.raw || ""));
        if (!exists) {
          STATE.saved.unshift({ ...item, at: Date.now() });
          STATE.saved = STATE.saved.slice(0, 50);
          saveLocalLists();
          renderLists();
          toast("Script saved.", "success");
        } else {
          toast("Already saved.", "info");
        }
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
  // Try fetching saved scripts from Supabase if table exists
  try {
    const { data } = await STATE.supabase.from("saved_scripts").select("*").eq("user_id", STATE.user.id).order("created_at", { ascending: false }).limit(50);
    if (Array.isArray(data) && data.length) {
      STATE.saved = data.map((d) => ({ topic: d.topic, content: d.content, at: d.created_at, cloud: true }));
      renderLists();
    }
  } catch (e) { /* table may not exist; ignore */ }
}

// ── Sidebar ──────────────────────────────────────────────────
function openSidebar() { $("#sidebar")?.classList.add("open"); $("#sidebarVeil")?.classList.add("show"); }
function closeSidebar() { $("#sidebar")?.classList.remove("open"); $("#sidebarVeil")?.classList.remove("show"); }

// ── Modals ───────────────────────────────────────────────────
function openModal(sel) { $(sel)?.classList.remove("hidden"); document.body.style.overflow = "hidden"; }
function closeModal(sel) { $(sel)?.classList.add("hidden"); document.body.style.overflow = ""; }

// ── Generation ───────────────────────────────────────────────
let generating = false;

async function doGenerate() {
  if (generating) return;
  const topicInput = $("#topic");
  const topic = (topicInput?.value || "").trim();
  if (!topic) {
    toast("Type a topic first.", "error");
    topicInput?.focus();
    return;
  }
  if (topic.length < 3) {
    toast("Topic must be at least 3 characters.", "error");
    return;
  }
  if (!STATE.isPro && STATE.credits <= 0) {
    openModal("#noCreditsModal");
    return;
  }

  generating = true;
  STATE.currentTopic = topic;
  const btn = $("#generateBtn");
  const status = $("#status");
  btn.disabled = true;
  btn.querySelector(".btn-label").textContent = "Generating…";
  status.className = "status";
  status.textContent = "Crafting your content pack… ✨";
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
    status.className = "status success";
    status.textContent = "✨ Ready! Switch tabs to view all outputs.";
    toast("Content pack generated!", "success");
  } catch (err) {
    console.error(err);
    status.className = "status error";
    status.textContent = `❌ ${err.message || "Generation failed"}`;
    toast(err.message || "Generation failed. Retry.", "error");
    clearSkeletons();
  } finally {
    btn.disabled = false;
    btn.querySelector(".btn-label").textContent = "Generate ✦";
    generating = false;
  }
}

function showSkeletons() {
  const skel = `<div class="skeleton skel-line skel-w90"></div>
                <div class="skeleton skel-line skel-w70"></div>
                <div class="skeleton skel-line skel-w50"></div>`;
  ["#scriptSections", "#titlesContent", "#descContent", "#hashtagsContent", "#ideasContent", "#thumbnailContent"]
    .forEach((s) => { const el = $(s); if (el) el.innerHTML = skel; });
}
function clearSkeletons() {
  if ($("#scriptSections")) $("#scriptSections").innerHTML = `<div class="placeholder">Generation failed. Try again ⚠️</div>`;
}

// ── Parser ───────────────────────────────────────────────────
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

  // Fallbacks if AI ignored format
  if (!out.script && !out.titles.length) {
    out.script = text;
  }
  return out;
}
function splitNumbered(t) {
  return t.split(/\n+/)
    .map((l) => l.replace(/^\s*\d+[.)\]]\s*/, "").trim())
    .filter(Boolean);
}
function extractScriptFallback(text) {
  const idx = text.indexOf("[HOOK]");
  return idx >= 0 ? text.slice(idx) : "";
}

// ── Render ───────────────────────────────────────────────────
function renderAll({ script, titles, description, hashtags, ideas, thumbnail }) {
  // Script
  const sEl = $("#scriptSections");
  if (sEl) {
    if (!script) {
      sEl.innerHTML = `<div class="placeholder">No script returned.</div>`;
    } else {
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
  // Titles
  fillList("#titlesContent", titles, "🎯", "No titles");
  // Description
  const dEl = $("#descContent");
  if (dEl) dEl.innerHTML = description ? `<div class="desc-body">${escapeHtml(description)}</div>` : `<div class="placeholder">No description.</div>`;
  // Hashtags
  const hEl = $("#hashtagsContent");
  if (hEl) hEl.innerHTML = hashtags.length
    ? `<div class="hashtag-cloud">${hashtags.map((t) => `<span>${escapeHtml(t)}</span>`).join("")}</div>`
    : `<div class="placeholder">No hashtags.</div>`;
  // Ideas
  fillList("#ideasContent", ideas, "💡", "No ideas");
  // Thumbnail
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

// ── Tabs ─────────────────────────────────────────────────────
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

// ── Copy / Download ──────────────────────────────────────────
function copyText(t) {
  if (!t) { toast("Nothing to copy.", "error"); return; }
  navigator.clipboard.writeText(t).then(
    () => toast("Copied to clipboard!", "success"),
    () => toast("Copy failed.", "error")
  );
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
  const txt = `ShortsCraft — ${r.topic}\nGenerated: ${new Date().toLocaleString()}\n\n=== SCRIPT ===\n${r.script}\n\n=== TITLES ===\n${r.titles.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\n=== DESCRIPTION ===\n${r.description}\n\n=== HASHTAGS ===\n${r.hashtags.join(" ")}\n\n=== IDEAS ===\n${r.ideas.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\n=== THUMBNAIL PROMPTS ===\n${r.thumbnail.map((t, i) => `${i + 1}. ${t}`).join("\n\n")}\n`;
  const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: `shortscraft-${slug(r.topic)}.txt` });
  a.click();
  URL.revokeObjectURL(url);
  toast("Downloaded!", "success");
}
function slug(s) { return String(s || "topic").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40); }

// ── Save script ──────────────────────────────────────────────
async function saveCurrent() {
  if (!STATE.currentResults) { toast("Generate something first.", "error"); return; }
  if (!STATE.user) { toast("Sign in to save scripts.", "info"); openModal("#authModal"); return; }
  const entry = { topic: STATE.currentResults.topic, content: STATE.currentResults.raw, at: Date.now() };
  STATE.saved.unshift(entry);
  saveLocalLists();
  renderLists();
  toast("Saved! ♥", "success");

  if (STATE.supabase) {
    try {
      await STATE.supabase.from("saved_scripts").insert({ user_id: STATE.user.id, topic: entry.topic, content: entry.content });
    } catch { /* table may not exist */ }
  }
}

// ── Auth handlers ────────────────────────────────────────────
function bindAuth() {
  on($("#loginBtn"), "click", () => openModal("#authModal"));
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
    err.classList.add("hidden");
    if (!email || !pw) { err.textContent = "Enter email and password."; err.classList.remove("hidden"); return; }
    if (!STATE.supabase) {
      err.textContent = "Real sign-in is not configured. Add Supabase environment variables on Render.";
      err.classList.remove("hidden");
      return;
    }
    try {
      const { error } = await STATE.supabase.auth.signInWithPassword({ email, password: pw });
      if (error) throw error;
    } catch (e) { err.textContent = e.message; err.classList.remove("hidden"); }
  });

  on($("#signupSubmit"), "click", async () => {
    const name = $("#signupName").value.trim();
    const email = $("#signupEmail").value.trim();
    const pw = $("#signupPassword").value;
    const err = $("#signupError");
    err.classList.add("hidden");
    if (!email) { err.textContent = "Enter your email."; err.classList.remove("hidden"); return; }
    if (pw.length < 6) { err.textContent = "Password must be 6+ chars."; err.classList.remove("hidden"); return; }
    if (!STATE.supabase) {
      err.textContent = "Real sign-up is not configured. Add Supabase environment variables on Render.";
      err.classList.remove("hidden");
      return;
    }
    try {
      const { error } = await STATE.supabase.auth.signUp({ email, password: pw, options: { data: { full_name: name } } });
      if (error) throw error;
      toast("Account created! Check your email.", "success");
      closeModal("#authModal");
    } catch (e) { err.textContent = e.message; err.classList.remove("hidden"); }
  });

  on($("#logoutBtn"), "click", async () => {
    if (STATE.supabase) await STATE.supabase.auth.signOut();
    handleSignedOut();
    toast("Signed out.", "info");
  });

  on($("#avatarBtn"), "click", (e) => {
    e.stopPropagation();
    if (!STATE.user) { handleSignedOut(); return; }
    $("#profilePop")?.classList.toggle("hidden");
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#profileWrap")) $("#profilePop")?.classList.add("hidden");
  });
}
async function googleAuth() {
  if (!STATE.supabase) { toast("Real sign-in is not configured. Add Supabase environment variables on Render.", "error", 6500); return; }
  try {
    await STATE.supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/generator" }
    });
  } catch (e) { toast(e.message, "error"); }
}

// ── Razorpay upgrade ─────────────────────────────────────────
async function upgradePro() {
  if (!STATE.user) { toast("Sign in first to upgrade.", "info"); openModal("#authModal"); return; }
  if (!window.Razorpay) { toast("Payment system loading…", "error"); return; }
  const note = $("#upgradeNote");
  if (note) { note.textContent = "Creating order…"; }
  try {
    const data = await api("/api/razorpay/order", { method: "POST", body: { userId: STATE.user.id } });
    const opts = {
      key: data.keyId,
      amount: data.amount,
      currency: data.currency,
      order_id: data.orderId,
      name: "ShortsCraft Pro",
      description: "Monthly Pro subscription",
      prefill: { name: STATE.user.user_metadata?.full_name || "", email: STATE.user.email || "" },
      theme: { color: "#ff3d6e" },
      handler: async (resp) => {
        try {
          await api("/api/razorpay/verify", { method: "POST", body: resp });
          STATE.isPro = true;
          renderCredits();
          closeModal("#upgradeModal");
          toast("🎉 Welcome to Pro!", "success", 5000);
          if (STATE.supabase && STATE.user) {
            try { await STATE.supabase.from("profiles").upsert({ id: STATE.user.id, is_pro: true, pro_since: new Date().toISOString() }); } catch {}
          }
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

// ── Feedback ─────────────────────────────────────────────────
function bindFeedback() {
  const open = () => openModal("#feedbackModal");
  on($("#feedbackBtn"), "click", open);
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
      try {
        const fb = JSON.parse(localStorage.getItem("sc:feedback:v2") || "[]");
        fb.unshift({ name, email, message, at: Date.now() });
        localStorage.setItem("sc:feedback:v2", JSON.stringify(fb.slice(0, 50)));
      } catch {}
      toast("Thanks! Feedback submitted.", "success");
      closeModal("#feedbackModal");
      $("#feedbackMessage").value = "";
    } catch (e) { toast(e.message, "error"); }
  });
}

// ── Command palette ──────────────────────────────────────────
function bindCmdPalette() {
  const palette = $("#cmdPalette");
  if (!palette) return;
  const open = () => { palette.classList.remove("hidden"); $("#cmdInput").focus(); };
  const close = () => palette.classList.add("hidden");
  on($("#cmdBtn"), "click", open);
  on(document, "keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); open(); }
    if (e.key === "Escape") close();
  });
  on(palette, "click", (e) => { if (e.target === palette) close(); });
  $$("#cmdList li").forEach((li) => on(li, "click", () => {
    const a = li.dataset.action;
    close();
    runAction(a);
  }));
}
function runAction(a) {
  switch (a) {
    case "video":
      $("#videoGenerator")?.scrollIntoView({ behavior: "smooth", block: "start" });
      break;
    case "tools":
      window.location.href = "/seo-tools";
      break;
    case "generate":
      if ($("#generateBtn")) doGenerate();
      else {
        const tab = $("#videoGenerateTab");
        tab?.click();
        $("#videoTopicInput")?.focus();
      }
      break;
    case "copy": $(`#copy${capitalize(STATE.currentTab)}Btn`)?.click(); break;
    case "download": downloadTxt(); break;
    case "save": saveCurrent(); break;
    case "history": openSidebar(); break;
    case "upgrade": openModal("#upgradeModal"); break;
  }
}
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ── Earn credits / tasks ─────────────────────────────────────
function bindEarn() {
  on($("#earnCreditsLink"), "click", () => openModal("#earnModal"));
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
  try { opened = JSON.parse(localStorage.getItem("sc:tasks-opened:v2") || "{}"); } catch { opened = {}; }

  const tasks = [
    {
      id: "subscribe",
      label: "Subscribe our Tech Vault channel",
      hint: "Open the channel, subscribe, then come back to claim.",
      credits: 1,
      url: "https://www.youtube.com/@TechVault-90"
    },
    {
      id: "watch",
      label: "Watch one Tech Vault video",
      hint: "Open the channel and watch any useful creator/AI video.",
      credits: 1,
      url: "https://www.youtube.com/@TechVault-90/videos"
    },
    {
      id: "share",
      label: "Share ShortsCraft with a creator friend",
      hint: "Open/share the website link, then claim your credit.",
      credits: 1,
      url: "https://shortscraft.online/"
    },
    {
      id: "feedback",
      label: "Submit useful product feedback",
      hint: "Open feedback, write what should improve, then claim.",
      credits: 1,
      action: "feedback"
    },
    {
      id: "save",
      label: "Save your first generated script",
      hint: "Generate any script and click the small ♡ save button.",
      credits: 1,
      action: "saveCheck"
    },
  ];

  list.innerHTML = tasks.map((t) => {
    const isDone = !!done[t.id];
    const isOpened = !!opened[t.id];
    const btnText = isDone ? "Done ✓" : isOpened ? "Claim +1" : (t.action === "feedback" ? "Open feedback" : t.action === "saveCheck" ? "Check task" : "Open task");
    return `
      <div class="task premium-task ${isDone ? "task-done" : ""}">
        <div class="task-info">
          <b>${t.label}</b>
          <span>${t.hint}</span>
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
      localStorage.setItem("sc:tasks-opened:v2", JSON.stringify(opened));
      closeModal("#earnModal");
      openModal("#feedbackModal");
      renderTasks();
      return;
    }

    if (task.action === "saveCheck") {
      if (!STATE.saved || STATE.saved.length === 0) {
        toast("Save any generated script first, then claim.", "info", 4500);
        opened[id] = true;
        localStorage.setItem("sc:tasks-opened:v2", JSON.stringify(opened));
        renderTasks();
        return;
      }
    } else if (!opened[id]) {
      opened[id] = true;
      localStorage.setItem("sc:tasks-opened:v2", JSON.stringify(opened));
      if (task.url) window.open(task.url, "_blank", "noopener,noreferrer");
      toast("Task opened. Complete it, then come back and claim.", "info", 5000);
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

// ── Mobile nav + scroll bar ──────────────────────────────────
function bindNav() {
  on($("#navBurger"), "click", () => {
    const m = $("#navMobile");
    const open = m.hasAttribute("hidden") ? false : !m.classList.contains("open");
    if (m.hasAttribute("hidden")) m.removeAttribute("hidden");
    m.classList.toggle("open", !open);
    if (!m.classList.contains("open")) m.setAttribute("hidden", "");
  });
  on(window, "scroll", () => {
    const bar = $("#scrollBar");
    if (!bar) return;
    const h = document.documentElement;
    const pct = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
    bar.style.width = `${pct}%`;
  }, { passive: true });
}

// ── Mock typewriter (landing) ────────────────────────────────
function bindMockType() {
  const el = $("#mockType");
  if (!el) return;
  const phrases = [
    "AI tools se paisa kaise kamaye?",
    "Morning productivity hacks for students",
    "5 cricket tips jo coach nahi batata",
    "Stock market basics in 60 seconds",
  ];
  let i = 0;
  setInterval(() => {
    i = (i + 1) % phrases.length;
    el.style.opacity = "0";
    setTimeout(() => { el.textContent = phrases[i]; el.style.opacity = "1"; }, 200);
  }, 3500);
}

// ── Bento mouse glow ─────────────────────────────────────────
function bindBentoGlow() {
  $$(".bento-card").forEach((c) => {
    on(c, "mousemove", (e) => {
      const r = c.getBoundingClientRect();
      c.style.setProperty("--mx", `${e.clientX - r.left}px`);
      c.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  });
}

// ── Boot ─────────────────────────────────────────────────────
function bindStudio() {
  on($("#generateBtn"), "click", doGenerate);
  on($("#topic"), "keydown", (e) => { if (e.key === "Enter") doGenerate(); });
  $$(".chip[data-topic]").forEach((c) => on(c, "click", () => { $("#topic").value = c.dataset.topic; doGenerate(); }));
  on($("#regenerateBtn"), "click", doGenerate);
  on($("#downloadTxtBtn"), "click", downloadTxt);
  on($("#saveScriptBtn"), "click", saveCurrent);
  on($("#sidebarToggle"), "click", openSidebar);
  on($("#sidebarClose"), "click", closeSidebar);
  on($("#sidebarVeil"), "click", closeSidebar);
  on($("#clearHistoryBtn"), "click", () => {
    if (confirm("Clear all local history?")) {
      STATE.history = []; saveLocalLists(); renderLists();
      toast("History cleared.", "info");
    }
  });
  on($("#viewHistoryBtn"), "click", openSidebar);
  on($("#viewSavedBtn"), "click", openSidebar);
  on($("#upgradeBtn"), "click", () => openModal("#upgradeModal"));
  on($("#upgradeModalClose"), "click", () => closeModal("#upgradeModal"));
  on($("#upgradeSubmit"), "click", upgradePro);
  on($("#noCreditsModalClose"), "click", () => closeModal("#noCreditsModal"));
  $$(".modal-veil").forEach((v) => on(v, "click", (e) => { if (e.target === v) v.classList.add("hidden"); }));
  bindTabs();
  bindCopyButtons();
  bindAuth();
  bindFeedback();
  bindCmdPalette();
  
  $$(".profile-pop .pp-item, .profile-pop #earnCreditsLink").forEach((b) =>
    on(b, "click", () => $("#profilePop")?.classList.add("hidden"))
  );
  bindEarn();
}

// ── Init ─────────────────────────────────────────────────────
async function init() {
  bindNav();
  // Removed heavy landing animations/mouse glow for better performance.
  // bindMockType();
  // bindBentoGlow();
  if ($("#generateBtn") || $("#videoGenerator")) bindStudio();
  loadLocalLists();
  await loadConfig();
  if (!STATE.user) handleSignedOut();
  loadCredits();
}

document.addEventListener("DOMContentLoaded", init);
})();

/* ============================================================
   Script-to-Video Generator — Video-first upgrade
   ============================================================ */
(() => {
  "use strict";

  const qs = (s, root = document) => root.querySelector(s);
  const qsa = (s, root = document) => [...root.querySelectorAll(s)];
  const escHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const VIDEO_STATE = {
    mode: "paste",
    html: "",
    script: "",
    style: "viral-hook",
    aspect: "9:16",
    edit: {
      fontScale: 1,
      speed: 1,
      highlight: "",
      darker: false,
      minimal: false,
      premium: false,
      reduceGlitch: false
    }
  };

  const STYLE_MAP = {
    "viral-hook": {
      name: "YouTube Viral Hook",
      bg: "linear-gradient(135deg,#111827,#000)",
      text: "#ffffff",
      accent: "#ff3d6e",
      accent2: "#ffb02e",
      font: "'Arial Black', Impact, sans-serif",
      extra: ".word{text-transform:uppercase}.highlight{color:var(--highlight)}"
    },
    "clean-minimal": {
      name: "Clean Minimal White",
      bg: "linear-gradient(135deg,#ffffff,#f3f4f6)",
      text: "#111827",
      accent: "#111827",
      accent2: "#6b7280",
      font: "Inter, Arial, sans-serif",
      extra: ".highlight{background:#111827;color:#fff;border-radius:18px;padding:0 .16em;text-shadow:none}"
    },
    "neon-cyber": {
      name: "Neon Cyber Kinetic",
      bg: "radial-gradient(circle at 20% 20%,#123,transparent 32%),radial-gradient(circle at 80% 70%,#3b0764,transparent 36%),#030712",
      text: "#ffffff",
      accent: "#22d3ee",
      accent2: "#a855f7",
      font: "'Arial Black', Impact, sans-serif",
      extra: ".word{text-transform:uppercase;text-shadow:0 0 calc(32px * var(--effect)) var(--accent),0 0 calc(80px * var(--effect)) var(--accent2)}"
    },
    "motivation": {
      name: "Motivation Reel Style",
      bg: "radial-gradient(circle at 50% 20%,#334155,#020617 70%)",
      text: "#ffffff",
      accent: "#facc15",
      accent2: "#ffffff",
      font: "'Arial Black', Impact, sans-serif",
      extra: ".word{text-transform:uppercase;text-shadow:0 calc(12px * var(--effect)) 0 rgba(0,0,0,.38)}"
    },
    "podcast": {
      name: "Modern Podcast Subtitle",
      bg: "linear-gradient(180deg,#111827,#030712)",
      text: "#ffffff",
      accent: "#22c55e",
      accent2: "#ffffff",
      font: "Inter, Arial, sans-serif",
      extra: ".scene{justify-content:flex-end;padding-bottom:12vh}.word{font-size:calc(clamp(34px,6vw,78px) * var(--font-scale));background:rgba(0,0,0,.55);padding:28px 38px;border-radius:28px;line-height:1.1}"
    },
    "news": {
      name: "Bold News Style",
      bg: "linear-gradient(135deg,#0a0a0a,#111827)",
      text: "#ffffff",
      accent: "#ef233c",
      accent2: "#ffffff",
      font: "'Arial Black', Impact, sans-serif",
      extra: ".meta{background:#ef233c;color:#fff;top:0;left:0;right:0;padding:16px 28px}.word{text-transform:uppercase}.highlight{background:#ef233c;color:#fff;padding:0 .14em;text-shadow:none}"
    },
    "horror": {
      name: "Horror / Mystery Style",
      bg: "radial-gradient(circle at 50% 30%,#3f0a0a,#020202 60%)",
      text: "#e5e7eb",
      accent: "#ef4444",
      accent2: "#ffffff",
      font: "Georgia, 'Times New Roman', serif",
      extra: ".word{text-shadow:0 0 calc(24px * var(--effect)) #ef4444}.stage{animation:flicker calc(4s * var(--speed)) infinite}@keyframes flicker{0%,95%,100%{filter:brightness(1)}96%{filter:brightness(.45)}97%{filter:brightness(1.25)}}"
    },
    "luxury": {
      name: "Luxury Gold Premium",
      bg: "radial-gradient(circle at 50% 20%,#3b2f11,#050505 55%)",
      text: "#fff7d6",
      accent: "#f5c542",
      accent2: "#fff1a8",
      font: "Georgia, 'Times New Roman', serif",
      extra: ".word{font-weight:700;letter-spacing:-.035em}.highlight{font-style:italic}"
    },
    "social-pop": {
      name: "Social Gradient Pop",
      bg: "linear-gradient(135deg,#ff416c,#ff4b2b 35%,#7c3aed 75%,#06b6d4)",
      text: "#ffffff",
      accent: "#fde047",
      accent2: "#ffffff",
      font: "'Arial Black', Impact, sans-serif",
      extra: ".word{text-transform:uppercase;-webkit-text-stroke:calc(2px * var(--effect)) rgba(0,0,0,.14);text-shadow:calc(8px * var(--effect)) calc(8px * var(--effect)) 0 rgba(0,0,0,.14)}"
    },
    "documentary": {
      name: "Faceless Documentary",
      bg: "linear-gradient(rgba(0,0,0,.68),rgba(0,0,0,.76)),radial-gradient(circle at 50% 40%,#475569,#020617 70%)",
      text: "#f8fafc",
      accent: "#f59e0b",
      accent2: "#ffffff",
      font: "Inter, Arial, sans-serif",
      extra: ".word{font-size:calc(clamp(38px,7vw,98px) * var(--font-scale));letter-spacing:-.045em;text-transform:none}"
    },
    "tech-blueprint": {
      name: "Tech Explainer Blueprint",
      bg: "linear-gradient(135deg,#082f49,#020617)",
      text: "#e0f2fe",
      accent: "#7dd3fc",
      accent2: "#ffffff",
      font: "Inter, Arial, sans-serif",
      extra: ".stage::before{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(125,211,252,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(125,211,252,.12) 1px,transparent 1px);background-size:54px 54px;opacity:.8}.word{text-shadow:0 0 calc(28px * var(--effect)) rgba(125,211,252,.35)}"
    },
    "gaming": {
      name: "Gaming Esports Style",
      bg: "linear-gradient(135deg,#020617,#111827 45%,#3b0764)",
      text: "#ffffff",
      accent: "#39ff14",
      accent2: "#f97316",
      font: "'Arial Black', Impact, sans-serif",
      extra: ".word{text-transform:uppercase;transform:skew(-7deg);text-shadow:calc(5px * var(--effect)) calc(5px * var(--effect)) 0 var(--accent2),0 0 calc(34px * var(--effect)) var(--accent)}"
    },
    "classroom": {
      name: "Classroom Educational",
      bg: "linear-gradient(135deg,#064e3b,#022c22)",
      text: "#ffffff",
      accent: "#bbf7d0",
      accent2: "#ffffff",
      font: "Inter, Arial, sans-serif",
      extra: ".stage::before{content:'';position:absolute;inset:46px;border:3px solid rgba(255,255,255,.18);border-radius:28px}.word{font-weight:850}"
    },
    "vhs": {
      name: "Retro VHS Style",
      bg: "linear-gradient(135deg,#1e1b4b,#111827)",
      text: "#ffffff",
      accent: "#f472b6",
      accent2: "#22d3ee",
      font: "'Courier New', monospace",
      extra: ".word{text-transform:uppercase;text-shadow:calc(3px * var(--effect)) 0 var(--accent2),calc(-3px * var(--effect)) 0 var(--accent)}.stage::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.05) 0 1px,transparent 1px 4px);mix-blend-mode:overlay;pointer-events:none}"
    },
    "startup": {
      name: "Startup SaaS Clean",
      bg: "linear-gradient(135deg,#f8fafc,#eef2ff)",
      text: "#111827",
      accent: "#2563eb",
      accent2: "#111827",
      font: "Inter, Arial, sans-serif",
      extra: ".word{font-size:calc(clamp(44px,7vw,100px) * var(--font-scale));font-weight:850}.highlight{color:#2563eb;text-shadow:none}"
    }
  };

  function splitScript(script, aspect = "9:16") {
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
    const maxWords = tall ? 4 : square ? 6 : wide ? 8 : 6;
    const maxChars = tall ? 24 : square ? 34 : wide ? 48 : 38;
    const hardLimit = tall ? 18 : wide ? 14 : 16;

    const sentences = raw
      .split(/\n+|(?<=[.!?।])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

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
        } else {
          chunk.push(w);
        }
      });
      if (chunk.length) lines.push(chunk.join(" "));
    });

    return lines
      .map((s) => s.replace(/^[-–—]+/, "").trim())
      .filter(Boolean)
      .slice(0, hardLimit);
  }

  function parseEdits(prompt) {
    const p = String(prompt || "").toLowerCase();
    const e = VIDEO_STATE.edit;
    e.raw = p;

    if (/bigger|large|text bada|font bada|big/.test(p)) e.fontScale = 1.18;
    if (/small|text chhota|font chhota|smaller/.test(p)) e.fontScale = 0.9;
    if (/slow|slower|animation slow/.test(p)) e.speed = 1.35;
    if (/fast|faster|animation fast/.test(p)) e.speed = 0.75;

    if (/yellow|gold/.test(p)) e.highlight = "#facc15";
    else if (/\bred\b|pink/.test(p)) e.highlight = "#fb7185";
    else if (/\bblue\b|cyan/.test(p)) e.highlight = "#38bdf8";
    else if (/\bgreen\b/.test(p)) e.highlight = "#22c55e";
    else if (/purple|violet/.test(p)) e.highlight = "#a78bfa";

    if (/dark|darker|background dark|black background|night/.test(p)) e.bgMode = "dark";
    if (/light|lighter|white background|light background|bright/.test(p)) e.bgMode = "light";

    if (/minimal|simple|clean/.test(p)) e.minimal = true;
    if (/premium|luxury|smooth|professional|modern|stylish/.test(p)) e.premium = true;
    if (/glitch kam|reduce glitch|less glitch/.test(p)) e.reduceGlitch = true;
    if (/more elements|less empty|not empty|fuller|fill space|add shapes|add elements/.test(p)) e.dense = true;
    if (/left align|left side|left text/.test(p)) e.align = "left";
    if (/center|centre/.test(p)) e.align = "center";
    if (/remove top text|hide top text|no top text|remove useless text/.test(p)) e.hideTag = true;
    if (/show top text|show style/.test(p)) e.hideTag = false;
    if (/remove footer|hide footer|remove generated|no footer/.test(p)) e.hideFooter = true;
    if (/show footer/.test(p)) e.hideFooter = false;
    if (/remove number|hide number|no number/.test(p)) e.hideCounter = true;
    if (/show number/.test(p)) e.hideCounter = false;
    if (/remove brand|hide brand|no brand|remove shortscraft/.test(p)) e.hideBrand = true;
    if (/show brand/.test(p)) e.hideBrand = false;
  }

  function resetEdits() {
    VIDEO_STATE.edit = {
      fontScale: 1,
      speed: 1,
      highlight: "",
      darker: false,
      minimal: false,
      premium: false,
      reduceGlitch: false,
      bgMode: "auto",
      hideTag: true,
      hideFooter: true,
      hideCounter: false,
      hideBrand: false,
      dense: true,
      align: "center",
      raw: ""
    };
  }

  function generateVideoHtml(script, styleKey, aspect) {
    const style = STYLE_MAP[styleKey] || STYLE_MAP["viral-hook"];
    const lines = splitScript(script, aspect);
    const safeLines = JSON.stringify(lines.length ? lines : ["Paste a script first"]);
    const edit = VIDEO_STATE.edit;
    const tall = ["9:16", "4:5", "3:4", "2:3"].includes(aspect);
    const square = aspect === "1:1";
    const wide = ["16:9", "21:9"].includes(aspect);
    const highlight = edit.highlight || style.accent;
    const speed = edit.speed || 1;
    const duration = Math.max(2800, Math.round(3000 * speed));
    const total = Math.max(9000, (lines.length || 1) * duration);
    const aspectMap = {"9:16":"9/16","16:9":"16/9","1:1":"1/1","4:5":"4/5","3:4":"3/4","2:3":"2/3","21:9":"21/9"};
    const stageAspect = aspectMap[aspect] || "9/16";
    const stageWidth = wide ? "min(100vw, 1920px)" : square ? "min(100vw, 1180px)" : "min(100vw, 1080px)";

    let bg = style.bg;
    let textColor = style.text;
    if (edit.bgMode === "light") {
      bg = styleKey === "social-pop"
        ? "linear-gradient(135deg,#fff7ed,#ffe4e6 42%,#ede9fe 78%,#e0f2fe)"
        : styleKey === "neon-cyber"
        ? "linear-gradient(135deg,#ecfeff,#eef2ff 50%,#fdf2f8)"
        : "linear-gradient(135deg,#ffffff,#f8fafc 46%,#eef2ff 100%)";
      textColor = "#0f172a";
    } else if (edit.bgMode === "dark") {
      bg = "radial-gradient(circle at 20% 15%,rgba(255,255,255,.06),transparent 22%), radial-gradient(circle at 85% 80%,rgba(255,255,255,.05),transparent 20%), linear-gradient(135deg,#050816,#03040c 62%,#0b1021)";
      textColor = "#f8fafc";
    }

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ShortsCraft Premium Animated Video</title>
<style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:#000;overflow:hidden}
body{display:grid;place-items:center;font-family:${style.font};}
.stage{--accent:${style.accent};--accent2:${style.accent2};--highlight:${highlight};--text:${textColor};--font-scale:${edit.fontScale};position:relative;width:${stageWidth};aspect-ratio:${stageAspect};max-height:100vh;overflow:hidden;background:${bg};color:var(--text)}
.stage::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 15% 15%,rgba(255,255,255,.${edit.minimal ? '08':'14'}),transparent 22%),radial-gradient(circle at 85% 20%,rgba(255,255,255,.08),transparent 20%),radial-gradient(circle at 70% 84%,rgba(255,255,255,.10),transparent 18%)}
.stage::after{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);background-size:${wide ? '68px 68px':'50px 50px'};mask-image:radial-gradient(circle at 50% 45%,#000,transparent 82%);opacity:${edit.minimal ? '.10' : '.26'}}
.bg-orb,.bg-orb2,.bg-orb3{position:absolute;border-radius:50%;filter:blur(${wide ? '60px':'48px'});opacity:${edit.minimal ? '.22' : '.38'};pointer-events:none}
.bg-orb{width:38%;height:38%;left:-8%;top:-7%;background:var(--accent)}
.bg-orb2{width:44%;height:44%;right:-12%;bottom:-12%;background:var(--accent2)}
.bg-orb3{width:26%;height:26%;right:20%;top:14%;background:var(--highlight);opacity:.16}
.frame{position:absolute;inset:${wide ? '6%':'6.2%'};border-radius:${wide ? '34px':'40px'};border:1.5px solid rgba(255,255,255,.15);box-shadow:inset 0 0 0 1px rgba(255,255,255,.03), inset 0 0 80px rgba(255,255,255,.035)}
.brand{position:absolute;top:${wide ? '5.1%':'5.3%'};left:${wide ? '5.1%':'7%'};font:900 clamp(14px,2vw,25px) Inter,Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:${edit.bgMode === 'light' ? 'rgba(15,23,42,.86)' : 'rgba(255,255,255,.88)'}}
.top-meta{position:absolute;top:${wide ? '5.1%':'5.3%'};right:${wide ? '5.1%':'7%'};display:flex;align-items:center;gap:10px;font:800 clamp(11px,1.45vw,17px) Inter,Arial,sans-serif;color:${edit.bgMode === 'light' ? 'rgba(15,23,42,.68)' : 'rgba(255,255,255,.7)'}}
.top-pill{padding:8px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.08);backdrop-filter:blur(10px)}
.content{position:absolute;inset:${wide ? '14% 9% 16%':'16% 8% 15%'};display:grid;place-items:center;z-index:2}
.card{position:relative;width:min(${wide ? '74%':'86%'},${wide ? '1150px':'790px'});min-height:${wide ? '46%' : tall ? '42%' : '50%'};padding:${wide ? '38px 46px':'34px 28px'};border-radius:${wide ? '34px':'38px'};background:linear-gradient(180deg,rgba(255,255,255,.${edit.minimal ? '06':'08'}),rgba(255,255,255,.${edit.minimal ? '02':'04'}));border:1px solid rgba(255,255,255,.12);box-shadow:0 24px 90px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.08);display:grid;align-content:center;justify-items:${edit.align === 'left' ? 'start' : 'center'};text-align:${edit.align};overflow:hidden}
.card::before{content:'';position:absolute;inset:auto -8% -22% auto;width:38%;height:38%;background:radial-gradient(circle,var(--highlight),transparent 68%);opacity:${edit.premium ? '.22':'.10'};filter:blur(18px)}
.scene-top{display:flex;gap:12px;align-items:center;justify-content:${edit.align === 'left' ? 'flex-start' : 'center'};width:100%;margin-bottom:18px;flex-wrap:wrap}
.count{display:inline-flex;align-items:center;justify-content:center;min-width:60px;height:48px;padding:0 16px;border-radius:999px;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.14);font:900 clamp(12px,1.4vw,18px) Inter,Arial,sans-serif;color:var(--highlight)}
.eyebrow{font:800 clamp(12px,1.3vw,16px) Inter,Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:${edit.bgMode === 'light' ? 'rgba(15,23,42,.56)' : 'rgba(255,255,255,.64)'}}
.headline{max-width:100%;font-weight:950;letter-spacing:-.06em;line-height:.95;text-wrap:balance;text-shadow:${edit.bgMode === 'light' ? 'none' : '0 16px 48px rgba(0,0,0,.25)'}}
.subline{margin-top:16px;max-width:${wide ? '80%':'92%'};font:700 clamp(13px,1.6vw,22px) Inter,Arial,sans-serif;line-height:1.35;color:${edit.bgMode === 'light' ? 'rgba(15,23,42,.72)' : 'rgba(255,255,255,.74)'}}
.align-left .subline,.align-left .headline{text-align:left}
.align-center .subline,.align-center .headline{text-align:center}
.chips{display:flex;gap:10px;flex-wrap:wrap;justify-content:${edit.align === 'left' ? 'flex-start' : 'center'};margin-top:${edit.dense ? '18px':'8px'};width:100%}
.chip{padding:10px 14px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.10);font:800 clamp(11px,1.2vw,15px) Inter,Arial,sans-serif;color:${edit.bgMode === 'light' ? 'rgba(15,23,42,.86)' : 'rgba(255,255,255,.84)'}}
.side-stack{position:absolute;${wide ? 'right:7%;top:22%;width:180px' : 'right:7%;bottom:18%;width:120px'};display:${edit.dense ? 'grid':'none'};gap:10px;z-index:1}
.mini-card{padding:12px 14px;border-radius:18px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(12px);font:800 clamp(11px,1.15vw,14px) Inter,Arial,sans-serif;color:${edit.bgMode === 'light' ? 'rgba(15,23,42,.82)' : 'rgba(255,255,255,.86)'}}
.progress{position:absolute;left:0;bottom:0;height:6px;width:100%;background:rgba(255,255,255,.08)}
.progress>span{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--accent),var(--accent2),var(--highlight));box-shadow:0 0 24px var(--highlight)}
.corner{position:absolute;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.08);backdrop-filter:blur(12px);font:900 clamp(12px,1.2vw,14px) Inter,Arial,sans-serif;color:${edit.bgMode === 'light' ? 'rgba(15,23,42,.8)' : 'rgba(255,255,255,.8)'};padding:10px 14px}
.corner.one{left:${wide ? '7%':'8%'};bottom:${wide ? '8.5%':'8%'}}
.corner.two{right:${wide ? '7%':'8%'};bottom:${wide ? '8.5%':'8%'}}
.hl{color:var(--highlight)}
@keyframes pop{0%{opacity:0;transform:translateY(22px) scale(.96);filter:blur(12px)}100%{opacity:1;transform:translateY(0) scale(1);filter:blur(0)}}
.card.animate{animation:pop .55s cubic-bezier(.18,.8,.2,1) both}
${style.extra}
</style>
</head>
<body>
<div class="stage ${edit.align === 'left' ? 'align-left':'align-center'}">
  <div class="bg-orb"></div><div class="bg-orb2"></div><div class="bg-orb3"></div><div class="frame"></div>
  ${edit.hideBrand ? '' : '<div class="brand">SHORTSCRAFT</div>'}
  ${edit.hideTag ? '' : `<div class="top-meta"><span class="top-pill">${style.name}</span><span class="top-pill">${aspect}</span></div>`}
  <div class="content">
    <div class="card" id="card">
      <div class="scene-top">
        ${edit.hideCounter ? '' : '<span class="count" id="counter">01</span>'}
        <span class="eyebrow" id="eyebrow">Premium video layout</span>
      </div>
      <div class="headline" id="headline"></div>
      <div class="subline" id="subline"></div>
      <div class="chips" id="chips"></div>
    </div>
  </div>
  <div class="side-stack">
    <div class="mini-card">Smooth motion</div>
    <div class="mini-card">Kinetic typography</div>
    <div class="mini-card">${aspect} frame</div>
  </div>
  <div class="corner one">${wide ? 'Studio grade' : 'Pro style'}</div>
  <div class="corner two">${edit.bgMode === 'light' ? 'Light theme' : 'Premium theme'}</div>
  <div class="progress"><span id="bar"></span></div>
</div>
<script>
const LINES = ${safeLines};
const DURATION = ${duration};
const TOTAL = ${total};
const ASPECT = ${JSON.stringify(aspect)};
const isTall = ["9:16","4:5","3:4","2:3"].includes(ASPECT);
const isWide = ["16:9","21:9"].includes(ASPECT);
const headline = document.getElementById('headline');
const subline = document.getElementById('subline');
const chips = document.getElementById('chips');
const card = document.getElementById('card');
const bar = document.getElementById('bar');
const counter = document.getElementById('counter');
const eyebrow = document.getElementById('eyebrow');
const keywords = ["ai","paisa","creator","growth","viral","youtube","instagram","tools","business","online","content","editing","marketing","freelance"];
function esc(s){return String(s).replace(/[&<>\"]/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c] || c; });}
function hiWord(w){
  const clean = esc(w);
  const plain = String(w).replace(/[^\w]/g,'').toLowerCase();
  return keywords.includes(plain) ? '<span class="hl">' + clean + '</span>' : clean;
}
function calcRows(text){
  const words = String(text).split(/\s+/).filter(Boolean);
  let perLine = isTall ? 3 : isWide ? 6 : 4;
  if (text.length > (isTall ? 28 : isWide ? 56 : 40)) perLine = Math.max(2, perLine - 1);
  const rows = [];
  for (let i=0; i<words.length; i+=perLine) rows.push(words.slice(i, i+perLine));
  if (rows.length > 4) {
    const merged = rows.slice(0,3);
    merged.push(rows.slice(3).flat());
    return merged;
  }
  return rows;
}
function renderHeadline(text){
  const rows = calcRows(text);
  const len = text.length;
  let size = '';
  if (isTall) size = len < 18 ? 'clamp(68px,11vw,126px)' : len < 30 ? 'clamp(56px,9vw,94px)' : len < 46 ? 'clamp(42px,7.5vw,70px)' : 'clamp(32px,6.2vw,54px)';
  else if (isWide) size = len < 26 ? 'clamp(64px,8vw,120px)' : len < 46 ? 'clamp(48px,6vw,82px)' : 'clamp(34px,4.4vw,62px)';
  else size = len < 24 ? 'clamp(58px,8vw,108px)' : len < 40 ? 'clamp(44px,6.2vw,76px)' : 'clamp(34px,5.1vw,58px)';
  headline.style.fontSize = 'calc(' + size + ' * var(--font-scale))';
  headline.innerHTML = rows.map(function(r){ return '<div>' + r.map(hiWord).join(' ') + '</div>'; }).join('');
}
function pickSubline(i){
  const next = LINES[i+1] || '';
  if (!next) return isWide ? 'Designed for scroll-stopping short-form videos.' : 'Premium short-form video style.';
  return next.length > (isTall ? 54 : 70) ? next.slice(0, isTall ? 54 : 70).trim() + '…' : next;
}
function makeChips(text){
  const unique = [];
  String(text).split(/\s+/).forEach(function(w){
    const clean = w.replace(/[^\w]/g,'');
    if (clean.length > 3 && !unique.includes(clean.toLowerCase())) unique.push(clean.toLowerCase());
  });
  return unique.slice(0,3).map(function(w){ return w.charAt(0).toUpperCase()+w.slice(1); });
}
let idx = 0;
function draw(i){
  const line = LINES[i] || '';
  renderHeadline(line);
  subline.textContent = pickSubline(i);
  chips.innerHTML = makeChips(line).map(function(t){ return '<span class="chip">' + esc(t) + '</span>'; }).join('');
  if (counter) counter.textContent = String(i+1).padStart(2,'0');
  if (eyebrow) eyebrow.textContent = isWide ? 'Premium animated scene' : 'Premium short scene';
  card.classList.remove('animate'); void card.offsetWidth; card.classList.add('animate');
  if (bar) {
    bar.style.transition = 'none';
    bar.style.width = '0%';
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        bar.style.transition = 'width ' + DURATION + 'ms linear';
        bar.style.width = '100%';
      });
    });
  }
}
draw(0);
let timer = null;
let paused = false;
let muted = false;
function startTimer(){
  if (timer) clearInterval(timer);
  timer = setInterval(function(){ if(!paused && LINES.length > 1){ idx = (idx + 1) % LINES.length; draw(idx); } }, DURATION);
}
if (LINES.length > 1) startTimer();
window.addEventListener('message', function(event){
  const data = event.data || {};
  if (data.type !== 'shortscraft-video-control') return;
  if (data.command === 'next') { idx = (idx + 1) % LINES.length; draw(idx); }
  if (data.command === 'prev') { idx = (idx - 1 + LINES.length) % LINES.length; draw(idx); }
  if (data.command === 'toggle') { paused = !paused; }
  if (data.command === 'sound') { muted = !muted; document.body.setAttribute('data-sound', muted ? 'off' : 'on'); }
});
setTimeout(function(){ try { window.dispatchEvent(new Event('shortscraft-video-ended')); } catch(e) {} }, TOTAL);
<\/script>
</body>
</html>`;
  }
  function setPreview(html) {
    const frame = qs("#videoPreviewFrame");
    const empty = qs("#videoEmptyState");
    const status = qs("#videoPreviewStatus");
    const wrap = qs("#videoFrameWrap");
    if (!frame) return;
    frame.srcdoc = html;
    if (empty) empty.classList.add("hidden");
    if (status) status.textContent = "Preview ready";
    if (wrap) {
      wrap.classList.remove("ratio-916","ratio-169","ratio-11","ratio-45","ratio-34","ratio-23","ratio-219");
      const cls = {"9:16":"ratio-916","16:9":"ratio-169","1:1":"ratio-11","4:5":"ratio-45","3:4":"ratio-34","2:3":"ratio-23","21:9":"ratio-219"}[VIDEO_STATE.aspect] || "ratio-916";
      wrap.classList.add(cls);
    }
    qs("#videoMobileControls")?.classList.remove("hidden");
    const previewCard = qs(".video-preview-card") || wrap;
    if (previewCard) {
      requestAnimationFrame(() => {
        setTimeout(() => previewCard.scrollIntoView({ behavior: "smooth", block: "center" }), 180);
      });
    }
  }

  function buildPreview() {
    const scriptInput = qs("#videoScriptInput");
    const styleSelect = qs("#videoStyleSelect");
    const aspectSelect = qs("#videoAspectSelect");
    if (!scriptInput) return;

    const script = scriptInput.value.trim();
    if (!script) {
      if (window.scToast) window.scToast("Please paste or generate a script first.", "error");
      else alert("Please paste or generate a script first.");
      return;
    }
    const wc = script.split(/\s+/).filter(Boolean).length;
    if (wc > 180 && window.scToast) window.scToast("For best results, use a clear 180–260 word script for a 1–2 minute video.", "info");

    VIDEO_STATE.script = script;
    VIDEO_STATE.style = styleSelect?.value || "viral-hook";
    VIDEO_STATE.aspect = aspectSelect?.value || "9:16";
    VIDEO_STATE.html = generateVideoHtml(script, VIDEO_STATE.style, VIDEO_STATE.aspect);
    setPreview(VIDEO_STATE.html);
    try {
      if (window.scPushHistory) {
        window.scPushHistory({
          topic: (script.split(/\n|\.|!|\?/).find(Boolean) || "Animated Shorts video").trim().slice(0, 80),
          at: Date.now(),
          content: script,
          videoHtml: VIDEO_STATE.html,
          type: "video"
        });
      }
    } catch {}
  }

  async function generateScriptForVideo() {
    const topicInput = qs("#videoTopicInput");
    const scriptInput = qs("#videoScriptInput");
    const topic = topicInput?.value.trim();
    if (!topic) {
      window.scToast ? window.scToast("Enter a topic first.", "error") : alert("Enter a topic first.");
      return;
    }
    const btn = qs("#videoGenerateScriptBtn");
    const old = btn?.textContent;
    if (btn) { btn.textContent = "Generating..."; btn.disabled = true; }
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, type: "script" })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.error || "Script generation failed.");
      let script = "";
      const raw = data.result || data.output || data.text || data.content || "";
      if (typeof raw === "string") script = raw;
      else if (raw.script) script = raw.script;
      else if (raw.sections) script = Object.values(raw.sections).join("\n");
      else script = JSON.stringify(raw, null, 2);

      script = script
        .replace(/=== SCRIPT ===/gi, "")
        .replace(/=== TITLES ===[\s\S]*/gi, "")
        .trim();

      if (scriptInput) scriptInput.value = script;
      qsa(".video-mode").forEach(b => b.classList.toggle("active", b.dataset.mode === "paste"));
      qs("#videoPastePanel")?.classList.add("active");
      qs("#videoGeneratePanel")?.classList.remove("active");
      VIDEO_STATE.mode = "paste";
      if (window.scToast) window.scToast("Script generated. Now create video preview.", "success");
    } catch (e) {
      if (window.scToast) window.scToast(e.message, "error");
      else alert(e.message);
    } finally {
      if (btn) { btn.textContent = old || "Generate Script"; btn.disabled = false; }
    }
  }

  function showProDownloadModal() {
    const modal = qs("#upgradeModal");
    const note = qs("#upgradeNote");
    if (note) note.textContent = "Download Video is a Pro feature. Upgrade to export and use your animated video.";
    if (modal) {
      modal.classList.remove("hidden");
      modal.classList.add("pro-download-modal");
      return;
    }
    alert("Download Video is a Pro feature. Please subscribe to export your video.");
  }


  function sendVideoCommand(command) {
    const frame = qs("#videoPreviewFrame");
    const wrap = qs("#videoFrameWrap");
    if (!frame || !VIDEO_STATE.html) {
      if (window.scToast) window.scToast("Generate a video first.", "info");
      return;
    }
    if (command === "fullscreen") {
      const target = wrap || frame;
      if (target?.requestFullscreen) target.requestFullscreen().catch(() => {});
      else if (frame?.webkitRequestFullscreen) frame.webkitRequestFullscreen();
      return;
    }
    try {
      frame.contentWindow?.postMessage({ source: "shortscraft-parent", type: "shortscraft-video-control", command }, "*");
    } catch {}
  }

  function initVideoMobileControls() {
    qsa("[data-video-command]").forEach((btn) => {
      btn.addEventListener("click", () => sendVideoCommand(btn.dataset.videoCommand));
    });
  }

  function initVideoFirst() {
    if (!qs("#videoGenerator")) return;

    // Keep desktop behavior, but do not auto-jump past the mobile landing hero.
    if (location.pathname.includes("/generator") && window.matchMedia("(min-width: 769px)").matches) {
      setTimeout(() => {
        const vg = qs("#videoGenerator");
        if (vg) vg.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 250);
    }

    qsa(".video-mode").forEach(btn => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.mode || "paste";
        VIDEO_STATE.mode = mode;
        qsa(".video-mode").forEach(b => b.classList.toggle("active", b === btn));
        qs("#videoPastePanel")?.classList.toggle("active", mode === "paste");
        qs("#videoGeneratePanel")?.classList.toggle("active", mode === "generate");
      });
    });

    qs("#videoGenerateScriptBtn")?.addEventListener("click", generateScriptForVideo);
    qs("#generateVideoBtn")?.addEventListener("click", buildPreview);

    qs("#resetVideoBtn")?.addEventListener("click", () => {
      const scriptInput = qs("#videoScriptInput");
      const topicInput = qs("#videoTopicInput");
      if (scriptInput) scriptInput.value = "";
      if (topicInput) topicInput.value = "";
      resetEdits();
      VIDEO_STATE.html = "";
      const frame = qs("#videoPreviewFrame");
      const empty = qs("#videoEmptyState");
      const status = qs("#videoPreviewStatus");
      if (frame) frame.srcdoc = "";
      if (empty) empty.classList.remove("hidden");
      if (status) status.textContent = "No video generated yet";
      qs("#videoMobileControls")?.classList.add("hidden");
    });

    qs("#applyVideoEditBtn")?.addEventListener("click", () => {
      resetEdits();
      parseEdits(qs("#videoEditPrompt")?.value || "");
      buildPreview();
    });

    qs("#resetVideoEditBtn")?.addEventListener("click", () => {
      resetEdits();
      const p = qs("#videoEditPrompt");
      if (p) p.value = "";
      buildPreview();
    });

    qsa(".quick-edit-chips button").forEach(chip => {
      chip.addEventListener("click", () => {
        const val = (chip.dataset.edit || chip.textContent || "").trim();
        const p = qs("#videoEditPrompt");
        const merged = p && p.value.trim() ? (p.value.trim() + ", " + val) : val;
        if (p) p.value = merged;
        resetEdits();
        parseEdits(merged);
        buildPreview();
      });
    });

    qs("#copyVideoHtmlBtn")?.addEventListener("click", async () => {
      if (!VIDEO_STATE.html) return buildPreview();
      try {
        await navigator.clipboard.writeText(VIDEO_STATE.html);
        if (window.scToast) window.scToast("HTML copied.", "success");
      } catch {
        if (window.scToast) window.scToast("Could not copy HTML.", "error");
      }
    });

    qs("#openVideoPreviewBtn")?.addEventListener("click", () => {
      if (!VIDEO_STATE.html) buildPreview();
      if (!VIDEO_STATE.html) return;
      const w = window.open("", "_blank");
      if (w) {
        w.document.open();
        w.document.write(VIDEO_STATE.html);
        w.document.close();
      }
    });

    qs("#downloadVideoBtn")?.addEventListener("click", () => {
      if (!VIDEO_STATE.html) buildPreview();
      if (!VIDEO_STATE.html) return;
      showProDownloadModal();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initVideoFirst);
  } else {
    initVideoMobileControls();
  initVideoFirst();
  }
})();


/* ============================================================
   Premium UI refinements for video-first studio
   ============================================================ */
(() => {
  "use strict";
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const styleNames = {
    "viral-hook":"YouTube Viral Hook","clean-minimal":"Clean Minimal White","neon-cyber":"Neon Cyber Kinetic",
    "motivation":"Motivation Reel Style","podcast":"Modern Podcast Subtitle","news":"Bold News Style",
    "horror":"Horror / Mystery Style","luxury":"Luxury Gold Premium","social-pop":"Social Gradient Pop",
    "documentary":"Faceless Documentary","tech-blueprint":"Tech Explainer Blueprint","gaming":"Gaming Esports Style",
    "classroom":"Classroom Educational","vhs":"Retro VHS Style","startup":"Startup SaaS Clean"
  };
  function openCmd(){
    const pal = $("#cmdPalette"), input = $("#cmdInput");
    if(!pal) return;
    pal.classList.remove("hidden");
    setTimeout(()=>input && input.focus(), 30);
  }
  function closeCmd(){ $("#cmdPalette")?.classList.add("hidden"); }
  function openTools(){
    $("#textToolsDrawer")?.classList.remove("hidden");
    $("#textToolsVeil")?.classList.remove("hidden");
    $("#textToolsDrawer")?.setAttribute("aria-hidden","false");
  }
  function closeTools(){
    $("#textToolsDrawer")?.classList.add("hidden");
    $("#textToolsVeil")?.classList.add("hidden");
    $("#textToolsDrawer")?.setAttribute("aria-hidden","true");
  }
  function initPremiumRefinements(){
    const search = $("#studioSearchInput");
    document.addEventListener("keydown", (e)=>{ if(e.key === "Escape") closeCmd(); });
    $("#cmdCloseBtn")?.addEventListener("click", closeCmd);
    search?.addEventListener("focus", openCmd);
    search?.addEventListener("click", openCmd);
    search?.addEventListener("keydown", (e)=>{ if(e.key === "Enter") openCmd(); });
    
    $("#openTextToolsBtn")?.addEventListener("click", (e)=>{
      e.preventDefault();
      window.location.href = "/seo-tools";
    });
    $("#closeTextToolsBtn")?.addEventListener("click", closeTools);
    $("#textToolsVeil")?.addEventListener("click", closeTools);

    // Premium style picker
    const trigger = $("#stylePickerTrigger");
    const menu = $("#stylePickerMenu");
    const hidden = $("#videoStyleSelect");
    const label = $(".style-picker-text");
    trigger?.addEventListener("click", (e)=>{
      e.stopPropagation();
      menu?.classList.toggle("hidden");
      trigger.setAttribute("aria-expanded", menu && !menu.classList.contains("hidden") ? "true" : "false");
    });
    $$("#stylePickerMenu button").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const val = btn.dataset.style;
        if(hidden) hidden.value = val;
        if(label) label.textContent = styleNames[val] || btn.textContent.trim();
        $$("#stylePickerMenu button").forEach(b=>b.classList.toggle("active", b === btn));
        menu?.classList.add("hidden");
        trigger?.setAttribute("aria-expanded","false");
      });
    });
    document.addEventListener("click", (e)=>{
      if(menu && trigger && !menu.contains(e.target) && !trigger.contains(e.target)) {
        menu.classList.add("hidden");
        trigger.setAttribute("aria-expanded","false");
      }
    });

    // Command palette actions for new items
    $$("#cmdList li").forEach(li=>{
      li.addEventListener("click", ()=>{
        const action = li.dataset.action;
        if(action === "video") { closeCmd(); $("#videoGenerator")?.scrollIntoView({behavior:"smooth", block:"start"}); }
        if(action === "tools") { closeCmd(); window.location.href="/seo-tools"; }
      });
    });
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", initPremiumRefinements);
  else initPremiumRefinements();
})();


/* ============================================================
   Final click/close/mobile bugfix layer
   ============================================================ */
(() => {
  "use strict";
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const show = el => el && el.classList.remove("hidden");
  const hide = el => el && el.classList.add("hidden");

  function openModalSafe(sel){
    const el = $(sel);
    if(!el) return;
    el.classList.remove("hidden");
  }
  function closeModalSafe(sel){
    const el = $(sel);
    if(!el) return;
    el.classList.add("hidden");
  }

  function openSidebarSafe(){
    $("#sidebar")?.classList.add("open");
    $("#sidebar")?.setAttribute("aria-hidden","false");
    $("#sidebarVeil")?.classList.add("show");
  }
  function closeSidebarSafe(){
    $("#sidebar")?.classList.remove("open");
    $("#sidebar")?.setAttribute("aria-hidden","true");
    $("#sidebarVeil")?.classList.remove("show");
  }

  function openCmdSafe(){
    const pal = $("#cmdPalette");
    const input = $("#cmdInput");
    if(!pal) return;
    pal.classList.remove("hidden");
    setTimeout(()=>input?.focus(), 40);
  }
  function closeCmdSafe(){
    $("#cmdPalette")?.classList.add("hidden");
    const s = $("#studioSearchInput");
    if(s) s.blur();
  }

  function handleCmdAction(action){
    closeCmdSafe();
    switch(action){
      case "video":
        $("#videoGenerator")?.scrollIntoView({behavior:"smooth", block:"start"});
        break;
      case "tools":
        window.location.href = "/seo-tools";
        break;
      case "generate":
        $("#generateBtn")?.click();
        break;
      case "copy":
        document.querySelector(".copy-btn, #copyScriptBtn, #copyVideoHtmlBtn")?.click();
        break;
      case "download":
        $("#downloadTxtBtn")?.click();
        break;
      case "history":
        openSidebarSafe();
        break;
      case "upgrade":
        openModalSafe("#upgradeModal");
        break;
      default:
        break;
    }
  }

  function bindFinalFixes(){
    // Top buttons
    $("#sidebarToggle")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); openSidebarSafe(); });
    $("#sidebarClose")?.addEventListener("click", (e)=>{ e.preventDefault(); closeSidebarSafe(); });
    $("#sidebarVeil")?.addEventListener("click", closeSidebarSafe);

    $("#feedbackBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); openModalSafe("#feedbackModal"); });
    $("#profileFeedbackBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); openModalSafe("#feedbackModal"); });
    $("#loginBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); openModalSafe("#authModal"); });

    $("#authModalClose")?.addEventListener("click", ()=>closeModalSafe("#authModal"));
    $("#feedbackModalClose")?.addEventListener("click", ()=>closeModalSafe("#feedbackModal"));
    $("#feedbackCancelBtn")?.addEventListener("click", ()=>closeModalSafe("#feedbackModal"));
    $("#upgradeModalClose")?.addEventListener("click", ()=>closeModalSafe("#upgradeModal"));

    // Search / command palette
    const search = $("#studioSearchInput");
    search?.addEventListener("focus", openCmdSafe);
    search?.addEventListener("click", openCmdSafe);
    $("#cmdCloseBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); closeCmdSafe(); });
    $("#cmdPalette")?.addEventListener("click", (e)=>{
      if(e.target === $("#cmdPalette")) closeCmdSafe();
    });
    $("#cmdBox")?.addEventListener("click", (e)=>e.stopPropagation());
    document.addEventListener("keydown", (e)=>{
      if(e.key === "Escape") closeCmdSafe();
      if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k"){
        e.preventDefault();
        openCmdSafe();
      }
    });
    $$("#cmdList li").forEach(li=>{
      li.addEventListener("click", (e)=>{
        e.preventDefault();
        handleCmdAction(li.dataset.action);
      });
    });

    // SEO tools button fallback
    $$(".seo-tools-link, #openTextToolsBtn").forEach(btn=>{
      btn.addEventListener("click", (e)=>{
        e.preventDefault();
        window.location.href="/seo-tools";
      });
    });
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindFinalFixes);
  else bindFinalFixes();

  // Expose tiny helpers for older handlers that expect them
  window.__scOpenSidebar = openSidebarSafe;
  window.__scCloseCommand = closeCmdSafe;
})();


/* SEO page header controls */
(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];

  function open(el){ el && el.classList.remove("hidden"); }
  function close(el){ el && el.classList.add("hidden"); }

  function openSidebar(){
    $("#sidebar")?.classList.add("open");
    $("#sidebar")?.setAttribute("aria-hidden","false");
    $("#sidebarVeil")?.classList.add("show");
  }
  function closeSidebar(){
    $("#sidebar")?.classList.remove("open");
    $("#sidebar")?.setAttribute("aria-hidden","true");
    $("#sidebarVeil")?.classList.remove("show");
  }
  function openCmd(){
    const pal = $("#cmdPalette");
    if(!pal) return;
    pal.classList.remove("hidden");
    setTimeout(()=>$("#cmdInput")?.focus(), 30);
  }
  function closeCmd(){
    $("#cmdPalette")?.classList.add("hidden");
    $("#seoStudioSearchInput")?.blur();
  }

  function bindSeoHeader(){
    $("#seoSidebarToggle")?.addEventListener("click", (e)=>{e.preventDefault(); openSidebar();});
    $("#sidebarClose")?.addEventListener("click", closeSidebar);
    $("#sidebarVeil")?.addEventListener("click", closeSidebar);

    $("#seoFeedbackBtn")?.addEventListener("click", (e)=>{e.preventDefault(); open($("#feedbackModal"));});
    $("#seoLoginBtn")?.addEventListener("click", (e)=>{e.preventDefault(); open($("#authModal"));});

    $("#feedbackModalClose")?.addEventListener("click", ()=>close($("#feedbackModal")));
    $("#feedbackCancelBtn")?.addEventListener("click", ()=>close($("#feedbackModal")));
    $("#authModalClose")?.addEventListener("click", ()=>close($("#authModal")));
    $("#upgradeModalClose")?.addEventListener("click", ()=>close($("#upgradeModal")));

    $("#seoStudioSearchInput")?.addEventListener("focus", openCmd);
    $("#seoStudioSearchInput")?.addEventListener("click", openCmd);
    $("#cmdCloseBtn")?.addEventListener("click", closeCmd);
    $("#cmdPalette")?.addEventListener("click", (e)=>{ if(e.target === $("#cmdPalette")) closeCmd(); });
    $("#cmdBox")?.addEventListener("click", (e)=>e.stopPropagation());

    $$("#cmdList li").forEach(li => li.addEventListener("click", () => {
      const action = li.dataset.action;
      closeCmd();
      if(action === "video") location.href = "/generator";
      if(action === "upgrade") open($("#upgradeModal"));
      if(action === "generate") $("#generateBtn")?.click();
      if(action === "copy") document.querySelector(".copy-btn")?.click();
      if(action === "download") $("#downloadTxtBtn")?.click();
    }));

    document.addEventListener("keydown", (e)=>{ if(e.key === "Escape") closeCmd(); });
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindSeoHeader);
  else bindSeoHeader();
})();
