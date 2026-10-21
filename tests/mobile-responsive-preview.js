"use strict";

// Loopback-only presentation fixture. It never boots server.js, reads dotenv,
// connects to a DB, logs in, invokes a model or accepts API mutations. Only two
// fixed anonymous public-catalog GETs are made, once at startup, into memory.
const express = require("express");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const publicRoot = path.join(root, "public");
const accountRoutes = new Set(Object.values(require("../public/account-routes")));
const app = express();
const port = 3392;
const stamp = "2026-10-21T09:00:00.000Z";
const boundary = "UI layout fixture only; synthetic owner/account/admin data; public catalog GET cache; all API writes denied";
const owner = {id: "mobile-preview-owner", email: "preview@example.invalid", handle: "@preview",
  displayName: "Preview Creator", display_name: "Preview Creator", role: "super_admin",
  plan: "free", verified: true, emailVerified: true, followers: 2, following: 1,
  bio: "Synthetic account for mobile layout review. No real account or billing records.",
  createdAt: stamp, memberSince: stamp, permissions: []};
const person = {id: "mobile-preview-member", email: "member@example.invalid", handle: "@preview_member",
  displayName: "Preview Member", role: "user", plan: "free", verified: false, credits: 5,
  totalStars: 0, earnedStars: 0, withdrawnStars: 0, templateCount: 1, createdAt: stamp};
// Match social.listFollows() rather than unrelated admin-account field names.
const people = [{...person, published: 1, followedByViewer: false, isViewer: false},
  {...person, id: "mobile-preview-long-name", published: 3, followedByViewer: true, isViewer: false,
    displayName: "Preview Creator With A Longer Display Name", handle: "@long_preview_creator"}];
const referralCode = "PREVIEWCODE12345";
if (!/^[A-Za-z0-9_-]{16}$/.test(referralCode)) throw Error("Invalid read-only preview referral code");
const credits = {plan: "free", planLabel: "Free", left: 5, dailyLeft: 5, perDay: 5,
  bonusCredits: 0, maxHeight: 480, watermark: true, cost: {animate: 2, export: 1}};
const ticket = {id: "preview-ticket", reference: "PREVIEW-001", email: "preview@example.invalid",
  subject: "Preview support question about mobile export and editable templates", category: "feedback",
  status: "open", createdAt: stamp, updatedAt: stamp, messageCount: 2,
  messages: [{id: "preview-message-1", role: "user", authorName: "Preview Creator", createdAt: stamp,
    body: "This is a synthetic support thread used only to review a long message on a narrow screen. No support request was sent."},
  {id: "preview-message-2", role: "staff", authorName: "Preview Support", createdAt: stamp,
    body: "This fixture reply checks wrapping and final controls. All replies and other writes are disabled in this preview."}]};
const publication = {id: "comm_aabbccddeeff0011", title: "Preview kinetic title template",
  tpl: "original-chat-story", lines: ["PREVIEW", "Make an idea move", "UI layout fixture"],
  props: {}, accent: "#2563eb", font: "inter", dur: 5000, aspect: "9:16", category: "text",
  authorName: owner.displayName, authorHandle: owner.handle, authorVerified: true,
  status: "published", createdAt: stamp, downloads: 0, likes: 0, sourceFormat: "native"};
const project = {id: "d_preview_mobile", name: "Preview animation project", aspect: "9:16",
  createdAt: Date.parse(stamp), updatedAt: Date.parse(stamp),
  clips: [{id: "preview-clip", tpl: publication.tpl, lines: publication.lines,
    props: {}, accent: publication.accent, font: "inter", dur: 5000}]};
const designProject = {id: "dp_previewmobile", name: "Preview native editable design", revision: "preview-revision-1",
  canvas: {width: 1280, height: 720}, source: {type: "scratch"}, backgroundColor: "#0f172a",
  elements: [{id: "preview-bg", type: "shape", name: "Backdrop", shape: "rectangle", x: 0, y: 0,
    width: 1280, height: 720, fill: "#0f172a", zIndex: 0, locked: true},
  {id: "preview-title", type: "text", name: "Editable title", text: "MAKE IDEAS MOVE", x: 90, y: 250,
    fontSize: 90, fontFamily: "Inter", fontWeight: 800, fill: "#ffffff", zIndex: 1}]};
