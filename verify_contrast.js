/* ============================================================
   verify_contrast.js

   page.css and shell.css were written for the dark theme and still carry
   ~158 hard-coded near-white text colours. redesign.css re-themed the
   parts someone happened to look at, so the rest render white-on-white:
   the profile page alone had 42 labels under 4.5:1, most around 1.2 —
   invisible rather than merely faint.

   Fixing those one screen at a time is how the last month went. This
   walks every route in both themes instead and reports what actually
   fails, so the class of bug is closed rather than the instances.

   Reports the element and its class list, which is enough to find the
   owning rule with grep.

   Usage: node verify_contrast.js   [BASE_URL=http://127.0.0.1:3213]
   ============================================================ */
const puppeteer = require("puppeteer");
const db = require("./db");

const BASE = process.env.BASE_URL || "http://localhost:3000";

/* WCAG AA: 4.5:1 for body text, 3:1 once text is large (>=24px, or >=19px
   when bold). Anything inside a template preview is the artwork itself and
   is deliberately excluded. */
/* Every page a person can actually land on, including the bare auth
   screens and the 404. The earlier list covered twelve routes and "many
   places" were still unreadable, because the pages nobody thought to add
   to the list were exactly the pages nobody had looked at. */
const ROUTES = [
  "/", "/pricing", "/community", "/about", "/contact", "/tutorials",
  "/account", "/settings", "/drafts", "/uploads", "/creator", "/editor",
  "/admin", "/template?id=ui-toggle", "/login", "/signup",
  "/forgot-password", "/reset-password", "/privacy", "/terms",
  "/definitely-not-a-page"
];

/* Guest and signed-in render different chrome, and the rail only exists on
   wide screens while the drawer only exists on narrow ones. Auditing one
   combination checks a quarter of the product. */
const VIEWPORTS = [
  { label: "desktop", width: 1440, height: 900 },
  { label: "mobile", width: 390, height: 844 }
];

/* The full sweep is 21 routes across two viewports, two themes and both
   auth states - 168 page loads, which is too slow to sit in the middle of
   `npm test`. QUICK keeps one pass over every route so a regression still
   shows up on every commit; `npm run test:contrast` runs the whole matrix. */
const QUICK = process.env.CONTRAST_QUICK === "1" || process.argv.includes("--quick");

let failures = 0;

