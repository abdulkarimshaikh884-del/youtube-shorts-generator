/* ============================================================
   ShortsCraft — Editor
   Runs fully in the browser: no API call, no credits.

   Playback note: the preview iframe uses sandbox="allow-same-origin"
   (deliberately WITHOUT allow-scripts). That lets this page reach into the
   frame with the Web Animations API to pause / seek / restart, while the frame
   itself is still forbidden from executing any script. Combining
   allow-scripts + allow-same-origin would let a frame drop its own sandbox,
   so that pair is never used. User-submitted templates will keep the stricter
   sandbox="" used on the landing gallery.

   Timeline: a project is a SEQUENCE of clips. Each clip is one template
   document with its own text, accent, font and duration, mounted in its own
   iframe layer inside #edFrame; only the active layer is visible, which is why
   crossing a clip boundary costs nothing and seeking is instant.
   The CSS animations play natively (we never fake the clock) — at a boundary
   the next clip is mounted and seeded with the overshoot, so timing does not
   drift. #edSeek is the accessible playhead: it overlays the ruler, so drag,
   click-to-seek and arrow keys all work.
   ============================================================ */
(function () {
  "use strict";

  var SWATCHES = ["#ffffff", "#0a0a0a", "#5b8cff", "#37e0c8", "#34d17a",
                  "#ffd166", "#ff5d3b", "#ff3b5c", "#a97cff"];

  var AR_LABEL = {
    "9:16": "9:16 Shorts / Reels", "16:9": "16:9 YouTube", "1:1": "1:1 Square",
    "4:5": "4:5 Instagram feed", "3:4": "3:4 Portrait", "2:3": "2:3 Pinterest",
    "21:9": "21:9 Cinematic"
  };

  var MIN_DUR = 1000;
  var MAX_DUR = 9000;
  var MAX_TOTAL = 12000;        // matches EXPORT_LIMITS.maxDurMs on the server
  var TAIL_S = 2;               // seconds of empty ruler drawn after the last clip

  var $ = function (s) { return document.querySelector(s); };
  var all = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  var state = {
    clips: [],                  // [{tpl, lines, accent, font, dur}]
    sel: 0,
    aspect: "9:16",
    playing: true
  };
  var meta = {}, order = [];
  var renderTimer = 0, rafId = 0, scrubbing = false;
  var mounted = -1, pps = 60;
  var cost = { export: 1, animate: 5 };   // overwritten by GET /api/credits
  var attached = null;                    // {name, dataUrl} in the AI composer
  var creating = false;

  function engine() { return window.SC_TPL2; }
  function cur() { return state.clips[state.sel] || state.clips[0]; }
  function total() {
    return state.clips.reduce(function (s, c) { return s + c.dur; }, 0);
  }
  function offsetOf(i) {
    var s = 0;
    for (var k = 0; k < i; k++) s += state.clips[k].dur;
    return s;
  }
  function clipAt(ms) {
    var t = Math.max(0, Math.min(total() - 1, ms)), s = 0;
    for (var i = 0; i < state.clips.length; i++) {
      if (t < s + state.clips[i].dur) return { i: i, local: t - s };
      s += state.clips[i].dur;
    }
    return { i: state.clips.length - 1, local: 0 };
  }
  function fps() { return Number(($("#edFps") || {}).value || 30); }

  function newClip(tpl) {
    var m = meta[tpl] || {};
    var demoLines = Array.isArray(m.demo) ? m.demo : ["", "", ""];
    var lines = demoLines.slice(0, 3);
    while (lines.length < 3) lines.push("");
    var s = m.schema || { defaults: {} };
    var props = Object.assign({}, s.defaults);
    return { tpl: tpl || "blank", lines: lines, props: props, accent: m.accent || "#ffffff", font: "inter", dur: 4600 };
  }

  /* ── Build / render ───────────────────────────────────── */
  /* A clip is either a shipped template (tpl) or an AI-authored scene (spec).
     Both go through the same engine, so preview and export cannot diverge. */
  function htmlFor(c) {
    if (c.spec) {
      return engine().buildCustom(c.spec, {
        props: c.props || {}, accent: c.accent, aspect: state.aspect, dur: c.dur, font: c.font
      });
    }
    /* The Properties fields write props.line0/1/2, but c.lines still holds the
       text the clip started with. build() maps lines over props, so passing the
       stale array would undo every edit the moment it re-rendered. Fold the
       edited props back into lines first — one place, rather than syncing at
       all eight field handlers. */
    var pr = c.props || {};
    var lines = (c.lines || []).slice();
    for (var i = 0; i < 3; i++) {
      if (pr["line" + i] != null) lines[i] = pr["line" + i];
    }

    return engine().build(c.tpl, {
      props: pr, lines: lines, accent: c.accent, aspect: state.aspect, dur: c.dur, font: c.font
    });
  }
  function clipName(c) {
    if (!c) return "Animation";
    return c.spec ? (c.spec.name || "Custom animation") : (meta[c.tpl] ? meta[c.tpl].name : (c.tpl || "Custom animation"));
  }

  function layers() { return all("#edFrame .ed-lay"); }
  function layerAt(i) { return $('#edFrame .ed-lay[data-i="' + i + '"]'); }

  function animsOf(frame) {
    try {
      var doc = frame && frame.contentDocument;
      if (!doc || !doc.getAnimations) return [];
      return doc.getAnimations();
    } catch (e) { return []; }
  }
  function playerEl() {
    return $("#animationPlayer") || $("#edPreview");
  }
  function frameAnims() {
    return animsOf(playerEl());
  }

  function sendActiveTemplateToPlayer() {
    var p = playerEl();
    if (!p || !p.contentWindow) return;
    var c = cur();
    if (!c) return;
    var code = "";
    if (c.spec) {
      var spec = c.spec;
      var styleTag = "<style>" + (spec.css || "").replace(/\\/g, "\\\\").replace(/`/g, "\\`") + "</style>";
      var bodyHtml = (spec.body || "").replace(/\\/g, "\\\\").replace(/`/g, "\\`");
      var accent = c.accent || spec.accent || "#ffffff";
      var dur = c.dur || 4600;
      var isDark = spec.dark !== false;
      code = "function Scene() {\n"
        + "  return (\n"
        + "    <AbsoluteFill style={{\n"
        + "      backgroundColor: " + (isDark ? "'#08080a'" : "'#ffffff'") + ",\n"
        + "      color: " + (isDark ? "'#ffffff'" : "'#0a0a0a'") + ",\n"
        + "      display: 'flex',\n"
        + "      alignItems: 'center',\n"
        + "      justifyContent: 'center',\n"
        + "      overflow: 'hidden'\n"
        + "    }}>\n"
        + "      <div dangerouslySetInnerHTML={{ __html: `" + styleTag + "<div class=\\\"vp cv\\\" style=\\\"--ac:" + accent + ";--fg:" + (isDark ? "#fff" : "#000") + ";--dim:" + (isDark ? "rgba(255,255,255,.5)" : "rgba(0,0,0,.5)") + ";--surf:" + (isDark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.05)") + ";--hair:" + (isDark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.12)") + ";--D:" + dur + "ms;--sp:cubic-bezier(.16,1,.3,1);--ov:cubic-bezier(.34,1.56,.64,1);width:100%;height:100%;\\\">" + bodyHtml + "</div>` }} style={{ width: '100%', height: '100%' }} />\n"
        + "    </AbsoluteFill>\n"
        + "  );\n"
        + "}\n";
    } else {
      code = engine().getReactCode ? engine().getReactCode(c.tpl) : "";
    }
    var fpsVal = fps();
    var durFrames = Math.max(1, Math.round((c.dur || 4600) / 1000 * fpsVal));
    try {
      p.contentWindow.postMessage({
        type: "UPDATE_CODE",
        payload: {
          code: code,
          props: c.props || {},
          config: { fps: fpsVal, durationInFrames: durFrames, width: 1080, height: 1920 },
          autoplay: state.playing
        }
      }, "*");
    } catch (e) {}
  }

  function sendFrameToPlayer(frameNum) {
    var p = playerEl();
    if (!p || !p.contentWindow) return;
    try {
      p.contentWindow.postMessage({
        type: "UPDATE_FRAME",
        payload: { frame: frameNum }
      }, "*");
    } catch (e) {}
  }

  function sendStateToPlayer(type) {
    var p = playerEl();
    if (!p || !p.contentWindow) return;
    try {
      p.contentWindow.postMessage({ type: type }, "*");
    } catch (e) {}
  }

  function sendPropsToPlayer(props) {
    var p = playerEl();
    if (!p || !p.contentWindow) return;
    try {
      p.contentWindow.postMessage({
        type: "UPDATE_PROPS",
        payload: { props: props }
      }, "*");
    } catch (e) {}
  }

  window.addEventListener("message", function (e) {
    var data = e.data || {};
    if (data.type === "IFRAME_LOADED") {
      sendActiveTemplateToPlayer();
    }
  });

  /* (re)build the iframe for one clip. keepLocal keeps its current position. */
  function renderClip(i, keepLocal) {
    var box = $("#edFrame");
    var c = state.clips[i];
    if (!box || !c) return;

    // If sandbox player is mounted, sync active code & props directly
    var player = $("#animationPlayer");
    if (player) {
      sendActiveTemplateToPlayer();
      return;
    }

    var old = layerAt(i);
    var at = keepLocal && old ? localTime(old, c) : 0;

    var f = document.createElement("iframe");
    f.className = "ed-lay";
    f.dataset.i = String(i);
    f.title = "Clip " + (i + 1) + " preview: " + clipName(c);
    f.setAttribute("sandbox", "allow-same-origin");
    var isActive = (i === mounted);
    if (!isActive) f.hidden = true; else f.id = "edPreview";
    f.addEventListener("load", function () {
      var a = animsOf(f);
      if (at) a.forEach(function (x) { x.currentTime = at; });
      if (!isActive || !state.playing) {
        a.forEach(function (x) { x.pause(); });
      } else {
        a.forEach(function (x) { x.play(); });
      }
    });
    f.srcdoc = htmlFor(c);

    if (old) old.replaceWith(f);
    else box.appendChild(f);
  }

  /* ── Draft autosave ───────────────────────────────────────
     One draft record per editor session, rewritten in place. Debounced because
     the colour picker and the duration slider fire continuously while dragging,
     and localStorage writes are synchronous. */
  var currentDraftId = null;
  var draftTimer = 0;
  var projectNamed = false;   // true once the title is the person's own

  function draftSnapshot() {
    var nameEl = $("#edProject") || $("#edName");
    return {
      id: currentDraftId,
      name: (nameEl && nameEl.value.trim()) || "Untitled animation",
      aspect: state.aspect,
      clips: state.clips.map(function (c) {
        return {
          tpl: c.tpl,
          lines: Array.isArray(c.lines) ? c.lines.slice() : [],
          accent: c.accent,
          font: c.font,
          dur: c.dur,
          spec: c.spec || null
        };
      })
    };
  }

  function saveDraftNow() {
    if (!window.SC_DRAFTS || !state.clips.length) return;
    var rec = SC_DRAFTS.save(draftSnapshot());
    if (!rec) return;
    // Adopt the id the store minted, so later saves update rather than pile up.
    if (!currentDraftId) {
      currentDraftId = rec.id;
      try {
        history.replaceState(null, "", "/editor?draft=" + encodeURIComponent(rec.id));
      } catch (e) { /* a blocked history write must not lose the save */ }
    }
  }

  function scheduleDraftSave() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraftNow, 600);
  }

  function renderAll(keepLocal) {
    scheduleDraftSave();
    state.clips.forEach(function (c, i) { renderClip(i, keepLocal); });
    var ar = state.aspect.split(":");
    $("#edFrame").style.setProperty("--arw", ar[0]);
    $("#edFrame").style.setProperty("--arh", ar[1]);
  }

  function mount(i) {
    if (i === mounted) return;
    mounted = i;
    layers().forEach(function (f) {
      var active = Number(f.dataset.i) === i;
      f.hidden = !active;
      if (active) f.id = "edPreview"; else if (f.id === "edPreview") f.removeAttribute("id");
      if (!active) animsOf(f).forEach(function (a) { a.pause(); });
    });
    var f2 = layerAt(i);
    if (f2 && state.playing) animsOf(f2).forEach(function (a) { a.play(); });
    sendActiveTemplateToPlayer();
  }

  function queueRender() {
    scheduleDraftSave();
    clearTimeout(renderTimer);
    renderTimer = setTimeout(function () {
      renderClip(state.sel, true);
      sendActiveTemplateToPlayer();
    }, 140);
  }

  /* ── Playback ─────────────────────────────────────────── */
  /* raw currentTime grows monotonically on an infinite CSS animation, so the
     clip-local position is the remainder, and a raw value past the clip length
     means the boundary has been crossed. */
  function localTime(frame, c) {
    var a = animsOf(frame)[0];
    if (!a) return 0;
    var t = Number(a.currentTime) || 0;
    return t % c.dur;
  }

  function rawTime() {
    var a = frameAnims()[0];
    return a ? (Number(a.currentTime) || 0) : 0;
  }

  function setLocal(ms) {
    var c = state.clips[mounted];
    if (!c) return;
    var v = Math.max(0, Math.min(c.dur, ms));
    frameAnims().forEach(function (a) { a.currentTime = v; });
    var frameNum = Math.round((v / 1000) * fps());
    sendFrameToPlayer(frameNum);
  }

  function playhead() {
    var c = state.clips[mounted];
    if (!c) return 0;
    return offsetOf(mounted) + Math.min(c.dur, rawTime() % c.dur);
  }

  /* seek by GLOBAL project time */
  function seekGlobal(ms) {
    var t = total();
    var v = ((ms % t) + t) % t;
    var at = clipAt(v);
    mount(at.i);
    setLocal(at.local);
    return v;
  }

  function fmt(ms) {
    var s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }
  function pad2(n) { return String(n).padStart(2, "0"); }
  function fmtRuler(ms) {
    var s = Math.floor(ms / 1000);
    return pad2(Math.floor(s / 60)) + ":" + pad2(s % 60);
  }
  /* MM:SS:FF, the timecode an editor expects on a clip */
  function fmtTC(ms) {
    var f = Math.round((ms % 1000) / 1000 * fps());
    var s = Math.floor(ms / 1000);
    return pad2(Math.floor(s / 60)) + ":" + pad2(s % 60) + ":" + pad2(f);
  }

  function setPlaying(on) {
    state.playing = on;
    frameAnims().forEach(function (a) { on ? a.play() : a.pause(); });
    sendStateToPlayer(on ? "PLAY" : "PAUSE");
    var btn = $("#edPlay");
    btn.dataset.state = on ? "playing" : "paused";
    btn.setAttribute("aria-label", on ? "Pause" : "Play");
    $("#edPlayIcon").innerHTML = on
      ? '<path d="M8 5h3v14H8zM13 5h3v14h-3z"/>'
      : '<path d="M8 5l11 7-11 7z"/>';
  }

  function tick() {
    rafId = requestAnimationFrame(tick);
    if (scrubbing) return;

    var c = state.clips[mounted];
    if (!c) return;

    // boundary: hand the overshoot to the next clip so the sequence keeps time
    if (state.clips.length > 1 && state.playing) {
      var raw = rawTime();
      if (raw >= c.dur) {
        var over = Math.min(raw - c.dur, c.dur);
        var next = (mounted + 1) % state.clips.length;
        mount(next);
        setLocal(over);
      }
    }

    var ms = playhead();
    $("#edNow").textContent = fmt(ms);
    $("#edSeek").value = String(Math.round((ms / total()) * 1000));
    moveHead(ms);
  }

  /* ── Timeline ─────────────────────────────────────────── */
  function moveHead(ms) {
    var head = $("#edHead");
    if (head) head.style.transform = "translateX(" + (ms / 1000 * pps) + "px)";
  }

  function tickStep() {
    if (pps >= 55) return 1;
    if (pps >= 28) return 2;
    return 5;
  }

  function drawRuler() {
    var ticks = $("#edTicks");
    if (!ticks) return;
    var w = ticks.clientWidth || 600;
    var viewS = total() / 1000 + TAIL_S;
    var step = tickStep();
    var html = "";
    for (var s = 0; s <= viewS + 0.001; s += step / 2) {
      var x = s * pps;
      var major = Math.abs(s / step - Math.round(s / step)) < 0.001;
      html += '<span class="ed-tick ' + (major ? "ed-major" : "ed-minor") +
              '" style="left:' + x.toFixed(1) + 'px"></span>';
      // skip a label that would be clipped by the right edge
      if (major && x < w - 30) {
        html += '<span class="ed-tlabel" style="left:' + x.toFixed(1) + 'px">' +
                fmtRuler(s * 1000) + "</span>";
      }
    }
    ticks.innerHTML = html;
  }

  function drawClips() {
    var wrap = $("#edClips");
    if (!wrap) return;
    wrap.innerHTML = "";
    state.clips.forEach(function (c, i) {
      var el = document.createElement("div");
      el.className = "ed-clip";
      el.dataset.i = String(i);
      el.dataset.ai = c.spec ? "1" : "0";
      el.setAttribute("role", "button");
      el.tabIndex = 0;
      el.setAttribute("aria-current", String(i === state.sel));
      el.setAttribute("aria-label",
        "Clip " + (i + 1) + ": " + clipName(c) + ", " + (c.dur / 1000).toFixed(1) + " seconds");
      el.style.width = Math.max(30, c.dur / 1000 * pps - 3) + "px";

      var segs = "";
      var n = Math.max(3, Math.round(c.dur / 500));
      for (var k = 0; k < n; k++) segs += "<i></i>";

      el.innerHTML =
        '<div class="ed-cliptop">' +
          '<span class="ed-grip" aria-hidden="true"><svg viewBox="0 0 8 12"><circle cx="2" cy="2" r="1"/><circle cx="6" cy="2" r="1"/><circle cx="2" cy="6" r="1"/><circle cx="6" cy="6" r="1"/><circle cx="2" cy="10" r="1"/><circle cx="6" cy="10" r="1"/></svg></span>' +
          '<span class="ed-clipname"></span>' +
          '<span class="ed-clipdur">' + fmtTC(c.dur) + "</span>" +
        "</div>" +
        '<div class="ed-clipfilm" aria-hidden="true">' + segs + "</div>" +
        '<button class="ed-clipdel" type="button" aria-label="Delete clip ' + (i + 1) + '">&#215;</button>' +
        '<button class="ed-cliphandle" type="button" aria-label="Resize clip ' + (i + 1) + '" tabindex="-1"></button>';
      el.querySelector(".ed-clipname").textContent = clipName(c);

      el.addEventListener("click", function (ev) {
        if (ev.target.closest(".ed-clipdel") || ev.target.closest(".ed-cliphandle")) return;
        selectClip(i);
        seekGlobal(offsetOf(i));
      });
      el.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault(); selectClip(i); seekGlobal(offsetOf(i));
        }
      });
      el.querySelector(".ed-clipdel").addEventListener("click", function (ev) {
        ev.stopPropagation(); removeClip(i);
      });
      el.querySelector(".ed-cliphandle").addEventListener("pointerdown", function (ev) {
        ev.preventDefault(); ev.stopPropagation(); beginResize(i, ev);
      });

      wrap.appendChild(el);
    });
  }

  function layout() {
    var ruler = $("#edRuler");
    if (!ruler) return;
    /* Every structural change funnels through here — adding and deleting
       clips, the duration slider, the aspect switch. Hooking the funnel rather
       than each caller is why a clip added a moment before closing the tab is
       still in the draft. (A resize also lands here; the save is debounced and
       writes the same bytes, so it costs nothing.) */
    scheduleDraftSave();
    var w = ruler.clientWidth || 600;
    var add = $("#edAdd");
    // the clip span has to leave room for the Add button, or the lane pushes
    // past the viewport on a phone
    var addW = add ? (add.offsetWidth || 74) + 10 : 0;
    var viewS = total() / 1000 + TAIL_S;
    pps = Math.max(6, (w - addW) / viewS);
    var seek = $("#edSeek");
    if (seek) seek.style.width = (total() / 1000 * pps) + "px";
    drawRuler();
    drawClips();
    moveHead(playhead());
    if (add) {
      var room = MAX_TOTAL - total() >= MIN_DUR;
      add.disabled = !room;
      add.title = room
        ? "Add another clip to the sequence"
        : "The project is at the " + (MAX_TOTAL / 1000) + "s export limit";
    }
    $("#edLen").textContent = fmt(total());
  }

  function beginResize(i, ev) {
    var c = state.clips[i];
    var startX = ev.clientX, startDur = c.dur;
    var budget = MAX_TOTAL - (total() - c.dur);
    var max = Math.min(MAX_DUR, budget);
    var handle = ev.currentTarget;
    try { handle.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }

    function move(e) {
      var d = startDur + (e.clientX - startX) / pps * 1000;
      d = Math.round(d / 100) * 100;
      c.dur = Math.max(MIN_DUR, Math.min(max, d));
      if (i === state.sel) {
        $("#edDur").value = String(Math.min(MAX_DUR, Math.max(2000, c.dur)));
        $("#edDurVal").textContent = (c.dur / 1000).toFixed(1) + "s";
      }
      layout();
    }
    function up() {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      renderClip(i, false);
      status("Clip " + (i + 1) + " is now " + (c.dur / 1000).toFixed(1) + "s.");
    }
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  }

  /* ── Clip list operations ─────────────────────────────── */
  function addClip() {
    var room = MAX_TOTAL - total();
    if (room < MIN_DUR) {
      status("The sequence is already " + (total() / 1000).toFixed(1) + "s — the export limit is " +
        (MAX_TOTAL / 1000) + "s.");
      return;
    }
    var used = state.clips.map(function (c) { return c.tpl; });
    var pick = order.filter(function (id) { return used.indexOf(id) < 0; })[0] || order[0];
    var c = newClip(pick);
    c.dur = Math.min(c.dur, room);
    state.clips.push(c);
    state.sel = state.clips.length - 1;
    renderClip(state.sel, false);
    syncPanel();
    layout();
    seekGlobal(offsetOf(state.sel));
    status("Added clip " + state.clips.length + " — " + meta[pick].name + ".");
  }

  function removeClip(i) {
    if (state.clips.length < 2) {
      status("A project needs at least one clip.");
      return;
    }
    state.clips.splice(i, 1);
    var f = layerAt(i);
    if (f) f.remove();
    // reindex the surviving layers so data-i still matches the clip array
    layers().forEach(function (el, k) {
      el.dataset.i = String(k);
      el.title = "Clip " + (k + 1) + " preview: " + clipName(state.clips[k]);
    });
    mounted = -1;
    state.sel = Math.max(0, Math.min(state.clips.length - 1, i - 1));
    mount(state.sel);
    syncPanel();
    layout();
    seekGlobal(offsetOf(state.sel));
    status("Clip removed.");
  }

  function selectClip(i) {
    state.sel = i;
    syncPanel();
    all(".ed-clip").forEach(function (el) {
      el.setAttribute("aria-current", String(Number(el.dataset.i) === i));
    });
  }

  /* push the selected clip's values into the properties panel */
  function syncPanel() {
    var c = cur();
    if (!c) return;
    var isAi = !!c.spec;
    $("#edTpl").value = isAi ? "" : c.tpl;
    $("#edTpl").disabled = isAi;
    $("#edFont").value = c.font;
    /* Only auto-label a project the person has not named. syncPanel runs on
       every clip select and every add, so an unconditional write here wiped a
       typed title the moment a second clip appeared — and now that drafts are
       saved, it wiped it in storage too. */
    if (!projectNamed) {
      $("#edProject").value = state.clips.length > 1
        ? state.clips.length + " clips"
        : clipName(c);
    }
    setAccent(c.accent);
    $("#edDur").value = String(Math.min(MAX_DUR, Math.max(2000, c.dur)));
    $("#edDurVal").textContent = (c.dur / 1000).toFixed(1) + "s";
    all(".ed-titem").forEach(function (b) {
      b.setAttribute("aria-current", String(!isAi && b.dataset.tpl === c.tpl));
    });
    buildFields();
  }

  var FIELD_EXTRAS = {
    "text-cascade": {
      hints: ["Top intro phrase before hook", "Main impact keyword (large font)", "Accent color payoff line"],
      presets: [
        ["The truth about", "Consistency", "beats motivation"],
        ["Rule #1:", "Discipline", "creates freedom"],
        ["Did you know?", "90% of creators", "give up too early"],
        ["Secret habit:", "Deep Focus", "changes everything"]
      ]
    },
    "mask-wipe": {
      hints: ["Category or channel badge", "Main traveling reveal headline", "Supporting punchline"],
      presets: [
        ["ShortsCraft", "Start today", "Momentum does the rest"],
        ["Daily Lesson", "Ship daily", "Results will follow"],
        ["Creator Tip", "Hook in 2s", "Double your retention"]
      ]
    },
    "ui-toggle": {
      hints: ["Label when switch is OFF", "Label when switch is ON", "Feature explanation caption"],
      presets: [
        ["OFF", "ON", "Turn your idea into a Short"],
        ["FREE", "PRO AI", "Unlock full 4K motion graphics"],
        ["DRAFT", "PUBLISHED", "Automate daily video posting"],
        ["BEFORE", "AFTER", "10x retention with motion typography"]
      ]
    },
    "ios-notify": {
      hints: ["App name or notification sender", "Primary alert headline", "Body preview or call to action"],
      presets: [
        ["YouTube", "Your Short is trending #1", "Tap to view analytics"],
        ["Instagram", "New viral reel reached 100K", "Check performance stats"],
        ["ShortsCraft", "Your AI animation is ready", "Tap to download MP4"],
        ["Stripe", "Payment received +$499", "New Pro subscription active"]
      ]
    },
    "like-burst": {
      hints: ["Counter value before tap", "Counter value after burst", "Metric or action label"],
      presets: [
        ["12,480", "12,481", "Likes"],
        ["99.9K", "100K", "Subscribers"],
        ["4,999", "5,000", "Hearts"],
        ["850", "851", "Shares"]
      ]
    },
    "story-bars": {
      hints: ["Story frame 1 message", "Story frame 2 message", "Story frame 3 payoff"],
      presets: [
        ["Hook them in 3s", "Deliver the value", "Close with a CTA"],
        ["Stop scrolling", "Watch till the end", "Subscribe for Part 2"],
        ["3 Rules to win", "Never give up", "Start today"]
      ]
    },
    "logo-draw": {
      hints: ["Brand monogram / Channel name", "Tagline or channel niche", ""],
      presets: [
        ["ShortsCraft", "Motion Studio", ""],
        ["Vault Media", "YouTube Shorts & Reels", ""],
        ["Apex FX", "AI Motion Designer", ""]
      ]
    },
    "bar-race": {
      hints: ["Top bar metric name", "Second bar metric name", "Third bar metric name"],
      presets: [
        ["Views", "Likes", "Shares"],
        ["Retention", "Watch Time", "Engagement"],
        ["AdSense", "Sponsorships", "Affiliates"]
      ]
    },
    "ring-counter": {
      hints: ["Metric name or milestone", "Target percentage / score", ""],
      presets: [
        ["Retention", "83%", ""],
        ["Goal Completed", "99%", ""],
        ["Battery Level", "100%", ""],
        ["Viral Score", "95%", ""]
      ]
    },
    "cash-stack": {
      hints: ["Revenue period or source", "Target amount or earnings", ""],
      presets: [
        ["This month", "$24K", ""],
        ["AdSense Revenue", "$12,500", ""],
        ["Net Profit", "$50,000", ""],
        ["First 30 Days", "$4,800", ""]
      ]
    },
    "phone-scroll": {
      hints: ["App name header", "Bottom caption / status", ""],
      presets: [
        ["ShortsCraft", "Built for vertical video", ""],
        ["Creator Hub", "Swipe up to discover more", ""],
        ["SaaS Platform", "Automated video pipeline", ""]
      ]
    },
    "countdown": {
      hints: ["Launch reveal title", "Channel or product name", ""],
      presets: [
        ["We are live", "ShortsCraft", ""],
        ["New Short Premiere", "@VaultGamer", ""],
        ["Special Drop", "Link in description", ""]
      ]
    }
  };

  /* ── Controls ─────────────────────────────────────────── */
  function buildFields() {
    var wrap = $("#edFields"), c = cur();
    if (!wrap || !c) return;
    wrap.innerHTML = "";

    // An AI scene has no named content slots — the prompt is the content
    if (c.spec) {
      var box = document.createElement("div");
      box.className = "ed-f";
      var lb = document.createElement("label");
      lb.setAttribute("for", "edAiBrief");
      lb.textContent = "This clip was generated from your prompt";
      var ta = document.createElement("textarea");
      ta.id = "edAiBrief";
      ta.rows = 3;
      ta.readOnly = true;
      ta.value = c.prompt || "(prompt not recorded)";
      box.appendChild(lb); box.appendChild(ta);
      wrap.appendChild(box);

      var again = document.createElement("button");
      again.type = "button";
      again.className = "ed-pbtn";
      again.style.cssText = "width:100%;height:38px;border-radius:999px";
      again.textContent = "Re-roll this scene · " + (cost.animate || 5) + " credits";
      again.addEventListener("click", function () {
        $("#edPrompt").value = c.prompt || "";
        createScene(state.sel);
      });
      wrap.appendChild(again);

      var note = document.createElement("p");
      note.className = "ed-note";
      note.textContent = "Text and colours come from the prompt. Edit the prompt in the box below the stage and re-roll, or change the accent and length here.";
      wrap.appendChild(note);
      return;
    }

    var m = meta[c.tpl];
    if (!m) return;
    if (!c.props) c.props = Object.assign({}, (m.schema && m.schema.defaults) || {});

    var schema = m.schema;
    if (schema && schema.fields && schema.fields.length) {
      schema.fields.forEach(function (field) {
        var f = document.createElement("div");
        f.className = "ed-f ed-f-custom";
        f.dataset.key = field.key;

        var lb = document.createElement("label");
        lb.textContent = field.label;
        f.appendChild(lb);

        var val = c.props[field.key] != null ? c.props[field.key] : (field.default != null ? field.default : "");

        if (field.type === "textarea") {
          var ta = document.createElement("textarea");
          ta.rows = 3;
          ta.value = val;
          ta.placeholder = field.placeholder || "";
          ta.addEventListener("input", function () {
            c.props[field.key] = ta.value;
            queueRender();
          });
          f.appendChild(ta);
        } else if (field.type === "select") {
          var sel = document.createElement("select");
          (field.options || []).forEach(function (opt) {
            var optEl = document.createElement("option");
            optEl.value = opt.val;
            optEl.textContent = opt.label;
            if (String(opt.val) === String(val)) optEl.selected = true;
            sel.appendChild(optEl);
          });
          sel.addEventListener("change", function () {
            c.props[field.key] = sel.value;
            queueRender();
          });
          f.appendChild(sel);
        } else if (field.type === "toggle") {
          var togWrap = document.createElement("label");
          togWrap.className = "ed-tog-wrap";
          togWrap.style.cssText = "display:flex;align-items:center;gap:8px;cursor:pointer;margin-top:4px;";
          var chk = document.createElement("input");
          chk.type = "checkbox";
          chk.checked = Boolean(val);
          chk.style.cssText = "width:18px;height:18px;accent-color:var(--sh-accent);";
          var togSpan = document.createElement("span");
          togSpan.style.cssText = "font-size:13px;color:var(--sh-ink2);";
          togSpan.textContent = chk.checked ? "Enabled (Visible)" : "Disabled (Hidden)";
          chk.addEventListener("change", function () {
            c.props[field.key] = chk.checked;
            togSpan.textContent = chk.checked ? "Enabled (Visible)" : "Disabled (Hidden)";
            queueRender();
          });
          togWrap.appendChild(chk);
          togWrap.appendChild(togSpan);
          f.appendChild(togWrap);
        } else if (field.type === "color") {
          var colRow = document.createElement("div");
          colRow.style.cssText = "display:flex;align-items:center;gap:8px;";
          var colInput = document.createElement("input");
          colInput.type = "color";
          colInput.value = val || "#ffffff";
          colInput.style.cssText = "width:40px;height:36px;padding:0;border:0;border-radius:8px;cursor:pointer;";
          var hexInput = document.createElement("input");
          hexInput.type = "text";
          hexInput.value = val || "#ffffff";
          hexInput.style.cssText = "flex:1;height:36px;";
          colInput.addEventListener("input", function () {
            hexInput.value = colInput.value;
            c.props[field.key] = colInput.value;
            queueRender();
          });
          hexInput.addEventListener("input", function () {
            if (/^#[0-9a-f]{3,6}$/i.test(hexInput.value)) {
              colInput.value = hexInput.value;
              c.props[field.key] = hexInput.value;
              queueRender();
            }
          });
          colRow.appendChild(colInput);
          colRow.appendChild(hexInput);
          f.appendChild(colRow);
        } else if (field.type === "image") {
          var imgRow = document.createElement("div");
          imgRow.className = "ed-img-picker";
          imgRow.style.cssText = "display:flex;align-items:center;gap:10px;margin-top:4px;";

          var prevBox = document.createElement("div");
          prevBox.className = "ed-img-prev";
          prevBox.style.cssText = "width:42px;height:42px;border-radius:10px;background:#18181b;border:1px solid rgba(255,255,255,.15);display:grid;place-items:center;overflow:hidden;flex-shrink:0;font-size:20px;";

          function updatePrev(v) {
            if (typeof v === "string" && (v.indexOf("data:image/") === 0 || v.indexOf("http://") === 0 || v.indexOf("https://") === 0)) {
              prevBox.innerHTML = '<img src="' + esc(v) + '" style="width:100%;height:100%;object-fit:cover;" />';
            } else {
              prevBox.textContent = v || "✦";
            }
          }
          updatePrev(val);

          var txtInput = document.createElement("input");
          txtInput.type = "text";
          txtInput.value = (typeof val === "string" && val.indexOf("data:image/") === 0) ? "(Custom Image)" : (val || "");
          txtInput.placeholder = "Emoji / Text";
          txtInput.style.cssText = "flex:1;height:38px;";
          txtInput.addEventListener("input", function () {
            c.props[field.key] = txtInput.value;
            updatePrev(txtInput.value);
            queueRender();
          });

          var fileBtn = document.createElement("label");
          fileBtn.className = "ed-upload-chip";
          fileBtn.style.cssText = "cursor:pointer;padding:0 12px;height:38px;display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:10px;font-size:12px;font-weight:600;color:#fff;white-space:nowrap;";
          fileBtn.innerHTML = '<span>📁 Upload</span>';
          var fileInput = document.createElement("input");
          fileInput.type = "file";
          fileInput.accept = "image/*";
          fileInput.style.display = "none";
          fileInput.addEventListener("change", function () {
            var file = fileInput.files && fileInput.files[0];
            if (file) {
              var reader = new FileReader();
              reader.onload = function (e) {
                var dataUrl = e.target.result;
                c.props[field.key] = dataUrl;
                txtInput.value = "(Custom Image)";
                updatePrev(dataUrl);
                queueRender();
                status("Uploaded image: " + file.name);
              };
              reader.readAsDataURL(file);
            }
          });
          fileBtn.appendChild(fileInput);

          imgRow.appendChild(prevBox);
          imgRow.appendChild(txtInput);
          imgRow.appendChild(fileBtn);
          f.appendChild(imgRow);
        } else {
          // Default text input
          var input = document.createElement("input");
          input.type = "text";
          input.value = val;
          input.placeholder = field.placeholder || "";
          input.maxLength = 140;
          input.addEventListener("input", function () {
            c.props[field.key] = input.value;
            queueRender();
          });
          f.appendChild(input);
        }

        wrap.appendChild(f);
      });
    } else {
      // Fallback
      m.fields.forEach(function (label, i) {
        if (!label) return;
        var f = document.createElement("div");
        f.className = "ed-f";
        var lb2 = document.createElement("label");
        lb2.setAttribute("for", "edLine" + i);
        lb2.textContent = label;
        var input = document.createElement("input");
        input.type = "text";
        input.id = "edLine" + i;
        input.value = c.lines[i] || "";
        input.placeholder = m.demo[i] || "";
        input.maxLength = 120;
        input.addEventListener("input", function () {
          cur().lines[i] = input.value;
          queueRender();
        });
        f.appendChild(lb2);
        f.appendChild(input);
        wrap.appendChild(f);
      });
    }
  }

  function markSwatch(hex) {
    all(".ed-swb").forEach(function (b) {
      b.setAttribute("aria-pressed",
        String(b.dataset.c.toLowerCase() === String(hex).toLowerCase()));
    });
  }

  function setAccent(hex, fromInput) {
    if (cur()) cur().accent = hex;
    if (!fromInput || fromInput !== "color") $("#edColor").value = hex;
    if (!fromInput || fromInput !== "hex") $("#edHex").value = hex;
    $("#edChip").value = hex;
    markSwatch(hex);
  }

  function setAspect(ar) {
    state.aspect = AR_LABEL[ar] ? ar : "9:16";
    $("#edAspect").value = state.aspect;
    all(".ed-dev").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.ar === state.aspect));
    });
    renderAll(false);
  }

  /* swap the template of the SELECTED clip */
  function setTemplate(id) {
    var m = meta[id];
    if (!m) return;
    var c = cur();
    c.tpl = id;
    c.lines = m.demo.slice(0, 3);
    while (c.lines.length < 3) c.lines.push("");
    c.accent = m.accent;
    var nameEl = $("#edProject") || $("#edName");
    if (id !== "blank") {
      if (nameEl) nameEl.value = m.name;
      history.replaceState(null, "", "/editor?tpl=" + encodeURIComponent(id) +
        "&aspect=" + encodeURIComponent(state.aspect));
    } else {
      if (nameEl) nameEl.value = "Blank Project";
      history.replaceState(null, "", "/editor");
    }
    syncPanel();
    renderClip(state.sel, false);
    layout();
  }

  function status(msg) {
    var el = $("#edStatus");
    if (!el) return;
    el.textContent = msg;
    clearTimeout(status._t);
    status._t = setTimeout(function () { el.textContent = ""; }, 4000);
  }

  var exporting = false;

  /* ── Credits ──────────────────────────────────────────────
     The balance lives on the server: the old build kept it in the browser,
     where clearing storage refilled it. Here we only display it. */
  function paintCredits(st) {
    if (!st) {
      // Graceful default so user never sees a bare dash
      var pill0 = $("#edCredits");
      if (pill0 && $("#edCreditsN")) $("#edCreditsN").textContent = "10";
      return;
    }
    if (st.cost) cost = st.cost;
    var pill = $("#edCredits");
    if ($("#edCreditsN")) $("#edCreditsN").textContent = String(st.left != null ? st.left : 10);
    if (pill) {
      pill.title = (st.left != null ? st.left : 10) + " of " + (st.perDay || 10) + " credits left today · " +
        (st.planLabel || "Free") + " plan · export " + cost.export + ", AI scene " + cost.animate;
      pill.setAttribute("data-low", (st.left < cost.animate) ? "1" : "0");
    }
    if ($("#edAiCost")) $("#edAiCost").textContent = cost.animate + " credits";
    var dl = $("#edDownload");
    if (dl) dl.textContent = "Download MP4 · " + cost.export +
      (cost.export === 1 ? " credit" : " credits");
  }

  function refreshCredits() {
    return fetch("/api/credits", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.success) paintCredits(j); })
      .catch(function () { paintCredits({ left: 10, perDay: 10, planLabel: "Free" }); });
  }

  /* ── Chat history helper ────────────────────────────────── */
  function addChatMessage(role, textOrHtml) {
    var history = $("#edChatHistory");
    if (!history) return null;
    var msg = document.createElement("div");
    msg.className = "ed-msg " + (role === "user" ? "ed-msg-user" : "ed-msg-ai");
    if (role === "ai") {
      msg.innerHTML = '<div class="ed-msg-avatar">✦</div><div class="ed-msg-body">' + textOrHtml + '</div>';
    } else {
      msg.innerHTML = '<div class="ed-msg-body"><p><b>You</b></p><p>' + esc(textOrHtml) + '</p></div>';
    }
    history.appendChild(msg);
    var scroller = $(".ed-ai-scroll");
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
    return msg;
  }

  /* ── AI scene creation ────────────────────────────────────
     replaceIndex: re-roll an existing clip instead of appending one. */
  function createScene(replaceIndex) {
    if (creating) { status("Still generating — one at a time."); return; }
    var prompt = ($("#edPrompt").value || "").trim();
    if (prompt.length < 8) {
      status("Describe the animation in a few more words.");
      $("#edPrompt").focus();
      return;
    }

    if (!state.clips || !state.clips.length) {
      state.clips = [newClip("blank")];
      state.sel = 0;
    }

    var targetClip = (typeof replaceIndex === "number" && state.clips[replaceIndex]) ? state.clips[replaceIndex] : (state.clips[state.sel] || state.clips[0]);
    var appending = (typeof replaceIndex !== "number");
    if (appending && MAX_TOTAL - total() < MIN_DUR) {
      status("The sequence is already at the " + (MAX_TOTAL / 1000) + "s limit — shorten a clip first.");
      return;
    }

    var wanted = targetClip ? (targetClip.dur || 4600) : Math.min(4600, MAX_TOTAL - total());

    creating = true;
    var btn = $("#edCreate");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Designing…";
    }
    status("Designing your animation with NVIDIA AI — please wait 15–25 seconds…");

    addChatMessage("user", prompt);

    var abortCtrl = new AbortController();
    var startTime = Date.now();

    // Render animated thinking skeleton UI
    var aiMsg = addChatMessage("ai",
      '<div class="ed-thinking-box" id="activeThinkingBox">' +
        '<div class="ed-think-head">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>' +
          '<span>Reasoning motion physics…</span>' +
          '<span id="thElapsed" style="margin-left:auto;font-size:11px;color:var(--ink3);font-variant-numeric:tabular-nums;">0s</span>' +
        '</div>' +
        '<div class="ed-shimmer-track"><div class="ed-shimmer-bar"></div></div>' +
        '<div class="ed-think-step active" id="thStep1">✦ Analyzing prompt &amp; typography hierarchy...</div>' +
        '<div class="ed-think-step" id="thStep2">✦ NVIDIA Nemotron reasoning keyframes &amp; springs...</div>' +
        '<div class="ed-think-step" id="thStep3">✦ Compiling &amp; mounting animation scene...</div>' +
        '<div style="display:flex;justify-content:flex-end;margin-top:6px;">' +
          '<button type="button" class="ed-result-btn" id="thCancelBtn" style="font-size:11px;padding:3px 9px;color:var(--ink3);background:transparent;border-color:var(--line);">Cancel</button>' +
        '</div>' +
      '</div>'
    );

    var elapsedInterval = setInterval(function () {
      var sec = Math.floor((Date.now() - startTime) / 1000);
      var el = document.getElementById("thElapsed");
      if (el) el.textContent = sec + "s";
    }, 1000);

    var stepTimers = [
      setTimeout(function () {
        var s1 = document.getElementById("thStep1"), s2 = document.getElementById("thStep2");
        if (s1) { s1.className = "ed-think-step done"; s1.textContent = "✓ Motion structure analyzed"; }
        if (s2) { s2.className = "ed-think-step active"; }
      }, 3500),
      setTimeout(function () {
        var s2 = document.getElementById("thStep2"), s3 = document.getElementById("thStep3");
        if (s2) { s2.className = "ed-think-step done"; s2.textContent = "✓ NVIDIA Nemotron reasoning complete"; }
        if (s3) { s3.className = "ed-think-step active"; }
      }, 10000),
      setTimeout(function () {
        var s3 = document.getElementById("thStep3");
        if (s3) { s3.className = "ed-think-step active"; s3.textContent = "✦ Rendering & mounting to canvas..."; }
      }, 18000)
    ];

    function cleanup() {
      clearInterval(elapsedInterval);
      stepTimers.forEach(function (t) { clearTimeout(t); });
    }

    var cancelBtn = document.getElementById("thCancelBtn");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", function () {
        abortCtrl.abort();
        cleanup();
        creating = false;
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l1.9 5.4 5.6 1.6-4.4 3.6 1 5.9-4.1-3-4.1 3 1-5.9L4.5 9.5l5.6-1.6L12 2.5Z"/></svg> Create / Refine';
        }
        if (aiMsg) {
          var bodyEl = aiMsg.querySelector(".ed-msg-body");
          if (bodyEl) {
            bodyEl.innerHTML = '<p style="color:var(--ink3);margin:0 0 6px;">Generation cancelled.</p>' +
              '<button type="button" class="ed-result-btn" id="chatRetryBtn">Retry prompt</button>';
            var retBtn = bodyEl.querySelector("#chatRetryBtn");
            if (retBtn) retBtn.addEventListener("click", function () { $("#edPrompt").value = prompt; createScene(replaceIndex); });
          }
        }
      });
    }

    // 75s automatic client timeout
    var clientTimeout = setTimeout(function () {
      abortCtrl.abort();
    }, 75000);

    fetch("/api/animate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: abortCtrl.signal,
      body: JSON.stringify({
        prompt: prompt,
        dur: wanted,
        quality: $("#edQuality").value,
        image: attached ? attached.dataUrl : null
      })
    }).then(function (r) {
      clearTimeout(clientTimeout);
      return r.json().then(function (j) {
        if (!r.ok || !j.success) {
          var e = new Error(j.error || "Could not create that animation.");
          e.credits = j.credits;
          throw e;
        }
        return j;
      });
    }).then(function (j) {
      cleanup();
      paintCredits(j.credits);
      var scene = j.scene;
      var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      var clip = {
        tpl: null, spec: scene, prompt: prompt,
        lines: [], accent: scene.accent || "#ffffff",
        font: cur() ? cur().font : "inter",
        dur: wanted
      };
      if (appending) {
        state.clips.push(clip);
        state.sel = state.clips.length - 1;
        renderClip(state.sel, false);
      } else {
        clip.dur = state.clips[replaceIndex].dur;
        state.clips[replaceIndex] = clip;
        state.sel = replaceIndex;
        renderClip(replaceIndex, false);
      }
      syncPanel();
      layout();
      seekGlobal(offsetOf(state.sel));
      setPlaying(true);
      status('"' + (scene.name || "Custom animation") + '" is ready on the canvas!');

      if (aiMsg) {
        var bodyEl = aiMsg.querySelector(".ed-msg-body");
        if (bodyEl) {
          bodyEl.innerHTML =
            '<div class="ed-ai-result-card">' +
              '<div class="ed-result-head">' +
                '<b>' + esc(scene.name || "Custom animation") + '</b>' +
                '<span class="ed-result-badge">⚡ ' + elapsed + 's</span>' +
              '</div>' +
              '<p style="color:var(--ink2);font-size:12.5px;margin:2px 0 6px;">' +
                'Generated &amp; mounted on canvas (' + (wanted / 1000).toFixed(1) + 's loop) with accent ' +
                '<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:' + (scene.accent || "#fff") + ';vertical-align:middle;margin:0 2px;"></span>' +
                '<b style="color:#fff">' + (scene.accent || "#ffffff") + '</b>' +
              '</p>' +
              '<div class="ed-result-actions">' +
                '<button type="button" class="ed-result-btn primary" id="chatExportBtn">Export MP4</button>' +
                '<button type="button" class="ed-result-btn" id="chatRerollBtn">Re-roll</button>' +
              '</div>' +
            '</div>';

          var expBtn = bodyEl.querySelector("#chatExportBtn");
          if (expBtn) {
            expBtn.addEventListener("click", function () {
              var topExp = $("#edExport");
              if (topExp) topExp.click();
            });
          }
          var reBtn = bodyEl.querySelector("#chatRerollBtn");
          if (reBtn) {
            reBtn.addEventListener("click", function () {
              $("#edPrompt").value = prompt;
              createScene(state.sel);
            });
          }
        }
      }
      $("#edPrompt").value = "";
    }).catch(function (err) {
      cleanup();
      clearTimeout(clientTimeout);
      if (err.credits) paintCredits(err.credits);
      var errMsg = err.name === "AbortError" ? "Generation request timed out or was cancelled." : (err.message || "Could not create that animation.");
      status(errMsg);
      if (aiMsg) {
        var bodyEl = aiMsg.querySelector(".ed-msg-body");
        if (bodyEl) {
          bodyEl.innerHTML =
            '<p style="color:#ff5d3b;margin:0 0 6px;"><b>' + esc(errMsg) + '</b></p>' +
            '<button type="button" class="ed-result-btn" id="chatRetryBtn">Retry prompt</button>';
          var retBtn = bodyEl.querySelector("#chatRetryBtn");
          if (retBtn) {
            retBtn.addEventListener("click", function () {
              $("#edPrompt").value = prompt;
              createScene(replaceIndex);
            });
          }
        }
      }
    }).finally(function () {
      creating = false;
      if (btn) {
        btn.disabled = false;
        btn.innerHTML =
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l1.9 5.4 5.6 1.6-4.4 3.6 1 5.9-4.1-3-4.1 3 1-5.9L4.5 9.5l5.6-1.6L12 2.5Z"/></svg> ' +
          'Create / Refine';
      }
    });
  }

  function attachImage(file) {
    if (!file) return;
    if (!/^image\/(png|jpeg|jpg|webp|gif)$/.test(file.type)) {
      status("Attach a png, jpeg, webp or gif.");
      return;
    }
    if (file.size > 900 * 1024) {
      status("That image is " + Math.round(file.size / 1024) + " KB — keep it under 900 KB.");
      return;
    }
    var fr = new FileReader();
    fr.onload = function () {
      attached = { name: file.name, dataUrl: String(fr.result) };
      $("#edImgName").textContent = file.name;
      $("#edImgClear").hidden = false;
      status("Image attached — it will be animated inside the scene.");
    };
    fr.onerror = function () { status("Could not read that file."); };
    fr.readAsDataURL(file);
  }

  function clearImage() {
    attached = null;
    $("#edImg").value = "";
    $("#edImgClear").hidden = true;
  }

  function exportMp4() {
    if (exporting) { status("Already rendering — hang on."); return; }
    exporting = true;

    var btn = $("#edDownload");
    var top = $("#edExport");
    var msg = $("#exportMsg");
    var label = btn ? btn.innerHTML : "Render & Download MP4";
    if (btn) { btn.disabled = true; btn.textContent = "Rendering frame-by-frame…"; }
    if (top) top.disabled = true;
    if (msg) { msg.className = "ed-modal-msg"; msg.textContent = "Rendering video on high-performance server…"; }

    var payload = {
      aspect: state.aspect,
      res: Number(($("#edRes") || {}).value || 1080),
      fps: fps(),
      clips: state.clips.map(function (c) {
        if (c.spec) {
          return {
            spec: c.spec, accent: c.accent, dur: c.dur, font: c.font,
            quality: c.quality || "mini"
          };
        }
        return {
          tpl: c.tpl, lines: c.lines, props: c.props, accent: c.accent, dur: c.dur, font: c.font
        };
      })
    };

    status("Rendering MP4 on server. This takes 4–8 seconds…");

    fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) {
        return r.json().then(function (j) {
          throw new Error(j.error || "Export failed with HTTP " + r.status);
        });
      }
      var rem = r.headers.get("X-Credits-Left");
      if (rem != null && !isNaN(Number(rem))) {
        $("#edCreditsN").textContent = rem;
      }
      return r.blob();
    }).then(function (blob) {
      if (!blob || blob.size < 1000) throw new Error("Export produced an empty file.");
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "shortscraft-" + (state.clips[0].tpl || "custom") + "-" +
        state.aspect.replace(":", "x") + ".mp4";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 8000);
      status("Downloaded! Ready to post.");
      if (msg) {
        msg.className = "ed-modal-msg success";
        msg.textContent = "🎉 Video rendered and downloaded successfully!";
      }
      refreshCredits();
      setTimeout(function () {
        var modal = $("#exportModal");
        if (modal) modal.hidden = true;
      }, 2000);
    }).catch(function (err) {
      status(err.message || "Export failed.");
      if (msg) {
        msg.className = "ed-modal-msg error";
        msg.textContent = "❌ " + (err.message || "Export failed.");
      }
      refreshCredits();
    }).finally(function () {
      exporting = false;
      if (btn) { btn.disabled = false; btn.innerHTML = label; }
      if (top) top.disabled = false;
    });
  }

  /* ── Boot ─────────────────────────────────────────────── */
  function init() {
    var e = engine();
    if (!e) return;

    var list = e.list(true);
    order = list.map(function (t) { return t.id; });
    list.forEach(function (t) { meta[t.id] = t; });

    // right-panel template select, grouped
    var sel = $("#edTpl");
    if (sel) {
      sel.innerHTML = "";
      var bOp = document.createElement("option");
      bOp.value = "blank";
      bOp.textContent = "✦ Blank Canvas";
      sel.appendChild(bOp);

      e.cats().forEach(function (c) {
        var group = list.filter(function (t) { return t.cat === c.id && t.id !== "blank"; });
        if (!group.length) return;
        var og = document.createElement("optgroup");
        og.label = c.label;
        group.forEach(function (t) {
          var op = document.createElement("option");
          op.value = t.id; op.textContent = t.name;
          og.appendChild(op);
        });
        sel.appendChild(og);
      });
      sel.addEventListener("change", function () { setTemplate(sel.value); });
    }

    // left rail
    var rail = $("#edRail");
    if (rail) {
      rail.innerHTML = "";
      e.cats().forEach(function (c) {
        var group = list.filter(function (t) { return t.cat === c.id && t.id !== "blank"; });
        if (!group.length) return;
        var h = document.createElement("div");
        h.className = "ed-tgroup"; h.textContent = c.label;
        rail.appendChild(h);
        group.forEach(function (t) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "ed-titem";
          b.dataset.tpl = t.id;
          b.setAttribute("aria-current", "false");
          b.innerHTML = '<span class="ed-tdot"></span>';
          b.appendChild(document.createTextNode(t.name));
          b.addEventListener("click", function () { setTemplate(t.id); });
          rail.appendChild(b);
        });
      });
    }

    // fonts
    var fsel = $("#edFont");
    e.fonts().forEach(function (f) {
      var op = document.createElement("option");
      op.value = f.id; op.textContent = f.label;
      fsel.appendChild(op);
    });
    fsel.addEventListener("change", function () {
      cur().font = fsel.value;
      renderClip(state.sel, true);
    });

    // aspect select
    var asel = $("#edAspect");
    e.aspects().forEach(function (ar) {
      var op = document.createElement("option");
      op.value = ar; op.textContent = AR_LABEL[ar] || ar;
      asel.appendChild(op);
    });
    asel.addEventListener("change", function () { setAspect(asel.value); });

    // swatches
    var sw = $("#edSwatches");
    SWATCHES.forEach(function (hex) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "ed-swb"; b.dataset.c = hex;
      b.style.background = hex;
      b.setAttribute("aria-label", "Accent " + hex);
      b.addEventListener("click", function () {
        setAccent(hex); renderClip(state.sel, true);
      });
      sw.appendChild(b);
    });

    // device buttons
    all(".ed-dev").forEach(function (b) {
      b.addEventListener("click", function () { setAspect(b.dataset.ar); });
    });

    // colour inputs
    $("#edColor").addEventListener("input", function (ev) {
      setAccent(ev.target.value, "color"); queueRender();
    });
    $("#edChip").addEventListener("input", function (ev) {
      setAccent(ev.target.value, "chip"); queueRender();
    });
    $("#edHex").addEventListener("change", function (ev) {
      var v = ev.target.value.trim();
      if (!/^#[0-9a-f]{6}$/i.test(v)) { ev.target.value = cur().accent; return; }
      setAccent(v, "hex"); renderClip(state.sel, true);
    });

    // duration of the selected clip
    var dur = $("#edDur");
    dur.addEventListener("input", function () {
      var budget = MAX_TOTAL - (total() - cur().dur);
      var v = Math.min(Number(dur.value), budget);
      if (v !== Number(dur.value)) {
        dur.value = String(v);
        status("Capped at the " + (MAX_TOTAL / 1000) + "s project limit.");
      }
      cur().dur = v;
      $("#edDurVal").textContent = (v / 1000).toFixed(1) + "s";
      layout();
      queueRender();
    });

    // playback
    $("#edPlay").addEventListener("click", function () { setPlaying(!state.playing); });
    $("#edRestart").addEventListener("click", function () {
      seekGlobal(0); setPlaying(true); status("Restarted.");
    });
    $("#edAdd").addEventListener("click", addClip);

    // timeline scrubber
    var seekEl = $("#edSeek");
    if (seekEl) {
      /* `scrubbing` suspends tick()'s own redraw so playback cannot fight a
         drag in progress. It is owned by the POINTER, not by "input" — an
         arrow-key seek fires input with no pointerup to clear the flag, which
         would freeze the playhead until the slider lost focus. Every input
         moves the head itself, so the line follows the drag either way. */
      var seekTo = function () {
        var ms = (Number(seekEl.value) / 1000) * total();
        var landed = seekGlobal(ms);
        moveHead(landed);
        $("#edNow").textContent = fmt(landed);
      };
      seekEl.addEventListener("pointerdown", function () { scrubbing = true; });
      window.addEventListener("pointerup", function () { scrubbing = false; });
      seekEl.addEventListener("input", seekTo);
      seekEl.addEventListener("change", function () { scrubbing = false; seekTo(); });
    }

    /* ── AI composer ─────────────────────────────────────── */
    var promptEl = $("#edPrompt");
    if (promptEl) {
      promptEl.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" && !ev.shiftKey) {
          ev.preventDefault();
          createScene(state.sel);
        }
      });
    }

    var createBtn = $("#edCreate") || $("#edSend");
    if (createBtn) {
      createBtn.addEventListener("click", function (ev) {
        ev.preventDefault();
        createScene(state.sel);
      });
    }

    var aiForm = $("#edAi");
    if (aiForm) {
      aiForm.addEventListener("submit", function (ev) {
        ev.preventDefault();
        createScene(state.sel);
      });
    }

    // suggestions chip clicks fill the prompt and focus it
    all(".ed-pill-prompt, .ed-chip-sug").forEach(function (b) {
      b.addEventListener("click", function () {
        if (promptEl) { promptEl.value = b.textContent.trim(); promptEl.focus(); }
      });
    });

    // image attach
    var imgInput = $("#edImg") || $("#edImgFile");
    if (imgInput) {
      imgInput.addEventListener("change", function () {
        var file = imgInput.files && imgInput.files[0];
        if (!file) return;
        if (file.size > 8 * 1024 * 1024) { status("Image is over 8MB limit."); return; }
        var reader = new FileReader();
        reader.onload = function () {
          attached = { name: file.name, dataUrl: String(reader.result) };
          var nameSpan = $("#edImgName");
          if (nameSpan) nameSpan.textContent = file.name;
          var clearBtn = $("#edImgClear");
          if (clearBtn) clearBtn.hidden = false;
        };
        reader.readAsDataURL(file);
      });
    }

    var imgClearBtn = $("#edImgClear");
    if (imgClearBtn) {
      imgClearBtn.addEventListener("click", function () {
        attached = null;
        var nameSpan = $("#edImgName");
        if (nameSpan) nameSpan.textContent = "image";
        imgClearBtn.hidden = true;
        if (imgInput) imgInput.value = "";
      });
    }

    // project rename
    var projInput = $("#edProject") || $("#edName");
    if (projInput) {
      projInput.addEventListener("input", function (ev) {
        document.title = (ev.target.value.trim() || "Editor") + " — ShortsCraft";
        projectNamed = ev.target.value.trim() !== "";
        scheduleDraftSave();
      });
    }

    // keyboard: Space toggles play/pause unless typing in a field
    window.addEventListener("keydown", function (ev) {
      if (ev.key !== " " && ev.code !== "Space") return;
      var t = ev.target;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      if (t && t.closest && t.closest("button")) return;
      ev.preventDefault();
      setPlaying(!state.playing);
    });

    window.addEventListener("resize", function () { layout(); });

    /* The debounce is the whole risk: closing the tab a moment after an edit
       would drop it. pagehide fires on close, navigation and mobile Safari
       backgrounding, where an unload handler does not. */
    window.addEventListener("pagehide", saveDraftNow);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") saveDraftNow();
    });

    // export / reset
    wireExportModal();
    $("#edReset").addEventListener("click", function () {
      var keep = state.clips[0].tpl;
      layers().forEach(function (f) { f.remove(); });
      state.clips = [newClip(keep)];
      state.sel = 0; mounted = -1;
      dur.value = "4600";
      fsel.value = "inter";
      mounted = 0;
      renderAll(false);
      syncPanel();
      layout();
      setPlaying(true);
      status("Reset to defaults.");
    });

    wirePublishModal();

    // intent from the gallery / landing composer / community templates
    var q = new URLSearchParams(location.search);
    var tpl = q.get("tpl") || q.get("style") || q.get("t") || q.get("template") || "";
    var ar = q.get("aspect") || "";
    var topic = q.get("topic") || "";
    var qLines = q.get("lines");
    var qAccent = q.get("accent");
    var qFont = q.get("font");
    var qDur = q.get("dur");

    try { localStorage.removeItem("sc_pending_prompt"); } catch (e) {}

    // an image picked on the home page travels in sessionStorage
    try {
      var pend = sessionStorage.getItem("sc_pending_image");
      if (pend && /^data:image\//.test(pend)) {
        attached = { name: "attached image", dataUrl: pend };
        $("#edImgName").textContent = "attached image";
        $("#edImgClear").hidden = false;
        sessionStorage.removeItem("sc_pending_image");
      }
    } catch (err) { /* ignore */ }

    state.aspect = AR_LABEL[ar] ? ar : "9:16";
    $("#edAspect").value = state.aspect;
    all(".ed-dev").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.ar === state.aspect));
    });

    // Default to a high-energy starter template if opened directly
    var activeTpl = (tpl && meta[tpl] && tpl !== "blank") ? tpl : "text-cascade";
    state.clips = [newClip(activeTpl)];
    state.sel = 0;
    mounted = 0;

    var nameEl = $("#edProject") || $("#edName");
    if (activeTpl === "blank") {
      if (nameEl) nameEl.value = "Blank Project";
      var pf0 = $("#edPrompt");
      if (pf0) pf0.value = topic ? topic.slice(0, 600) : "";
    } else {
      if (nameEl) nameEl.value = meta[activeTpl] ? meta[activeTpl].name : "Custom Animation";
    }

    if (qLines) {
      try {
        var parsed = JSON.parse(qLines);
        if (Array.isArray(parsed)) {
          parsed.forEach(function (v, i) { if (v != null) state.clips[0].lines[i] = String(v); });
        }
      } catch (e) { /* ignore */ }
    }
    if (qAccent) state.clips[0].accent = qAccent;
    if (qFont && (qFont === "grotesk" || qFont === "inter")) state.clips[0].font = qFont;
    if (qDur && Number(qDur) >= 2000 && Number(qDur) <= 9000) state.clips[0].dur = Number(qDur);

    if (topic) {
      var tMeta = meta[state.clips[0].tpl];
      if (tMeta && Array.isArray(tMeta.fields)) {
        var slot = tMeta.fields[1] ? 1 : 0;
        state.clips[0].lines[slot] = topic.slice(0, 120);
      }
      var pf = $("#edPrompt");
      if (pf) pf.value = topic.slice(0, 600);
    }

    /* ?draft=<id> reopens saved work, and it wins over ?tpl= because someone
       coming back to a project means to resume it, not start its first clip
       again. Everything above has already built a valid single-clip state, so
       a missing or corrupt draft simply falls through to that. */
    var draftId = q.get("draft");
    var restored = null;
    if (draftId && window.SC_DRAFTS) restored = SC_DRAFTS.get(draftId);
    if (restored && Array.isArray(restored.clips) && restored.clips.length) {
      state.clips = restored.clips.map(function (c) {
        var base = newClip(meta[c.tpl] ? c.tpl : "blank");
        base.lines = Array.isArray(c.lines) ? c.lines.slice() : base.lines;
        base.accent = c.accent || base.accent;
        base.font = c.font || base.font;
        base.dur = Number(c.dur) > 0 ? Number(c.dur) : base.dur;
        if (c.spec) base.spec = c.spec;
        return base;
      });
      state.sel = 0;
      mounted = 0;
      state.aspect = restored.aspect || state.aspect;
      currentDraftId = restored.id;
      if (nameEl) nameEl.value = restored.name || "Untitled animation";
      projectNamed = true;
    }

    renderAll(false);
    syncPanel();
    layout();

    if (restored) {
      history.replaceState(null, "", "/editor?draft=" + encodeURIComponent(restored.id));
    } else if (activeTpl !== "blank") {
      history.replaceState(null, "", "/editor?tpl=" + encodeURIComponent(activeTpl) +
        "&aspect=" + encodeURIComponent(state.aspect));
    } else {
      history.replaceState(null, "", "/editor");
    }

    // From here on every edit is remembered, including this opening state.
    scheduleDraftSave();

    refreshCredits();
    cancelAnimationFrame(rafId);
    tick();

    var qMode = q.get("mode");
    if (qMode === "ai" && topic) {
      setTimeout(function () {
        createScene();
      }, 400);
    }
  }

  function wireExportModal() {
    var modal = $("#exportModal");
    var openBtn = $("#edExport");
    var closeBtn = $("#exportClose");
    var cancelBtn = $("#exportCancel");
    var downloadBtn = $("#edDownload");
    var msg = $("#exportMsg");

    if (!modal || !openBtn) return;

    openBtn.addEventListener("click", function () {
      if (msg) { msg.textContent = ""; msg.className = "ed-modal-msg"; }
      var aspectEl = $("#edExportAspect");
      if (aspectEl) aspectEl.textContent = AR_LABEL[state.aspect] || state.aspect;
      var durEl = $("#edExportDur");
      if (durEl) durEl.textContent = (total() / 1000).toFixed(1) + "s";
      modal.hidden = false;
    });

    function close() {
      if (!exporting) modal.hidden = true;
    }

    if (closeBtn) closeBtn.addEventListener("click", close);
    if (cancelBtn) cancelBtn.addEventListener("click", close);

    modal.addEventListener("click", function (ev) {
      if (ev.target === modal) close();
    });

    if (downloadBtn) {
      downloadBtn.addEventListener("click", function () {
        exportMp4();
      });
    }
  }

  function wirePublishModal() {
    var modal = $("#publishModal");
    var openBtn = $("#edPublishOpen");
    var closeBtn = $("#publishClose");
    var cancelBtn = $("#publishCancel");
    var form = $("#publishForm");
    var msg = $("#pubMsg");

    if (!modal || !openBtn || !form) return;

    openBtn.addEventListener("click", function () {
      var c = cur();
      var tName = c.spec ? c.spec.name : (meta[c.tpl] ? meta[c.tpl].name : "Custom");
      var tCat = meta[c.tpl] ? meta[c.tpl].cat : "text";
      var tDesc = meta[c.tpl] ? meta[c.tpl].desc : "";

      $("#pubTitle").value = tName + " Custom";
      $("#pubCategory").value = tCat;
      $("#pubDesc").value = tDesc;
      if (msg) { msg.textContent = ""; msg.className = "ed-modal-msg"; }
      modal.hidden = false;
    });

    function close() { modal.hidden = true; }
    if (closeBtn) closeBtn.addEventListener("click", close);
    if (cancelBtn) cancelBtn.addEventListener("click", close);

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var c = cur();
      var submitBtn = $("#publishSubmit");
      var label = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = "Publishing…";

      var payload = {
        title: $("#pubTitle").value.trim(),
        category: $("#pubCategory").value,
        description: $("#pubDesc").value.trim(),
        authorHandle: $("#pubAuthor").value.trim() || "creator",
        tpl: c.tpl || "text-cascade",
        lines: c.lines || [],
        accent: c.accent || "#ffffff",
        font: c.font || "inter",
        dur: c.dur || 4600
      };

      fetch("/api/community-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.success) {
          if (msg) {
            msg.className = "ed-modal-msg success";
            msg.innerHTML = '🎉 Published! <a href="/community" style="color:#34d17a;text-decoration:underline;margin-left:6px;" target="_blank">View on Community Gallery →</a>';
          }
          submitBtn.textContent = "Published!";
          status("Template published to Community!");
          setTimeout(function () {
            close();
            submitBtn.disabled = false;
            submitBtn.textContent = label;
          }, 2500);
        } else {
          throw new Error(res.error || "Could not publish template.");
        }
      })
      .catch(function (err) {
        if (msg) {
          msg.className = "ed-modal-msg error";
          msg.textContent = err.message;
        }
        submitBtn.disabled = false;
        submitBtn.textContent = label;
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
