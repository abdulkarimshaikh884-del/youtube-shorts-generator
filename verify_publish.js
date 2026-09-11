/* Publishing has to keep what was edited.

   The editor's unit of work is a clip: a template id plus a `props` object
   holding every field the person changed, plus the aspect they composed at.
   For a long time publish sent, and the table stored, only tpl/lines/accent/
   font/dur — so a creator could publish an hour's work, reopen it from the
   gallery, and find the template's defaults looking back at them. Nothing
   errored; the detail page simply rebuilt from the little that survived.

   These assertions are the ones that fail first if any link in that chain
   drops props or aspect again: the editor payload, the insert, the row, the
   single-template read, and the gallery listing. */
require("dotenv").config();
const crypto = require("node:crypto");
const auth = require("./auth");
const db = require("./db");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const users = [];
let failures = 0;

function ok(condition, label, detail) {
  if (!condition) failures++;
  console.log(`  ${condition ? "PASS" : "FAIL"}  ${label}${detail !== undefined ? "  (" + detail + ")" : ""}`);
}

async function fixture() {
  const suffix = crypto.randomBytes(6).toString("hex");
  const headers = {};
  const res = {
    getHeader: (k) => headers[k.toLowerCase()],
    setHeader: (k, v) => { headers[k.toLowerCase()] = v; }
  };
  const out = await auth.signUp(res, `publish-${suffix}@example.invalid`,
    "Publish-test-password-23", `pub_${suffix}`);
  if (!out.user) throw new Error(out.error || "signup failed");
  const user = { ...out.user, cookie: String(headers["set-cookie"]).split(";")[0] };
  users.push(user);
  return user;
}

const call = async (user, method, route, body) => {
  const r = await fetch(BASE + route, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { Cookie: user.cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000)
  });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};

(async () => {
  try {
    const author = await fixture();

    // A spread of the kinds of thing props actually carries: text the fields
    // wrote, an image reference, a numeric layout choice, a per-element colour.
    const PROPS = {
      line0: "EDITED HEADLINE",
      line1: "second line the creator wrote",
      bgImage: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
      contentScale: 1.35,
      badgeColor: "#ff5522"
    };

    console.log("\n---- publishing keeps the edit ----");
    const made = await call(author, "POST", "/api/community-templates", {
      title: "Props round trip", category: "text", description: "checks props survive",
      tpl: "text-cascade", lines: [PROPS.line0, PROPS.line1, ""],
      props: PROPS, aspect: "16:9", accent: "#22ddaa", font: "grotesk", dur: 5200
    });
    ok(made.status === 200 && made.data.success, "a template publishes", made.status);
    const id = made.data.template && made.data.template.id;
    const returned = made.data.template || {};
    ok(returned.props && returned.props.bgImage === PROPS.bgImage,
      "the publish response returns props",
      JSON.stringify(Object.keys(returned.props || {})));
    ok(returned.aspect === "16:9", "and the aspect it was composed at", returned.aspect);

    console.log("\n---- what a visitor with no account reads back ----");
    const got = await call(null, "GET", "/api/community-templates/" + encodeURIComponent(id));
    const t = got.data.template || {};
    ok(t.props && t.props.line0 === PROPS.line0, "the edited text", t.props && t.props.line0);
    ok(t.props && t.props.bgImage === PROPS.bgImage, "the uploaded image reference");
    ok(t.props && t.props.contentScale === 1.35, "the layout scale", t.props && t.props.contentScale);
    ok(t.props && t.props.badgeColor === PROPS.badgeColor, "the per-element colour");
    ok(t.aspect === "16:9", "the aspect", t.aspect);

    // The home gallery renders from the listing, not the single-template read,
    // so it has to carry props too or cards render from defaults.
    const list = await call(null, "GET", "/api/community-templates");
    const inList = (list.data.templates || []).find((x) => x.id === id);
    ok(inList && inList.props && inList.props.contentScale === 1.35,
      "the gallery listing carries props as well", inList ? "found" : "missing");

    console.log("\n---- limits ----");
    const huge = await call(author, "POST", "/api/community-templates", {
      title: "Too big", category: "text", tpl: "text-cascade", lines: ["a"],
      props: { blob: "x".repeat(500_000) }, aspect: "9:16"
    });
    ok(huge.status >= 400,
      "a template carrying megabytes of embedded data is refused", huge.status);

    const badAspect = await call(author, "POST", "/api/community-templates", {
      title: "Bad aspect", category: "text", tpl: "text-cascade", lines: ["a"],
      props: {}, aspect: "3:7"
    });
    ok(badAspect.status === 200 && badAspect.data.template.aspect === "9:16",
      "an aspect the composer cannot produce falls back rather than being stored",
      badAspect.data.template && badAspect.data.template.aspect);
  } catch (err) {
    failures++;
    console.error("HARNESS FAIL:", err.message);
  } finally {
    try {
      for (const u of users) {
        await db.tx(async (c) => {
          await c.query("delete from public.community_templates where author_id = $1", [u.id]);
          await c.query("delete from public.sessions where user_id = $1", [u.id]);
          await c.query("delete from public.users where id = $1", [u.id]);
        });
      }
      await db.getPool().end();
    } catch (err) {
      console.error("cleanup failed:", err.message);
    }
  }

  console.log(`\nPUBLISH=${failures === 0 ? "PASS" : "FAIL"}${failures ? " (" + failures + " failing)" : ""}`);
  process.exit(failures === 0 ? 0 : 1);
})();