const notifications = [
  {id: "preview-note-1", type: "system", message: "Your preview template is ready to customize. This is synthetic UI data.", createdAt: stamp, read: false, url: "/drafts"},
  {id: "preview-note-2", type: "follow", entityType: "creator", message: "started following your work.", createdAt: stamp, read: true,
    actor: {displayName: "Preview Creator With A Longer Name", handle: "preview_member", verified: false}},
  {id: "preview-note-3", type: "support_reply", entityType: "support_ticket", message: "replied to your preview support question about export.", createdAt: stamp, read: true, url: "/account/support"}
];
const catalogs = {designs: [], skills: [], failures: []};

function json(res, data, status = 200) {
  return res.status(status).json({success: status < 400, fixture: true, evidenceBoundary: boundary, ...data});
}
function isGuest(req) {return /(?:^|;\s*)sc_mobile_preview=guest(?:;|$)/.test(req.headers.cookie || "");}
function safeNext(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  try {const u = new URL(value, "http://127.0.0.1:" + port); return u.origin === "http://127.0.0.1:" + port ? u.pathname + u.search + u.hash : "/";} catch {return "/";}
}

app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.set({"Cache-Control": "no-store", "X-ShortsCraft-Preview": "read-only-mobile-layout-fixture",
    "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer"});
  next();
});
// No body parser exists. Every non-GET API method is refused before any route.
app.use("/api", (req, res, next) => req.method === "GET" ? next() : json(res,
  {error: "Read-only UI preview: login, save, upload, generation, payment and account writes are disabled."}, 405));
app.get("/preview-guest", (req, res) => {
  res.setHeader("Set-Cookie", "sc_mobile_preview=guest; Path=/; HttpOnly; SameSite=Strict");
  res.redirect(302, safeNext(req.query.next));
});
app.get("/preview-owner", (req, res) => {
  res.setHeader("Set-Cookie", "sc_mobile_preview=owner; Path=/; HttpOnly; SameSite=Strict");
  res.redirect(302, safeNext(req.query.next));
});
app.get("/preview-info", (_req, res) => json(res, {mode: "read-only", bind: "127.0.0.1", port,
  publicCatalog: {designs: catalogs.designs.length, skills: catalogs.skills.length, failures: catalogs.failures},
  guestEntry: "/preview-guest?next=/login", ownerEntry: "/preview-owner?next=/account"}));

