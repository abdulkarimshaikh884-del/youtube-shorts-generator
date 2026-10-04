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
const V = "2026100401";

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
    ids.delete("lottie"); // the upload renderer, not a library template
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
    key: "telegram", label: "Telegram", handle: "@techvault90",
    // The Tech Vault channel, as linked from the YouTube channel itself.
    href: "https://t.me/techvault90",
    icon: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.9 4.3 18.7 19c-.24 1.07-.88 1.33-1.78.83l-4.92-3.63-2.37 2.29c-.26.26-.48.48-.99.48l.35-5.02L18.1 6.7c.4-.35-.09-.55-.62-.2L6.2 13.32l-4.95-1.55c-1.08-.34-1.1-1.08.22-1.6L20.5 2.72c.9-.33 1.68.2 1.4 1.58Z"/></svg>'
  }
];

const NAV = [
  { href: "/", label: "Home", key: "home", group: "Workspace",
    icon: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>' },
  { href: "/animations", label: "Animations", key: "templates", group: "Workspace",
    icon: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5z"/>' },
  { href: "/designs", label: "Designs", key: "designs", group: "Workspace",
    icon: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>' },
  { href: "/community", label: "Creator Tutorials", key: "community", group: "Workspace",
    icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
  { href: "/drafts", label: "My Projects", key: "projects", group: "Workspace",
    icon: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>' },
  /* The pages people look for when something has gone wrong sit in the rail,
     which is on every screen, as well as in the footer. */
  { href: "/tutorials", label: "Help", key: "tutorials", group: "Support & Legal",
    icon: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>' },
  { href: "/contact", label: "Feedback", key: "contact", group: "Support & Legal",
    icon: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/>' },
  { href: "/settings", label: "Settings", key: "settings", group: "Account",
    icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' },
  { href: "/pricing", label: "Pricing", key: "pricing", group: "Account",
    icon: '<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>' },
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

  <a href="/" class="pg-wordmark" aria-label="ShortsCraft home">
    <span class="sh-brand-mark"><img src="/favicon.svg?v=20260725" width="22" height="22" alt=""></span>
    <span class="sh-brand-name">Shorts<i>Craft</i></span>
  </a>

${p.body}

  <nav class="pg-screenfoot" aria-label="Legal">
    <a href="/terms">Terms</a>
    <a href="/privacy">Privacy</a>
    <a href="/tutorials">Help</a>
  </nav>
</div>

<script src="/authui.js?v=${V}" defer></script>
<script src="/theme.js?v=${V}" defer></script>
<script src="/page.js?v=${V}" defer></script>
${p.scripts || ""}</body>
</html>
`;
}

/* The phone's tab bar. On a phone the rail is gone and the menu hides every
   destination behind a tap, which is how Settings and Help went missing for
   phone users. Five tabs cover the product; Profile leads to the rest. */
const BOTTOM_TABS = [
  { key: "home", href: "/", label: "Home",
    icon: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>' },
  { key: "templates", href: "/animations", label: "Templates",
    icon: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>' },
  { key: "create", href: "/editor", label: "Create",
    icon: '<path d="M12 5v14M5 12h14"/>' },
  { key: "community", href: "/community", label: "Learn",
    icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
  { key: "profile", href: "/account", label: "Profile",
    icon: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>' }
];
function bottomNav(p) {
  const current = p.route === "/" ? "home"
    : ["/animations", "/designs", "/template", "/creator"].includes(p.route) ? "templates"
    : p.active === "community" ? "community"
    : ["/account", "/settings", "/drafts", "/uploads", "/pricing", "/tutorials", "/contact", "/about", "/admin"].includes(p.route) ? "profile"
    : "";
  const tabs = BOTTOM_TABS.map((t) => `  <a href="${t.href}" class="sh-bn-tab sh-bn-${t.key}"${t.key === current ? ' aria-current="page"' : ""}>
    <span class="sh-bn-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${t.key === "create" ? "2.6" : "1.8"}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${t.icon}</svg></span>
    <span class="sh-bn-label">${t.label}</span>
  </a>`).join("\n");
  return `<nav class="sh-bottomnav" aria-label="Main">
${tabs}
</nav>`;
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
            <span>${n.label}</span>${n.badge ? `<span class="sh-nav-badge">${n.badge}</span>` : ""}
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
${p.head || ""}
<!-- Phone layer. After the page's own <style> so phone sizing wins there too. -->
<link rel="stylesheet" href="/mobile.css?v=${V}">
<!-- Design system: one set of colours, buttons and cards. Loads last. -->
<link rel="stylesheet" href="/ds.css?v=${V}">
<link rel="stylesheet" href="/monochrome.css?v=${V}">
</head>
`;

  // a bare page (log in / sign up) has no sidebar, top bar or footer
  if (p.bare) return head + `<body class="sh-body pg-bare">` + BARE(p, V);

  return head + `<body class="sh-body${p.bodyClass ? " " + p.bodyClass : ""}">

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



              <a href="/drafts" class="sh-upop-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                <div class="sh-upop-item-txt">
                  <b>My Projects</b>
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



              <a href="/pricing" class="sh-upop-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                <div class="sh-upop-item-txt">
                  <b>Pricing</b>
                  <span>Credits, up to 1440p rendering</span>
                </div>
              </a>

              <a href="/tutorials" class="sh-upop-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <div class="sh-upop-item-txt">
                  <b>Help</b>
                  <span>Guides, answers and support</span>
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
              <span class="sh-user-trigger-name" data-user-name>Account</span>
              <span class="sh-user-trigger-handle" data-user-handle>@creator</span>
            </div>
            <span class="sh-user-trigger-arrow">▲</span>
          </button>
        </div>
      </div>
    </div>
  </aside>

  <div class="sh-main" id="main" tabindex="-1">

    <header class="sh-topbar" aria-label="Primary navigation">
      <button id="navBurger" type="button" aria-label="Menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
      <a href="/" class="sh-topbrand" aria-label="ShortsCraft home">
        <span class="sh-brand-mark"><img src="/favicon.svg?v=20260725" width="22" height="22" alt=""></span>
        <span class="sh-brand-name">Shorts<i>Craft</i></span>
      </a>
      <nav class="sh-primary-nav" aria-label="Main">
        <a href="/animations"${p.active === "templates" ? ' aria-current="page"' : ""}>Animations</a>
        <a href="/designs"${p.active === "designs" ? ' aria-current="page"' : ""}>Designs</a>
        <a href="/community"${p.active === "community" ? ' aria-current="page"' : ""}>Creator Tutorials</a>
        <a href="/pricing"${p.active === "pricing" ? ' aria-current="page"' : ""}>Pricing</a>
      </nav>
      <div class="sh-top-actions">
      <a href="/pricing" class="sh-credit-chip" aria-label="View plan and credits">
        <span class="sh-credit-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v4c0 1.66 3.13 3 7 3s7-1.34 7-3V6"/><path d="M5 10v4c0 1.66 3.13 3 7 3s7-1.34 7-3v-4"/><path d="M5 14v4c0 1.66 3.13 3 7 3s7-1.34 7-3v-4"/></svg></span>
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
          <!-- Phone and desktop notifications for this device. Filled in by
               authui.js once it knows what this browser supports. -->
          <div class="sh-push-row" data-push-row hidden>
            <span id="pushPanelText">Get notifications on this device.</span>
            <button type="button" id="pushPanelBtn">Turn on</button>
          </div>
          <div id="notificationList"><p>Loading…</p></div>
          <!-- Only rendered when the list is actually longer than what is on
               screen, so the panel never offers to show more of nothing. -->
          <button type="button" class="sh-notification-more" id="notificationMore" hidden>Show more</button>
        </section>
      </div>
      <button type="button" class="sh-tupload-btn js-open-upload" id="topbarUploadBtn" title="Upload animation or design template">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <span>Upload</span>
      </button>
      <a href="/login" class="sh-tlink" data-auth="out">Log in</a>
      <a href="/signup" class="sh-tline" data-auth="out">Sign up</a>
      <button type="button" class="sh-tline" id="logoutBtn" data-auth="in" hidden>Log out</button>
      </div>
    </header>

    <div id="navMobile" hidden>
      <a href="/animations">Animations</a>
      <a href="/designs">Designs</a>
      <a href="/community">Creator Tutorials</a>
      <a href="/drafts">My Projects</a>

      <a href="/pricing">Pricing</a>
      <a href="/tutorials">Help</a>
      <a href="/about">About</a>
      <a href="/contact">Feedback</a>
      <a href="/settings">Settings</a>
      <button type="button" class="sh-m-upload-btn js-open-upload" data-auth="in" hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <span>Publish Template</span>
      </button>
      <a href="/login" data-auth="out">Log in</a>
      <a href="/signup" data-auth="out">Sign up</a>
      <a href="/account" data-auth="in" hidden>Profile</a>

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
        </div>

        <nav class="sh-fcol" aria-label="Product">
          <h2>Product</h2>
          <a href="/editor">Create Animation</a>
          <a href="/animations">Animations</a>
          <a href="/designs">Designs</a>
          <a href="/community">Creator Tutorials</a>
          <a href="/pricing">Pricing</a>
        </nav>

        <nav class="sh-fcol" aria-label="Legal and support">
          <h2>Legal &amp; Support</h2>
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
          <a href="/tutorials">Help</a>
          <a href="/contact">Feedback</a>
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

${bottomNav(p)}

<script src="/authui.js?v=${V}" defer></script>
<script src="/theme.js?v=${V}" defer></script>
<script src="/report.js?v=${V}" defer></script>
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

/* A page header is the page's name. It used to be three things — a small
   uppercase label, a display-size marketing sentence and a paragraph under
   it — on every page, which pushed each page's actual content below the fold
   and said the same thing three ways. The owner asked for the title alone. */
const pageHead = (title, extra) => `    <section class="pg-head">
      <h1>${title}</h1>
${extra || ""}    </section>`;

/* ── PRICING ──────────────────────────────────────────────── */
/* Credit costs and daily grants are defined once in credits.js — keep these
   numbers in step with PLANS/COST there. */
const CREDITS = require("./credits");
const P = CREDITS.PLANS, C = CREDITS.COST;

const pricing = {
  route: "/pricing",
  active: "pricing",
  title: "Pricing — ShortsCraft",
  desc: "Compare ShortsCraft Free, Pro and Pro Max plans. Editing and previewing are unlimited; credits are used only for AI generation and video export.",
  body: `    <main class="pg pg-pricing">
${pageHead("Pricing")}

      <!-- Credit calculator.

           The three plan cards state what each one gives; they do not answer
           the question someone actually arrives with, which is "which of
           these is enough for me". This turns a posting rate into a credit
           number and points at the plan that covers it, using the same
           per-day figures the cards and the ledger use. -->
      <section class="pg-calc" aria-labelledby="calcHead">
        <div class="pg-calc-ask">
          <h2 id="calcHead">How many Shorts do you post a day?</h2>
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
        <button type="button" data-cycle="yearly" aria-pressed="false">Yearly <span>Save ${Math.round((1 - P.pro.yearlyPrice / (P.pro.price * 12)) * 100)}%</span></button>
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
          <button type="button" class="pg-bw pg-buy" data-plan="pro" data-cycle="monthly" disabled aria-disabled="true">Coming Soon</button>
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
            <li class="pg-yearly-only" hidden>Verified creator badge while yearly plan is active</li>
          </ul>
          <button type="button" class="pg-bo pg-buy" data-plan="promax" data-cycle="monthly" disabled aria-disabled="true">Coming Soon</button>
        </article>
      </div>

      <p class="pg-note pg-center" id="buyNote" role="status" aria-live="polite"></p>
      <p class="pg-fine pg-center">Annual plans are billed once a year. Credits refresh daily and unused daily credits do not stack.</p>

            <!-- ── Creator Stars Packs ──────────────────────────── -->
      <section class="pg-sec" id="stars" style="scroll-margin-top: 80px;">
        <div style="text-align:center;max-width:680px;margin:0 auto 28px;">
          <span class="pg-calc-kicker" style="background:rgba(245,158,11,0.12);color:#d97706;border:1px solid rgba(245,158,11,0.25);">★ Creator Economy</span>
          <h2 style="margin:10px 0 8px;font-size:28px;">Creator Stars Packs</h2>
          <p style="color:var(--sc-muted,#64748b);font-size:15px;line-height:1.5;">Purchase Stars to tip motion designers, or unlock exclusive premium templates and graphic designs. Creators receive 70% in cash payouts via UPI.</p>
        </div>

        <div class="pg-plans pg-plans4" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:16px;">
          <article class="pg-plan" style="border:1px solid var(--sc-border);border-radius:18px;padding:24px 20px;display:flex;flex-direction:column;background:var(--sc-surface-1, #0f172a);">
            <span class="pg-tier" style="color:#d97706;font-weight:700;">★ Starter Pack</span>
            <div class="pg-amt" style="font-size:32px;font-weight:800;margin:12px 0 6px;">₹49</div>
            <p class="pg-planline" style="font-size:13.5px;color:var(--sc-text);"><b>10 Stars</b> to give or unlock</p>
            <ul style="margin:16px 0;padding-left:18px;font-size:13px;color:var(--sc-muted);flex:1;">
              <li>₹4.90 per star</li>
              <li>Unlock 1–5 premium designs</li>
              <li>Instant star balance delivery</li>
            </ul>
            <button type="button" class="pg-bw pg-buy-stars" data-star-pack="stars_10" style="width:100%;background:linear-gradient(135deg, #f59e0b, #d97706);color:#fff;border:none;font-weight:700;" disabled aria-disabled="true">Coming Soon</button>
          </article>

          <article class="pg-plan pg-hot" style="border:2px solid #f59e0b;border-radius:18px;padding:24px 20px;display:flex;flex-direction:column;background:var(--sc-surface-1, #0f172a);position:relative;">
            <span class="pg-tier" style="color:#d97706;font-weight:700;">★ Popular Pack</span>
            <span style="position:absolute;top:-12px;right:20px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;font-size:10.5px;font-weight:800;padding:3px 10px;border-radius:999px;letter-spacing:0.04em;">MOST POPULAR</span>
            <div class="pg-amt" style="font-size:32px;font-weight:800;margin:12px 0 6px;">₹199</div>
            <p class="pg-planline" style="font-size:13.5px;color:var(--sc-text);"><b>45 Stars</b> (Save 10%)</p>
            <ul style="margin:16px 0;padding-left:18px;font-size:13px;color:var(--sc-muted);flex:1;">
              <li>₹4.42 per star</li>
              <li>Unlock ~22 premium templates</li>
              <li>Send appreciation tips to creators</li>
            </ul>
            <button type="button" class="pg-bw pg-buy-stars" data-star-pack="stars_45" style="width:100%;background:linear-gradient(135deg, #f59e0b, #d97706);color:#fff;border:none;font-weight:700;" disabled aria-disabled="true">Coming Soon</button>
          </article>

          <article class="pg-plan" style="border:1px solid var(--sc-border);border-radius:18px;padding:24px 20px;display:flex;flex-direction:column;background:var(--sc-surface-1, #0f172a);">
            <span class="pg-tier" style="color:#d97706;font-weight:700;">★ Superfan Pack</span>
            <div class="pg-amt" style="font-size:32px;font-weight:800;margin:12px 0 6px;">₹499</div>
            <p class="pg-planline" style="font-size:13.5px;color:var(--sc-text);"><b>120 Stars</b> (Save 15%)</p>
            <ul style="margin:16px 0;padding-left:18px;font-size:13px;color:var(--sc-muted);flex:1;">
              <li>₹4.16 per star</li>
              <li>Unlock 60+ premium templates</li>
              <li>Tip favorite tutorial channels</li>
            </ul>
            <button type="button" class="pg-bw pg-buy-stars" data-star-pack="stars_120" style="width:100%;background:linear-gradient(135deg, #f59e0b, #d97706);color:#fff;border:none;font-weight:700;" disabled aria-disabled="true">Coming Soon</button>
          </article>

          <article class="pg-plan pg-max" style="border:1px solid rgba(139,92,246,0.4);border-radius:18px;padding:24px 20px;display:flex;flex-direction:column;background:var(--sc-surface-1, #0f172a);position:relative;">
            <span class="pg-tier" style="color:#a855f7;font-weight:700;">★ Mega Pack</span>
            <span style="position:absolute;top:-12px;right:20px;background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff;font-size:10.5px;font-weight:800;padding:3px 10px;border-radius:999px;letter-spacing:0.04em;">BEST VALUE</span>
            <div class="pg-amt" style="font-size:32px;font-weight:800;margin:12px 0 6px;">₹999</div>
            <p class="pg-planline" style="font-size:13.5px;color:var(--sc-text);"><b>260 Stars</b> (Save 22%)</p>
            <ul style="margin:16px 0;padding-left:18px;font-size:13px;color:var(--sc-muted);flex:1;">
              <li>₹3.84 per star</li>
              <li>Unlimited remix & library unlocks</li>
              <li>Exclusive supporter recognition</li>
            </ul>
            <button type="button" class="pg-bo pg-buy-stars" data-star-pack="stars_260" style="width:100%;background:linear-gradient(135deg, #8b5cf6, #6d28d9);color:#fff;border:none;font-weight:700;" disabled aria-disabled="true">Coming Soon</button>
          </article>
        </div>

        <p class="pg-note pg-center" id="starsBuyNote" role="status" aria-live="polite" style="margin-top:16px;"></p>
        <p class="pg-fine pg-center" style="margin-top:8px;">Stars purchases, donations, paid unlocks and payouts are Coming Soon. No payment will be taken in this Free release.</p>
      </section>

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
${pageHead("About ShortsCraft")}

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
        <p>ShortsCraft is an independent product built for Indian creators, from the same workshop as the <a href="${SOCIAL[0].href}" rel="noopener" target="_blank">Tech Vault</a> channel. Feature requests reach a human: use <a href="/contact">Feedback</a>.</p>
      </section>

      <section class="pg-cta">
        <h2>See it for yourself</h2>
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
  title: "Help — ShortsCraft",
  desc: "How to make an animated YouTube Short with ShortsCraft: pick a template, edit the text, export an MP4, and what the credits and plans mean.",
  body: `    <main class="pg">
${pageHead("Help")}

      <section class="pg-sec">
        <h2>Make your first animation</h2>
        <ol class="pg-steps">
          <li>
            <b>Pick a template.</b>
            <span>Browse <a href="/animations">${TPL_COUNT} templates</a> across ${8} categories. Open a preview, then choose Customise in Studio.</span>
          </li>
          <li>
            <b>Change the words.</b>
            <span>Open the Edit panel to change text and replace images where supported. Your preview updates as you work. Editing and previewing do not cost credits.</span>
          </li>
          <li>
            <b>Set the look.</b>
            <span>Adjust the background, font, timing and available layout controls. Choose 9:16 for Shorts and Reels, or 16:9 for a landscape video.</span>
          </li>
          <li>
            <b>Export the MP4.</b>
            <span>Choose Export, review the resolution and ${C.export}-credit cost, then download your MP4. Render time depends on the animation, quality and queue.</span>
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
            <h3>What your credits cover</h3>
            <p>AI generation and MP4 rendering use server resources. The editor shows the credit cost before you submit either action.</p>
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
            <p>A busy render queue, longer animation or higher resolution can take more time. Keep the export status open. If it reports a failure, note the message and contact support rather than repeatedly starting another export.</p>
          </details>
          <details>
            <summary>Where did my project go?</summary>
            <p>Sign in to the same account and open My Projects. Signed-in projects sync to your account; guest work is stored in that browser. Before leaving the editor, check its save status. Publishing a template makes a separate creator listing.</p>
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
        <div class="pg-row">
          <a href="/contact" class="pg-bw">Send feedback</a>
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
  title: "Creator Tutorials — ShortsCraft",
  desc: "Tutorials and walkthroughs made by ShortsCraft creators. Learn how a template was built, then open it in the Studio.",
  head: `<style>
.sk-head{padding:50px 28px 14px;display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:16px}
.sk-head h1{
  font-family:var(--sh-display);font-size:clamp(26px,2.6vw,32px);
  margin:0;font-weight:700;letter-spacing:-.02em;
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

/* ── Cards ──────────────────────────────────────────
   A video grid, laid out the way video grids are laid out everywhere people
   already know how to read one: the thumbnail is the object and everything
   below it is its caption. The bordered panel these used to sit in drew a
   second rectangle around a picture that already had edges. */
.sk-grid{
  padding:10px 28px 30px;
  display:grid;gap:24px 16px;
  grid-template-columns:repeat(auto-fill,minmax(300px,1fr));
}
/* Each tutorial is one framed card, the same frame the template tiles use,
   so a thumbnail and its caption read as one thing to pick. */
.sk-card{
  display:flex;flex-direction:column;gap:10px;min-width:0;
  padding:8px 8px 12px;border:1px solid var(--sc-border);border-radius:16px;
  background:var(--sc-surface);transition:border-color .15s ease,box-shadow .15s ease;
}
.sk-card:hover{border-color:var(--sc-border-strong);box-shadow:var(--sc-shadow-md)}
.sk-thumb{
  display:block;position:relative;aspect-ratio:16/9;
  border-radius:10px;overflow:hidden;background:var(--sh-bg3);
}
.sk-thumb img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .3s ease}
.sk-card:hover .sk-thumb img{transform:scale(1.04)}
/* Instagram publishes no open thumbnail endpoint, so those cards get a drawn
   panel rather than a broken image frame. */
.sk-thumb-fallback{
  position:absolute;inset:0;display:grid;place-items:center;
  color:var(--sh-ink3);font-size:12px;letter-spacing:.08em;text-transform:uppercase;
}
/* The play badge is the hover state, not the resting one — a thumbnail that is
   already a still from a video does not need to be told it is one. */
.sk-play{
  position:absolute;left:50%;top:50%;
  transform:translate(-50%,-50%) scale(.88);
  width:46px;height:46px;border-radius:50%;
  background:rgba(0,0,0,.66);display:grid;place-items:center;
  opacity:0;transition:opacity .18s ease,transform .18s ease;
}
.sk-card:hover .sk-play{opacity:1;transform:translate(-50%,-50%) scale(1)}
.sk-play svg{width:17px;height:17px;fill:#fff;margin-left:2px}
/* Sits where a duration badge sits and does the same job: one glance says
   where the video is about to open. */
.sk-plat{
  position:absolute;right:8px;bottom:8px;
  padding:2px 7px;border-radius:5px;
  background:rgba(0,0,0,.78);color:#fff;
  font-size:10.5px;font-weight:650;letter-spacing:.05em;text-transform:uppercase;
}
/* Three columns, and the last one is reserved whether or not the menu button
   is currently visible — a control that appears on hover must not push the
   title sideways when it does. */
.sk-body{display:grid;grid-template-columns:36px minmax(0,1fr) 30px;gap:12px;min-width:0;padding:2px 2px 0}
.sk-av{
  width:36px;height:36px;border-radius:50%;flex:none;overflow:hidden;
  background:var(--sh-bg3);display:grid;place-items:center;
  font-size:13px;font-weight:650;color:var(--sh-ink2);text-decoration:none;
}
.sk-av img{width:100%;height:100%;object-fit:cover;display:block}
.sk-text{min-width:0;display:grid;gap:2px;align-content:start}
.sk-title{
  margin:0 0 4px;font-size:16px;font-weight:650;line-height:1.35;color:var(--sh-ink);
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
}
.sk-title a{color:inherit;text-decoration:none}
/* The channel line: the name gives way before the tick does. */
.sk-author{display:flex;align-items:center;min-width:0;font-size:14px;line-height:1.4}
.sk-author > a,.sk-author > span{
  display:inline-flex;align-items:center;gap:5px;min-width:0;max-width:100%;
  color:var(--sh-ink3);text-decoration:none;
}
.sk-author > a:hover{color:var(--sh-ink)}
.sk-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sk-tick{width:14px;height:14px;flex:none;margin-left:0;vertical-align:0}
.sk-meta{font-size:13.5px;line-height:1.4;color:var(--sh-ink3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* One line: the title says what it is, the summary only hints. */
.sk-summary{
  margin:0;font-size:12.5px;color:var(--sh-ink3);line-height:1.45;
  display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.sk-title a:hover{text-decoration:underline}
/* Author and age on one line, the way a video caption carries its channel and
   its date together. We have no view count and will not invent one. */

.sk-dot{color:var(--sh-ink3);opacity:.6}
.sk-tpl{
  display:inline-flex;align-items:center;gap:5px;margin-top:4px;width:fit-content;
  padding:3px 9px;border:1px solid var(--sh-line);border-radius:999px;
  font-size:11.5px;color:var(--sh-ink2);text-decoration:none;
  transition:border-color .15s ease,color .15s ease;
}
.sk-tpl:hover{border-color:var(--sh-line2);color:var(--sh-ink)}
.sk-tpl svg{width:12px;height:12px;flex:none;fill:none;stroke:currentColor;stroke-width:2}

/* ── Card menu ───────────────────────────────────
   Always visible: an options button that only appears on hover is one people
   do not know exists. */
.sk-menu{position:relative;justify-self:end}
.sk-menu-btn{
  width:30px;height:30px;border:0;border-radius:50%;cursor:pointer;
  background:none;color:var(--sh-ink2);display:grid;place-items:center;padding:0;
  transition:background .15s ease,color .15s ease;
}
.sk-menu-btn:hover{background:var(--sh-bg3);color:var(--sh-ink)}
.sk-menu-btn svg{width:16px;height:16px;fill:currentColor}
.sk-menu-pop{
  position:absolute;right:0;top:34px;z-index:30;min-width:190px;padding:6px;
  border:1px solid var(--sh-line);border-radius:13px;background:var(--sh-bg1);
  box-shadow:0 14px 34px rgba(0,0,0,.17);display:grid;gap:2px;
}
.sk-menu-pop[hidden]{display:none}
.sk-mi{
  display:flex;align-items:center;gap:10px;width:100%;
  padding:8px 10px;border:0;border-radius:9px;background:none;
  color:var(--sh-ink);font:inherit;font-size:13px;text-align:left;
  cursor:pointer;text-decoration:none;
}
.sk-mi:hover{background:var(--sh-bg3)}
.sk-mi svg{width:15px;height:15px;flex:none;fill:none;stroke:currentColor;stroke-width:1.8}
.sk-mi-danger{color:#e5484d}
.sk-card.is-going{opacity:0;transform:scale(.97);transition:opacity .2s ease,transform .2s ease}
/* The card you just shared arrives in place. That landing is the receipt —
   it is why there is no longer a list telling you the state of your own
   submission in words. */
@keyframes sk-land{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.sk-card.is-new{animation:sk-land .34s ease both}
@media (prefers-reduced-motion:reduce){
  .sk-card.is-new{animation:none}
  .sk-thumb img,.sk-card:hover .sk-thumb img{transition:none;transform:none}
  .sk-card.is-going{transition:none}
}

/* ── Held back ────────────────────────────────────
   Empty in the normal case, because in the normal case your tutorial is
   simply on the page and you can see it there. This exists for the one thing
   a card cannot express: something of yours that was taken down, and why. */
.sk-holds{padding:4px 28px 0;max-width:760px}
.sk-holds[hidden]{display:none}
.sk-holds h2{
  font-size:13px;letter-spacing:.08em;text-transform:uppercase;
  color:var(--sh-ink3);margin:0 0 10px;font-weight:600;
}
.sk-hold-row{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:10px 13px;border:1px solid var(--sh-line);border-radius:11px;
  background:var(--sh-bg2);margin-bottom:8px;font-size:13px;
}
.sk-hold-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--sh-ink)}
.sk-pill{
  flex:none;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:600;
  border:1px solid var(--sh-line);color:var(--sh-ink3);
}
.sk-pill.pending{border-color:#c99a2e59;color:#b8860b}
.sk-pill.rejected{border-color:#e5484d59;color:#e5484d}
.sk-hold-note{font-size:12px;color:var(--sh-ink3);margin:-4px 0 10px;padding-left:13px}

/* ── Empty state ────────────────────────────────────────── */
.sk-empty{
  margin:6px 28px 28px;padding:44px 28px;text-align:center;
  border:1px dashed var(--sh-line2);border-radius:18px;
}
.sk-empty h3{margin:0 0 8px;font-size:19px;font-weight:700}
.sk-empty p{margin:0 auto 18px;max-width:440px;color:var(--sh-ink2);font-size:14px;line-height:1.6}

@media (max-width:640px){
  .sk-head{padding:32px 18px 12px}
  /* Two videos side by side on a phone, like a video app's grid. */
  .sk-grid{padding:8px 14px 22px;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 10px}
  .sk-card{padding:6px 6px 10px;gap:8px;border-radius:13px}
  .sk-thumb{border-radius:8px}
  /* A phone card is half the screen, so the avatar gives its width to the
     title and the channel name. */
  .sk-body{grid-template-columns:minmax(0,1fr) 26px;gap:6px;padding:0 2px}
  .sk-av{display:none}
  .sk-title{font-size:13px;line-height:1.3;margin-bottom:2px}
  .sk-author{font-size:12px}
  .sk-tick{width:12px;height:12px}
  .sk-meta{font-size:11.5px}
  .sk-tpl{max-width:100%;font-size:10.5px;padding:2px 7px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .sk-menu-btn{width:26px;height:26px}
  .sk-menu-pop{min-width:168px}
  .sk-plat{font-size:9.5px;padding:1px 5px;right:5px;bottom:5px}
  .sk-form{margin:0 18px 18px}
  .sk-holds,.sk-empty{margin-left:18px;margin-right:18px;padding-left:0;padding-right:0}
}
</style>`,
  body: `    <main class="sh-home">
      <section class="sk-head">
        <div>
          <h1>Creator Tutorials</h1>
        </div>
        <button type="button" class="sk-share-btn" id="skShareBtn">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          Share a tutorial
        </button>
      </section>

      <form class="sk-form" id="skForm" hidden>
        <h2>Share a tutorial</h2>

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
          <button type="submit" class="sk-submit" id="skSubmit">Share tutorial</button>
          <button type="button" class="sk-cancel" id="skCancel">Cancel</button>
        </div>
        <p class="sk-msg" id="skMsg" role="status"></p>
      </form>

      <section class="sk-holds" id="skHolds" hidden>
        <h2>Not on the page</h2>
        <div id="skHoldList"></div>
      </section>

      <div class="sk-grid" id="skGrid"></div>

      <div class="sk-empty" id="skEmpty" hidden>
        <h3>No tutorials yet</h3>
        <p>This is where creators explain how they made something. If you have published a walkthrough on YouTube or Instagram, it can be the first one here.</p>
        <div class="sh-gallery-end-actions">
          <a href="/animations" class="sh-ge-btn sh-ge-primary">Browse animations</a>
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
  var holds = document.getElementById("skHolds");
  var holdList = document.getElementById("skHoldList");
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

  // The same badge the template cards and profiles use, so a verified
  // creator looks the same wherever their name appears.
  var TICK = '<span class="sk-tick sh-verified" title="Verified creator" aria-label="Verified creator"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.25l2.08 1.49 2.55-.05.74 2.44 2.1 1.45-.84 2.41.84 2.41-2.1 1.45-.74 2.44-2.55-.05L12 17.75l-2.08-1.49-2.55.05-.74-2.44-2.1-1.45.84-2.41-.84-2.41 2.1-1.45.74-2.44 2.55.05L12 2.25z"/><path d="M8.3 10.15l2.35 2.35 5.05-5.05" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';

  var PLAY = '<span class="sk-play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span>';

  var ICON = {
    dots: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="12" cy="19" r="1.9"/></svg>',
    link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
    open: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
    studio: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18"/><path d="M3 8h18"/><path d="M3 16h18"/></svg>'
  };

  var PLATFORM_NAME = { youtube: "YouTube", instagram: "Instagram" };

  /* "2 days ago" rather than a date, because on a feed the question is how
     fresh this is, not which Tuesday it was. */
  function when(iso) {
    var t = Date.parse(iso);
    if (!t) return "";
    var secs = Math.max(0, (Date.now() - t) / 1000);
    // Short units, so the creator's name keeps the room on a card.
    var units = [[31536000, "yr"], [2592000, "mo"], [604800, "wk"],
                 [86400, "d"], [3600, "hr"], [60, "min"]];
    for (var i = 0; i < units.length; i++) {
      var n = Math.floor(secs / units[i][0]);
      if (n >= 1) return n + " " + units[i][1] + " ago";
    }
    return "just now";
  }

  /* One menu at a time. Left open, a second would sit under the first and the
     click that closed one would look like it did nothing. */
  var openMenu = null;
  function closeMenu() {
    if (!openMenu) return;
    openMenu.el.classList.remove("is-open");
    openMenu.pop.hidden = true;
    openMenu.btn.setAttribute("aria-expanded", "false");
    openMenu = null;
  }
  document.addEventListener("click", function (ev) {
    if (openMenu && !openMenu.el.contains(ev.target)) closeMenu();
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && openMenu) { var b = openMenu.btn; closeMenu(); b.focus(); }
  });

  function card(s) {
    var el = document.createElement("article");
    el.className = "sk-card";

    // rel="noopener" because every one of these links leaves for a site we do
    // not control, opened in a new tab.
    var thumb = s.thumbnail
      ? '<img src="' + esc(s.thumbnail) + '" alt="" loading="lazy" width="480" height="270">'
      : '<span class="sk-thumb-fallback">' + esc(s.platform) + "</span>";

    var name = s.author.name || "Creator";
    var platform = PLATFORM_NAME[s.platform] || s.platform;
    var authorHref = s.author.handle ? "/creator?handle=" + encodeURIComponent(s.author.handle) : "";
    var authorName = '<span class="sk-name">' + esc(name) + "</span>" + (s.author.verified ? TICK : "");
    var author = authorHref
      ? '<a href="' + esc(authorHref) + '">' + authorName + "</a>"
      : "<span>" + authorName + "</span>";

    // No avatar is the common case for a new account, and an empty grey disc
    // reads as a broken image. The initial is a real answer to "whose is this".
    var face = s.author.avatarUrl
      ? '<img src="' + esc(s.author.avatarUrl) + '" alt="" width="36" height="36">'
      : esc(name.trim().charAt(0).toUpperCase() || "C");
    var avatar = authorHref
      ? '<a class="sk-av" href="' + esc(authorHref) + '" aria-hidden="true" tabindex="-1">' + face + "</a>"
      : '<span class="sk-av" aria-hidden="true">' + face + "</span>";

    var age = when(s.createdAt);

    el.innerHTML =
      '<a class="sk-thumb" href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' +
        thumb + PLAY +
        '<span class="sk-plat">' + esc(platform) + "</span>" +
      "</a>" +
      '<div class="sk-body">' +
        avatar +
        '<div class="sk-text">' +
          // Laid out the way a video grid is read: the title, the channel
          // with its tick, then where it plays and how long ago it was shared.
          '<h3 class="sk-title"><a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer"' +
            (s.summary ? ' title="' + esc(s.summary) + '"' : "") + ">" + esc(s.title) + "</a></h3>" +
          '<span class="sk-author">' + author + "</span>" +
          '<span class="sk-meta">' + esc(platform) + (age ? " · " + esc(age) : "") + "</span>" +
          (s.templateId
            ? '<a class="sk-tpl" href="/editor?tpl=' + encodeURIComponent(s.templateId) + '">' +
              ICON.studio + "Open " + esc(s.templateId) + " in the Studio</a>"
            : "") +
        "</div>" +
        menu(s, platform) +
      "</div>";

    wireMenu(el, s);
    return el;
  }

  /* The menu carries only things that are true for this card: a link worth
     copying, the video's own home, and — for the person who shared it or the
     owner — taking it down. No greyed-out entries for actions you cannot do. */
  function menu(s, platform) {
    var items =
      '<button class="sk-mi" type="button" data-act="copy">' + ICON.link + "Copy link</button>" +
      '<a class="sk-mi" href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' +
        ICON.open + "Open on " + esc(platform) + "</a>" +
      (s.canDelete
        ? '<button class="sk-mi sk-mi-danger" type="button" data-act="remove">' +
          ICON.trash + "Remove</button>"
        : "");
    return '<div class="sk-menu">' +
      '<button class="sk-menu-btn" type="button" aria-haspopup="true" aria-expanded="false" ' +
        'aria-label="More actions for ' + esc(s.title) + '">' + ICON.dots + "</button>" +
      '<div class="sk-menu-pop" role="menu" hidden>' + items + "</div>" +
    "</div>";
  }

  function wireMenu(el, s) {
    var wrap = el.querySelector(".sk-menu");
    var btn = el.querySelector(".sk-menu-btn");
    var pop = el.querySelector(".sk-menu-pop");
    if (!wrap || !btn || !pop) return;

    btn.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      var wasOpen = openMenu && openMenu.el === wrap;
      closeMenu();
      if (wasOpen) return;
      wrap.classList.add("is-open");
      pop.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      openMenu = { el: wrap, pop: pop, btn: btn };
    });

    var copyBtn = pop.querySelector('[data-act="copy"]');
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        // The label is the confirmation. A toast somewhere else on the page
        // would be feedback for a click that happened here.
        var done = function (text) {
          copyBtn.lastChild.textContent = text;
          setTimeout(function () { copyBtn.lastChild.textContent = "Copy link"; closeMenu(); }, 900);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(s.url)
            .then(function () { done("Copied"); })
            .catch(function () { done("Could not copy"); });
        } else {
          done("Could not copy");
        }
      });
    }

    var removeBtn = pop.querySelector('[data-act="remove"]');
    if (removeBtn) {
      removeBtn.addEventListener("click", function () {
        if (!window.confirm("Remove “" + s.title + "” from the page? This cannot be undone.")) return;
        removeBtn.disabled = true;
        fetch("/api/skills/" + encodeURIComponent(s.id), { method: "DELETE" })
          .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (out) {
            if (!out.ok || !out.j.success) {
              removeBtn.disabled = false;
              removeBtn.lastChild.textContent = (out.j && out.j.error) || "Could not remove";
              return;
            }
            closeMenu();
            el.classList.add("is-going");
            setTimeout(function () {
              el.remove();
              // The empty state is a real state, not only a first-load one.
              if (!grid.querySelector(".sk-card")) { grid.hidden = true; empty.hidden = false; }
            }, 200);
            loadMine();
          })
          .catch(function () {
            removeBtn.disabled = false;
            removeBtn.lastChild.textContent = "Could not remove";
          });
      });
    }
  }

  function render(list) {
    // Whatever menu was open belonged to a card that is about to stop
    // existing; leaving the reference behind leaves it pointing at a
    // detached node.
    closeMenu();
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

  /* Only what is NOT on the page. Everything published is already visible as
     a card three lines further down, and repeating it as a row saying
     "published" was telling you something the page had just shown you. */
  function renderHolds(list) {
    if (!holds || !holdList) return;
    var held = list.filter(function (s) { return s.status !== "published"; });
    if (!held.length) { holds.hidden = true; return; }
    holds.hidden = false;
    holdList.innerHTML = "";
    held.forEach(function (s) {
      var row = document.createElement("div");
      row.className = "sk-hold-row";
      row.innerHTML =
        '<span class="sk-hold-title">' + esc(s.title) + "</span>" +
        '<span class="sk-pill ' + esc(s.status) + '">' +
          (s.status === "rejected" ? "removed" : "held") + "</span>";
      holdList.appendChild(row);
      // A removal without its reason is indistinguishable from a submission
      // that vanished, so the note is shown to the person who wrote it.
      if (s.reviewNote) {
        var note = document.createElement("p");
        note.className = "sk-hold-note";
        note.textContent = s.reviewNote;
        holdList.appendChild(note);
      }
    });
  }

  function loadMine() {
    return fetch("/api/skills/mine", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.skills) renderHolds(j.skills); })
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
          /* The response already carries the finished row, so the card is
             built from that rather than refetching the whole grid: the thing
             you just shared should be on the page before you have finished
             reading a sentence about it. */
          form.hidden = true;
          form.reset();
          say("");
          if (out.j.skill) {
            var made = card(out.j.skill);
            made.className += " is-new";
            grid.hidden = false;
            empty.hidden = true;
            grid.insertBefore(made, grid.firstChild);
            made.scrollIntoView({ behavior: "smooth", block: "center" });
          } else {
            load();
          }
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
  title: "Feedback — ShortsCraft",
  desc: "Report a bug, request a template or ask a question about ShortsCraft. Messages reach the person who builds it.",
  head: `<link rel="stylesheet" href="/contact.css?v=2026092401">`,
  body: `    <main class="pg sc-contact">
      <header class="sc-contact-head">
        <span class="sc-contact-kicker">SHORTSCRAFT SUPPORT</span>
        <h1>Feedback</h1>
        <p>Tell us what is working, what is not, or which animation template you would like to see. We read every request.</p>
      </header>

      <div class="sc-contact-layout">
        <form class="pg-form sc-contact-form" id="fbForm" novalidate>
          <div class="sc-contact-form-head">
            <h2>Send a message</h2>
            <p>Share a few details so we can understand and reply.</p>
          </div>
          <div class="sc-contact-fields">
            <div class="pg-f">
              <label for="fbName">Your name</label>
              <input id="fbName" name="name" type="text" maxlength="80" autocomplete="name" required>
            </div>
            <div class="pg-f">
              <label for="fbEmail">Email <span>— so we can reply</span></label>
              <input id="fbEmail" name="email" type="email" maxlength="120" autocomplete="email" required>
            </div>
          </div>
          <div class="pg-f">
            <label for="fbSubject">What is this about?</label>
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
            <label for="fbMessage">Your message</label>
            <textarea id="fbMessage" name="message" rows="5" maxlength="2000" required
              placeholder="What were you doing, what did you expect, and what happened instead?"></textarea>
          </div>
          <div class="sc-contact-actions">
            <button class="pg-bw" type="submit" id="fbSend">Send message <span aria-hidden="true">→</span></button>
            <span>We’ll reply to the email above.</span>
          </div>
          <p class="pg-formnote" id="fbNote" role="status" aria-live="polite"></p>
        </form>

        <aside class="sc-contact-aside" aria-label="Before you send">
          <div class="sc-contact-aside-head"><span aria-hidden="true">?</span><h2>Help us help you</h2></div>
          <div class="sc-contact-tip">
            <h3>Found a bug?</h3>
            <p>Add the page link, your device, and what you expected to happen. An error message or template name helps too.</p>
          </div>
          <div class="sc-contact-tip">
            <h3>Have a template idea?</h3>
            <p>Tell us what should move, what you would edit, and where you plan to use it.</p>
          </div>
          <p class="sc-contact-response">We aim to reply within two working days. Account, billing and blocked export issues are reviewed first.</p>
        </aside>
      </div>

      <section class="pg-sec" id="supportHistory" hidden>
        <div class="pg-accsec-head"><h2>Your support tickets</h2></div>
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
${pageHead("Privacy Policy")}

      <section class="pg-sec pg-prose pg-legal">
        <h2>The short version</h2>
        <p>You can use the editor without an account. We do not sell your data, we do not run advertising networks on this site, and the text you type is used to produce your result — not to train a model of our own.</p>

        <h2>What we collect</h2>
        <ul>
          <li><strong>What you type into a tool</strong> — the topic or script you submit is sent to our AI provider to generate your result. It is not stored in a database by us.</li>
          <li><strong>What you send us on purpose</strong> — the name, email, subject and message from the Feedback form, so we can reply.</li>
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
        <p>Block analytics cookies in your browser and the site still works. To have a feedback message or billing record deleted, write to us from the same email address using <a href="/contact">Feedback</a> and we will remove it, except where we must keep a payment record for tax purposes.</p>

        <h2>Changes</h2>
        <p>If this policy changes materially, the date at the top changes with it.</p>

        <h2>Contact</h2>
        <p>Questions about privacy go through <a href="/contact">Feedback</a>.</p>
        <p class="pg-fine">Last updated ${UPDATED}.</p>
      </section>
    </main>`
};

const terms = {
  route: "/terms",
  active: null,
  title: "Terms of Service — ShortsCraft",
  desc: "The rules for using ShortsCraft: who owns the output, what is not allowed, plans and refunds, and the limits of our liability.",
  body: `    <main class="pg">
${pageHead("Terms of Service")}

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
        <p>Pro starts at ₹${P.pro.price} per month and Pro Max at ₹${P.promax.price} per month, with optional annual billing through Razorpay. Cancel any time; access continues to the end of the paid period. If a payment is charged but the plan is not delivered, contact <a href="/contact">Feedback</a> with the payment reference.</p>

        <h2>Availability</h2>
        <p>This is an independently run product. We do not promise uptime, and features can change or be withdrawn. Exports depend on server capacity — a long render may be queued.</p>

        <h2>Liability</h2>
        <p>ShortsCraft is provided "as is", without warranties. To the extent the law allows, our total liability is limited to the amount you paid us in the previous three months. We are not liable for lost revenue, lost views, or platform decisions about your channel.</p>

        <h2>Changes</h2>
        <p>These terms can change; the date above will say when. Continuing to use the service means accepting the current version.</p>

        <h2>Contact</h2>
        <p>Anything unclear here — ask through <a href="/contact">Feedback</a>.</p>
        <p class="pg-fine">Last updated ${UPDATED}. By using ShortsCraft you accept these terms.</p>
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
        <div class="pg-row">
          <a href="/editor" class="pg-bw">Open the Editor</a>
          <a href="/" class="pg-bo">Back to templates</a>
        </div>
        <nav class="pg-404links" aria-label="Popular pages">
          <a href="/community">Creator Tutorials</a>
          <a href="/pricing">Pricing</a>
          <a href="/about">About</a>
          <a href="/contact">Feedback</a>
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
        <h1>${isUp ? "Create account" : "Log in"}</h1>
      </section>

      <form class="pg-form pg-auth" id="authForm" data-kind="${kind}" novalidate>
        <button type="button" class="pg-google" data-google-signin disabled><svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.61 24.46c0-1.36-.12-2.66-.35-3.92H24v7.42h11a9.4 9.4 0 0 1-4.08 6.18v5.13h6.61c3.86-3.56 6.08-8.8 6.08-14.81z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.82 13.47-4.93l-6.61-5.13c-1.83 1.22-4.16 1.96-6.86 1.96-5.31 0-9.82-3.59-11.44-8.43H5.74v5.29A20 20 0 0 0 24 44z"/><path fill="#FBBC05" d="M12.56 27.47a12 12 0 0 1 0-6.94v-5.29H5.74a20 20 0 0 0 0 17.52z"/><path fill="#EA4335" d="M24 12.1c3 0 5.67 1.03 7.8 3.05l5.85-5.85C34.1 6 29.5 4 24 4A20 20 0 0 0 5.74 15.24l6.82 5.29C14.18 15.69 18.69 12.1 24 12.1z"/></svg> Continue with Google</button>
        <p class="pg-google-note" data-google-status role="status">Checking Google sign-in availability…</p>
        <div class="pg-auth-divider"><span>or continue with email</span></div>
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
          <div class="pg-pw-wrap">
            <input id="authPassword" name="password" type="password"
                   autocomplete="${isUp ? "new-password" : "current-password"}"
                   minlength="8" maxlength="200" required>
            <button type="button" class="pg-pw-toggle" id="authPasswordToggle" data-password-toggle="#authPassword" aria-label="Show password" aria-pressed="false">
              <svg class="pg-pw-eye pg-pw-eye-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              <svg class="pg-pw-eye pg-pw-eye-closed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
            </button>
          </div>
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
                <!-- Stars sit with the actions, not in the count row: it is
                     the one figure here you act on (open it to see what you
                     have left to give), so it belongs beside Edit profile. -->
                <button type="button" class="ig-btn ig-btn-secondary ig-stars-btn" data-jump="stars" title="Stars received — open to see Stars you can give">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>
                  <strong id="crStarsCount">0</strong><span>Stars</span>
                </button>
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
            </ul>
          </div>
        </header>

        <!-- Phones only. The rail that lists these on a computer does not
             exist on a phone, so the Profile tab is where they live. -->
        <nav class="sh-profile-hub" aria-label="Your account">
          <a href="/drafts"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg><span>My Projects</span></a>

          <button type="button" class="js-open-upload"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><span>Upload Animation</span></button>
          <a href="/settings"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/></svg><span>Settings</span></a>
          <a href="/pricing"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg><span>Pricing</span></a>
          <a href="/tutorials"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg><span>Help</span></a>
          <a href="/contact"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/></svg><span>Feedback</span></a>
          <a href="/about"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg><span>About Us</span></a>


          <button type="button" id="accHubLogout" class="sh-hub-logout"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg><span>Log out</span></button>
        </nav>

        <!-- The story-highlights tray was six links to /editor,
             /#templates, /pricing, /community and /tutorials — every one
             of them already a row in the rail, two clicks from here and
             visible on every page. It duplicated the navigation it sat
             next to, and its labels were the least readable text on the
             page, so the profile now starts at its own content. -->

        <!-- Tabs.

             Followers, Following and Stars used to be tabs here as well as
             counts in the header, and the counts were already buttons that
             opened them. Two controls, side by side, doing one thing. The
             counts won: a number you can open is the more useful of the two,
             and it is the one that states a fact rather than just offering a
             destination. Those three panels are still here, still reachable,
             and they now say what they are and how to get back. -->
        <nav class="ig-tabs" role="tablist">
          <button type="button" class="ig-tab-btn is-active" id="igTabCreations" data-ig-tab="creations" role="tab" aria-controls="igPaneCreations" aria-selected="true">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            <span>Creations</span>
          </button>
          <button type="button" class="ig-tab-btn" id="igTabStars" data-ig-tab="stars" role="tab" aria-controls="igPaneStars" aria-selected="false">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>
            <span>Earnings &amp; Stars</span>
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
        <section class="ig-pane is-active" id="igPaneCreations" data-ig-pane="creations" role="tabpanel" aria-labelledby="igTabCreations">
          <div class="ig-grid" id="userCreationsGrid">
            <!-- Rendered by authui.js -->
          </div>
        </section>

        <!-- Followers and following.
             The profile has shown these counts since it was built, with
             nothing behind them: no way to see who, and no way to follow
             back. These are the real lists, and each row carries the
             follow control so the list is somewhere you can act. -->
        <section class="ig-pane" id="igPaneFollowers" data-ig-pane="followers" role="region" aria-labelledby="igHeadFollowers" hidden>
          <header class="ig-pane-head">
            <h2 id="igHeadFollowers">Followers</h2>
            <button type="button" class="ig-pane-back" data-ig-back="creations">Back to creations</button>
          </header>
          <div class="ig-people" id="followersList" data-kind="followers">
            <p class="ig-acc-sub">Loading…</p>
          </div>
        </section>

        <section class="ig-pane" id="igPaneFollowing" data-ig-pane="following" role="region" aria-labelledby="igHeadFollowing" hidden>
          <header class="ig-pane-head">
            <h2 id="igHeadFollowing">Following</h2>
            <button type="button" class="ig-pane-back" data-ig-back="creations">Back to creations</button>
          </header>
          <div class="ig-people" id="followingList" data-kind="following">
            <p class="ig-acc-sub">Loading…</p>
          </div>
        </section>

        <!-- Tab 2: Stars & Creator Wallet -->
        <section class="ig-pane" id="igPaneStars" data-ig-pane="stars" role="region" aria-labelledby="igHeadStars" hidden>
          <header class="ig-pane-head">
            <h2 id="igHeadStars">Creator Earnings &amp; Stars Wallet</h2>
            <button type="button" class="ig-pane-back" data-ig-back="creations">Back to creations</button>
          </header>

          <div class="ig-account-grid">
            <article class="ig-account-card ig-acc-highlight">
              <div class="ig-acc-head">
                <span class="ig-acc-lbl">Recorded estimate (not withdrawable)</span>
                <span class="ig-badge" id="walletMinBadge" style="font-size:11px;padding:2px 8px;border-radius:999px;background:rgba(217,119,6,0.15);color:#d97706;border:1px solid rgba(217,119,6,0.3);">Coming Soon</span>
              </div>
              <p class="ig-acc-val" id="walletAvailableInr" style="color:var(--sh-ink);font-weight:800;">₹0.00</p>
              <p class="ig-acc-sub" id="walletAvailableStars">Payouts — Coming Soon</p>
            </article>

            <article class="ig-account-card">
              <div class="ig-acc-head"><span class="ig-acc-lbl">All-Time Received</span></div>
              <p class="ig-acc-val" id="walletTotalEarnedInr">₹0.00</p>
              <p class="ig-acc-sub" id="walletTotalReceivedStars">From 0 Stars earned across templates and tips</p>
            </article>

            <article class="ig-account-card">
              <div class="ig-acc-head"><span class="ig-acc-lbl">Stars Balance to Give</span></div>
              <p class="ig-acc-val" id="starsBalance">0</p>
              <p class="ig-acc-sub" id="starsAllowance">Stars you can tip or spend on premium templates.</p>
              <a href="/pricing#stars" class="ig-btn ig-btn-secondary" id="accountBuyStarsBtn" style="margin-top:10px;font-size:12px;padding:6px 12px;width:100%;justify-content:center;text-decoration:none;display:flex;align-items:center;gap:6px;">★ Buy Star Packs</a>
            </article>
          </div>

          <!-- UPI Payout Request Form -->
          <div class="ig-card" style="margin-top:20px;padding:22px;border:1px solid var(--sh-line);border-radius:16px;background:var(--sh-bg2);">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
              <h3 style="font-size:17px;font-weight:700;margin:0;color:var(--sh-ink);">Request UPI Payout</h3>
              <span style="font-size:12px;color:var(--sh-ink3);">Coming Soon</span>
            </div>
            <p style="font-size:13px;color:var(--sh-ink2);margin:0 0 16px;line-height:1.5;">
              Payouts, Stars donations and paid unlocks are not available in this Free release. Existing records are preserved. Settlement terms will be published after verification; no payout date is promised.
            </p>

            <div hidden style="grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:14px;align-items:end;">
              <div>
                <label for="payoutUpiInput" style="display:block;font-size:12px;font-weight:600;color:var(--sh-ink2);margin-bottom:6px;">Your UPI ID</label>
                <input type="text" id="payoutUpiInput" placeholder="yourname@okhdfcbank or 9876543210@paytm" style="width:100%;padding:10px 12px;border:1px solid var(--sh-line);border-radius:10px;background:var(--sh-bg1);color:var(--sh-ink);font-size:13px;" />
              </div>
              <div>
                <label for="payoutStarsInput" style="display:block;font-size:12px;font-weight:600;color:var(--sh-ink2);margin-bottom:6px;">Stars to Withdraw (min 15)</label>
                <input type="number" id="payoutStarsInput" min="15" step="1" placeholder="15" style="width:100%;padding:10px 12px;border:1px solid var(--sh-line);border-radius:10px;background:var(--sh-bg1);color:var(--sh-ink);font-size:13px;" />
              </div>
              <div>
                <div id="payoutInrCalc" style="font-size:12px;color:var(--sh-ink3);margin-bottom:8px;font-weight:600;">Estimated INR: ₹0.00</div>
                <button type="button" class="ig-btn ig-btn-primary" id="requestPayoutBtn" style="width:100%;justify-content:center;" disabled>Request Payout</button>
              </div>
            </div>
            <div id="payoutStatusMsg" style="margin-top:12px;font-size:13px;padding:8px 12px;border-radius:8px;display:none;"></div>
          </div>

          <!-- Payout History -->
          <div style="margin-top:24px;">
            <h3 style="font-size:16px;font-weight:700;margin:0 0 12px;color:var(--sh-ink);">Payout History</h3>
            <div id="payoutHistoryList" style="border:1px solid var(--sh-line);border-radius:12px;overflow:hidden;background:var(--sh-bg2);">
              <p style="padding:16px;margin:0;font-size:13px;color:var(--sh-ink3);">No past withdrawal requests yet.</p>
            </div>
          </div>
        </section>

        <!-- Tab 3: plan and credits -->
        <section class="ig-pane" id="igPaneAccount" data-ig-pane="account" role="tabpanel" aria-labelledby="igTabAccount" hidden>
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
        <section class="ig-pane" id="igPaneSupport" data-ig-pane="support" role="tabpanel" aria-labelledby="igTabSupport" hidden>
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
        <section class="ig-pane" id="igPaneEdit" data-ig-pane="edit" role="tabpanel" aria-labelledby="igTabEdit" hidden>
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
    </main>`,
  // The creation cards preview each template live. Without the engine on this
  // page they silently built nothing, and every card was an empty black box.
  scripts: `<script src="/templates-v2.js?v=${V}"></script>`
};

const indexPage = {
  route: "/",
  active: "home",
  bodyClass: "page-home",
  noPageJs: true,
  title: "ShortsCraft — Create and customize motion templates",
  desc: "Create short-form animations from a prompt or customize motion templates in a focused browser editor. Preview freely and export a real MP4 when it is ready.",
  // Only the two words the hero's handwriting uses, so the font is a few KB.
  head: `<link rel="stylesheet" href="/designs.css?v=${V}">
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600&text=AnimateAnything&display=swap" rel="stylesheet">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebApplication","name":"ShortsCraft","url":"https://shortscraft.online/","description":"AI motion graphics video generator for YouTube Shorts"}</script>`,
  body: `    <main class="sh-home">
      <!-- The owner's mobile design: a headline with the product's promise
           beside a drawn illustration. The drawing is inline SVG and CSS, so
           the first screen costs no image request. -->
      <section class="sh-hero sh-hero-v2">
        <div class="sh-hero-copy">
          <h1>Turn your ideas into <em>scroll-stopping videos</em></h1>
        </div>
        <div class="sh-hero-art" aria-hidden="true">
          <span class="sh-ha-note">Animate<br>Anything</span>
          <svg class="sh-ha-arrow" viewBox="0 0 40 46" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M14 3C4 12 3 27 20 40"/><path d="M11 38l9 3 1-9"/></svg>
          <span class="sh-ha-card">
            <span class="sh-ha-play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg></span>
            <i></i><i></i>
          </span>
          <span class="sh-ha-chip sh-ha-img"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/></svg></span>
          <span class="sh-ha-chip sh-ha-text">T</span>
          <span class="sh-ha-chip sh-ha-spark"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 3l1.8 5.2L17 10l-5.2 1.8L10 17l-1.8-5.2L3 10l5.2-1.8z"/><path d="M18 14l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9z"/></svg></span>
          <span class="sh-ha-rays"><i></i><i></i><i></i></span>
        </div>
      </section>

      <form class="sh-composer" id="composer" action="/editor" method="GET">
        <div class="sh-ctop">
          <label class="sh-prompt-label" for="composerPrompt">What would you like to animate?</label>
          <textarea id="composerPrompt" name="topic" rows="3" maxlength="500" placeholder="Try a pricing card that flips to reveal ₹199, with a blue accent…"></textarea>
          <span class="sh-ccount" id="composerCount">0/500</span>
        </div>
        <div class="sh-cbar">
          <input type="file" id="composerImg" accept="image/png,image/jpeg,image/webp,image/gif" class="ed-sr">
          <label class="sh-imgbtn" for="composerImg" title="Attach image to animate">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/></svg>
            <span class="sh-imgbtn-label">Add image</span>
          </label>
          <button class="sh-imgchip" type="button" id="composerImgClear" hidden>
            <span id="composerImgName">image</span> <b>×</b>
          </button>
          <div class="sh-custom-select" id="qualityDropdown">
            <input type="hidden" name="quality" id="qualitySelect" value="mini">
            <button type="button" class="sh-csel-btn" id="qualityBtn" aria-haspopup="listbox" aria-expanded="false" aria-label="Generation model: Standard">
              <span class="sh-csel-val" id="qualityVal">Standard</span>
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
          <button class="sh-cgo" id="composerGo" type="submit"><svg class="sh-cgo-spark" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M10 3l1.8 5.2L17 10l-5.2 1.8L10 17l-1.8-5.2L3 10l5.2-1.8z"/><path d="M18 14l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9z"/></svg>Create animation <span aria-hidden="true">→</span></button>
        </div>
      </form>


      <!-- Ten animations fill two desktop rows. Search, every category and the
           rest of the library are one tap away on /animations. -->
      <section class="sh-gallery-sec sh-popular" id="templates">
        <div class="sh-gallery-title">
          <div><h2>Popular animations</h2></div>
          <a href="/animations" class="sh-seeall">See all <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
        </div>
        <div class="sh-filters-scroll" id="filters" data-links></div>
        <div class="sh-gallery" id="gallery" data-ar="9:16" data-limit="10"></div>
        <div class="sh-sec-more">
          <a href="/animations" class="sh-ge-btn sh-ge-primary">Browse All Animations</a>
        </div>
      </section>

      <!-- Popular Thumbnails & Designs (3 lines / 12 items) -->
      <section class="sh-home-sec" id="homeDesigns">
        <div class="sh-gallery-title">
          <div><h2>Popular Thumbnails &amp; Designs</h2></div>
          <a href="/designs" class="sh-seeall">See all <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
        </div>
        <div class="ds-home-grid" id="homeDesignsGrid" aria-live="polite"></div>
        <div class="sh-sec-more">
          <a href="/designs" class="sh-ge-btn sh-ge-primary">Browse All Designs</a>
        </div>
      </section>

      <!-- Creator Tutorials (3 lines / 12 items) -->
      <section class="sh-home-sec" id="homeTutorials">
        <div class="sh-gallery-title">
          <div><h2>Creator Tutorials</h2></div>
          <a href="/community" class="sh-seeall">See all <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
        </div>
        <div class="sh-tut-row" id="homeTutList" aria-live="polite"></div>
        <div class="sh-sec-more">
          <a href="/community" class="sh-ge-btn sh-ge-primary">Browse All Tutorials</a>
        </div>
      </section>

      <!-- 1. Creator Economy: Monetization & Benefits -->
      <section class="sh-home-sec sh-ce-sec" id="creatorEconomy">
        <div class="sh-sec-header-center">
          <span class="sh-ce-badge-pill">★ Creator Economy</span>
          <h2 class="sh-ce-heading">Create Content, Build Audience &amp; Earn Income</h2>
          <p class="sh-ce-subhead">Turn your video skills, motion templates, and thumbnails into a recurring revenue stream with fair creator payouts.</p>
        </div>
        <div class="sh-ce-grid">
          <div class="sh-ce-card">
            <div class="sh-ce-icon-wrap sh-ce-icon-gold">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </div>
            <div class="sh-ce-tag">70% Revenue Share</div>
            <h3>Earn From Stars</h3>
            <p>Set a Star price on your motion and design templates. Every time a user unlocks your asset, 70% goes straight to your wallet.</p>
          </div>
          <div class="sh-ce-card">
            <div class="sh-ce-icon-wrap sh-ce-icon-blue">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.25l2.08 1.49 2.55-.05.74 2.44 2.1 1.45-.84 2.41.84 2.41-2.1 1.45-.74 2.44-2.55-.05L12 17.75l-2.08-1.49-2.55.05-.74-2.44-2.1-1.45.84-2.41-.84-2.41 2.1-1.45.74-2.44 2.55.05L12 2.25z"/><path d="M8.3 10.15l2.35 2.35 5.05-5.05" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <div class="sh-ce-tag">Official Status</div>
            <h3>Verified Badge</h3>
            <p>Earn an official blue verified tick on your profile, templates, and tutorials to build trust, authority, and massive reach.</p>
          </div>
          <div class="sh-ce-card">
            <div class="sh-ce-icon-wrap sh-ce-icon-green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            </div>
            <div class="sh-ce-tag">Min ₹50 Threshold</div>
            <h3>Direct UPI Payouts</h3>
            <p>No waiting for months. Request payouts anytime your balance reaches ₹50, sent directly to your UPI ID or bank account.</p>
          </div>
          <div class="sh-ce-card">
            <div class="sh-ce-icon-wrap sh-ce-icon-purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div class="sh-ce-tag">Grow Your Reach</div>
            <h3>Direct Channel Traffic</h3>
            <p>Link your YouTube tutorials and channel. Viewers watch on your original channel, boosting your subscribers and watch hours.</p>
          </div>
        </div>
        <div class="sh-sec-more">
          <a href="/community" class="sh-ge-btn sh-ge-primary">Start Earning as a Creator <span aria-hidden="true">→</span></a>
        </div>
      </section>

      <!-- 2. How It Works: 3 Steps -->
      <section class="sh-workflow-sec" id="howItWorks">
        <div class="sh-sec-header-center">
          <span class="sh-ce-badge-pill">⚡ Simple Workflow</span>
          <h2 class="sh-ce-heading">How ShortsCraft Works</h2>
          <p class="sh-ce-subhead">From idea to high-retention video in 3 frictionless steps.</p>
        </div>
        <div class="sh-workflow-grid">
          <div class="sh-workflow-card">
            <div class="sh-wf-top">
              <span class="sh-workflow-num">01</span>
              <div class="sh-workflow-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              </div>
            </div>
            <h3>Pick or Prompt</h3>
            <p>Choose from dozens of trending documentary, papercraft, and finance templates—or simply describe what you want to animate with AI.</p>
          </div>
          <div class="sh-workflow-card">
            <div class="sh-wf-top">
              <span class="sh-workflow-num">02</span>
              <div class="sh-workflow-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
              </div>
            </div>
            <h3>Customize in Studio</h3>
            <p>Adjust text, colors and timing in the browser studio, then preview your animation before export.</p>
          </div>
          <div class="sh-workflow-card">
            <div class="sh-wf-top">
              <span class="sh-workflow-num">03</span>
              <div class="sh-workflow-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </div>
            </div>
            <h3>Export or Monetize</h3>
            <p>Export a clean MP4 up to 1080p/1440p ready for YouTube Shorts and Reels, or publish your remix to earn Stars from other creators.</p>
          </div>
        </div>
      </section>

      <!-- 3. Simple, Transparent Pricing -->
      <section class="sh-home-sec sh-pricing-prev" id="homePricing">
        <div class="sh-sec-header-center">
          <span class="sh-ce-badge-pill">💎 Flexible Plans</span>
          <h2 class="sh-ce-heading">Simple, Transparent Pricing</h2>
          <p class="sh-ce-subhead">Start creating for free, or upgrade for higher resolution, unlimited speed, and no watermarks.</p>
        </div>
        <div class="sh-pp-grid">
          <div class="sh-pp-card">
            <span class="sh-pp-name">Free</span>
            <span class="sh-pp-price">₹${P.free.price}<small>/forever</small></span>
            <p class="sh-pp-desc">Great for getting started and trying out AI animations.</p>
            <ul class="sh-pp-list">
              <li><strong>${P.free.perDay} credits</strong> every single day</li>
              <li>Export up to <strong>${P.free.maxHeight}p</strong> resolution</li>
              <li>Standard generation queue</li>
              <li>Full access to free motion templates</li>
              <li class="sh-pp-muted">ShortsCraft subtle watermark</li>
            </ul>
            <a href="/editor" class="sh-plan-cta sh-plan-cta-ghost">Start Creating Free</a>
          </div>

          <div class="sh-pp-card sh-pp-featured">
            <span class="sh-pp-pop-badge">★ Most Popular</span>
            <span class="sh-pp-name">Pro</span>
            <span class="sh-pp-price">₹${P.pro.price}<small>/month</small></span>
            <p class="sh-pp-desc">For active creators posting high-quality viral Shorts daily.</p>
            <ul class="sh-pp-list">
              <li><strong>${P.pro.perDay} credits</strong> every single day</li>
              <li><strong>${P.pro.maxHeight}p Full HD</strong> crystal-clear export</li>
              <li><strong>No watermark</strong> on any video</li>
              <li>Priority AI generation speed</li>
              <li>Commercial usage rights</li>
            </ul>
            <a href="/pricing" class="sh-plan-cta sh-plan-cta-primary">Upgrade to Pro <span aria-hidden="true">→</span></a>
          </div>

          <div class="sh-pp-card">
            <span class="sh-pp-name">Pro Max</span>
            <span class="sh-pp-price">₹${P.promax.price}<small>/month</small></span>
            <p class="sh-pp-desc">For power creators and agencies who need maximum output.</p>
            <ul class="sh-pp-list">
              <li><strong>${P.promax.perDay} credits</strong> every single day</li>
              <li><strong>${P.promax.maxHeight}p 2K Ultra HD</strong> maximum quality</li>
              <li><strong>No watermark</strong> on any video</li>
              <li>Fastest VIP rendering queue</li>
              <li>Early access to new motion styles</li>
            </ul>
            <a href="/pricing" class="sh-plan-cta sh-plan-cta-ghost">Go Pro Max</a>
          </div>
        </div>

        <!-- Creator Stars Callout Strip -->
        <div class="sh-stars-strip">
          <div class="sh-ss-left">
            <span class="sh-ss-icon">★</span>
            <div class="sh-ss-text">
              <h4>Want to unlock Creator Templates &amp; Thumbnails?</h4>
              <p>Buy Star Packs starting at just <strong>₹49</strong>. 100% on-demand, no subscription needed.</p>
            </div>
          </div>
          <a href="/pricing#stars" class="sh-ss-btn">Explore Star Packs <span aria-hidden="true">→</span></a>
        </div>
      </section>

      <!-- 4. Final CTA Hero Banner -->
      <section class="sh-finale">
        <div class="sh-finale-card">
          <div class="sh-finale-glow" aria-hidden="true"></div>
          <h2>Ready to Level Up Your YouTube Shorts?</h2>
          <p>Choose a template, make it your own and export your next animation or design.</p>
          <div class="sh-frow">
            <a href="/editor" class="sh-bw">Create Animation Free <span aria-hidden="true">→</span></a>
            <a href="/animations" class="sh-bo">Browse All Templates</a>
          </div>
          <div class="sh-finale-trust">
            <span>✓ No credit card required</span>
            <span>✓ 5 free daily credits</span>
            <span>✓ Edit in your browser</span>
          </div>
        </div>
      </section>
    </main>`,
  scripts: `<script src="/image-input.js?v=${V}" defer></script><script src="/design-preview.js?v=${V}" defer></script><script src="/templates-v2.js?v=${V}" defer></script><script src="/shell.js?v=${V}" defer></script>`
};

/* ── ANIMATIONS ─────────────────────────────────────────────
   The whole animation library on its own page. The home page shows the same
   gallery; this is where the nav, the phone tab and "See all" lead. */
const animationsPage = {
  route: "/animations",
  active: "templates",
  noPageJs: true,
  title: "Animations — ShortsCraft",
  desc: `Browse ${TPL_COUNT} editable animation templates for YouTube Shorts and Reels. Preview free, customise in the Studio and export an MP4.`,
  body: `    <main class="sh-home sh-library">
${pageHead("Animations")}
      <section class="sh-gallery-sec" id="templates">
        <div class="sh-ghead">
          <div class="sh-search-bar-row">
            <div class="sh-search-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" id="tplSearch" placeholder="Search ${TPL_COUNT} motion templates..." autocomplete="off">
              <button type="button" id="tplSearchClear" hidden>×</button>
            </div>
            <div class="sh-lib-controls">
              <label class="sh-lib-select"><span>Sort</span>
                <select id="tplSort" aria-label="Sort animations">
                  <option value="trending" selected>Trending</option>
                  <option value="popular">Popular</option>
                  <option value="newest">Newest</option>
                </select>
              </label>
              <label class="sh-lib-select"><span>Source</span>
                <select id="tplSource" aria-label="Show animations from">
                  <option value="all" selected>All creators</option>
                  <option value="official">Official</option>
                  <option value="community">Community</option>
                </select>
              </label>
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
    </main>`,
  scripts: `<script src="/templates-v2.js?v=${V}" defer></script><script src="/shell.js?v=${V}" defer></script>`
};

/* ── DESIGNS ────────────────────────────────────────────────
   Interactive Designs Hub: editable YouTube thumbnails, logos, posters,
   and AI Convert to Editable engine. */
const designsPage = {
  route: "/designs",
  active: "designs",
  title: "Editable Designs & Thumbnails — ShortsCraft",
  desc: "Browse design templates or turn an image into an editable draft. Review detected text and image layers before editing.",
  head: `<link rel="stylesheet" href="/designs.css?v=${V}">`,
  body: `    <main class="sh-home sh-library">
      <div class="ds-page-container">
        <header class="ds-header">
          <h1>Designs</h1>
        </header>
        <div class="ds-library-heading"><label class="ds-search-label"><span class="sr-only">Search designs</span><input type="search" id="designSearch" placeholder="Search designs…" aria-label="Search designs"></label></div>

        <!-- Category Filter Bar -->
        <nav class="ds-filter-bar" id="designsFilterBar" aria-label="Design categories">
          <button type="button" class="ds-filter-btn active" data-cat="all" aria-pressed="true">All Designs</button>
          <button type="button" class="ds-filter-btn ds-filter-btn-premium" data-cat="premium" aria-pressed="false">★ Premium</button>
          <button type="button" class="ds-filter-btn" data-cat="youtube-thumbnail" aria-pressed="false">YouTube Thumbnails</button>
          <button type="button" class="ds-filter-btn" data-cat="logo" aria-pressed="false">Logos &amp; Badges</button>
          <button type="button" class="ds-filter-btn" data-cat="poster" aria-pressed="false">Posters &amp; Flyers</button>
          <button type="button" class="ds-filter-btn" data-cat="social-post" aria-pressed="false">Social Posts</button>
        </nav>

        <!-- Templates Grid -->
        <div class="ds-grid" id="designsGrid">
          <div class="ds-loading">
            <div class="ds-spinner"></div>
            <p>Loading design templates...</p>
          </div>
        </div>
      </div>
    </main>

    <!-- Upload & AI Convert to Editable Modal -->
    <div class="ds-modal-backdrop" id="designUploadModal" hidden>
      <div class="ds-modal-card" role="dialog" aria-modal="true" aria-labelledby="designModalTitle">

        <!-- Step 1: File Dropzone -->
        <div class="ds-modal-step" id="modalStep1">
          <div class="ds-modal-header">
            <h3 class="ds-modal-title" id="designModalTitle">
              <span>✨ Convert Image to Editable Template</span>
            </h3>
            <button type="button" class="ds-modal-close" id="closeDesignModal" aria-label="Close dialog">&times;</button>
          </div>
          <div class="ds-modal-body">
            <div class="ds-dropzone" id="designDropzone" role="button" tabindex="0" aria-label="Choose an image">
              <input type="file" id="designFileInput" accept="image/png,image/jpeg,image/webp" hidden>
              <div class="ds-dropzone-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              </div>
              <h4 class="ds-dropzone-title">Click to upload or drag and drop image here</h4>
              <p class="ds-dropzone-subtitle">Supports YouTube thumbnails, posters, logos, and social graphics</p>
              <div class="ds-dropzone-tags">
                <span class="ds-tag">PNG</span>
                <span class="ds-tag">JPG / JPEG</span>
                <span class="ds-tag">WebP</span>
                <span class="ds-tag">Up to 15 MB</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 2: Choose Mode -->
        <div class="ds-modal-step" id="modalStep2" hidden>
          <div class="ds-modal-header">
            <h3 class="ds-modal-title">Choose How to Open Design</h3>
            <button type="button" class="ds-modal-close" onclick="document.getElementById('designUploadModal').setAttribute('hidden','')" aria-label="Close dialog">&times;</button>
          </div>
          <div class="ds-modal-body">
            <div class="ds-picked-preview-row">
              <img id="pickedImagePreview" class="ds-picked-thumb" src="" alt="Picked image">
              <div class="ds-picked-info">
                <strong id="pickedFileName">image.png</strong>
                <span id="pickedFileSize">0 KB</span>
              </div>
            </div>

            <div class="ds-mode-grid">
              <div class="ds-mode-card featured" id="cardConvertEditable">
                <span class="ds-mode-badge">AI Powered</span>
                <div class="ds-mode-icon">✨</div>
                <h3>Convert to Editable</h3>
                <p>Detects text and layout, then builds an editable draft. Background repair is approximate; photos remain cropped image layers, not guaranteed transparent cutouts. Review before saving.</p>
                <button type="button" class="ds-mode-btn ds-mode-btn-primary" id="btnConvertEditable">Create editable draft · 2 credits</button>
              </div>

              <div class="ds-mode-card" id="cardUseAsImage">
                <span class="ds-mode-badge" style="background:#475569;">Simple Layer</span>
                <div class="ds-mode-icon">🖼</div>
                <h3>Use as Image</h3>
                <p>Opens your image directly on a flat canvas layer without altering pixels. Add text badges, shapes, or stickers right on top.</p>
                <button type="button" class="ds-mode-btn ds-mode-btn-subtle" id="btnUseAsImage">Use as Image</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 3: Progress -->
        <div class="ds-modal-step" id="modalStep3" hidden>
          <div class="ds-modal-header">
            <h3 class="ds-modal-title">Analyzing &amp; Reconstructing Design</h3>
          </div>
          <div class="ds-modal-body">
            <div class="ds-progress-wrap">
              <div class="ds-progress-bar-bg">
                <div class="ds-progress-bar-fill" id="conversionProgressBar"></div>
              </div>
              <p class="ds-progress-status" id="conversionProgressText">1. Uploading image...</p>
              <p class="ds-progress-hint">Please keep this window open. We will show the result only after the server responds.</p>
            </div>
          </div>
        </div>

        <!-- Step 4: Review Layers -->
        <div class="ds-modal-step" id="modalStep4" hidden>
          <div class="ds-modal-header">
            <h3 class="ds-modal-title">Review Editable Layers</h3>
            <button type="button" class="ds-modal-close" onclick="document.getElementById('designUploadModal').setAttribute('hidden','')" aria-label="Close dialog">&times;</button>
          </div>
          <div class="ds-modal-body">
            <p id="designReviewWarning" class="ds-conversion-note" role="status"></p>
            <div class="ds-review-layout">
              <div class="ds-review-col">
                <div class="ds-view-toggle">
                  <button type="button" id="toggleViewOrig">Original</button>
                  <button type="button" class="active" id="toggleViewEdit">Editable Preview</button>
                </div>
                <div class="ds-review-stage-box" id="reviewOrigWrap" style="display:none;">
                  <img id="reviewOrigImg" src="" alt="Original Upload">
                </div>
                <div class="ds-review-stage-box" id="reviewEditWrap">
                  <div id="reviewReconstructedStage"></div>
                </div>
              </div>

              <div class="ds-review-col">
                <h4>
                  <span>Detected Layers</span>
                  <span class="ds-tag" id="reviewLayersCount">0 layers</span>
                </h4>
                <div class="ds-review-layers-list" id="reviewLayersList"></div>
              </div>
            </div>

            <div class="ds-review-actions">
              <button type="button" class="ds-btn ds-btn-outline" id="btnCancelReview">Cancel</button>
              <button type="button" class="ds-btn ds-btn-outline" id="btnConvertAgain">Re-analyze</button>
              <button type="button" class="ds-btn ds-btn-magic" id="btnOpenEditor">✦ Open in Design Studio →</button>
            </div>
          </div>
        </div>

      </div>
    </div>`,
  scripts: `<script src="/design-preview.js?v=${V}" defer></script><script src="/designs.js?v=${V}" defer></script>`
};

const templatePage = {
  route: "/template",
  active: "templates",
  title: "Template Details — ShortsCraft",
  desc: "Preview, customize and discuss creator motion graphics templates for YouTube Shorts and Instagram Reels.",
  body: `    <main class="sh-home" style="display:flex;align-items:center;justify-content:center;min-height:calc(100vh - 60px);padding:24px 16px;">
      <div class="sh-modal-card" style="transform:none;opacity:1;position:relative;">
        <a href="/animations" class="sh-modal-close" aria-label="Back to animations">×</a>
        <div class="sh-modal-left">
          <div class="sh-modal-stage" id="detailStage"></div>
          <a href="/editor" class="sh-modal-cta" id="detailStudioBtn">✦ Use Template →</a>
          <div class="sh-modal-ctrls">
            <button type="button" class="sh-modal-act-btn" id="detailReplayBtn">▶ Replay</button>
            <button type="button" class="sh-modal-act-btn" id="detailLikeBtn">♥ <span class="td-like-count">0</span></button>
            <button type="button" class="sh-modal-act-btn" id="detailShareBtn">🔗 Share</button>
            <button type="button" class="sh-modal-act-btn" id="detailReportBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg><span>Report</span></button>
          </div>
        </div>

        <div class="sh-modal-right">
          <div>
            <span class="sh-m-cat" id="detailCat">✦ DOCUMENTARY</span>
            <h1 class="sh-m-title" id="detailTitle">Template Title</h1>
            <p class="sh-m-desc" id="detailDesc">Loading template details...</p>
            <div class="sh-m-specs">
              <span class="sh-m-spec">Duration: <b id="detailDur">4.6s</b></span>
              <span class="sh-m-spec">Aspect: <b id="detailAspect">9:16</b></span>
              <span class="sh-m-spec">Frame rate: <b>24–60 fps</b></span>
              <span class="sh-m-spec">Export: <b>${C.export} credit${C.export === 1 ? "" : "s"}</b></span>
              <span class="sh-m-spec">Source: <b id="detailSource">Official</b></span>
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
  scripts: `<script src="/templates-v2.js?v=${V}"></script><script src="/template-detail.js?v=${V}" defer></script>`
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
.cp-stat-btn{background:none;border:none;font:inherit;color:inherit;cursor:pointer;padding:0;}
.cp-stat-btn:hover b{text-decoration:underline;}
.cp-sec-title{font-family:var(--sh-display);font-size:22px;font-weight:750;margin:0 0 20px;color:var(--sh-ink)}
.sc-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;}
.sc-modal-backdrop[hidden]{display:none;}
.sc-modal-card{background:var(--sh-bg1);border:1px solid var(--sh-line);border-radius:20px;width:100%;max-width:440px;padding:24px;box-shadow:0 24px 64px rgba(0,0,0,0.35);position:relative;animation:scModalPop .2s ease;}
@keyframes scModalPop{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}
.sc-modal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;}
.sc-modal-head h3{font-family:var(--sh-display);font-size:18px;font-weight:750;margin:0;color:var(--sh-ink);}
.sc-modal-close{background:none;border:none;font-size:24px;line-height:1;cursor:pointer;color:var(--sh-ink3);padding:0;}
.sc-modal-close:hover{color:var(--sh-ink);}
.sc-modal-list{display:flex;flex-direction:column;gap:8px;max-height:360px;overflow-y:auto;padding-right:4px;}
.sc-user-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px;border-radius:12px;text-decoration:none;transition:background .15s;}
.sc-user-row:hover{background:var(--sh-bg2);}
.sc-user-info{display:flex;align-items:center;gap:12px;min-width:0;flex:1;}
.sc-user-av{width:40px;height:40px;border-radius:50%;background:var(--sh-bg3);display:grid;place-items:center;font-weight:700;font-size:14px;color:var(--sh-ink);flex:none;}
.sc-user-txt{min-width:0;}
.sc-user-name{font-weight:650;font-size:13.5px;color:var(--sh-ink);display:flex;align-items:center;gap:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.sc-user-handle{font-size:12px;color:var(--sh-ink3);}
.sc-star-presets{display:flex;gap:8px;margin-bottom:14px;}
.sc-star-pill{flex:1;padding:8px 0;border:1px solid var(--sh-line);background:var(--sh-bg2);border-radius:10px;font-weight:700;font-size:14px;cursor:pointer;color:var(--sh-ink);transition:all .15s;}
.sc-star-pill:hover,.sc-star-pill.active{border-color:#eab308;background:rgba(234,179,8,0.1);color:#ca8a04;}
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
              <span class="cp-stat"><button type="button" class="cp-stat-btn" id="creatorFollowersBtn"><b id="creatorFollowers">0</b> Followers</button></span>
              <span class="cp-stat"><button type="button" class="cp-stat-btn" id="creatorFollowingBtn"><b id="creatorFollowing">0</b> Following</button></span>
              <span class="cp-stat"><b id="creatorStars">0</b> Stars</span>
            </div>
          </div>
          <!-- Starts hidden. Whether these belong on screen depends on who is looking. -->
          <div class="cp-actions" id="creatorSelfActions" hidden>
            <a href="/account" class="pg-bo" id="creatorEditProfileBtn">Edit Profile</a>
          </div>
          <div class="cp-actions" id="creatorActions" hidden>
            <button type="button" class="pg-bw" id="creatorFollowBtn">Follow</button>
            <button type="button" class="pg-bo" id="creatorStarBtn">★ Send Stars</button>
          </div>
        </section>

        <!-- Instagram-style Follow / Following List Modal -->
        <div class="sc-modal-backdrop" id="followsModal" hidden>
          <div class="sc-modal-card" role="dialog" aria-modal="true" aria-labelledby="followsModalTitle">
            <div class="sc-modal-head">
              <h3 id="followsModalTitle">Followers</h3>
              <button type="button" class="sc-modal-close" id="followsModalClose" aria-label="Close">&times;</button>
            </div>
            <div class="sc-modal-list" id="followsModalList">
              <p style="text-align:center;color:var(--sh-ink3);font-size:13px;padding:16px 0;">Loading…</p>
            </div>
          </div>
        </div>

        <!-- Instagram-style Send Stars Modal -->
        <div class="sc-modal-backdrop" id="starsModal" hidden>
          <div class="sc-modal-card" role="dialog" aria-modal="true" aria-labelledby="starsModalTitle">
            <div class="sc-modal-head">
              <h3 id="starsModalTitle">★ Send Stars</h3>
              <button type="button" class="sc-modal-close" id="starsModalClose" aria-label="Close">&times;</button>
            </div>
            <div style="margin-bottom:14px;font-size:13px;color:var(--sh-ink2);">
              Appreciate <strong id="starsRecipientName">Creator</strong> with Stars.
            </div>
            <div style="font-size:12px;color:var(--sh-ink3);margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
              <span>Choose amount:</span>
              <span>Available: <strong id="starsUserBalance" style="color:var(--sh-ink);">0</strong> Stars</span>
            </div>
            <div class="sc-star-presets">
              <button type="button" class="sc-star-pill active" data-amount="1">★ 1</button>
              <button type="button" class="sc-star-pill" data-amount="5">★ 5</button>
              <button type="button" class="sc-star-pill" data-amount="10">★ 10</button>
              <button type="button" class="sc-star-pill" data-amount="20">★ 20</button>
            </div>
            <div style="margin-bottom:14px;">
              <label for="starsAmountInput" style="display:block;font-size:12px;color:var(--sh-ink3);margin-bottom:4px;">Custom Stars (1–20):</label>
              <input type="number" id="starsAmountInput" class="pg-inp" min="1" max="20" value="1" style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid var(--sh-line);border-radius:10px;background:var(--sh-bg2);color:var(--sh-ink);font-size:14px;" />
            </div>
            <div style="margin-bottom:18px;">
              <label for="starsNoteInput" style="display:block;font-size:12px;color:var(--sh-ink3);margin-bottom:4px;">Add a note (optional):</label>
              <input type="text" id="starsNoteInput" class="pg-inp" maxlength="120" placeholder="Great animation! Loved the kinetic typography." style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid var(--sh-line);border-radius:10px;background:var(--sh-bg2);color:var(--sh-ink);font-size:13px;" />
            </div>
            <div style="display:flex;gap:10px;justify-content:flex-end;">
              <button type="button" class="pg-bo" id="starsModalCancel" style="padding:8px 16px;">Cancel</button>
              <button type="button" class="pg-bw" id="starsModalSend" style="padding:8px 20px;">Send Stars</button>
            </div>
          </div>
        </div>

        <section>
          <h2 class="cp-sec-title">Published Templates</h2>
          <div class="sh-gallery" id="creatorGrid" style="padding:0;"></div>
        </section>
      </div>
    </main>`,
  scripts: `<script src="/templates-v2.js?v=${V}"></script><script src="/creator-profile.js?v=${V}" defer></script>`
};

/* ── MY UPLOADS ───────────────────────────────────────────── */
/* Was an anchor into /account that showed a permanent empty state: the script
   that fills it looks for #userCreationsGrid, which existed on no page, so a
   creator who had published templates still saw "nothing published yet". */
const uploads = {
  route: "/uploads", title: "My Projects — ShortsCraft", robots: "noindex, follow",
  head: '<meta http-equiv="refresh" content="0;url=/drafts#published">',
  body: '<main class="pg"><p>This workspace has moved to <a href="/drafts#published">My Projects</a>.</p></main>'
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
${pageHead("My Projects")}

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
      <section class="pg-sec" id="accountBox" hidden>
        <h2 id="published">Published & scheduled templates</h2>
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
    </main>`,
  scripts: `<script src="/templates-v2.js?v=${V}"></script><script src="/drafts-store.js?v=${V}" defer></script><script src="/drafts-page.js?v=${V}" defer></script>`
};

/* ── SETTINGS ─────────────────────────────────────────────── */
const settings = {
  route: "/settings",
  active: null,
  robots: "noindex, follow",
  title: "Settings — ShortsCraft",
  desc: "Your ShortsCraft profile, plan and account controls.",
  /* Settings is a list of facts and a few buttons, and it now looks like one.
     It had a display-size headline, a sub-headline, a profile card, eleven
     separate cards under five section labels and a line of fine print —
     most of them repeating the profile page, the pricing page or the rail.
     What is left is one row per thing: what it is, its value, what you can
     do about it. Everything a row showed before is still on this page. */
  head: `<style>
.st-page{max-width:760px}
.st-head{margin:0 0 20px}
.st-head h1{margin:0;font-size:clamp(26px,2.6vw,32px);font-weight:700;letter-spacing:-.02em;color:var(--sc-text)}
.st-label{margin:22px 0 8px;font-size:12px;font-weight:650;letter-spacing:.06em;text-transform:uppercase;color:var(--sc-muted)}
.st-list{border:1px solid var(--sc-border);border-radius:12px;background:var(--sc-surface);overflow:hidden}
.st-list + .st-list{margin-top:14px}
.st-row{display:flex;align-items:center;gap:14px;min-height:54px;padding:10px 16px;color:var(--sc-text);text-decoration:none}
.st-row + .st-row{border-top:1px solid var(--sc-border)}
.st-key{flex:0 0 150px;font-size:14px;color:var(--sc-muted)}
.st-val{flex:1 1 auto;min-width:0;font-size:14px;color:var(--sc-text);overflow-wrap:anywhere}
.st-sub{display:block;font-size:12.5px;color:var(--sc-muted)}
.st-sub:empty{display:none}
.st-grow{flex:1 1 auto;min-width:0;display:grid;gap:1px}
.st-grow strong{font-size:15px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.st-av{flex:none;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:var(--sc-surface-3);background-size:cover;background-position:center;color:var(--sc-text);font-size:15px;font-weight:700}
.st-btn{flex:none;display:inline-flex;align-items:center;height:34px;padding:0 14px;border:1px solid var(--sc-border);border-radius:9px;background:var(--sc-surface);color:var(--sc-text);font:inherit;font-size:13px;font-weight:600;text-decoration:none;cursor:pointer}
.st-btn:hover{background:var(--sc-surface-2)}
.st-danger{color:var(--sc-danger)}
.st-link .st-key{flex:1 1 auto;color:var(--sc-text)}
.st-link:hover{background:var(--sc-surface-2)}
.st-chev{color:var(--sc-muted);font-size:20px;line-height:1}
@media (max-width:560px){
  .st-row{flex-wrap:wrap;gap:4px 12px;padding:12px 14px}
  .st-key{flex:1 0 100%}
  .st-link .st-key,.st-profile .st-key{flex:1 1 auto}
}
</style>`,
  body: `    <main class="pg st-page">
      <header class="st-head"><h1>Settings</h1></header>

      <section aria-label="Preferences and support">
        <h2 class="st-label">Appearance</h2>
        <div class="st-list"><div class="st-row"><span class="st-key">Theme</span><span class="st-val">Light or dark · saved on this device</span><button type="button" class="st-btn" data-theme-toggle aria-pressed="false"><span data-theme-label>Dark theme</span></button></div></div>
        <h2 class="st-label">Help & support</h2>
        <div class="st-list">
          <a class="st-row st-link" href="/tutorials"><span class="st-key">Help & tutorials</span><span aria-hidden="true">›</span></a>
          <a class="st-row st-link" href="/contact"><span class="st-key">Feedback & support</span><span aria-hidden="true">›</span></a>
          <a class="st-row st-link" href="/admin" data-auth="admin" hidden><span class="st-key">Admin Console</span><span aria-hidden="true">›</span></a>
        </div>
      </section>

      <section id="accountBox" hidden>
        <h2 class="st-label">Profile</h2>
        <div class="st-list">
          <div class="st-row st-profile" id="profile">
            <div class="st-av" id="crAvatarChar" aria-hidden="true">KA</div>
            <div class="st-grow">
              <strong id="crDisplayName">Creator</strong>
              <span class="st-sub" id="crHandle">@creator</span>
            </div>
            <button type="button" class="st-btn" id="openEditProfileBtn">Edit profile</button>
          </div>
        </div>

        <h2 class="st-label">Account</h2>
        <div class="st-list">
          <div class="st-row"><span class="st-key">Email</span><span class="st-val" id="accEmail">—</span></div>
          <div class="st-row"><span class="st-grow"><strong>Google sign-in</strong><span class="st-sub" data-google-status role="status">Connect the Google account with the same email.</span></span><button type="button" class="st-btn" data-google-signin data-google-link disabled>Connect Google</button></div>
          <div class="st-row">
            <span class="st-key">Plan</span>
            <span class="st-val"><span id="accPlan">—</span><span class="st-sub" id="accPlanTerm"></span></span>
            <a class="st-btn" href="/pricing">Change plan</a>
          </div>
          <div class="st-row">
            <span class="st-key">Credits</span>
            <span class="st-val"><span id="accCredits">—</span><span class="st-sub">Resets daily at 00:00 UTC</span></span>
          </div>
          <div class="st-row"><span class="st-key">Member since</span><span class="st-val" id="accSince">—</span></div>
        </div>

        <h2 class="st-label">Notifications</h2>
        <div class="st-list">
          <div class="st-row st-push" data-push-row hidden>
            <span class="st-grow">
              <strong>This device</strong>
              <span class="st-sub" id="pushSettingsText">Get notifications on this device, even when ShortsCraft is closed.</span>
            </span>
            <button type="button" class="st-btn" id="pushSettingsBtn">Turn on</button>
          </div>
          <div class="st-row">
            <span class="st-grow">
              <strong>What you hear about</strong>
              <span class="st-sub">Likes, comments and replies, new followers, Stars, support replies, and decisions on your templates and tutorials.</span>
            </span>
          </div>
        </div>

        <h2 class="st-label">Your work</h2>
        <div class="st-list">
          <a class="st-row st-link" href="/drafts#published"><span class="st-key">Published templates</span><span class="st-chev" aria-hidden="true">›</span></a>
          <a class="st-row st-link" href="/drafts"><span class="st-key">Drafts &amp; projects</span><span class="st-chev" aria-hidden="true">›</span></a>
        </div>

        <div class="st-list" style="margin-top:22px">
          <div class="st-row">
            <span class="st-key" style="flex:1 1 auto">Log out of this device</span>
            <button type="button" class="st-btn st-danger" id="accLogout">Log out</button>
          </div>
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
        <p>This console is available only to the ShortsCraft owner and the people the owner appoints.</p>
      </section>

      <div id="adminApp" hidden>
        ${pageHead("Admin Console")}

        <nav class="admin-tabs" aria-label="Admin sections">
          <button type="button" data-admin-tab="overview" data-perm="overview.view" aria-pressed="true">Overview</button>
          <button type="button" data-admin-tab="content" data-perm="templates.moderate" aria-pressed="false">Templates</button>
          <button type="button" data-admin-tab="skills" data-perm="tutorials.moderate" aria-pressed="false">Tutorials</button>
          <button type="button" data-admin-tab="support" data-perm="support.reply" aria-pressed="false">Support</button>
          <button type="button" data-admin-tab="reports" data-perm="reports.review" aria-pressed="false">Reports</button>
          <button type="button" data-admin-tab="users" data-perm="users.view" aria-pressed="false">Users</button>
          <button type="button" data-admin-tab="team" data-perm="owner" aria-pressed="false" hidden>Team</button>
          <button type="button" data-admin-tab="features" data-perm="owner" aria-pressed="false">Feature flags</button>
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
          <div class="pg-accsec-head"><div><h2>Template moderation</h2></div><button class="pg-bo" type="button" data-admin-refresh="content">Refresh</button></div>
          <div class="admin-list" id="adminTemplateList"><p>Loading templates…</p></div>
        </section>

        <!-- Tutorials publish themselves; this is where one comes down.
             Anyone can paste a link to any video and call it their own, so the
             list that matters here is what is already live. -->
        <section class="admin-panel" data-admin-panel="skills" hidden>
          <div class="pg-accsec-head">
            <div><h2>Creator tutorials</h2></div>
            <div class="admin-row-controls">
              <select id="adminSkillStatus" aria-label="Which tutorials to show">
                <option value="published" selected>Published</option>
                <option value="pending">Held back</option>
                <option value="rejected">Rejected</option>
              </select>
              <button class="pg-bo" type="button" data-admin-refresh="skills">Refresh</button>
            </div>
          </div>
          <div class="admin-list" id="adminSkillList"><p>Loading tutorials…</p></div>
        </section>

        <section class="admin-panel" data-admin-panel="support" hidden>
          <div class="pg-accsec-head"><div><h2>Support queue</h2></div><button class="pg-bo" type="button" data-admin-refresh="support">Refresh</button></div>
          <div class="admin-support-layout"><div class="admin-list" id="adminTicketList"><p>Loading tickets…</p></div><div class="admin-ticket-view" id="adminTicketView"><p>Select a ticket to read and reply.</p></div></div>
        </section>

        <!-- Reports from anyone about a template, tutorial, creator or comment.
             Closing a report records what was done; the content itself is
             changed from its own tab (Templates, Tutorials). -->
        <section class="admin-panel" data-admin-panel="reports" hidden>
          <div class="pg-accsec-head">
            <div><h2>Reports</h2></div>
            <div class="admin-row-controls">
              <select id="adminReportStatus" aria-label="Which reports to show">
                <option value="open" selected>Open</option>
                <option value="reviewing">Reviewing</option>
                <option value="actioned">Actioned</option>
                <option value="dismissed">Dismissed</option>
              </select>
              <button class="pg-bo" type="button" data-admin-refresh="reports">Refresh</button>
            </div>
          </div>
          <div class="admin-list" id="adminReportList"><p>Loading reports…</p></div>
        </section>

        <section class="admin-panel" data-admin-panel="users" hidden>
          <div class="pg-accsec-head"><div><h2>Accounts</h2></div><button class="pg-bo" type="button" data-admin-refresh="users">Refresh</button></div>
          <input class="admin-search" id="adminUserSearch" type="search" placeholder="Search by name, handle or email" aria-label="Search accounts" autocomplete="off">
          <div class="admin-list" id="adminUserList"><p>Loading accounts…</p></div>
        </section>

        <!-- The owner appoints staff here. An admin gets only the permissions
             ticked for them; appointing staff and feature flags stay with the
             owner and cannot be given away. -->
        <section class="admin-panel" data-admin-panel="team" hidden>
          <div class="pg-accsec-head"><div><h2>Team</h2></div><button class="pg-bo" type="button" data-admin-refresh="team">Refresh</button></div>
          <div class="admin-list" id="adminTeamList"><p>Loading team…</p></div>
        </section>

        <section class="admin-panel" data-admin-panel="features" hidden>
          <div class="pg-accsec-head"><div><h2>Feature flags</h2></div><button class="pg-bo" type="button" data-admin-refresh="features">Refresh</button></div>
          <div class="admin-list" id="adminFlagList"><p>Loading feature flags…</p></div>
        </section>

        <p class="pg-formnote" id="adminNote" role="status" aria-live="polite"></p>
      </div>
    </main>`,
  scripts: `<script src="/admin-console.js?v=${V}" defer></script>`
};

/* ── write ────────────────────────────────────────────────── */
/* Password recovery.

   These two were hand-written HTML from before the redesign and were never
   generated, so every later fix walked straight past them: they still loaded
   shell.css at ?v=2026083001, never loaded redesign.css or polish.css, and had
   no theme bootstrap at all. Following "forgotten your password?" from a light
   signup page dropped you onto a dark purple one — the same product wearing a
   different skin at the exact moment someone is already unsure whether they
   are in the right place.

   Generated from the same chrome as login and signup now, with the ids page.js
   binds to kept exactly as they were. */
const recoveryPage = (kind) => {
  const isReset = kind === "reset";
  return {
    bare: true,
    route: isReset ? "/reset-password" : "/forgot-password",
    active: null,
    robots: "noindex, nofollow",
    title: (isReset ? "Choose a new password" : "Reset your password") + " — ShortsCraft",
    desc: isReset
      ? "Set a new ShortsCraft password using your single-use reset link."
      : "Send yourself a secure, single-use link to reset your ShortsCraft password.",
    body: `    <main class="pg pg-narrow">
      <section class="pg-head">
        <h1>${isReset ? "Choose a new password" : "Reset your password"}</h1>
      </section>

      ${isReset ? `<form class="pg-form pg-auth" id="resetForm" novalidate>
        <div class="pg-f">
          <label for="resetPassword">New password <span>— at least 8 characters</span></label>
          <div class="pg-pw-wrap">
            <input id="resetPassword" name="password" type="password"
                   autocomplete="new-password" minlength="8" maxlength="200" required>
            <button type="button" class="pg-pw-toggle" data-password-toggle="#resetPassword" aria-label="Show new password" aria-pressed="false">
              <svg class="pg-pw-eye pg-pw-eye-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              <svg class="pg-pw-eye pg-pw-eye-closed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
            </button>
          </div>
        </div>
        <div class="pg-f">
          <label for="resetConfirm">Confirm new password</label>
          <div class="pg-pw-wrap">
            <input id="resetConfirm" name="confirm" type="password"
                   autocomplete="new-password" minlength="8" maxlength="200" required>
            <button type="button" class="pg-pw-toggle" data-password-toggle="#resetConfirm" aria-label="Show confirmed password" aria-pressed="false">
              <svg class="pg-pw-eye pg-pw-eye-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              <svg class="pg-pw-eye pg-pw-eye-closed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
            </button>
          </div>
        </div>
        <p class="pg-fine">Setting a new password signs you out everywhere else.</p>
        <button class="pg-bw" type="submit" id="resetSend">Set new password</button>
        <p class="pg-formnote" id="resetNote" role="status" aria-live="polite"></p>
        <p class="pg-fine">Remembered it? <a href="/login">Log in instead</a>.</p>
      </form>` : `<form class="pg-form pg-auth" id="forgotForm" novalidate>
        <div class="pg-f">
          <label for="forgotEmail">Email</label>
          <input id="forgotEmail" name="email" type="email" autocomplete="email"
                 maxlength="140" required>
        </div>
        <p class="pg-fine">We will email a single-use link that works for 30 minutes.</p>
        <button class="pg-bw" type="submit" id="forgotSend">Send reset link</button>
        <p class="pg-formnote" id="forgotNote" role="status" aria-live="polite"></p>
        <!-- Development only: the route returns a one-time preview link so the
             flow stays testable without a mail provider. Production never
             fills this in. -->
        <p class="pg-fine"><a id="forgotDevLink" hidden></a></p>
        <p class="pg-fine">
          Remembered it? <a href="/login">Log in</a>. No account yet?
          <a href="/signup">Create one</a>.
        </p>
      </form>`}
    </main>`
  };
};

const PAGES = [
  ["index.html", indexPage],
  ["template.html", templatePage],
  ["creator.html", creatorPage],
  ["pricing.html", pricing],
  ["animations.html", animationsPage],
  ["designs.html", designsPage],
  ["about.html", about],
  ["contact.html", contact],
  ["community.html", community],
  ["tutorials.html", tutorials],
  ["privacy.html", privacy],
  ["terms.html", terms],
  ["404.html", notfound],
  ["login.html", authPage("login")],
  ["signup.html", authPage("signup")],
  ["forgot-password.html", recoveryPage("forgot")],
  ["reset-password.html", recoveryPage("reset")],
  ["account.html", account],
  ["uploads.html", uploads],
  ["drafts.html", drafts],
  ["settings.html", settings],
  ["admin.html", adminPage]
];

let n = 0;
// Optional page selection avoids overwriting unrelated pages during a scoped fix.
const selectedPages = process.argv.slice(2);
for (const file of selectedPages) {
  if (!PAGES.some(([name]) => name === file)) throw new Error(`Unknown page: ${file}`);
}
for (const [file, p] of PAGES) {
  if (selectedPages.length && !selectedPages.includes(file)) continue;
  // These two checked-in pages now form one hand-maintained account workspace.
  // Their older templates above are retained for the reversible redesign, but
  // must not overwrite the reviewed forms/settings when other pages rebuild.
  if (["account.html", "settings.html"].includes(file)) {
    if (!fs.existsSync(path.join(OUT, file))) throw new Error(`Missing canonical account page: ${file}`);
    console.log(`kept hand-maintained public/${file}`);
    continue;
  }
  const html = chrome(p);
  fs.writeFileSync(path.join(OUT, file), html, "utf8");
  console.log(`wrote public/${file}  ${(html.length / 1024).toFixed(1)} KB`);
  n++;
}
console.log(`\n${n} pages built from one chrome.`);
