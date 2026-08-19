# Deploying ShortsCraft

## Why Docker and why a disk

Two things decide the hosting shape:

1. **Exports shell out.** `/api/export` renders frames with Chromium and pipes
   them into `ffmpeg`. Neither exists on a stock Node host, so the app ships as
   a container that installs both (see `Dockerfile`). It also installs a sans,
   a serif, a mono and a colour-emoji font — without those, exported videos
   render text and emoji as blank boxes.

2. **State is on disk.** Accounts, credit balances, the launch waitlist,
   community templates and comments are JSON files. On a host with an ephemeral
   filesystem they are wiped on every deploy and every restart. Every module
   already takes its path from an environment variable, so the fix is a mounted
   volume plus the `*_FILE` variables — no code change.

**If you deploy without a persistent disk you will lose every signup and every
waitlist email on the next deploy.** That is the one thing not to skip.

---

## Render (the blueprint is already written)

1. Push this repo to GitHub.
2. render.com → **New → Blueprint** → pick the repo. It reads `render.yaml`:
   Docker runtime, a 1 GB disk mounted at `/data`, health check on
   `/api/health`, and all the `*_FILE` variables pointed at the disk.
3. Set the secrets in the Render dashboard (they are `sync: false` in the
   blueprint, so Render will prompt):

   | Variable | Needed for | Without it |
   |---|---|---|
   | `GROQ_API_KEY` | AI animations, SEO tools | those routes answer 503 |
   | `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | payments | pricing page stays in reserve mode |
   | `PAYMENTS_OPEN_DATE` | optional | the "opens on …" line is omitted |

   `CREDITS_SECRET` is generated once by Render. Do not change it later —
   it signs the anonymous-credit cookie, so rotating it resets balances.

4. Deploy. First build is slow (it installs Chromium and ffmpeg); later builds
   reuse the layer.

### Plan
`render.yaml` asks for **starter**, not free. Free instances sleep after
inactivity and have a short request timeout — a 1080p export is roughly 13
seconds of solid CPU and will be cut off. Free also has no disks, which brings
back the data-loss problem above.

---

## Turning payments on later

The gateway needs an 18+ account holder. Until then the pricing page collects
reservations instead of charging, and says so.

When the account exists, add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` and
redeploy. The same page turns itself into real checkout — nothing to edit. The
people on the waitlist are in `/data/waitlist.json`; email them, because the
first 100 Pro Max buyers get the lifetime price and that offer is what the list
was built for.

---

## Other hosts

Anything that runs a Dockerfile with a volume works. The contract is:

* mount a volume and point `USERS_FILE`, `CREDITS_FILE`, `WAITLIST_FILE`,
  `COMMUNITY_FILE` and `COMMENTS_FILE` inside it
* set `PORT` (defaults to 3000)
* give it at least ~1 GB RAM — Chromium plus ffmpeg during an export

`fly.io` and Railway both fit. Vercel and Netlify do not: they are serverless,
so there is no persistent disk and no long-running process for a 13-second
render.

---

## After the first deploy, check these

```bash
curl -s https://YOUR-URL/api/health          # 200
curl -s https://YOUR-URL/api/offer           # paymentsLive:false, reserved:0
curl -s -o /tmp/t.mp4 -w '%{http_code} %{size_download}\n' \
  -X POST https://YOUR-URL/api/export \
  -H 'Content-Type: application/json' \
  -d '{"tpl":"ui-toggle","dur":1500,"fps":30,"height":720,"aspect":"9:16"}'
```

The export is the one that proves the container is right — a real MP4 means
Chromium, ffmpeg and the fonts are all in place. Then redeploy once and sign up
again to confirm the disk kept your account.
