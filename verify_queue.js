/* ============================================================
   verify_queue.js

   The pricing page sells Pro a "priority export queue" and Pro Max the
   "highest export queue priority". Until now the export serialiser was a
   plain promise chain — strictly first-come — so both lines were claims
   the product did not keep, which is exactly what the plan forbids.

   This exercises the ordering directly rather than through a real render:
   an export takes tens of seconds and needs ffmpeg, so driving the queue
   itself is both faster and a sharper test of the thing that changed.

   Usage: node verify_queue.js
   ============================================================ */

let failures = 0;
function ok(pass, label, extra) {
  if (!pass) failures++;
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${extra !== undefined ? "  (" + extra + ")" : ""}`);
  return pass;
}

/* The queue under test, kept in step with server.js. Requiring server.js
   would start a listener and open a database pool, so the ordering logic is
   mirrored here and asserted against the same shape. */
const QUEUE_PRIORITY = { promax: 2, pro: 1, free: 0 };
const _waiting = [];
let _running = false;
let _seq = 0;

function pump() {
  if (_running || !_waiting.length) return;
  _waiting.sort((a, b) => (b.priority - a.priority) || (a.seq - b.seq));
  const next = _waiting.shift();
  _running = true;
  Promise.resolve()
    .then(next.job)
    .then(next.resolve, next.reject)
    .finally(() => { _running = false; pump(); });
}

function serialise(job, plan) {
  const priority = QUEUE_PRIORITY[plan] || 0;
  return new Promise((resolve, reject) => {
    _waiting.push({ job, priority, seq: _seq++, resolve, reject });
    pump();
  });
}

const tick = (n = 5) => new Promise((r) => setTimeout(r, n));

(async () => {
  console.log("\n---- the source matches this queue ----");
  const src = require("fs").readFileSync(require("path").join(__dirname, "server.js"), "utf8");
  ok(/const QUEUE_PRIORITY = \{ promax: 2, pro: 1, free: 0 \}/.test(src),
    "server.js uses the same plan ordering");
  ok(/_waiting\.sort\(\(a, b\) => \(b\.priority - a\.priority\) \|\| \(a\.seq - b\.seq\)\)/.test(src),
    "server.js orders by plan, then arrival");
  ok(/serialise\(async \(\) => \{[\s\S]{0,20000}?\}, ent\.plan\)/.test(src),
    "the export route passes the account's plan to the queue");

  console.log("\n---- ordering ----");
  const order = [];
  // The first job occupies the runner; everything else queues behind it and
  // is therefore ordered by plan, which is the case that matters.
  const blocker = serialise(async () => { order.push("running-free"); await tick(60); }, "free");
  await tick(10);

  const queued = [
    serialise(async () => { order.push("free-a"); }, "free"),
    serialise(async () => { order.push("pro"); }, "pro"),
    serialise(async () => { order.push("free-b"); }, "free"),
    serialise(async () => { order.push("promax"); }, "promax")
  ];
  await Promise.all([blocker, ...queued]);

  ok(order[0] === "running-free", "a job already running is never interrupted", order[0]);
  ok(order[1] === "promax", "Pro Max goes first among those waiting", order[1]);
  ok(order[2] === "pro", "Pro comes next", order[2]);
  ok(order[3] === "free-a" && order[4] === "free-b",
    "Free keeps arrival order among itself", order.slice(3).join(","));

  console.log("\n---- fairness and behaviour ----");
  const fifo = [];
  await Promise.all([
    serialise(async () => { fifo.push(1); await tick(5); }, "pro"),
    serialise(async () => { fifo.push(2); }, "pro"),
    serialise(async () => { fifo.push(3); }, "pro")
  ]);
  ok(fifo.join(",") === "1,2,3", "same plan is still first-come, first-served", fifo.join(","));

  let concurrent = 0, maxConcurrent = 0;
  await Promise.all([1, 2, 3, 4].map((n) => serialise(async () => {
    concurrent++; maxConcurrent = Math.max(maxConcurrent, concurrent);
    await tick(15);
    concurrent--;
  }, n % 2 ? "free" : "pro")));
  ok(maxConcurrent === 1, "only one export runs at a time", maxConcurrent);

  const failed = await serialise(async () => { throw new Error("render blew up"); }, "free")
    .then(() => null, (e) => e.message);
  ok(failed === "render blew up", "a failed job rejects to its own caller", failed);

  const after = await serialise(async () => "still working", "free");
  ok(after === "still working", "and the queue keeps running afterwards", after);

  /* Priority only decides who goes next among jobs that are *waiting*, so
     this needs the runner occupied first — otherwise the first call simply
     starts, and what is measured is arrival order rather than plan. */
  const unknown = [];
  const hold = serialise(async () => { await tick(50); }, "free");
  await tick(10);
  const race = [
    serialise(async () => { unknown.push("nonsense-plan"); }, "enterprise"),
    serialise(async () => { unknown.push("promax"); }, "promax")
  ];
  await Promise.all([hold, ...race]);
  ok(unknown[0] === "promax",
    "an unrecognised plan is treated as Free, not as top priority", unknown.join(","));

  console.log(`\nQUEUE=${failures === 0 ? "PASS" : "FAIL"}${failures ? " (" + failures + " failing)" : ""}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error("HARNESS FAIL:", e.message);
  process.exit(1);
});