app.get("/api/*", (req, res) => {
  const route = req.path, guest = isGuest(req);
  if (route === "/api/auth/me") return json(res, {user: guest ? null : owner});
  if (route === "/api/credits") return json(res, credits);
  if (route === "/api/auth/google/config") return json(res, {enabled: false});
  if (route === "/api/config") return json(res, {release: {monetizationEnabled: false, moneyStatus: "coming_soon"},
    services: {ai: false, auth: false, payments: false, referrals: false}, cost: credits.cost,
    freeCreditsPerDay: 5, plans: [], gaId: "", supabaseUrl: "", supabaseAnonKey: "", razorpayKeyId: ""});
  if (route === "/api/reference-motion/status") return json(res, {enabled: true, plan: "free",
    maxDurationSeconds: 5, processingLocation: "OWNER_PC", workerOnline: false,
    reconstruction: "SUPPORTED_PLANAR_CARDS_OR_FLAT_VECTORS", geminiAvailable: false});
  if (route === "/api/designs/templates") return json(res, {templates: catalogs.designs});
  if (route.startsWith("/api/designs/templates/")) {
    const template = catalogs.designs.find(item => item.id === route.split("/").at(-1));
    return template ? json(res, {template}) : json(res, {error: "Public template not in preview cache."}, 404);
  }
  if (route === "/api/skills" || route === "/api/skills/mine") return json(res, {skills: route.endsWith("/mine") ? [] : catalogs.skills});
  if (route === "/api/community-templates") return json(res, {templates: [publication]});
  if (route === "/api/user/creations") return json(res, {creations: guest ? [] : [publication]});
  if (route === "/api/community-templates/" + publication.id || route === "/api/user/creations/" + publication.id) return json(res, {template: publication});
  if (route === "/api/projects") return json(res, {projects: guest ? [] : [project]});
  if (route === "/api/projects/" + project.id) return json(res, {project});
  if (route === "/api/designs/projects") return json(res, {projects: guest ? [] : [designProject]});
  if (route === "/api/designs/projects/" + designProject.id) return json(res, {project: designProject});
  if (route === "/api/template-metrics") return json(res, {metrics: {}});
  if (route === "/api/template-reactions") return json(res, {reactions: {}});
  if (route === "/api/comments") return json(res, {comments: []});
  if (/^\/api\/(?:templates|designs)\/[^/]+\/access$/.test(route)) return json(res, {hasAccess: true, access: true, canEdit: true, unlocked: true});
  if (route === "/api/creator") return json(res, {creator: {id: owner.id, name: "Preview Public Creator", handle: "@preview",
    initials: "PC", bio: owner.bio, verified: true, followers: 2, following: 1, stars: 0, avatarUrl: "", creatorDetails: {}}, communityTemplates: [publication]});
  if (/^\/api\/creators\/[^/]+\/(followers|following)$/.test(route)) return json(res, {people: guest ? [] : people});
  if (route === "/api/notifications") return json(res, {notifications: guest ? [] : notifications, unread: guest ? 0 : 1, total: guest ? 0 : notifications.length});
  if (route === "/api/notifications/unread") return json(res, {unread: guest ? 0 : 1});
  if (route === "/api/push/key") return json(res, {enabled: false, publicKey: ""});
  if (route === "/api/stars") return json(res, {balance: 0, received: 0, sent: 0, allowance: 0, monetizationEnabled: false});
  if (route === "/api/stars/packs") return json(res, {packs: [], monetizationEnabled: false});
  if (route === "/api/stars/wallet") return json(res, {availableINR: 0, availableStars: 0, totalEarnedINR: 0,
    totalReceivedStars: 0, canWithdraw: false, monetizationEnabled: false, history: []});
  if (route === "/api/account/transactions") return json(res, {transactions: [{kind: "preview_credit_activity", amount: 5,
    unit: "credits", status: "Fixture only", createdAt: stamp}], hasMore: false, nextOffset: 1});
  if (route === "/api/support/tickets") return json(res, {tickets: guest ? [] : [ticket]});
  if (route === "/api/support/tickets/" + ticket.id) return json(res, {ticket});
  if (route === "/api/referrals") return json(res, {enabled: true, available: true, code: referralCode,
    totalInvited: 2, rewarded: 1, pending: 1, this_month: 1, monthlyLimit: 10, bonusEarned: 10, emailVerified: true});
  if (route === "/api/referrals/history") return json(res, {available: true, items: [{id: "preview-referral-1",
    displayLabel: "Referral TEST", status: "rewarded", credits: 10, createdAt: stamp, rewardedAt: stamp}], hasMore: false, nextCursor: null});
  if (route.startsWith("/api/admin/")) {
    if (guest) return json(res, {error: "Preview guest has no admin access."}, 403);
    if (route === "/api/admin/dashboard") return json(res, {stats: {users: 1, new_users_30d: 1, pro_users: 0,
      creators_count: 1, published_templates: 1, pending_templates: 0, pending_withdrawals: 0,
      ai_jobs_today: 0, ai_jobs_failed_30d: 0, open_tickets: 1, open_reports: 0, starPackGrossINR: null, platformFeeINR: null}, recentActivity: []});
    if (route === "/api/admin/users") return json(res, {users: [person]});
    if (route === "/api/admin/creators") return json(res, {creators: [{...person, templatesCount: 1, starsEarned: 0, starsWithdrawn: 0}]});
    if (route === "/api/admin/templates") return json(res, {templates: [publication]});
    if (route === "/api/admin/skills") return json(res, {skills: catalogs.skills});
    if (route === "/api/admin/reports") return json(res, {reports: []});
    if (route === "/api/admin/withdrawals") return json(res, {withdrawals: []});
    if (route === "/api/admin/stars/ledger") return json(res, {transactions: []});
    if (route === "/api/admin/star-packs") return json(res, {packs: [{label: "Preview pack — unavailable", price: 0, stars: 0, popular: false}]});
    if (route === "/api/admin/ai-jobs") return json(res, {jobs: []});
    if (route === "/api/admin/staff") return json(res, {staff: [{...owner, owner: true}], permissions: [], presets: {}});
    if (route === "/api/admin/support/tickets") return json(res, {tickets: [ticket]});
    if (route === "/api/admin/feature-flags") return json(res, {flags: [{key: "preview_read_only", description: boundary,
      enabled: false, runtimeSupported: false, readOnlyReason: "Read-only layout fixture; no live service is controlled."}]});
    if (route === "/api/admin/audit-logs") return json(res, {logs: []});
  }
  return json(res, {error: "This API read is not implemented in the isolated layout fixture."}, 503);
});

