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
   Script-to-Video Generator — Professional fixed engine
   Fixes: unique styles, ratio scaling, prompt edits, dynamic scenes
   ============================================================ */
(() => {
  "use strict";

  const qs = (s, root = document) => root.querySelector(s);
  const qsa = (s, root = document) => [...root.querySelectorAll(s)];
  const escHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));

  const ASPECTS = {
    "9:16": { w: 1080, h: 1920, cls: "ratio-916" },
    "16:9": { w: 1920, h: 1080, cls: "ratio-169" },
    "1:1":  { w: 1080, h: 1080, cls: "ratio-11" },
    "4:5":  { w: 1080, h: 1350, cls: "ratio-45" },
    "3:4":  { w: 1080, h: 1440, cls: "ratio-34" },
    "2:3":  { w: 1080, h: 1620, cls: "ratio-23" },
    "21:9": { w: 1920, h: 823,  cls: "ratio-219" }
  };

  const DEFAULT_EDIT = Object.freeze({
    fontScale: 1,
    speed: 1,
    highlight: "",
    bgMode: "auto",
    minimal: false,
    premium: false,
    wordMode: "normal",
    align: "center",
    density: 1,
    hideBrand: false,
    hideMeta: true,
    raw: ""
  });

  const VIDEO_STATE = {
    mode: "paste",
    html: "",
    script: "",
    style: "viral-hook",
    aspect: "9:16",
    edit: { ...DEFAULT_EDIT }
  };

  const STYLE_MAP = {
    "viral-hook": {
      name: "YouTube Viral Hook",
      vibe: "Aggressive kinetic hook",
      bg: "#050505",
      fg: "#ffffff",
      muted: "rgba(255,255,255,.72)",
      accent: "#ffffff",
      accent2: "#ff2d55",
      font: "'Arial Black', Impact, 'Noto Sans Devanagari', system-ui, sans-serif",
      scene: "viral",
      bodyClass: "style-viral",
      css: `
        .stage{background:#050505;color:#fff}
        .stage::before{background:linear-gradient(120deg,rgba(255,255,255,.06),transparent 45%),radial-gradient(circle at 75% 25%,rgba(255,45,85,.22),transparent 32%)}
        .word{font-weight:1000;text-transform:uppercase;letter-spacing:-.085em;text-shadow:9px 9px 0 rgba(255,45,85,.45)}
        .word.key{color:#050505;background:#fff;padding:.02em .12em;border-radius:.12em;text-shadow:none;box-decoration-break:clone;-webkit-box-decoration-break:clone}
        .scene-enter .word{animation:flyUp .42s cubic-bezier(.15,.85,.12,1.25) both}
        @keyframes flyUp{from{opacity:0;transform:translateY(150px) rotate(-4deg) scale(.78)}to{opacity:1;transform:translateY(0) rotate(0) scale(1)}}`
    },
    "clean-minimal": {
      name: "Clean Minimal White",
      vibe: "Elegant whitespace",
      bg: "#ffffff",
      fg: "#111827",
      muted: "rgba(15,23,42,.55)",
      accent: "#111827",
      accent2: "#64748b",
      font: "Inter, 'Noto Sans Devanagari', Arial, sans-serif",
      scene: "minimal",
      bodyClass: "style-clean",
      css: `
        .stage{background:#fff;color:#111827}
        .stage::before{background:radial-gradient(circle at 18% 82%,rgba(15,23,42,.035),transparent 32%)}
        .frame{border-color:rgba(15,23,42,.08);box-shadow:none}
        .brand,.watermark,.dots,.scene-index{color:rgba(15,23,42,.38)}
        .word{font-weight:650;letter-spacing:-.055em;text-shadow:none}
        .word.key{font-weight:900;color:#000}
        .scene-enter .word{animation:cleanSlide .72s cubic-bezier(.18,.8,.2,1) both}
        @keyframes cleanSlide{from{opacity:0;transform:translateY(34px);filter:blur(8px)}to{opacity:1;transform:none;filter:blur(0)}}`
    },
    "neon-cyber": {
      name: "Neon Cyber Kinetic",
      vibe: "Cyan purple glow",
      bg: "#000000",
      fg: "#eaffff",
      muted: "rgba(234,255,255,.68)",
      accent: "#00f5ff",
      accent2: "#b44fff",
      font: "'Arial Black', Impact, 'Noto Sans Devanagari', system-ui, sans-serif",
      scene: "neon",
      bodyClass: "style-neon",
      css: `
        .stage{background:#000;color:#eaffff}
        .stage::before{background:radial-gradient(circle at 20% 25%,rgba(0,245,255,.27),transparent 30%),radial-gradient(circle at 80% 70%,rgba(180,79,255,.30),transparent 35%)}
        .stage::after{opacity:.38;background-size:48px 48px;background-image:linear-gradient(rgba(0,245,255,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(180,79,255,.1) 1px,transparent 1px)}
        .word{font-weight:1000;text-transform:uppercase;text-shadow:0 0 18px #00f5ff,0 0 48px #b44fff,0 0 88px rgba(0,245,255,.7)}
        .word.key{color:#00f5ff;filter:drop-shadow(0 0 18px #00f5ff)}
        .scene-enter .word{animation:neonZoom .34s cubic-bezier(.12,.9,.16,1.3) both}
        @keyframes neonZoom{from{opacity:0;transform:scale(2.1);filter:blur(12px)}to{opacity:1;transform:scale(1);filter:blur(0)}}`
    },
    "motivation": {
      name: "Motivation Reel Style",
      vibe: "Energetic bounce",
      bg: "linear-gradient(135deg,#ff3d2e 0%,#fb7a1f 48%,#ffb703 100%)",
      fg: "#ffffff",
      muted: "rgba(255,255,255,.8)",
      accent: "#ffffff",
      accent2: "#2b1300",
      font: "'Arial Black', Impact, 'Noto Sans Devanagari', system-ui, sans-serif",
      scene: "bounce",
      bodyClass: "style-motivation",
      css: `
        .stage{background:linear-gradient(135deg,#ff3d2e 0%,#fb7a1f 48%,#ffb703 100%);color:#fff}
        .stage::before{background:radial-gradient(circle at 15% 20%,rgba(255,255,255,.28),transparent 26%),radial-gradient(circle at 80% 88%,rgba(43,19,0,.22),transparent 34%)}
        .word{font-weight:1000;text-transform:uppercase;text-shadow:0 12px 0 rgba(0,0,0,.17),0 25px 70px rgba(0,0,0,.23)}
        .word.key{color:#2b1300;background:#fff;padding:.01em .12em;border-radius:.16em;text-shadow:none}
        .scene-enter .word{animation:bounceWord .48s cubic-bezier(.16,1.24,.24,1) both}
        @keyframes bounceWord{0%{opacity:0;transform:translateY(80px) scale(.55)}60%{transform:translateY(-14px) scale(1.09)}100%{opacity:1;transform:none}}`
    },
    "podcast": {
      name: "Modern Podcast Subtitle",
      vibe: "Bottom subtitle highlight",
      bg: "#171717",
      fg: "#ffffff",
      muted: "rgba(255,255,255,.72)",
      accent: "#FFD60A",
      accent2: "#ffffff",
      font: "Inter, 'Noto Sans Devanagari', Arial, sans-serif",
      scene: "subtitle",
      bodyClass: "style-podcast",
      css: `
        .stage{background:#171717;color:#fff}
        .stage::before{background:linear-gradient(180deg,transparent 0%,rgba(0,0,0,.58) 72%,rgba(0,0,0,.92) 100%)}
        .scene{align-items:center;justify-content:flex-end;padding-bottom:14.2%}
        .headline{max-width:88%;font-size:calc(var(--font-size) * .62)!important;line-height:1.16;letter-spacing:-.035em}
        .word{font-weight:850;background:rgba(0,0,0,.46);padding:.08em .14em;margin:.04em;border-radius:.18em}
        .word.key{background:#FFD60A;color:#171717;text-shadow:none}
        .scene-enter .word{animation:subUp .55s cubic-bezier(.18,.8,.2,1) both}
        @keyframes subUp{from{opacity:0;transform:translateY(36px)}to{opacity:1;transform:none}}`
    },
    "news": {
      name: "Bold News Style",
      vibe: "Breaking news flash",
      bg: "linear-gradient(135deg,#ffffff 0%,#f5f5f5 58%,#d90429 58%,#b00020 100%)",
      fg: "#111111",
      muted: "rgba(17,17,17,.65)",
      accent: "#d90429",
      accent2: "#ffffff",
      font: "'Arial Black', Impact, 'Noto Sans Devanagari', system-ui, sans-serif",
      scene: "news",
      bodyClass: "style-news",
      css: `
        .stage{background:linear-gradient(135deg,#fff 0%,#f5f5f5 58%,#d90429 58%,#b00020 100%);color:#111}
        .breaking{display:block!important;position:absolute;left:0;top:0;right:0;background:#d90429;color:#fff;padding:34px 70px;font:1000 42px/1 'Arial Black',Impact,sans-serif;letter-spacing:.08em;text-transform:uppercase;z-index:5}
        .word{font-weight:1000;text-transform:uppercase;text-shadow:none;color:#111}
        .word.key{background:#d90429;color:#fff;padding:.02em .12em;text-shadow:none}
        .scene-enter .word{animation:flashIn .24s steps(2,end) both}
        @keyframes flashIn{from{opacity:0;filter:brightness(4);transform:scale(1.22)}to{opacity:1;filter:none;transform:scale(1)}}`
    },
    "horror": {
      name: "Horror / Mystery Style",
      vibe: "Blood red glitch",
      bg: "#000000",
      fg: "#8B0000",
      muted: "rgba(139,0,0,.7)",
      accent: "#8B0000",
      accent2: "#2b0000",
      font: "Georgia, 'Noto Serif Devanagari', 'Times New Roman', serif",
      scene: "horror",
      bodyClass: "style-horror",
      css: `
        .stage{background:#000;color:#8B0000;animation:horrorFlicker 4.4s infinite}
        .stage::before{background:radial-gradient(circle at 50% 48%,rgba(139,0,0,.22),transparent 34%),linear-gradient(180deg,transparent,rgba(139,0,0,.08))}
        .word{font-weight:900;letter-spacing:-.04em;text-shadow:0 0 14px #8B0000,3px 0 0 rgba(255,0,0,.22)}
        .word.key{color:#ff1b1b;text-shadow:0 0 26px #8B0000}
        .scene-enter .word{animation:slowReveal 1.05s ease both}
        @keyframes slowReveal{0%{opacity:0;filter:blur(18px);transform:translateX(-18px)}65%{opacity:.55;transform:translateX(8px)}100%{opacity:1;filter:blur(0);transform:none}}
        @keyframes horrorFlicker{0%,92%,100%{filter:brightness(1)}93%{filter:brightness(.35)}94%{filter:brightness(1.5)}95%{filter:brightness(.7)}}`
    },
    "luxury": {
      name: "Luxury Gold Premium",
      vibe: "Serif shimmer",
      bg: "radial-gradient(circle at 50% 12%,#201804 0%,#070707 54%,#000 100%)",
      fg: "#D4AF37",
      muted: "rgba(212,175,55,.72)",
      accent: "#D4AF37",
      accent2: "#fff1a8",
      font: "Georgia, 'Noto Serif Devanagari', 'Times New Roman', serif",
      scene: "luxury",
      bodyClass: "style-luxury",
      css: `
        .stage{background:radial-gradient(circle at 50% 12%,#201804 0%,#070707 54%,#000 100%);color:#D4AF37}
        .stage::before{background:linear-gradient(110deg,transparent 0%,rgba(212,175,55,.16) 48%,transparent 58%);animation:shimmer 3.8s infinite}
        .frame{border-color:rgba(212,175,55,.22)}
        .word{font-weight:800;letter-spacing:-.055em;background:linear-gradient(90deg,#8d6b18,#D4AF37,#fff1a8,#D4AF37);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:0 18px 70px rgba(212,175,55,.18)}
        .word.key{filter:drop-shadow(0 0 12px rgba(212,175,55,.52))}
        .scene-enter .word{animation:goldFade 1.1s ease both}
        @keyframes goldFade{from{opacity:0;transform:translateY(24px);filter:blur(10px)}to{opacity:1;transform:none;filter:blur(0)}}
        @keyframes shimmer{from{transform:translateX(-80%)}to{transform:translateX(80%)}}`
    },
    "social-pop": {
      name: "Social Gradient Pop",
      vibe: "Playful gradient",
      bg: "linear-gradient(135deg,#7c3aed,#ec4899 48%,#fb7185 100%)",
      fg: "#ffffff",
      muted: "rgba(255,255,255,.78)",
      accent: "#fde047",
      accent2: "#38bdf8",
      font: "'Arial Black', Impact, 'Noto Sans Devanagari', system-ui, sans-serif",
      scene: "pop",
      bodyClass: "style-social",
      css: `
        .stage{background:linear-gradient(135deg,#7c3aed,#ec4899 48%,#fb7185 100%);color:#fff}
        .stage::before{background:radial-gradient(circle at 15% 25%,rgba(255,255,255,.28),transparent 25%),radial-gradient(circle at 85% 70%,rgba(56,189,248,.35),transparent 30%)}
        .word{font-weight:1000;text-transform:uppercase;text-shadow:0 9px 0 rgba(0,0,0,.16)}
        .word.key{color:#fde047;-webkit-text-stroke:3px rgba(0,0,0,.16)}
        .scene-enter .word{animation:popWord .45s cubic-bezier(.2,1.4,.25,1) both}
        @keyframes popWord{0%{opacity:0;transform:scale(.35) rotate(-8deg)}70%{transform:scale(1.16) rotate(2deg)}100%{opacity:1;transform:none}}`
    },
    "documentary": {
      name: "Faceless Documentary",
      vibe: "Cinematic evidence board",
      bg: "linear-gradient(rgba(0,0,0,.7),rgba(0,0,0,.86)),radial-gradient(circle at 50% 30%,#475569,#020617 68%)",
      fg: "#f8fafc",
      muted: "rgba(248,250,252,.7)",
      accent: "#f59e0b",
      accent2: "#e2e8f0",
      font: "Inter, 'Noto Sans Devanagari', Arial, sans-serif",
      scene: "doc",
      bodyClass: "style-doc",
      css: `.word{font-weight:900;letter-spacing:-.055em}.word.key{color:#f59e0b}.scene-enter .word{animation:docIn .68s ease both}@keyframes docIn{from{opacity:0;transform:translateX(-60px)}to{opacity:1;transform:none}}`
    },
    "tech-blueprint": {
      name: "Tech Explainer Blueprint",
      vibe: "Grid blueprint",
      bg: "linear-gradient(135deg,#082f49,#020617)",
      fg: "#e0f2fe",
      muted: "rgba(224,242,254,.68)",
      accent: "#7dd3fc",
      accent2: "#22d3ee",
      font: "Inter, 'Noto Sans Devanagari', Arial, sans-serif",
      scene: "tech",
      bodyClass: "style-tech",
      css: `.stage::after{opacity:.55;background-size:54px 54px;background-image:linear-gradient(rgba(125,211,252,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(125,211,252,.12) 1px,transparent 1px)}.word{font-weight:900}.word.key{color:#7dd3fc;text-shadow:0 0 20px rgba(125,211,252,.65)}.scene-enter .word{animation:techIn .55s ease both}@keyframes techIn{from{opacity:0;transform:translateY(-18px) scale(.94)}to{opacity:1;transform:none}}`
    },
    "gaming": {
      name: "Gaming Esports Style",
      vibe: "Esports impact",
      bg: "linear-gradient(135deg,#020617,#111827 45%,#3b0764)",
      fg: "#ffffff",
      muted: "rgba(255,255,255,.72)",
      accent: "#39ff14",
      accent2: "#f97316",
      font: "'Arial Black', Impact, 'Noto Sans Devanagari', system-ui, sans-serif",
      scene: "gaming",
      bodyClass: "style-gaming",
      css: `.word{font-weight:1000;text-transform:uppercase;transform:skew(-7deg);text-shadow:6px 6px 0 #f97316,0 0 28px #39ff14}.word.key{color:#39ff14}.scene-enter .word{animation:gameIn .36s cubic-bezier(.2,1.25,.25,1) both}@keyframes gameIn{from{opacity:0;transform:translateX(-120px) skew(-7deg) scale(.8)}to{opacity:1;transform:skew(-7deg) scale(1)}}`
    },
    "classroom": {
      name: "Classroom Educational",
      vibe: "Smart learning board",
      bg: "linear-gradient(135deg,#064e3b,#022c22)",
      fg: "#ffffff",
      muted: "rgba(255,255,255,.72)",
      accent: "#bbf7d0",
      accent2: "#34d399",
      font: "Inter, 'Noto Sans Devanagari', Arial, sans-serif",
      scene: "classroom",
      bodyClass: "style-classroom",
      css: `.frame{border:4px solid rgba(187,247,208,.24)}.word{font-weight:950}.word.key{color:#bbf7d0;text-decoration:underline;text-decoration-thickness:.07em;text-underline-offset:.12em}.scene-enter .word{animation:boardIn .62s ease both}@keyframes boardIn{from{opacity:0;transform:translateY(32px)}to{opacity:1;transform:none}}`
    },
    "vhs": {
      name: "Retro VHS Style",
      vibe: "Analog retro scanlines",
      bg: "linear-gradient(135deg,#1e1b4b,#111827)",
      fg: "#ffffff",
      muted: "rgba(255,255,255,.72)",
      accent: "#f472b6",
      accent2: "#22d3ee",
      font: "'Courier New', 'Noto Sans Devanagari', monospace",
      scene: "vhs",
      bodyClass: "style-vhs",
      css: `.stage::after{opacity:.75;background:repeating-linear-gradient(0deg,rgba(255,255,255,.065) 0 2px,transparent 2px 6px)}.word{font-weight:1000;text-transform:uppercase;text-shadow:4px 0 #22d3ee,-4px 0 #f472b6}.word.key{color:#f472b6}.scene-enter .word{animation:vhsIn .52s steps(3,end) both}@keyframes vhsIn{from{opacity:0;transform:translateX(36px);filter:blur(6px)}to{opacity:1;transform:none;filter:blur(0)}}`
    },
    "startup": {
      name: "Startup SaaS Clean",
      vibe: "Premium SaaS pitch",
      bg: "linear-gradient(135deg,#f8fafc,#eef2ff)",
      fg: "#111827",
      muted: "rgba(15,23,42,.56)",
      accent: "#2563eb",
      accent2: "#0f172a",
      font: "Inter, 'Noto Sans Devanagari', Arial, sans-serif",
      scene: "startup",
      bodyClass: "style-startup",
      css: `.stage{color:#111827}.frame{border-color:rgba(37,99,235,.15)}.word{font-weight:900;letter-spacing:-.07em}.word.key{color:#2563eb}.scene-enter .word{animation:startupIn .65s cubic-bezier(.18,.8,.2,1) both}@keyframes startupIn{from{opacity:0;transform:translateY(26px) scale(.97)}to{opacity:1;transform:none}}`
    }
  };

  function resetEdits() { VIDEO_STATE.edit = { ...DEFAULT_EDIT }; }

  function splitScript(script, aspect = "9:16") {
    const raw = String(script || "")
      .replace(/\[(HOOK|MAIN|CTA)\]/gi, "\n")
      .replace(/\r/g, "\n")
      .replace(/[•▪▫➜►]/g, "\n")
      .replace(/\n{2,}/g, "\n")
      .trim();
    if (!raw) return [];

    const tall = ["9:16", "4:5", "3:4", "2:3"].includes(aspect);
    const wide = ["16:9", "21:9"].includes(aspect);
    const maxWords = tall ? 5 : wide ? 9 : 7;
    const maxChars = tall ? 32 : wide ? 62 : 44;
    const hardLimit = tall ? 28 : wide ? 22 : 24;

    const sentences = raw
      .split(/\n+|(?<=[.!?।])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const out = [];
    for (const sentence of sentences) {
      const words = sentence.split(/\s+/).filter(Boolean);
      if (!words.length) continue;
      let chunk = [];
      for (const word of words) {
        const next = [...chunk, word].join(" ");
        if (chunk.length >= maxWords || next.length > maxChars) {
          if (chunk.length) out.push(chunk.join(" "));
          chunk = [word];
        } else {
          chunk.push(word);
        }
      }
      if (chunk.length) out.push(chunk.join(" "));
    }
    return out.map(s => s.replace(/^[-–—:]+/, "").trim()).filter(Boolean).slice(0, hardLimit);
  }

  function parseEdits(prompt, reset = false) {
    if (reset) resetEdits();
    const p = String(prompt || "").toLowerCase();
    const e = VIDEO_STATE.edit;
    e.raw = p;

    if (/bigger|large|huge|text bada|font bada|big/.test(p)) e.fontScale = Math.max(e.fontScale, 1.22);
    if (/small|smaller|text chhota|font chhota/.test(p)) e.fontScale = Math.min(e.fontScale, 0.86);
    if (/slow|slower|animation slow/.test(p)) e.speed = Math.max(e.speed, 1.45);
    if (/fast|faster|animation fast/.test(p)) e.speed = Math.min(e.speed, 0.72);

    if (/yellow|highlight/.test(p)) e.highlight = "#FFD60A";
    if (/gold|luxury/.test(p)) e.highlight = "#D4AF37";
    if (/cyan|blue|neon/.test(p)) e.highlight = "#00f5ff";
    if (/purple|violet/.test(p)) e.highlight = "#b44fff";
    if (/red|blood/.test(p)) e.highlight = "#ff2d55";
    if (/green/.test(p)) e.highlight = "#22c55e";

    if (/dark|darker|black|night/.test(p)) e.bgMode = "dark";
    if (/light|white|bright/.test(p)) e.bgMode = "light";
    if (/minimal|simple|clean|less elements/.test(p)) { e.minimal = true; e.density = 0; e.wordMode = "minimal"; }
    if (/premium|luxury|gold|professional|modern|shimmer/.test(p)) { e.premium = true; e.density = Math.max(e.density, 2); }
    if (/more elements|less empty|fill|fuller|add shape|add elements/.test(p)) e.density = 2;
    if (/left/.test(p)) e.align = "left";
    if (/center|centre/.test(p)) e.align = "center";
    if (/hide brand|remove brand|no brand/.test(p)) e.hideBrand = true;
    if (/show brand/.test(p)) e.hideBrand = false;
    if (/show top|style name|meta/.test(p)) e.hideMeta = false;
    if (/hide top|remove top|no top/.test(p)) e.hideMeta = true;
  }

  function getEditedStyle(style) {
    const e = VIDEO_STATE.edit;
    const s = { ...style };
    if (e.bgMode === "dark") {
      s.bg = "#050505"; s.fg = "#f8fafc"; s.muted = "rgba(248,250,252,.72)";
    }
    if (e.bgMode === "light") {
      s.bg = "linear-gradient(135deg,#ffffff,#f8fafc)"; s.fg = "#0f172a"; s.muted = "rgba(15,23,42,.58)";
    }
    if (e.minimal) {
      s.bg = e.bgMode === "dark" ? "#050505" : "#ffffff";
      s.fg = e.bgMode === "dark" ? "#f8fafc" : "#0f172a";
      s.font = "Inter, 'Noto Sans Devanagari', Arial, sans-serif";
    }
    if (e.premium) {
      s.accent = e.highlight || "#D4AF37";
      s.accent2 = "#fff1a8";
    }
    if (e.highlight) s.accent = e.highlight;
    return s;
  }

  function generateVideoHtml(script, styleKey, aspect) {
    const baseStyle = STYLE_MAP[styleKey] || STYLE_MAP["viral-hook"];
    const style = getEditedStyle(baseStyle);
    const size = ASPECTS[aspect] || ASPECTS["9:16"];
    const lines = splitScript(script, aspect);
    const safeLines = JSON.stringify(lines.length ? lines : ["Paste a script first"]);
    const e = VIDEO_STATE.edit;
    const tall = size.h > size.w;
    const wide = size.w > size.h;
    const baseFont = tall ? 94 : wide ? 86 : 74;
    const duration = Math.round((tall ? 2600 : 2400) * e.speed);
    const effectDensity = e.minimal ? 0 : e.density;

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ShortsCraft Generated Video</title>
<style>
*{box-sizing:border-box}html,body{margin:0;width:${size.w}px;height:${size.h}px;overflow:hidden;background:#000}
body{font-family:${style.font};-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
.stage{--w:${size.w};--h:${size.h};--font-size:${baseFont}px;--font-scale:${e.fontScale};--accent:${style.accent};--accent2:${style.accent2};--fg:${style.fg};--muted:${style.muted};position:relative;width:${size.w}px;height:${size.h}px;overflow:hidden;background:${style.bg};color:var(--fg);isolation:isolate}
.stage::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none}
.stage::after{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);background-size:${wide ? 76 : 54}px ${wide ? 76 : 54}px;opacity:${effectDensity ? .22 : .06};mask-image:radial-gradient(circle at 50% 45%,#000,transparent 82%)}
.frame{position:absolute;inset:${Math.round(size.w*.055)}px ${Math.round(size.w*.06)}px;border:2px solid rgba(255,255,255,.16);border-radius:${tall ? 70 : 46}px;z-index:1;pointer-events:none}
.fx-orb{display:${effectDensity ? "block" : "none"};position:absolute;border-radius:999px;filter:blur(70px);opacity:.28;z-index:0}.fx1{width:42%;height:35%;left:-12%;top:-8%;background:var(--accent)}.fx2{width:42%;height:42%;right:-12%;bottom:-12%;background:var(--accent2)}.fx3{width:25%;height:22%;left:58%;top:18%;background:var(--accent)}
.breaking{display:none}.brand{position:absolute;left:${Math.round(size.w*.06)}px;top:${Math.round(size.h*.045)}px;z-index:6;font:900 ${wide ? 30 : 27}px/1 Inter,Arial,sans-serif;letter-spacing:.14em;color:var(--muted);text-transform:uppercase}.meta{position:absolute;right:${Math.round(size.w*.06)}px;top:${Math.round(size.h*.043)}px;z-index:6;font:800 ${wide ? 24 : 22}px/1 Inter,Arial,sans-serif;color:var(--muted);padding:12px 18px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12)}
.scene{position:absolute;inset:0;z-index:3;display:flex;align-items:center;justify-content:center;text-align:${e.align};padding:${tall ? "260px 96px 230px" : "170px 160px 150px"}}
.scene-inner{width:100%;max-width:${wide ? 1460 : 900}px;display:flex;flex-direction:column;align-items:${e.align === "left" ? "flex-start" : "center"};gap:${tall ? 28 : 22}px}
.eyebrow{font:900 ${wide ? 28 : 24}px/1 Inter,Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:var(--accent);opacity:.92}.headline{font-size:calc(var(--font-size) * var(--font-scale));line-height:.94;letter-spacing:-.07em;max-width:100%;text-wrap:balance}.line{display:block;margin:.02em 0}.word{display:inline-block;margin:.015em .06em;will-change:transform,opacity,filter}.word.key{color:var(--accent)}.word.super{font-size:1.18em}.word.punch{color:var(--accent2)}
.subline{max-width:${wide ? 1080 : 760}px;font:700 ${wide ? 35 : 30}px/1.24 Inter,'Noto Sans Devanagari',Arial,sans-serif;color:var(--muted)}
.dot-row{position:absolute;left:50%;bottom:${Math.round(size.h*.045)}px;transform:translateX(-50%);display:flex;gap:10px;z-index:6}.dot{width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,.22)}.dot.active{width:32px;border-radius:999px;background:linear-gradient(90deg,var(--accent),var(--accent2))}.scene-index{position:absolute;left:${Math.round(size.w*.06)}px;bottom:${Math.round(size.h*.045)}px;z-index:6;color:var(--muted);font:900 ${wide ? 28 : 24}px/1 Inter,Arial,sans-serif}.watermark{position:absolute;right:${Math.round(size.w*.06)}px;bottom:${Math.round(size.h*.043)}px;z-index:6;color:var(--muted);font:800 ${wide ? 23 : 20}px/1 Inter,Arial,sans-serif;letter-spacing:.02em}.progress{position:absolute;left:0;bottom:0;width:100%;height:${wide ? 8 : 10}px;background:rgba(255,255,255,.1);z-index:8}.progress span{display:block;width:0;height:100%;background:linear-gradient(90deg,var(--accent),var(--accent2));box-shadow:0 0 30px var(--accent)}
.scene-enter.scene-alt-1 .word{animation-name:wordLeft}.scene-enter.scene-alt-2 .word{animation-name:wordZoom}.scene-enter.scene-alt-3 .word{animation-name:wordFade}.scene-enter .word{animation-duration:.55s;animation-timing-function:cubic-bezier(.18,.8,.2,1);animation-fill-mode:both;animation-delay:calc(var(--i) * 70ms)}
@keyframes wordLeft{from{opacity:0;transform:translateX(-90px);filter:blur(9px)}to{opacity:1;transform:none;filter:blur(0)}}@keyframes wordZoom{from{opacity:0;transform:scale(.4) rotate(-2deg);filter:blur(10px)}to{opacity:1;transform:scale(1) rotate(0);filter:blur(0)}}@keyframes wordFade{from{opacity:0;transform:translateY(38px);filter:blur(8px)}to{opacity:1;transform:none;filter:blur(0)}}
${style.css}
</style>
</head>
<body>
<div class="stage ${style.bodyClass}">
  <div class="fx-orb fx1"></div><div class="fx-orb fx2"></div><div class="fx-orb fx3"></div><div class="frame"></div><div class="breaking">BREAKING NEWS</div>
  ${e.hideBrand ? "" : `<div class="brand">SHORTSCRAFT</div>`}
  ${e.hideMeta ? "" : `<div class="meta">${escHtml(style.name)} · ${aspect}</div>`}
  <main class="scene" id="scene"><div class="scene-inner"><div class="eyebrow" id="eyebrow">${escHtml(style.vibe)}</div><div class="headline" id="headline"></div><div class="subline" id="subline"></div></div></main>
  <div class="scene-index" id="sceneIndex">01/${String(lines.length || 1).padStart(2,"0")}</div>
  <div class="dot-row" id="dotRow"></div>
  <div class="watermark">shortscraft.online</div>
  <div class="progress"><span id="progressBar"></span></div>
</div>
<script>
const LINES=${safeLines};
const DURATION=${duration};
const headline=document.getElementById('headline');
const subline=document.getElementById('subline');
const scene=document.getElementById('scene');
const sceneIndex=document.getElementById('sceneIndex');
const dotRow=document.getElementById('dotRow');
const progressBar=document.getElementById('progressBar');
const strongWords=['ai','paisa','viral','youtube','shorts','creator','growth','secret','online','money','tools','video','content','editing','business','freelance','algorithm','views','income'];
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function isKey(w,i){const clean=String(w).replace(/[^\\p{L}\\p{N}]/gu,'').toLowerCase();return strongWords.includes(clean)||clean.length>=8||/^[A-Z]/.test(w)||i===0||/[!?।]$/.test(w)}
function rows(words){const per=(${wide ? 7 : tall ? 3 : 5});const out=[];for(let i=0;i<words.length;i+=per)out.push(words.slice(i,i+per));return out;}
function render(i){
  const text=LINES[i]||''; const words=text.split(/\\s+/).filter(Boolean);
  const html=rows(words).map((r,ri)=>'<span class="line">'+r.map((w,wi)=>{const index=ri*10+wi;const cls=['word'];if(isKey(w,index))cls.push('key');if(w.length>9)cls.push('super');if(/[!?]$/.test(w))cls.push('punch');return '<span class="'+cls.join(' ')+'" style="--i:'+index+'">'+esc(w)+'</span>';}).join(' ')+'</span>').join('');
  headline.innerHTML=html;
  subline.textContent=LINES[i+1]&&LINES[i+1].length<90?LINES[i+1]:'';
  scene.classList.remove('scene-enter','scene-alt-1','scene-alt-2','scene-alt-3'); void scene.offsetWidth;
  scene.classList.add('scene-enter','scene-alt-'+(i%4));
  sceneIndex.textContent=String(i+1).padStart(2,'0')+'/'+String(LINES.length).padStart(2,'0');
  dotRow.innerHTML=LINES.map((_,d)=>'<span class="dot '+(d===i?'active':'')+'"></span>').join('');
  progressBar.style.transition='none';progressBar.style.width='0%';
  requestAnimationFrame(()=>requestAnimationFrame(()=>{progressBar.style.transition='width '+DURATION+'ms linear';progressBar.style.width='100%';}));
}
let idx=0;render(0);if(LINES.length>1)setInterval(()=>{idx=(idx+1)%LINES.length;render(idx);},DURATION);
<\/script>
</body>
</html>`;
  }

  function resizePreviewFrame() {
    const frame = qs("#videoPreviewFrame");
    const wrap = qs("#videoFrameWrap");
    if (!frame || !wrap) return;
    const size = ASPECTS[VIDEO_STATE.aspect] || ASPECTS["9:16"];
    const box = wrap.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const scale = Math.min(box.width / size.w, box.height / size.h);
    frame.style.width = `${size.w}px`;
    frame.style.height = `${size.h}px`;
    frame.style.transformOrigin = "top left";
    frame.style.transform = `scale(${scale})`;
    frame.style.left = `${(box.width - size.w * scale) / 2}px`;
    frame.style.top = `${(box.height - size.h * scale) / 2}px`;
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
      wrap.classList.remove(...Object.values(ASPECTS).map(a => a.cls));
      wrap.classList.add((ASPECTS[VIDEO_STATE.aspect] || ASPECTS["9:16"]).cls);
    }
    requestAnimationFrame(resizePreviewFrame);
  }

  function buildPreview() {
    const scriptInput = qs("#videoScriptInput");
    if (!scriptInput) return;
    const script = scriptInput.value.trim();
    if (!script) {
      window.scToast ? window.scToast("Please paste or generate a script first.", "error") : alert("Please paste or generate a script first.");
      return;
    }
    VIDEO_STATE.script = script;
    VIDEO_STATE.style = qs("#videoStyleSelect")?.value || "viral-hook";
    VIDEO_STATE.aspect = qs("#videoAspectSelect")?.value || "9:16";
    VIDEO_STATE.html = generateVideoHtml(VIDEO_STATE.script, VIDEO_STATE.style, VIDEO_STATE.aspect);
    setPreview(VIDEO_STATE.html);
    try {
      window.scPushHistory?.({
        topic: (script.split(/\n|\.|!|\?/).find(Boolean) || "Animated Shorts video").trim().slice(0, 80),
        at: Date.now(), content: script, videoHtml: VIDEO_STATE.html, type: "video"
      });
    } catch {}
  }

  async function generateScriptForVideo() {
    const topic = qs("#videoTopicInput")?.value.trim();
    const scriptInput = qs("#videoScriptInput");
    if (!topic) return window.scToast ? window.scToast("Enter a topic first.", "error") : alert("Enter a topic first.");
    const btn = qs("#videoGenerateScriptBtn");
    const old = btn?.textContent;
    if (btn) { btn.textContent = "Generating..."; btn.disabled = true; }
    try {
      const res = await fetch("/api/generate", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ topic, type:"script" }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.error || "Script generation failed.");
      const raw = data.result || data.output || data.text || data.content || "";
      let script = typeof raw === "string" ? raw : raw.script || (raw.sections ? Object.values(raw.sections).join("\n") : JSON.stringify(raw, null, 2));
      script = script.replace(/=== SCRIPT ===/gi, "").replace(/=== TITLES ===[\s\S]*/gi, "").trim();
      if (scriptInput) scriptInput.value = script;
      qsa(".video-mode").forEach(b => b.classList.toggle("active", b.dataset.mode === "paste"));
      qs("#videoPastePanel")?.classList.add("active");
      qs("#videoGeneratePanel")?.classList.remove("active");
      VIDEO_STATE.mode = "paste";
      window.scToast?.("Script generated. Now click Generate Video.", "success");
    } catch (e) {
      window.scToast ? window.scToast(e.message, "error") : alert(e.message);
    } finally {
      if (btn) { btn.textContent = old || "Generate Script"; btn.disabled = false; }
    }
  }

  function showProDownloadModal() {
    const modal = qs("#upgradeModal");
    const note = qs("#upgradeNote");
    if (note) note.textContent = "Download Video is a Pro feature. Upgrade to export and use your animated video.";
    if (modal) modal.classList.remove("hidden");
    else alert("Download Video is a Pro feature. Please subscribe to export your video.");
  }

  function initVideoFirst() {
    if (!qs("#videoGenerator")) return;

    if (location.pathname.includes("/generator")) {
      setTimeout(() => qs("#videoGenerator")?.scrollIntoView({ behavior:"smooth", block:"start" }), 250);
    }

    qsa(".video-mode").forEach(btn => btn.addEventListener("click", () => {
      VIDEO_STATE.mode = btn.dataset.mode || "paste";
      qsa(".video-mode").forEach(b => b.classList.toggle("active", b === btn));
      qs("#videoPastePanel")?.classList.toggle("active", VIDEO_STATE.mode === "paste");
      qs("#videoGeneratePanel")?.classList.toggle("active", VIDEO_STATE.mode === "generate");
    }));

    qs("#videoGenerateScriptBtn")?.addEventListener("click", generateScriptForVideo);
    qs("#generateVideoBtn")?.addEventListener("click", () => { resetEdits(); parseEdits(qs("#videoEditPrompt")?.value || ""); buildPreview(); });

    qs("#videoAspectSelect")?.addEventListener("change", () => {
      VIDEO_STATE.aspect = qs("#videoAspectSelect")?.value || "9:16";
      if (VIDEO_STATE.script || qs("#videoScriptInput")?.value.trim()) buildPreview();
      else resizePreviewFrame();
    });
    qs("#videoStyleSelect")?.addEventListener("change", () => {
      VIDEO_STATE.style = qs("#videoStyleSelect")?.value || "viral-hook";
      if (VIDEO_STATE.script || qs("#videoScriptInput")?.value.trim()) buildPreview();
    });
    window.addEventListener("resize", resizePreviewFrame);

    qs("#resetVideoBtn")?.addEventListener("click", () => {
      if (qs("#videoScriptInput")) qs("#videoScriptInput").value = "";
      if (qs("#videoTopicInput")) qs("#videoTopicInput").value = "";
      resetEdits(); VIDEO_STATE.html = ""; VIDEO_STATE.script = "";
      const frame = qs("#videoPreviewFrame"); if (frame) frame.srcdoc = "";
      qs("#videoEmptyState")?.classList.remove("hidden");
      if (qs("#videoPreviewStatus")) qs("#videoPreviewStatus").textContent = "No video generated yet";
      resizePreviewFrame();
    });

    qs("#applyVideoEditBtn")?.addEventListener("click", () => { parseEdits(qs("#videoEditPrompt")?.value || "", true); buildPreview(); });
    qs("#resetVideoEditBtn")?.addEventListener("click", () => { resetEdits(); if (qs("#videoEditPrompt")) qs("#videoEditPrompt").value = ""; buildPreview(); });

    qsa(".quick-edit-chips button").forEach(chip => chip.addEventListener("click", () => {
      const val = (chip.dataset.edit || chip.textContent || "").trim();
      const p = qs("#videoEditPrompt");
      if (p) p.value = val;
      parseEdits(val, true);
      buildPreview();
    }));

    qs("#copyVideoHtmlBtn")?.addEventListener("click", async () => {
      if (!VIDEO_STATE.html) buildPreview();
      if (!VIDEO_STATE.html) return;
      try { await navigator.clipboard.writeText(VIDEO_STATE.html); window.scToast?.("HTML copied.", "success"); }
      catch { window.scToast ? window.scToast("Could not copy HTML.", "error") : alert("Could not copy HTML."); }
    });

    qs("#openVideoPreviewBtn")?.addEventListener("click", () => {
      if (!VIDEO_STATE.html) buildPreview();
      if (!VIDEO_STATE.html) return;
      const w = window.open("", "_blank");
      if (w) { w.document.open(); w.document.write(VIDEO_STATE.html); w.document.close(); }
    });

    qs("#downloadVideoBtn")?.addEventListener("click", () => { if (!VIDEO_STATE.html) buildPreview(); if (VIDEO_STATE.html) showProDownloadModal(); });
    setTimeout(resizePreviewFrame, 200);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initVideoFirst);
  else initVideoFirst();
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
