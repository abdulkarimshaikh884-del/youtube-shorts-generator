# Reference Motion — free PC-worker beta

This is a **limited, partially editable beta**, not an arbitrary-video cloning engine. The accepted local reconstruction extracts grouped planar artwork and measured animation tracks. Text and pictures inside a card may remain one group. Unsupported references fail rather than returning a fabricated finished template. Gemini/provider analysis stays disabled.

## Architecture and operational boundary

The existing website authenticates each user, applies plan limits, privately stores project assets, and owns credits/refunds. A separately started Windows PC worker makes **outbound HTTPS** requests to the fixed ShortsCraft broker. It does not open an inbound port, tunnel, firewall rule or scheduled startup task. The PC, worker and Internet connection must stay on; while they are off the website must show that processing is unavailable. Render Free restarts discard in-memory beta jobs, so failed jobs must be retried; this is not a durable production queue.

One global job runs at a time. Free references allow 5 seconds; existing paid-plan admission allows up to 10 seconds. Existing server-side admission still decides entitlements; worker input is not a user-selected plan override. Heavy processing has a 180-second deadline and cancellation stops its owned subprocesses. Broker network failures stop work, not leave detached inference running. No database key, browser cookie, provider key or payment credential is required on the PC worker.

## Private setup

The operator generates a cryptographically random broker token and sets the same value on the website and this PC. Do not put it in chat, a URL, shell arguments, source files, screenshots or logs. Configure through redirected private stdin:

```text
node reference-motion/pc-worker-config.js init-stdin
```

The stdin JSON contract is `{baseUrl,token,pythonPath}` with optional absolute `ffmpegPath` and `ffprobePath`. The default broker origins are only `https://shortscraft.online`, `https://www.shortscraft.online`, and the existing Render HTTPS origin. The file in `%LOCALAPPDATA%\ShortsCraft\reference-pc-worker\config.json` contains a Windows DPAPI-encrypted token, bound to the current Windows user. It is outside the repository. Setup refuses to overwrite an existing config, and neither setup nor errors prints the token. Keep the Windows account secure; another process running as that same user can access that user's DPAPI secrets.

Use the same Windows account for setup and processing. A moved project needs no new token but the start/stop helpers verify the exact current worker script path; stop the old worker before moving the checkout. Token rotation means stop the worker, rotate the broker token, recoverably move the old config out of the default location, then provision the replacement through stdin.

## Doctor, start, stop

```powershell
node reference-motion/pc-worker.js doctor
powershell.exe -NoProfile -File tools/start-reference-pc-worker.ps1
powershell.exe -NoProfile -File tools/stop-reference-pc-worker.ps1
```

Doctor actually imports configured Python NumPy/OpenCV, invokes FFmpeg/ffprobe version probes, checks installed Remotion packages, browser executable, bundled fonts and the fixed local workers, and exercises Sharp. It is a readiness probe, **not proof of a reconstructed video**. It does not require OCR models or call AI services. A minimum 2 GiB of available RAM is required at startup and before each heavy job. All actual renders still need visual/export verification.

Start runs hidden in the background with private bounded-message logs under the same local config directory. It does not create autostart. Stop first requests graceful AbortSignal cancellation, then, only if needed, verifies process ID, birth time, Node executable and the exact worker script before terminating that owned process family. It does not discover or stop unrelated Chrome, Node or user applications. Closing unrelated apps remains the user's decision.

For isolated loopback QA only, setup and worker accept `--dev-loopback` and the start helper accepts `-DevLoopback`. This only permits HTTP on localhost/127.0.0.1/::1; it is not an arbitrary-origin production escape hatch. Requests refuse redirects and never forward broker credentials to redirected hosts.

## Broker protocol

All calls have `Authorization: Bearer <private token>`. Job calls additionally have `X-Reference-Lease`.