app.get("/uploads", (_req, res) => res.redirect(302, "/drafts#published"));
app.get("/help", (_req, res) => res.sendFile(path.join(publicRoot, "tutorials.html")));
for (const route of accountRoutes) app.get(route, (_req, res) => res.sendFile(path.join(publicRoot, "account.html")));
app.get("/reference-motion", (_req, res) => res.sendFile(path.join(root, "reference-motion/editor.html")));
app.get("/reference-motion/editor.js", (_req, res) => res.sendFile(path.join(root, "reference-motion/editor.bundle.js")));
app.get("/reference-motion/editor.css", (_req, res) => res.sendFile(path.join(root, "reference-motion/editor.css")));
app.get("/reference-motion/fonts/noto-sans.ttf", (_req, res) => res.sendFile(path.join(root, "flagship/assets/NotoSansDevanagari.ttf")));
app.get("/reference-motion/fonts/latin-modern-roman.otf", (_req, res) => res.sendFile(path.join(root, "reference-motion/fonts/LMRoman10-Regular.otf")));
app.use((req, res, next) => ["GET", "HEAD"].includes(req.method) ? next() : res.status(405).end("Read-only preview"));
app.use(express.static(publicRoot, {dotfiles: "deny", extensions: ["html"], etag: false, maxAge: 0}));
app.use((_req, res) => res.status(404).sendFile(path.join(publicRoot, "404.html")));

async function cachePublicCatalog(route, field) {
  try {
    const response = await fetch("https://shortscraft.online" + route, {method: "GET", credentials: "omit",
      redirect: "error", signal: AbortSignal.timeout(20000), headers: {Accept: "application/json"}});
    if (!response.ok) throw Error("HTTP " + response.status);
    const raw = await response.text();
    if (raw.length > 8 * 1024 * 1024) throw Error("catalog response exceeded preview bound");
    const data = JSON.parse(raw), key = field === "designs" ? "templates" : "skills";
    if (!data.success || !Array.isArray(data[key])) throw Error("unexpected catalog response");
    catalogs[field] = data[key];
  } catch (error) {
    catalogs.failures.push({catalog: field, error: error.message});
    console.warn("Public " + field + " catalog unavailable; preview shows explicit empty fixture: " + error.message);
  }
}

async function start() {
  await Promise.all([cachePublicCatalog("/api/designs/templates", "designs"), cachePublicCatalog("/api/skills?limit=100", "skills")]);
  const server = app.listen(port, "127.0.0.1", () => console.log("Read-only mobile layout fixture: http://127.0.0.1:" + port +
    " | public designs=" + catalogs.designs.length + ", tutorials=" + catalogs.skills.length + " | " + boundary));
  server.on("error", error => {console.error("Preview could not bind: " + error.message); process.exitCode = 1;});
  process.once("SIGTERM", () => server.close());
  process.once("SIGINT", () => server.close());
}
if (require.main === module) start().catch(error => {console.error(error.message); process.exitCode = 1;});
module.exports = {app, start, catalogs};
