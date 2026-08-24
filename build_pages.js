/* ============================================================
   build_pages.js — generates every non-app page from ONE shell chrome.
   Nothing here reuses the legacy site: pages load only shell.css + page.css
   and page.js. Run:  node build_pages.js
   ============================================================ */
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "public");
const V = "202608241";

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
  { href: "/#templates", label: "Templates", key: "templates",
    icon: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>' },
  { href: "/drafts", label: "My Projects", key: "projects",
    icon: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>' },
  { href: "/community", label: "Community", key: "community",
    icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
  { href: "/tutorials", label: "Tutorials & Help", key: "tutorials",
    icon: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>' }
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
    <a href="/contact">Help</a>
  </nav>
</div>

<script src="/authui.js?v=${V}" defer></script>
<script src="/page.js?v=${V}" defer></script>
${p.scripts || ""}</body>
</html>
`;
}

function chrome(p) {
  const nav = NAV.map((n) => `        <a href="${n.href}"${n.key === p.active ? ' aria-current="page"' : ""}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${n.icon}</svg>
          <span>${n.label}</span>
        </a>`).join("\n");

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
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

<meta name="theme-color" content="#000000">
<link rel="icon" type="image/svg+xml" href="/favicon.svg?v=20260725">
<link rel="icon" href="/favicon.ico?v=20260725" sizes="any">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=20260725">
<link rel="manifest" href="/site.webmanifest?v=20260725">

<!-- New stack only. styles.css / premium.css / landing.css / seo-tools.css are
     the legacy theme and are deliberately never loaded here. -->
<link rel="stylesheet" href="/shell.css?v=${V}">
<link rel="stylesheet" href="/page.css?v=${V}">
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
    </nav>

    <div class="sh-rail-foot">
      <div class="sh-plan-badge">
        <b>Free plan</b>
        <span>${P.free.perDay} credits every day. Export ${C.export}, AI scene ${C.animate}.</span>
        <a href="/pricing">Upgrade to Pro · ₹${P.pro.price}/mo ↗</a>
      </div>

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
              <span class="sh-upop-credits-pill">⚡ 10 Credits</span>
            </div>

            <div class="sh-upop-menu">
              <button type="button" class="sh-upop-item" id="popoverProfileBtn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <div class="sh-upop-item-txt">
                  <b>My Profile &amp; Setup</b>
                  <span>Setup bio, avatar &amp; links</span>
                </div>
              </button>

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
                  <b>My Uploads</b>
                  <span>Published community templates</span>
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

              <a href="/pricing" class="sh-upop-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                <div class="sh-upop-item-txt">
                  <b>Subscription &amp; Plans</b>
                  <span>Credits, 4K rendering</span>
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
              <span class="sh-user-trigger-name" data-user-name>Account</span>
              <span class="sh-user-trigger-handle" data-user-handle>@creator</span>
            </div>
            <span class="sh-user-trigger-arrow">▲</span>
          </button>
        </div>
      </div>
    </div>
  </aside>

  <div class="sh-main" id="main" role="main" tabindex="-1">

    <header class="sh-topbar">
      <button id="navBurger" type="button" aria-label="Menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
      <a href="/community" class="sh-tlink">Community</a>
      <a href="/contact" class="sh-tlink">Feedback</a>
      <a href="/about" class="sh-tlink">About</a>
      <a href="/pricing" class="sh-tfill">Upgrade</a>
      <span class="sh-tsep" aria-hidden="true"></span>
      <a href="/login" class="sh-tlink" data-auth="out">Log in</a>
      <a href="/signup" class="sh-tline" data-auth="out">Sign up</a>
      <a href="/account" class="sh-tlink" data-auth="in" hidden><span data-auth-email>Account</span></a>
      <button type="button" class="sh-tline" data-auth="in" id="logoutBtn" hidden>Log out</button>
    </header>

    <div id="navMobile" hidden>
      <a href="/#templates">Templates</a>
      <a href="/community">Community</a>
      <a href="/editor">Editor</a>
      <a href="/pricing">Pricing</a>
      <a href="/about">About</a>
      <a href="/contact">Help &amp; Feedback</a>
      <a href="/login" data-auth="out">Log in</a>
      <a href="/signup" data-auth="out">Sign up</a>
      <a href="/account" data-auth="in" hidden>Account</a>
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
          <p>The AI motion design studio for viral YouTube Shorts and kinetic animations.</p>
        </div>

        <nav class="sh-fcol" aria-label="Product">
          <h2>Product</h2>
          <a href="/editor">Studio Editor</a>
          <a href="/#templates">Templates Gallery</a>
          <a href="/community">Community Hub</a>
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

const pricing = {
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

      <div class="pg-plans pg-plans3">
        <article class="pg-plan">
          <span class="pg-tier">${P.free.label}</span>
          <div class="pg-amt">₹0</div>
          <p class="pg-planline"><b>${P.free.perDay} exports every day</b> — enough to try everything and post your first Shorts.</p>
          <ul>
            <li>All ${TPL_COUNT} motion templates</li>
            <li>Unlimited editing and preview</li>
            <li>Custom AI animations from your prompt</li>
            <li>Export up to 720p</li>
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

/* ── ABOUT ────────────────────────────────────────────────── */
const about = {
  route: "/about",
  active: null,
  title: "About — ShortsCraft",
  desc: "ShortsCraft is an AI motion-design workspace for short-form creators: CSS-based motion templates, a real timeline editor and server-side MP4 export.",
  body: `    <main class="pg">
${pageHead("About", "A motion-design workspace, not another text-on-gradient app.", "ShortsCraft turns one line of an idea into an animated vertical video, and hands you the SEO pack that goes with it.")}

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
            <p>Exporting a video costs ${C.export}. Asking the AI to design a new scene costs ${C.animate}. Browsing, editing, previewing and the SEO tools cost nothing.</p>
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


/* ── COMMUNITY ─────────────────────────────────────────────
   Was a hand-written public/community.html carrying its own copy of the
   sidebar, the plan badge and the nav. That duplicate is exactly why fixes
   kept missing this page: the YouTube handle, the "Tutorials & Help"
   destination and the credit numbers were all corrected here and the community
   page went on showing the old ones. It is generated from the same chrome as
   every other page now, so there is one copy of all of it. */
const community = {
  route: "/community",
  active: "community",
  title: "Community Templates — ShortsCraft",
  desc: "Discover, customize and publish creator motion graphics templates. Built by creators for YouTube Shorts and Instagram Reels.",
  head: `<style>
.sh-comm-head{
  padding:50px 28px 20px;
  display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:16px;
}
.sh-comm-head h1{
  font-family:var(--sh-display);
  font-size:clamp(28px,4vw,44px);
  margin:0 0 8px;font-weight:700;letter-spacing:-.03em;
}
.sh-comm-head p{margin:0;font-size:15px;color:var(--sh-ink2);max-width:560px}
.sh-pub-btn{
  display:inline-flex;align-items:center;gap:8px;
  height:42px;padding:0 22px;border-radius:999px;
  background:#fff;color:#000 !important;font-weight:650;font-size:14px;
  text-decoration:none;transition:transform .15s ease;
}
.sh-pub-btn:hover{transform:translateY(-1px);background:#f2f2f2}

.sh-author-row{
  display:flex;align-items:center;justify-content:space-between;
  margin-top:8px;padding-top:8px;border-top:1px solid var(--sh-line);
}
.sh-author{
  display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--sh-ink3);
}
.sh-author b{color:var(--sh-ink);font-weight:600}
.sh-like-btn{
  background:none;border:1px solid var(--sh-line);border-radius:999px;
  color:var(--sh-ink2);padding:3px 10px;font-size:12px;cursor:pointer;
  display:inline-flex;align-items:center;gap:4px;transition:all .15s ease;
}
.sh-like-btn:hover{border-color:var(--sh-line2);color:#fff;background:rgba(255,255,255,.06)}
.sh-like-btn.liked{color:#ff3b5c;border-color:rgba(255,59,92,.4);background:rgba(255,59,92,.1)}
</style>`,
  body: `    <main class="sh-home">
      <section class="sh-comm-head">
        <div>
          <span class="sh-eyebrow">✦ Creator Showcase</span>
          <h1>Community Templates</h1>
          <p>Explore animations published by creator accounts. Open any template to customize text, typography and colors in the Studio.</p>
        </div>
        <button type="button" class="sh-pub-btn sh-tupload-btn">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          Upload / Publish Template
        </button>
      </section>

      <div class="sh-ratio-switch" id="commRatioSwitch" style="padding: 0 28px 10px;" role="group" aria-label="Aspect Ratio Filter">
        <span class="sh-ratio-lbl">Format:</span>
        <button type="button" class="sh-rchip active" data-ar="9:16" aria-pressed="true">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="7" y="2" width="10" height="20" rx="2"/></svg>
          <span>9:16 Shorts/Reels</span>
        </button>
        <button type="button" class="sh-rchip" data-ar="16:9" aria-pressed="false">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/></svg>
          <span>16:9 YouTube</span>
        </button>
        <button type="button" class="sh-rchip" data-ar="1:1" aria-pressed="false">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
          <span>1:1 Square</span>
        </button>
        <button type="button" class="sh-rchip" data-ar="4:5" aria-pressed="false">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="3" width="14" height="18" rx="2"/></svg>
          <span>4:5 Feed</span>
        </button>
      </div>

      <div class="sh-filters-wrap" style="padding: 0 28px;">
        <button type="button" class="sh-fnav-btn prev" id="commFnavPrev" aria-label="Scroll categories left">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <div class="sh-filters" id="commFilters">
          <button type="button" class="sh-chip" data-cat="all" aria-pressed="true">All</button>
          <button type="button" class="sh-chip" data-cat="text" aria-pressed="false">Text</button>
          <button type="button" class="sh-chip" data-cat="ui" aria-pressed="false">UI Elements</button>
          <button type="button" class="sh-chip" data-cat="social" aria-pressed="false">Social Media</button>
          <button type="button" class="sh-chip" data-cat="logos" aria-pressed="false">Logos</button>
          <button type="button" class="sh-chip" data-cat="charts" aria-pressed="false">Charts &amp; Data</button>
          <button type="button" class="sh-chip" data-cat="money" aria-pressed="false">Money</button>
        </div>
        <button type="button" class="sh-fnav-btn next" id="commFnavNext" aria-label="Scroll categories right">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      </div>

      <div class="sh-gallery" id="commGallery" data-ar="9:16" style="padding-top:16px;"></div>
    </main>`,
  scripts: `<script src="/templates-v2.js?v=9" defer></script><script>
(function() {
  "use strict";
  var grid = document.getElementById("commGallery");
  var filterBar = document.getElementById("commFilters");
  var ratioBar = document.getElementById("commRatioSwitch");
  var allTemplates = [];
  var currentCat = "all";
  var currentAspect = "9:16";

  /* A failed load used to log to the console and leave the grid empty, so a
     database outage rendered as a page that had simply finished loading with
     nothing on it. Say what happened and offer a retry instead. */
  function showLoadError() {
    if (!grid) return;
    grid.innerHTML = "";
    var box = document.createElement("div");
    box.className = "sh-comm-error";
    var h = document.createElement("b");
    h.textContent = "Could not load community templates";
    var msg = document.createElement("span");
    msg.textContent = "The gallery is temporarily unavailable. The Studio and the main template library are unaffected.";
    var row = document.createElement("div");
    row.className = "sh-comm-error-row";
    var again = document.createElement("button");
    again.type = "button";
    again.className = "sh-comm-retry";
    again.textContent = "Try again";
    again.addEventListener("click", function () { loadTemplates(); });
    var browse = document.createElement("a");
    browse.className = "sh-comm-retry alt";
    browse.href = "/#templates";
    browse.textContent = "Browse all templates";
    row.appendChild(again);
    row.appendChild(browse);
    box.appendChild(h);
    box.appendChild(msg);
    box.appendChild(row);
    grid.appendChild(box);
  }

  function showLoading() {
    if (!grid) return;
    grid.innerHTML = "";
    var l = document.createElement("p");
    l.className = "sh-comm-loading";
    l.textContent = "Loading community templates…";
    grid.appendChild(l);
  }

  function loadTemplates() {
    showLoading();
    /* The server waits on its database connection before it can answer, so a
       dead database left this request open for 20s with the page just saying
       "Loading". Give up sooner and show the retry. */
    var ctrl = ("AbortController" in window) ? new AbortController() : null;
    var bail = setTimeout(function () { if (ctrl) ctrl.abort(); }, 12000);
    fetch("/api/community-templates", ctrl ? { signal: ctrl.signal } : undefined)
      .then(function(r) {
        clearTimeout(bail);
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function(d) {
        if (!d || !d.templates) throw new Error((d && d.error) || "No templates in response");
        allTemplates = d.templates;
        renderGrid();
      })
      .catch(function(err) {
        clearTimeout(bail);
        console.error("Could not load community templates", err);
        showLoadError();
      });
  }

  function renderGrid() {
    if (!grid) return;
    grid.innerHTML = "";
    grid.dataset.ar = currentAspect;
    var list = (currentCat === "all") ? allTemplates : allTemplates.filter(function(t) { return t.category === currentCat; });

    if (!list.length) {
      grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:40px;color:var(--sh-ink3);">No community templates in this category yet. Be the first to publish one!</p>';
      return;
    }

    var e = window.SC_TPL2;

    list.forEach(function(t) {
      var tile = document.createElement("article");
      tile.className = "sh-tile";

      var stage = document.createElement("a");
      stage.className = "sh-stage";
      var editUrl = "/editor?tpl=" + encodeURIComponent(t.tpl || "type-cascade")
        + "&accent=" + encodeURIComponent(t.accent || "#ffffff")
        + "&font=" + encodeURIComponent(t.font || "inter")
        + "&dur=" + encodeURIComponent(t.dur || 4600)
        + "&aspect=" + encodeURIComponent(currentAspect)
        + "&lines=" + encodeURIComponent(JSON.stringify(t.lines || []));
      stage.href = editUrl;
      stage.setAttribute("aria-label", "Open " + t.title + " in Video Studio");

      var use = document.createElement("span");
      use.className = "sh-use";
      use.textContent = "Customize template";
      stage.appendChild(use);

      if (e && typeof e.build === "function") {
        var html = e.build(t.tpl, {
          lines: t.lines,
          accent: t.accent,
          font: t.font,
          dur: t.dur,
          aspect: currentAspect
        });
        if (html) {
          var frame = document.createElement("iframe");
          frame.setAttribute("sandbox", "");
          frame.setAttribute("scrolling", "no");
          frame.setAttribute("tabindex", "-1");
          frame.setAttribute("aria-hidden", "true");
          frame.srcdoc = html;
          stage.appendChild(frame);
        }
      }

      var meta = document.createElement("div");
      meta.className = "sh-tmeta";
      var b = document.createElement("b");
      b.textContent = t.title;
      var sp = document.createElement("span");
      sp.textContent = t.description;
      meta.appendChild(b);
      meta.appendChild(sp);

      var arow = document.createElement("div");
      arow.className = "sh-author-row";
      arow.innerHTML = '<div class="sh-author"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg> <b>@' + (t.authorHandle || "creator") + '</b></div>'
        + '<button type="button" class="sh-like-btn" data-id="' + t.id + '">❤️ <span>' + (t.likes || 1) + '</span></button>';

      meta.appendChild(arow);
      tile.appendChild(stage);
      tile.appendChild(meta);
      grid.appendChild(tile);
    });

    // Wire like buttons
    grid.querySelectorAll(".sh-like-btn").forEach(function(btn) {
      btn.addEventListener("click", function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var id = btn.dataset.id;
        fetch("/api/community-templates/" + id + "/like", { method: "POST" })
          .then(function(r) { return r.json(); })
          .then(function(res) {
            if (res && res.success) {
              btn.classList.add("liked");
              btn.querySelector("span").textContent = res.likes;
            }
          });
      });
    });
  }

  if (filterBar) {
    filterBar.addEventListener("click", function(ev) {
      var btn = ev.target && ev.target.closest(".sh-chip");
      if (!btn) return;
      filterBar.querySelectorAll(".sh-chip").forEach(function(b) {
        b.setAttribute("aria-pressed", String(b === btn));
      });
      currentCat = btn.dataset.cat;
      renderGrid();
    });
  }

  if (ratioBar) {
    ratioBar.addEventListener("click", function(ev) {
      var btn = ev.target && ev.target.closest(".sh-rchip");
      if (!btn || !btn.dataset.ar) return;
      var ar = btn.dataset.ar;
      if (ar === currentAspect) return;
      currentAspect = ar;
      ratioBar.querySelectorAll(".sh-rchip").forEach(function(b) {
        var active = b === btn;
        b.classList.toggle("active", active);
        b.setAttribute("aria-pressed", String(active));
      });
      renderGrid();
    });
  }

  /* Category strip arrows. The buttons were in the markup but wired to
     nothing, so they sat there doing nothing at either end of the strip.
     Each one nudges the strip by most of a screenful, and both hide
     themselves when there is nothing further to scroll to — an arrow that
     cannot move is worse than no arrow. */
  (function wireStripArrows() {
    var strip = document.getElementById("commFilters");
    var prev = document.getElementById("commFnavPrev");
    var next = document.getElementById("commFnavNext");
    if (!strip || !prev || !next) return;

    function sync() {
      var max = strip.scrollWidth - strip.clientWidth;
      // 2px of slack: sub-pixel layout means scrollLeft rarely lands exactly
      // on 0 or on max, which would leave an arrow visible but inert.
      prev.hidden = strip.scrollLeft <= 2;
      next.hidden = strip.scrollLeft >= max - 2;
    }

    function nudge(dir) {
      strip.scrollBy({ left: dir * Math.max(160, strip.clientWidth * 0.8), behavior: "smooth" });
    }

    prev.addEventListener("click", function () { nudge(-1); });
    next.addEventListener("click", function () { nudge(1); });
    strip.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    sync();
  })();

  window.addEventListener("DOMContentLoaded", function() {
    loadTemplates();
  });
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
              <option>Bug report</option>
              <option>Template request</option>
              <option>Billing or Pro plan</option>
              <option>Feature idea</option>
              <option>Something else</option>
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
            <p>Usually within two days. Billing questions are answered first.</p>
          </section>
        </aside>
      </div>
    </main>`
};

/* ── LEGAL ────────────────────────────────────────────────── */
const UPDATED = "8 August 2026";

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
        <p>The free plan includes 10 generations per day and export limits that keep the render queue usable for everyone. Rate limits exist so one user cannot starve the server, and they may be adjusted.</p>

        <h2>Pro plan, billing and refunds</h2>
        <p>Pro is ₹99 per month, billed through Razorpay. Cancel any time; access continues to the end of the period already paid for. If the service did not work for you, ask for a refund within 7 days of upgrading through <a href="/contact">Help &amp; Feedback</a>.</p>

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
          <a href="/seo-tools">SEO Tools</a>
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
      </form>
    </main>`
  };
};

const account = {
  route: "/account",
  active: null,
  robots: "noindex, follow",
  title: "Your account — ShortsCraft",
  desc: "Your ShortsCraft plan, daily credits and account details.",
  body: `    <main class="pg">
      <section class="pg-head">
        <span class="pg-eyebrow">Account</span>
        <h1>Your account</h1>
        <p>Plan, credits and sign-out live here.</p>
      </section>

      <section class="pg-sec" id="accountBox" hidden>

        <!-- Creator profile. The fields are painted by authui.js and edited
             through the same modal the sidebar opens, so there is one profile
             editor on the site rather than two that can disagree. -->
        <div class="pg-prof" id="profile">
          <div class="pg-prof-av" id="crAvatarChar">KA</div>
          <div class="pg-prof-main">
            <h2 class="pg-prof-name" id="crDisplayName">Creator</h2>
            <p class="pg-prof-handle" id="crHandle">@creator</p>
            <p class="pg-prof-bio" id="crBio"></p>
            <div class="pg-prof-links">
              <a id="crYtLink" href="/account" target="_blank" rel="noopener">YouTube</a>
              <a id="crIgLink" href="/account" target="_blank" rel="noopener">Instagram</a>
              <span class="pg-prof-stars">★ <b id="crStarsCount">48</b></span>
            </div>
          </div>
          <button type="button" class="pg-bo pg-prof-edit" id="openEditProfileBtn">Edit profile</button>
        </div>

        <div class="pg-grid">
          <article class="pg-card pg-card--wide"><h3>Email</h3><p id="accEmail">—</p></article>
          <article class="pg-card"><h3>Plan</h3><p id="accPlan">—</p><p class="pg-cardsub" id="accPlanTerm"></p></article>
          <article class="pg-card"><h3>Credits today</h3><p id="accCredits">—</p></article>
          <article class="pg-card"><h3>Member since</h3><p id="accSince">—</p></article>
        </div>
        <div class="pg-row" style="margin-top:20px">
          <a href="/editor" class="pg-bw">Open the Editor</a>
          <a href="/pricing" class="pg-bo">Change plan</a>
        </div>

        <!-- Uploads, drafts and settings are their own pages now. Three
             sections that all lived here meant the account menu offered three
             destinations and delivered one scrolled page. -->
        <div class="pg-accsec">
          <div class="pg-accsec-head"><h2>Your work</h2></div>
          <div class="pg-grid">
            <article class="pg-card">
              <h3>My uploads</h3>
              <p>The templates you have published to the Community gallery.</p>
              <a href="/uploads" class="pg-cardlink">Open My uploads →</a>
            </article>
            <article class="pg-card">
              <h3>Drafts &amp; projects</h3>
              <p>Projects the Studio has saved in this browser, ready to reopen.</p>
              <a href="/drafts" class="pg-cardlink">Open Drafts →</a>
            </article>
            <article class="pg-card">
              <h3>Settings</h3>
              <p>Your creator profile, plan and account controls.</p>
              <a href="/settings" class="pg-cardlink">Open Settings →</a>
            </article>
            <article class="pg-card">
              <h3>Sign out</h3>
              <p>Log out of ShortsCraft on this device. Your templates and plan stay on your account.</p>
              <button type="button" class="pg-cardlink pg-linkbtn pg-danger" id="accLogout">Log out →</button>
            </article>
          </div>
        </div>
      </section>

${guestGate("/account", "Log in to see your account", "Right now your credits live in this browser alone — clear your site data and they are gone. An account carries your plan, your credits and your published templates across every device you use.", ["Your plan and daily credit balance in one place", "Templates you publish stay tied to your creator name", "Drafts and settings follow you to any device"])}
    </main>`
};

const indexPage = {
  route: "/",
  active: "templates",
  noPageJs: true,
  title: "ShortsCraft — AI Motion Graphics Video Generator for YouTube Shorts",
  desc: "Create animated YouTube Shorts from your script with AI. Generate motion graphics, kinetic typography, viral reel animations, captions, SEO titles, hashtags and thumbnail prompts in one creator workspace.",
  head: `<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebApplication","name":"ShortsCraft","url":"https://shortscraft.online/","description":"AI motion graphics video generator for YouTube Shorts"}</script>`,
  body: `    <main class="sh-home">
      <section class="sh-hero">
        <h1>What can I help animate?</h1>
        <p class="sh-hero-sub">Your AI motion designer for stunning animations, viral Shorts and kinetic typefaces.</p>
      </section>

      <form class="sh-composer" id="composer" action="/editor" method="GET">
        <div class="sh-ctop">
          <label class="ed-sr" for="composerPrompt">Describe the animation you want</label>
          <textarea id="composerPrompt" name="topic" rows="2" maxlength="600"
            placeholder="What will you imagine? e.g. a glass pricing card that flips to reveal ₹99, dark with one green accent"></textarea>
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
              <span class="sh-csel-sparkle">✦</span>
              <span class="sh-csel-val" id="qualityVal">Free (${C.animate} credits)</span>
              <svg class="sh-csel-arrow" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div class="sh-csel-menu" id="qualityMenu" role="listbox" hidden>
              <div class="sh-csel-opt selected" role="option" data-val="mini" aria-selected="true">
                <div class="sh-csel-opt-main"><b>✦ Free</b><span>Fast standard generation · ${C.animate} credits</span></div>
                <svg class="sh-csel-check" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <div class="sh-csel-opt" role="option" data-val="pro" aria-selected="false">
                <div class="sh-csel-opt-main"><b>✦ Pro</b><span>Priority speed & detailed motion · ${C.animate} credits</span></div>
                <svg class="sh-csel-check" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <div class="sh-csel-opt" role="option" data-val="max" aria-selected="false">
                <div class="sh-csel-opt-main"><b>✦ Pro Max</b><span>Max fidelity & complex layouts · ${C.animate} credits</span></div>
                <svg class="sh-csel-check" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
            </div>
          </div>
          <div class="sh-cgrow"></div>
          <button class="sh-cgo" id="composerGo" type="submit">Create <span aria-hidden="true">→</span></button>
        </div>
      </form>

      <section class="sh-gallery-sec" id="templates">
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
      </section>

      <section class="sh-workflow-sec">
        <div class="sh-section-head">
          <span class="sh-eyebrow">✦ 3-Step Motion Engine</span>
          <h2>How the AI Motion Graphics Video Generator Works</h2>
          <p>Create thumb-stopping kinetic motion graphics and animated text reels in 3 frictionless steps.</p>
        </div>
        <div class="sh-workflow-grid">
          <div class="sh-workflow-card">
            <span class="sh-workflow-num">01</span>
            <div class="sh-workflow-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
            </div>
            <h3>Prompt or Pick Template</h3>
            <p>Describe your idea in simple English or Hinglish, or choose from our gallery of pre-built kinetic motion templates.</p>
          </div>
          <div class="sh-workflow-card">
            <span class="sh-workflow-num">02</span>
            <div class="sh-workflow-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
            </div>
            <h3>Live Dynamic Customizer</h3>
            <p>Fine-tune colors, fonts, speeds, layout, and copy with real-time zero-lag preview in the Studio editor.</p>
          </div>
          <div class="sh-workflow-card">
            <span class="sh-workflow-num">03</span>
            <div class="sh-workflow-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>
            </div>
            <h3>Export 4K &amp; Publish</h3>
            <p>Render smooth 60FPS vertical 9:16 MP4s for YouTube Shorts &amp; Reels, or share as a community template.</p>
          </div>
        </div>
      </section>

      <section class="sh-banner-sec">
        <div class="sh-community-card">
          <div class="sh-comm-info">
            <span class="sh-eyebrow">✦ Creator Community Hub</span>
            <h2>Publish Your Animations as Templates</h2>
            <p>Create animations with AI prompts, customize presets, and publish them to the community gallery for creators worldwide to use and customize.</p>
            <div class="sh-comm-acts">
              <a href="/community" class="sh-bw">Explore Community Hub <span aria-hidden="true">→</span></a>
              <a href="/editor" class="sh-bo">Open Studio</a>
            </div>
          </div>
          <div class="sh-comm-badge-box">
            <div class="sh-stat-pill">
              <b>100%</b>
              <span>CSS Vector Motion</span>
            </div>
            <div class="sh-stat-pill">
              <b>60 FPS</b>
              <span>Silky Smooth Loops</span>
            </div>
            <div class="sh-stat-pill">
              <b>4K Ready</b>
              <span>High-Res Rendering</span>
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
  scripts: `<script src="/templates-v2.js?v=9" defer></script><script src="/shell.js?v=9" defer></script>`
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
            <div class="sh-m-c-av td-creator-avatar">CD</div>
            <div class="sh-m-c-info">
              <span class="sh-m-c-name td-creator-name">Crime Stories</span>
              <span class="sh-m-c-handle td-creator-handle">@crimedocu</span>
              <span class="sh-m-c-bio td-creator-bio">Creating high-retention true crime and investigation templates.</span>
            </div>
            <span style="color:var(--sh-ink3);font-size:16px;font-weight:700;">→</span>
          </a>

          <div class="sh-m-comments" id="comments">
            <h2 class="sh-m-comm-head">Community Comments <span id="commentsCount" style="color:var(--sh-ink3);font-size:13px;">(3)</span></h2>
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
  scripts: `<script src="/templates-v2.js?v=9"></script><script src="/template-detail.js?v=4" defer></script>`
};

const creatorPage = {
  route: "/creator",
  active: "community",
  title: "Creator Profile — ShortsCraft",
  desc: "Explore animated templates, viral presets and creations by this creator on ShortsCraft.",
  head: `<style>
.cp-wrap{padding:36px 32px 64px;max-width:1300px;margin:0 auto}
.cp-hero{display:flex;align-items:center;gap:24px;background:var(--sh-bg2);border:1px solid var(--sh-line);border-radius:24px;padding:32px;margin-bottom:36px}
@media(max-width:768px){.cp-hero{flex-direction:column;text-align:center}}
.cp-avatar{width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,rgba(255,255,255,.25),rgba(255,255,255,.05));border:2px solid rgba(255,255,255,.2);display:grid;place-items:center;font-family:var(--sh-display);font-size:28px;font-weight:750;color:#fff;flex:none}
.cp-info{flex:1;min-width:0}
.cp-info h1{font-family:var(--sh-display);font-size:26px;font-weight:750;margin:0 0 4px;color:#fff}
.cp-handle{font-size:14px;color:var(--sh-ink3);margin-bottom:8px;display:block}
.cp-bio{font-size:14px;line-height:1.5;color:var(--sh-ink2);margin:0 0 14px;max-width:640px}
.cp-stats{display:flex;gap:18px;flex-wrap:wrap}
.cp-stat{font-size:13px;color:var(--sh-ink3)}
.cp-stat b{color:#fff;font-weight:700}
.cp-sec-title{font-family:var(--sh-display);font-size:22px;font-weight:750;margin:0 0 20px;color:#fff}
</style>`,
  body: `    <main class="sh-home">
      <div class="cp-wrap">
        <section class="cp-hero">
          <div class="cp-avatar" id="creatorAvatar">CR</div>
          <div class="cp-info">
            <h1 id="creatorName">Creator Name</h1>
            <span class="cp-handle" id="creatorHandle">@creator</span>
            <p class="cp-bio" id="creatorBio">Motion graphics designer creating templates for YouTube Shorts and Instagram Reels on ShortsCraft.</p>
            <div class="cp-stats">
              <span class="cp-stat"><b id="creatorTplCount">8</b> Templates</span>
              <span class="cp-stat"><b id="creatorLikes">24.5k</b> Total Likes</span>
              <span class="cp-stat"><b id="creatorFollowers">8.2k</b> Followers</span>
            </div>
          </div>
        </section>

        <section>
          <h2 class="cp-sec-title">Published Templates</h2>
          <div class="sh-gallery" id="creatorGrid" style="padding:0;"></div>
        </section>
      </div>
    </main>`,
  scripts: `<script src="/templates-v2.js?v=9"></script><script src="/creator-profile.js?v=4" defer></script>`
};

/* ── MY UPLOADS ───────────────────────────────────────────── */
/* Was an anchor into /account that showed a permanent empty state: the script
   that fills it looks for #userCreationsGrid, which existed on no page, so a
   creator who had published templates still saw "nothing published yet". */
const uploads = {
  route: "/uploads",
  active: "projects",
  robots: "noindex, follow",
  title: "My uploads — ShortsCraft",
  desc: "The templates you have published to the ShortsCraft community.",
  body: `    <main class="pg">
${pageHead("My uploads", "Templates you have published",
  "Everything here is live in the Community gallery under your creator name and handle.")}

      <section class="pg-sec" id="accountBox" hidden>
        <div class="pg-accsec-head">
          <h2><span id="creationsCount">0 Templates</span> published</h2>
          <button type="button" class="pg-bo pg-accsec-btn js-open-upload">+ Publish a template</button>
        </div>

        <div class="pg-grid" id="userCreationsGrid">
          <article class="pg-card"><h3>Loading…</h3><p>Fetching your published templates.</p></article>
        </div>

        <div class="pg-row" style="margin-top:22px">
          <a href="/editor" class="pg-bw">Open the Studio</a>
          <a href="/community" class="pg-bo">Browse the Community</a>
        </div>
      </section>

${guestGate("/uploads", "Log in to see your uploads", "This page lists the templates you have published to the Community gallery, under your creator name and handle.", ["Every template you publish, in one gallery", "Edit or remove a published template at any time", "Likes and comments from other creators"])}
    </main>`,
  scripts: `<script src="/templates-v2.js?v=9" defer></script>`
};

/* ── DRAFTS & PROJECTS ────────────────────────────────────── */
/* The copy here used to claim the editor kept your timeline between visits.
   It did not — nothing was persisted anywhere. drafts-store.js implements that
   promise, and this page is the list it makes possible. */
const drafts = {
  route: "/drafts",
  active: "projects",
  robots: "noindex, follow",
  title: "Drafts & projects — ShortsCraft",
  desc: "Your saved ShortsCraft animation projects, ready to reopen in the Studio.",
  body: `    <main class="pg">
${pageHead("Drafts & projects", "Your work in progress",
  "The Studio saves every project in this browser as you edit. Reopen one to pick up exactly where you stopped.")}

      <section class="pg-sec">
        <div class="pg-accsec-head">
          <h2>Saved projects <span class="pg-count" id="draftCount">0</span></h2>
          <a href="/editor" class="pg-bo pg-accsec-btn">+ New project</a>
        </div>

        <div class="pg-grid" id="draftGrid">
          <article class="pg-card"><h3>Loading…</h3><p>Reading your saved projects.</p></article>
        </div>

        <p class="pg-fine" id="draftNote" style="margin-top:18px">
          Drafts are stored in this browser, so they do not follow you to another
          device and clearing site data removes them. Publish a scene to keep it
          on your account for good.
        </p>
      </section>
    </main>`,
  scripts: `<script src="/templates-v2.js?v=9"></script><script src="/drafts-store.js?v=${V}" defer></script><script src="/drafts-page.js?v=${V}" defer></script>`
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
              <span class="pg-prof-stars">★ <b id="crStarsCount">48</b></span>
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
            <a href="/uploads" class="pg-cardlink">Open My uploads →</a>
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
  ["seo-tools.html", seoTools],
  ["login.html", authPage("login")],
  ["signup.html", authPage("signup")],
  ["account.html", account],
  ["uploads.html", uploads],
  ["drafts.html", drafts],
  ["settings.html", settings]
];

let n = 0;
for (const [file, p] of PAGES) {
  const html = chrome(p);
  fs.writeFileSync(path.join(OUT, file), html, "utf8");
  console.log(`wrote public/${file}  ${(html.length / 1024).toFixed(1)} KB`);
  n++;
}
console.log(`\n${n} pages built from one chrome.`);
