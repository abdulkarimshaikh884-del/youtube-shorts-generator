/* ============================================================
   build_pages.js — generates every non-app page from ONE shell chrome.
   Nothing here reuses the legacy site: pages load only shell.css + page.css
   and page.js. Run:  node build_pages.js
   ============================================================ */
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "public");
/* Cache key for the CSS and JS the pages link. Bump it in the same commit as
   any change to those files: they are served with a long max-age, so without
   a new key a returning visitor keeps the old copy and sees a half-updated
   product. */
const V = "2026090926";

/* Read from credits.js rather than require()ing it: that module pulls in db.js,
   which throws at import time when DATABASE_URL is unset — so generating static
   marketing pages had come to depend on holding live database credentials.
   The server keeps that fail-fast; a page build has no business needing it. */
const LIFETIME_SLOTS = (function () {
  try {
    const src = fs.readFileSync(path.join(__dirname, "credits.js"), "utf8");
    const m = src.match(/const\s+LIFETIME_SLOTS\s*=\s*(\d+)/);
    return m ? Number(m[1]) : 100;
  } catch (e) {
    return 100;
  }
})();

/* Counted from the engine itself so the marketing copy can never claim a
   template count the site does not actually ship. */
const TPL_COUNT = (function () {
  try {
    const src = fs.readFileSync(path.join(OUT, "templates-v2.js"), "utf8");
    const ids = new Set();
    const re = /T\["([\w-]+)"\]\s*=/g;
    let m;
    while ((m = re.exec(src))) ids.add(m[1]);
    ids.delete("blank");
    const retired = src.match(/var\s+RETIRED_TEMPLATE_IDS\s*=\s*\{([\s\S]*?)\};/);
    if (retired) {
      const retiredId = /"([\w-]+)"\s*:\s*true/g;
      while ((m = retiredId.exec(retired[1]))) ids.delete(m[1]);
    }
    return ids.size;
  } catch (e) {
    return 90;
  }
})();

/* Every social link on the site comes from here — the sidebar, the About page
   and the Help page all read this list, so a changed handle is one edit rather
   than a hunt through three files. An entry with an empty href is skipped
   entirely rather than rendering a dead icon. */
const SOCIAL = [
  {
    key: "youtube", label: "YouTube", handle: "@TechVault-90",
    href: "https://youtube.com/@TechVault-90",
    icon: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23 12s0-3.9-.5-5.8a3 3 0 0 0-2.1-2.1C18.5 3.5 12 3.5 12 3.5s-6.5 0-8.4.6A3 3 0 0 0 1.5 6.2C1 8.1 1 12 1 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 8.4.6 8.4.6s6.5 0 8.4-.6a3 3 0 0 0 2.1-2.1C23 15.9 23 12 23 12ZM9.8 15.5v-7l6 3.5-6 3.5Z"/></svg>'
  },
  {
    key: "instagram", label: "Instagram", handle: "@tech_vault_in",
    href: "https://instagram.com/tech_vault_in",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>'
  },
  {
    key: "telegram", label: "Telegram", handle: "Tech Vault",
    // Set this to the channel's public t.me link to switch the icon on.
    // Left empty on purpose: a guessed URL could point at someone else's
    // channel, which is worse than the icon simply not being there yet.
    href: "",
    icon: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.9 4.3 18.7 19c-.24 1.07-.88 1.33-1.78.83l-4.92-3.63-2.37 2.29c-.26.26-.48.48-.99.48l.35-5.02L18.1 6.7c.4-.35-.09-.55-.62-.2L6.2 13.32l-4.95-1.55c-1.08-.34-1.1-1.08.22-1.6L20.5 2.72c.9-.33 1.68.2 1.4 1.58Z"/></svg>'
  }
];

