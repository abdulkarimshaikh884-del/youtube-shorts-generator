/* ============================================================
   audit_overlap.js — does anything sit on top of anything else?

   The contrast audit answers "can this text be read against what is
   behind it". It says nothing about whether one box is covering another,
   whether a label is being cut off by its own container, or whether
   content has escaped the panel it belongs to. Those are the failures a
   person notices immediately and no test here was looking for.

   Three checks, on every page, at desktop and phone width, signed in:

     CLIPPED   text wider or taller than the box holding it, where that
               box hides the overflow - the label is being cut off.
     ESCAPED   an element whose painted box sticks out past its parent's,
               ignoring the ones that are meant to (fixed rails, dialogs,
               anything absolutely positioned).
     COLLIDED  two elements in normal flow whose boxes overlap. Overlays
               and sticky bars overlap by design and are excluded; what is
               left is a real collision.

   Usage: node audit_overlap.js   [BASE_URL=http://localhost:3000]
   ============================================================ */
require("dotenv").config();
const puppeteer = require("puppeteer");
const db = require("./db");

const BASE = process.env.BASE_URL || "http://localhost:3000";

const ROUTES = [
  "/", "/pricing", "/community", "/about", "/contact", "/tutorials",
  "/account", "/settings", "/drafts", "/uploads", "/creator?handle=shortscraft",
  "/template?id=ui-toggle", "/login", "/signup", "/privacy", "/terms",
  "/definitely-not-a-page"
];

const VIEWPORTS = [
  { label: "desktop", width: 1440, height: 900 },
  { label: "phone", width: 390, height: 844 }
];

const EMAIL = `overlap_${Date.now()}@example.invalid`;
let failures = 0;