- `POST /api/reference-motion/worker/claim` with `{workerId}`: 204 idle or `{id,kind,lease}`.
- `GET /api/reference-motion/worker/jobs/:id/input`: bounded JSON input. Analyze is `{input,plan,userId}`; render is `{document:{scene,images},options:{height,watermark}}`.
- `POST .../pulse` with `{}` before fetching input and every 8 seconds: a missing/expired lease aborts the active processing.
- `POST .../complete`: bounded JSON analysis or actual `video/mp4` bytes. Website validates the result and persists new owner-private assets; it must not trust local worker storage references.
- `POST .../fail`: only a whitelisted failure code, never raw diagnostics, paths or source images.

Every fetch has a timeout, responses are bounded while streaming, executable code/paths/URLs are not accepted in jobs, the schema is validated again on the PC, and plan/provider flags cannot be changed by the source video. Polling idles at 5 seconds with bounded exponential backoff on broker errors.

## Evidence requirements

Protocol unit tests and capability doctor output are diagnostic evidence only. Before enabling the live feature, run the actual accepted reference through this worker and the website, verify card edit/save/reopen and a real MP4, inspect the rendered frames, and verify owner/other-user/guest asset boundaries and credit/refund behavior. No production deployment or public-ready claim follows solely from successful HTTP 200 responses or unit tests.

## Verified release evidence — 2026-10-20

The scoped release starts at production commit `0cdbe221f0849b34421f2cc5f4faa825657f302e`, not the unrelated dirty development checkout. It adds no paid service and does not change the legacy generator, design engine or admin pages.

- 72 executable PC-beta contracts pass: authenticated/leased transport, limits, cancellation, request reservation, consent, private ownership, result admission, billing and editor states.
- Two fresh runs used the actual user-provided rotating-card video through the complete HTTP broker and outbound worker, with no mocked CV/render. Each returned seven grouped cards plus an inferred background, `REVIEW_REQUIRED`, measured tracking, 150 frames and no analysis charge. The first analysis took 123.184 seconds on this PC; this is not a latency guarantee for other hardware or references.
- Actual private SQL save/reopen preserves corner tracks and movement/rotation edits. Other-user and guest access fail. New media uses the existing private `original.webp` storage contract; no database migration or public-asset grant is needed.
- The actual MP4 is H264, 480x854, 150 frames, five seconds, without copied audio. One isolated QA credit was charged only after completion.
- Independent comparison of all 150 encoded frames: zero failures; max MAE 7.6736, maximum changed-pixel fraction 0.0686, minimum foreground recall/precision 0.9623/0.9910. Gates were not weakened.
- Real 20 MiB malformed-media intake was rejected by the actual worker's media probe without a charge. Maximum measured dispatcher RSS was 248 MiB in the latest isolated run. Production memory still requires monitoring; this is not proof of arbitrary concurrency safety.
- Actual browser inspection confirmed the preview, a 200 px card move surviving save/reload, and saved preview availability after the worker stopped. Offline analysis/export is disabled, with an explicit beta-offline notice.

Private local evidence lives under `audit_results/reference-motion/pc-beta-1792519046072/` (including encoded-frame comparisons and browser screenshots) and `pc-beta-1792519342190/` (latest shared-request-gate run). No source video, extracted private raster, test login or broker credential is checked into Git.

Only one heavy browser request and one PC job are admitted at once; a busy request is refused before parsing/hydrating another large body. The broker allows ten jobs per hour. On host restart, temporary jobs disappear and must be retried. Export charging is deferred until the actual MP4 returns, so an interrupted in-flight beta render does not leave a precharged job awaiting a nonexistent refund worker. Existing ledger replay/conflict checks remain authoritative.

### Public-service packaging

`node reference-motion/build-editor.js` builds both the ignored local bundle and the reviewed `reference-motion/editor.bundle.js` release artifact. Render's existing Node build stays unchanged: it serves that artifact and dispatches jobs; it does not install Python or Remotion. The PC checkout retains pinned Remotion dependencies, Python/OpenCV and FFmpeg. Rebuild the browser artifact whenever its sources change. The PC must be manually restarted when its checked-out worker/runtime code changes.