const NAV = [
  { href: "/#templates", label: "Templates", key: "templates", group: "Workspace",
    icon: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>' },
  { href: "/drafts", label: "My Projects", key: "projects", group: "Workspace",
    icon: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>' },
  { href: "/community", label: "Creator Skills", key: "community", group: "Workspace",
    icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
  /* These four also sit in the footer, but a footer is only reachable after
     scrolling a whole page. The rail is the one place present on every screen,
     so the pages people look for when something has gone wrong belong here. */
  { href: "/tutorials", label: "Tutorials & Help", key: "tutorials", group: "Support & Legal",
    icon: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>' },
  { href: "/contact", label: "Feedback", key: "contact", group: "Support & Legal",
    icon: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/>' },
  { href: "/about", label: "About Us", key: "about", group: "Support & Legal",
    icon: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>' },
    
  /* Everything below used to live in a popover hanging off the account chip.
     A destination the product has is a destination the rail should show:
     hiding half the workspace behind a click made the sidebar look emptier
     than the product actually is, and duplicated the same links in the top
     bar. `auth` gates a row the same way data-auth gates anything else. */
  { href: "/editor", label: "Creator Studio", key: "uploads", auth: "in", group: "Workspace",
    icon: '<path d="M12 19V5"/><path d="M5 12l7-7 7 7"/><path d="M3 21h18"/>' },
  { href: "/settings", label: "Profile & settings", key: "settings", auth: "in", group: "Account",
    icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' },
  { href: "/pricing", label: "Subscription & Plans", key: "pricing", group: "Account",
    icon: '<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>' },
  { href: "/admin", label: "Admin Console", key: "admin", auth: "admin", group: "Account",
    icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' }
];

const TOOLS = [
  { id: "script", label: "Script", url: "/youtube-shorts-script-generator" },
  { id: "titles", label: "Titles", url: "/youtube-shorts-title-generator" },
  { id: "description", label: "Description", url: "/youtube-shorts-description-generator" },
  { id: "hashtags", label: "Hashtags", url: "/youtube-shorts-hashtag-generator" },
  { id: "ideas", label: "Ideas", url: "/youtube-shorts-ideas-generator" },
  { id: "thumbnail", label: "Thumbnail prompts", url: "/ai-thumbnail-prompt-generator" }
];

/* A "bare" page drops the sidebar, top bar and footer. Signing up is a single
   task; the workspace chrome around it is only something to click away from.
   The wordmark stays as the way back. Everything after it closes the document,
   so chrome() returns early for these pages. */
function BARE(p, V) {
  /* The outer element only centres the card — the <main> is p.body's own, and
     nesting one inside another is invalid HTML that leaves assistive tech with
     two competing "main content" landmarks on the page. */
  return `
<div class="pg-screen">
  <button type="button" class="sh-theme-toggle pg-theme-toggle" id="themeToggle" aria-label="Switch to dark theme" aria-pressed="false">
    <svg class="sh-theme-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></svg>
    <svg class="sh-theme-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
  </button>
  <a href="/" class="pg-wordmark" aria-label="ShortsCraft home">
    <span class="sh-brand-mark"><img src="/favicon.svg?v=20260725" width="22" height="22" alt=""></span>
    <span class="sh-brand-name">Shorts<i>Craft</i></span>
  </a>

${p.body}

  <nav class="pg-screenfoot" aria-label="Legal">
    <a href="/terms">Terms</a>
    <a href="/privacy">Privacy</a>
    <a href="/contact">Help</a>
  </nav>
</div>

<script src="/authui.js?v=${V}" defer></script>
<script src="/theme.js?v=${V}" defer></script>
<script src="/page.js?v=${V}" defer></script>
${p.scripts || ""}</body>
</html>
`;
}

function chrome(p) {
  /* Grouped rather than flat. The rail carries ten destinations now, and an
     undifferentiated list of ten is something you read top to bottom every
     time instead of jumping to the part of the product you want. A group
     whose rows are all signed-in only carries the same gate, so a guest
     never sees an "Account" heading standing over nothing. */
  const navGroup = (title) => {
    const items = NAV.filter((n) => n.group === title);
    if (!items.length) return "";
    const allGated = items.every((n) => n.auth) ? ` data-auth="in" hidden` : "";
    const rows = items.map((n) => {
      const current = n.key === p.active ? ' aria-current="page"' : "";
      const gate = n.auth ? ` data-auth="${n.auth}" hidden` : "";
      return `          <a href="${n.href}"${current}${gate}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${n.icon}</svg>
            <span>${n.label}</span>
          </a>`;
    }).join("\n");
    return `        <div class="sh-navgroup"${allGated}>
          <h2 class="sh-navgroup-title">${title}</h2>
${rows}
        </div>`;
  };
  const nav = ["Workspace", "Account", "Support & Legal"].map(navGroup).filter(Boolean).join("\n");

  const head = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${p.title}</title>
<meta name="description" content="${p.desc}"/>
<link rel="canonical" href="https://shortscraft.online${p.route}"/>
${p.robots ? `<meta name="robots" content="${p.robots}"/>\n` : ""}<meta property="og:type" content="website"/>
<meta property="og:title" content="${p.title}"/>
<meta property="og:description" content="${p.desc}"/>
<meta property="og:url" content="https://shortscraft.online${p.route}"/>
<meta name="twitter:card" content="summary_large_image"/>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">

<meta name="theme-color" content="#f7f7f5">
<link rel="icon" type="image/svg+xml" href="/favicon.svg?v=20260725">
<link rel="icon" href="/favicon.ico?v=20260725" sizes="any">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=20260725">
<link rel="manifest" href="/site.webmanifest?v=20260725">

<!-- New stack only. styles.css / premium.css / landing.css / seo-tools.css are
     the legacy theme and are deliberately never loaded here. -->
<link rel="stylesheet" href="/shell.css?v=${V}">
<link rel="stylesheet" href="/page.css?v=${V}">
<link rel="stylesheet" href="/redesign.css?v=${V}">
<!-- Motion layer. Loads last so it can add transitions to the finished
     visual system without restating any of it. -->
<link rel="stylesheet" href="/polish.css?v=${V}">
<script>(function(){try{var t=localStorage.getItem("sc_theme");document.documentElement.dataset.theme=t==="dark"?"dark":"light"}catch(e){document.documentElement.dataset.theme="light"}})();</script>
${p.head || ""}</head>
`;

  // a bare page (log in / sign up) has no sidebar, top bar or footer
  if (p.bare) return head + `<body class="sh-body pg-bare">` + BARE(p, V);

  return head + `<body class="sh-body">

<a class="sh-skip" href="#main">Skip to content</a>

<div class="sh-wrap">

  <aside class="sh-rail">
    <a href="/" class="sh-brand" aria-label="ShortsCraft home">
      <span class="sh-brand-mark"><img src="/favicon.svg?v=20260725" width="22" height="22" alt=""></span>
      <span class="sh-brand-name">Shorts<i>Craft</i></span>
    </a>

    <div class="sh-social">
${SOCIAL.filter(s => s.href).map(s => `      <a href="${s.href}" rel="noopener" target="_blank" aria-label="${s.label}" title="${s.label} · ${s.handle}">
        ${s.icon}
      </a>`).join("\n")}
    </div>

    <a href="/editor" class="sh-cta">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l1.9 5.4 5.6 1.6-4.4 3.6 1 5.9-4.1-3-4.1 3 1-5.9L4.5 9.5l5.6-1.6L12 2.5Z"/></svg>
      <span>Create Animation</span>
    </a>

    <nav class="sh-nav" aria-label="Workspace">
${nav}

      <!-- Notifications moved to the top bar. A bell belongs next to the
           account it belongs to, and it was the one rail row that opened a
           panel rather than going somewhere. The theme switch stays: it is a
           setting, and settings live with the rest of the destinations. -->
      <button type="button" class="sh-theme-toggle" id="themeToggle" aria-label="Switch to dark theme" aria-pressed="false">
        <svg class="sh-theme-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></svg>
        <svg class="sh-theme-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        <span class="sh-nav-label">Theme</span>
      </button>
    </nav>

    <div class="sh-rail-foot">
      <a href="/pricing" class="sh-plan-badge" aria-label="Upgrade to Pro Plan">
        <div class="sh-plan-badge-head">
          <b>Free plan</b>
          <i class="sh-plan-arrow">↗</i>
        </div>
        <span class="sh-plan-credits">${P.free.perDay} of ${P.free.perDay} credits left today</span>
        <span class="sh-plan-rates">Export ${C.export} · AI scene ${C.animate}</span>
        <div class="sh-plan-upgrade-link">Upgrade to Pro · ₹${P.pro.price}/mo</div>
      </a>

      <div class="sh-user-box" id="sidebarUserBox">
        <div class="sh-user-trigger-wrap" data-auth="in" hidden>
          <div class="sh-user-popover" id="sidebarUserPopover">
            <div class="sh-upop-head">
              <div class="sh-upop-av" data-user-avatar>KA</div>
              <div class="sh-upop-info">
                <span class="sh-upop-name" data-user-name>Account</span>
                <span class="sh-upop-handle" data-user-handle>@creator</span>
                <span class="sh-upop-email" data-user-email></span>
              </div>
            </div>

            <div class="sh-upop-badge-row">
              <span class="sh-upop-plan-pill" data-user-plan>✦ Free Plan</span>
              <span class="sh-upop-credits-pill">⚡ ${P.free.perDay} Credits</span>
            </div>

            <div class="sh-upop-menu">
              <a href="/account" class="sh-upop-item" id="popoverProfileBtn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <div class="sh-upop-item-txt">
                  <b>My Profile &amp; Setup</b>
                  <span>Setup bio, avatar &amp; links</span>
                </div>
              </a>

              <button type="button" class="sh-upop-item highlight" id="popoverUploadBtn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <div class="sh-upop-item-txt">
                  <b>Upload / Publish Template</b>
                  <span>Share your custom animation</span>
                </div>
                <span class="sh-upop-hot-tag">NEW</span>
              </button>

              <a href="/uploads" class="sh-upop-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>
                <div class="sh-upop-item-txt">
                  <b>My published templates</b>
                  <span>Published, scheduled and private templates</span>
                </div>
              </a>

              <a href="/drafts" class="sh-upop-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                <div class="sh-upop-item-txt">
                  <b>Drafts &amp; Projects</b>
                  <span>Saved work in progress</span>
                </div>
              </a>

              <a href="/settings" class="sh-upop-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                <div class="sh-upop-item-txt">
                  <b>Settings</b>
                  <span>Account &amp; preferences</span>
                </div>
              </a>

              <a href="/admin" class="sh-upop-item" data-auth="admin" hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l8 4v5c0 5-3.4 8.4-8 9-4.6-.6-8-4-8-9V7l8-4z"/><path d="M9 12l2 2 4-4"/></svg>
                <div class="sh-upop-item-txt">
                  <b>Admin Console</b>
                  <span>Users, content and support</span>
                </div>
              </a>

              <a href="/pricing" class="sh-upop-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                <div class="sh-upop-item-txt">
                  <b>Subscription &amp; Plans</b>
                  <span>Credits, up to 1440p rendering</span>
                </div>
              </a>

              <a href="/contact" class="sh-upop-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <div class="sh-upop-item-txt">
                  <b>Help &amp; Tutorials</b>
                  <span>Guides, FAQs &amp; Support</span>
                </div>
              </a>
            </div>

            <div class="sh-upop-foot">
              <button type="button" class="sh-upop-logout" id="popoverLogoutBtn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                <span>Log out</span>
              </button>
            </div>
          </div>

          <button type="button" class="sh-user-trigger" id="sidebarUserTrigger" aria-haspopup="true" aria-expanded="false">
            <div class="sh-user-trigger-av" data-user-avatar>KA</div>
            <div class="sh-user-trigger-info">
              <span class="sh-user-trigger-name" data-auth-email>Account</span>
              <span class="sh-user-trigger-handle" data-user-handle>@creator</span>
            </div>
            <span class="sh-user-trigger-arrow">▲</span>
          </button>
        </div>
      </div>
    </div>
  </aside>

  <div class="sh-main" id="main" role="main" tabindex="-1">

    <header class="sh-topbar" aria-label="Primary navigation">
      <button id="navBurger" type="button" aria-label="Menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
      <a href="/" class="sh-topbrand" aria-label="ShortsCraft home">
        <span class="sh-brand-mark"><img src="/favicon.svg?v=20260725" width="22" height="22" alt=""></span>
        <span class="sh-brand-name">Shorts<i>Craft</i></span>
      </a>
      <nav class="sh-primary-nav" aria-label="Main">
        <a href="/#templates"${p.active === "templates" ? ' aria-current="page"' : ""}>Templates</a>
        <a href="/community"${p.active === "community" ? ' aria-current="page"' : ""}>Creator Skills</a>
        <a href="/pricing"${p.active === "pricing" ? ' aria-current="page"' : ""}>Pricing</a>
        <a href="/tutorials"${p.active === "tutorials" ? ' aria-current="page"' : ""}>Learn</a>
      </nav>
      <div class="sh-top-actions">
      <a href="/pricing" class="sh-credit-chip" aria-label="View plan and credits">
        <span class="sh-credit-plan">Free</span>
        <span class="sh-credit-balance">${P.free.perDay} Credits</span>
      </a>
      <div class="sh-notification-wrap" data-auth="in" hidden>
        <button type="button" class="sh-notification-btn" id="notificationBtn" aria-label="Notifications" aria-expanded="false">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
          <span class="sh-nav-label">Notifications</span>
          <span id="notificationCount" hidden>0</span>
        </button>
        <section class="sh-notification-panel" id="notificationPanel" aria-label="Notifications" hidden>
          <header><strong>Notifications</strong><button type="button" id="notificationsReadBtn">Mark all read</button></header>
          <div id="notificationList"><p>Loading…</p></div>
          <!-- Only rendered when the list is actually longer than what is on
               screen, so the panel never offers to show more of nothing. -->
          <button type="button" class="sh-notification-more" id="notificationMore" hidden>Show more</button>
        </section>
      </div>
      <button type="button" class="sh-tupload-btn" id="topbarUploadBtn" title="Publish an animation template" data-auth="in" hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <span>Upload Animation</span>
      </button>
      <a href="/login" class="sh-tlink" data-auth="out">Log in</a>
      <a href="/signup" class="sh-tline" data-auth="out">Sign up</a>
      <button type="button" class="sh-tline" id="logoutBtn" data-auth="in" hidden>Log out</button>
      </div>
    </header>

    <div id="navMobile" hidden>
      <a href="/#templates">Templates</a>
      <a href="/community">Creator Skills</a>
      <a href="/drafts">My Projects</a>
      <a href="/editor" data-auth="in" hidden>Creator Studio</a>
      <a href="/uploads" data-auth="in" hidden>My published templates</a>
      <a href="/pricing">Pricing</a>
      <a href="/about">About</a>
      <a href="/contact">Feedback</a>
      <button type="button" class="sh-m-upload-btn js-open-upload" data-auth="in" hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <span>Publish Template</span>
      </button>
      <a href="/login" data-auth="out">Log in</a>
      <a href="/signup" data-auth="out">Sign up</a>
      <a href="/account" data-auth="in" hidden>Account</a>
      <a href="/admin" data-auth="admin" hidden>Admin Console</a>
      <button type="button" id="navMobileLogout" data-auth="in" hidden>Log out</button>
      <a href="/editor" class="sh-mfill">Create Animation</a>
    </div>

${p.body}

    <footer class="sh-footer">
      <div class="sh-fgrid">
        <div class="sh-fbrand">
          <a href="/" class="sh-brand" aria-label="ShortsCraft home">
            <span class="sh-brand-mark"><img src="/favicon.svg?v=20260725" width="22" height="22" alt=""></span>
            <span class="sh-brand-name">Shorts<i>Craft</i></span>
          </a>
          <p>Create, customise and export animation templates for short-form video.</p>
        </div>

        <nav class="sh-fcol" aria-label="Product">
          <h2>Product</h2>
          <a href="/editor">Studio Editor</a>
          <a href="/#templates">Templates Gallery</a>
          <a href="/community">Creator Skills</a>
          <a href="/pricing">Pricing</a>
        </nav>

        <nav class="sh-fcol" aria-label="Legal and support">
          <h2>Legal &amp; Support</h2>
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
          <a href="/contact">Help &amp; Feedback</a>
          <a href="/about">About Us</a>
        </nav>
      </div>

      <div class="sh-fbot">
        <span>© 2026 ShortsCraft. All rights reserved.</span>
        <span class="sh-status"><i></i> Website online</span>
      </div>
    </footer>

  </div><!-- /.sh-main -->
</div><!-- /.sh-wrap -->

<script src="/authui.js?v=${V}" defer></script>
<script src="/theme.js?v=${V}" defer></script>
${p.noPageJs ? "" : `<script src="/page.js?v=${V}" defer></script>`}
${p.scripts || ""}</body>
</html>
`;
}

/* ── page heads ───────────────────────────────────────────── */
/* Signed-out state for the account-scoped pages. These used to render one
   grey sentence and two buttons on an otherwise blank full-height page, which
   read as a page that had failed to load rather than one asking you to log in.
   The gate states what is behind it, so the page is worth looking at logged
   out too. `next` sends you back where you started after logging in. */
const guestGate = (next, title, sub, perks) => `      <section class="pg-sec" id="accountGuest" hidden>
        <div class="pg-gate">
          <span class="pg-gate-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <rect x="4" y="10" width="16" height="11" rx="2.5"/>
              <path d="M8 10V7a4 4 0 0 1 8 0v3"/>
            </svg>
          </span>
          <h2>${title}</h2>
          <p>${sub}</p>
          <div class="pg-row pg-gate-row">
            <a href="/login?next=${next}" class="pg-bw">Log in</a>
            <a href="/signup?next=${next}" class="pg-bo">Create an account</a>
          </div>
          <ul class="pg-gate-list">
${perks.map(p => `            <li>${p}</li>`).join("")}
          </ul>
          <p class="pg-gate-fine">Free to start — ${P.free.perDay} credits every day, no card required.</p>
        </div>
      </section>`;

const pageHead = (eyebrow, h1, sub, extra) => `    <section class="pg-head">
      <span class="pg-eyebrow">${eyebrow}</span>
      <h1>${h1}</h1>
      <p>${sub}</p>
${extra || ""}    </section>`;

/* ── PRICING ──────────────────────────────────────────────── */
/* Credit costs and daily grants are defined once in credits.js — keep these
   numbers in step with PLANS/COST there. */
const CREDITS = require("./credits");
const P = CREDITS.PLANS, C = CREDITS.COST;

const pricingLegacy = {
  route: "/pricing",
  active: "pricing",
  title: "Pricing — ShortsCraft",
  desc: `ShortsCraft pricing: Free gives ${P.free.perDay} watermarked exports a day, Pro is ₹${P.pro.price}/month for watermark-free 1080p and ${P.pro.perDay} exports a day, and Pro Max is a one-time ₹${P.promax.price} — lifetime for the first ${LIFETIME_SLOTS} members. Editing and preview are unlimited on every plan.`,
  body: `    <main class="pg">
${pageHead("Pricing", "Three plans. One currency: credits.",
    `Editing, previewing and browsing every template are free and unlimited — they run in your browser. You only spend a credit when you export a video (${C.export}) or ask the AI to design a brand-new scene (${C.animate}). Credits refill every day.`)}

      <div class="pg-offer" id="offerBanner" hidden>
        <span class="pg-offer-tag">Launch offer</span>
        <p><b>Pro Max is a one-time ₹${P.promax.price} for lifetime access</b> — for the first ${LIFETIME_SLOTS} members only.
        <span id="offerLeft"></span></p>
      </div>

      <div class="pg-plans pg-plans3" id="plans">
        <article class="pg-plan">
          <span class="pg-tier">${P.free.label}</span>
          <div class="pg-amt">₹0</div>
          <p class="pg-planline"><b>${P.free.perDay} exports every day</b> — enough to try everything and post your first Shorts.</p>
          <ul>
            <li>All ${TPL_COUNT} motion templates</li>
            <li>Unlimited editing and preview</li>
            <li>Custom AI animations from your prompt</li>
            <li>Export up to ${P.free.maxHeight}p</li>
            <li>Small ShortsCraft watermark</li>
          </ul>
          <a href="/" class="pg-bo">Start free</a>
        </article>

        <article class="pg-plan pg-hot">
          <span class="pg-tier">${P.pro.label} · Most popular</span>
          <div class="pg-amt">₹${P.pro.price}<small>/month</small></div>
          <p class="pg-planline"><b>No watermark, and ${P.pro.perDay} exports a day</b> — built for posting daily.</p>
          <ul>
            <li>Everything in Free</li>
            <li><b>No watermark</b> on your videos</li>
            <li>Full 1080p export</li>
            <li>${P.pro.perDay} exports per day</li>
            <li>Cancel any time</li>
          </ul>
          <button type="button" class="pg-bw pg-buy" data-plan="pro">Upgrade to Pro · ₹${P.pro.price}</button>
        </article>

        <article class="pg-plan pg-max">
          <span class="pg-tier">${P.promax.label}</span>
          <div class="pg-amt">₹${P.promax.price}<small id="maxTerm">one-time</small></div>
          <p class="pg-planline" id="maxLine"><b>Pay once, keep it for good</b> — no watermark, ever.</p>
          <ul>
            <li>Everything in Pro</li>
            <li><b>No monthly bill, ever</b></li>
            <li>1440p export</li>
            <li>${P.promax.perDay} exports per day</li>
            <li>The Pro AI model, and new templates first</li>
          </ul>
          <button type="button" class="pg-bo pg-buy" data-plan="promax">Get Pro Max · ₹${P.promax.price}</button>
        </article>
      </div>
      <p class="pg-note pg-center" id="buyNote" role="status" aria-live="polite"></p>
      <p class="pg-fine pg-center">Payments are processed by Razorpay — UPI, cards, netbanking and wallets. Credits reset daily at 00:00 UTC and do not stack up.</p>

      <section class="pg-sec">
        <h2>What a credit buys</h2>
        <div class="pg-grid">
          <article class="pg-card"><h3>${C.export} credit · Export a template</h3><p>Any of the ${TPL_COUNT} motion templates, edited however you like, rendered to a real MP4 at up to 1440p. Editing and previewing are free — you are only charged when you export.</p></article>
          <article class="pg-card"><h3>${C.animate} credits · A custom AI animation</h3><p>Describe the animation you want, optionally attach an image, and the AI designs a brand-new scene for your timeline. It costs more because it is a model call, not a preset.</p></article>
          <article class="pg-card"><h3>Free · Everything else</h3><p>Browsing templates, editing text and colours, building a multi-clip sequence, scrubbing the timeline and using all six SEO tools.</p></article>
          <article class="pg-card"><h3>Failed work is refunded</h3><p>If a render or a generation fails on our side, the credits go straight back. You never pay for our error.</p></article>
        </div>
      </section>

      <section class="pg-sec">
        <h2>Pricing questions</h2>
        <div class="pg-faq">
          <details open><summary>Do credits carry over?</summary><p>No. The grant is per day and resets at 00:00 UTC, so a busy day is never limited by a quiet one being unused.</p></details>
          <details><summary>Is there a trial?</summary><p>Free is the trial — ${P.free.perDay} credits every day, for as long as you like, with no card.</p></details>
          <details><summary>Why does an AI animation cost ${C.animate}?</summary><p>It runs a language model to design the scene and then renders it. A template export only renders.</p></details>
          <details><summary>Which payment methods work?</summary><p>UPI, debit and credit cards, netbanking and wallets, secured by Razorpay.</p></details>
          <details><summary>Can I cancel?</summary><p>Yes. Cancel any time and the plan stays active until the end of the period you already paid for.</p></details>
          <details><summary>Do you offer refunds?</summary><p>If the service did not work for you, contact us within 7 days of upgrading and we will refund it.</p></details>
        </div>
      </section>

      <section class="pg-cta">
        <h2>Ready to ship more Shorts?</h2>
        <p>Open the editor — your ${P.free.perDay} credits are already waiting.</p>
        <div class="pg-row">
          <a href="/editor" class="pg-bw">Open the Editor</a>
          <a href="/seo-tools" class="pg-bo">Explore SEO Tools</a>
        </div>
      </section>
    </main>`,
  scripts: `<script src="/checkout.js?v=${V}2" defer></script>`
};

const pricing = {
  route: "/pricing",
  active: "pricing",
  title: "Plans and credits — ShortsCraft",
  desc: "Compare ShortsCraft Free, Pro and Pro Max plans. Editing and previewing are unlimited; credits are used only for AI generation and video export.",
  body: `    <main class="pg pg-pricing">
${pageHead("Plans and credits", "Choose the output you need.",
    `Every plan includes the complete template library and unlimited editing. Credits refresh daily; the monthly total below makes the plans easy to compare.`)}

      <!-- Credit calculator.

           The three plan cards state what each one gives; they do not answer
           the question someone actually arrives with, which is "which of
           these is enough for me". This turns a posting rate into a credit
           number and points at the plan that covers it, using the same
           per-day figures the cards and the ledger use. -->
      <section class="pg-calc" aria-labelledby="calcHead">
        <div class="pg-calc-ask">
          <h2 id="calcHead">How many Shorts do you post a day?</h2>
          <p>One export is ${C.export} credit, an AI scene ${C.aiStandard} to ${C.aiAdvanced}. Move the slider and we will point at the plan that covers it.</p>
          <div class="pg-calc-read">
            <b id="calcPosts">6</b>
            <span><span id="calcPostsLabel">Shorts a day</span> · about <b id="calcNeeded">15 credits</b> a day</span>
          </div>
          <input type="range" id="calcRange" min="1" max="30" value="6"
                 aria-label="Shorts posted per day"
                 aria-describedby="calcNeeded">
          <div class="pg-calc-scale" aria-hidden="true"><span>1</span><span>10</span><span>20</span><span>30</span></div>
        </div>
        <div class="pg-calc-rec">
          <span class="pg-calc-kicker">Recommended</span>
          <div class="pg-calc-plan"><b id="calcRecName">Pro</b> <span id="calcRecPrice">₹${P.pro.price}/month</span></div>
          <p id="calcRecWhy">Forty credits a day leaves room for AI scenes and re-exports at your posting rate.</p>
          <a href="#plans" class="pg-bw pg-calc-cta" id="calcRecCta">Choose Pro</a>
        </div>
      </section>

      <div class="pg-billing-switch" role="group" aria-label="Billing period">
        <button type="button" data-cycle="monthly" aria-pressed="true">Monthly</button>
        <button type="button" data-cycle="yearly" aria-pressed="false">Yearly <span>Save up to 17%</span></button>
      </div>

      <div class="pg-plans pg-plans3">
        <article class="pg-plan">
          <span class="pg-tier">Free</span>
          <div class="pg-amt">₹0</div>
          <p class="pg-planline"><b>${P.free.monthlyCredits} credits each month</b>, delivered as ${P.free.perDay} fresh credits every day.</p>
          <ul>
            <li>All ${TPL_COUNT} animation templates</li>
            <li>Unlimited editing and preview</li>
            <li>Standard AI generation · ${C.aiStandard} credits</li>
            <li>MP4 export up to ${P.free.maxHeight}p · ${C.export} credit</li>
            <li>ShortsCraft watermark</li>
            <li>${P.free.starsPerMonth} appreciation Stars per month</li>
          </ul>
          <a href="/signup" class="pg-bo" data-auth="out">Create free account</a>
          <a href="/account" class="pg-bo" data-auth="in" hidden>Manage your plan</a>
        </article>

        <article class="pg-plan pg-hot">
          <span class="pg-tier">Pro · Best for regular creators</span>
          <div class="pg-amt" data-price-monthly="₹${P.pro.price}" data-price-yearly="₹${P.pro.yearlyPrice}">₹${P.pro.price}<small>/month</small></div>
          <p class="pg-planline"><b>${P.pro.monthlyCredits.toLocaleString("en-IN")} credits each month</b>, delivered as ${P.pro.perDay} fresh credits every day.</p>
          <ul>
            <li>Everything in Free</li>
            <li>Standard, Detailed and Advanced AI models</li>
            <li>Watermark-free 1080p export</li>
            <li>${P.pro.starsPerMonth} appreciation Stars per month</li>
            <li>Priority export queue</li>
            <li class="pg-yearly-only" hidden>Verified creator badge while yearly plan is active</li>
          </ul>
          <button type="button" class="pg-bw pg-buy" data-plan="pro" data-cycle="monthly">Choose Pro</button>
        </article>

        <article class="pg-plan pg-max">
          <span class="pg-tier">Pro Max · Highest output</span>
          <div class="pg-amt" data-price-monthly="₹${P.promax.price}" data-price-yearly="₹${P.promax.yearlyPrice}">₹${P.promax.price}<small>/month</small></div>
          <p class="pg-planline"><b>${P.promax.monthlyCredits.toLocaleString("en-IN")} credits each month</b>, delivered as ${P.promax.perDay} fresh credits every day.</p>
          <ul>
            <li>Everything in Pro</li>
            <li>Watermark-free export up to 1440p</li>
            <li>${P.promax.starsPerMonth} appreciation Stars per month</li>
            <li>Highest export queue priority</li>
            <li>Early access to new animation tools</li>
            <li class="pg-yearly-only" hidden>Verified creator badge while yearly plan is active</li>
          </ul>
          <button type="button" class="pg-bo pg-buy" data-plan="promax" data-cycle="monthly">Choose Pro Max</button>
        </article>
      </div>

      <p class="pg-note pg-center" id="buyNote" role="status" aria-live="polite"></p>
      <p class="pg-fine pg-center">Annual plans are billed once a year. Credits refresh daily and unused daily credits do not stack.</p>

      <section class="pg-sec" id="credits">
        <h2>What uses credits</h2>
        <div class="pg-grid">
          <article class="pg-card"><h3>${C.export} credit · Export</h3><p>A real MP4 render from any template or AI-generated scene. Previewing before export is always free.</p></article>
          <article class="pg-card"><h3>${C.aiStandard} credits · Standard AI</h3><p>Fast prompt-to-animation planning for every user.</p></article>
          <article class="pg-card"><h3>${C.aiDetailed} credits · Detailed AI</h3><p>A more deliberate result for subscribed creators.</p></article>
          <article class="pg-card"><h3>${C.aiAdvanced} credits · Advanced AI</h3><p>The highest-complexity planning option for any paid subscriber.</p></article>
        </div>
        <p class="pg-callout">Launch note: while ShortsCraft is being completed, every tier uses the best available free model provider. Paid model routing will only be enabled after the launch test period; the interface will never label a free backend as a paid model.</p>
      </section>

      <section class="pg-sec">
        <h2>Plan questions</h2>
        <div class="pg-faq">
          <details open><summary>Why show monthly credits if they refresh daily?</summary><p>The monthly number makes plans easy to compare. The daily refresh protects the export queue and gives you a predictable new balance every day.</p></details>
          <details><summary>Can every paid subscriber use every AI option?</summary><p>Yes. Pro and Pro Max unlock Standard, Detailed and Advanced generation; each option uses 2, 5 or 8 credits.</p></details>
          <details><summary>What happens when a render fails?</summary><p>If generation or export fails on our side after charging, that operation's credits are returned automatically.</p></details>
          <details><summary>Does the yearly plan include verification?</summary><p>Yes. The verified creator badge stays active for the paid yearly subscription period. ShortsCraft's own @shortscraft account is permanently verified.</p></details>
          <details><summary>Are Stars the same as credits?</summary><p>No. Credits pay for generation and export. Stars are non-cash appreciation that creators can give to one another.</p></details>
        </div>
      </section>
    </main>`,
  scripts: `<script src="/checkout.js?v=${V}" defer></script>`
};

/* ── ABOUT ────────────────────────────────────────────────── */
const about = {
  route: "/about",
  active: null,
  title: "About — ShortsCraft",
  desc: "ShortsCraft is an animation-template workspace for short-form creators, with a practical editor and server-side MP4 export.",
  body: `    <main class="pg">
${pageHead("About", "A practical animation workspace for short-form creators.", "Start with an editable template or describe a new scene, customise it in the Studio, and export a vertical MP4.")}

      <section class="pg-sec pg-prose">
        <h2>Why we rebuilt it</h2>
        <p>The first version of ShortsCraft animated paragraphs: big words sliding across a colourful gradient. Creators told us plainly that it did not look like animation. They were right — the tools people admire animate <em>objects and interfaces</em>: a toggle flipping, a counter ticking, a progress ring sweeping, a logo drawing itself. The subject matter was the problem, not the polish.</p>
        <p>So the template engine was replaced. Every template is now a single looping idea, built from CSS only, on a monochrome base with exactly one accent colour you control.</p>

        <h2>How it works</h2>
        <ol>
          <li><strong>Pick a template</strong> from ${TPL_COUNT} motion templates across eight categories.</li>
          <li><strong>Edit the content</strong> — the fields are named for what the animation actually shows, so a progress ring asks for a percentage, not a paragraph.</li>
          <li><strong>Build a sequence</strong> on the timeline. Each clip has its own template, text, accent and duration.</li>
          <li><strong>Export a real MP4.</strong> Headless Chrome renders the animation frame by frame and ffmpeg encodes H.264 — deterministic timing, no screen recording, no dropped frames.</li>
        </ol>

        <h2>What the AI does</h2>
        <p>Two separate things. It writes the words — scripts, titles, descriptions, hashtags, follow-up ideas and thumbnail prompts, in Hinglish. And from a prompt it can design a brand-new scene: describe an object and it writes the CSS for a looping animation of it, up to ten seconds.</p>
        <p>What it produces is still CSS, not video. That matters, because it means an AI scene exports through exactly the same deterministic pipeline as a built-in template — the same project renders identically every time, and nothing is re-generated at export.</p>
        <p>Everything it writes is a first draft. Review it, make it yours, then publish. That is also the platform-safe way to work.</p>

        <h2>Who builds this</h2>
        <p>ShortsCraft is an independent product built for Indian creators, from the same workshop as the <a href="${SOCIAL[0].href}" rel="noopener" target="_blank">Tech Vault</a> channel. Feature requests reach a human: use <a href="/contact">Help &amp; Feedback</a>.</p>
      </section>

      <section class="pg-cta">
        <h2>See it for yourself</h2>
        <p>No signup needed to try the editor.</p>
        <div class="pg-row">
          <a href="/editor" class="pg-bw">Open the Editor</a>
          <a href="/pricing" class="pg-bo">See pricing</a>
        </div>
      </section>
    </main>`
};

/* ── CONTACT ──────────────────────────────────────────────── */
/* ── TUTORIALS & HELP ─────────────────────────────────────
   The sidebar's "Tutorials & Help" used to point at /contact, so clicking it
   opened a bug-report form — which answers no questions at all. This is the
   page it should have gone to; the form is still one click away at the end for
   anything not covered. */
const tutorials = {
  route: "/tutorials",
  active: "tutorials",
  title: "Tutorials & Help — ShortsCraft",
  desc: "How to make an animated YouTube Short with ShortsCraft: pick a template, edit the text, export an MP4, and what the credits and plans mean.",
  body: `    <main class="pg">
${pageHead("Tutorials & Help", "Make your first Short in three minutes.",
    "Everything here is short on purpose. If something is still unclear, the last section goes straight to a human.")}

      <section class="pg-sec">
        <h2>Make your first animation</h2>
        <ol class="pg-steps">
          <li>
            <b>Pick a template.</b>
            <span>Open <a href="/#templates">Templates</a> and click any card. There are ${TPL_COUNT} of them across ${8} categories — documentary, paper craft, kinetic text, maps, finance, UI, social and charts. Every one previews live, so you can judge it before you commit.</span>
          </li>
          <li>
            <b>Change the words.</b>
            <span>In the Studio the right-hand panel has a field for each line of text. Type and the preview updates as you go. Editing and previewing are free and unlimited — you are never charged to look.</span>
          </li>
          <li>
            <b>Set the look.</b>
            <span>One accent colour drives the whole scene, so a single click restyles it. Below that: the font, the aspect ratio (9:16 for Shorts and Reels, 16:9 for YouTube) and the loop length.</span>
          </li>
          <li>
            <b>Export the MP4.</b>
            <span>Press Export. Rendering takes roughly 15 to 40 seconds depending on length and resolution — the video is built frame by frame on our server, which is why it is not instant. The file downloads when it is done.</span>
          </li>
        </ol>
      </section>

      <section class="pg-sec">
        <h2>Using the AI</h2>
        <div class="pg-grid">
          <article class="pg-card">
            <h3>Describe an object, not a mood</h3>
            <p>"A toggle switch flipping on with a green glow" works. "Make it look premium" does not — there is no object in it to animate. The AI builds one looping scene around one thing.</p>
          </article>
          <article class="pg-card">
            <h3>Scenes are up to 10 seconds</h3>
            <p>Ask for longer and it comes back at 10. Shorter is fine and often better — most Shorts hooks land in under six.</p>
          </article>
          <article class="pg-card">
            <h3>You can attach an image</h3>
            <p>The picture becomes part of the scene — a background that drifts, or a shape the animation reveals. It is used as artwork, not analysed.</p>
          </article>
        </div>
      </section>

      <section class="pg-sec">
        <h2>Credits and plans</h2>
        <div class="pg-grid">
          <article class="pg-card">
            <h3>What costs a credit</h3>
            <p>Exporting a video costs ${C.export}. Standard, Detailed and Advanced AI generation cost ${C.aiStandard}, ${C.aiDetailed} and ${C.aiAdvanced} credits. Browsing, editing and previewing cost nothing.</p>
          </article>
          <article class="pg-card">
            <h3>Why exports are the thing we charge for</h3>
            <p>They are the only part that runs on our machines. Everything else happens in your browser, so it is free to give away and we do.</p>
          </article>
          <article class="pg-card">
            <h3>They refill daily</h3>
            <p>Free gives ${P.free.perDay} a day. Credits reset at midnight UTC and do not roll over. <a href="/pricing">See the plans</a> for what Pro adds.</p>
          </article>
        </div>
      </section>

      <section class="pg-sec">
        <h2>Common questions</h2>
        <div class="pg-faq">
          <details>
            <summary>Why does my video have a ShortsCraft watermark?</summary>
            <p>Free exports carry a small watermark in the corner. Pro and Pro Max remove it — that is the main thing the paid plans buy.</p>
          </details>
          <details>
            <summary>My export is taking a long time.</summary>
            <p>Between 15 and 40 seconds is normal. Exports run one at a time, so if someone else started just before you, yours waits its turn. Longer videos and higher resolutions take proportionally longer.</p>
          </details>
          <details>
            <summary>Where did my project go?</summary>
            <p>Projects are saved in the browser you made them in, so they do not follow you to another device, and clearing site data removes them. Publishing a scene to the community keeps it on your account instead.</p>
          </details>
          <details>
            <summary>Can I use the videos commercially?</summary>
            <p>Yes. What you make is yours — put it on YouTube, Instagram, anywhere, including monetised channels.</p>
          </details>
          <details>
            <summary>The AI said my prompt was rejected.</summary>
            <p>Every generated scene is checked before it reaches you, and one that is static, unsafe or malformed is refused rather than shipped. Rewording around a concrete object usually fixes it, and you are not charged for a rejected scene.</p>
          </details>
        </div>
      </section>

      <section class="pg-cta">
        <h2>Still stuck?</h2>
        <p>Bug reports and template requests both reach a person, usually within two days.</p>
        <div class="pg-row">
          <a href="/contact" class="pg-bw">Help &amp; Feedback</a>
          <a href="/editor" class="pg-bo">Open the Studio</a>
        </div>
      </section>
    </main>`
};


/* ── COMMUNITY: creator tutorials ──────────────────────────
   This page used to be a second template grid, and that was its whole
   problem: every template on it was already in the main library, by the same
   author, on an identical card. Two pages answered "what can I make?" and
   nothing answered "does this actually work, and how?".

   So it carries tutorials now — videos creators published on their own
   channels that teach something. The video is never hosted here. A creator
   submits a tutorial to be watched, and the watching has to happen where
   their subscribers are; a link sends the view to them, an embed keeps it. */
const community = {
  route: "/community",
  active: "community",
  title: "Creator Skills — ShortsCraft",
  desc: "Tutorials and walkthroughs made by ShortsCraft creators. Learn how a template was built, then open it in the Studio.",
  head: `<style>
.sk-head{padding:50px 28px 14px;display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:16px}
.sk-head h1{
  font-family:var(--sh-display);font-size:clamp(28px,4vw,44px);
  margin:0 0 8px;font-weight:700;letter-spacing:-.03em;
}
.sk-head p{margin:0;font-size:15px;color:var(--sh-ink2);max-width:540px;line-height:1.55}

.sk-share-btn{
  display:inline-flex;align-items:center;gap:8px;
  height:42px;padding:0 22px;border:0;border-radius:999px;cursor:pointer;
  background:var(--sh-ink);color:var(--sh-bg1);font:inherit;font-weight:650;font-size:14px;
  transition:transform .15s ease,opacity .15s ease;
}
.sk-share-btn:hover{transform:translateY(-1px);opacity:.9}

/* ── Submission panel ───────────────────────────────────── */
.sk-form{
  margin:0 28px 20px;padding:18px;
  border:1px solid var(--sh-line);border-radius:16px;background:var(--sh-bg2);
  display:grid;gap:13px;max-width:660px;
}
.sk-form[hidden]{display:none}
.sk-form h2{margin:0;font-size:16px;font-weight:700}
.sk-form-note{margin:0;font-size:13px;color:var(--sh-ink3);line-height:1.5}
.sk-f{display:grid;gap:5px}
.sk-f label{font-size:12.5px;color:var(--sh-ink3)}
.sk-f input,.sk-f textarea{
  width:100%;padding:10px 12px;
  border:1px solid var(--sh-line);border-radius:10px;
  background:var(--sh-bg1);color:var(--sh-ink);font:inherit;font-size:13.5px;
}
.sk-f textarea{min-height:70px;resize:vertical;line-height:1.5}
.sk-f input:focus,.sk-f textarea:focus{outline:none;border-color:var(--sh-line2)}
.sk-form-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.sk-submit{
  height:40px;padding:0 20px;border:0;border-radius:10px;cursor:pointer;
  background:var(--sh-ink);color:var(--sh-bg1);font:inherit;font-weight:650;font-size:13.5px;
}
.sk-submit[disabled]{opacity:.55;cursor:default}
.sk-cancel{
  height:40px;padding:0 16px;border:1px solid var(--sh-line);border-radius:10px;
  background:none;color:var(--sh-ink2);font:inherit;font-size:13.5px;cursor:pointer;
}
.sk-msg{margin:0;font-size:13px;line-height:1.5}
.sk-msg.err{color:#e5484d}
.sk-msg.ok{color:#2a9d5c}

/* ── Cards ──────────────────────────────────────────────── */
.sk-grid{
  padding:8px 28px 12px;
  display:grid;gap:18px;
  grid-template-columns:repeat(auto-fill,minmax(266px,1fr));
}
.sk-card{
  border:1px solid var(--sh-line);border-radius:16px;overflow:hidden;
  background:var(--sh-bg2);display:flex;flex-direction:column;
  transition:border-color .15s ease,transform .15s ease;
}
.sk-card:hover{border-color:var(--sh-line2);transform:translateY(-2px)}
.sk-thumb{
  display:block;position:relative;aspect-ratio:16/9;
  background:var(--sh-bg3);overflow:hidden;
}
.sk-thumb img{width:100%;height:100%;object-fit:cover;display:block}
/* Instagram publishes no open thumbnail endpoint, so those cards get a drawn
   panel rather than a broken image frame. */
.sk-thumb-fallback{
  position:absolute;inset:0;display:grid;place-items:center;
  color:var(--sh-ink3);font-size:12px;letter-spacing:.08em;text-transform:uppercase;
}
.sk-play{
  position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
  width:44px;height:44px;border-radius:50%;
  background:rgba(0,0,0,.62);display:grid;place-items:center;
}
.sk-play svg{width:16px;height:16px;fill:#fff;margin-left:2px}
.sk-body{padding:13px 14px 12px;display:grid;gap:6px;flex:1}
.sk-title{margin:0;font-size:14.5px;font-weight:650;line-height:1.35;color:var(--sh-ink)}
.sk-title a{color:inherit;text-decoration:none}
.sk-title a:hover{text-decoration:underline}
.sk-summary{
  margin:0;font-size:12.5px;color:var(--sh-ink3);line-height:1.5;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
}
.sk-foot{
  display:flex;align-items:center;justify-content:space-between;gap:8px;
  margin-top:auto;padding:9px 14px;border-top:1px solid var(--sh-line);
  font-size:12px;color:var(--sh-ink3);
}
.sk-author{display:inline-flex;align-items:center;gap:5px;min-width:0}
.sk-author a{color:var(--sh-ink);font-weight:600;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sk-author a:hover{text-decoration:underline}
.sk-tick{width:12px;height:12px;flex:none}
.sk-plat{
  flex:none;padding:2px 8px;border:1px solid var(--sh-line);border-radius:999px;
  font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;
}
.sk-tpl{
  display:inline-flex;align-items:center;gap:4px;
  font-size:11.5px;color:var(--sh-ink3);text-decoration:none;
}
.sk-tpl:hover{color:var(--sh-ink);text-decoration:underline}

/* ── Your submissions ───────────────────────────────────── */
.sk-mine{padding:6px 28px 0;max-width:760px}
.sk-mine[hidden]{display:none}
.sk-mine h2{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--sh-ink3);margin:0 0 10px;font-weight:600}
.sk-mine-row{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:10px 13px;border:1px solid var(--sh-line);border-radius:11px;
  background:var(--sh-bg2);margin-bottom:8px;font-size:13px;
}
.sk-mine-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--sh-ink)}
.sk-pill{
  flex:none;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:600;
  border:1px solid var(--sh-line);color:var(--sh-ink3);
}
.sk-pill.pending{border-color:#c99a2e59;color:#b8860b}
.sk-pill.published{border-color:#2a9d5c59;color:#2a9d5c}
.sk-pill.rejected{border-color:#e5484d59;color:#e5484d}
.sk-mine-note{font-size:12px;color:var(--sh-ink3);margin:-4px 0 10px;padding-left:13px}

/* ── Empty state ────────────────────────────────────────── */
.sk-empty{
  margin:6px 28px 28px;padding:44px 28px;text-align:center;
  border:1px dashed var(--sh-line2);border-radius:18px;
}
.sk-empty h3{margin:0 0 8px;font-size:19px;font-weight:700}
.sk-empty p{margin:0 auto 18px;max-width:440px;color:var(--sh-ink2);font-size:14px;line-height:1.6}

@media (max-width:640px){
  .sk-head{padding:32px 18px 12px}
  .sk-grid{padding:8px 18px 12px;grid-template-columns:1fr}
  .sk-form{margin:0 18px 18px}
  .sk-mine,.sk-empty{margin-left:18px;margin-right:18px;padding-left:0;padding-right:0}
}
</style>`,
  body: `    <main class="sh-home">
      <section class="sk-head">
        <div>
          <span class="sh-eyebrow">Creator skills</span>
          <h1>Learn from other creators</h1>
          <p>Walkthroughs and teaching videos made by people who use ShortsCraft. Every video plays on the creator's own channel.</p>
        </div>
        <button type="button" class="sk-share-btn" id="skShareBtn">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          Share a tutorial
        </button>
      </section>

      <form class="sk-form" id="skForm" hidden>
        <h2>Share a tutorial</h2>
        <p class="sk-form-note">Paste the link to a video you have already published on YouTube or Instagram. We never host the video — people watch it on your channel, so the views stay yours. A moderator checks each submission before it appears here.</p>

        <div class="sk-f">
          <label for="skUrl">Video link</label>
          <input type="url" id="skUrl" name="url" placeholder="https://youtu.be/… or https://instagram.com/reel/…" required>
        </div>
        <div class="sk-f">
          <label for="skTitle">Title</label>
          <input type="text" id="skTitle" name="title" maxlength="90" placeholder="What does the video teach?" required>
        </div>
        <div class="sk-f">
          <label for="skSummary">Short description <span style="opacity:.65">— optional</span></label>
          <textarea id="skSummary" name="summary" maxlength="220" placeholder="One or two lines about what someone will learn."></textarea>
        </div>
        <div class="sk-f">
          <label for="skTemplate">Which template does it cover? <span style="opacity:.65">— optional</span></label>
          <input type="text" id="skTemplate" name="templateId" maxlength="60" placeholder="e.g. text-cascade">
        </div>

        <div class="sk-form-actions">
          <button type="submit" class="sk-submit" id="skSubmit">Submit for review</button>
          <button type="button" class="sk-cancel" id="skCancel">Cancel</button>
        </div>
        <p class="sk-msg" id="skMsg" role="status"></p>
      </form>

      <section class="sk-mine" id="skMine" hidden>
        <h2>Your tutorials</h2>
        <div id="skMineList"></div>
      </section>

      <div class="sk-grid" id="skGrid"></div>

      <div class="sk-empty" id="skEmpty" hidden>
        <h3>No tutorials yet</h3>
        <p>This is where creators explain how they made something. If you have published a walkthrough on YouTube or Instagram, it can be the first one here.</p>
        <div class="sh-gallery-end-actions">
          <a href="/#templates" class="sh-ge-btn sh-ge-primary">Browse the template library</a>
          <a href="/tutorials" class="sh-ge-btn">Read the written guides</a>
        </div>
      </div>
    </main>`,
scripts: `<script>
(function () {
  "use strict";
  var grid = document.getElementById("skGrid");
  var empty = document.getElementById("skEmpty");
  var form = document.getElementById("skForm");
  var shareBtn = document.getElementById("skShareBtn");
  var cancelBtn = document.getElementById("skCancel");
  var submitBtn = document.getElementById("skSubmit");
  var msg = document.getElementById("skMsg");
  var mine = document.getElementById("skMine");
  var mineList = document.getElementById("skMineList");
  var signedIn = false;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function say(text, kind) {
    if (!msg) return;
    msg.textContent = text || "";
    msg.className = "sk-msg" + (kind ? " " + kind : "");
  }

  var TICK = '<svg class="sk-tick" viewBox="0 0 24 24" fill="#1d9bf0" aria-label="Verified"><path d="M12 2l2.4 1.8 3-.2.9 2.9 2.4 1.8-1.2 2.7 1.2 2.7-2.4 1.8-.9 2.9-3-.2L12 22l-2.4-1.8-3 .2-.9-2.9L3.3 15.7 4.5 13 3.3 10.3l2.4-1.8.9-2.9 3 .2z"/><path d="M10.6 14.6l-2.2-2.2 1.1-1.1 1.1 1.1 3.9-3.9 1.1 1.1z" fill="#fff"/></svg>';

  var PLAY = '<span class="sk-play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span>';

  function card(s) {
    var el = document.createElement("article");
    el.className = "sk-card";

    // rel="noopener" because every one of these links leaves for a site we do
    // not control, opened in a new tab.
    var thumb = s.thumbnail
      ? '<img src="' + esc(s.thumbnail) + '" alt="" loading="lazy" width="480" height="270">'
      : '<span class="sk-thumb-fallback">' + esc(s.platform) + '</span>';

    var authorHref = s.author.handle ? "/creator?handle=" + encodeURIComponent(s.author.handle) : "";
    var authorName = esc(s.author.name) + (s.author.verified ? TICK : "");
    var author = authorHref
      ? '<a href="' + esc(authorHref) + '">' + authorName + "</a>"
      : "<span>" + authorName + "</span>";

    el.innerHTML =
      '<a class="sk-thumb" href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' +
        thumb + PLAY +
      "</a>" +
      '<div class="sk-body">' +
        '<h3 class="sk-title"><a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' +
          esc(s.title) + "</a></h3>" +
        (s.summary ? '<p class="sk-summary">' + esc(s.summary) + "</p>" : "") +
        (s.templateId
          ? '<a class="sk-tpl" href="/editor?tpl=' + encodeURIComponent(s.templateId) + '">Open ' +
            esc(s.templateId) + " in the Studio →</a>"
          : "") +
      "</div>" +
      '<div class="sk-foot">' +
        '<span class="sk-author">' + author + "</span>" +
        '<span class="sk-plat">' + esc(s.platform) + "</span>" +
      "</div>";
    return el;
  }

  function render(list) {
    grid.innerHTML = "";
    if (!list.length) {
      grid.hidden = true;
      empty.hidden = false;
      return;
    }
    grid.hidden = false;
    empty.hidden = true;
    var frag = document.createDocumentFragment();
    list.forEach(function (s) { frag.appendChild(card(s)); });
    grid.appendChild(frag);
  }

  function load() {
    return fetch("/api/skills", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (j) { render((j && j.skills) || []); })
      .catch(function () {
        // A failed load must not look like an empty community.
        grid.hidden = true;
        empty.hidden = false;
        empty.querySelector("h3").textContent = "Could not load tutorials";
        empty.querySelector("p").textContent = "Something went wrong reaching the server. Reload the page to try again.";
      });
  }

  function renderMine(list) {
    if (!mine || !mineList) return;
    if (!list.length) { mine.hidden = true; return; }
    mine.hidden = false;
    mineList.innerHTML = "";
    list.forEach(function (s) {
      var row = document.createElement("div");
      row.className = "sk-mine-row";
      row.innerHTML =
        '<span class="sk-mine-title">' + esc(s.title) + "</span>" +
        '<span class="sk-pill ' + esc(s.status) + '">' + esc(s.status) + "</span>";
      mineList.appendChild(row);
      // A rejection without its reason is indistinguishable from a submission
      // that vanished, so the note is shown to the person who wrote it.
      if (s.status === "rejected" && s.reviewNote) {
        var note = document.createElement("p");
        note.className = "sk-mine-note";
        note.textContent = s.reviewNote;
        mineList.appendChild(note);
      }
    });
  }

  function loadMine() {
    return fetch("/api/skills/mine", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.skills) renderMine(j.skills); })
      .catch(function () {});
  }

  if (shareBtn) {
    shareBtn.addEventListener("click", function () {
      if (!signedIn) {
        location.href = "/login?next=" + encodeURIComponent("/community");
        return;
      }
      form.hidden = !form.hidden;
      if (!form.hidden) document.getElementById("skUrl").focus();
    });
  }
  if (cancelBtn) {
    cancelBtn.addEventListener("click", function () { form.hidden = true; say(""); });
  }

  if (form) {
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var body = {
        url: document.getElementById("skUrl").value,
        title: document.getElementById("skTitle").value,
        summary: document.getElementById("skSummary").value,
        templateId: document.getElementById("skTemplate").value
      };
      submitBtn.disabled = true;
      say("Sending…");
      fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (out) {
          if (!out.ok || !out.j.success) {
            say((out.j && out.j.error) || "Could not share that tutorial.", "err");
            return;
          }
          say("Thanks — a moderator will review it before it appears here.", "ok");
          form.reset();
          loadMine();
        })
        .catch(function () { say("Could not reach the server. Try again.", "err"); })
        .finally(function () { submitBtn.disabled = false; });
    });
  }

  fetch("/api/auth/me", { headers: { Accept: "application/json" } })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      signedIn = !!(j && j.user);
      if (signedIn) loadMine();
    })
    .catch(function () {});

  load();
})();
</script>`
};

const contact = {
  route: "/contact",
  active: "contact",
  title: "Help & Feedback — ShortsCraft",
  desc: "Report a bug, request a template or ask a question about ShortsCraft. Messages reach the person who builds it.",
  body: `    <main class="pg">
${pageHead("Help &amp; Feedback", "Tell us what is broken or missing.", "Bug reports and template requests both land in the same inbox, and a person reads them.")}

      <div class="pg-two">
        <form class="pg-form" id="fbForm" novalidate>
          <div class="pg-f">
            <label for="fbName">Your name</label>
            <input id="fbName" name="name" type="text" maxlength="80" autocomplete="name" required>
          </div>
          <div class="pg-f">
            <label for="fbEmail">Email <span>— so we can reply</span></label>
            <input id="fbEmail" name="email" type="email" maxlength="120" autocomplete="email" required>
          </div>
          <div class="pg-f">
            <label for="fbSubject">Subject</label>
            <select id="fbSubject" name="subject">
              <option value="Bug report" data-category="other">Bug report</option>
              <option value="Template request" data-category="template">Template request</option>
              <option value="Export or rendering problem" data-category="export">Export or rendering problem</option>
              <option value="Account or login problem" data-category="account">Account or login problem</option>
              <option value="Billing or plan question" data-category="billing">Billing or plan question</option>
              <option value="Report a template" data-category="report">Report a template</option>
              <option value="Feature idea" data-category="other">Feature idea</option>
              <option value="Something else" data-category="other">Something else</option>
            </select>
          </div>
          <div class="pg-f">
            <label for="fbMessage">Message</label>
            <textarea id="fbMessage" name="message" rows="7" maxlength="2000" required
              placeholder="What were you doing, what did you expect, and what happened instead?"></textarea>
          </div>
          <button class="pg-bw" type="submit" id="fbSend">Send message</button>
          <p class="pg-formnote" id="fbNote" role="status" aria-live="polite"></p>
        </form>

        <aside class="pg-aside">
          <section class="pg-card">
            <h2>Reporting a bug?</h2>
            <p>Please include the page URL, your device and browser, and the template or clip you were working on. That usually turns a two-day guess into a same-day fix.</p>
          </section>
          <section class="pg-card">
            <h2>Requesting a template?</h2>
            <p>Describe the <em>object</em> you want animated — a switch, a chart, a phone screen, a card — plus where you would use it. Object ideas get built; "make it look premium" cannot.</p>
          </section>
          <section class="pg-card">
            <h2>Elsewhere</h2>
            <p>
${SOCIAL.filter(s => s.href).map(s => `              <a href="${s.href}" rel="noopener" target="_blank">${s.label} · ${s.handle}</a>`).join("<br>\n")}
            </p>
          </section>
          <section class="pg-card">
            <h2>Response time</h2>
            <p>The target is a reply within two working days. Billing and blocked exports are reviewed first.</p>
          </section>
        </aside>
      </div>

      <section class="pg-sec" id="supportHistory" hidden>
        <div class="pg-accsec-head"><h2>Your support tickets</h2><span class="pg-fine">Signed-in account only</span></div>
        <div class="pg-grid" id="supportTicketGrid"></div>
      </section>
    </main>`
};

/* ── LEGAL ────────────────────────────────────────────────── */
const UPDATED = "2 September 2026";

const privacy = {
  route: "/privacy",
  active: null,
  title: "Privacy Policy — ShortsCraft",
  desc: "What ShortsCraft collects, why, who processes it and how to get your data removed.",
  body: `    <main class="pg">
${pageHead("Legal", "Privacy Policy", `Last updated ${UPDATED}. Written to be read, not to hide behind.`)}

      <section class="pg-sec pg-prose pg-legal">
        <h2>The short version</h2>
        <p>You can use the editor without an account. We do not sell your data, we do not run advertising networks on this site, and the text you type is used to produce your result — not to train a model of our own.</p>

        <h2>What we collect</h2>
        <ul>
          <li><strong>What you type into a tool</strong> — the topic or script you submit is sent to our AI provider to generate your result. It is not stored in a database by us.</li>
          <li><strong>What you send us on purpose</strong> — the name, email, subject and message from the Help &amp; Feedback form, so we can reply.</li>
          <li><strong>Usage analytics</strong> — Google Analytics gives us aggregate page views and device types. It sets cookies in your browser.</li>
          <li><strong>Server logs</strong> — standard request logs including IP address, kept short-term for abuse and rate limiting.</li>
          <li><strong>Payment details</strong> — handled entirely by Razorpay. Card numbers never reach our servers.</li>
        </ul>
        <p>We do not ask for your date of birth, address, phone number or any government ID.</p>

        <h2>Who else processes it</h2>
        <ul>
          <li><strong>Groq</strong> — runs the language model that writes scripts, titles, descriptions, hashtags and ideas.</li>
          <li><strong>Supabase</strong> — stores feedback-form messages.</li>
          <li><strong>Razorpay</strong> — processes payments and holds the billing record.</li>
          <li><strong>Google Analytics</strong> — aggregate usage measurement.</li>
          <li><strong>Our hosting provider</strong> — serves the site and keeps request logs.</li>
        </ul>

        <h2>Your animations</h2>
        <p>Projects live in your browser. Exported MP4 files are rendered on demand, streamed to your download and not archived on our side.</p>

        <h2>Cookies</h2>
        <p>Analytics cookies from Google, and browser local storage we use to carry your prompt from the home page into the editor. No advertising or cross-site tracking cookies are set by us.</p>

        <h2>Children</h2>
        <p>ShortsCraft is not directed at children under 13, and we do not knowingly collect their data.</p>

        <h2>Your choices</h2>
        <p>Block analytics cookies in your browser and the site still works. To have a feedback message or billing record deleted, write to us from the same email address using <a href="/contact">Help &amp; Feedback</a> and we will remove it, except where we must keep a payment record for tax purposes.</p>

        <h2>Changes</h2>
        <p>If this policy changes materially, the date at the top changes with it.</p>

        <h2>Contact</h2>
        <p>Questions about privacy go through <a href="/contact">Help &amp; Feedback</a>.</p>
      </section>
    </main>`
};

const terms = {
  route: "/terms",
  active: null,
  title: "Terms of Service — ShortsCraft",
  desc: "The rules for using ShortsCraft: who owns the output, what is not allowed, plans and refunds, and the limits of our liability.",
  body: `    <main class="pg">
${pageHead("Legal", "Terms of Service", `Last updated ${UPDATED}. By using ShortsCraft you accept these terms.`)}

      <section class="pg-sec pg-prose pg-legal">
        <h2>What the service is</h2>
        <p>ShortsCraft generates animated videos from templates you configure, and text for short-form content using an AI model. It is a drafting tool. Judgement about what you publish stays with you.</p>

        <h2>Your content and your output</h2>
        <p>The text you enter remains yours. The videos and text you generate are yours to use commercially, including on monetised channels. We claim no ownership of your output and no right to republish your work.</p>
        <p>The templates, code, design and brand of ShortsCraft remain ours. You may use them to produce your videos; you may not resell, rehost or clone the product itself.</p>

        <h2>Review before you publish</h2>
        <p>AI output can be wrong, generic, or accidentally similar to something else. Fact-check it, edit it into your own voice, and make sure it fits the policies of the platform you upload to. We cannot be responsible for a video you did not check.</p>

        <h2>What is not allowed</h2>
        <ul>
          <li>Illegal content, or content that harasses, defames or endangers anyone.</li>
          <li>Sexual content involving minors, or any content that sexualises children.</li>
          <li>Impersonating a real person or brand, or building misleading medical, legal or financial claims.</li>
          <li>Scraping, automating or hammering the API beyond the published rate limits, or trying to bypass them.</li>
          <li>Reselling generations as your own API or service.</li>
        </ul>
        <p>Accounts or IPs doing any of this can be blocked without notice.</p>

        <h2>Free plan and fair use</h2>
        <p>The free plan includes ${P.free.perDay} credits per day. A video export costs ${C.export} credit and a custom AI scene costs ${C.animate}; editing and previewing do not spend credits. Resolution and queue limits keep rendering usable for everyone, and may be adjusted as capacity changes.</p>

        <h2>Pro plan, billing and refunds</h2>
        <p>Pro starts at ₹${P.pro.price} per month and Pro Max at ₹${P.promax.price} per month, with optional annual billing through Razorpay. Cancel any time; access continues to the end of the paid period. If a payment is charged but the plan is not delivered, contact <a href="/contact">Help &amp; Feedback</a> with the payment reference.</p>

        <h2>Availability</h2>
        <p>This is an independently run product. We do not promise uptime, and features can change or be withdrawn. Exports depend on server capacity — a long render may be queued.</p>

        <h2>Liability</h2>
        <p>ShortsCraft is provided "as is", without warranties. To the extent the law allows, our total liability is limited to the amount you paid us in the previous three months. We are not liable for lost revenue, lost views, or platform decisions about your channel.</p>

        <h2>Changes</h2>
        <p>These terms can change; the date above will say when. Continuing to use the service means accepting the current version.</p>

        <h2>Contact</h2>
        <p>Anything unclear here — ask through <a href="/contact">Help &amp; Feedback</a>.</p>
      </section>
    </main>`
};

/* ── 404 ──────────────────────────────────────────────────── */
const notfound = {
  route: "/404",
  active: null,
  robots: "noindex, follow",
  title: "Page not found — ShortsCraft",
  desc: "That page does not exist. Here is the way back to the editor and the tools.",
  body: `    <main class="pg">
      <section class="pg-404">
        <div class="pg-404code" aria-hidden="true">404</div>
        <h1>This page does not exist</h1>
        <p>The link may be old, or the page may have moved while we rebuilt the site.</p>
        <div class="pg-row">
          <a href="/editor" class="pg-bw">Open the Editor</a>
          <a href="/" class="pg-bo">Back to templates</a>
        </div>
        <nav class="pg-404links" aria-label="Popular pages">
          <a href="/community">Creator Skills</a>
          <a href="/pricing">Pricing</a>
          <a href="/about">About</a>
          <a href="/contact">Help &amp; Feedback</a>
        </nav>
      </section>
    </main>`
};

/* ── SEO TOOLS (app page) ─────────────────────────────────── */
const seoTools = {
  route: "/seo-tools",
  active: "seo",
  title: "SEO Tools for YouTube Shorts — ShortsCraft",
  desc: "Generate Hinglish scripts, titles, descriptions, hashtags, video ideas and thumbnail prompts for YouTube Shorts and Reels.",
  body: `    <main class="pg">
      <section class="pg-head">
        <span class="pg-eyebrow">Creator tools</span>
        <h1 data-seo="h1">SEO tools for animated Shorts</h1>
        <p data-seo="intro">Six tools on one topic: a Hinglish script, click-worthy titles, a full description, hashtags, follow-up ideas and thumbnail prompts.</p>
      </section>

      <div class="pg-tool">
        <form class="pg-toolbar" id="seoForm">
          <div class="pg-f pg-grow">
            <label for="seoTopic">Your topic</label>
            <input id="seoTopic" type="text" maxlength="160" required
              placeholder="Why consistency beats motivation for small creators">
          </div>
          <button class="pg-bw" type="submit" id="seoGo">Generate</button>
        </form>

        <div class="pg-tabs" role="tablist" aria-label="Tool">
${TOOLS.map((t, i) => `          <button class="pg-tab" type="button" role="tab" id="tab-${t.id}" data-tool="${t.id}"
            aria-selected="${i === 0}" aria-controls="panel-out" tabindex="${i === 0 ? 0 : -1}">${t.label}</button>`).join("\n")}
        </div>

        <section class="pg-out" id="panel-out" role="tabpanel" aria-labelledby="tab-script" tabindex="0">
          <div class="pg-outbar">
            <span class="pg-outname" id="seoOutName">Script</span>
            <div class="pg-outacts">
              <button class="pg-bo pg-sm" type="button" id="seoCopy" disabled>Copy</button>
              <button class="pg-bo pg-sm" type="button" id="seoDl" disabled>Download .txt</button>
            </div>
          </div>
          <div class="pg-outbody" id="seoOut" aria-live="polite">
            <p class="pg-empty">Type a topic and press Generate. Results appear here.</p>
          </div>
        </section>
      </div>

      <section class="pg-sec">
        <h2>What each tool gives you</h2>
        <div class="pg-grid">
          <article class="pg-card"><h3>Script</h3><p>A hook, a 180–260 word Hinglish body and two closing CTAs — written to be read aloud, not skimmed.</p></article>
          <article class="pg-card"><h3>Titles</h3><p>Five titles under 60 characters, the length that survives the Shorts feed.</p></article>
          <article class="pg-card"><h3>Description</h3><p>Hook lines, bullets, CTA and keywords, ready to paste under the video.</p></article>
          <article class="pg-card"><h3>Hashtags</h3><p>Fifteen tags mixing broad reach with niche and Hindi creator tags.</p></article>
          <article class="pg-card"><h3>Ideas</h3><p>Follow-up videos so one topic becomes a series instead of a one-off.</p></article>
          <article class="pg-card"><h3>Thumbnail prompts</h3><p>Image prompts you can take to any image generator.</p></article>
        </div>
      </section>

      <section class="pg-cta">
        <h2>Now animate it</h2>
        <p>Take the script into the editor and turn it into a real MP4.</p>
        <div class="pg-row">
          <a href="/editor" class="pg-bw">Open the Editor</a>
          <a href="/pricing" class="pg-bo">See pricing</a>
        </div>
      </section>
    </main>`,
  scripts: `<script src="/seo.js?v=${V}" defer></script>\n`
};

/* ── AUTH PAGES ───────────────────────────────────────────── */
const authPage = (kind) => {
  const isUp = kind === "signup";
  return {
    bare: true,
    route: isUp ? "/signup" : "/login",
    active: null,
    robots: "noindex, follow",
    title: (isUp ? "Create your account" : "Log in") + " — ShortsCraft",
    desc: isUp
      ? "Create a free ShortsCraft account to keep your credits and plan across devices."
      : "Log in to ShortsCraft to use your credits and plan.",
    body: `    <main class="pg pg-narrow">
      <section class="pg-head">
        <span class="pg-eyebrow">${isUp ? "Sign up" : "Log in"}</span>
        <h1>${isUp ? "Create your account" : "Welcome back"}</h1>
        <p>${isUp
      ? `An account keeps your ${P.free.perDay} daily credits and your plan attached to you instead of to one browser. No card, no email confirmation loop.`
      : "Log in to pick up your credits and plan."}</p>
      </section>

      <form class="pg-form pg-auth" id="authForm" data-kind="${kind}" novalidate>
        ${isUp ? `<div class="pg-f">
          <label for="authHandle">Creator username <span>— unique, 3–30 characters</span></label>
          <div class="pg-handle-input"><span>@</span><input id="authHandle" name="handle" type="text"
                 autocomplete="username" maxlength="30" pattern="[a-zA-Z0-9_]{3,30}"
                 placeholder="yourname" required></div>
          <small>This becomes your public profile link. You can change it later.</small>
        </div>` : ""}
        <div class="pg-f">
          <label for="authEmail">Email</label>
          <input id="authEmail" name="email" type="email" autocomplete="email"
                 maxlength="140" required>
        </div>
        <div class="pg-f">
          <label for="authPassword">Password${isUp ? " <span>— at least 8 characters</span>" : ""}</label>
          <input id="authPassword" name="password" type="password"
                 autocomplete="${isUp ? "new-password" : "current-password"}"
                 minlength="8" maxlength="200" required>
        </div>
        <button class="pg-bw" type="submit" id="authSend">${isUp ? "Create account" : "Log in"}</button>
        <p class="pg-formnote" id="authNote" role="status" aria-live="polite"></p>
        <p class="pg-fine">
          ${isUp
      ? 'Already have an account? <a href="/login">Log in</a>.'
      : 'No account yet? <a href="/signup">Create one</a>.'}
          ${isUp ? 'By creating an account you accept our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.' : ""}
        </p>
        ${isUp ? "" : `<p class="pg-fine">
          Forgotten your password? <a href="/forgot-password">Reset it</a>.
        </p>`}
      </form>
    </main>`
  };
};

const account = {
  route: "/account",
  active: null,
  robots: "noindex, follow",
  title: "My Profile & Setup — ShortsCraft",
  desc: "Manage your creator profile, channel links, daily credits, and account settings.",
  body: `    <main class="pg ig-main">

      <section class="ig-prof-container" id="accountBox" hidden>

        <!-- Profile header.

             Rebuilt away from the Instagram pastiche: a story ring and a
             128px avatar work when a grid of photos sits under them, and
             read as an empty stage when a new creator has one template.
             This leads with who the person is and what they have, and
             surfaces the profile fields the product already stores but
             never showed - location, website and channel links. -->
        <header class="ig-header">
          <div class="ig-avatar-col">
            <div class="ig-story-ring" title="Profile photo">
              <div class="ig-avatar" id="crAvatarChar">KA</div>
            </div>
          </div>

          <div class="ig-info-col">
            <div class="ig-user-row">
              <div class="ig-name-block">
                <h1 class="ig-fullname" id="crDisplayName">Creator</h1>
                <div class="ig-handle-line">
                  <span class="ig-username" id="crHandle">@creator</span>
                  <span class="ig-badge" id="crVerifiedBadge" title="Verified creator - an active yearly plan, not an identity check" hidden>
                    <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15" aria-label="Verified"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                    <span>Verified</span>
                  </span>
                </div>
              </div>

              <div class="ig-actions-row">
                <button type="button" class="ig-btn ig-btn-primary" id="openEditProfileBtn">Edit profile</button>
                <button type="button" class="ig-btn ig-btn-secondary" id="shareProfileBtn" title="Copy your public profile link">Share profile</button>
              </div>
            </div>

            <p class="ig-bio" id="crBio"></p>

            <div class="ig-links-row">
              <span class="ig-link-pill" id="crLocationChip" hidden>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span id="crLocationText"></span>
              </span>
              <a id="crWebsiteLink" href="/" target="_blank" rel="noopener" class="ig-link-pill" hidden>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                <span id="crWebsiteText">Website</span>
              </a>
              <a id="crYtLink" href="/account" target="_blank" rel="noopener" class="ig-link-pill" hidden>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M23 12s0-3.9-.5-5.8a3 3 0 0 0-2.1-2.1C18.5 3.5 12 3.5 12 3.5s-6.5 0-8.4.6A3 3 0 0 0 1.5 6.2C1 8.1 1 12 1 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 8.4.6 8.4.6s6.5 0 8.4-.6a3 3 0 0 0 2.1-2.1C23 15.9 23 12 23 12ZM9.8 15.5v-7l6 3.5-6 3.5Z"/></svg>
                <span>YouTube</span>
              </a>
              <a id="crIgLink" href="/account" target="_blank" rel="noopener" class="ig-link-pill" hidden>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                <span>Instagram</span>
              </a>
            </div>

            <!-- Credits were a stat here as well as in the rail and the top
                 bar. They belong to the plan, not to the profile, so they
                 now appear once - under Plan and credits. -->
            <ul class="ig-stats-row">
              <!-- Each stat opens the tab behind it. A count you cannot open is
                   a claim rather than a fact, which is the thing this product
                   is not supposed to print. -->
              <li class="ig-stat"><button type="button" data-jump="creations"><strong id="igCreationsCount">0</strong> <span>creations</span></button></li>
              <li class="ig-stat"><button type="button" data-jump="followers"><strong id="crFollowersCount">0</strong> <span>followers</span></button></li>
              <li class="ig-stat"><button type="button" data-jump="following"><strong id="crFollowingCount">0</strong> <span>following</span></button></li>
              <li class="ig-stat"><button type="button" data-jump="stars"><strong id="crStarsCount">0</strong> <span>Stars received</span></button></li>
            </ul>
          </div>
        </header>

        <!-- The story-highlights tray was six links to /editor,
             /#templates, /pricing, /community and /tutorials — every one
             of them already a row in the rail, two clicks from here and
             visible on every page. It duplicated the navigation it sat
             next to, and its labels were the least readable text on the
             page, so the profile now starts at its own content. -->

        <!-- Tabs.

             "Saved & Drafts" held three cards that linked to /drafts,
             /uploads and /editor - all three already rows in the rail, so
             the tab was navigation wearing a tab's clothes. It is replaced
             by the two things the plan asks this page to carry and it
             never did: Stars (non-cash appreciation, monthly allowance)
             and the user's own support history. -->
        <nav class="ig-tabs" role="tablist">
          <button type="button" class="ig-tab-btn is-active" id="igTabCreations" data-ig-tab="creations" role="tab" aria-controls="igPaneCreations" aria-selected="true">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            <span>Creations</span>
          </button>
          <button type="button" class="ig-tab-btn" id="igTabFollowers" data-ig-tab="followers" role="tab" aria-controls="igPaneFollowers" aria-selected="false">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>
            <span>Followers</span>
          </button>
          <button type="button" class="ig-tab-btn" id="igTabFollowing" data-ig-tab="following" role="tab" aria-controls="igPaneFollowing" aria-selected="false">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11h-6"/></svg>
            <span>Following</span>
          </button>
          <button type="button" class="ig-tab-btn" id="igTabStars" data-ig-tab="stars" role="tab" aria-controls="igPaneStars" aria-selected="false">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.1 8.6 22 9.6 17 14.5 18.2 21.4 12 18.1 5.8 21.4 7 14.5 2 9.6 8.9 8.6 12 2"/></svg>
            <span>Stars</span>
          </button>
          <button type="button" class="ig-tab-btn" id="igTabAccount" data-ig-tab="account" role="tab" aria-controls="igPaneAccount" aria-selected="false">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            <span>Plan &amp; credits</span>
          </button>
          <button type="button" class="ig-tab-btn" id="igTabSupport" data-ig-tab="support" role="tab" aria-controls="igPaneSupport" aria-selected="false">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>Support</span>
          </button>
          <button type="button" class="ig-tab-btn" id="igTabEdit" data-ig-tab="edit" role="tab" aria-controls="igPaneEdit" aria-selected="false">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>Edit profile</span>
          </button>
        </nav>

        <!-- Tab 1: published creations -->
        <section class="ig-pane is-active" id="igPaneCreations" role="tabpanel" aria-labelledby="igTabCreations">
          <div class="ig-grid" id="userCreationsGrid">
            <!-- Rendered by authui.js -->
          </div>
        </section>

        <!-- Followers and following.

             The profile has shown these counts since it was built, with
             nothing behind them: no way to see who, and no way to follow
             back. These are the real lists, and each row carries the
             follow control so the list is somewhere you can act. -->
        <section class="ig-pane" id="igPaneFollowers" role="tabpanel" aria-labelledby="igTabFollowers" hidden>
          <div class="ig-people" id="followersList" data-kind="followers">
            <p class="ig-acc-sub">Loading…</p>
          </div>
        </section>

        <section class="ig-pane" id="igPaneFollowing" role="tabpanel" aria-labelledby="igTabFollowing" hidden>
          <div class="ig-people" id="followingList" data-kind="following">
            <p class="ig-acc-sub">Loading…</p>
          </div>
        </section>

        <!-- Tab 2: Stars.

             The plan is explicit that Stars must never read as money while
             monetization is off, so the wording says so on the page rather
             than in a tooltip. -->
        <section class="ig-pane" id="igPaneStars" role="tabpanel" aria-labelledby="igTabStars" hidden>
          <div class="ig-account-grid">
            <article class="ig-account-card">
              <div class="ig-acc-head"><span class="ig-acc-lbl">Stars to give this month</span></div>
              <p class="ig-acc-val" id="starsBalance">—</p>
              <p class="ig-acc-sub" id="starsAllowance">Your monthly allowance refreshes on the 1st.</p>
            </article>

            <article class="ig-account-card">
              <div class="ig-acc-head"><span class="ig-acc-lbl">Stars received</span></div>
              <p class="ig-acc-val" id="starsReceived">—</p>
              <p class="ig-acc-sub">From other creators, on your published templates.</p>
            </article>

            <article class="ig-account-card">
              <div class="ig-acc-head"><span class="ig-acc-lbl">Stars given</span></div>
              <p class="ig-acc-val" id="starsSent">—</p>
              <p class="ig-acc-sub">Appreciation you have sent to other creators.</p>
            </article>
          </div>

          <div class="ig-note-block">
            <h4>What Stars are</h4>
            <p>Stars are a way to say a template helped you. They are <strong>not money and cannot be withdrawn, transferred or converted into credits</strong>. Every plan gets a monthly allowance to give away; giving one costs you nothing.</p>
            <p class="ig-acc-sub">Creator monetization is not live. If it ever is, it will be announced with its own terms — Stars given today do not create a claim on it.</p>
          </div>
        </section>

        <!-- Tab 3: plan and credits -->
        <section class="ig-pane" id="igPaneAccount" role="tabpanel" aria-labelledby="igTabAccount" hidden>
          <div class="ig-account-grid">
            <article class="ig-account-card ig-acc-highlight">
              <div class="ig-acc-head">
                <span class="ig-acc-lbl">Current plan</span>
                <!-- This pill used to read "ACTIVE" for everyone, including
                     accounts with no plan at all. It is filled from the
                     ledger now, or hidden. -->
                <span class="ig-badge ig-badge-pill" id="accPlanState" hidden></span>
              </div>
              <p class="ig-acc-val" id="accPlan">—</p>
              <p class="ig-acc-sub" id="accPlanTerm"></p>
              <a href="/pricing" class="ig-card-cta">Compare plans →</a>
            </article>

            <article class="ig-account-card">
              <div class="ig-acc-head"><span class="ig-acc-lbl">Credits today</span></div>
              <p class="ig-acc-val" id="accCredits">—</p>
              <p class="ig-acc-sub" id="accCreditCosts">Export 1 · AI scene 2. Credits refresh daily at 00:00 UTC and do not stack.</p>
            </article>

            <article class="ig-account-card">
              <div class="ig-acc-head"><span class="ig-acc-lbl">Account email</span></div>
              <p class="ig-acc-val ig-acc-wrap" id="accEmail">—</p>
            </article>

            <article class="ig-account-card">
              <div class="ig-acc-head"><span class="ig-acc-lbl">Member since</span></div>
              <p class="ig-acc-val" id="accSince">—</p>
            </article>
          </div>

          <div class="ig-danger-zone">
            <div class="ig-danger-info">
              <h4>Sign out</h4>
              <p>Ends this session on this device. Your work is kept.</p>
            </div>
            <button type="button" class="ig-btn ig-btn-danger" id="accLogoutPane">Log out</button>
          </div>
        </section>

        <!-- Tab 4: support history.

             The plan requires a signed-in user to be able to see their own
             tickets. The API existed; the page never asked for it, so the
             contact form was a one-way street. -->
        <section class="ig-pane" id="igPaneSupport" role="tabpanel" aria-labelledby="igTabSupport" hidden>
          <div class="ig-support-head">
            <div>
              <h3>Your support requests</h3>
              <p class="ig-acc-sub">Billing and broken exports are handled first. ShortsCraft is run by one person, so replies usually take up to two working days.</p>
            </div>
            <a href="/contact" class="ig-btn ig-btn-primary">New request</a>
          </div>
          <div class="ig-support-list" id="supportTicketList">
            <p class="ig-acc-sub">Loading your requests…</p>
          </div>
        </section>

        <!-- Tab 4: Edit Profile Form -->
        <section class="ig-pane" id="igPaneEdit" role="tabpanel" aria-labelledby="igTabEdit" hidden>
          <div class="ig-edit-container">
            <div class="ig-edit-header">
              <div class="ig-edit-av" id="pageAvatarPreview">KA</div>
              <div class="ig-edit-av-info">
                <h3 id="pageAvatarHandle">@creator</h3>
                <p>Use a clear photo or logo. PNG, JPG or WebP, up to 2 MB.</p>
                <div class="ig-avatar-actions">
                  <button type="button" class="ig-btn ig-btn-secondary" id="pageChooseAvatarBtn">Change photo</button>
                  <button type="button" class="ig-btn ig-btn-secondary" id="pageRemoveAvatarBtn">Remove</button>
                  <input type="file" id="pageAvatarInput" accept="image/png,image/jpeg,image/webp" hidden>
                </div>
              </div>
            </div>

            <form id="pageEditProfileForm" class="ig-edit-form">
              <div class="ig-field">
                <label class="ig-label" for="pageDisplayName">
                  <span>Display Name</span>
                  <span class="ig-hint">Public name visible on your creations</span>
                </label>
                <input type="text" id="pageDisplayName" class="ig-input" placeholder="e.g. Karim Abdul" required maxlength="50" />
              </div>

              <div class="ig-field">
                <label class="ig-label" for="pageHandle">
                  <span>Creator Handle</span>
                  <span class="ig-hint">Unique @username</span>
                </label>
                <input type="text" id="pageHandle" class="ig-input" placeholder="e.g. @karim_creates" required maxlength="30" />
              </div>

              <div class="ig-field">
                <label class="ig-label" for="pageBio">
                  <span>Bio &amp; Style</span>
                  <span class="ig-hint">Short description about your animation niche</span>
                </label>
                <textarea id="pageBio" class="ig-input ig-textarea" rows="3" placeholder="Designing viral YouTube Shorts, Instagram Reels &amp; AI kinetic typography motion graphics."></textarea>
              </div>

              <div class="ig-grid-2">
                <div class="ig-field">
                  <label class="ig-label" for="pageWebsite">Website</label>
                  <input type="url" id="pageWebsite" class="ig-input" placeholder="https://yourwebsite.com" maxlength="180" />
                </div>

                <div class="ig-field">
                  <label class="ig-label" for="pageLocation">Location <span class="ig-hint">Optional</span></label>
                  <input type="text" id="pageLocation" class="ig-input" placeholder="e.g. Delhi, India" maxlength="80" />
                </div>

                <div class="ig-field">
                  <label class="ig-label" for="pageYoutube">YouTube Channel URL</label>
                  <div class="ig-input-wrap">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="#ff0000"><path d="M23 12s0-3.9-.5-5.8a3 3 0 0 0-2.1-2.1C18.5 3.5 12 3.5 12 3.5s-6.5 0-8.4.6A3 3 0 0 0 1.5 6.2C1 8.1 1 12 1 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 8.4.6 8.4.6s6.5 0 8.4-.6a3 3 0 0 0 2.1-2.1C23 15.9 23 12 23 12ZM9.8 15.5v-7l6 3.5-6 3.5Z"/></svg>
                    <input type="text" id="pageYoutube" class="ig-input" placeholder="https://youtube.com/@channel" />
                  </div>
                </div>

                <div class="ig-field">
                  <label class="ig-label" for="pageInstagram">Instagram Profile URL</label>
                  <div class="ig-input-wrap">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e1306c" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                    <input type="text" id="pageInstagram" class="ig-input" placeholder="https://instagram.com/profile" />
                  </div>
                </div>
              </div>

              <div class="ig-form-foot">
                <span id="pageProfileMsg" class="ig-msg"></span>
                <button type="button" class="ig-btn ig-btn-secondary" id="pageCancelProfileBtn">Cancel</button>
                <button type="submit" class="ig-btn ig-btn-primary" id="pageSaveProfileBtn">Save Profile Changes</button>
              </div>
            </form>
          </div>
        </section>

      </section>

${guestGate("/account", "Log in to see your account", "Your creator profile, channel links, daily credits, and account settings all live behind a login.", ["Your plan and daily credit balance in one place", "Templates you publish stay tied to your creator name", "Drafts and settings follow you to any device"])}
    </main>`
};

const indexPage = {
  route: "/",
  active: "templates",
  noPageJs: true,
  title: "ShortsCraft — Create and customize motion templates",
  desc: "Create short-form animations from a prompt or customize motion templates in a focused browser editor. Preview freely and export a real MP4 when it is ready.",
  head: `<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebApplication","name":"ShortsCraft","url":"https://shortscraft.online/","description":"AI motion graphics video generator for YouTube Shorts"}</script>`,
  body: `    <main class="sh-home">
      <section class="sh-hero">
        <span class="sh-home-kicker">Animation workspace</span>
        <h1>What do you want to animate?</h1>
        <p class="sh-hero-sub">Describe a scene or start from a template. You stay in control of the text, colour, timing and layout.</p>
      </section>

      <form class="sh-composer" id="composer" action="/editor" method="GET">
        <div class="sh-ctop">
          <label class="ed-sr" for="composerPrompt">Describe the animation you want</label>
          <textarea id="composerPrompt" name="topic" rows="2" maxlength="600"
            placeholder="Example: A clean pricing card that flips to reveal ₹199, with a blue accent"></textarea>
        </div>
        <div class="sh-cbar">
          <input type="file" id="composerImg" accept="image/png,image/jpeg,image/webp,image/gif" class="ed-sr">
          <label class="sh-imgbtn" for="composerImg" title="Attach image to animate">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/></svg>
          </label>
          <button class="sh-imgchip" type="button" id="composerImgClear" hidden>
            <span id="composerImgName">image</span> <b>×</b>
          </button>
          <div class="sh-custom-select" id="qualityDropdown">
            <input type="hidden" name="quality" id="qualitySelect" value="mini">
            <button type="button" class="sh-csel-btn" id="qualityBtn" aria-haspopup="listbox" aria-expanded="false" aria-label="Model tier: Free">
              <span class="sh-csel-val" id="qualityVal">Standard · ${C.animate} credits</span>
              <svg class="sh-csel-arrow" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div class="sh-csel-menu" id="qualityMenu" role="listbox" hidden>
              <div class="sh-csel-opt selected" role="option" data-val="mini" aria-selected="true">
                <div class="sh-csel-opt-main"><b>Standard</b><span>Available to everyone · ${C.animate} credits</span></div>
                <svg class="sh-csel-check" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <div class="sh-csel-opt" role="option" data-val="pro" aria-selected="false">
                <div class="sh-csel-opt-main"><b>Detailed</b><span>Paid plan required · 5 credits</span></div>
                <svg class="sh-csel-check" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <div class="sh-csel-opt" role="option" data-val="max" aria-selected="false">
                <div class="sh-csel-opt-main"><b>Advanced</b><span>Paid plan required · 8 credits</span></div>
                <svg class="sh-csel-check" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
            </div>
          </div>
          <div class="sh-cgrow"></div>
          <!-- What the next click costs, before it is clicked. The tier picker
               already shows the generation price; this is the export price,
               which is the charge people were meeting only at the end. -->
          <span class="sh-cnote">Export costs ${C.export} credit${C.export === 1 ? "" : "s"}</span>
          <button class="sh-cgo" id="composerGo" type="submit">Create animation <span aria-hidden="true">→</span></button>
        </div>
      </form>

      <section class="sh-gallery-sec" id="templates">
        <div class="sh-gallery-title">
          <div><span class="sh-home-kicker">Template library</span><h2>Browse free templates</h2></div>
        </div>
        <div class="sh-ghead">
          <div class="sh-search-bar-row">
            <div class="sh-search-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" id="tplSearch" placeholder="Search ${TPL_COUNT} motion templates..." autocomplete="off">
              <button type="button" id="tplSearchClear" hidden>×</button>
            </div>
            <div class="sh-filters-scroll" id="filters"></div>
          </div>
        </div>
        <div class="sh-gallery" id="gallery" data-ar="9:16"></div>

        <!-- The grid used to just stop. Someone who scrolled every template
             without finding the one they wanted had nowhere to go from there,
             which is exactly the moment the AI composer is the answer. -->
        <div class="sh-gallery-end">
          <h3>Didn't find the animation you wanted?</h3>
          <p>Describe it instead and the studio will build a scene you can edit, or start from a blank timeline.</p>
          <div class="sh-gallery-end-actions">
            <a href="/editor" class="sh-ge-btn sh-ge-primary">Create animation</a>
            <a href="/community" class="sh-ge-btn">Watch creator tutorials</a>
          </div>
        </div>
      </section>

      <section class="sh-workflow-sec">
        <div class="sh-section-head">
          <span class="sh-eyebrow">How it works</span>
          <h2>From template to finished animation</h2>
          <p>Choose a starting point, make it yours, then export the format you need.</p>
        </div>
        <div class="sh-workflow-grid">
          <div class="sh-workflow-card">
            <span class="sh-workflow-num">01</span>
            <div class="sh-workflow-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
            </div>
            <h3>Describe or choose</h3>
            <p>Write what you need in English or Hinglish, or begin with an existing template from the library.</p>
          </div>
          <div class="sh-workflow-card">
            <span class="sh-workflow-num">02</span>
            <div class="sh-workflow-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
            </div>
            <h3>Customise in the Studio</h3>
            <p>Adjust the content, colours, type, timing and layout while the preview updates.</p>
          </div>
          <div class="sh-workflow-card">
            <span class="sh-workflow-num">03</span>
            <div class="sh-workflow-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>
            </div>
            <h3>Export or publish</h3>
            <p>Render an MP4 at the resolution included in your plan, or publish the editable template to the community.</p>
          </div>
        </div>
      </section>

      <section class="sh-banner-sec">
        <div class="sh-community-card">
          <div class="sh-comm-info">
            <span class="sh-eyebrow">Creator community</span>
            <h2>Publish an editable template</h2>
            <p>Share your customised version with its real creator identity, reactions and comments attached.</p>
            <div class="sh-comm-acts">
              <a href="/community" class="sh-bw">Watch creator tutorials <span aria-hidden="true">→</span></a>
              <a href="/editor" class="sh-bo">Open Studio</a>
            </div>
          </div>
          <div class="sh-comm-badge-box">
            <div class="sh-stat-pill">
              <b>${TPL_COUNT}</b>
              <span>Built-in templates</span>
            </div>
            <div class="sh-stat-pill">
              <b>1 credit</b>
              <span>Per export</span>
            </div>
            <div class="sh-stat-pill">
              <b>Up to 1440p</b>
              <span>Plan-based export</span>
            </div>
          </div>
        </div>
      </section>

      <section class="sh-finale">
        <span class="sh-eyebrow">✦ Get Started</span>
        <h2>Ready to Level Up Your YouTube Shorts?</h2>
        <p>No complex video software or steep learning curves required. Generate modern, animated short-form graphics right in your browser.</p>
        <div class="sh-frow">
          <a href="/editor" class="sh-bw">Create Animation Free <span aria-hidden="true">→</span></a>
          <a href="/pricing" class="sh-bo">View Pricing Plans · From ₹99/mo</a>
        </div>
      </section>
    </main>`,
  scripts: `<script src="/templates-v2.js?v=13" defer></script><script src="/shell.js?v=${V}" defer></script>`
};

const templatePage = {
  route: "/template",
  active: "templates",
  title: "Template Details — ShortsCraft",
  desc: "Preview, customize and discuss creator motion graphics templates for YouTube Shorts and Instagram Reels.",
  body: `    <main class="sh-home" style="display:flex;align-items:center;justify-content:center;min-height:calc(100vh - 60px);padding:24px 16px;">
      <div class="sh-modal-card" style="transform:none;opacity:1;position:relative;">
        <a href="/#templates" class="sh-modal-close" aria-label="Back to templates">×</a>
        <div class="sh-modal-left">
          <div class="sh-modal-stage" id="detailStage"></div>
          <a href="/editor" class="sh-modal-cta" id="detailStudioBtn">✦ Customize in Studio →</a>
          <div class="sh-modal-ctrls">
            <button type="button" class="sh-modal-act-btn" id="detailReplayBtn">▶ Replay</button>
            <button type="button" class="sh-modal-act-btn" id="detailLikeBtn">♥ <span class="td-like-count">0</span></button>
            <button type="button" class="sh-modal-act-btn" id="detailShareBtn">🔗 Share</button>
          </div>
        </div>

        <div class="sh-modal-right">
          <div>
            <span class="sh-m-cat" id="detailCat">✦ DOCUMENTARY</span>
            <h1 class="sh-m-title" id="detailTitle">Template Title</h1>
            <p class="sh-m-desc" id="detailDesc">Loading template details...</p>
            <div class="sh-m-specs">
              <span class="sh-m-spec">Duration: <b id="detailDur">4.6s</b></span>
              <span class="sh-m-spec">Framerate: <b>60 FPS</b></span>
              <span class="sh-m-spec">Format: <b>9:16 Shorts</b></span>
            </div>
          </div>

          <a href="/creator" class="sh-m-creator" id="detailCreatorCard">
            <div class="sh-m-c-av td-creator-avatar">SC</div>
            <div class="sh-m-c-info">
              <span class="sh-m-c-name td-creator-name">ShortsCraft Studio</span>
              <span class="sh-m-c-handle td-creator-handle">@shortscraft</span>
              <span class="sh-m-c-bio td-creator-bio">Official curated ShortsCraft animation library presets.</span>
            </div>
            <span style="color:var(--sh-ink2);font-size:16px;font-weight:700;">→</span>
          </a>

          <div class="sh-m-comments" id="comments">
            <h2 class="sh-m-comm-head">Community Comments <span id="commentsCount" style="color:var(--sh-ink2);font-size:13px;"></span></h2>
            <form class="sh-m-comm-form" id="commentForm">
              <textarea class="sh-m-comm-input" id="commentInput" placeholder="Write a comment or question about this template..." required></textarea>
              <button type="submit" class="sh-m-comm-btn">Post Comment</button>
            </form>
            <div class="sh-m-comm-list" id="commentsList">
              <div class="td-no-comments">Loading discussions...</div>
            </div>
          </div>
        </div>
      </div>
    </main>`,
  scripts: `<script src="/templates-v2.js?v=13"></script><script src="/template-detail.js?v=4" defer></script>`
};

const creatorPage = {
  route: "/creator",
  active: "community",
  title: "Creator Profile — ShortsCraft",
  desc: "Explore animation templates and creations published by this creator on ShortsCraft.",
  head: `<style>
.cp-wrap{padding:36px 32px 64px;max-width:1300px;margin:0 auto}
.cp-hero{display:flex;align-items:center;gap:24px;background:var(--sh-bg2);border:1px solid var(--sh-line);border-radius:24px;padding:32px;margin-bottom:36px}
@media(max-width:768px){.cp-hero{flex-direction:column;text-align:center}}
.cp-avatar{width:80px;height:80px;border-radius:50%;background:var(--sh-bg3);border:1px solid var(--sh-line2);display:grid;place-items:center;font-family:var(--sh-display);font-size:28px;font-weight:750;color:var(--sh-ink);flex:none}
.cp-info{flex:1;min-width:0}
.cp-info h1{font-family:var(--sh-display);font-size:26px;font-weight:750;margin:0 0 4px;color:var(--sh-ink)}
.cp-handle{font-size:14px;color:var(--sh-ink3);margin-bottom:8px;display:block}
.cp-bio{font-size:14px;line-height:1.5;color:var(--sh-ink2);margin:0 0 14px;max-width:640px}
.cp-stats{display:flex;gap:18px;flex-wrap:wrap}
.cp-stat{font-size:13px;color:var(--sh-ink3)}
.cp-stat b{color:var(--sh-ink);font-weight:700}
.cp-sec-title{font-family:var(--sh-display);font-size:22px;font-weight:750;margin:0 0 20px;color:var(--sh-ink)}
</style>`,
  body: `    <main class="sh-home">
      <div class="cp-wrap">
        <section class="cp-hero">
          <div class="cp-avatar" id="creatorAvatar">CR</div>
          <div class="cp-info">
            <div class="cp-title-row"><h1 id="creatorName">Creator Name</h1><span class="sh-verified" id="creatorVerified" title="Verified creator" aria-label="Verified creator" hidden><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.25l2.08 1.49 2.55-.05.74 2.44 2.1 1.45-.84 2.41.84 2.41-2.1 1.45-.74 2.44-2.55-.05L12 17.75l-2.08-1.49-2.55.05-.74-2.44-2.1-1.45.84-2.41-.84-2.41 2.1-1.45.74-2.44 2.55.05L12 2.25z"/><path d="M8.3 10.15l2.35 2.35 5.05-5.05" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>
            <span class="cp-handle" id="creatorHandle">@creator</span>
            <p class="cp-bio" id="creatorBio">Motion graphics creator on ShortsCraft.</p>
            <div class="cp-stats">
              <span class="cp-stat"><b id="creatorTplCount">0</b> Templates</span>
              <span class="cp-stat"><b id="creatorFollowers">0</b> Followers</span>
              <span class="cp-stat"><b id="creatorFollowing">0</b> Following</span>
              <span class="cp-stat"><b id="creatorStars">0</b> Stars</span>
            </div>
          </div>
          <!-- Starts hidden. Whether these belong on screen depends on who is
               looking, which is only known once the profile loads - so shipping
               them visible meant every creator saw "Follow" and "Send Stars" on
               their own page for a moment before they vanished. -->
          <div class="cp-actions" id="creatorActions" hidden>
            <button type="button" class="pg-bw" id="creatorFollowBtn">Follow</button>
            <button type="button" class="pg-bo" id="creatorStarBtn">Send Stars</button>
          </div>
        </section>

        <section>
          <h2 class="cp-sec-title">Published Templates</h2>
          <div class="sh-gallery" id="creatorGrid" style="padding:0;"></div>
        </section>
      </div>
    </main>`,
  scripts: `<script src="/templates-v2.js?v=13"></script><script src="/creator-profile.js?v=4" defer></script>`
};

/* ── MY UPLOADS ───────────────────────────────────────────── */
/* Was an anchor into /account that showed a permanent empty state: the script
   that fills it looks for #userCreationsGrid, which existed on no page, so a
   creator who had published templates still saw "nothing published yet". */
const uploads = {
  route: "/uploads",
  active: "projects",
  robots: "noindex, follow",
  title: "Creator Studio — ShortsCraft",
  desc: "Manage animation templates you have published, scheduled, or saved privately.",
  body: `    <main class="pg">
${pageHead("Creator Studio", "Your animation templates",
  "Manage published templates, scheduled releases and private drafts from one place.")}

      <section class="pg-sec" id="accountBox" hidden>
        <div class="admin-stat-grid creator-studio-stats">
          <article><span>Published</span><strong id="studioPublished">0</strong></article>
          <article><span>Scheduled</span><strong id="studioScheduled">0</strong></article>
          <article><span>Private drafts</span><strong id="studioPrivate">0</strong></article>
          <article><span>Total real exports</span><strong id="studioExports">0</strong></article>
        </div>

        <div class="pg-accsec-head">
          <h2 id="creationsHeading"><span id="creationsCount">0 templates</span></h2>
          <button type="button" class="pg-bo pg-accsec-btn js-open-upload">+ Publish a template</button>
        </div>

        <div class="pg-grid" id="userCreationsGrid">
          <article class="pg-card"><h3>Loading…</h3><p>Fetching your published templates.</p></article>
        </div>

        <div class="pg-row" style="margin-top:22px">
          <a href="/editor" class="pg-bw">Open the Studio</a>
          <a href="/community" class="pg-bo">Watch creator tutorials</a>
        </div>

        <div class="pg-grid creator-studio-tools">
          <article class="pg-card"><span class="pg-kicker">Profile</span><h3>Creator identity</h3><p>Manage your unique handle, avatar, bio and links.</p><a href="/account#edit-profile" class="pg-cardlink">Edit profile →</a></article>
          <article class="pg-card"><span class="pg-kicker">Support</span><h3>Creator help</h3><p>Report an upload, editor or export problem and track the ticket.</p><a href="/contact" class="pg-cardlink">Open support →</a></article>
          <article class="pg-card"><span class="pg-kicker">Coming soon</span><h3>Creator monetization</h3><p>Earnings and payouts are not active yet. No revenue is being counted or promised.</p><span class="pg-fine">The rollout will stay off until eligibility, fraud checks and payouts are ready.</span></article>
        </div>
      </section>

${guestGate("/uploads", "Log in to open Creator Studio", "Manage your published templates, scheduled releases and private drafts under your creator identity.", ["Published, scheduled and private work in one place", "Edit or remove your own templates", "See genuine engagement from other creators"])}
    </main>`,
  scripts: `<script src="/templates-v2.js?v=13" defer></script>`
};

/* ── DRAFTS & PROJECTS ────────────────────────────────────── */
/* The copy here used to claim the editor kept your timeline between visits.
   It did not — nothing was persisted anywhere. drafts-store.js implements that
   promise, and this page is the list it makes possible. */
const drafts = {
  route: "/drafts",
  active: "projects",
  robots: "noindex, follow",
  title: "My Projects — ShortsCraft",
  desc: "Your saved ShortsCraft animation projects, ready to reopen in the Studio.",
  body: `    <main class="pg">
${pageHead("Workspace", "My Projects",
  "Manage, preview and continue editing your saved animation projects and drafts.")}

      <section class="pg-sec">
        <div class="pg-accsec-head">
          <h2>All Saved Projects <span class="pg-count" id="draftCount">0</span></h2>
          <a href="/editor" class="pg-bw pg-accsec-btn">+ New Project</a>
        </div>

        <div class="cr-creations-grid" id="draftGrid">
          <article class="pg-card"><h3>Loading…</h3><p>Reading your saved projects.</p></article>
        </div>

        <p class="pg-fine" id="draftNote" style="margin-top:18px">
          Projects are saved to your account, so they follow you to any device you
          sign in on. They are also kept in this browser, which is what you see
          first and what keeps the editor working if you go offline.
        </p>
      </section>
    </main>`,
  scripts: `<script src="/templates-v2.js?v=13"></script><script src="/drafts-store.js?v=${V}" defer></script><script src="/drafts-page.js?v=${V}" defer></script>`
};

/* ── SETTINGS ─────────────────────────────────────────────── */
const settings = {
  route: "/settings",
  active: null,
  robots: "noindex, follow",
  title: "Settings — ShortsCraft",
  desc: "Your ShortsCraft profile, plan and account controls.",
  body: `    <main class="pg">
${pageHead("Settings", "Account settings",
  "Your creator identity, your plan, and the controls for this device.")}

      <section class="pg-sec" id="accountBox" hidden>

        <h2 class="pg-seclabel">Creator profile</h2>
        <div class="pg-prof" id="profile">
          <div class="pg-prof-av" id="crAvatarChar">KA</div>
          <div class="pg-prof-main">
            <h3 class="pg-prof-name" id="crDisplayName">Creator</h3>
            <p class="pg-prof-handle" id="crHandle">@creator</p>
            <p class="pg-prof-bio" id="crBio"></p>
            <div class="pg-prof-links">
              <a id="crYtLink" href="/settings" target="_blank" rel="noopener">YouTube</a>
              <a id="crIgLink" href="/settings" target="_blank" rel="noopener">Instagram</a>
              <span class="pg-prof-stars">★ <b id="crStarsCount">0</b></span>
            </div>
          </div>
          <button type="button" class="pg-bo pg-prof-edit" id="openEditProfileBtn">Edit profile</button>
        </div>
        <p class="pg-fine">This is what other creators see on every template you publish.</p>

        <h2 class="pg-seclabel">Account</h2>
        <div class="pg-grid">
          <article class="pg-card pg-card--wide"><h3>Email</h3><p id="accEmail">—</p></article>
          <article class="pg-card"><h3>Plan</h3><p id="accPlan">—</p><p class="pg-cardsub" id="accPlanTerm"></p></article>
          <article class="pg-card"><h3>Credits today</h3><p id="accCredits">—</p></article>
          <article class="pg-card"><h3>Member since</h3><p id="accSince">—</p></article>
        </div>

        <h2 class="pg-seclabel">Plan &amp; billing</h2>
        <div class="pg-grid">
          <article class="pg-card">
            <h3>Change your plan</h3>
            <p>Compare Free, Pro and Pro Max, and see exactly what a credit buys.</p>
            <a href="/pricing" class="pg-cardlink">View plans →</a>
          </article>
          <article class="pg-card">
            <h3>Credits</h3>
            <p>Credits reset every day at 00:00 UTC. Exporting costs ${C.export}, a custom AI scene costs ${C.animate}.</p>
            <a href="/pricing#credits" class="pg-cardlink">How credits work →</a>
          </article>
        </div>

        <h2 class="pg-seclabel">Your work</h2>
        <div class="pg-grid">
          <article class="pg-card">
            <h3>Published templates</h3>
            <p>Everything you have shared with the Community gallery.</p>
            <a href="/uploads" class="pg-cardlink">Open my published templates →</a>
          </article>
          <article class="pg-card">
            <h3>Drafts &amp; projects</h3>
            <p>Projects the Studio has saved in this browser.</p>
            <a href="/drafts" class="pg-cardlink">Open Drafts →</a>
          </article>
        </div>

        <h2 class="pg-seclabel">This device</h2>
        <div class="pg-grid">
          <article class="pg-card">
            <h3>Sign out</h3>
            <p>Log out of ShortsCraft here. Your templates and plan stay on your account.</p>
            <button type="button" class="pg-cardlink pg-linkbtn pg-danger" id="accLogout">Log out →</button>
          </article>
        </div>
      </section>

${guestGate("/settings", "Log in to manage your settings", "Your creator profile, your plan and your account controls all live behind a login.", ["Creator name, handle, bio and channel links", "Change or cancel your plan whenever you want", "Sign out of this device"])}
    </main>`
};

/* ── SOLO ADMIN CONSOLE ───────────────────────────────────── */
const adminPage = {
  route: "/admin",
  active: null,
  robots: "noindex, nofollow",
  title: "Admin Console — ShortsCraft",
  desc: "Private ShortsCraft operations console.",
  body: `    <main class="pg admin-page">
      <section class="admin-gate" id="adminGate">
        <span class="pg-kicker">Private workspace</span>
        <h1>Checking admin access…</h1>
        <p>This console is available only to the configured ShortsCraft owner account.</p>
      </section>

      <div id="adminApp" hidden>
        ${pageHead("Admin Console", "Run ShortsCraft from one place.", "Live product health, creators, published templates and support—without placeholder analytics.")}

        <nav class="admin-tabs" aria-label="Admin sections">
          <button type="button" data-admin-tab="overview" aria-pressed="true">Overview</button>
          <button type="button" data-admin-tab="content" aria-pressed="false">Templates</button>
          <button type="button" data-admin-tab="skills" aria-pressed="false">Tutorials</button>
          <button type="button" data-admin-tab="support" aria-pressed="false">Support</button>
          <button type="button" data-admin-tab="users" aria-pressed="false">Users</button>
          <button type="button" data-admin-tab="features" aria-pressed="false">Feature flags</button>
        </nav>

        <section class="admin-panel" data-admin-panel="overview">
          <div class="admin-stat-grid">
            <article><span>Total accounts</span><strong id="adUsers">—</strong></article>
            <article><span>New users · 30 days</span><strong id="adNewUsers">—</strong></article>
            <article><span>Published templates</span><strong id="adPublished">—</strong></article>
            <article><span>Scheduled templates</span><strong id="adScheduled">—</strong></article>
            <article><span>Exports · 30 days</span><strong id="adExports">—</strong></article>
            <article><span>AI generations · 30 days</span><strong id="adAi">—</strong></article>
            <article><span>Open support tickets</span><strong id="adTickets">—</strong></article>
            <article><span>Open reports</span><strong id="adReports">—</strong></article>
          </div>
          <p class="pg-fine">Every number is queried from the production database when this page opens.</p>
        </section>

        <section class="admin-panel" data-admin-panel="content" hidden>
          <div class="pg-accsec-head"><div><h2>Template moderation</h2><p class="pg-fine">Review creator publications and genuine engagement.</p></div><button class="pg-bo" type="button" data-admin-refresh="content">Refresh</button></div>
          <div class="admin-list" id="adminTemplateList"><p>Loading templates…</p></div>
        </section>

        <!-- Nothing reaches the tutorials page without passing through here.
             Anyone can paste a link to any video and call it their own, so the
             queue is the only thing standing between a submission and the
             public page. -->
        <section class="admin-panel" data-admin-panel="skills" hidden>
          <div class="pg-accsec-head">
            <div><h2>Creator tutorials</h2><p class="pg-fine">Watch the video before publishing it — a link can claim to be anything.</p></div>
            <div class="admin-row-controls">
              <select id="adminSkillStatus" aria-label="Which tutorials to show">
                <option value="pending" selected>Waiting for review</option>
                <option value="published">Published</option>
                <option value="rejected">Rejected</option>
              </select>
              <button class="pg-bo" type="button" data-admin-refresh="skills">Refresh</button>
            </div>
          </div>
          <div class="admin-list" id="adminSkillList"><p>Loading tutorials…</p></div>
        </section>

        <section class="admin-panel" data-admin-panel="support" hidden>
          <div class="pg-accsec-head"><div><h2>Support queue</h2><p class="pg-fine">Oldest high-priority tickets appear first.</p></div><button class="pg-bo" type="button" data-admin-refresh="support">Refresh</button></div>
          <div class="admin-support-layout"><div class="admin-list" id="adminTicketList"><p>Loading tickets…</p></div><div class="admin-ticket-view" id="adminTicketView"><p>Select a ticket to read and reply.</p></div></div>
        </section>

        <section class="admin-panel" data-admin-panel="users" hidden>
          <div class="pg-accsec-head"><div><h2>Accounts</h2><p class="pg-fine">Read-only account and plan overview.</p></div><button class="pg-bo" type="button" data-admin-refresh="users">Refresh</button></div>
          <div class="admin-list" id="adminUserList"><p>Loading accounts…</p></div>
        </section>

        <section class="admin-panel" data-admin-panel="features" hidden>
          <div class="pg-accsec-head"><div><h2>Feature flags</h2><p class="pg-fine">Only Super Admin can change rollout state.</p></div><button class="pg-bo" type="button" data-admin-refresh="features">Refresh</button></div>
          <div class="admin-list" id="adminFlagList"><p>Loading feature flags…</p></div>
        </section>

        <p class="pg-formnote" id="adminNote" role="status" aria-live="polite"></p>
      </div>
    </main>`,
  scripts: `<script src="/admin-console.js?v=${V}" defer></script>`
};

/* ── write ────────────────────────────────────────────────── */
const PAGES = [
  ["index.html", indexPage],
  ["template.html", templatePage],
  ["creator.html", creatorPage],
  ["pricing.html", pricing],
  ["about.html", about],
  ["contact.html", contact],
  ["community.html", community],
  ["tutorials.html", tutorials],
  ["privacy.html", privacy],
  ["terms.html", terms],
  ["404.html", notfound],
  ["login.html", authPage("login")],
  ["signup.html", authPage("signup")],
  ["account.html", account],
  ["uploads.html", uploads],
  ["drafts.html", drafts],
  ["settings.html", settings],
  ["admin.html", adminPage]
];

let n = 0;
for (const [file, p] of PAGES) {
  const html = chrome(p);
  fs.writeFileSync(path.join(OUT, file), html, "utf8");
  console.log(`wrote public/${file}  ${(html.length / 1024).toFixed(1)} KB`);
  n++;
}
console.log(`\n${n} pages built from one chrome.`);