function ok(pass, label, extra) {
  if (!pass) failures++;
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${extra !== undefined ? "  (" + extra + ")" : ""}`);
}

async function cleanup() {
  await db.tx(async (c) => {
    await c.query(`delete from public.sessions where user_id in
      (select id from public.users where lower(email) = $1)`, [EMAIL]);
    await c.query(`delete from public.users where lower(email) = $1`, [EMAIL]);
  });
}

const AUDIT = function () {
  const out = { clipped: [], escaped: [], collided: [] };
  const name = (el) => {
    const cls = String(el.className || "").split(/\s+/).filter(Boolean).slice(0, 2).join(".");
    return el.tagName.toLowerCase() + (cls ? "." + cls : "");
  };
  const label = (el) => (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 34);

  const all = [...document.querySelectorAll("body *")].filter((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) return false;
    // Template previews are sandboxed artwork; the editor stage is a canvas.
    if (el.closest(".sh-stage, .sh-modal-stage, iframe, svg")) return false;
    /* An element part-way through an entrance animation is mid-transform, and
       its box is not where it will settle. Measuring one produced a dialog
       button reported as clipped by 266px that measures exactly right once
       the animation ends. */
    if (typeof el.getAnimations === "function" &&
        el.getAnimations({ subtree: true }).some((a) => a.playState === "running")) return false;
    return true;
  });

  for (const el of all) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();

    /* CLIPPED — the element hides its own overflow and its content does not
       fit. Deliberate line-clamping sets -webkit-line-clamp, so that is not
       a defect; a single line cut off mid-word is. */
    const hidesX = cs.overflowX === "hidden" || cs.overflow === "hidden";
    const hidesY = cs.overflowY === "hidden" || cs.overflow === "hidden";
    const clamped = cs.webkitLineClamp && cs.webkitLineClamp !== "none";
    const ellipsis = cs.textOverflow === "ellipsis";
    if (!clamped && !ellipsis && el.textContent.trim()) {
      if (hidesX && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
        out.clipped.push({ el: name(el), text: label(el), by: el.scrollWidth - el.clientWidth, axis: "x" });
      } else if (hidesY && el.scrollHeight > el.clientHeight + 3 && el.clientHeight > 0) {
        out.clipped.push({ el: name(el), text: label(el), by: el.scrollHeight - el.clientHeight, axis: "y" });
      }
    }

    /* ESCAPED — sticking out of the parent box. Positioned elements are
       supposed to; a static child is not. */
    const parent = el.parentElement;
    if (parent && parent !== document.body && cs.position === "static") {
      const pcs = getComputedStyle(parent);
      const pr = parent.getBoundingClientRect();
      const pClips = pcs.overflow !== "visible";
      if (!pClips && pr.width > 2 && pr.height > 2) {
        const outRight = Math.round(r.right - pr.right);
        const outLeft = Math.round(pr.left - r.left);
        if (outRight > 4 || outLeft > 4) {
          out.escaped.push({ el: name(el), parent: name(parent), text: label(el), by: Math.max(outRight, outLeft) });
        }
      }
    }
  }

  /* COLLIDED — siblings in normal flow whose boxes intersect. Anything
     positioned, or inside a positioned ancestor that is meant to float over
     the page, is excluded, because overlapping is the whole point there. */
  const flow = all.filter((el) => {
    const cs = getComputedStyle(el);
    if (cs.position !== "static" && cs.position !== "relative") return false;
    /* Inline elements that share a wrapped paragraph have overlapping
       bounding boxes as a matter of course - a <b> at the end of one line
       and the text continuing on the next produce rects that intersect
       without anything being drawn on top of anything. Only block-level
       siblings can genuinely collide. */
    if (cs.display === "inline") return false;
    if (el.closest("[hidden], dialog, .sh-modal-overlay, .sh-notification-panel, .sh-csel-menu, #navMobile, .sh-topbar, .sh-rail")) return false;
    return el.parentElement && el.children.length === 0 && el.textContent.trim().length > 0;
  });
  for (let i = 0; i < flow.length; i++) {
    for (let j = i + 1; j < flow.length; j++) {
      const a = flow[i], bEl = flow[j];
      if (a.contains(bEl) || bEl.contains(a)) continue;
      if (a.parentElement !== bEl.parentElement) continue;
      const ra = a.getBoundingClientRect(), rb = bEl.getBoundingClientRect();
      const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (ox > 3 && oy > 3) {
        out.collided.push({ a: name(a), b: name(bEl), text: label(a), area: Math.round(ox * oy) });
      }
    }
  }
  return out;
};

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.evaluate(async (c) => {
    await fetch("/api/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c)
    });
  }, { email: EMAIL, password: "overlap-pass-1234", handle: "ovl" + Date.now().toString().slice(-8) });

  const seen = new Set();
  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height });
    console.log(`\n---- ${vp.label} (${vp.width}px) ----`);
    for (const route of ROUTES) {
      await page.goto(BASE + route, { waitUntil: "networkidle2", timeout: 45000 }).catch(() => {});
      /* The gallery mounts 59 preview iframes lazily, and a card measured
         mid-mount reports an overflow that is gone a second later. Wait for
         the layout to stop moving instead of guessing at a delay. */
      await page.waitForFunction(() => {
        const t = document.querySelector(".sh-tile");
        if (!t) return true;
        const w = t.clientWidth;
        if (window.__lastW === w && window.__stable) return true;
        window.__stable = window.__lastW === w;
        window.__lastW = w;
        return false;
      }, { timeout: 12000, polling: 400 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 900));
      const bad = await page.evaluate(AUDIT);
      const total = bad.clipped.length + bad.escaped.length + bad.collided.length;
      ok(total === 0, `${route.split("?")[0].padEnd(24)} nothing clipped, escaped or colliding`,
        total ? `${bad.clipped.length} clipped · ${bad.escaped.length} escaped · ${bad.collided.length} colliding` : 0);

      const report = (kind, list, fmt) => list.forEach((x) => {
        const key = kind + "|" + JSON.stringify(x).slice(0, 90);
        if (seen.has(key)) return;
        seen.add(key);
        console.log("        " + fmt(x));
      });
      report("clip", bad.clipped, (x) => `CLIPPED  ${x.el} by ${x.by}px (${x.axis})  ${JSON.stringify(x.text)}`);
      report("esc", bad.escaped, (x) => `ESCAPED  ${x.el} out of ${x.parent} by ${x.by}px  ${JSON.stringify(x.text)}`);
      report("col", bad.collided, (x) => `COLLIDED ${x.a} over ${x.b} (${x.area}px²)  ${JSON.stringify(x.text)}`);
    }
  }

  await browser.close();
  await cleanup().catch(() => {});
  console.log(`\nOVERLAP=${failures === 0 ? "PASS" : "FAIL"}${failures ? " (" + failures + " page/viewport combinations)" : ""}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch(async (e) => {
  await cleanup().catch(() => {});
  console.error("HARNESS FAIL:", e.message);
  process.exit(1);
});