function ok(pass, label, extra) {
  if (!pass) failures++;
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${extra !== undefined ? "  (" + extra + ")" : ""}`);
  return pass;
}

const AUDIT = function () {
  const parse = (c) => {
    const m = /^rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/.exec(c || "");
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1
  });

  // The page's own canvas is the backstop when nothing above an element
  // paints an opaque colour.
  const pageBg = parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };

  /* Returns null when something in the stack paints a gradient or image:
     the effective colour behind the text is then whatever pixel it lands
     on, which this cannot know. Reporting a number anyway produced false
     failures for white labels on gradient avatars, so those are skipped
     and left to visual review instead. */
  const bgOf = (el) => {
    let node = el, acc = null;
    while (node && node !== document.documentElement) {
      const cs = getComputedStyle(node);
      if (cs.backgroundImage && cs.backgroundImage !== "none") return null;
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) {
        acc = acc ? over(acc, c) : c;
        if (acc.a >= 0.99) return acc;
      }
      node = node.parentElement;
    }
    return acc ? over(acc, pageBg) : pageBg;
  };

  /* Only one tab panel is visible at a time, so auditing the page as
     rendered silently skipped every pane behind a tab — which is where the
     Stars, plan and support surfaces live. Revealing them first is the
     difference between "the page passes" and "the page passes on the one
     tab that happened to be open". */
  document.querySelectorAll('[role="tabpanel"]').forEach((panel) => {
    if (panel.getBoundingClientRect().height > 0) return;
    /* Removing `hidden` alone was not enough: the panes are also laid out
       by an is-active class, so they stayed display:none and every element
       inside still measured 0x0 - which is exactly what "no failures"
       meant. Forcing display too is what makes the pane real. */
    panel.setAttribute("data-contrast-revealed", panel.hasAttribute("hidden") ? "hidden" : "shown");
    panel.removeAttribute("hidden");
    panel.style.display = "block";
  });

  const out = [];
  /* Measure an element when it owns visible text of its own, even if it also
     contains child elements. The old rule skipped anything with children,
     which silently excluded every icon+label control on the site - the
     "Upload / Publish Template" button was rendering black text on a black
     fill and this audit called the page clean. */
  const ownText = (el) => Array.prototype.some.call(
    el.childNodes,
    (n) => n.nodeType === 3 && n.textContent.trim().length > 0
  );

  document.querySelectorAll("body *").forEach((el) => {
    if (!ownText(el)) return;
    // Template previews are artwork, and their own iframes are sandboxed.
    if (el.closest(".sh-stage, .sh-modal-stage, .sc-publish-preview, iframe, svg")) return;
    // The skip link is parked off-screen until focused; it is a keyboard
    // affordance, not visible text, and measuring it says nothing.
    if (el.closest(".sh-skip, .ed-skip") || el.classList.contains("sh-skip") ||
        el.classList.contains("ed-skip")) return;

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || +cs.opacity === 0) return;

    const fg = parse(cs.color);
    if (!fg || fg.a === 0) return;
    const bg = bgOf(el);
    if (!bg) return;
    const text = over(fg, bg);

    const L1 = lum(text), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);

    const size = parseFloat(cs.fontSize) || 16;
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;

    if (ratio < need) {
      out.push({
        text: el.textContent.trim().slice(0, 34),
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || "").slice(0, 44),
        ratio: +ratio.toFixed(2),
        need
      });
    }
  });

  document.querySelectorAll('[data-contrast-revealed]').forEach((panel) => {
    if (panel.getAttribute("data-contrast-revealed") === "hidden") panel.setAttribute("hidden", "");
    panel.style.display = "";
    panel.removeAttribute("data-contrast-revealed");
  });
  return out;
};

/* Signed-in surfaces have to be audited with a real session.

   The first version called SC_AUTH.paint() to fake one. The page then made
   its own /api/auth/me request, got no user back, and re-hid the whole
   account panel - so every element inside it measured zero and was skipped.
   The audit reported PASS over a profile page whose "New request" button
   was dark-on-dark and whose "Sign out" heading was white-on-white. A check
   that quietly measures nothing is worse than no check. */
const TEST_EMAIL = `contrast_${Date.now()}@example.invalid`;
const TEST_PASSWORD = "contrast-audit-1234";

async function cleanup() {
  await db.tx(async (client) => {
    await client.query(
      `delete from public.sessions
        where user_id in (select id from public.users where lower(email) = $1)`,
      [TEST_EMAIL]
    );
    await client.query(`delete from public.users where lower(email) = $1`, [TEST_EMAIL]);
  });
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 45000 });
  const signedIn = await page.evaluate(async (creds) => {
    const r = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: creds.email, password: creds.password, handle: creds.handle })
    });
    const j = await r.json().catch(() => ({}));
    return j && j.success === true;
  }, { email: TEST_EMAIL, password: TEST_PASSWORD, handle: "ctr" + Date.now().toString().slice(-8) });
  ok(signedIn, "audit runs against a real signed-in session");

  const seen = new Set();
  const authStates = QUICK ? [true] : [true, false];
  const viewports = QUICK ? [VIEWPORTS[0]] : VIEWPORTS;
  const themes = QUICK ? ["light"] : ["light", "dark"];
  for (const signedIn of authStates) {
    if (!signedIn) {
      await page.evaluate(async () => {
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      });
    }
    for (const vp of viewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      for (const theme of themes) {
        console.log(`
---- ${theme} · ${vp.label} · ${signedIn ? "signed in" : "guest"} ----`);
        for (const route of ROUTES) {
          await page.goto(BASE + route, { waitUntil: "networkidle2", timeout: 45000 }).catch(() => {});
          await page.evaluate((t) => {
            document.documentElement.setAttribute("data-theme", t);
          }, theme);
          // Long enough for the account panel to paint from the real session.
          await new Promise((r) => setTimeout(r, 1000));

          const bad = await page.evaluate(AUDIT);
          const label = route.split("?")[0].padEnd(24);
          ok(bad.length === 0, `${label} text meets contrast`,
            bad.length
              ? bad.slice(0, 5).map((b) => `${b.cls || b.tag}:${b.ratio}`).join(" ") +
                (bad.length > 5 ? ` +${bad.length - 5}` : "")
              : 0);
          bad.forEach((b) => {
            /* One line per distinct offender, not per instance: a handle that
               repeats under sixty cards is one rule to fix, not sixty. */
            const key = `${b.cls}|${b.tag}|${b.ratio}`;
            if (seen.has(key)) return;
            seen.add(key);
            console.log(`          ${String(b.ratio).padStart(5)} need ${b.need}  <${b.tag} class="${b.cls}">  ${JSON.stringify(b.text)}`);
          });
        }
      }
    }
  }

  await browser.close();
  await cleanup().catch(() => {});
  console.log(`\nCONTRAST=${failures === 0 ? "PASS" : "FAIL"}${failures ? " (" + failures + " failing)" : ""}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch(async (e) => {
  await cleanup().catch(() => {});
  console.error("HARNESS FAIL:", e.message);
  process.exit(1);
});
