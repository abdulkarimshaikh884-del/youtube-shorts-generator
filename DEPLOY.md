# Deploying ShortsCraft

## What the hosting has to provide

**1. Chromium and ffmpeg.** `/api/export` renders frames with Chromium and pipes
them into ffmpeg. Neither exists on a stock Node host, so the app ships as a
container that installs both (see `Dockerfile`). It also installs a sans, a
serif, a mono and a colour-emoji font — without those, exported videos render
text and emoji as blank boxes.

**2. A `DATABASE_URL`.** Accounts, credit balances, the launch waitlist,
community templates and comments live in Supabase Postgres. They used to be
JSON files on disk, which meant a redeploy on a host with an ephemeral
filesystem wiped every signup. Nothing is stored in the container now, so no
volume is needed and a restart cannot lose anything.

---

## Supabase

The schema is already applied to the `youtube-shorts-tool` project
(`mqsimdmogbycrbizrrsm`): tables `users`, `sessions`, `credits`, `waitlist`,
`community_templates`, `template_comments`, and `password_reset_tokens`.

The app connects as a dedicated role, **`shortscraft_app`**, not as `postgres`:

* It has `SELECT/INSERT/UPDATE/DELETE` on exactly those application tables and nothing
  on Supabase's own auth or storage schemas.
* RLS is enabled on all of them with **no policies**, which locks the anon and
  publishable keys out of them entirely. Only this role reaches the data, and
  it is granted `BYPASSRLS` because our Express API is the only client — the
  browser never gets database credentials. Authorization stays in the
  application code that already enforced it.

The connection string is in `.env` locally and must be set as a secret in the
host's dashboard. It contains the role password, so it is never committed.

### Use the pooler host, not the direct one

`DATABASE_URL` must point at the **Supavisor session pooler**:

```
postgresql://shortscraft_app.mqsimdmogbycrbizrrsm:PASSWORD@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
```

Not `db.mqsimdmogbycrbizrrsm.supabase.co:5432`. Two reasons, both hard:

1. **Render cannot reach the direct endpoint at all.** It is IPv6-only without
   the paid IPv4 add-on, and Render is an IPv4-only platform — Supabase names
   it explicitly in their own docs. A deploy pointed at the direct host would
   fail every query.
2. **It is six times faster from here.** Measured: `select 1` takes ~1,370ms
   over the direct IPv6 route and ~180ms through the pooler, and a cold
   connection took 11.5s versus 1.3s. `/api/credits` went from 2.3–15s to
   ~0.37s just by switching hosts.

Note the username is `shortscraft_app.<project-ref>`, with the ref appended
after a dot — the pooler uses that to identify the tenant. The plain role name
gives `tenant/user not found`. Also note the host is `aws-1-…`, not `aws-0-…`;
`aws-0` does not serve this project.

Session mode (port 5432), not transaction mode (6543): this is a persistent
backend, and session mode supports prepared statements, which `pg` uses.

---

## Render (the blueprint is already written)

1. Push to GitHub.
2. render.com → **New → Blueprint** → pick the repo. It reads `render.yaml`:
   Docker runtime, health check on `/api/health`, Singapore region.
3. Set the secrets Render prompts for (`sync: false` in the blueprint):

   | Variable | Needed for | Without it |
   |---|---|---|
   | `DATABASE_URL` | everything with state | the app refuses to start |
   | `PUBLIC_SITE_URL` | links inside account emails | defaults to `https://shortscraft.online` |
   | `RESEND_API_KEY` | password-reset delivery | production reset requests answer 503 |
   | `AUTH_FROM_EMAIL` | verified reset-email sender | production reset requests answer 503 |
   | `GROQ_API_KEY` / `NVIDIA_API_KEY` | AI animations, SEO tools | those routes answer 503 |
   | `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | payments | pricing page stays in reserve mode |
   | `PAYMENTS_OPEN_DATE` | optional | the "opens on …" line is omitted |

   `CREDITS_SECRET` is generated once by Render. Do not change it later — it
   signs the anonymous-credit cookie, so rotating it resets guest balances.

   Verify `shortscraft.online` in Resend before setting `AUTH_FROM_EMAIL`.
   Development can complete the flow without an email provider: the forgot
   page exposes a local one-time reset link. That link is never returned when
   `NODE_ENV=production`.

4. Deploy. The first build is slow (it installs Chromium and ffmpeg); later
   builds reuse the layer.

### Region
`region: singapore`, deliberately. The Supabase project is in Tokyo
(`ap-northeast-1`). From Singapore a query is ~70ms; from Render's default
Oregon it is ~200ms, and the credit ledger is read on every billable request.
**If you move the app, move it near the database.**

### Plan
`plan: starter`, not free. Free instances sleep after inactivity and have a
short request timeout — a 1080p export is ~25 seconds of solid CPU and would be
cut off.

---

## Limits worth knowing

* **Exports are capped at 450 frames** (`EXPORT_LIMITS.maxFrames`). Rendering
  costs roughly 0.1s of CPU per frame and exports are serialised, so 450 keeps
  the worst case near 45s — inside the ~100s timeout proxies put in front of a
  web service. 12s at 30fps fits; 12s at 60fps is refused with a message
  telling the user to lower the frame rate.
* **Credits are only touched when spent.** The middleware resolves who would be
  billed without querying; `state`/`charge`/`refund` hit the database. Page
  loads cost no queries.

---

## Turning payments on later

The gateway needs an 18+ account holder. Until then the pricing page collects
reservations instead of charging, and says so plainly.

When the account exists, set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` and
redeploy. The same page turns itself into real checkout — nothing to edit. The
waitlist is in the `waitlist` table:

```sql
select email, plan, created_at from public.waitlist order by id;
```

Email them, because the first 100 Pro Max buyers get the lifetime price and
that offer is what the list was built for.

---

## Other hosts

Anything that runs a Dockerfile works — there is no volume to arrange any more.
The contract is: set `DATABASE_URL`, set `PORT` (defaults to 3000), and give it
about 1 GB of RAM for Chromium plus ffmpeg during an export. fly.io and Railway
both fit. Vercel and Netlify do not: serverless has no long-running process for
a 25-second render.

---

## After the first deploy, check these

```bash
curl -s https://YOUR-URL/api/health
curl -s https://YOUR-URL/api/offer
curl -s -o /tmp/t.mp4 -w '%{http_code} %{size_download}\n' \
  -X POST https://YOUR-URL/api/export \
  -H 'Content-Type: application/json' \
  -d '{"tpl":"ui-toggle","dur":1500,"fps":30,"height":720,"aspect":"9:16"}'
```

The export is the one that proves the container is right — a real MP4 means
Chromium, ffmpeg and the fonts are all in place. Then sign up, redeploy, and log
in again: the account surviving proves `DATABASE_URL` is wired correctly.

## Running the verification suite

The suites drive a running server rather than starting one, so point them at
whichever instance you want to check:

```bash
DISABLE_RATE_LIMIT=true PORT=3211 node server.js
```

```bash
BASE_URL=http://127.0.0.1:3211 npm test
```

`DISABLE_RATE_LIMIT=true` matters. The auth, password-reset and support suites
deliberately hammer signup, login, reset and feedback — endpoints that are rate
limited in production for good reason. Against a normal server the first run
passes and later runs report 429s that look exactly like broken features, which
is a slow way to chase a bug that is not there. Never set this on a deployed
instance; it exists so the tests measure behaviour instead of the limiter.
