/* ============================================================
   build_pages.js — generates every non-app page from ONE shell chrome.
   Nothing here reuses the legacy site: pages load only shell.css + page.css
   and page.js. Run:  node build_pages.js
   ============================================================ */
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "public");
const V = "20260808";

const NAV = [
  { href: "/#templates", label: "Templates", key: "templates",
    icon: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>' },
  { href: "/account", label: "My Projects", key: "projects",
    icon: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>' },
  { href: "/community", label: "Community", key: "community",
    icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
  { href: "/contact", label: "Tutorials & Help", key: "contact",
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
  return `
<main class="pg-screen">
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
</main>

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
<link rel="stylesheet" href="/shell.css?v=3">
<link rel="stylesheet" href="/page.css?v=${V}">
${p.head || ""}</head>
`;

  // a bare page (log in / sign up) has no sidebar, top bar or footer
  if (p.bare) return head + `<body class="sh-body pg-bare">` + BARE(p, V);

  return head + `<body class="sh-body">

<div class="sh-wrap">

  <aside class="sh-rail">
    <a href="/" class="sh-brand" aria-label="ShortsCraft home">
      <span class="sh-brand-mark"><img src="/favicon.svg?v=20260725" width="22" height="22" alt=""></span>
      <span class="sh-brand-name">Shorts<i>Craft</i></span>
    </a>

    <div class="sh-social">
      <a href="https://youtube.com/@VaultGamer-in" rel="noopener" target="_blank" aria-label="YouTube">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23 12s0-3.9-.5-5.8a3 3 0 0 0-2.1-2.1C18.5 3.5 12 3.5 12 3.5s-6.5 0-8.4.6A3 3 0 0 0 1.5 6.2C1 8.1 1 12 1 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 8.4.6 8.4.6s6.5 0 8.4-.6a3 3 0 0 0 2.1-2.1C23 15.9 23 12 23 12ZM9.8 15.5v-7l6 3.5-6 3.5Z"/></svg>
      </a>
      <a href="https://instagram.com/tech_vault_in" rel="noopener" target="_blank" aria-label="Instagram">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
      </a>
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
        <a href="/pricing">Upgrade to Pro · ₹99/mo — Upgrade ↗</a>
      </div>
    </div>
  </aside>

  <div class="sh-main">

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
          <h4>Product</h4>
          <a href="/editor">Studio Editor</a>
          <a href="/#templates">Templates Gallery</a>
          <a href="/community">Community Hub</a>
          <a href="/pricing">Pricing</a>
        </nav>

        <nav class="sh-fcol" aria-label="Legal and support">
          <h4>Legal &amp; Support</h4>
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
  desc: `ShortsCraft pricing: Free with ${P.free.perDay} credits a day, Pro at ₹99 with ${P.pro.perDay} a day, Pro Max at ₹199 with ${P.promax.perDay} a day. Exporting a template costs ${C.export} credit, a custom AI animation costs ${C.animate}.`,
  body: `    <main class="pg">
${pageHead("Pricing", "Three plans. One currency: credits.",
    `Everything you do that costs us money costs credits — exporting a template is ${C.export} credit, generating a brand-new animation from your prompt is ${C.animate}. Credits refill every day.`)}

      <div class="pg-plans pg-plans3">
        <article class="pg-plan">
          <span class="pg-tier">${P.free.label}</span>
          <div class="pg-amt">₹0</div>
          <p class="pg-planline"><b>${P.free.perDay} credits every day</b> — enough for ${P.free.perDay} template exports, or ${Math.floor(P.free.perDay / C.animate)} AI animations.</p>
          <ul>
            <li>All 12 motion templates</li>
            <li>Custom AI animations from your prompt</li>
            <li>Attach an image to animate</li>
            <li>MP4 export up to 1080p</li>
            <li>No card required</li>
          </ul>
          <a href="/editor" class="pg-bo">Start free</a>
        </article>

        <article class="pg-plan pg-hot">
          <span class="pg-tier">${P.pro.label} · Most popular</span>
          <div class="pg-amt">₹${P.pro.price}<small>/month</small></div>
          <p class="pg-planline"><b>${P.pro.perDay} credits every day</b> — about ${Math.floor(P.pro.perDay / C.animate)} AI animations a day.</p>
          <ul>
            <li>Everything in Free</li>
            <li>${P.pro.perDay} credits per day</li>
            <li>Priority AI speed</li>
            <li>1440p export</li>
            <li>Cancel any time</li>
          </ul>
          <a href="/contact" class="pg-bw">Upgrade to Pro</a>
        </article>

        <article class="pg-plan">
          <span class="pg-tier">${P.promax.label}</span>
          <div class="pg-amt">₹${P.promax.price}<small>/month</small></div>
          <p class="pg-planline"><b>${P.promax.perDay} credits every day</b> — for teams and daily publishers.</p>
          <ul>
            <li>Everything in Pro</li>
            <li>${P.promax.perDay} credits per day</li>
            <li>Longest multi-clip sequences</li>
            <li>The Pro AI model for scene generation</li>
            <li>First access to new templates</li>
          </ul>
          <a href="/contact" class="pg-bo">Upgrade to Pro Max</a>
        </article>
      </div>
      <p class="pg-fine pg-center">Payments are processed by Razorpay — UPI, cards, netbanking and wallets. Credits reset daily at 00:00 UTC and do not stack up.</p>

      <section class="pg-sec">
        <h2>What a credit buys</h2>
        <div class="pg-grid">
          <article class="pg-card"><h3>${C.export} credit · Export a template</h3><p>Any of the 12 motion templates, edited however you like, rendered to a real MP4 at up to 1440p. Editing and previewing are free — you are only charged when you export.</p></article>
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
    </main>`
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
          <li><strong>Pick a template</strong> from twelve motion pieces across eight categories.</li>
          <li><strong>Edit the content</strong> — the fields are named for what the animation actually shows, so a progress ring asks for a percentage, not a paragraph.</li>
          <li><strong>Build a sequence</strong> on the timeline. Each clip has its own template, text, accent and duration.</li>
          <li><strong>Export a real MP4.</strong> Headless Chrome renders the animation frame by frame and ffmpeg encodes H.264 — deterministic timing, no screen recording, no dropped frames.</li>
        </ol>

        <h2>What the AI does and does not do</h2>
        <p>The AI writes: scripts, titles, descriptions, hashtags, follow-up ideas and thumbnail prompts, in Hinglish. The motion is not AI-generated — it is deterministic CSS, which is why the same project exports identically every time.</p>
        <p>Everything it writes is a first draft. Review it, make it yours, then publish. That is also the platform-safe way to work.</p>

        <h2>Who builds this</h2>
        <p>ShortsCraft is an independent product built for Indian creators, from the same workshop as the <a href="https://youtube.com/@VaultGamer-in" rel="noopener" target="_blank">Vault Gamer</a> channel. Feature requests reach a human: use <a href="/contact">Help &amp; Feedback</a>.</p>
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
            <h3>Reporting a bug?</h3>
            <p>Please include the page URL, your device and browser, and the template or clip you were working on. That usually turns a two-day guess into a same-day fix.</p>
          </section>
          <section class="pg-card">
            <h3>Requesting a template?</h3>
            <p>Describe the <em>object</em> you want animated — a switch, a chart, a phone screen, a card — plus where you would use it. Object ideas get built; "make it look premium" cannot.</p>
          </section>
          <section class="pg-card">
            <h3>Elsewhere</h3>
            <p>
              <a href="https://youtube.com/@VaultGamer-in" rel="noopener" target="_blank">YouTube · @VaultGamer-in</a><br>
              <a href="https://instagram.com/tech_vault_in" rel="noopener" target="_blank">Instagram · @tech_vault_in</a>
            </p>
          </section>
          <section class="pg-card">
            <h3>Response time</h3>
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
  body: `    <main class="pg pg-narrow">
      <section class="pg-head">
        <span class="pg-eyebrow">Account</span>
        <h1>Your account</h1>
        <p>Plan, credits and sign-out live here.</p>
      </section>

      <section class="pg-sec" id="accountBox" hidden>
        <div class="pg-grid">
          <article class="pg-card"><h3>Email</h3><p id="accEmail">—</p></article>
          <article class="pg-card"><h3>Plan</h3><p id="accPlan">—</p></article>
          <article class="pg-card"><h3>Credits today</h3><p id="accCredits">—</p></article>
          <article class="pg-card"><h3>Member since</h3><p id="accSince">—</p></article>
        </div>
        <div class="pg-row" style="margin-top:20px">
          <a href="/editor" class="pg-bw">Open the Editor</a>
          <a href="/pricing" class="pg-bo">Change plan</a>
          <button type="button" class="pg-bo" id="accLogout">Log out</button>
        </div>

        <div style="margin-top:38px;padding-top:28px;border-top:1px solid var(--line);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
            <h2 style="font-family:var(--display);font-size:20px;font-weight:700;margin:0;">Your Community Templates</h2>
            <a href="/editor" class="pg-bo" style="font-size:12.5px;height:34px;padding:0 14px;">+ Create New</a>
          </div>
          <div class="pg-grid" id="accTplGrid">
            <article class="pg-card">
              <h3>Create & Publish Templates</h3>
              <p>Design animated motion pieces in the Studio editor and click "Publish Template" in the top bar to share with creators worldwide.</p>
              <a href="/editor" style="display:inline-block;margin-top:10px;font-weight:650;">Open Studio Editor →</a>
            </article>
          </div>
        </div>
      </section>

      <section class="pg-sec" id="accountGuest" hidden>
        <p class="pg-planline">You are not logged in. Credits are attached to this browser only.</p>
        <div class="pg-row">
          <a href="/login" class="pg-bw">Log in</a>
          <a href="/signup" class="pg-bo">Create an account</a>
        </div>
      </section>
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
          <a href="/editor" class="sh-imgbtn" title="Open Video Studio timeline">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </a>
          <button class="sh-imgchip" type="button" id="composerImgClear" hidden>
            <span id="composerImgName">image</span> <b>×</b>
          </button>
          <div class="sh-custom-select" id="qualityDropdown">
            <input type="hidden" name="quality" id="qualitySelect" value="mini">
            <button type="button" class="sh-csel-btn" id="qualityBtn" aria-haspopup="listbox" aria-expanded="false" aria-label="Model tier: Free">
              <span class="sh-csel-sparkle">✦</span>
              <span class="sh-csel-val" id="qualityVal">Free (5 credits)</span>
              <svg class="sh-csel-arrow" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div class="sh-csel-menu" id="qualityMenu" role="listbox" hidden>
              <div class="sh-csel-opt selected" role="option" data-val="mini" aria-selected="true">
                <div class="sh-csel-opt-main"><b>✦ Free</b><span>Fast standard generation · 5 credits</span></div>
                <svg class="sh-csel-check" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <div class="sh-csel-opt" role="option" data-val="pro" aria-selected="false">
                <div class="sh-csel-opt-main"><b>✦ Pro</b><span>Priority speed & detailed motion · 10 credits</span></div>
                <svg class="sh-csel-check" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <div class="sh-csel-opt" role="option" data-val="max" aria-selected="false">
                <div class="sh-csel-opt-main"><b>✦ Pro Max</b><span>Max fidelity & complex layouts · 15 credits</span></div>
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
          <div class="sh-ghead-top">
            <div class="sh-search-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" id="tplSearch" placeholder="Search 80+ motion templates..." autocomplete="off">
              <button type="button" id="tplSearchClear" hidden>×</button>
            </div>
            <div class="sh-ratio-switch" id="ratioSwitch" role="group" aria-label="Aspect Ratio Filter">
              <button type="button" class="sh-rchip active" data-ar="9:16" aria-pressed="true">9:16</button>
              <button type="button" class="sh-rchip" data-ar="16:9" aria-pressed="false">16:9</button>
              <button type="button" class="sh-rchip" data-ar="1:1" aria-pressed="false">1:1</button>
              <button type="button" class="sh-rchip" data-ar="4:5" aria-pressed="false">4:5</button>
            </div>
          </div>
          <div class="sh-filters-wrap">
            <button type="button" class="sh-fnav-btn prev" id="fnavPrev" aria-label="Scroll left">‹</button>
            <div class="sh-filters" id="filters"></div>
            <button type="button" class="sh-fnav-btn next" id="fnavNext" aria-label="Scroll right">›</button>
          </div>
        </div>
        <div class="sh-gallery" id="gallery" data-ar="9:16"></div>
      </section>

      <section class="sh-workflow-sec">
        <div class="sh-section-head">
          <span class="sh-eyebrow">✦ 3-Step Motion Engine</span>
          <h2>How ShortsCraft Works</h2>
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
  scripts: `<script src="/templates-v2.js?v=4" defer></script><script src="/shell.js?v=4" defer></script>`
};

/* ── write ────────────────────────────────────────────────── */
const PAGES = [
  ["index.html", indexPage],
  ["pricing.html", pricing],
  ["about.html", about],
  ["contact.html", contact],
  ["privacy.html", privacy],
  ["terms.html", terms],
  ["404.html", notfound],
  ["seo-tools.html", seoTools],
  ["login.html", authPage("login")],
  ["signup.html", authPage("signup")],
  ["account.html", account]
];

let n = 0;
for (const [file, p] of PAGES) {
  const html = chrome(p);
  fs.writeFileSync(path.join(OUT, file), html, "utf8");
  console.log(`wrote public/${file}  ${(html.length / 1024).toFixed(1)} KB`);
  n++;
}
console.log(`\n${n} pages built from one chrome.`);
