/* ============================================================
   ShortsCraft — Templates v2 (Creator Motion Graphics Engine)
   80 Ultra-Premium Creator Motion Templates (10 per category) + Blank Canvas
   Built specifically for YouTube Shorts, Reels & Documentary Editors.
   
   Categories:
     1. Documentary & Retro (docu)
     2. Paper & Cutout Craft (paper)
     3. Kinetic Text & Hooks (text)
     4. Maps & Radar (maps)
     5. Finance & Economy (money)
     6. UI & Devices (ui)
     7. Social Proof & Viral (social)
     8. Charts & Infographics (charts)
   ============================================================ */
window.SC_TPL2 = (function () {
  "use strict";

  var CATS = [
    { id: "docu",    label: "Documentary & Retro" },
    { id: "paper",   label: "Paper & Cutout" },
    { id: "text",    label: "Kinetic Text & Hooks" },
    { id: "maps",    label: "Maps & Radar" },
    { id: "money",   label: "Finance & Economy" },
    { id: "ui",      label: "UI & Devices" },
    { id: "social",  label: "Social Proof & Viral" },
    { id: "charts",  label: "Charts & Infographics" }
  ];

  var AR = {
    "9:16": [9, 16], "16:9": [16, 9], "1:1": [1, 1],
    "4:5": [4, 5], "3:4": [3, 4], "2:3": [2, 3], "21:9": [21, 9]
  };

  var FONTS = [
    { id: "inter",   label: "Inter",         stack: 'Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif' },
    { id: "grotesk", label: "Space Grotesk", stack: '"Space Grotesk",Inter,system-ui,sans-serif' },
    { id: "roboto",  label: "Roboto",        stack: 'Roboto,Inter,system-ui,sans-serif' },
    { id: "serif",   label: "Georgia Serif", stack: 'Georgia,"Times New Roman",serif' },
    { id: "mono",    label: "Monospace",     stack: 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace' }
  ];

  function fontStack(id) {
    for (var i = 0; i < FONTS.length; i++) if (FONTS[i].id === id) return FONTS[i].stack;
    return FONTS[0].stack;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function words(line) {
    return String(line || "").split(/\s+/).filter(Boolean);
  }

  function getP(o, key, fallback) {
    if (o && o.p && o.p[key] != null && String(o.p[key]).trim() !== "") {
      return o.p[key];
    }
    if (o && o.props && o.props[key] != null && String(o.props[key]).trim() !== "") {
      return o.props[key];
    }
    return fallback != null ? fallback : "";
  }

  function renderAvatar(val, fallback, css) {
    var v = val != null && String(val).trim() !== "" ? String(val) : (fallback || "✦");
    if (typeof v === "string" && (v.indexOf("data:image/") === 0 || v.indexOf("http://") === 0 || v.indexOf("https://") === 0)) {
      return '<img src="' + esc(v) + '" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;' + (css || "") + '" alt="Avatar"/>';
    }
    return '<span style="' + (css || "") + '">' + esc(v) + '</span>';
  }

  /* ── Shared base CSS ──────────────────────────────────── */
  function base(t, o) {
    var ar = AR[o.aspect] || AR["9:16"];
    return ''
      + '*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}'
      + 'html,body{width:100%;height:100%;overflow:hidden;background:#08080a}'
      + 'body{display:grid;place-items:center;'
      + 'font-family:' + fontStack(o.font) + ';'
      + '-webkit-font-smoothing:antialiased;'
      + '-moz-osx-font-smoothing:grayscale;'
      + 'text-rendering:optimizeLegibility}'
      + '.vp{position:relative;overflow:hidden;container-type:size;'
      + 'width:min(100vw,calc(100vh * ' + ar[0] + ' / ' + ar[1] + '));'
      + 'height:min(100vh,calc(100vw * ' + ar[1] + ' / ' + ar[0] + '));'
      + 'background:' + (t.dark ? 'radial-gradient(ellipse at 50% 30%, #151522 0%, #08080d 100%)' : 'radial-gradient(ellipse at 50% 30%, #ffffff 0%, #f0f0f4 100%)') + ';'
      + 'color:' + (t.dark ? '#fff' : '#0a0a0a') + ';'
      + '--ac:' + o.accent + ';'
      + '--fg:' + (t.dark ? '#fff' : '#0a0a0a') + ';'
      + '--dim:' + (t.dark ? 'rgba(255,255,255,.55)' : 'rgba(10,10,10,.55)') + ';'
      + '--hair:' + (t.dark ? 'rgba(255,255,255,.14)' : 'rgba(10,10,10,.12)') + ';'
      + '--surf:' + (t.dark ? 'rgba(255,255,255,.07)' : 'rgba(10,10,10,.05)') + ';'
      + '--D:' + o.dur + 'ms;'
      + '--sp:cubic-bezier(.16,1,.3,1);'
      + '--ov:cubic-bezier(.34,1.56,.64,1);'
      + '--ae-expo:cubic-bezier(.16,1,.3,1);'
      + '--ae-spring:cubic-bezier(.34,1.56,.64,1);'
      + '--ae-snap:cubic-bezier(.12,.9,.15,1);'
      + '--ae-smooth:cubic-bezier(.4,0,.2,1);'
      + '--ae-recoil:cubic-bezier(.68,-.6,.32,1.6);'
      + 'transform-style:preserve-3d;perspective:1000px;'
      + '}'
      + '.cv{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);'
      + 'width:auto;height:100%;aspect-ratio:9/16;max-width:100%;max-height:100%;'
      + 'container-type:size;overflow:hidden;display:flex;align-items:center;justify-content:center}'
      + '.wm{position:absolute;left:0;right:0;bottom:2.2cqh;text-align:center;'
      + 'font-size:1.8cqw;letter-spacing:.25em;text-transform:uppercase;font-weight:700;'
      + 'color:var(--dim);opacity:.45;pointer-events:none;z-index:90}'
      + '@media(prefers-reduced-motion:reduce){*{animation-duration:.001ms!important;'
      + 'animation-iteration-count:1!important}}';
  }

  /* ── Template Registry ────────────────────────────────── */
  var T = {};

  /* 0 ── Blank Canvas starter */
  T["blank"] = {
    name: "Blank Canvas", cat: "docu", dark: true, accent: "#ffffff",
    desc: "Start with a clean blank canvas or generate an animation with AI",
    css: '.bk{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2.5cqh;padding:8cqw;text-align:center}.bk .icon{width:18cqw;height:18cqw;border-radius:50%;background:rgba(255,255,255,.05);border:1px dashed rgba(255,255,255,.2);display:grid;place-items:center;font-size:7.5cqw;color:var(--dim);margin-bottom:1cqh}.bk h2{font-size:6.8cqw;font-weight:750;letter-spacing:-.03em;color:#fff;margin:0}.bk p{font-size:3.6cqw;color:var(--dim);margin:0;line-height:1.45;max-width:85%}',
    html: function (o) {
      return '<div class="bk"><div class="icon">✦</div><h2>' + esc(o.lines[0] || "Blank Canvas") + '</h2><p>' + esc(o.lines[1] || "Select a template or generate with AI.") + '</p></div>';
    }
  };

  /* ============================================================
     AUTOAE EXACT 4-SCENE MASTER SUITE
     Matches: z2dugjhz-6311bd0c8643a51afd55495ef5a024116614b904.mp4
     ============================================================ */

  T["autoae-exact-master"] = {
    name: "AutoAE 4-Scene Masterpiece", cat: "ui", dark: true, accent: "#ffffff",
    desc: "Exact 1:1 AutoAE 4-scene video template: 1. ChatGPT Prompt Fly-In, 2. Wireframe Search Stream, 3. 3D Blue Evidence Board, 4. 3D Wall Clock in Light Beam",
    css: '.sc-master-wrap{position:absolute;inset:0;background:#000000;color:#ffffff;overflow:hidden;font-family:Inter,system-ui,sans-serif}'
      + '.sc-master-scene{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;opacity:0;pointer-events:none}'
      
      /* Scene 1: ChatGPT Prompt Fly-In (0% - 25%) */
      + '.sc-m-s1{animation:mScene1 var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-cg-brand{font-size:8cqw;font-weight:900;letter-spacing:-.02em;color:#ffffff;margin-bottom:2.5cqh;text-align:center}'
      + '.sc-cg-pill{width:86cqw;background:#323232;border-radius:6cqw;padding:3cqh 5cqw;box-shadow:0 30px 70px rgba(0,0,0,.9);border:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:2.5cqh}'
      + '.sc-cg-input{font-size:5.8cqw;font-weight:600;color:#f3f4f6}'
      + '.sc-cg-actions{display:flex;gap:2cqw}'
      + '.sc-cg-btn{padding:.8cqh 2.8cqw;border-radius:999px;border:1px solid rgba(255,255,255,.25);font-size:3cqw;font-weight:600;color:#e5e7eb;display:flex;align-items:center;gap:1.5cqw;background:rgba(255,255,255,.05)}'

      /* Scene 2: 3D Wireframe Stream (25% - 50%) */
      + '.sc-m-s2{animation:mScene2 var(--D) cubic-bezier(.16,1,.3,1) infinite;background:radial-gradient(circle at 50% 50%,#202020 0%,#000000 75%)}'
      + '.sc-wf-bg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:28cqw;font-weight:900;color:transparent;-webkit-text-stroke:1.1px rgba(255,255,255,.10);pointer-events:none;white-space:nowrap;z-index:0}'
      + '.sc-wf-pill{position:absolute;background:#262626;border:1px solid rgba(255,255,255,.15);border-radius:3cqw;padding:1.5cqh 4cqw;font-size:3cqw;color:#9ca3af}'
      + '.sc-wf-hero{position:relative;z-index:5;text-align:center}'
      + '.sc-wf-sub{font-size:4.8cqw;color:#ffffff;font-weight:600}'
      + '.sc-wf-title{font-size:16cqw;font-weight:900;font-style:italic;color:#ffffff;line-height:1;margin-top:.4cqh;text-shadow:0 10px 30px rgba(0,0,0,.95)}'

      /* Scene 3: 3D Blue Spotlight Evidence Board (50% - 75%) */
      + '.sc-m-s3{animation:mScene3 var(--D) cubic-bezier(.16,1,.3,1) infinite;background:#030712}'
      + '.sc-ev-light{position:absolute;top:-20%;right:-20%;width:120cqw;height:120cqw;background:radial-gradient(circle,rgba(56,189,248,.35) 0%,transparent 65%);filter:blur(50px);pointer-events:none}'
      + '.sc-ev-board{width:86cqw;height:54cqh;object-fit:contain;filter:drop-shadow(0 30px 70px rgba(0,0,0,.95)) drop-shadow(0 0 45px rgba(56,189,248,.5));animation:evFloat 4s ease-in-out infinite alternate}'
      + '.sc-ev-text-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:6;text-align:center}'
      + '.sc-ev-sub{font-size:5cqw;font-weight:700;color:#ffffff;margin-bottom:.5cqh}'
      + '.sc-ev-title{font-size:14cqw;font-weight:900;color:#ffffff;line-height:1;text-shadow:0 0 35px rgba(56,189,248,.9),0 4px 15px rgba(0,0,0,.9)}'

      /* Scene 4: 3D Analog Clock in Light Beam (75% - 100%) */
      + '.sc-m-s4{animation:mScene4 var(--D) cubic-bezier(.16,1,.3,1) infinite;background:#000000}'
      + '.sc-clk-beam{position:absolute;top:-40%;left:-20%;width:140cqw;height:180cqh;background:linear-gradient(135deg,rgba(255,255,255,.25) 0%,rgba(255,255,255,.05) 40%,transparent 70%);filter:blur(25px);pointer-events:none;transform:rotate(-25deg)}'
      + '.sc-clk-img{width:68cqw;height:68cqw;object-fit:contain;filter:drop-shadow(0 30px 60px rgba(0,0,0,.95)) drop-shadow(0 0 30px rgba(255,255,255,.25));animation:clkSpin 6s ease-in-out infinite alternate}'
      + '.sc-clk-text-box{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:6;text-align:center}'
      + '.sc-clk-sub{font-size:4.6cqw;font-weight:600;color:#ffffff}'
      + '.sc-clk-title{font-size:16cqw;font-weight:900;color:#ffffff;line-height:1;text-shadow:0 10px 40px rgba(0,0,0,.95)}'

      /* Keyframe Sequencing */
      + '@keyframes mScene1{0%,2%{opacity:0;transform:scale(.9) translateY(4cqh)}5%,22%{opacity:1;transform:scale(1) translateY(0)}25%,100%{opacity:0;transform:scale(1.05) translateY(-2cqh)}}'
      + '@keyframes mScene2{0%,24%{opacity:0;transform:scale(.94)}27%,47%{opacity:1;transform:scale(1)}50%,100%{opacity:0;transform:scale(1.05)}}'
      + '@keyframes mScene3{0%,49%{opacity:0;transform:scale(.92)}52%,72%{opacity:1;transform:scale(1)}75%,100%{opacity:0;transform:scale(1.06)}}'
      + '@keyframes mScene4{0%,74%{opacity:0;transform:scale(.92)}77%,97%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.04)}}'
      + '@keyframes evFloat{0%{transform:rotateX(10deg) translateY(0)}100%{transform:rotateX(-8deg) translateY(-1.5cqh)}}'
      + '@keyframes clkSpin{0%{transform:rotateX(15deg) rotateY(10deg) scale(0.96)}100%{transform:rotateX(-10deg) rotateY(-15deg) scale(1.04)}}',
    html: function (o) {
      var t1 = getP(o, "t1", o.lines[0] || "Write me a viral Shorts hook");
      var t2 = getP(o, "t2", o.lines[1] || "Auto-Built");
      var t3 = getP(o, "t3", o.lines[2] || "The Evidence");
      var t5 = getP(o, "t5", o.lines[3] || "First 3 Seconds");
      return '<div class="sc-master-wrap">'
        /* Scene 1 */
        + '<div class="sc-master-scene sc-m-s1">'
        + '<div class="sc-cg-brand">ChatGPT</div>'
        + '<div class="sc-cg-pill">'
        + '<div class="sc-cg-input">' + esc(t1) + '</div>'
        + '<div class="sc-cg-actions">'
        + '<div class="sc-cg-btn">📎 Attach</div>'
        + '<div class="sc-cg-btn">🌐 Search</div>'
        + '<div class="sc-cg-btn">📖 Study</div>'
        + '</div>'
        + '</div>'
        + '</div>'

        /* Scene 2 */
        + '<div class="sc-master-scene sc-m-s2">'
        + '<div class="sc-wf-bg">SCRIPT</div>'
        + '<div class="sc-wf-pill" style="top:18%;left:8%;transform:rotate(-12deg);">Hook Line<br/><small>0:00 — 0:03</small></div>'
        + '<div class="sc-wf-pill" style="bottom:20%;right:6%;transform:rotate(-6deg);">Payoff Beat<br/><small>0:12 — 0:15</small></div>'
        + '<div class="sc-wf-hero">'
        + '<div class="sc-wf-sub">FROM PROMPT TO SCENE</div>'
        + '<div class="sc-wf-title">' + esc(t2) + '</div>'
        + '</div>'
        + '</div>'

        /* Scene 3 */
        + '<div class="sc-master-scene sc-m-s3">'
        + '<div class="sc-ev-light"></div>'
        + '<img src="/assets/investigation_photo_board_3d.png" class="sc-ev-board" alt="Investigation Photo Board" />'
        + '<div class="sc-ev-text-overlay">'
        + '<div class="sc-ev-sub">// CASE FILE 004</div>'
        + '<div class="sc-ev-title">' + esc(t3) + '</div>'
        + '</div>'
        + '</div>'

        /* Scene 4 */
        + '<div class="sc-master-scene sc-m-s4">'
        + '<div class="sc-clk-beam"></div>'
        + '<img src="/assets/analog_wall_clock_3d.png" class="sc-clk-img" alt="3D Wall Clock" />'
        + '<div class="sc-clk-text-box">'
        + '<div class="sc-clk-sub">// RETENTION WINDOW</div>'
        + '<div class="sc-clk-title">' + esc(t5) + '</div>'
        + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* AutoAE Scene 1: Standalone ChatGPT Prompt */
  T["autoae-chatgpt-prompt"] = {
    name: "ChatGPT 3D Prompt Box", cat: "ui", dark: true, accent: "#10b981",
    desc: "3D floating ChatGPT prompt input capsule with action pills (Attach, Search, Study) and kinetic spring fly-in",
    css: '.sc-cg-standalone{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;background:#000000;color:#fff;padding:6cqw;font-family:Inter,system-ui,sans-serif}'
      + '.sc-cg-single-brand{font-size:9cqw;font-weight:900;letter-spacing:-.02em;color:#ffffff;margin-bottom:3cqh;text-align:center;animation:cgPop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-cg-single-pill{width:86cqw;background:#323232;border-radius:6cqw;padding:3.5cqh 5cqw;box-shadow:0 30px 80px rgba(0,0,0,.95);border:1px solid rgba(255,255,255,.12);display:flex;flex-direction:column;gap:3cqh;animation:cgPop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-cg-single-input{font-size:6.4cqw;font-weight:600;color:#f3f4f6}'
      + '.sc-cg-single-actions{display:flex;gap:2.5cqw}'
      + '.sc-cg-single-btn{padding:1cqh 3cqw;border-radius:999px;border:1px solid rgba(255,255,255,.25);font-size:3.4cqw;font-weight:600;color:#e5e7eb;display:flex;align-items:center;gap:1.5cqw;background:rgba(255,255,255,.06)}'
      + '@keyframes cgPop{0%,12%{transform:perspective(1000px) rotateX(20deg) translateY(6cqh);opacity:0}25%{transform:perspective(1000px) rotateX(0deg) translateY(0);opacity:1}45%{transform:perspective(1000px) rotateX(2deg) translateY(-.4cqh);opacity:1}65%{transform:perspective(1000px) rotateX(-1.5deg) translateY(.3cqh);opacity:1}85%{transform:perspective(1000px) rotateX(0deg) translateY(0);opacity:1}100%{transform:perspective(1000px) rotateX(-10deg) translateY(-3cqh);opacity:0}}',
    html: function (o) {
      var query = getP(o, "query", o.lines[0] || "Write me a viral Shorts hook");
      return '<div class="sc-cg-standalone">'
        + '<div class="sc-cg-single-brand">ChatGPT</div>'
        + '<div class="sc-cg-single-pill">'
        + '<div class="sc-cg-single-input">' + esc(query) + '</div>'
        + '<div class="sc-cg-single-actions">'
        + '<div class="sc-cg-single-btn">📎 Attach</div>'
        + '<div class="sc-cg-single-btn">🌐 Search</div>'
        + '<div class="sc-cg-single-btn">📖 Study</div>'
        + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* AutoAE Scene 2: Standalone Wireframe Search Stream */
  T["autoae-wireframe-stream"] = {
    name: "Wireframe Search Stream", cat: "ui", dark: true, accent: "#ffffff",
    desc: "Massive 3D stroked background wireframe typography with bold italic hero headline and orbiting search cards",
    css: '.sc-wf-standalone{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;background:radial-gradient(circle at 50% 50%,#202020 0%,#000000 80%);color:#fff;overflow:hidden;font-family:Inter,system-ui,sans-serif}'
      + '.sc-wf-s-bg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:30cqw;font-weight:900;color:transparent;-webkit-text-stroke:1.2px rgba(255,255,255,.10);pointer-events:none;white-space:nowrap;z-index:0;animation:wfSpin 8s ease-in-out infinite alternate}'
      + '.sc-wf-s-pill{position:absolute;background:#262626;border:1px solid rgba(255,255,255,.15);border-radius:3cqw;padding:1.8cqh 4.5cqw;font-size:3.4cqw;color:#9ca3af;box-shadow:0 20px 40px rgba(0,0,0,.8)}'
      + '.sc-wf-s-hero{position:relative;z-index:5;text-align:center;animation:wfPop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-wf-s-sub{font-size:5.2cqw;color:#ffffff;font-weight:600}'
      + '.sc-wf-s-title{font-size:18cqw;font-weight:900;font-style:italic;color:#ffffff;line-height:1;margin-top:.4cqh;text-shadow:0 10px 40px rgba(0,0,0,.95)}'
      + '@keyframes wfPop{0%,15%{transform:scale(.92);opacity:0}28%,85%{transform:scale(1);opacity:1}100%{transform:scale(1.05);opacity:0}}'
      + '@keyframes wfSpin{0%{transform:scale(1.25) rotate(-10deg)}100%{transform:scale(1.35) rotate(-6deg)}}',
    html: function (o) {
      var sub = getP(o, "sub", o.lines[0] || "FROM PROMPT TO SCENE");
      var title = getP(o, "title", o.lines[1] || "Auto-Built");
      return '<div class="sc-wf-standalone">'
        + '<div class="sc-wf-s-bg">SCRIPT</div>'
        + '<div class="sc-wf-s-pill" style="top:16%;left:6%;transform:rotate(-12deg);">Hook Line<br/><small>0:00 — 0:03</small></div>'
        + '<div class="sc-wf-s-pill" style="bottom:18%;right:6%;transform:rotate(-6deg);">Payoff Beat<br/><small>0:12 — 0:15</small></div>'
        + '<div class="sc-wf-s-hero">'
        + '<div class="sc-wf-s-sub">' + esc(sub) + '</div>'
        + '<div class="sc-wf-s-title">' + esc(title) + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* AutoAE Scene 3: Standalone Blue Spotlight Evidence Board */
  T["autoae-blue-evidence"] = {
    name: "3D Blue Evidence Board", cat: "docu", dark: true, accent: "#38bdf8",
    desc: "3D tilted investigation evidence board bathed in intense cyan spotlight with glowing headline",
    css: '.sc-ev-standalone{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;background:#030712;color:#fff;overflow:hidden;font-family:Inter,system-ui,sans-serif}'
      + '.sc-ev-s-light{position:absolute;top:-20%;right:-20%;width:130cqw;height:130cqw;background:radial-gradient(circle,rgba(56,189,248,.35) 0%,transparent 65%);filter:blur(50px);pointer-events:none}'
      + '.sc-ev-s-board{width:88cqw;height:56cqh;object-fit:contain;filter:drop-shadow(0 30px 70px rgba(0,0,0,.95)) drop-shadow(0 0 45px rgba(56,189,248,.5));animation:evFloat 4s ease-in-out infinite alternate}'
      + '.sc-ev-s-text{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:6;text-align:center;animation:evTextPop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-ev-s-sub{font-size:5.4cqw;font-weight:700;color:#ffffff;margin-bottom:.5cqh}'
      + '.sc-ev-s-title{font-size:16cqw;font-weight:900;color:#ffffff;line-height:1;text-shadow:0 0 35px rgba(56,189,248,.9),0 4px 15px rgba(0,0,0,.9)}'
      + '@keyframes evFloat{0%{transform:rotateX(10deg) translateY(0)}100%{transform:rotateX(-8deg) translateY(-1.5cqh)}}'
      + '@keyframes evTextPop{0%,15%{transform:scale(.92);opacity:0}28%,85%{transform:scale(1);opacity:1}100%{transform:scale(1.06);opacity:0}}',
    html: function (o) {
      var sub = getP(o, "sub", o.lines[0] || "// CASE FILE 004");
      var title = getP(o, "title", o.lines[1] || "The Evidence");
      return '<div class="sc-ev-standalone">'
        + '<div class="sc-ev-s-light"></div>'
        + '<img src="/assets/investigation_photo_board_3d.png" class="sc-ev-s-board" alt="Investigation Photo Board" />'
        + '<div class="sc-ev-s-text">'
        + '<div class="sc-ev-s-sub">' + esc(sub) + '</div>'
        + '<div class="sc-ev-s-title">' + esc(title) + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* AutoAE Scene 4: Standalone 3D Wall Clock Light Beam */
  T["autoae-volumetric-clock"] = {
    name: "3D Clock in Light Beam", cat: "docu", dark: true, accent: "#ffffff",
    desc: "3D floating analog wall clock in volumetric diagonal spotlight beam with orbiting arcs and clean bold typography",
    css: '.sc-clk-standalone{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;background:#000000;color:#fff;overflow:hidden;font-family:Inter,system-ui,sans-serif}'
      + '.sc-clk-s-beam{position:absolute;top:-40%;left:-20%;width:140cqw;height:180cqh;background:linear-gradient(135deg,rgba(255,255,255,.25) 0%,rgba(255,255,255,.05) 40%,transparent 70%);filter:blur(25px);pointer-events:none;transform:rotate(-25deg)}'
      + '.sc-clk-s-img{width:70cqw;height:70cqw;object-fit:contain;filter:drop-shadow(0 30px 60px rgba(0,0,0,.95)) drop-shadow(0 0 30px rgba(255,255,255,.25));animation:clkSpin 6s ease-in-out infinite alternate}'
      + '.sc-clk-s-text{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:6;text-align:center;animation:clkTextPop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-clk-s-sub{font-size:5cqw;font-weight:600;color:#ffffff}'
      + '.sc-clk-s-title{font-size:18cqw;font-weight:900;color:#ffffff;line-height:1;text-shadow:0 10px 40px rgba(0,0,0,.95)}'
      + '@keyframes clkSpin{0%{transform:rotateX(15deg) rotateY(10deg) scale(0.96)}100%{transform:rotateX(-10deg) rotateY(-15deg) scale(1.04)}}'
      + '@keyframes clkTextPop{0%,15%{transform:scale(.92);opacity:0}28%,85%{transform:scale(1);opacity:1}100%{transform:scale(1.04);opacity:0}}',
    html: function (o) {
      var sub = getP(o, "sub", o.lines[0] || "// RETENTION WINDOW");
      var title = getP(o, "title", o.lines[1] || "First 3 Seconds");
      return '<div class="sc-clk-standalone">'
        + '<div class="sc-clk-s-beam"></div>'
        + '<img src="/assets/analog_wall_clock_3d.png" class="sc-clk-s-img" alt="3D Wall Clock" />'
        + '<div class="sc-clk-s-text">'
        + '<div class="sc-clk-s-sub">' + esc(sub) + '</div>'
        + '<div class="sc-clk-s-title">' + esc(title) + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* ============================================================
     AUTOAE FLAGSHIP SIGNATURE SERIES (8 Ultra-Premium Templates)
     ============================================================ */

  /* AutoAE.1 Founder Halftone Poster */
  T["autoae-founder-halftone"] = {
    name: "Founder Halftone Poster", cat: "docu", dark: true, accent: "#3b82f6",
    desc: "AutoAE signature Mark Zuckerberg style monochrome halftone cutout poster with vintage sunburst rays and bold typography",
    css: '.sc-ae-zuck{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:5cqh 5cqw;background:#090a0f;overflow:hidden;font-family:Inter,sans-serif;color:#fff;perspective:1000px}'
      + '.sc-ae-rays{position:absolute;inset:-50%;background:repeating-conic-gradient(from 0deg,rgba(255,255,255,.05) 0deg 15deg,transparent 15deg 30deg);animation:aeSpinRays 40s linear infinite;pointer-events:none}'
      + '.sc-ae-halftone{position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.15) 1.5px,transparent 1.5px);background-size:12px 12px;opacity:.4;pointer-events:none}'
      + '.sc-ae-crops{position:absolute;inset:3cqh 3cqw;border:1px dashed rgba(255,255,255,.15);pointer-events:none}'
      + '.sc-ae-topbar{display:flex;justify-content:space-between;align-items:center;font-family:ui-monospace,monospace;font-size:2.8cqw;color:#94a3b8;letter-spacing:.25em;z-index:5}'
      + '.sc-ae-cutout-stage{position:relative;flex:1;display:flex;align-items:flex-end;justify-content:center;z-index:3;margin:1cqh 0}'
      + '.sc-ae-avatar-glow{position:absolute;width:60cqw;height:60cqw;border-radius:50%;background:radial-gradient(circle,rgba(59,130,246,.35) 0%,transparent 70%);filter:blur(30px);bottom:5cqh}'
      + '.sc-ae-portrait-card{position:relative;width:72cqw;height:52cqh;border-radius:4cqw;overflow:hidden;display:flex;align-items:flex-end;justify-content:center;filter:drop-shadow(0 30px 60px rgba(0,0,0,.9)) drop-shadow(0 0 35px rgba(59,130,246,.4));animation:aePortraitPop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-ae-portrait-img{width:100%;height:100%;object-fit:contain}'
      + '.sc-ae-bottom-card{position:relative;z-index:5;text-align:center;animation:aeTextPop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-ae-tagline{font-size:4.2cqw;letter-spacing:.3em;color:#94a3b8;font-weight:700;text-transform:uppercase}'
      + '.sc-ae-main-hero{font-family:Impact,sans-serif;font-size:12.5cqw;letter-spacing:.04em;line-height:1;color:#fff;text-shadow:0 0 35px rgba(59,130,246,.7);margin-top:.4cqh;text-transform:uppercase}'
      + '@keyframes aeSpinRays{to{transform:rotate(360deg)}}'
      + '@keyframes aePortraitPop{0%,12%{transform:scale(.88) translateY(4cqh);opacity:0}25%,85%{transform:scale(1) translateY(0);opacity:1}100%{transform:scale(1.04);opacity:0}}'
      + '@keyframes aeTextPop{0%,18%{transform:translateY(3cqh);opacity:0}28%,85%{transform:translateY(0);opacity:1}100%{transform:translateY(-1cqh);opacity:0}}',
    html: function (o) {
      var topTag = getP(o, "topTag", "// ARCHIVE 2004 · HARVARD");
      var sub = getP(o, "sub", o.lines[0] || "STARTED");
      var hero = getP(o, "hero", o.lines[1] || "FACEBOOK");
      return '<div class="sc-ae-zuck">'
        + '<div class="sc-ae-rays"></div>'
        + '<div class="sc-ae-halftone"></div>'
        + '<div class="sc-ae-crops"></div>'
        + '<div class="sc-ae-topbar"><span>' + esc(topTag) + '</span><span>CASE FILE #01</span></div>'
        + '<div class="sc-ae-cutout-stage">'
        + '<div class="sc-ae-avatar-glow"></div>'
        + '<div class="sc-ae-portrait-card">'
        + '<img src="/assets/zuck_portrait_halftone.png" class="sc-ae-portrait-img" alt="Founder Portrait" />'
        + '</div>'
        + '</div>'
        + '<div class="sc-ae-bottom-card">'
        + '<div class="sc-ae-tagline">' + esc(sub) + '</div>'
        + '<div class="sc-ae-main-hero">' + esc(hero) + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* AutoAE.2 Stand Out in Crowded Market */
  T["autoae-neon-spheres"] = {
    name: "Crowded Market Spheres", cat: "social", dark: true, accent: "#22c55e",
    desc: "AutoAE signature multi-layer 3D glossy spheres with intense neon green & magenta subsurface rim glow",
    css: '.sc-sph-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:8cqh 6cqw;background:radial-gradient(ellipse at 50% 60%,#11121c 0%,#050508 100%);overflow:hidden;font-family:Inter,sans-serif;color:#fff;perspective:900px}'
      + '.sc-sph-title{font-size:7.4cqw;font-weight:900;letter-spacing:-.03em;line-height:1.2;text-align:center;color:#fff;text-shadow:0 0 25px rgba(255,255,255,.3);animation:sphTitlePop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-sph-stage{position:relative;width:100%;height:52cqh;display:flex;align-items:center;justify-content:center;transform-style:preserve-3d}'
      + '.sc-sph-3d-img{width:90cqw;height:90cqw;object-fit:contain;animation:sphFloat 4s ease-in-out infinite alternate}'
      + '.sc-sph-footer{display:flex;justify-content:center;font-size:3.2cqw;letter-spacing:.25em;text-transform:uppercase;color:#94a3b8;font-family:monospace}'
      + '@keyframes sphFloat{0%{transform:translateY(0) scale(0.98)}100%{transform:translateY(-2cqh) scale(1.02)}}'
      + '@keyframes sphTitlePop{0%,12%{transform:translateY(-2cqh);opacity:0}25%,85%{transform:translateY(0);opacity:1}100%{transform:translateY(1cqh);opacity:0}}',
    html: function (o) {
      var hook = getP(o, "hook", o.lines[0] || "Stand out in the crowded market?");
      var footer = getP(o, "footer", o.lines[1] || "// RETENTION RULE #01");
      return '<div class="sc-sph-wrap">'
        + '<div class="sc-sph-title">' + esc(hook) + '</div>'
        + '<div class="sc-sph-stage">'
        + '<img src="/assets/neon_spheres_3d.png" class="sc-sph-3d-img" alt="3D Neon Spheres" />'
        + '</div>'
        + '<div class="sc-sph-footer">' + esc(footer) + '</div>'
        + '</div>';
    }
  };

  /* AutoAE.3 3D Metallic Energy Drink */
  T["autoae-product-can"] = {
    name: "3D Metallic Product Showcase", cat: "ui", dark: false, accent: "#0284c7",
    desc: "AutoAE signature 3D metallic drink can tilted with technical barcode, blueprint curve and editorial typography",
    css: '.sc-can-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:6cqh 6cqw;background:#f1f5f9;color:#0f172a;overflow:hidden;font-family:Inter,sans-serif;perspective:900px}'
      + '.sc-can-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(15,23,42,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(15,23,42,.05) 1px,transparent 1px);background-size:6cqw 6cqw;pointer-events:none}'
      + '.sc-can-barcode{font-family:monospace;font-size:3.2cqw;letter-spacing:.35em;color:#475569;border-top:3px solid #0f172a;border-bottom:1px solid #0f172a;padding:.6cqh 0;text-align:center;width:48cqw}'
      + '.sc-can-stage{position:relative;flex:1;display:flex;align-items:center;justify-content:center;transform-style:preserve-3d}'
      + '.sc-can-swoosh{position:absolute;width:100%;height:100%;pointer-events:none}'
      + '.sc-can-3d-img{width:68cqw;height:48cqh;object-fit:contain;filter:drop-shadow(0 30px 60px rgba(0,0,0,.45));animation:canFloat 6s ease-in-out infinite alternate}'
      + '.sc-can-footer{display:flex;justify-content:space-between;align-items:flex-end;z-index:5}'
      + '.sc-can-title{font-size:9cqw;font-weight:900;line-height:1;letter-spacing:-.03em;color:#0f172a}'
      + '.sc-can-sub{font-size:3.6cqw;color:#64748b;font-style:italic;font-family:Georgia,serif}'
      + '@keyframes canFloat{0%{transform:rotate(0deg) translateY(0)}100%{transform:rotate(-4deg) translateY(-2cqh)}}',
    html: function (o) {
      var t1 = getP(o, "t1", o.lines[0] || "ENERGY");
      var t2 = getP(o, "t2", o.lines[1] || "IN A CAN");
      return '<div class="sc-can-wrap">'
        + '<div class="sc-can-grid"></div>'
        + '<div style="display:flex;justify-content:space-between;align-items:center;z-index:5;">'
        + '<div class="sc-can-barcode">|||| | ||||| ||||</div>'
        + '<span style="font-family:monospace;font-size:3cqw;font-weight:700;color:#64748b">SKU #2026-X</span>'
        + '</div>'
        + '<div class="sc-can-stage">'
        + '<svg class="sc-can-swoosh" viewBox="0 0 300 300">'
        + '<path d="M 20 280 Q 80 40 280 60" fill="none" stroke="#0284c7" stroke-width="8" stroke-linecap="round" opacity="0.8"/>'
        + '</svg>'
        + '<img src="/assets/redbull_can_3d.png" class="sc-can-3d-img" alt="3D Metallic Energy Drink Can" />'
        + '</div>'
        + '<div class="sc-can-footer">'
        + '<div><div class="sc-can-sub">Premium Motion Graphic</div><div class="sc-can-title">' + esc(t1) + '</div><div class="sc-can-title" style="color:#0284c7">' + esc(t2) + '</div></div>'
        + '</div>'
        + '</div>';
    }
  };

  /* AutoAE.4 Founder 4-Step Breakdown */
  T["autoae-founder-steps"] = {
    name: "Founder 4-Step Breakdown", cat: "docu", dark: true, accent: "#f59e0b",
    desc: "AutoAE signature Elon Musk / executive reading newspaper cutout with animated 1-2-3-4 step pills",
    css: '.sc-step-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:6cqh 6cqw;background:#0d0f17;overflow:hidden;font-family:Inter,sans-serif;color:#fff}'
      + '.sc-step-head{border-bottom:1px solid rgba(255,255,255,.12);padding-bottom:1.5cqh}'
      + '.sc-step-sub{font-size:3.2cqw;letter-spacing:.25em;text-transform:uppercase;color:#f59e0b;font-weight:700}'
      + '.sc-step-title{font-size:7.2cqw;font-weight:900;color:#fff;margin-top:.4cqh;letter-spacing:-.02em}'
      + '.sc-step-pills{display:flex;gap:2.5cqw;margin:2.5cqh 0}'
      + '.sc-step-badge{width:11cqw;height:11cqw;border-radius:2.5cqw;display:grid;place-items:center;font-size:5.5cqw;font-weight:900;background:rgba(255,255,255,.08);color:#94a3b8;border:1px solid rgba(255,255,255,.15);animation:stepGlow 2s ease-in-out infinite alternate}'
      + '.sc-step-b1{background:#f59e0b;color:#000;border-color:#fbbf24;box-shadow:0 0 25px rgba(245,158,11,.6)}'
      + '.sc-step-stage{position:relative;flex:1;display:flex;align-items:flex-end;justify-content:space-between;gap:2cqw}'
      + '.sc-step-card{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);border-radius:3cqw;padding:4.5cqw;flex:1;backdrop-filter:blur(20px);box-shadow:0 20px 50px rgba(0,0,0,.8);margin-bottom:2cqh}'
      + '.sc-step-desc{font-size:3.6cqw;color:#e2e8f0;line-height:1.45;font-weight:500}'
      + '.sc-step-founder-img{width:48cqw;height:48cqh;object-fit:contain;filter:drop-shadow(0 25px 50px rgba(0,0,0,.95)) drop-shadow(0 0 25px rgba(245,158,11,.2))}'
      + '@keyframes stepGlow{0%{transform:scale(1)}100%{transform:scale(1.08)}}',
    html: function (o) {
      var title = getP(o, "title", o.lines[0] || "4-STEP FRAMEWORK");
      var stepTxt = getP(o, "stepTxt", o.lines[1] || "First-principles thinking to engineer impossible products.");
      return '<div class="sc-step-wrap">'
        + '<div class="sc-step-head">'
        + '<div class="sc-step-sub">// HOW FOUNDERS SCALE</div>'
        + '<div class="sc-step-title">' + esc(title) + '</div>'
        + '</div>'
        + '<div class="sc-step-pills">'
        + '<div class="sc-step-badge sc-step-b1">1</div>'
        + '<div class="sc-step-badge">2</div>'
        + '<div class="sc-step-badge">3</div>'
        + '<div class="sc-step-badge">4</div>'
        + '</div>'
        + '<div class="sc-step-stage">'
        + '<div class="sc-step-card"><div style="font-size:4.2cqw;font-weight:800;color:#f59e0b;margin-bottom:1cqh">STEP 1: ZERO TO ONE</div><div class="sc-step-desc">' + esc(stepTxt) + '</div></div>'
        + '<img src="/assets/elon_newspaper_cutout.png" class="sc-step-founder-img" alt="Founder Cutout" />'
        + '</div>'
        + '</div>';
    }
  };

  /* AutoAE.5 Vintage Retro CRT Story Monitor */
  T["autoae-retro-crt"] = {
    name: "Vintage CRT Story Monitor", cat: "docu", dark: true, accent: "#38bdf8",
    desc: "AutoAE signature vintage 1980s television CRT monitor with curved phosphor scanlines and glowing storytelling narrative",
    css: '.sc-crt-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:6cqw;background:radial-gradient(circle at center,#1c1917 0%,#0a0a0c 100%);overflow:hidden;font-family:ui-monospace,monospace;color:#fff}'
      + '.sc-crt-box{position:relative;width:88cqw;height:54cqh;display:flex;align-items:center;justify-content:center;animation:tvShake 6s ease-in-out infinite alternate}'
      + '.sc-crt-frame-img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:2;pointer-events:none}'
      + '.sc-crt-screen-content{position:absolute;left:10%;top:15%;width:48%;height:68%;display:flex;align-items:center;justify-content:center;text-align:center;padding:2cqw;z-index:5;overflow:hidden}'
      + '.sc-crt-text{font-size:5.8cqw;font-weight:900;color:#38bdf8;text-shadow:0 0 20px #38bdf8;font-family:Georgia,serif;font-style:italic}'
      + '.sc-crt-sub{margin-top:3cqh;font-size:3.6cqw;letter-spacing:.2em;text-transform:uppercase;text-align:center;color:#a1a1aa}'
      + '@keyframes tvShake{0%{transform:rotate(-1deg) scale(1)}100%{transform:rotate(1deg) scale(1.02)}}',
    html: function (o) {
      var story = getP(o, "story", o.lines[0] || "Telling story...");
      var sub = getP(o, "sub", o.lines[1] || "HOW IT ALL BEGAN // 1998");
      return '<div class="sc-crt-wrap">'
        + '<div class="sc-crt-box">'
        + '<img src="/assets/retro_crt_frame.png" class="sc-crt-frame-img" alt="Vintage CRT Television" />'
        + '<div class="sc-crt-screen-content">'
        + '<div class="sc-crt-text">' + esc(story) + '</div>'
        + '</div>'
        + '</div>'
        + '<div class="sc-crt-sub">' + esc(sub) + '</div>'
        + '</div>';
    }
  };

  /* AutoAE.6 Infinity Metrics Energy Loop */
  T["autoae-infinity-loop"] = {
    name: "Infinity Comparison Loop", cat: "charts", dark: true, accent: "#00f0ff",
    desc: "AutoAE signature dual-energy infinity curve comparing two continuous core principles",
    css: '.sc-inf-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:8cqh 6cqw;background:radial-gradient(ellipse at 50% 50%,#091326 0%,#020612 100%);overflow:hidden;font-family:Inter,sans-serif;color:#fff}'
      + '.sc-inf-title{font-size:7.2cqw;font-weight:900;text-align:center;letter-spacing:-.03em;color:#fff;text-shadow:0 0 25px rgba(0,240,255,.4)}'
      + '.sc-inf-stage{position:relative;width:100%;height:44cqh;display:grid;place-items:center}'
      + '.sc-inf-svg{width:100%;height:100%;overflow:visible}'
      + '.sc-inf-path{fill:none;stroke:#00f0ff;stroke-width:6;stroke-linecap:round;filter:drop-shadow(0 0 15px #00f0ff);stroke-dasharray:700;stroke-dashoffset:700;animation:infDraw var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-inf-labels{position:absolute;inset:0;display:flex;justify-content:space-between;align-items:center;padding:0 4cqw;pointer-events:none}'
      + '.sc-inf-pill{padding:1.5cqh 4cqw;border-radius:999px;font-size:3.8cqw;font-weight:800;backdrop-filter:blur(16px);animation:infPillPop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-inf-p1{background:rgba(0,240,255,.15);border:1px solid #00f0ff;color:#a5f3fc;box-shadow:0 0 20px rgba(0,240,255,.4)}'
      + '.sc-inf-p2{background:rgba(244,63,94,.15);border:1px solid #f43f5e;color:#fecdd3;box-shadow:0 0 20px rgba(244,63,94,.4)}'
      + '.sc-inf-foot{text-align:center;font-size:3.4cqw;color:#94a3b8;font-family:monospace;letter-spacing:.2em}'
      + '@keyframes infDraw{0%,15%{stroke-dashoffset:700}40%,85%{stroke-dashoffset:0}100%{stroke-dashoffset:700}}'
      + '@keyframes infPillPop{0%,18%{transform:scale(.85);opacity:0}30%,85%{transform:scale(1);opacity:1}100%{transform:scale(1.04);opacity:0}}',
    html: function (o) {
      var t1 = getP(o, "t1", o.lines[0] || "Creative Flow");
      var t2 = getP(o, "t2", o.lines[1] || "Viral Scale");
      return '<div class="sc-inf-wrap">'
        + '<div class="sc-inf-title">CONTINUOUS SYNERGY</div>'
        + '<div class="sc-inf-stage">'
        + '<svg class="sc-inf-svg" viewBox="0 0 300 150">'
        + '<path class="sc-inf-path" d="M 150 75 C 100 0, 20 0, 20 75 C 20 150, 100 150, 150 75 C 200 0, 280 0, 280 75 C 280 150, 200 150, 150 75 Z"/>'
        + '</svg>'
        + '<div class="sc-inf-labels">'
        + '<div class="sc-inf-pill sc-inf-p1">' + esc(t1) + '</div>'
        + '<div class="sc-inf-pill sc-inf-p2">' + esc(t2) + '</div>'
        + '</div>'
        + '</div>'
        + '<div class="sc-inf-foot">// INFINITY RETENTION LOOP</div>'
        + '</div>';
    }
  };

  /* AutoAE.7 Exponential S-Curve Surge */
  T["autoae-scurve-growth"] = {
    name: "Exponential S-Curve Surge", cat: "charts", dark: true, accent: "#38bdf8",
    desc: "AutoAE signature sigmoid S-curve revenue progression with $900 to $6,000 milestone dots",
    css: '.sc-scurve-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:7cqh 6cqw;background:radial-gradient(ellipse at 50% 50%,#09182b 0%,#020814 100%);overflow:hidden;font-family:Inter,sans-serif;color:#fff}'
      + '.sc-scurve-head{display:flex;justify-content:space-between;align-items:flex-start}'
      + '.sc-scurve-title{font-size:6.8cqw;font-weight:900;letter-spacing:-.03em;color:#fff}'
      + '.sc-scurve-badge{padding:.8cqh 2.8cqw;border-radius:999px;background:rgba(56,189,248,.15);border:1px solid rgba(56,189,248,.35);color:#38bdf8;font-size:3.6cqw;font-weight:800}'
      + '.sc-scurve-box{position:relative;width:100%;height:44cqh;border-bottom:1px solid rgba(255,255,255,.15);border-left:1px solid rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center}'
      + '.sc-scurve-svg{width:100%;height:100%;overflow:visible}'
      + '.sc-scurve-path{fill:none;stroke:#38bdf8;stroke-width:5;stroke-linecap:round;filter:drop-shadow(0 0 12px #38bdf8);stroke-dasharray:600;stroke-dashoffset:600;animation:scurveDraw var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-scurve-dot{fill:#fff;stroke:#38bdf8;stroke-width:3;animation:dotPulse 1.5s ease-in-out infinite alternate}'
      + '.sc-scurve-foot{display:flex;justify-content:space-between;font-family:"Space Grotesk",sans-serif;font-size:4cqw;font-weight:800;color:#94a3b8}'
      + '@keyframes scurveDraw{0%,15%{stroke-dashoffset:600}40%,85%{stroke-dashoffset:0}100%{stroke-dashoffset:600}}'
      + '@keyframes dotPulse{0%{r:4}100%{r:7}}',
    html: function (o) {
      var startVal = getP(o, "startVal", o.lines[0] || "$900");
      var endVal = getP(o, "endVal", o.lines[1] || "$6,000");
      return '<div class="sc-scurve-wrap">'
        + '<div class="sc-scurve-head">'
        + '<div class="sc-scurve-title">S-CURVE EXPANSION</div>'
        + '<div class="sc-scurve-badge">▲ 6.6X SURGE</div>'
        + '</div>'
        + '<div class="sc-scurve-box">'
        + '<svg class="sc-scurve-svg" viewBox="0 0 300 200">'
        + '<path class="sc-scurve-path" d="M 20 180 C 100 180, 120 20, 280 20"/>'
        + '<circle class="sc-scurve-dot" cx="20" cy="180" r="5"/>'
        + '<circle class="sc-scurve-dot" cx="280" cy="20" r="6" fill="#38bdf8"/>'
        + '</svg>'
        + '</div>'
        + '<div class="sc-scurve-foot">'
        + '<span>START // ' + esc(startVal) + '</span>'
        + '<span style="color:#38bdf8">SCALE // ' + esc(endVal) + '</span>'
        + '</div>'
        + '</div>';
    }
  };

  /* AutoAE.8 The News Paper Breaking News */
  T["autoae-newspaper-breaking"] = {
    name: "The News Paper Breaking News", cat: "paper", dark: false, accent: "#dc2626",
    desc: "AutoAE signature authentic multi-column archival newspaper with stamped photo crop and breaking news headline",
    css: '.sc-news-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:5cqh 5cqw;background:#e5dfd5;color:#1c1917;overflow:hidden;font-family:Georgia,serif;box-shadow:inset 0 0 15cqw rgba(0,0,0,.15)}'
      + '.sc-news-mast{text-align:center;border-bottom:3px double #1c1917;padding-bottom:1cqh}'
      + '.sc-news-name{font-size:8.5cqw;font-weight:900;letter-spacing:-.03em;text-transform:uppercase;line-height:1}'
      + '.sc-news-date{font-family:ui-monospace,monospace;font-size:2.6cqw;color:#57534e;letter-spacing:.2em;margin-top:.4cqh}'
      + '.sc-news-banner{background:#1c1917;color:#fff;font-family:Impact,sans-serif;font-size:8.8cqw;letter-spacing:.04em;text-align:center;padding:1cqh 0;margin:1.5cqh 0;box-shadow:0 4px 12px rgba(0,0,0,.3);animation:newsBannerPop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-news-columns{display:flex;gap:3cqw;flex:1}'
      + '.sc-news-col{flex:1;font-size:2.8cqw;line-height:1.5;color:#44403c;text-align:justify}'
      + '.sc-news-photo{width:100%;height:16cqh;background:#1c1917;border-radius:2px;overflow:hidden;margin-bottom:1cqh;border:1px solid #78716c}'
      + '@keyframes newsBannerPop{0%,15%{transform:scale(.92);opacity:0}28%{transform:scale(1);opacity:1}45%{transform:scale(1.015);opacity:1}65%{transform:scale(.995);opacity:1}85%{transform:scale(1);opacity:1}100%{transform:scale(1.04);opacity:0}}',
    html: function (o) {
      var headline = getP(o, "headline", o.lines[0] || "BREAKING NEWS!");
      var lead = getP(o, "lead", o.lines[1] || "The historic breakthrough that disrupted the entire global market.");
      return '<div class="sc-news-wrap">'
        + '<div class="sc-news-mast">'
        + '<div class="sc-news-name">The News Paper</div>'
        + '<div class="sc-news-date">THE NEWSPAPER // VOL. 18, 1995 · SPECIAL EDITION</div>'
        + '</div>'
        + '<div class="sc-news-banner">' + esc(headline) + '</div>'
        + '<div class="sc-news-columns">'
        + '<div class="sc-news-col">'
        + '<div class="sc-news-photo"><img src="/assets/archival_suspect.jpg" style="width:100%;height:100%;object-fit:cover;" alt="News Still"/></div>'
        + '<b>SPECIAL REPORT:</b> ' + esc(lead)
        + '</div>'
        + '<div class="sc-news-col">'
        + 'Investigation reveals unprecedented acceleration in consumer adoption, completely redefining digital video creation for modern creators worldwide.'
        + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* ============================================================
     CATEGORY 1: DOCUMENTARY & RETRO (10 templates)
     ============================================================ */

  /* 1.1 Confidential Rubber Stamp Slam */
  T["docu-confidential"] = {
    name: "Classified Stamp", cat: "docu", dark: true, accent: "#dc2626",
    desc: "Classified CIA manila dossier with heavy weathered rubber stamp slamming down with impact shake",
    css: '.sc-stamp-wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:5cqw;background:radial-gradient(circle at center,#1c1917 0%,#09090b 100%);box-shadow:inset 0 0 15cqw rgba(0,0,0,.9);overflow:hidden;font-family:ui-monospace,monospace}.sc-stamp-folder{position:relative;width:86cqw;background:linear-gradient(135deg,#e2d9cc 0%,#cfc3b0 100%);color:#1c1917;padding:7cqw 6cqw;border-radius:2.5cqw;box-shadow:0 4cqw 14cqw rgba(0,0,0,.9),inset 0 0 4cqw rgba(0,0,0,.08);border:1px solid #b8ab96;transform:rotate(-1.5deg);animation:dossierSettle var(--D) cubic-bezier(.16,1,.3,1) infinite}.sc-stamp-clip{position:absolute;top:-2.5cqw;left:8cqw;width:4cqw;height:9cqw;border:3px solid #78716c;border-radius:99px;background:rgba(255,255,255,.2);box-shadow:0 1cqw 3cqw rgba(0,0,0,.4);z-index:4}.sc-stamp-meta{display:flex;justify-content:space-between;border-bottom:2px solid #a89f8d;padding-bottom:1.5cqh;margin-bottom:2cqh;font-size:2.8cqw;font-weight:700;color:#57534e;letter-spacing:.15em}.sc-stamp-line{height:1.8cqw;background:#b5a995;border-radius:1cqw;margin-bottom:2cqw;opacity:.7}.sc-stamp-l1{width:92%}.sc-stamp-l2{width:82%}.sc-stamp-l3{width:88%}.sc-stamp-mark{position:absolute;top:32%;left:12%;right:12%;border:5px double var(--ac);color:var(--ac);padding:2.5cqw 4cqw;text-align:center;font-size:7.2cqw;font-weight:900;letter-spacing:.25em;text-transform:uppercase;transform:rotate(-12deg) scale(2.8);opacity:0;filter:drop-shadow(0 2px 4px rgba(220,38,38,.4));animation:stampHit var(--D) cubic-bezier(.12,.9,.15,1) infinite}@keyframes dossierSettle{0%,15%{transform:scale(.92) rotate(-4deg);opacity:0}25%,85%{transform:scale(1) rotate(-1.5deg);opacity:1}100%{transform:scale(1.04) rotate(0deg);opacity:0}}@keyframes stampHit{0%,20%{transform:rotate(-12deg) scale(2.8);opacity:0}26%{transform:rotate(-12deg) scale(0.92);opacity:1}32%,85%{transform:rotate(-12deg) scale(1);opacity:1}100%{transform:rotate(-12deg) scale(0.95);opacity:0}}',
    html: function (o) {
      var dossier = getP(o, "dossier", o.lines[0] || "RESTRICTED");
      var stamp = getP(o, "stamp", o.lines[1] || "TOP SECRET");
      var stampColor = getP(o, "stampColor", "#dc2626");
      return '<div class="sc-stamp-wrap">'
        + '<div class="sc-stamp-folder">'
        + '<div class="sc-stamp-clip"></div>'
        + '<div class="sc-stamp-meta"><span>CIA // SEC-04</span><span>' + esc(dossier) + '</span></div>'
        + '<div class="sc-stamp-line sc-stamp-l1"></div>'
        + '<div class="sc-stamp-line sc-stamp-l2"></div>'
        + '<div class="sc-stamp-line sc-stamp-l3"></div>'
        + '<div class="sc-stamp-mark" style="--ac:' + esc(stampColor) + '">' + esc(stamp) + '</div>'
        + '</div>'
        + '</div>';
    },
    reactCode: `function Scene(props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = props || {};
  const dossier = p.dossier || 'RESTRICTED';
  const stamp = p.stamp || 'TOP SECRET';
  const stampColor = p.stampColor || '#dc2626';

  const folderPop = spring({ frame, fps, config: { damping: 15, stiffness: 90 } });
  const stampSpring = spring({ frame: Math.max(0, frame - 18), fps, config: { damping: 12, stiffness: 150, mass: 0.8 } });
  const stampOpacity = interpolate(frame, [18, 22], [0, 1], { extrapolateRight: 'clamp' });
  const stampScale = interpolate(stampSpring, [0, 1], [2.6, 1]);

  return (
    <AbsoluteFill style={{
      background: 'radial-gradient(circle at center, #1c1917 0%, #09090b 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '6%',
      overflow: 'hidden',
      fontFamily: 'ui-monospace, monospace'
    }}>
      <div style={{
        position: 'relative',
        width: '90%',
        background: 'linear-gradient(135deg, #e2d9cc 0%, #cfc3b0 100%)',
        color: '#1c1917',
        padding: '32px 24px',
        borderRadius: 16,
        boxShadow: '0 30px 80px rgba(0,0,0,0.9), inset 0 0 20px rgba(0,0,0,0.08)',
        border: '1px solid #b8ab96',
        transform: "scale(" + folderPop + ") rotate(-1.5deg)"
      }}>
        <div style={{
          position: 'absolute',
          top: -14,
          left: 32,
          width: 18,
          height: 42,
          border: '3px solid #78716c',
          borderRadius: 99,
          backgroundColor: 'rgba(255,255,255,0.2)',
          boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
          zIndex: 4
        }} />

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          borderBottom: '2px solid #a89f8d',
          paddingBottom: 10,
          marginBottom: 16,
          fontSize: 13,
          fontWeight: 700,
          color: '#57534e',
          letterSpacing: '0.15em'
        }}>
          <span>CIA // SEC-04</span>
          <span>{dossier}</span>
        </div>

        <div style={{ height: 8, backgroundColor: '#b5a995', borderRadius: 4, marginBottom: 12, width: '92%', opacity: 0.7 }} />
        <div style={{ height: 8, backgroundColor: '#b5a995', borderRadius: 4, marginBottom: 12, width: '80%', opacity: 0.7 }} />
        <div style={{ height: 8, backgroundColor: '#b5a995', borderRadius: 4, marginBottom: 16, width: '86%', opacity: 0.7 }} />

        {frame >= 18 && (
          <div style={{
            position: 'absolute',
            top: '36%',
            left: '8%',
            right: '8%',
            border: '5px double ' + stampColor,
            color: stampColor,
            padding: '14px 18px',
            textAlign: 'center',
            fontSize: 32,
            fontWeight: 900,
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            transform: "rotate(-12deg) scale(" + stampScale + ")",
            opacity: stampOpacity,
            filter: 'drop-shadow(0 2px 6px rgba(220,38,38,0.4))'
          }}>
            {stamp}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
}`
  };

  /* 1.2 Red String Investigation Board */
  T["docu-red-string"] = {
    name: "Red String Board", cat: "docu", dark: true, accent: "#ef4444",
    desc: "Photorealistic dark corkboard bulletin with connected evidence polaroids and red yarn thread",
    css: '.sc-cork-wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#18120e url("/assets/corkboard.jpg") center/cover no-repeat;box-shadow:inset 0 0 16cqw rgba(0,0,0,.95);overflow:hidden;font-family:ui-monospace,monospace}.sc-cork-vignette{position:absolute;inset:0;background:radial-gradient(circle at center,transparent 20%,rgba(0,0,0,.8) 100%);pointer-events:none}.sc-cork-stage{position:relative;width:88cqw;height:72cqh}.sc-cork-card{position:absolute;background:#fff;padding:2.5cqw;border-radius:1.5cqw;box-shadow:0 3cqw 10cqw rgba(0,0,0,.85);z-index:2}.sc-c1{top:8cqh;left:4cqw;width:42cqw;transform:rotate(-6deg);animation:corkDrop var(--D) cubic-bezier(.16,1,.3,1) infinite}.sc-c2{bottom:10cqh;right:4cqw;width:44cqw;transform:rotate(5deg);animation:corkDrop var(--D) cubic-bezier(.16,1,.3,1) infinite;animation-delay:.15s}.sc-cork-img{width:100%;height:22cqw;background:#18181b;border-radius:1cqw;overflow:hidden;display:grid;place-items:center}.sc-cork-img img{width:100%;height:100%;object-fit:cover}.sc-cork-cap{font-family:Georgia,serif;font-size:3.2cqw;font-weight:700;color:#18181b;margin-top:1cqh;text-align:center;word-break:break-word}.sc-cork-pin{position:absolute;width:4.8cqw;height:4.8cqw;border-radius:50%;background:radial-gradient(circle at 35% 35%,#ff6b6b,#dc2626);box-shadow:0 1.5cqw 3cqw rgba(0,0,0,.9);z-index:5}.sc-p1{top:6cqh;left:22cqw}.sc-p2{bottom:28cqh;right:24cqw}.sc-cork-svg{position:absolute;inset:0;width:100%;height:100%;z-index:4;pointer-events:none}.sc-cork-line{stroke:#ef4444;stroke-width:3.5;stroke-linecap:round;filter:drop-shadow(0 2px 4px rgba(0,0,0,.8));stroke-dasharray:400;stroke-dashoffset:400;animation:yarnDraw var(--D) cubic-bezier(.16,1,.3,1) infinite}@keyframes corkDrop{0%,15%{transform:scale(.8) translateY(-4cqh);opacity:0}30%,85%{transform:scale(1) translateY(0);opacity:1}100%{transform:scale(1.04);opacity:0}}@keyframes yarnDraw{0%,20%{stroke-dashoffset:400}45%,85%{stroke-dashoffset:0}100%{stroke-dashoffset:400}}',
    html: function (o) {
      var card1 = getP(o, "card1", o.lines[0] || "Suspect Alpha");
      var card2 = getP(o, "card2", o.lines[1] || "Shell Company");
      return '<div class="sc-cork-wrap">'
        + '<div class="sc-cork-vignette"></div>'
        + '<div class="sc-cork-stage">'
        + '<div class="sc-cork-pin sc-p1"></div>'
        + '<div class="sc-cork-pin sc-p2"></div>'
        + '<div class="sc-cork-card sc-c1">'
        + '<div class="sc-cork-img"><img src="/assets/archival_suspect.jpg" alt="Suspect" /></div>'
        + '<div class="sc-cork-cap">' + esc(card1) + '</div>'
        + '</div>'
        + '<div class="sc-cork-card sc-c2">'
        + '<div class="sc-cork-img" style="background:#27272a;color:#cbd5e1;font-size:8cqw;">🏢</div>'
        + '<div class="sc-cork-cap">' + esc(card2) + '</div>'
        + '</div>'
        + '<svg class="sc-cork-svg" viewBox="0 0 100 100" preserveAspectRatio="none"><line class="sc-cork-line" x1="28" y1="16" x2="72" y2="68"/></svg>'
        + '</div>'
        + '</div>';
    },
    reactCode: `function Scene(props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = props || {};
  const card1 = p.card1 || 'Suspect Alpha';
  const card2 = p.card2 || 'Shell Company';

  const pop1 = spring({ frame, fps, config: { damping: 15, stiffness: 90 } });
  const pop2 = spring({ frame: Math.max(0, frame - 8), fps, config: { damping: 15, stiffness: 90 } });
  const stringProgress = spring({ frame: Math.max(0, frame - 16), fps, config: { damping: 14, stiffness: 70 } });
  const dashOffset = interpolate(stringProgress, [0, 1], [400, 0]);

  return (
    <AbsoluteFill style={{
      backgroundColor: '#18120e',
      backgroundImage: 'url("/assets/corkboard.jpg")',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      boxShadow: 'inset 0 0 120px rgba(0,0,0,0.95)'
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.85) 100%)',
        pointerEvents: 'none'
      }} />

      <div style={{ position: 'relative', width: '90%', height: '80%' }}>
        <div style={{
          position: 'absolute',
          top: '10%',
          left: '6%',
          width: '46%',
          backgroundColor: '#ffffff',
          padding: '10px 10px 14px 10px',
          borderRadius: 6,
          boxShadow: '0 20px 60px rgba(0,0,0,0.85)',
          transform: "scale(" + pop1 + ") rotate(-6deg)",
          zIndex: 2
        }}>
          <div style={{ width: '100%', height: 100, backgroundColor: '#18181b', borderRadius: 4, overflow: 'hidden' }}>
            <img src="/assets/archival_suspect.jpg" alt="Suspect" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 13, fontWeight: 700, color: '#18181b', marginTop: 6, textAlign: 'center' }}>
            {card1}
          </div>
        </div>

        <div style={{
          position: 'absolute',
          bottom: '12%',
          right: '6%',
          width: '48%',
          backgroundColor: '#ffffff',
          padding: '10px 10px 14px 10px',
          borderRadius: 6,
          boxShadow: '0 20px 60px rgba(0,0,0,0.85)',
          transform: "scale(" + pop2 + ") rotate(5deg)",
          zIndex: 2
        }}>
          <div style={{ width: '100%', height: 100, backgroundColor: '#27272a', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, color: '#cbd5e1' }}>
            🏢
          </div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 13, fontWeight: 700, color: '#18181b', marginTop: 6, textAlign: 'center' }}>
            {card2}
          </div>
        </div>

        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 4, pointerEvents: 'none' }} viewBox="0 0 100 100" preserveAspectRatio="none">
          <line
            x1="28" y1="20" x2="72" y2="70"
            stroke="#ef4444"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray="400"
            strokeDashoffset={dashOffset}
            style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.9))' }}
          />
        </svg>

        <div style={{
          position: 'absolute',
          top: '9%',
          left: '26%',
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #ff6b6b, #dc2626)',
          boxShadow: '0 6px 14px rgba(0,0,0,0.9)',
          zIndex: 5
        }} />

        <div style={{
          position: 'absolute',
          bottom: '38%',
          right: '27%',
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #ff6b6b, #dc2626)',
          boxShadow: '0 6px 14px rgba(0,0,0,0.9)',
          zIndex: 5
        }} />
      </div>
    </AbsoluteFill>
  );
}`
  };

  /* 1.3 Audit Document Highlighter */
  T["docu-highlighter"] = {
    name: "Doc Highlighter", cat: "docu", dark: false, accent: "#fef08a",
    desc: "Aged audit memorandum with animated organic neon highlighter sweep across key evidence",
    css: '.sc-hl-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:10cqw;background:linear-gradient(180deg,#faf7f2 0%,#f0ebe1 100%);color:#1c1917;box-shadow:inset 0 0 10cqw rgba(0,0,0,.15);font-family:Georgia,serif}.sc-hl-tag{font-family:ui-monospace,monospace;font-size:3cqw;letter-spacing:.25em;color:#78716c;text-transform:uppercase;margin-bottom:2cqh;border-bottom:1px solid #d6cebe;padding-bottom:1cqh}.sc-hl-body{font-size:6.8cqw;line-height:1.5;margin:0 0 3cqh 0;color:#1c1917}.sc-hl-mark{position:relative;display:inline;background:linear-gradient(to right,#fde047,#facc15) no-repeat;background-size:0% 100%;padding:0 .2em;box-decoration-break:clone;-webkit-box-decoration-break:clone;animation:markSweep var(--D) cubic-bezier(.16,1,.3,1) infinite}.sc-hl-source{font-family:ui-monospace,monospace;font-size:3.2cqw;color:#57534e;display:flex;align-items:center;gap:1.5cqw}@keyframes markSweep{0%,18%{background-size:0% 100%}40%,85%{background-size:100% 100%}100%{background-size:0% 100%}}',
    html: function (o) {
      var tag = getP(o, "tag", "// EXHIBIT A: FINANCIAL AUDIT");
      var highlight = getP(o, "highlight", o.lines[0] || "$42,000,000 offshore");
      var source = getP(o, "source", o.lines[1] || "Source: Internal Investigation Report");
      return '<div class="sc-hl-wrap">'
        + '<div class="sc-hl-tag">' + esc(tag) + '</div>'
        + '<h2 class="sc-hl-body">The company secretly transferred <span class="sc-hl-mark">' + esc(highlight) + '</span> before the crash.</h2>'
        + '<div class="sc-hl-source"><span>§</span> ' + esc(source) + '</div>'
        + '</div>';
    },
    reactCode: `function Scene(props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = props || {};
  const tag = p.tag || '// EXHIBIT A: FINANCIAL AUDIT';
  const highlight = p.highlight || '$42,000,000 offshore';
  const source = p.source || 'Source: Internal Investigation Report';

  const markProgress = spring({ frame: Math.max(0, frame - 15), fps, config: { damping: 14, stiffness: 60 } });
  const bgSize = Math.min(100, Math.floor(markProgress * 100)) + '% 100%';

  return (
    <AbsoluteFill style={{
      backgroundColor: '#faf7f2',
      background: 'linear-gradient(180deg, #faf7f2 0%, #f0ebe1 100%)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '10%',
      color: '#1c1917',
      fontFamily: 'Georgia, serif'
    }}>
      <div style={{
        fontFamily: 'ui-monospace, monospace',
        fontSize: 12,
        letterSpacing: '0.25em',
        color: '#78716c',
        textTransform: 'uppercase',
        marginBottom: 16,
        borderBottom: '1px solid #d6cebe',
        paddingBottom: 8
      }}>
        {tag}
      </div>

      <h2 style={{
        fontSize: 26,
        lineHeight: 1.5,
        margin: '0 0 20px 0',
        color: '#1c1917',
        fontWeight: 400
      }}>
        The company secretly transferred{' '}
        <span style={{
          position: 'relative',
          display: 'inline',
          backgroundImage: 'linear-gradient(to right, #fde047, #facc15)',
          backgroundRepeat: 'no-repeat',
          backgroundSize: bgSize,
          padding: '0 4px',
          boxDecorationBreak: 'clone',
          fontWeight: 700
        }}>
          {highlight}
        </span>{' '}
        before the crash.
      </h2>

      <div style={{
        fontFamily: 'ui-monospace, monospace',
        fontSize: 12,
        color: '#57534e',
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }}>
        <span>§</span> {source}
      </div>
    </AbsoluteFill>
  );
}`
  };

  /* 1.4 CIA Declassified Redacted FOIA Tape */
  T["docu-redacted"] = {
    name: "Redacted Tape", cat: "docu", dark: false, accent: "#000000",
    desc: "Black redaction censorship marker sliding across secret intelligence text",
    css: '.sc-foia-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:10cqw;background:linear-gradient(180deg,#f6efe6 0%,#e8ded0 100%);color:#18181b;font-family:ui-monospace,monospace;box-shadow:inset 0 0 12cqw rgba(0,0,0,.15)}.sc-foia-hdr{display:flex;justify-content:space-between;border-bottom:2px solid #a8a29e;padding-bottom:1.5cqh;margin-bottom:3cqh;font-size:2.8cqw;font-weight:700;color:#78716c;letter-spacing:.2em}.sc-foia-body{font-size:6.4cqw;line-height:1.7;font-weight:700;margin:0 0 3cqh 0}.sc-foia-blackout{position:relative;display:inline-block;background:#000;color:transparent;padding:0 .5em;margin:0 .2em;border-radius:2px;clip-path:inset(0 100% 0 0);animation:redactSlide var(--D) cubic-bezier(.16,1,.3,1) infinite}.sc-foia-ref{font-size:3cqw;color:#78716c;letter-spacing:.15em}@keyframes redactSlide{0%,18%{clip-path:inset(0 100% 0 0)}40%,85%{clip-path:inset(0 0 0 0)}100%{clip-path:inset(0 0 0 100%)}}',
    html: function (o) {
      var header = getP(o, "header", "DECLASSIFIED UNDER FOIA");
      var name1 = getP(o, "name1", o.lines[0] || "ROBERT VANCE");
      var name2 = getP(o, "name2", o.lines[1] || "KREMLIN OFFICIALS");
      var ref = getP(o, "ref", o.lines[2] || "File Ref: CIA-2026-X");
      return '<div class="sc-foia-wrap">'
        + '<div class="sc-foia-hdr"><span>' + esc(header) + '</span><span>TOP SECRET</span></div>'
        + '<h2 class="sc-foia-body">Agent <span class="sc-foia-blackout">' + esc(name1) + '</span> met with <span class="sc-foia-blackout">' + esc(name2) + '</span> in Vienna.</h2>'
        + '<div class="sc-foia-ref">' + esc(ref) + '</div>'
        + '</div>';
    },
    reactCode: `function Scene(props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = props || {};
  const header = p.header || 'DECLASSIFIED UNDER FOIA';
  const name1 = p.name1 || 'ROBERT VANCE';
  const name2 = p.name2 || 'KREMLIN OFFICIALS';
  const ref = p.ref || 'File Ref: CIA-2026-X';

  const r1 = spring({ frame: Math.max(0, frame - 12), fps, config: { damping: 15, stiffness: 80 } });
  const r2 = spring({ frame: Math.max(0, frame - 24), fps, config: { damping: 15, stiffness: 80 } });
  const clip1 = (1 - r1) * 100;
  const clip2 = (1 - r2) * 100;

  return (
    <AbsoluteFill style={{
      backgroundColor: '#f6efe6',
      background: 'linear-gradient(180deg, #f6efe6 0%, #e8ded0 100%)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '10%',
      color: '#18181b',
      fontFamily: 'ui-monospace, monospace'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        borderBottom: '2px solid #a8a29e',
        paddingBottom: 10,
        marginBottom: 20,
        fontSize: 12,
        fontWeight: 700,
        color: '#78716c',
        letterSpacing: '0.2em'
      }}>
        <span>{header}</span>
        <span>TOP SECRET</span>
      </div>

      <h2 style={{ fontSize: 24, lineHeight: 1.7, fontWeight: 700, margin: '0 0 20px 0' }}>
        Agent{' '}
        <span style={{
          position: 'relative',
          display: 'inline-block',
          backgroundColor: '#000000',
          color: 'transparent',
          padding: '0 8px',
          margin: '0 4px',
          borderRadius: 2,
          clipPath: "inset(0 " + clip1 + "% 0 0)"
        }}>
          {name1}
        </span>{' '}
        met with{' '}
        <span style={{
          position: 'relative',
          display: 'inline-block',
          backgroundColor: '#000000',
          color: 'transparent',
          padding: '0 8px',
          margin: '0 4px',
          borderRadius: 2,
          clipPath: "inset(0 " + clip2 + "% 0 0)"
        }}>
          {name2}
        </span>{' '}
        in Vienna.
      </h2>

      <div style={{ fontSize: 12, color: '#78716c', letterSpacing: '0.15em' }}>
        {ref}
      </div>
    </AbsoluteFill>
  );
}`
  };

  /* 1.5 Vintage Polaroid Photo Drop */
  T["docu-polaroid-pin"] = {
    name: "Polaroid Photo Drop", cat: "docu", dark: true, accent: "#dc2626",
    desc: "Photorealistic vintage Polaroid instant photo dropping onto surface with 3D metal pushpin",
    css: '.sc-pol-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:6cqw;background:radial-gradient(circle at center,#1c1917 0%,#09090b 100%);overflow:hidden;box-shadow:inset 0 0 16cqw rgba(0,0,0,.95);font-family:Georgia,serif}.sc-pol-card{position:relative;width:72cqw;background:#ffffff;padding:4cqw 4cqw 6cqw;border-radius:1.5cqw;box-shadow:0 4cqw 14cqw rgba(0,0,0,.9);transform:rotate(4deg);animation:polDrop var(--D) cubic-bezier(.16,1,.3,1) infinite}.sc-pol-pin{position:absolute;top:-2.5cqw;left:50%;transform:translateX(-50%);width:5cqw;height:5cqw;border-radius:50%;background:radial-gradient(circle at 35% 35%,#ff6b6b,#dc2626);box-shadow:0 2cqw 4cqw rgba(0,0,0,.9);z-index:4}.sc-pol-imgbox{width:100%;height:52cqw;background:#18181b;border-radius:1cqw;overflow:hidden}.sc-pol-imgbox img{width:100%;height:100%;object-fit:cover}.sc-pol-caption{font-family:Georgia,serif;font-style:italic;font-size:4.2cqw;color:#18181b;margin-top:2cqh;text-align:center;font-weight:700}@keyframes polDrop{0%,10%{transform:translateY(-8cqh) rotate(10deg) scale(1.08);opacity:0}22%{transform:translateY(0) rotate(4deg) scale(1);opacity:1}45%{transform:translateY(-.4cqh) rotate(4.9deg) scale(1.01);opacity:1}68%{transform:translateY(.25cqh) rotate(3.2deg) scale(.995);opacity:1}92%{transform:translateY(0) rotate(4deg) scale(1);opacity:1}100%{transform:translateY(0) rotate(4deg) scale(1);opacity:1}}',
    html: function (o) {
      var caption = getP(o, "caption", o.lines[0] || "Zurich, May 1998");
      return '<div class="sc-pol-wrap">'
        + '<div class="sc-pol-card">'
        + '<div class="sc-pol-pin"></div>'
        + '<div class="sc-pol-imgbox"><img src="/assets/archival_suspect.jpg" alt="Polaroid Still" /></div>'
        + '<div class="sc-pol-caption">' + esc(caption) + '</div>'
        + '</div>'
        + '</div>';
    },
    reactCode: `function Scene(props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = props || {};
  const caption = p.caption || 'Zurich, May 1998';

  const drop = spring({ frame, fps, config: { damping: 14, stiffness: 90, mass: 0.9 } });
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const y = (1 - drop) * -120;
  const rot = interpolate(drop, [0, 1], [14, 4]);

  return (
    <AbsoluteFill style={{
      background: 'radial-gradient(circle at center, #1c1917 0%, #09090b 100%)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '6%',
      overflow: 'hidden',
      fontFamily: 'Georgia, serif'
    }}>
      <div style={{
        position: 'relative',
        width: '80%',
        backgroundColor: '#ffffff',
        padding: '16px 16px 24px 16px',
        borderRadius: 8,
        boxShadow: '0 30px 80px rgba(0,0,0,0.9)',
        transform: "translateY(" + y + "px) rotate(" + rot + "deg)",
        opacity: opacity
      }}>
        <div style={{
          position: 'absolute',
          top: -10,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #ff6b6b, #dc2626)',
          boxShadow: '0 6px 14px rgba(0,0,0,0.9)',
          zIndex: 4
        }} />

        <div style={{ width: '100%', height: 230, backgroundColor: '#18181b', borderRadius: 4, overflow: 'hidden' }}>
          <img src="/assets/archival_suspect.jpg" alt="Polaroid Still" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>

        <div style={{
          fontFamily: 'Georgia, serif',
          fontStyle: 'italic',
          fontSize: 16,
          color: '#18181b',
          marginTop: 12,
          textAlign: 'center',
          fontWeight: 700
        }}>
          {caption}
        </div>
      </div>
    </AbsoluteFill>
  );
}`
  };

  /* 1.6 Investigation Crime Board Target Clue */
  T["docu-magnifying"] = {
    name: "Crime Board Target Clue", cat: "docu", dark: true, accent: "#ef4444",
    desc: "Investigation crime board with pinned sticky note, scotch tape, and hand-drawn red marker circle",
    css: '.sc-board-wrapper{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle at center,#2e1c14 0%,#110b08 100%);font-family:ui-monospace,monospace;overflow:hidden;box-shadow:inset 0 0 15cqw rgba(0,0,0,.9)}.sc-pinned-note{position:absolute;top:8cqh;right:6cqw;background:#fef08a;color:#1e293b;padding:2.5cqw 4cqw;font-size:3.2cqw;font-weight:800;box-shadow:0 2cqw 4cqw rgba(0,0,0,.5);transform:rotate(5deg)}.sc-scotch-tape{position:absolute;top:-2.2cqw;left:30%;width:35%;height:4cqw;background:rgba(255,255,255,.45);backdrop-filter:blur(2px);transform:rotate(-4deg)}.sc-target-container{display:flex;flex-direction:column;align-items:center;gap:1.5cqh}.sc-board-subtext{color:#94a3b8;font-size:3.4cqw;letter-spacing:.25em;margin:0;text-transform:uppercase}.sc-highlight-box{position:relative;padding:3cqw 6cqw}.sc-board-maintext{color:#f8fafc;font-size:8.4cqw;font-weight:900;margin:0;letter-spacing:.08em;text-transform:uppercase}.sc-marker-svg{position:absolute;top:-2.5cqw;left:-2.5cqw;width:calc(100% + 5cqw);height:calc(100% + 5cqw);overflow:visible;pointer-events:none}.sc-marker-path{fill:none;stroke:#ef4444;stroke-width:5px;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:600;stroke-dashoffset:600;filter:drop-shadow(0 0 1.5cqw rgba(239,68,68,.8));animation:drawMarker var(--D) cubic-bezier(.25,1,.5,1) infinite}@keyframes drawMarker{0%,18%{stroke-dashoffset:600}38%,85%{stroke-dashoffset:0}100%{stroke-dashoffset:600}}',
    html: function (o) {
      var note = getP(o, "note", o.lines[0] || "SUSPECT #04");
      var subtext = getP(o, "subtext", o.lines[1] || "PRIMARY TARGET");
      var maintext = getP(o, "maintext", o.lines[2] || "MAIN CLUE");
      var markerColor = getP(o, "markerColor", "#ef4444");
      return '<div class="sc-board-wrapper">'
        + '<div class="sc-pinned-note"><div class="sc-scotch-tape"></div><span class="sc-note-label">' + esc(note) + '</span></div>'
        + '<div class="sc-target-container">'
        + '<h3 class="sc-board-subtext">' + esc(subtext) + '</h3>'
        + '<div class="sc-highlight-box">'
        + '<h1 class="sc-board-maintext">' + esc(maintext) + '</h1>'
        + '<svg class="sc-marker-svg" viewBox="0 0 220 80"><path class="sc-marker-path" style="stroke:' + esc(markerColor) + '" d="M 15 40 C 15 15, 190 10, 205 35 C 215 55, 140 75, 30 70 C 5 68, 12 25, 100 20" /></svg>'
        + '</div>'
        + '</div>'
        + '</div>';
    },
    reactCode: `function Scene(props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = props || {};
  const note = p.note || 'SUSPECT #04';
  const subtext = p.subtext || 'PRIMARY TARGET';
  const maintext = p.maintext || 'MAIN CLUE';

  const pop = spring({ frame, fps, config: { damping: 15, stiffness: 85 } });
  const drawProg = spring({ frame: Math.max(0, frame - 16), fps, config: { damping: 14, stiffness: 70 } });
  const dashOffset = interpolate(drawProg, [0, 1], [600, 0]);

  return (
    <AbsoluteFill style={{
      background: 'radial-gradient(circle at center, #2e1c14 0%, #110b08 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'ui-monospace, monospace',
      overflow: 'hidden',
      boxShadow: 'inset 0 0 100px rgba(0,0,0,0.9)'
    }}>
      <div style={{
        position: 'absolute',
        top: 24,
        right: 20,
        backgroundColor: '#fef08a',
        color: '#1e293b',
        padding: '10px 16px',
        fontSize: 13,
        fontWeight: 800,
        boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
        transform: "scale(" + pop + ") rotate(5deg)"
      }}>
        <div style={{
          position: 'absolute',
          top: -8,
          left: '25%',
          width: '50%',
          height: 16,
          backgroundColor: 'rgba(255,255,255,0.45)',
          transform: 'rotate(-4deg)'
        }} />
        {note}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, transform: "scale(" + pop + ")" }}>
        <h3 style={{ color: '#94a3b8', fontSize: 14, letterSpacing: '0.25em', margin: 0, textTransform: 'uppercase' }}>
          {subtext}
        </h3>
        <div style={{ position: 'relative', padding: '12px 24px' }}>
          <h1 style={{ color: '#f8fafc', fontSize: 36, fontWeight: 900, margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {maintext}
          </h1>
          <svg style={{ position: 'absolute', top: -10, left: -10, width: 'calc(100% + 20px)', height: 'calc(100% + 20px)', overflow: 'visible', pointerEvents: 'none' }} viewBox="0 0 220 80">
            <path
              d="M 15 40 C 15 15, 190 10, 205 35 C 215 55, 140 75, 30 70 C 5 68, 12 25, 100 20"
              fill="none"
              stroke="#ef4444"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="600"
              strokeDashoffset={dashOffset}
              style={{ filter: 'drop-shadow(0 0 8px rgba(239,68,68,0.8))' }}
            />
          </svg>
        </div>
      </div>
    </AbsoluteFill>
  );
}`
  };

  /* 1.7 Medieval King Monarch Reveal */
  T["docu-newspaper"] = {
    name: "Monarch Character Poster", cat: "docu", dark: true, accent: "#fbbf24",
    desc: "Dramatic royal armored king wearing glowing gold crown with camera crop marks and editorial barcode poster",
    css: '.sc-monarch-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;align-items:center;padding:6cqh 6cqw;background:#0d0d11;overflow:hidden;box-shadow:inset 0 0 16cqw rgba(0,0,0,.95);font-family:Impact,sans-serif}.sc-monarch-crop{position:absolute;inset:4cqh 4cqw;border:1px dashed rgba(255,255,255,.15);pointer-events:none}.sc-monarch-barcode{font-family:monospace;font-size:3.2cqw;letter-spacing:.5em;color:#94a3b8;border-top:4px solid #fff;border-bottom:1px solid #fff;padding:.8cqh 0;text-align:center;width:60cqw}.sc-monarch-stage{position:relative;width:76cqw;height:52cqh;border-radius:4cqw;overflow:hidden;box-shadow:0 4cqw 14cqw rgba(0,0,0,.95),0 0 6cqw rgba(251,191,36,.12);animation:monarchZoom var(--D) cubic-bezier(.16,1,.3,1) infinite}.sc-monarch-img{width:100%;height:100%;object-fit:cover;object-position:center top}.sc-monarch-body{text-align:center;position:relative;z-index:2;display:flex;flex-direction:column;align-items:center}.sc-monarch-kicker{font-family:ui-monospace,monospace;font-size:2.8cqw;letter-spacing:.3em;color:#fbbf24;text-transform:uppercase;margin-bottom:.6cqh}.sc-monarch-title{font-size:10cqw;font-weight:900;letter-spacing:.04em;color:#ffffff;line-height:1;margin:0;text-transform:uppercase;text-shadow:0 .4cqw 2cqw rgba(0,0,0,.9)}.sc-monarch-sub{font-family:-apple-system,sans-serif;font-size:3.6cqw;font-weight:600;letter-spacing:.08em;color:#cbd5e1;margin-top:.8cqh}@keyframes monarchZoom{0%,15%{transform:scale(.94);opacity:0}30%,85%{transform:scale(1);opacity:1}100%{transform:scale(1.05);opacity:0}}',
    html: function (o) {
      var kicker = getP(o, "kicker", o.lines[0] || "CHAPTER IV // REIGN");
      var title = getP(o, "title", o.lines[1] || "THE MONARCH");
      var sub = getP(o, "sub", "Born To Rule · Destined For Glory");
      return '<div class="sc-monarch-wrap">'
        + '<div class="sc-monarch-crop"></div>'
        + '<div class="sc-monarch-barcode">||| | |||| || ||| | |||</div>'
        + '<div class="sc-monarch-stage">'
        + '<img class="sc-monarch-img" src="/assets/knight_monarch.jpg" alt="Medieval King Monarch" />'
        + '</div>'
        + '<div class="sc-monarch-body">'
        + '<div class="sc-monarch-kicker">' + esc(kicker) + '</div>'
        + '<h1 class="sc-monarch-title">' + esc(title) + '</h1>'
        + '<div class="sc-monarch-sub">' + esc(sub) + '</div>'
        + '</div>'
        + '</div>';
    },
    reactCode: `function Scene(props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = props || {};
  const kicker = p.kicker || 'CHAPTER IV // REIGN';
  const title = p.title || 'THE MONARCH';
  const sub = p.sub || 'Born To Rule · Destined For Glory';

  const pop = spring({ frame, fps, config: { damping: 16, stiffness: 90 } });
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      backgroundColor: '#0d0d11',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '7% 6%',
      fontFamily: 'Impact, sans-serif',
      overflow: 'hidden',
      boxShadow: 'inset 0 0 100px rgba(0,0,0,0.95)'
    }}>
      <div style={{
        position: 'absolute',
        top: 20, left: 20, right: 20, bottom: 20,
        border: '1px dashed rgba(255,255,255,0.15)',
        pointerEvents: 'none'
      }} />

      <div style={{
        fontFamily: 'monospace',
        fontSize: 12,
        letterSpacing: '0.5em',
        color: '#94a3b8',
        borderTop: '4px solid #ffffff',
        borderBottom: '1px solid #ffffff',
        padding: '6px 0',
        textAlign: 'center',
        width: '65%',
        opacity: opacity
      }}>
        ||| | |||| || ||| | |||
      </div>

      <div style={{
        position: 'relative',
        width: '80%',
        height: '54%',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 30px 90px rgba(0,0,0,0.95), 0 0 40px rgba(251,191,36,0.15)',
        transform: "scale(" + pop + ")",
        opacity: opacity
      }}>
        <img
          src="/assets/knight_monarch.jpg"
          alt="Monarch"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
        />
      </div>

      <div style={{
        textAlign: 'center',
        position: 'relative',
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        opacity: opacity,
        transform: "translateY(" + ((1 - pop) * 25) + "px)"
      }}>
        <div style={{
          fontFamily: 'monospace',
          fontSize: 12,
          letterSpacing: '0.3em',
          color: '#fbbf24',
          textTransform: 'uppercase',
          marginBottom: 4
        }}>
          {kicker}
        </div>
        <h1 style={{
          fontSize: 38,
          fontWeight: 900,
          letterSpacing: '0.05em',
          color: '#ffffff',
          lineHeight: 1,
          margin: 0,
          textTransform: 'uppercase',
          textShadow: '0 4px 20px rgba(0,0,0,0.9)'
        }}>
          {title}
        </h1>
        <div style={{
          fontFamily: '-apple-system, sans-serif',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.08em',
          color: '#cbd5e1',
          marginTop: 6
        }}>
          {sub}
        </div>
      </div>
    </AbsoluteFill>
  );
}`
  };

  /* 1.8 Microfilm Surveillance Scanner CRT */
  T["docu-microfilm"] = {
    name: "Microfilm Scanner", cat: "docu", dark: true, accent: "#22c55e",
    desc: "Retro CRT microfilm archive scanner with glowing green coordinates, scanlines, and live audio waveform",
    css: '.sc-crt-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:5cqh 6cqw;background:#030c06;color:#22c55e;font-family:ui-monospace,monospace;overflow:hidden;box-shadow:inset 0 0 14cqw rgba(0,0,0,.95)}.sc-crt-scan{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,.25) 0px,rgba(0,0,0,.25) 1px,transparent 1px,transparent 3px);pointer-events:none;z-index:5}.sc-crt-top{display:flex;justify-content:space-between;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.3);border-radius:2cqw;padding:1.5cqh 4cqw;font-size:2.8cqw;letter-spacing:.15em}.sc-crt-center{position:relative;flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;margin:2cqh 0}.sc-crt-box{width:88cqw;border:2px solid #22c55e;background:rgba(34,197,94,.04);border-radius:3cqw;padding:5cqw;box-shadow:0 0 4cqw rgba(34,197,94,.2);animation:crtPop var(--D) cubic-bezier(.16,1,.3,1) infinite}.sc-crt-head{font-size:3cqw;letter-spacing:.2em;opacity:.75;margin-bottom:1.5cqh}.sc-crt-title{font-size:6.8cqw;font-weight:900;line-height:1.2;color:#4ade80;margin:0;letter-spacing:.05em;text-shadow:0 0 10px rgba(34,197,94,.6)}.sc-crt-wave{display:flex;align-items:center;gap:1.5cqw;margin-top:2cqh;height:4cqh}.sc-crt-bar{flex:1;background:#22c55e;border-radius:1px;animation:waveBar .8s infinite alternate}.sc-crt-foot{background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.25);border-radius:2cqw;padding:1.5cqh 4cqw;font-size:3cqw;color:#86efac;display:flex;justify-content:space-between}@keyframes crtPop{0%,15%{transform:scale(.92);opacity:0}30%,85%{transform:scale(1);opacity:1}100%{transform:scale(1.04);opacity:0}}@keyframes waveBar{0%{height:20%}100%{height:90%}}',
    html: function (o) {
      var header = getP(o, "header", o.lines[0] || "CONVERSATION RECORDED");
      var status = getP(o, "status", o.lines[1] || "TRANSCRIPT VERIFIED // 100%");
      return '<div class="sc-crt-wrap">'
        + '<div class="sc-crt-scan"></div>'
        + '<div class="sc-crt-top"><span>[SURVEILLANCE TAP // 1974]</span><span>REC ●</span></div>'
        + '<div class="sc-crt-center">'
        + '<div class="sc-crt-box">'
        + '<div class="sc-crt-head">[ARCHIVE SCAN: RECORD #1974]</div>'
        + '<h2 class="sc-crt-title">' + esc(header) + '</h2>'
        + '<div class="sc-crt-wave">'
        + '<div class="sc-crt-bar" style="animation-delay:0s"></div>'
        + '<div class="sc-crt-bar" style="animation-delay:.15s"></div>'
        + '<div class="sc-crt-bar" style="animation-delay:.3s"></div>'
        + '<div class="sc-crt-bar" style="animation-delay:.1s"></div>'
        + '<div class="sc-crt-bar" style="animation-delay:.4s"></div>'
        + '</div>'
        + '</div>'
        + '</div>'
        + '<div class="sc-crt-foot"><span>&gt; ' + esc(status) + '</span><span>00:14:28:09</span></div>'
        + '</div>';
    },
    reactCode: `function Scene(props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = props || {};
  const header = p.header || 'CONVERSATION RECORDED';
  const status = p.status || 'TRANSCRIPT VERIFIED // 100%';

  const pop = spring({ frame, fps, config: { damping: 15, stiffness: 90 } });
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const b1 = Math.abs(Math.sin((frame + 5) / 4)) * 30 + 6;
  const b2 = Math.abs(Math.cos((frame + 12) / 3)) * 34 + 6;
  const b3 = Math.abs(Math.sin((frame + 20) / 5)) * 40 + 8;
  const b4 = Math.abs(Math.cos((frame + 8) / 4)) * 28 + 6;
  const b5 = Math.abs(Math.sin((frame + 16) / 3)) * 36 + 8;

  return (
    <AbsoluteFill style={{
      backgroundColor: '#030c06',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '7% 6%',
      color: '#22c55e',
      fontFamily: 'ui-monospace, monospace',
      overflow: 'hidden',
      boxShadow: 'inset 0 0 100px rgba(0,0,0,0.95)'
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.25) 0px, rgba(0,0,0,0.25) 1px, transparent 1px, transparent 3px)',
        pointerEvents: 'none',
        zIndex: 5
      }} />

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(34,197,94,0.08)',
        border: '1px solid rgba(34,197,94,0.3)',
        borderRadius: 8,
        padding: '8px 16px',
        fontSize: 12,
        letterSpacing: '0.15em',
        opacity: opacity
      }}>
        <span>[SURVEILLANCE TAP // 1974]</span>
        <span style={{ color: '#ef4444' }}>REC ●</span>
      </div>

      <div style={{
        position: 'relative',
        width: '90%',
        alignSelf: 'center',
        border: '2px solid #22c55e',
        backgroundColor: 'rgba(34,197,94,0.04)',
        borderRadius: 16,
        padding: '24px 20px',
        boxShadow: '0 0 30px rgba(34,197,94,0.2)',
        transform: "scale(" + pop + ")",
        opacity: opacity
      }}>
        <div style={{ fontSize: 11, letterSpacing: '0.2em', opacity: 0.75, marginBottom: 8 }}>
          [ARCHIVE SCAN: RECORD #1974]
        </div>
        <h2 style={{
          fontSize: 24,
          fontWeight: 900,
          lineHeight: 1.2,
          color: '#4ade80',
          margin: 0,
          letterSpacing: '0.05em',
          textShadow: '0 0 12px rgba(34,197,94,0.6)'
        }}>
          {header}
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16, height: 40 }}>
          <div style={{ flex: 1, height: b1, backgroundColor: '#22c55e', borderRadius: 2 }} />
          <div style={{ flex: 1, height: b2, backgroundColor: '#22c55e', borderRadius: 2 }} />
          <div style={{ flex: 1, height: b3, backgroundColor: '#22c55e', borderRadius: 2 }} />
          <div style={{ flex: 1, height: b4, backgroundColor: '#22c55e', borderRadius: 2 }} />
          <div style={{ flex: 1, height: b5, backgroundColor: '#22c55e', borderRadius: 2 }} />
        </div>
      </div>

      <div style={{
        backgroundColor: 'rgba(34,197,94,0.06)',
        border: '1px solid rgba(34,197,94,0.25)',
        borderRadius: 8,
        padding: '8px 16px',
        fontSize: 12,
        color: '#86efac',
        display: 'flex',
        justifyContent: 'space-between',
        opacity: opacity
      }}>
        <span>&gt; {status}</span>
        <span>00:14:28:09</span>
      </div>
    </AbsoluteFill>
  );
}`
  };

  /* 1.9 Cinematic Timeline Milestone */
  T["docu-timeline"] = {
    name: "Timeline Milestone", cat: "docu", dark: true, accent: "#f59e0b",
    desc: "Historical epoch ticker sliding along a glowing vertical documentary timeline rail with archival cutout portrait",
    css: '.sc-time-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;align-items:center;padding:6cqh 6cqw;background:#09090b;overflow:hidden;box-shadow:inset 0 0 16cqw rgba(0,0,0,.95);font-family:-apple-system,BlinkMacSystemFont,sans-serif}'
      + '.sc-time-line{position:absolute;top:0;bottom:0;width:3px;background:linear-gradient(180deg,transparent 0%,#f59e0b 50%,transparent 100%);box-shadow:0 0 10px rgba(245,158,11,.6)}'
      + '.sc-time-stage{position:relative;width:72cqw;height:42cqh;display:flex;align-items:flex-end;justify-content:center}'
      + '.sc-time-img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 20px 40px rgba(0,0,0,.9)) drop-shadow(0 0 30px rgba(245,158,11,.3))}'
      + '.sc-time-card{position:relative;z-index:2;width:86cqw;background:linear-gradient(180deg,#18181b 0%,#09090b 100%);border:1px solid rgba(245,158,11,.3);border-radius:4cqw;padding:4cqw;box-shadow:0 4cqw 14cqw rgba(0,0,0,.9);text-align:center;animation:timePop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-time-tag{font-family:ui-monospace,monospace;font-size:2.8cqw;letter-spacing:.3em;color:#a1a1aa;text-transform:uppercase;margin-bottom:.6cqh}'
      + '.sc-time-year{font-size:14cqw;font-weight:900;color:#f59e0b;line-height:1;margin:.5cqh 0;text-shadow:0 0 25px rgba(245,158,11,.5)}'
      + '.sc-time-sub{font-size:5.2cqw;font-weight:800;color:#fff;margin-top:.6cqh}'
      + '.sc-time-desc{font-size:3.4cqw;color:#94a3b8;margin-top:.6cqh}'
      + '@keyframes timePop{0%,15%{transform:scale(.95);opacity:0}30%,85%{transform:scale(1);opacity:1}100%{transform:scale(1.05);opacity:0}}',
    html: function (o) {
      var year = getP(o, "year", o.lines[0] || "1905");
      var sub = getP(o, "sub", o.lines[1] || "Annus Mirabilis Papers");
      var desc = getP(o, "desc", o.lines[2] || "The foundation of modern physics");
      return '<div class="sc-time-wrap">'
        + '<div class="sc-time-line"></div>'
        + '<div class="sc-time-stage">'
        + '<img src="/assets/einstein_photo_cutout.png" class="sc-time-img" alt="Historical Timeline Portrait" />'
        + '</div>'
        + '<div class="sc-time-card">'
        + '<div class="sc-time-tag">HISTORICAL EPOCH</div>'
        + '<div class="sc-time-year">' + esc(year) + '</div>'
        + '<div class="sc-time-sub">' + esc(sub) + '</div>'
        + '<div class="sc-time-desc">' + esc(desc) + '</div>'
        + '</div>'
        + '</div>';
    },
    reactCode: `function Scene(props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = props || {};
  const year = p.year || '2008';
  const sub = p.sub || 'The Housing Crisis';
  const desc = p.desc || 'Where it all began';

  const pop = spring({ frame, fps, config: { damping: 15, stiffness: 90 } });
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      backgroundColor: '#09090b',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '6%',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        top: 0, bottom: 0,
        width: 3,
        background: 'linear-gradient(180deg, transparent 0%, #f59e0b 50%, transparent 100%)',
        boxShadow: '0 0 15px rgba(245,158,11,0.6)'
      }} />

      <div style={{
        position: 'relative',
        zIndex: 2,
        width: '88%',
        backgroundColor: '#18181b',
        border: '1px solid rgba(245,158,11,0.3)',
        borderRadius: 20,
        padding: '30px 20px',
        boxShadow: '0 30px 80px rgba(0,0,0,0.9), 0 0 30px rgba(245,158,11,0.1)',
        textAlign: 'center',
        transform: "scale(" + pop + ")",
        opacity: opacity
      }}>
        <div style={{ fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.3em', color: '#a1a1aa', textTransform: 'uppercase' }}>
          HISTORICAL EPOCH
        </div>
        <div style={{
          fontSize: 68,
          fontWeight: 900,
          color: '#f59e0b',
          lineHeight: 1,
          margin: '8px 0',
          textShadow: '0 0 30px rgba(245,158,11,0.5)'
        }}>
          {year}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#ffffff', marginTop: 4 }}>
          {sub}
        </div>
        <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>
          {desc}
        </div>
      </div>
    </AbsoluteFill>
  );
}`
  };

  /* 1.10 Greek Sculpture Volumetric Spotlight */
  T["docu-folder"] = {
    name: "Greek Sculpture Spotlight", cat: "docu", dark: true, accent: "#ffffff",
    desc: "Classical marble Greek philosopher bust bathed in dramatic volumetric chiaroscuro spotlight beam with cinematic typography",
    css: '.sc-statue-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;align-items:center;padding:8cqh 6cqw;background:#050507;overflow:hidden;box-shadow:inset 0 0 16cqw rgba(0,0,0,.95);font-family:Georgia,serif}.sc-statue-beam{position:absolute;top:-10cqh;left:-10cqw;width:120cqw;height:120cqw;background:radial-gradient(ellipse at top left,rgba(255,255,255,.22) 0%,rgba(255,255,255,.06) 40%,transparent 70%);transform:rotate(-15deg);pointer-events:none;filter:blur(2cqw)}.sc-statue-stage{position:relative;width:74cqw;height:50cqh;border-radius:4cqw;overflow:hidden;box-shadow:0 4cqw 12cqw rgba(0,0,0,.9),0 0 4cqw rgba(255,255,255,.05);animation:statueZoom var(--D) cubic-bezier(.16,1,.3,1) infinite}.sc-statue-img{width:100%;height:100%;object-fit:cover;object-position:center top;filter:contrast(1.15) brightness(1.05)}.sc-statue-body{text-align:center;position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;margin-top:1.5cqh}.sc-statue-tag{font-family:ui-monospace,monospace;font-size:2.8cqw;letter-spacing:.35em;color:rgba(255,255,255,.45);text-transform:uppercase;margin-bottom:1cqh}.sc-statue-title{font-size:9.2cqw;font-weight:400;letter-spacing:.12em;color:#f8fafc;line-height:1;margin:0;text-shadow:0 .4cqw 2cqw rgba(0,0,0,.8)}.sc-statue-sub{font-size:3.6cqw;letter-spacing:.25em;color:#94a3b8;margin-top:1cqh;text-transform:uppercase}@keyframes statueZoom{0%,15%{transform:scale(.96);opacity:1}30%{transform:scale(1);opacity:1}55%{transform:scale(1.012) translateY(-.5cqh);opacity:1}75%{transform:scale(1.004) translateY(.3cqh);opacity:1}85%{transform:scale(1);opacity:1}100%{transform:scale(1.04);opacity:0}}',
    html: function (o) {
      var tag = getP(o, "tag", o.lines[0] || "ARCHIVE // 340 BC");
      var title = getP(o, "title", o.lines[1] || "EFFORTLESS MOTION");
      var subtitle = getP(o, "subtitle", o.lines[2] || "PHILOSOPHY OF DESIGN");
      var img = getP(o, "photo", getP(o, "image", "/assets/statue_bust.jpg"));
      var beam = getP(o, "beamColor", "rgba(255,255,255,.22)");
      return '<div class="sc-statue-wrap">'
        + '<div class="sc-statue-beam" style="background:radial-gradient(ellipse at top left,' + esc(beam) + ' 0%,rgba(255,255,255,.06) 40%,transparent 70%)"></div>'
        + '<div class="sc-statue-stage">'
        + (typeof img === "string" && (img.indexOf("data:image/") === 0 || img.indexOf("http") === 0 || img.indexOf("/") === 0)
            ? '<img class="sc-statue-img" src="' + esc(img) + '" alt="Artwork" />'
            : '<div style="width:100%;height:100%;display:grid;place-items:center;font-size:14cqw;background:#18181b;">' + esc(img) + '</div>')
        + '</div>'
        + '<div class="sc-statue-body">'
        + '<div class="sc-statue-tag">' + esc(tag) + '</div>'
        + '<h1 class="sc-statue-title">' + esc(title) + '</h1>'
        + '<div class="sc-statue-sub">' + esc(subtitle) + '</div>'
        + '</div>'
        + '</div>';
    },
    reactCode: `function Scene(props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = props || {};
  const tag = p.tag || 'ARCHIVE // 340 BC';
  const title = p.title || 'EFFORTLESS MOTION';
  const subtitle = p.subtitle || 'PHILOSOPHY OF DESIGN';

  const scale = spring({ frame, fps, config: { damping: 18, stiffness: 80 } });
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const beamOpacity = interpolate(frame, [0, 20], [0, 0.4], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      backgroundColor: '#050507',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8% 6%',
      fontFamily: 'Georgia, serif',
      overflow: 'hidden',
      boxShadow: 'inset 0 0 100px rgba(0,0,0,0.95)'
    }}>
      <div style={{
        position: 'absolute',
        top: '-20%',
        left: '-20%',
        width: '140%',
        height: '140%',
        background: 'radial-gradient(ellipse at top left, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.06) 45%, transparent 70%)',
        transform: 'rotate(-15deg)',
        pointerEvents: 'none',
        filter: 'blur(15px)',
        opacity: beamOpacity
      }} />

      <div style={{
        position: 'relative',
        width: '78%',
        height: '52%',
        borderRadius: 24,
        overflow: 'hidden',
        boxShadow: '0 30px 80px rgba(0,0,0,0.95), 0 0 30px rgba(255,255,255,0.08)',
        transform: "scale(" + scale + ") translateY(" + ((1 - scale) * 40) + "px)",
        opacity: opacity
      }}>
        <img
          src="/assets/statue_bust.jpg"
          alt="Statue Bust"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center top',
            filter: 'contrast(1.15) brightness(1.05)'
          }}
        />
      </div>

      <div style={{
        textAlign: 'center',
        position: 'relative',
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        opacity: opacity,
        transform: "translateY(" + ((1 - scale) * 20) + "px)"
      }}>
        <div style={{
          fontFamily: 'monospace',
          fontSize: 13,
          letterSpacing: '0.35em',
          color: 'rgba(255,255,255,0.45)',
          textTransform: 'uppercase',
          marginBottom: 8
        }}>
          {tag}
        </div>
        <h1 style={{
          fontSize: 34,
          fontWeight: 400,
          letterSpacing: '0.12em',
          color: '#f8fafc',
          lineHeight: 1.1,
          margin: 0,
          textShadow: '0 4px 20px rgba(0,0,0,0.8)'
        }}>
          {title}
        </h1>
        <div style={{
          fontSize: 14,
          letterSpacing: '0.25em',
          color: '#94a3b8',
          marginTop: 10,
          textTransform: 'uppercase'
        }}>
          {subtitle}
        </div>
      </div>
    </AbsoluteFill>
  );
}`
  };

  /* ============================================================
     CATEGORY 2: PAPER & CUTOUT (10 templates)
     ============================================================ */

  /* 2.1 Torn Paper on Cutting Mat */
  T["paper-torn-rip"] = {
    name: "Torn Paper on Cutting Mat", cat: "paper", dark: true, accent: "#d32f2f",
    desc: "Procedural torn paper cutout slamming onto studio green grid cutting mat with deckle edges and heavy drop shadow",
    css: '.sc-mat-wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background-color:#0b2314;background-image:linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px);background-size:4.5cqw 4.5cqw;overflow:hidden;box-shadow:inset 0 0 16cqw rgba(0,0,0,.9);font-family:Impact,Montserrat,sans-serif}.sc-mat-grid{position:absolute;inset:0;border:1px solid rgba(255,255,255,.14);margin:4cqw;pointer-events:none}.sc-torn-paper{position:relative;width:82cqw;padding:7cqw 6cqw;background:#d32f2f;color:#fff;text-align:center;clip-path:polygon(0% 4%, 4% 0%, 10% 3%, 16% 0%, 22% 4%, 28% 1%, 34% 5%, 40% 0%, 46% 3%, 52% 0%, 58% 4%, 64% 1%, 70% 5%, 76% 0%, 82% 3%, 88% 1%, 94% 4%, 100% 0%, 98% 25%, 100% 50%, 97% 75%, 100% 100%, 95% 97%, 89% 100%, 83% 96%, 77% 100%, 71% 95%, 65% 99%, 59% 96%, 53% 100%, 47% 95%, 41% 99%, 35% 96%, 29% 100%, 23% 95%, 17% 99%, 11% 96%, 5% 100%, 0% 97%, 2% 75%, 0% 50%, 3% 25%);box-shadow:0 4cqw 12cqw rgba(0,0,0,.85);animation:paperSlam var(--D) cubic-bezier(0.175,0.885,0.32,1.275) infinite}.sc-paper-tag{display:inline-block;font-family:ui-monospace,monospace;font-size:3cqw;letter-spacing:.25em;font-weight:800;opacity:.9;margin-bottom:1cqh;background:rgba(0,0,0,.3);padding:.4cqh 2cqw;border-radius:1cqw}.sc-paper-heading{font-size:8.4cqw;line-height:1.05;font-weight:900;margin:1cqh 0 0 0;letter-spacing:.04em;text-transform:uppercase;text-shadow:0 .4cqw 1cqw rgba(0,0,0,.4)}@keyframes paperSlam{0%,10%{transform:scale(1.4) rotate(-8deg);opacity:0}22%{transform:scale(1) rotate(-2deg);opacity:1}45%{transform:scale(1.015) rotate(-1.2deg);opacity:1}68%{transform:scale(.99) rotate(-2.6deg);opacity:1}92%{transform:scale(1) rotate(-2deg);opacity:1}100%{transform:scale(1) rotate(-2deg);opacity:1}}',
    html: function (o) {
      var tag = getP(o, "tag", o.lines[0] || "CONFIDENTIAL");
      var heading = getP(o, "heading", o.lines[1] || "UNCOVER THE TRUTH");
      var paperColor = getP(o, "paperColor", "#d32f2f");
      var matColor = getP(o, "matColor", "#0b2314");
      return '<div class="sc-mat-wrap" style="background-color:' + esc(matColor) + '">'
        + '<div class="sc-mat-grid"></div>'
        + '<div class="sc-torn-paper" style="background:' + esc(paperColor) + '">'
        + '<span class="sc-paper-tag">' + esc(tag) + '</span>'
        + '<h2 class="sc-paper-heading">' + esc(heading) + '</h2>'
        + '</div>'
        + '</div>';
    },
    reactCode: `function Scene(props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = props || {};
  const tag = p.tag || 'CONFIDENTIAL';
  const heading = p.heading || 'UNCOVER THE TRUTH';
  const paperColor = p.paperColor || '#d32f2f';
  const matColor = p.matColor || '#0b2314';

  const slam = spring({ frame, fps, config: { damping: 12, stiffness: 120, mass: 0.8 } });
  const scale = interpolate(slam, [0, 1], [1.5, 1]);
  const rot = interpolate(slam, [0, 1], [-8, -2]);
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      backgroundColor: matColor,
      backgroundImage: 'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
      backgroundSize: '24px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      boxShadow: 'inset 0 0 100px rgba(0,0,0,0.9)',
      fontFamily: 'Impact, Montserrat, sans-serif'
    }}>
      <div style={{
        position: 'absolute',
        inset: 20,
        border: '1px solid rgba(255,255,255,0.14)',
        pointerEvents: 'none'
      }} />

      <div style={{
        position: 'relative',
        width: '84%',
        padding: '36px 28px',
        backgroundColor: paperColor,
        color: '#ffffff',
        textAlign: 'center',
        clipPath: 'polygon(0% 4%, 4% 0%, 10% 3%, 16% 0%, 22% 4%, 28% 1%, 34% 5%, 40% 0%, 46% 3%, 52% 0%, 58% 4%, 64% 1%, 70% 5%, 76% 0%, 82% 3%, 88% 1%, 94% 4%, 100% 0%, 98% 25%, 100% 50%, 97% 75%, 100% 100%, 95% 97%, 89% 100%, 83% 96%, 77% 100%, 71% 95%, 65% 99%, 59% 96%, 53% 100%, 47% 95%, 41% 99%, 35% 96%, 29% 100%, 23% 95%, 17% 99%, 11% 96%, 5% 100%, 0% 97%, 2% 75%, 0% 50%, 3% 25%)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.85)',
        transform: "scale(" + scale + ") rotate(" + rot + "deg)",
        opacity: opacity
      }}>
        <span style={{
          display: 'inline-block',
          fontFamily: 'ui-monospace, monospace',
          fontSize: 13,
          letterSpacing: '0.25em',
          fontWeight: 800,
          opacity: 0.9,
          marginBottom: 8,
          backgroundColor: 'rgba(0,0,0,0.3)',
          padding: '4px 12px',
          borderRadius: 4
        }}>
          {tag}
        </span>
        <h2 style={{
          fontSize: 36,
          lineHeight: 1.05,
          fontWeight: 900,
          margin: '8px 0 0 0',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          textShadow: '0 4px 12px rgba(0,0,0,0.4)'
        }}>
          {heading}
        </h2>
      </div>
    </AbsoluteFill>
  );
}`
  };

  /* 2.2 Scotch Tape Note Reveal */
  T["paper-tape-strip"] = {
    name: "Tape Strip Reveal", cat: "paper", dark: true, accent: "#fef08a",
    desc: "Aged textured manila card pinned by dual semi-transparent frosted scotch tape strips with animated neon marker sweep",
    css: '.sc-tape-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:6cqw;background:radial-gradient(circle at center,#1e1b18 0%,#0c0a09 100%);overflow:hidden;box-shadow:inset 0 0 16cqw rgba(0,0,0,.95);font-family:Georgia,serif}.sc-tape-card{position:relative;width:82cqw;background:#fff9e6;color:#1c1917;padding:8cqw 6cqw;border-radius:2px;box-shadow:0 3cqw 12cqw rgba(0,0,0,.8),0 .5cqw 2cqw rgba(0,0,0,.3);transform:rotate(-2.5deg);animation:tapeSettle var(--D) cubic-bezier(.16,1,.3,1) infinite}.sc-tape-strip{position:absolute;width:28%;height:5.5cqw;background:rgba(255,255,255,.55);backdrop-filter:blur(3px);box-shadow:0 1px 4px rgba(0,0,0,.25);border-left:1px dashed rgba(0,0,0,.15);border-right:1px dashed rgba(0,0,0,.15);z-index:4}.sc-ts-tl{top:-2.8cqw;left:8%;transform:rotate(-6deg)}.sc-ts-tr{top:-2.8cqw;right:8%;transform:rotate(5deg)}.sc-tape-tag{font-family:ui-monospace,monospace;font-size:2.8cqw;letter-spacing:.25em;color:#78716c;text-transform:uppercase;margin-bottom:1.5cqh}.sc-tape-title{font-size:7.2cqw;font-weight:900;color:#1c1917;line-height:1.2;margin:0 0 2cqh 0}.sc-tape-hl{position:relative;display:inline;background:linear-gradient(to right,#fde047,#facc15) no-repeat;background-size:0% 100%;padding:0 .2em;box-decoration-break:clone;-webkit-box-decoration-break:clone;animation:tapeHl var(--D) cubic-bezier(.16,1,.3,1) infinite}.sc-tape-desc{font-size:3.8cqw;color:#44403c;line-height:1.5;margin:0}@keyframes tapeSettle{0%,10%{transform:scale(.92) rotate(-5deg);opacity:0}22%,92%{transform:scale(1) rotate(-2.5deg);opacity:1}100%{transform:scale(1) rotate(-2.5deg);opacity:1}}@keyframes tapeHl{0%,18%{background-size:0% 100%}38%,90%{background-size:100% 100%}100%{background-size:100% 100%}}',
    html: function (o) {
      var tag = getP(o, "tag", o.lines[0] || "KEY TAKEAWAY");
      var title = getP(o, "title", o.lines[1] || "Attention is the new currency.");
      var desc = getP(o, "desc", o.lines[2] || "Hook your audience in the first 3 seconds.");
      return '<div class="sc-tape-wrap">'
        + '<div class="sc-tape-card">'
        + '<div class="sc-tape-strip sc-ts-tl"></div>'
        + '<div class="sc-tape-strip sc-ts-tr"></div>'
        + '<div class="sc-tape-tag">' + esc(tag) + '</div>'
        + '<h2 class="sc-tape-title"><span class="sc-tape-hl">' + esc(title) + '</span></h2>'
        + '<p class="sc-tape-desc">' + esc(desc) + '</p>'
        + '</div>'
        + '</div>';
    },
    reactCode: `function Scene(props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = props || {};
  const tag = p.tag || 'KEY TAKEAWAY';
  const title = p.title || 'Attention is the new currency.';
  const desc = p.desc || 'Hook your audience in the first 3 seconds.';

  const pop = spring({ frame, fps, config: { damping: 14, stiffness: 90 } });
  const hlProg = spring({ frame: Math.max(0, frame - 15), fps, config: { damping: 14, stiffness: 60 } });
  const hlWidth = hlProg * 100;
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      background: 'radial-gradient(circle at center, #1e1b18 0%, #0c0a09 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '6%',
      overflow: 'hidden',
      boxShadow: 'inset 0 0 100px rgba(0,0,0,0.95)',
      fontFamily: 'Georgia, serif'
    }}>
      <div style={{
        position: 'relative',
        width: '86%',
        backgroundColor: '#fff9e6',
        color: '#1c1917',
        padding: '36px 26px',
        borderRadius: 2,
        boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 4px 10px rgba(0,0,0,0.3)',
        transform: "scale(" + pop + ") rotate(-2.5deg)",
        opacity: opacity
      }}>
        <div style={{
          position: 'absolute',
          top: -14,
          left: '8%',
          width: '30%',
          height: 24,
          backgroundColor: 'rgba(255,255,255,0.55)',
          transform: 'rotate(-6deg)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
          zIndex: 4
        }} />

        <div style={{
          position: 'absolute',
          top: -14,
          right: '8%',
          width: '30%',
          height: 24,
          backgroundColor: 'rgba(255,255,255,0.55)',
          transform: 'rotate(5deg)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
          zIndex: 4
        }} />

        <div style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: 12,
          letterSpacing: '0.25em',
          color: '#78716c',
          textTransform: 'uppercase',
          marginBottom: 10
        }}>
          {tag}
        </div>

        <h2 style={{
          fontSize: 26,
          fontWeight: 900,
          color: '#1c1917',
          lineHeight: 1.25,
          margin: '0 0 12px 0'
        }}>
          <span style={{
            backgroundImage: 'linear-gradient(to right, #fde047, #facc15)',
            backgroundRepeat: 'no-repeat',
            backgroundSize: hlWidth + '% 100%',
            padding: '0 6px'
          }}>
            {title}
          </span>
        </h2>

        <p style={{
          fontSize: 14,
          color: '#44403c',
          lineHeight: 1.5,
          margin: 0
        }}>
          {desc}
        </p>
      </div>
    </AbsoluteFill>
  );
}`
  };

  /* 2.3 Holographic Sticker Peel */
  T["paper-sticker"] = {
    name: "Holo Sticker Peel", cat: "paper", dark: true, accent: "#ec4899",
    desc: "Metallic rainbow iridescent holographic vinyl badge sticker with 3D corner peel flap and slap-down bounce",
    css: '.sc-stk-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:6cqw;background:radial-gradient(circle at center,#1e112a 0%,#09050d 100%);overflow:hidden;box-shadow:inset 0 0 16cqw rgba(0,0,0,.95);font-family:Impact,sans-serif}.sc-stk-badge{position:relative;width:68cqw;height:68cqw;border-radius:50%;background:linear-gradient(135deg,#f43f5e,#eab308,#06b6d4,#a855f7,#f43f5e);padding:1.5cqw;box-shadow:0 4cqw 14cqw rgba(0,0,0,.9),0 0 6cqw rgba(236,72,153,.3);animation:stkSlap var(--D) cubic-bezier(.175,.885,.32,1.275) infinite}.sc-stk-inner{width:100%;height:100%;border-radius:50%;background:#09090b;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#fff;padding:6cqw;border:2px solid rgba(255,255,255,.2)}.sc-stk-icon{font-size:12cqw;filter:drop-shadow(0 0 2cqw #ec4899);margin-bottom:.5cqh}.sc-stk-title{font-size:8cqw;font-weight:900;letter-spacing:.05em;margin:0;text-transform:uppercase;color:#fff;text-shadow:0 0 12px rgba(255,255,255,.4)}.sc-stk-sub{font-family:ui-monospace,monospace;font-size:2.8cqw;letter-spacing:.3em;color:#f472b6;margin-top:1cqh;text-transform:uppercase}.sc-stk-peel{position:absolute;bottom:0;right:0;width:18cqw;height:18cqw;background:linear-gradient(135deg,transparent 50%,#e2e8f0 50%);border-bottom-right-radius:50%;filter:drop-shadow(-4px -4px 6px rgba(0,0,0,.6))}@keyframes stkSlap{0%,10%{transform:scale(1.4) rotate(-12deg);opacity:0}22%{transform:scale(1) rotate(0deg);opacity:1}45%{transform:scale(1.02) rotate(1.4deg);opacity:1}68%{transform:scale(.99) rotate(-1.4deg);opacity:1}92%{transform:scale(1) rotate(0deg);opacity:1}100%{transform:scale(1) rotate(0deg);opacity:1}}',
    html: function (o) {
      var icon = getP(o, "icon", "⚡");
      var title = getP(o, "title", o.lines[0] || "VIRAL CLUB");
      var sub = getP(o, "sub", o.lines[1] || "OFFICIAL ASSET // 2026");
      return '<div class="sc-stk-wrap">'
        + '<div class="sc-stk-badge">'
        + '<div class="sc-stk-inner">'
        + '<div class="sc-stk-icon">' + esc(icon) + '</div>'
        + '<h2 class="sc-stk-title">' + esc(title) + '</h2>'
        + '<div class="sc-stk-sub">' + esc(sub) + '</div>'
        + '</div>'
        + '<div class="sc-stk-peel"></div>'
        + '</div>'
        + '</div>';
    },
    reactCode: `function Scene(props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = props || {};
  const icon = p.icon || '⚡';
  const title = p.title || 'VIRAL CLUB';
  const sub = p.sub || 'OFFICIAL ASSET // 2026';

  const slam = spring({ frame, fps, config: { damping: 12, stiffness: 130, mass: 0.8 } });
  const scale = interpolate(slam, [0, 1], [1.5, 1]);
  const rot = interpolate(slam, [0, 1], [-14, 0]);
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      background: 'radial-gradient(circle at center, #1e112a 0%, #09050d 100%)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '6%',
      overflow: 'hidden',
      boxShadow: 'inset 0 0 100px rgba(0,0,0,0.95)',
      fontFamily: 'Impact, sans-serif'
    }}>
      <div style={{
        position: 'relative',
        width: 250,
        height: 250,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #f43f5e, #eab308, #06b6d4, #a855f7, #f43f5e)',
        padding: 6,
        boxShadow: '0 30px 80px rgba(0,0,0,0.9), 0 0 40px rgba(236,72,153,0.3)',
        transform: "scale(" + scale + ") rotate(" + rot + "deg)",
        opacity: opacity
      }}>
        <div style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          backgroundColor: '#09090b',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          color: '#ffffff',
          padding: 20,
          border: '2px solid rgba(255,255,255,0.2)'
        }}>
          <div style={{ fontSize: 44, filter: 'drop-shadow(0 0 10px #ec4899)', marginBottom: 4 }}>
            {icon}
          </div>
          <h2 style={{
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: '0.05em',
            margin: 0,
            textTransform: 'uppercase',
            color: '#ffffff',
            textShadow: '0 0 12px rgba(255,255,255,0.4)'
          }}>
            {title}
          </h2>
          <div style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: 11,
            letterSpacing: '0.3em',
            color: '#f472b6',
            marginTop: 6,
            textTransform: 'uppercase'
          }}>
            {sub}
          </div>
        </div>

        <div style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 55,
          height: 55,
          background: 'linear-gradient(135deg, transparent 50%, #e2e8f0 50%)',
          borderBottomRightRadius: '50%',
          filter: 'drop-shadow(-4px -4px 6px rgba(0,0,0,0.6))'
        }} />
      </div>
    </AbsoluteFill>
  );
}`
  };

  /* 2.4 Legal Pad Notebook */
  T["paper-notebook"] = {
    name: "Kraft Legal Pad", cat: "paper", dark: true, accent: "#ef4444",
    desc: "Authentic yellow legal pad with red double left margin rule, blue lines, and animated handwritten checklist points",
    css: '.sc-pad-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:6cqw;background:radial-gradient(circle at center,#1e1b18 0%,#09090b 100%);overflow:hidden;box-shadow:inset 0 0 16cqw rgba(0,0,0,.95);font-family:Georgia,serif}.sc-pad-sheet{position:relative;width:84cqw;background:#fef9c3;background-image:repeating-linear-gradient(180deg,transparent 0px,transparent 3.8cqh,#bae6fd 3.8cqh,#bae6fd 3.9cqh);color:#1c1917;border-radius:2cqw;padding:5cqh 5cqw 4cqh 12cqw;border-left:4px double #ef4444;box-shadow:0 4cqw 14cqw rgba(0,0,0,.85);animation:padDrop var(--D) cubic-bezier(.16,1,.3,1) infinite}.sc-pad-staple{position:absolute;top:0;left:0;right:0;height:3.5cqh;background:#1c1917;border-top-left-radius:2cqw;border-top-right-radius:2cqw;display:flex;align-items:center;justify-content:space-around;padding:0 10cqw}.sc-staple-bar{width:8cqw;height:3px;background:#94a3b8;border-radius:1px}.sc-pad-title{font-size:6.4cqw;font-weight:900;margin:0 0 2cqh 0;line-height:1.2;color:#1c1917}.sc-pad-item{display:flex;align-items:center;gap:2cqw;font-size:3.8cqw;font-weight:700;color:#334155;margin-bottom:1.2cqh}.sc-pad-chk{color:#16a34a;font-size:4.5cqw;font-weight:900}@keyframes padDrop{0%,10%{transform:translateY(-4cqh);opacity:0}22%{transform:translateY(0);opacity:1}45%{transform:translateY(-.5cqh);opacity:1}68%{transform:translateY(.3cqh);opacity:1}92%{transform:translateY(0);opacity:1}100%{transform:translateY(0);opacity:1}}',
    html: function (o) {
      var title = getP(o, "title", o.lines[0] || "Rule #1: The Hook");
      var item1 = getP(o, "item1", o.lines[1] || "First 3 seconds dictate 90% views");
      var item2 = getP(o, "item2", o.lines[2] || "Pattern interrupt every 4 seconds");
      return '<div class="sc-pad-wrap">'
        + '<div class="sc-pad-sheet">'
        + '<div class="sc-pad-staple"><div class="sc-staple-bar"></div><div class="sc-staple-bar"></div></div>'
        + '<h2 class="sc-pad-title">' + esc(title) + '</h2>'
        + '<div class="sc-pad-item"><span class="sc-pad-chk">✓</span> <span>' + esc(item1) + '</span></div>'
        + '<div class="sc-pad-item"><span class="sc-pad-chk">✓</span> <span>' + esc(item2) + '</span></div>'
        + '</div>'
        + '</div>';
    },
    reactCode: `function Scene(props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = props || {};
  const title = p.title || 'Rule #1: The Hook';
  const item1 = p.item1 || 'First 3 seconds dictate 90% views';
  const item2 = p.item2 || 'Pattern interrupt every 4 seconds';

  const drop = spring({ frame, fps, config: { damping: 14, stiffness: 90 } });
  const y = (1 - drop) * -60;
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
  const chk1 = frame >= 18;
  const chk2 = frame >= 32;

  return (
    <AbsoluteFill style={{
      background: 'radial-gradient(circle at center, #1e1b18 0%, #09090b 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '6%',
      overflow: 'hidden',
      boxShadow: 'inset 0 0 100px rgba(0,0,0,0.95)',
      fontFamily: 'Georgia, serif'
    }}>
      <div style={{
        position: 'relative',
        width: '88%',
        backgroundColor: '#fef9c3',
        backgroundImage: 'repeating-linear-gradient(180deg, transparent 0px, transparent 32px, #bae6fd 32px, #bae6fd 33px)',
        color: '#1c1917',
        borderRadius: 8,
        padding: '40px 24px 30px 48px',
        borderLeft: '4px double #ef4444',
        boxShadow: '0 30px 80px rgba(0,0,0,0.85)',
        transform: "translateY(" + y + "px)",
        opacity: opacity
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 24,
          backgroundColor: '#1c1917',
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '0 40px'
        }}>
          <div style={{ width: 30, height: 3, backgroundColor: '#94a3b8', borderRadius: 1 }} />
          <div style={{ width: 30, height: 3, backgroundColor: '#94a3b8', borderRadius: 1 }} />
        </div>

        <h2 style={{
          fontSize: 24,
          fontWeight: 900,
          margin: '0 0 16px 0',
          lineHeight: 1.2,
          color: '#1c1917'
        }}>
          {title}
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 12 }}>
          <span style={{ color: '#16a34a', fontSize: 18, fontWeight: 900, opacity: chk1 ? 1 : 0.2 }}>✓</span>
          <span>{item1}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#334155' }}>
          <span style={{ color: '#16a34a', fontSize: 18, fontWeight: 900, opacity: chk2 ? 1 : 0.2 }}>✓</span>
          <span>{item2}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
}`
  };

  /* 2.5 Post-It Sticky Note */
  T["paper-postit"] = {
    name: "Post-It Note", cat: "paper", dark: true, accent: "#facc15",
    desc: "Bright yellow 3M Post-It sticky note with 3D peel shadow, red pushpin, and Sharpie marker reminder typography",
    css: '.sc-post-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:6cqw;background:radial-gradient(circle at center,#1e1c14 0%,#0a0907 100%);overflow:hidden;box-shadow:inset 0 0 16cqw rgba(0,0,0,.95);font-family:Impact,Montserrat,sans-serif}.sc-post-card{position:relative;width:76cqw;height:76cqw;background:linear-gradient(135deg,#fef08a 0%,#fde047 100%);color:#713f12;padding:8cqw 7cqw;box-shadow:0 4cqw 14cqw rgba(0,0,0,.85),0 1cqw 3cqw rgba(0,0,0,.3);transform:rotate(3.5deg);display:flex;flex-direction:column;justify-content:space-between;animation:postFlutter var(--D) cubic-bezier(.16,1,.3,1) infinite}.sc-post-pin{position:absolute;top:-2cqw;left:50%;transform:translateX(-50%);width:5cqw;height:5cqw;border-radius:50%;background:radial-gradient(circle at 35% 35%,#ff6b6b,#dc2626);box-shadow:0 2cqw 4cqw rgba(0,0,0,.9);z-index:4}.sc-post-title{font-size:8cqw;font-weight:900;line-height:1.1;color:#713f12;margin:1cqh 0 0 0;text-transform:uppercase}.sc-post-body{font-family:Georgia,serif;font-size:5.2cqw;font-weight:800;color:#1c1917;line-height:1.3;margin:0}.sc-post-foot{font-family:ui-monospace,monospace;font-size:2.8cqw;letter-spacing:.2em;color:#854d0e;text-transform:uppercase}@keyframes postFlutter{0%,10%{transform:scale(.9) rotate(8deg);opacity:0}22%{transform:scale(1) rotate(3.5deg);opacity:1}45%{transform:scale(1.015) rotate(4.6deg);opacity:1}68%{transform:scale(.995) rotate(2.6deg);opacity:1}92%{transform:scale(1) rotate(3.5deg);opacity:1}100%{transform:scale(1) rotate(3.5deg);opacity:1}}',
    html: function (o) {
      var title = getP(o, "title", o.lines[0] || "REMEMBER:");
      var body = getP(o, "body", o.lines[1] || "Story > Equipment Every Single Time");
      var foot = getP(o, "foot", o.lines[2] || "📌 PINNED STRATEGY");
      return '<div class="sc-post-wrap">'
        + '<div class="sc-post-card">'
        + '<div class="sc-post-pin"></div>'
        + '<h2 class="sc-post-title">' + esc(title) + '</h2>'
        + '<p class="sc-post-body">' + esc(body) + '</p>'
        + '<div class="sc-post-foot">' + esc(foot) + '</div>'
        + '</div>'
        + '</div>';
    },
    reactCode: `function Scene(props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = props || {};
  const title = p.title || 'REMEMBER:';
  const body = p.body || 'Story > Equipment Every Single Time';
  const foot = p.foot || '📌 PINNED STRATEGY';

  const pop = spring({ frame, fps, config: { damping: 14, stiffness: 90 } });
  const rot = interpolate(pop, [0, 1], [8, 3.5]);
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      background: 'radial-gradient(circle at center, #1e1c14 0%, #0a0907 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '6%',
      overflow: 'hidden',
      boxShadow: 'inset 0 0 100px rgba(0,0,0,0.95)',
      fontFamily: 'Impact, Montserrat, sans-serif'
    }}>
      <div style={{
        position: 'relative',
        width: 260,
        height: 260,
        background: 'linear-gradient(135deg, #fef08a 0%, #fde047 100%)',
        color: '#713f12',
        padding: '28px 24px',
        boxShadow: '0 30px 80px rgba(0,0,0,0.85), 0 4px 12px rgba(0,0,0,0.3)',
        transform: "scale(" + pop + ") rotate(" + rot + "deg)",
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        opacity: opacity
      }}>
        <div style={{
          position: 'absolute',
          top: -10,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #ff6b6b, #dc2626)',
          boxShadow: '0 6px 14px rgba(0,0,0,0.9)',
          zIndex: 4
        }} />

        <h2 style={{
          fontSize: 28,
          fontWeight: 900,
          lineHeight: 1.1,
          color: '#713f12',
          margin: '8px 0 0 0',
          textTransform: 'uppercase'
        }}>
          {title}
        </h2>

        <p style={{
          fontFamily: 'Georgia, serif',
          fontSize: 18,
          fontWeight: 800,
          color: '#1c1917',
          lineHeight: 1.3,
          margin: 0
        }}>
          {body}
        </p>

        <div style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: 11,
          letterSpacing: '0.2em',
          color: '#854d0e',
          textTransform: 'uppercase'
        }}>
          {foot}
        </div>
      </div>
    </AbsoluteFill>
  );
}`
  };

  /* 2.6 Cardboard Stencil */
  T["paper-cardboard"] = {
    name: "Cardboard Stencil", cat: "paper", dark: true, accent: "#ffffff",
    desc: "Authentic corrugated brown kraft cardboard with industrial spray-painted white stencil typography, barcode, and cargo icons",
    css: '.sc-box-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:6cqw;background:#2b1911;overflow:hidden;box-shadow:inset 0 0 16cqw rgba(0,0,0,.95);font-family:Impact,monospace,sans-serif}.sc-box-card{position:relative;width:86cqw;background:#78350f;background-image:repeating-linear-gradient(90deg,transparent 0px,transparent 1.5cqw,rgba(0,0,0,.12) 1.5cqw,rgba(0,0,0,.12) 3cqw);border:2px solid #572608;border-radius:3cqw;padding:8cqw 6cqw;text-align:center;box-shadow:0 4cqw 14cqw rgba(0,0,0,.9);color:#fff;animation:boxZoom var(--D) cubic-bezier(.16,1,.3,1) infinite}.sc-box-tape{position:absolute;top:0;bottom:0;left:50%;width:8cqw;transform:translateX(-50%);background:rgba(217,119,6,.25);border-left:1px dashed rgba(255,255,255,.15);border-right:1px dashed rgba(255,255,255,.15);pointer-events:none}.sc-box-kicker{font-family:ui-monospace,monospace;font-size:3cqw;letter-spacing:.3em;color:#fde68a;margin-bottom:1.5cqh;text-transform:uppercase}.sc-box-title{font-size:12cqw;font-weight:900;letter-spacing:.15em;text-transform:uppercase;margin:0;line-height:1;border-top:3px dashed rgba(255,255,255,.4);border-bottom:3px dashed rgba(255,255,255,.4);padding:1.5cqh 0;text-shadow:0 0 10px rgba(255,255,255,.3)}.sc-box-sub{font-size:3.6cqw;color:#fcd34d;letter-spacing:.1em;margin-top:2cqh;font-weight:700}.sc-box-icons{font-size:6cqw;margin-top:1.5cqh;letter-spacing:.5em;opacity:.85}@keyframes boxZoom{0%,10%{transform:scale(.92);opacity:0}22%{transform:scale(1);opacity:1}45%{transform:scale(1.012);opacity:1}68%{transform:scale(.994);opacity:1}92%{transform:scale(1);opacity:1}100%{transform:scale(1);opacity:1}}',
    html: function (o) {
      var kicker = getP(o, "kicker", "HEAVY CARGO // PRIORITY");
      var title = getP(o, "title", o.lines[0] || "FRAGILE");
      var sub = getP(o, "sub", o.lines[1] || "Handle With Extreme Care");
      return '<div class="sc-box-wrap">'
        + '<div class="sc-box-card">'
        + '<div class="sc-box-tape"></div>'
        + '<div class="sc-box-kicker">' + esc(kicker) + '</div>'
        + '<h1 class="sc-box-title">' + esc(title) + '</h1>'
        + '<div class="sc-box-sub">' + esc(sub) + '</div>'
        + '<div class="sc-box-icons">☂ 🍸 ⬆⬆</div>'
        + '</div>'
        + '</div>';
    },
    reactCode: `function Scene(props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = props || {};
  const kicker = p.kicker || 'HEAVY CARGO // PRIORITY';
  const title = p.title || 'FRAGILE';
  const sub = p.sub || 'Handle With Extreme Care';

  const pop = spring({ frame, fps, config: { damping: 14, stiffness: 90 } });
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      backgroundColor: '#2b1911',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '6%',
      overflow: 'hidden',
      boxShadow: 'inset 0 0 100px rgba(0,0,0,0.95)',
      fontFamily: 'Impact, monospace, sans-serif'
    }}>
      <div style={{
        position: 'relative',
        width: '90%',
        backgroundColor: '#78350f',
        backgroundImage: 'repeating-linear-gradient(90deg, transparent 0px, transparent 8px, rgba(0,0,0,0.12) 8px, rgba(0,0,0,0.12) 16px)',
        border: '2px solid #572608',
        borderRadius: 16,
        padding: '36px 20px',
        textAlign: 'center',
        boxShadow: '0 30px 80px rgba(0,0,0,0.9)',
        color: '#ffffff',
        transform: "scale(" + pop + ")",
        opacity: opacity
      }}>
        <div style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: 12,
          letterSpacing: '0.3em',
          color: '#fde68a',
          marginBottom: 12,
          textTransform: 'uppercase'
        }}>
          {kicker}
        </div>

        <h1 style={{
          fontSize: 48,
          fontWeight: 900,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          margin: 0,
          lineHeight: 1,
          borderTop: '3px dashed rgba(255,255,255,0.4)',
          borderBottom: '3px dashed rgba(255,255,255,0.4)',
          padding: '12px 0',
          textShadow: '0 0 10px rgba(255,255,255,0.3)'
        }}>
          {title}
        </h1>

        <div style={{ fontSize: 14, color: '#fcd34d', letterSpacing: '0.1em', marginTop: 14, fontWeight: 700 }}>
          {sub}
        </div>

        <div style={{ fontSize: 24, marginTop: 12, letterSpacing: '0.5em', opacity: 0.85 }}>
          ☂ 🍸 ⬆⬆
        </div>
      </div>
    </AbsoluteFill>
  );
}`
  };

  /* 2.7 Binder Clip Card */
  T["paper-binder"] = {
    name: "Binder Clip Stack", cat: "paper", dark: true, accent: "#94a3b8",
    desc: "Archival index dossier clamped by 3D steel binder clip with metallic glint and structured strategic summary",
    css: '.sc-bnd-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:6cqw;background:radial-gradient(circle at center,#1e293b 0%,#0a0f1d 100%);overflow:hidden;box-shadow:inset 0 0 16cqw rgba(0,0,0,.95);font-family:-apple-system,BlinkMacSystemFont,sans-serif}.sc-bnd-card{position:relative;width:84cqw;background:#ffffff;color:#0f172a;padding:8cqw 6cqw 6cqw 6cqw;border-radius:2cqw;box-shadow:0 4cqw 14cqw rgba(0,0,0,.85);animation:bndSlide var(--D) cubic-bezier(.16,1,.3,1) infinite}.sc-bnd-clip{position:absolute;top:-3.5cqw;left:50%;transform:translateX(-50%);width:18cqw;height:7cqw;background:#334155;border-radius:1cqw;box-shadow:0 1cqw 3cqw #000;border:2px solid #64748b;z-index:5}.sc-bnd-wire{position:absolute;top:-2cqw;left:50%;transform:translateX(-50%);width:10cqw;height:4cqw;border:3px solid #cbd5e1;border-bottom:none;border-radius:2cqw 2cqw 0 0}.sc-bnd-tag{font-family:ui-monospace,monospace;font-size:2.8cqw;letter-spacing:.25em;color:#64748b;text-transform:uppercase;margin-bottom:1.5cqh}.sc-bnd-title{font-size:7.2cqw;font-weight:900;color:#0f172a;margin:0 0 1.5cqh 0;line-height:1.15}.sc-bnd-desc{font-size:3.8cqw;color:#475569;line-height:1.5;margin:0}@keyframes bndSlide{0%,10%{transform:translateY(-3cqh);opacity:0}22%{transform:translateY(0);opacity:1}45%{transform:translateY(-.4cqh);opacity:1}68%{transform:translateY(.25cqh);opacity:1}92%{transform:translateY(0);opacity:1}100%{transform:translateY(0);opacity:1}}',
    html: function (o) {
      var tag = getP(o, "tag", o.lines[0] || "INDEX ARCHIVE // #01");
      var title = getP(o, "title", o.lines[1] || "Viral Content Blueprint");
      var desc = getP(o, "desc", o.lines[2] || "Mastering the psychology of short-form retention.");
      return '<div class="sc-bnd-wrap">'
        + '<div class="sc-bnd-card">'
        + '<div class="sc-bnd-clip"><div class="sc-bnd-wire"></div></div>'
        + '<div class="sc-bnd-tag">' + esc(tag) + '</div>'
        + '<h2 class="sc-bnd-title">' + esc(title) + '</h2>'
        + '<p class="sc-bnd-desc">' + esc(desc) + '</p>'
        + '</div>'
        + '</div>';
    },
    reactCode: `function Scene(props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = props || {};
  const tag = p.tag || 'INDEX ARCHIVE // #01';
  const title = p.title || 'Viral Content Blueprint';
  const desc = p.desc || 'Mastering the psychology of short-form retention.';

  const slide = spring({ frame, fps, config: { damping: 14, stiffness: 90 } });
  const y = (1 - slide) * -50;
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      background: 'radial-gradient(circle at center, #1e293b 0%, #0a0f1d 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '6%',
      overflow: 'hidden',
      boxShadow: 'inset 0 0 100px rgba(0,0,0,0.95)',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      <div style={{
        position: 'relative',
        width: '86%',
        backgroundColor: '#ffffff',
        color: '#0f172a',
        padding: '40px 26px 30px 26px',
        borderRadius: 12,
        boxShadow: '0 30px 80px rgba(0,0,0,0.85)',
        transform: "translateY(" + y + "px)",
        opacity: opacity
      }}>
        <div style={{
          position: 'absolute',
          top: -14,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 60,
          height: 24,
          backgroundColor: '#334155',
          borderRadius: 4,
          boxShadow: '0 4px 10px rgba(0,0,0,0.6)',
          border: '2px solid #64748b',
          zIndex: 5
        }}>
          <div style={{
            position: 'absolute',
            top: -10,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 34,
            height: 14,
            border: '3px solid #cbd5e1',
            borderBottom: 'none',
            borderRadius: '6px 6px 0 0'
          }} />
        </div>

        <div style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: 12,
          letterSpacing: '0.25em',
          color: '#64748b',
          textTransform: 'uppercase',
          marginBottom: 10
        }}>
          {tag}
        </div>

        <h2 style={{
          fontSize: 26,
          fontWeight: 900,
          color: '#0f172a',
          margin: '0 0 12px 0',
          lineHeight: 1.2
        }}>
          {title}
        </h2>

        <p style={{
          fontSize: 14,
          color: '#475569',
          lineHeight: 1.5,
          margin: 0
        }}>
          {desc}
        </p>
      </div>
    </AbsoluteFill>
  );
}`
  };

  /* 2.8 Perforated Receipt Tear */
  T["paper-receipt"] = {
    name: "Receipt Zigzag Tear", cat: "paper", dark: true, accent: "#000000",
    desc: "Authentic thermal POS supermarket register receipt with zigzag serrated torn edge and itemized metrics breakdown",
    css: '.sc-rec-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:6cqw;background:radial-gradient(circle at center,#18181b 0%,#09090b 100%);overflow:hidden;box-shadow:inset 0 0 16cqw rgba(0,0,0,.95);font-family:ui-monospace,monospace}.sc-rec-slip{position:relative;width:82cqw;background:#ffffff;color:#000000;padding:6cqw 6cqw 8cqw 6cqw;border-radius:2px;box-shadow:0 4cqw 14cqw rgba(0,0,0,.85);clip-path:polygon(0 0, 100% 0, 100% 94%, 95% 97%, 90% 94%, 85% 97%, 80% 94%, 75% 97%, 70% 94%, 65% 97%, 60% 94%, 55% 97%, 50% 94%, 45% 97%, 40% 94%, 35% 97%, 30% 94%, 25% 97%, 20% 94%, 15% 97%, 10% 94%, 5% 97%, 0 94%);animation:recRoll var(--D) cubic-bezier(.16,1,.3,1) infinite}.sc-rec-store{font-size:3cqw;letter-spacing:.2em;text-align:center;font-weight:700;margin-bottom:.5cqh}.sc-rec-head{font-size:5.8cqw;font-weight:900;text-align:center;border-bottom:1px dashed #71717a;padding-bottom:1.5cqh;margin:0 0 2cqh 0}.sc-rec-row{display:flex;justify-content:space-between;font-size:3.6cqw;margin-bottom:1.2cqh;font-weight:600}.sc-rec-tot{display:flex;justify-content:space-between;font-size:4.5cqw;font-weight:900;border-top:2px solid #000;padding-top:1.5cqh;margin-top:2cqh}.sc-rec-bar{text-align:center;font-size:3cqw;letter-spacing:.4em;margin-top:2cqh;color:#71717a}@keyframes recRoll{0%,10%{transform:translateY(-5cqh);opacity:0}22%{transform:translateY(0);opacity:1}45%{transform:translateY(-.4cqh);opacity:1}68%{transform:translateY(.3cqh);opacity:1}92%{transform:translateY(0);opacity:1}100%{transform:translateY(0);opacity:1}}',
    html: function (o) {
      var store = getP(o, "store", "SHORTSCRAFT POS // 9021");
      var title = getP(o, "title", o.lines[0] || "RECEIPT #2026");
      var v1 = getP(o, "v1", "1,420,000");
      var v2 = getP(o, "v2", "84.2%");
      var total = getP(o, "total", "100% IMPACT");
      return '<div class="sc-rec-wrap">'
        + '<div class="sc-rec-slip">'
        + '<div class="sc-rec-store">' + esc(store) + '</div>'
        + '<h3 class="sc-rec-head">' + esc(title) + '</h3>'
        + '<div class="sc-rec-row"><span>Views Generated:</span> <b>' + esc(v1) + '</b></div>'
        + '<div class="sc-rec-row"><span>Retention Rate:</span> <b>' + esc(v2) + '</b></div>'
        + '<div class="sc-rec-tot"><span>TOTAL SCORE:</span> <b>' + esc(total) + '</b></div>'
        + '<div class="sc-rec-bar">||||| ||| |||| || |||</div>'
        + '</div>'
        + '</div>';
    },
    reactCode: `function Scene(props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = props || {};
  const store = p.store || 'SHORTSCRAFT POS // 9021';
  const title = p.title || 'RECEIPT #2026';
  const v1 = p.v1 || '1,420,000';
  const v2 = p.v2 || '84.2%';
  const total = p.total || '100% IMPACT';

  const roll = spring({ frame, fps, config: { damping: 14, stiffness: 90 } });
  const y = (1 - roll) * -60;
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      background: 'radial-gradient(circle at center, #18181b 0%, #09090b 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '6%',
      overflow: 'hidden',
      boxShadow: 'inset 0 0 100px rgba(0,0,0,0.95)',
      fontFamily: 'ui-monospace, monospace'
    }}>
      <div style={{
        position: 'relative',
        width: '84%',
        backgroundColor: '#ffffff',
        color: '#000000',
        padding: '24px 20px 32px 20px',
        borderRadius: 2,
        boxShadow: '0 30px 80px rgba(0,0,0,0.85)',
        clipPath: 'polygon(0 0, 100% 0, 100% 94%, 95% 97%, 90% 94%, 85% 97%, 80% 94%, 75% 97%, 70% 94%, 65% 97%, 60% 94%, 55% 97%, 50% 94%, 45% 97%, 40% 94%, 35% 97%, 30% 94%, 25% 97%, 20% 94%, 15% 97%, 10% 94%, 5% 97%, 0 94%)',
        transform: "translateY(" + y + "px)",
        opacity: opacity
      }}>
        <div style={{ fontSize: 11, letterSpacing: '0.2em', textAlign: 'center', fontWeight: 700, marginBottom: 4 }}>
          {store}
        </div>
        <h3 style={{
          fontSize: 22,
          fontWeight: 900,
          textAlign: 'center',
          borderBottom: '1px dashed #71717a',
          paddingBottom: 10,
          margin: '0 0 14px 0'
        }}>
          {title}
        </h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, fontWeight: 600 }}>
          <span>Views Generated:</span>
          <b>{v1}</b>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, fontWeight: 600 }}>
          <span>Retention Rate:</span>
          <b>{v2}</b>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 15,
          fontWeight: 900,
          borderTop: '2px solid #000',
          paddingTop: 10,
          marginTop: 14
        }}>
          <span>TOTAL SCORE:</span>
          <b>{total}</b>
        </div>
        <div style={{ textAlign: 'center', fontSize: 12, letterSpacing: '0.4em', marginTop: 14, color: '#71717a' }}>
          ||||| ||| |||| || |||
        </div>
      </div>
    </AbsoluteFill>
  );
}`
  };

  /* 2.9 Double Polaroid Tape */
  T["paper-double-pol"] = {
    name: "Washi Tape Polaroids", cat: "paper", dark: true, accent: "#eab308",
    desc: "Overlapping instant photos taped together with textured washi tape and handwritten production diary caption",
    css: '.sc-dpol-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:6cqw;background:radial-gradient(circle at center,#1e1e24 0%,#09090b 100%);overflow:hidden;box-shadow:inset 0 0 16cqw rgba(0,0,0,.95);font-family:Georgia,serif}.sc-dpol-stack{position:relative;width:82cqw;height:56cqw}.sc-dp1{position:absolute;left:0;top:0;width:48cqw;background:#ffffff;padding:2.5cqw 2.5cqw 5cqw;transform:rotate(-8deg);box-shadow:0 3cqw 10cqw rgba(0,0,0,.8);border-radius:1cqw;animation:polDrop1 var(--D) cubic-bezier(.16,1,.3,1) infinite}.sc-dp2{position:absolute;right:0;bottom:0;width:48cqw;background:#ffffff;padding:2.5cqw 2.5cqw 5cqw;transform:rotate(7deg);box-shadow:0 3cqw 10cqw rgba(0,0,0,.8);border-radius:1cqw;animation:polDrop2 var(--D) cubic-bezier(.16,1,.3,1) infinite;animation-delay:.1s}.sc-dp-img{width:100%;height:30cqw;border-radius:1cqw;overflow:hidden;background:#18181b}.sc-dp-img img{width:100%;height:100%;object-fit:cover}.sc-dp-washi{position:absolute;top:-2.5cqw;left:34%;width:34%;height:5cqw;background:rgba(234,179,8,.75);backdrop-filter:blur(2px);box-shadow:0 1px 4px rgba(0,0,0,.3);transform:rotate(10deg);z-index:4}.sc-dpol-cap{font-size:5.8cqw;font-weight:900;color:#ffffff;margin-top:4cqh;text-align:center;letter-spacing:.05em}@keyframes polDrop1{0%,10%{transform:scale(.85) rotate(-14deg);opacity:0}22%{transform:scale(1) rotate(-8deg);opacity:1}45%{transform:scale(1.015) rotate(-6.8deg);opacity:1}68%{transform:scale(.995) rotate(-9deg);opacity:1}92%{transform:scale(1) rotate(-8deg);opacity:1}100%{transform:scale(1) rotate(-8deg);opacity:1}}@keyframes polDrop2{0%,10%{transform:scale(.85) rotate(14deg);opacity:0}22%{transform:scale(1) rotate(7deg);opacity:1}45%{transform:scale(1.015) rotate(5.9deg);opacity:1}68%{transform:scale(.995) rotate(8.1deg);opacity:1}92%{transform:scale(1) rotate(7deg);opacity:1}100%{transform:scale(1) rotate(7deg);opacity:1}}',
    html: function (o) {
      var caption = getP(o, "caption", o.lines[0] || "Production Diary");
      return '<div class="sc-dpol-wrap">'
        + '<div class="sc-dpol-stack">'
        + '<div class="sc-dp-washi"></div>'
        + '<div class="sc-dp1"><div class="sc-dp-img"><img src="/assets/archival_suspect.jpg" alt="Shot 1" /></div></div>'
        + '<div class="sc-dp2"><div class="sc-dp-img"><img src="/assets/statue_bust.jpg" alt="Shot 2" /></div></div>'
        + '</div>'
        + '<div class="sc-dpol-cap">' + esc(caption) + '</div>'
        + '</div>';
    },
    reactCode: `function Scene(props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = props || {};
  const caption = p.caption || 'Production Diary';

  const pop1 = spring({ frame, fps, config: { damping: 14, stiffness: 90 } });
  const pop2 = spring({ frame: Math.max(0, frame - 6), fps, config: { damping: 14, stiffness: 90 } });
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      background: 'radial-gradient(circle at center, #1e1e24 0%, #09090b 100%)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '6%',
      overflow: 'hidden',
      boxShadow: 'inset 0 0 100px rgba(0,0,0,0.95)',
      fontFamily: 'Georgia, serif'
    }}>
      <div style={{ position: 'relative', width: 280, height: 210 }}>
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 155,
          backgroundColor: '#ffffff',
          padding: '8px 8px 16px 8px',
          transform: "scale(" + pop1 + ") rotate(-8deg)",
          boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
          borderRadius: 4,
          opacity: opacity
        }}>
          <div style={{ width: '100%', height: 110, borderRadius: 2, overflow: 'hidden', backgroundColor: '#18181b' }}>
            <img src="/assets/archival_suspect.jpg" alt="Shot 1" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        </div>

        <div style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: 155,
          backgroundColor: '#ffffff',
          padding: '8px 8px 16px 8px',
          transform: "scale(" + pop2 + ") rotate(7deg)",
          boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
          borderRadius: 4,
          opacity: opacity
        }}>
          <div style={{ width: '100%', height: 110, borderRadius: 2, overflow: 'hidden', backgroundColor: '#18181b' }}>
            <img src="/assets/statue_bust.jpg" alt="Shot 2" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        </div>

        <div style={{
          position: 'absolute',
          top: -10,
          left: '34%',
          width: 80,
          height: 20,
          backgroundColor: 'rgba(234,179,8,0.75)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          transform: 'rotate(10deg)',
          zIndex: 4
        }} />
      </div>

      <div style={{
        fontSize: 22,
        fontWeight: 900,
        color: '#ffffff',
        marginTop: 24,
        textAlign: 'center',
        letterSpacing: '0.05em',
        opacity: opacity
      }}>
        {caption}
      </div>
    </AbsoluteFill>
  );
}`
  };

  /* 2.10 Scrapbook Collage */
  T["paper-collage"] = {
    name: "Cutout Scrapbook", cat: "paper", dark: true, accent: "#f59e0b",
    desc: "Multi-layered stop-motion scrapbook collage where each letter of the hook keyword is on an individual rotated cutout slip",
    css: '.sc-col-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:6cqw;background:radial-gradient(circle at center,#1c1917 0%,#09090b 100%);overflow:hidden;box-shadow:inset 0 0 16cqw rgba(0,0,0,.95);font-family:Impact,sans-serif}.sc-col-row{display:flex;flex-wrap:wrap;justify-content:center;gap:.2em;margin-bottom:2cqh;max-width:100%}.sc-col-tile{background:#ffffff;color:#000000;padding:.2em .38em;font-size:10cqw;font-weight:900;transform:rotate(-4deg);box-shadow:0 2cqw 6cqw rgba(0,0,0,.8);border-radius:1cqw}.sc-col-t1{background:#ef4444;color:#fff;transform:rotate(-6deg);animation:tilePop var(--D) cubic-bezier(.175,.885,.32,1.275) infinite}.sc-col-t2{background:#f59e0b;color:#000;transform:rotate(5deg);animation:tilePop var(--D) cubic-bezier(.175,.885,.32,1.275) infinite;animation-delay:.05s}.sc-col-t3{background:#3b82f6;color:#fff;transform:rotate(-4deg);animation:tilePop var(--D) cubic-bezier(.175,.885,.32,1.275) infinite;animation-delay:.1s}.sc-col-t4{background:#22c55e;color:#000;transform:rotate(6deg);animation:tilePop var(--D) cubic-bezier(.175,.885,.32,1.275) infinite;animation-delay:.15s}.sc-col-t5{background:#a855f7;color:#fff;transform:rotate(-5deg);animation:tilePop var(--D) cubic-bezier(.175,.885,.32,1.275) infinite;animation-delay:.2s}.sc-col-sub{font-family:ui-monospace,monospace;font-size:3.6cqw;letter-spacing:.25em;color:#fcd34d;font-weight:800;margin-top:2cqh;text-transform:uppercase}@keyframes tilePop{0%,10%{transform:scale(.7);opacity:0}22%{transform:scale(1);opacity:1}45%{transform:scale(1.015);opacity:1}68%{transform:scale(.992);opacity:1}92%{transform:scale(1);opacity:1}100%{transform:scale(1);opacity:1}}',
    html: function (o) {
      var word = getP(o, "word", o.lines[0] || "VIRAL");
      var sub = getP(o, "sub", o.lines[1] || "STOP-MOTION FORMULA");
      /* One tile per letter, so the row's width is driven entirely by how long
         the word is. At the fixed 10cqw the tiles ran off both edges as soon as
         the word passed five characters. 55 is the usable row width divided by
         a tile's own width in font-size units (glyph + padding + gap). */
      var chars = word.split("");
      var fs = Math.min(10, 55 / Math.max(chars.length, 1));
      var tilesHtml = chars.map(function (c, i) {
        var cls = "sc-col-t" + ((i % 5) + 1);
        return '<span class="sc-col-tile ' + cls + '" style="font-size:' + fs.toFixed(2) + 'cqw">' + esc(c) + '</span>';
      }).join("");
      return '<div class="sc-col-wrap">'
        + '<div class="sc-col-row">' + tilesHtml + '</div>'
        + '<div class="sc-col-sub">' + esc(sub) + '</div>'
        + '</div>';
    },
    reactCode: `function Scene(props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = props || {};
  const word = p.word || 'VIRAL';
  const sub = p.sub || 'STOP-MOTION FORMULA';
  const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#22c55e', '#a855f7'];
  const rots = [-6, 5, -4, 6, -5];

  const chars = word.split('');
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      background: 'radial-gradient(circle at center, #1c1917 0%, #09090b 100%)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '6%',
      overflow: 'hidden',
      boxShadow: 'inset 0 0 100px rgba(0,0,0,0.95)',
      fontFamily: 'Impact, sans-serif'
    }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, opacity: opacity }}>
        {chars.map((c, i) => {
          const pop = spring({ frame: Math.max(0, frame - i * 3), fps, config: { damping: 12, stiffness: 120 } });
          const bg = colors[i % colors.length];
          const rot = rots[i % rots.length];
          return (
            <span
              key={i}
              style={{
                backgroundColor: bg,
                color: (i % 2 === 0) ? '#ffffff' : '#000000',
                padding: '8px 14px',
                fontSize: 38,
                fontWeight: 900,
                transform: "scale(" + pop + ") rotate(" + rot + "deg)",
                boxShadow: '0 10px 25px rgba(0,0,0,0.8)',
                borderRadius: 4,
                display: 'inline-block'
              }}
            >
              {c}
            </span>
          );
        })}
      </div>

      <div style={{
        fontFamily: 'ui-monospace, monospace',
        fontSize: 13,
        letterSpacing: '0.25em',
        color: '#fcd34d',
        fontWeight: 800,
        marginTop: 8,
        textTransform: 'uppercase',
        opacity: opacity
      }}>
        {sub}
      </div>
    </AbsoluteFill>
  );
}`
  };

  /* 2.11 Minimalist Executive Motion (AI Deconstructed from user video) */
  T["paper-executive-noir"] = {
    name: "Minimalist Executive Motion", cat: "paper", dark: false, accent: "#141414",
    desc: "Clean studio paper canvas with floating liquid shadow blobs, stylized silhouette executive mascot, and kinetic impact typography",
    css: '.sc-exec-wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:8cqh 6cqw 6cqh;background:#f5f5f3;background-image:radial-gradient(circle at 50% 50%,rgba(0,0,0,.15) 1.5px,transparent 1.5px);background-size:24px 24px;overflow:hidden;font-family:"Space Grotesk",sans-serif;color:#141414}'
      + '.sc-exec-blob-tl{position:absolute;top:-12cqh;left:-10cqw;width:48cqw;height:38cqh;background:#0d0d11;border-radius:40% 60% 70% 30% / 40% 50% 60% 50%;filter:drop-shadow(0 20px 35px rgba(0,0,0,.45));animation:execBlobFloat 6s ease-in-out infinite alternate}'
      + '.sc-exec-blob-br{position:absolute;bottom:-12cqh;right:-10cqw;width:48cqw;height:38cqh;background:#0d0d11;border-radius:60% 40% 30% 70% / 50% 60% 40% 50%;filter:drop-shadow(0 -20px 35px rgba(0,0,0,.45));animation:execBlobFloat 7s ease-in-out infinite alternate-reverse}'
      + '.sc-exec-hook{position:relative;z-index:2;font-size:7.5cqw;font-weight:600;color:#2a2a2e;text-align:center;line-height:1.2;animation:execSnapIn var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-exec-mascot-box{position:relative;z-index:2;flex:1;display:flex;align-items:center;justify-content:center;width:100%;animation:execIdleSway 5s ease-in-out infinite alternate}'
      + '.sc-exec-mascot-svg{width:68cqw;height:42cqh;filter:drop-shadow(0 14px 25px rgba(0,0,0,.18))}'
      + '.sc-exec-bottom{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;gap:1.5cqh;text-align:center;width:100%}'
      + '.sc-exec-punch{font-family:Inter,sans-serif;font-size:10.5cqw;font-weight:900;color:#0e0e12;letter-spacing:-.03em;line-height:1.05;text-transform:lowercase;animation:execSnapIn var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-exec-watermark{font-size:3.6cqw;font-weight:700;letter-spacing:.08em;color:#a8a7a2;opacity:.85}'
      + '@keyframes execSnapIn{0%,10%{transform:scale(0.88) translateY(2cqh);opacity:0}22%,92%{transform:scale(1) translateY(0);opacity:1}100%{transform:scale(1) translateY(0);opacity:1}}'
      + '@keyframes execIdleSway{0%{transform:rotate(-1deg) translateY(0)}100%{transform:rotate(1deg) translateY(-1cqh)}}'
      + '@keyframes execBlobFloat{0%{transform:translate(0,0) rotate(0deg)}100%{transform:translate(2cqw,-1.5cqh) rotate(8deg)}}',
    html: function (o) {
      var hook = getP(o, "hook", o.lines[0] || "Selling isn't about");
      var punch = getP(o, "punch", o.lines[1] || "how much you say");
      var mark = getP(o, "mark", o.lines[2] || "insiderforce.io");
      return '<div class="sc-exec-wrap">'
        + '<div class="sc-exec-blob-tl"></div>'
        + '<div class="sc-exec-blob-br"></div>'
        + '<div class="sc-exec-hook">' + esc(hook) + '</div>'
        + '<div class="sc-exec-mascot-box">'
        + '<svg class="sc-exec-mascot-svg" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">'
        + '<circle cx="200" cy="200" r="140" fill="rgba(0,0,0,0.03)" stroke="rgba(0,0,0,0.08)" stroke-dasharray="4 4" />'
        + '<!-- Metaphor Arms & Devices -->'
        + '<path d="M140 180 Q100 140 80 160" stroke="#141414" stroke-width="12" stroke-linecap="round" fill="none"/>'
        + '<rect x="60" y="145" width="30" height="20" rx="3" fill="#2a2e38"/>'
        + '<path d="M260 180 Q300 140 320 160" stroke="#141414" stroke-width="12" stroke-linecap="round" fill="none"/>'
        + '<rect x="310" y="145" width="22" height="34" rx="4" fill="#2a2e38"/>'
        + '<path d="M160 150 Q130 90 150 70" stroke="#141414" stroke-width="10" stroke-linecap="round" fill="none"/>'
        + '<circle cx="150" cy="65" r="14" fill="#facc15"/>'
        + '<path d="M240 150 Q270 90 250 70" stroke="#141414" stroke-width="10" stroke-linecap="round" fill="none"/>'
        + '<path d="M245 75 L255 60 L265 75 Z" fill="#2a2e38"/>'
        + '<!-- Executive Body Silhouette -->'
        + '<path d="M160 210 L140 330 L175 330 L185 240 L200 270 L215 240 L225 330 L260 330 L240 210 Z" fill="#0d0d11"/>'
        + '<path d="M160 210 L200 190 L240 210 L225 290 L175 290 Z" fill="#1b1c24"/>'
        + '<path d="M190 190 L200 235 L210 190 Z" fill="#ffffff"/>'
        + '<polygon points="196,200 204,200 202,232 198,232" fill="#d97706"/>'
        + '<!-- Head Silhouette with faceted shading -->'
        + '<path d="M185 140 L200 110 L218 135 L210 175 L188 175 Z" fill="#0d0d11"/>'
        + '<path d="M185 140 L200 110 L204 175 L188 175 Z" fill="#22242f"/>'
        + '</svg>'
        + '</div>'
        + '<div class="sc-exec-bottom">'
        + '<div class="sc-exec-punch">' + esc(punch) + '</div>'
        + '<div class="sc-exec-watermark">' + esc(mark) + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* ============================================================
     CATEGORY 3: KINETIC TEXT & HOOKS (10 templates)
     ============================================================ */

  /* 3.1 Highlight Box */
  T["text-highlight-box"] = {
    name: "Marker Highlight Box", cat: "text", dark: true, accent: "#facc15",
    desc: "Fluorescent yellow highlighter marker box framing critical keywords",
    css: '.tx-box{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:8cqw;text-align:center}.tx-box .kicker{font-size:3.4cqw;letter-spacing:.25em;text-transform:uppercase;color:var(--dim);margin-bottom:2cqh}.tx-box h2{font-size:11cqw;font-weight:900;letter-spacing:-.04em;line-height:1.2;color:#fff}.tx-box .hl{position:relative;display:inline-block;padding:0 .2em;color:#000;z-index:2}.tx-box .hl::before{content:"";position:absolute;inset:0;background:var(--ac);z-index:-1;transform:skew(-6deg) scale(1.08);border-radius:2px;animation:txHl var(--D) var(--sp) infinite}@keyframes txHl{0%,18%{transform:scaleX(0)}32%,85%{transform:scaleX(1)}100%{transform:scaleX(0)}}',
    html: function (o) {
      return '<div class="tx-box"><div class="kicker">' + esc(o.lines[0] || "THE SECRET FORMULA") + '</div><h2>Stop wasting time on <span class="hl">' + esc(o.lines[1] || "complex editing") + '</span></h2></div>';
    }
  };

  /* 3.2 Hand-Drawn Scribble Underline */
  T["text-scribble"] = {
    name: "Scribble Arrow Hook", cat: "text", dark: true, accent: "#ff0055",
    desc: "Vector hand-drawn squiggle scribble underlining the hook word",
    css: '.tx-scb{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:8cqw;text-align:center}.tx-scb h2{font-size:12cqw;font-weight:900;color:#fff;line-height:1.1}.tx-scb svg{width:60cqw;height:6cqw;stroke:var(--ac);stroke-width:5;fill:none;stroke-linecap:round;stroke-dasharray:300;stroke-dashoffset:300;animation:txScb var(--D) var(--sp) infinite}@keyframes txScb{0%,18%{stroke-dashoffset:300}35%,85%{stroke-dashoffset:0}100%{stroke-dashoffset:300}}',
    html: function (o) {
      return '<div class="tx-scb"><div style="font-size:4cqw;color:var(--dim);margin-bottom:1.5cqh">' + esc(o.lines[0] || "DON'T MISS THIS") + '</div><h2>' + esc(o.lines[1] || "10X RETENTION") + '</h2><svg viewBox="0 0 200 20"><path d="M5,15 Q50,0 100,12 T195,10"/></svg></div>';
    }
  };

  /* 3.3 Word Punch Scale */
  T["text-word-punch"] = {
    name: "Word Punch Scale", cat: "text", dark: true, accent: "#38bdf8",
    desc: "High-impact scale punch kinetic typography with rebound shake",
    css: '.tx-pch{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:8cqw;text-align:center}.tx-pch .punch{font-size:11cqw;font-weight:900;letter-spacing:-.03em;color:#fff;text-transform:uppercase;width:100%;max-width:100%;word-break:break-word;line-height:1.05;animation:txPunch var(--D) cubic-bezier(.12,.9,.15,1) infinite}@keyframes txPunch{0%,15%{transform:scale(3);opacity:0;filter:blur(2cqw)}25%{transform:scale(0.9);opacity:1;filter:blur(0)}32%,85%{transform:scale(1);opacity:1}100%{transform:scale(0.8);opacity:0}}',
    html: function (o) {
      return '<div class="tx-pch"><div style="font-size:3.4cqw;letter-spacing:.2em;color:var(--ac);margin-bottom:2cqh">' + esc(o.lines[0] || "HOOK OF THE DAY") + '</div><div class="punch">' + esc(o.lines[1] || "UNSTOPPABLE") + '</div><div style="font-size:4cqw;color:var(--dim);margin-top:2cqh">' + esc(o.lines[2] || "Build your momentum") + '</div></div>';
    }
  };

  /* 3.4 Subtitle Badge Pill */
  T["text-subtitle-pill"] = {
    name: "Subtitles Pill Badge", cat: "text", dark: true, accent: "#22c55e",
    desc: "TikTok / Reels magnetic black pill badge with synchronized word highlight",
    css: '.tx-pill{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:8cqw}.tx-pill .badge{background:rgba(0,0,0,.85);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.2);padding:3cqw 6cqw;border-radius:99px;font-size:5.4cqw;font-weight:800;color:#fff;box-shadow:0 2cqw 6cqw rgba(0,0,0,.6);opacity:0;transform:scale(.85);animation:pillPop var(--D) var(--sp) infinite}.tx-pill .active{color:var(--ac);text-shadow:0 0 1.5cqw var(--ac);display:inline-block;animation:activeGlow calc(var(--D) / 3) ease-in-out infinite alternate}@keyframes pillPop{0%,8%{transform:scale(.85);opacity:0}24%,100%{transform:scale(1);opacity:1}}@keyframes activeGlow{0%{text-shadow:0 0 1cqw var(--ac);transform:scale(1)}100%{text-shadow:0 0 3cqw var(--ac);transform:scale(1.06)}}',
    html: function (o) {
      return '<div class="tx-pill"><div class="badge">Create <span class="active">' + esc(o.lines[0] || "insane videos") + '</span> in seconds</div></div>';
    }
  };

  /* 3.5 Type Cascade */
  T["text-cascade"] = {
    name: "Type Cascade Up", cat: "text", dark: true, accent: "#ffffff",
    desc: "Words rise and unblur in sequence over a hairline rule",
    css: '.tc{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;gap:2.2cqh;padding:0 9cqw}.tc .ln{display:flex;flex-wrap:wrap;gap:0 1.6cqw}.tc .w{display:inline-block;font-weight:800;letter-spacing:-.045em;line-height:.98;opacity:0;animation:tcW var(--D) var(--sp) infinite}.tc .l1 .w{font-size:6.4cqw;color:var(--dim);font-weight:600}.tc .l2 .w{font-size:13.5cqw}.tc .l3 .w{font-size:8.2cqw;color:var(--ac)}@keyframes tcW{0%{opacity:0;transform:translateY(2.6cqh);filter:blur(.9cqw)}18%,82%{opacity:1;transform:translateY(0);filter:blur(0)}100%{opacity:0;transform:translateY(-1.4cqh);filter:blur(.6cqw)}}',
    html: function (o) {
      return '<div class="tc"><div class="ln l1"><span class="w">' + esc(o.lines[0] || "The truth about") + '</span></div><div class="ln l2"><span class="w">' + esc(o.lines[1] || "Consistency") + '</span></div><div class="ln l3"><span class="w">' + esc(o.lines[2] || "beats motivation") + '</span></div></div>';
    }
  };

  /* 3.6 Terminal Typing */
  T["text-terminal"] = {
    name: "Terminal Typing", cat: "text", dark: true, accent: "#38bdf8",
    desc: "MacOS terminal window with typing command effect using spring scale and glowing output",
    css: '.sc-term-wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6cqw;background:#0a0d14;font-family:ui-monospace,monospace;overflow:hidden}.sc-term-win{width:92%;max-width:720px;background:#111827;border-radius:3cqw;border:1px solid rgba(255,255,255,.12);box-shadow:0 3cqw 8cqw rgba(0,0,0,.8),0 0 5cqw rgba(56,189,248,.15);overflow:hidden;animation:termPop var(--D) cubic-bezier(.16,1,.3,1) infinite}.sc-term-head{height:5.5cqh;background:#1e293b;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;padding:0 3cqw;gap:1.5cqw;position:relative}.sc-dot{width:2.2cqw;height:2.2cqw;border-radius:50%}.sc-d-r{background:#ef4444}.sc-d-y{background:#f59e0b}.sc-d-g{background:#22c55e}.sc-term-title{position:absolute;inset:0;display:grid;place-items:center;font-size:2.8cqw;color:rgba(255,255,255,.5);letter-spacing:.05em}.sc-term-body{padding:4cqw;font-size:3.6cqw;line-height:1.6;color:#f8fafc}.sc-term-prompt{display:flex;align-items:center;gap:1.5cqw;flex-wrap:wrap}.sc-term-cur{display:inline-block;width:1.8cqw;height:3.6cqw;background:#38bdf8;animation:ttBlink .8s infinite}.sc-term-out{margin-top:2cqh;padding:2cqw 3cqw;background:rgba(34,197,94,.1);border-left:3px solid #22c55e;border-radius:1cqw;color:#4ade80;font-weight:700;animation:outFade var(--D) infinite}@keyframes termPop{0%,15%{transform:scale(.7);opacity:0}25%,85%{transform:scale(1);opacity:1}100%{transform:scale(1.05);opacity:0}}@keyframes ttBlink{0%,49%{opacity:1}50%,100%{opacity:0}}@keyframes outFade{0%,45%{opacity:0;transform:translateY(1cqh)}55%,85%{opacity:1;transform:translateY(0)}100%{opacity:0}}',
    html: function (o) {
      var title = getP(o, "title", "zsh — 80x24");
      var cmd = getP(o, "cmd", o.lines[0] || "npm install @shortscraft/motion");
      var output = getP(o, "output", o.lines[1] || "✔ 80+ Motion Graphic Templates Loaded");
      return '<div class="sc-term-wrap">'
        + '<div class="sc-term-win">'
        + '<div class="sc-term-head">'
        + '<div class="sc-dot sc-d-r"></div><div class="sc-dot sc-d-y"></div><div class="sc-dot sc-d-g"></div>'
        + '<div class="sc-term-title">' + esc(title) + '</div>'
        + '</div>'
        + '<div class="sc-term-body">'
        + '<div class="sc-term-prompt"><span style="color:#22c55e;font-weight:bold">➜</span> <span style="color:#38bdf8">~</span> <span>' + esc(cmd) + '</span><span class="sc-term-cur"></span></div>'
        + '<div class="sc-term-out">' + esc(output) + '</div>'
        + '</div>'
        + '</div>'
        + '</div>';
    },
    reactCode: `function Scene(props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const title = (props && props.title) || "zsh — 80x24";
  const cmd = (props && props.cmd) || "npm install @shortscraft/motion";
  const output = (props && props.output) || "✔ 80+ Motion Graphic Templates Loaded";

  const windowScale = spring({ frame, fps, config: { damping: 12, stiffness: 100, mass: 0.8 } });
  const textChars = Math.min(cmd.length, Math.floor(interpolate(frame, [10, 45], [0, cmd.length], { extrapolateRight: 'clamp' })));
  const visibleCmd = cmd.substring(0, textChars);
  const showOutput = frame >= 50;
  const outputOpacity = interpolate(frame, [50, 65], [0, 1], { extrapolateRight: 'clamp' });
  const cursorBlink = Math.floor(frame / 12) % 2 === 0;

  return (
    <AbsoluteFill style={{
      backgroundColor: '#0a0d14',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '5%',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
    }}>
      <div style={{
        width: '92%',
        maxWidth: 720,
        backgroundColor: '#111827',
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 25px 60px -15px rgba(0,0,0,0.8), 0 0 40px rgba(59,130,246,0.15)',
        transform: "scale(" + windowScale + ")",
        overflow: 'hidden'
      }}>
        <div style={{
          height: 44,
          backgroundColor: '#1e293b',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 8,
          position: 'relative'
        }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ef4444' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#f59e0b' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#22c55e' }} />
          <div style={{
            position: 'absolute',
            left: 0, right: 0,
            textAlign: 'center',
            fontSize: 13,
            color: 'rgba(255,255,255,0.5)',
            letterSpacing: '0.05em'
          }}>
            {title}
          </div>
        </div>

        <div style={{ padding: 24, minHeight: 200, fontSize: 16, lineHeight: 1.6, color: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: '#22c55e', fontWeight: 'bold' }}>➜</span>
            <span style={{ color: '#38bdf8' }}>~</span>
            <span>{visibleCmd}</span>
            {frame < 50 && cursorBlink && (
              <span style={{ display: 'inline-block', width: 8, height: 18, backgroundColor: '#38bdf8' }} />
            )}
          </div>

          {showOutput && (
            <div style={{
              marginTop: 18,
              padding: '12px 16px',
              backgroundColor: 'rgba(34,197,94,0.1)',
              borderLeft: '3px solid #22c55e',
              borderRadius: 6,
              color: '#4ade80',
              fontWeight: 600,
              opacity: outputOpacity,
              transform: "translateY(" + ((1 - outputOpacity) * 8) + "px)"
            }}>
              {output}
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
}`
  };

  /* 3.7 Scattered Kinetic Bouncing Stickers */
  T["text-glitch"] = {
    name: "Kinetic Floating Pills", cat: "text", dark: true, accent: "#ffffff",
    desc: "Organic floating black and white sticker pills scattered and bouncing with physical collisions",
    css: '.sc-pills-wrap{position:absolute;inset:0;background:#000000;overflow:hidden;font-family:Impact,system-ui,sans-serif}.sc-pill-item{position:absolute;border:2px solid #ffffff;border-radius:999px;padding:2cqw 6cqw;color:#ffffff;font-size:5.6cqw;font-weight:900;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;box-shadow:0 2cqw 8cqw rgba(0,0,0,.9);animation:pillFloat var(--D) ease-in-out infinite alternate}.sc-p1{top:18cqh;left:8cqw;transform:rotate(-12deg);animation-delay:0s}.sc-p2{top:32cqh;right:10cqw;transform:rotate(15deg);animation-delay:.3s}.sc-p3{top:48cqh;left:14cqw;transform:rotate(-6deg);background:#ffffff;color:#000000;animation-delay:.6s}.sc-p4{top:62cqh;right:8cqw;transform:rotate(10deg);animation-delay:.9s}.sc-p5{top:76cqh;left:20cqw;transform:rotate(-18deg);animation-delay:1.2s}@keyframes pillFloat{0%{transform:translateY(0) rotate(var(--rot,-10deg)) scale(1)}50%{transform:translateY(-2cqh) rotate(var(--rot,10deg)) scale(1.04)}100%{transform:translateY(1.5cqh) rotate(var(--rot,-5deg)) scale(0.98)}}',
    html: function (o) {
      var p1 = getP(o, "pill1", o.lines[0] || "DIFFERENT");
      var p2 = getP(o, "pill2", "THINGS");
      var p3 = getP(o, "pill3", o.lines[1] || "SWISHY");
      var p4 = getP(o, "pill4", "CREATIVE");
      var p5 = getP(o, "pill5", "MOTION");
      return '<div class="sc-pills-wrap">'
        + '<div class="sc-pill-item sc-p1">' + esc(p1) + '</div>'
        + '<div class="sc-pill-item sc-p2">' + esc(p2) + '</div>'
        + '<div class="sc-pill-item sc-p3">' + esc(p3) + '</div>'
        + '<div class="sc-pill-item sc-p4">' + esc(p4) + '</div>'
        + '<div class="sc-pill-item sc-p5">' + esc(p5) + '</div>'
        + '</div>';
    },
    reactCode: `function Scene(props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = props || {};
  const p1 = p.pill1 || 'DIFFERENT';
  const p2 = p.pill2 || 'THINGS';
  const p3 = p.pill3 || 'SWISHY';
  const p4 = p.pill4 || 'CREATIVE';
  const p5 = p.pill5 || 'MOTION';

  const pop = spring({ frame, fps, config: { damping: 14, stiffness: 80 } });
  const floatY = Math.sin(frame / 12) * 8;

  return (
    <AbsoluteFill style={{
      backgroundColor: '#000000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      fontFamily: 'Impact, system-ui, sans-serif'
    }}>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <div style={{
          position: 'absolute',
          top: '20%', left: '10%',
          border: '2px solid #ffffff',
          borderRadius: 999,
          padding: '8px 24px',
          color: '#ffffff',
          fontSize: 22,
          fontWeight: 900,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          transform: "translateY(" + floatY + "px) rotate(-12deg) scale(" + pop + ")",
          boxShadow: '0 10px 30px rgba(0,0,0,0.8)'
        }}>
          {p1}
        </div>

        <div style={{
          position: 'absolute',
          top: '34%', right: '12%',
          border: '2px solid #ffffff',
          borderRadius: 999,
          padding: '8px 24px',
          color: '#ffffff',
          fontSize: 22,
          fontWeight: 900,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          transform: "translateY(" + (-floatY) + "px) rotate(15deg) scale(" + pop + ")",
          boxShadow: '0 10px 30px rgba(0,0,0,0.8)'
        }}>
          {p2}
        </div>

        <div style={{
          position: 'absolute',
          top: '48%', left: '18%',
          backgroundColor: '#ffffff',
          color: '#000000',
          border: '2px solid #ffffff',
          borderRadius: 999,
          padding: '10px 28px',
          fontSize: 26,
          fontWeight: 900,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          transform: "translateY(" + (floatY * 1.2) + "px) rotate(-6deg) scale(" + pop + ")",
          boxShadow: '0 15px 40px rgba(255,255,255,0.2)'
        }}>
          {p3}
        </div>

        <div style={{
          position: 'absolute',
          top: '64%', right: '10%',
          border: '2px solid #ffffff',
          borderRadius: 999,
          padding: '8px 24px',
          color: '#ffffff',
          fontSize: 22,
          fontWeight: 900,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          transform: "translateY(" + (-floatY * 0.8) + "px) rotate(10deg) scale(" + pop + ")"
        }}>
          {p4}
        </div>

        <div style={{
          position: 'absolute',
          top: '78%', left: '22%',
          border: '2px solid #ffffff',
          borderRadius: 999,
          padding: '8px 24px',
          color: '#ffffff',
          fontSize: 22,
          fontWeight: 900,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          transform: "translateY(" + floatY + "px) rotate(-16deg) scale(" + pop + ")"
        }}>
          {p5}
        </div>
      </div>
    </AbsoluteFill>
  );
}`
  };

  /* 3.8 Editorial Barcode Poster */
  T["text-editorial"] = {
    name: "Editorial Barcode Poster", cat: "text", dark: true, accent: "#a855f7",
    desc: "Cinematic editorial magazine layout with framing crosshairs, drop barcode, and majestic headline",
    css: '.sc-editorial-wrapper{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:10cqh 6cqw;background:radial-gradient(circle at center,#1c1917 0%,#0c0a09 100%);box-sizing:border-box;overflow:hidden}.sc-crosshair{position:absolute;color:rgba(255,255,255,.25);font-size:4cqw;font-family:monospace}.sc-tl{top:4cqw;left:4cqw}.sc-tr{top:4cqw;right:4cqw}.sc-bl{bottom:4cqw;left:4cqw}.sc-br{bottom:4cqw;right:4cqw}.sc-barcode-box{display:flex;flex-direction:column;align-items:center;gap:1cqw;background:#fff;padding:2cqw 4cqw;border-radius:1cqw;box-shadow:0 2cqw 5cqw rgba(0,0,0,.5);animation:barcodeDrop var(--D) cubic-bezier(.16,1,.3,1) infinite}.sc-barcode-lines{width:36cqw;height:8cqw;background:repeating-linear-gradient(90deg,#000 0px,#000 2px,transparent 2px,transparent 4px,#000 4px,#000 7px,transparent 7px,transparent 9px,#000 9px,#000 10px,transparent 10px,transparent 13px,#000 13px,#000 16px)}.sc-barcode-num{font-family:monospace;font-size:2.8cqw;color:#000;letter-spacing:.2em;font-weight:700}.sc-editorial-body{text-align:center;display:flex;flex-direction:column;align-items:center}.sc-ed-kicker{color:#a8a29e;font-size:3cqw;letter-spacing:.3em;margin-bottom:1.5cqh;text-transform:uppercase}.sc-ed-title{color:#f5f5f4;font-size:11cqw;font-weight:400;letter-spacing:.15em;margin:0;line-height:1;font-family:Georgia,serif}.sc-ed-subtitle{color:var(--ac);font-size:9cqw;font-weight:800;letter-spacing:.12em;margin:1cqh 0 0 0;text-transform:uppercase}@keyframes barcodeDrop{0%,18%{transform:translateY(-8cqh);opacity:0}30%,85%{transform:translateY(0);opacity:1}100%{transform:translateY(-4cqh);opacity:0}}',
    html: function (o) {
      var kicker = getP(o, "kicker", o.lines[0] || "COLLECTION // 2026");
      var title = getP(o, "title", o.lines[1] || "MAJESTIC");
      var subtitle = getP(o, "subtitle", o.lines[2] || "MONARCH");
      var barcode = getP(o, "barcode", "8 49204 11092 3");
      return '<div class="sc-editorial-wrapper">'
        + '<div class="sc-crosshair sc-tl">+</div><div class="sc-crosshair sc-tr">+</div><div class="sc-crosshair sc-bl">+</div><div class="sc-crosshair sc-br">+</div>'
        + '<div class="sc-barcode-box">'
        + '<div class="sc-barcode-lines"></div>'
        + '<span class="sc-barcode-num">' + esc(barcode) + '</span>'
        + '</div>'
        + '<div class="sc-editorial-body">'
        + '<span class="sc-ed-kicker">' + esc(kicker) + '</span>'
        + '<h1 class="sc-ed-title">' + esc(title) + '</h1>'
        + '<h2 class="sc-ed-subtitle">' + esc(subtitle) + '</h2>'
        + '</div>'
        + '</div>';
    }
  };

  /* 3.9 Netflix Cinema Ribbon Reveal */
  T["text-skew"] = {
    name: "Netflix Cinema Ribbon", cat: "text", dark: true, accent: "#e50914",
    desc: "Iconic 3D folding ribbon logo reveal with cinematic red backlight flare and typography",
    css: '.sc-nflx{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 45%,#200406 0%,#050102 70%,#000 100%);overflow:hidden;box-shadow:inset 0 0 16cqw rgba(0,0,0,.95);font-family:Montserrat,Inter,sans-serif}.sc-nflx-flare{position:absolute;top:40%;left:50%;transform:translate(-50%,-50%);width:90cqw;height:90cqw;background:radial-gradient(circle,rgba(229,9,20,.35) 0%,rgba(229,9,20,.1) 40%,transparent 70%);filter:blur(3cqw);animation:nflxFlare var(--D) ease-in-out infinite}.sc-nflx-icon{position:relative;width:32cqw;height:46cqw;display:flex;justify-content:space-between;perspective:1000px;animation:nflxZoom var(--D) cubic-bezier(.16,1,.3,1) infinite}.sc-nflx-ribbon{position:absolute;top:0;width:9cqw;height:100%;background:linear-gradient(180deg,#e50914 0%,#b81d24 50%,#831010 100%);box-shadow:0 0 4cqw rgba(229,9,20,.5)}.sc-nflx-r1{left:0;border-radius:1px}.sc-nflx-r2{right:0;border-radius:1px}.sc-nflx-diag{position:absolute;top:0;left:0;width:9cqw;height:100%;background:linear-gradient(180deg,#ff1e27 0%,#e50914 50%,#990c12 100%);transform-origin:top left;transform:skewX(-28deg);left:4.5cqw;box-shadow:0 0 5cqw rgba(229,9,20,.8);z-index:2}.sc-nflx-title{color:#e50914;font-size:8.4cqw;font-weight:900;letter-spacing:.3em;text-transform:uppercase;margin-top:4cqh;text-shadow:0 0 3cqw rgba(229,9,20,.6);animation:nflxText var(--D) var(--sp) infinite}.sc-nflx-sub{color:rgba(255,255,255,.6);font-size:2.8cqw;letter-spacing:.35em;text-transform:uppercase;margin-top:1.2cqh;animation:nflxSub var(--D) var(--sp) infinite}@keyframes nflxFlare{0%,100%{opacity:.4;transform:translate(-50%,-50%) scale(.8)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.2)}}@keyframes nflxZoom{0%,15%{transform:scale(.7) translateY(4cqh);opacity:0}28%,85%{transform:scale(1) translateY(0);opacity:1}100%{transform:scale(1.15) translateY(-2cqh);opacity:0}}@keyframes nflxText{0%,20%{opacity:0;letter-spacing:.1em}35%,85%{opacity:1;letter-spacing:.3em}100%{opacity:0;letter-spacing:.4em}}@keyframes nflxSub{0%,25%{opacity:0;transform:translateY(2cqh)}40%,85%{opacity:.7;transform:translateY(0)}100%{opacity:0;transform:translateY(-1cqh)}}',
    html: function (o) {
      var title = getP(o, "title", o.lines[0] || "NETFLIX");
      var tagline = getP(o, "tagline", o.lines[1] || "ORIGINAL SERIES");
      var ribbonColor = getP(o, "ribbonColor", "#e50914");
      return '<div class="sc-nflx">'
        + '<div class="sc-nflx-flare" style="background:radial-gradient(circle,' + esc(ribbonColor) + '44 0%,' + esc(ribbonColor) + '15 40%,transparent 70%)"></div>'
        + '<div class="sc-nflx-icon">'
        + '<div class="sc-nflx-ribbon sc-nflx-r1" style="background:linear-gradient(180deg,' + esc(ribbonColor) + ' 0%,#831010 100%)"></div>'
        + '<div class="sc-nflx-diag" style="background:linear-gradient(180deg,#ff4444 0%,' + esc(ribbonColor) + ' 100%)"></div>'
        + '<div class="sc-nflx-ribbon sc-nflx-r2" style="background:linear-gradient(180deg,' + esc(ribbonColor) + ' 0%,#831010 100%)"></div>'
        + '</div>'
        + '<h1 class="sc-nflx-title" style="color:' + esc(ribbonColor) + '">' + esc(title) + '</h1>'
        + '<div class="sc-nflx-sub">' + esc(tagline) + '</div>'
        + '</div>';
    }
  };

  /* 3.10 Cyber Matrix Logo Code Stream */
  T["text-split"] = {
    name: "Cyber Matrix Logo Code", cat: "text", dark: true, accent: "#00ffaa",
    desc: "Matrix code stream assembling into glowing brand logo emblem with RGB chromatic glitch",
    css: '.sc-matrix-wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#030708;font-family:ui-monospace,monospace;overflow:hidden;box-shadow:inset 0 0 16cqw rgba(0,0,0,.9)}.sc-matrix-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(0,255,170,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,170,.06) 1px,transparent 1px);background-size:4cqw 4cqw}.sc-matrix-core{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;gap:2cqh;padding:6cqw}.sc-matrix-badge{width:24cqw;height:24cqw;border-radius:4cqw;background:rgba(0,255,170,.08);border:2px solid var(--ac);display:grid;place-items:center;font-size:10cqw;box-shadow:0 0 4cqw rgba(0,255,170,.4);animation:matPulse 2s ease-in-out infinite alternate}.sc-matrix-prompt{color:var(--ac);font-size:3.2cqw;letter-spacing:.2em;text-transform:uppercase}.sc-matrix-title{color:#fff;font-size:9.2cqw;font-weight:900;letter-spacing:.15em;text-transform:uppercase;text-shadow:0 0 3cqw var(--ac);animation:matGlitch var(--D) infinite}@keyframes matPulse{0%{transform:scale(1);box-shadow:0 0 2cqw rgba(0,255,170,.3)}100%{transform:scale(1.08);box-shadow:0 0 6cqw rgba(0,255,170,.7)}}@keyframes matGlitch{0%,85%,100%{transform:none;opacity:1}87%{transform:translateX(-4px);color:#ff0055}91%{transform:translateX(4px);color:#00f0ff}}',
    html: function (o) {
      var icon = getP(o, "icon", "⚡");
      var cmd = getP(o, "cmd", o.lines[0] || "> INITIALIZE_ENGINE()");
      var title = getP(o, "title", o.lines[1] || "SHORTSCRAFT");
      var glitchColor = getP(o, "glitchColor", "#00ffaa");
      return '<div class="sc-matrix-wrap" style="--ac:' + esc(glitchColor) + '">'
        + '<div class="sc-matrix-grid"></div>'
        + '<div class="sc-matrix-core">'
        + '<div class="sc-matrix-badge">' + esc(icon) + '</div>'
        + '<div class="sc-matrix-prompt">' + esc(cmd) + '</div>'
        + '<h1 class="sc-matrix-title">' + esc(title) + '</h1>'
        + '</div>'
        + '</div>';
    }
  };

  /* ============================================================
     CATEGORY 4: MAPS, ROUTES & RADAR (10 Documentary Templates)
     ============================================================ */

  /* 4.1 Investigative Pin & Corkboard Map */
  T["maps-gps-pin"] = {
    name: "Investigative Pin & Corkboard", cat: "maps", dark: true, accent: "#ef4444",
    desc: "Archival evidence map on corkboard with red pushpin drop and case coordinates",
    css: '.mp-pin{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:5cqh 6cqw;background:#1c1917;color:#fff;overflow:hidden}.mp-pin .cork-bg{position:absolute;inset:0;opacity:.18;background:radial-gradient(circle,#78350f 10%,#1c1917 90%)}.mp-pin .doc-tag{position:relative;z-index:3;display:flex;justify-content:space-between;align-items:center;background:#292524;border:1px solid #44403c;border-radius:2cqw;padding:2cqw 4cqw;font-family:monospace;font-size:2.8cqw;color:#fca5a5}.mp-pin .stage{position:relative;flex:1;display:grid;place-items:center;z-index:2}.mp-pin .parchment{position:relative;width:86%;height:38cqh;background:#e7e2d4;border:1px solid #d6cebe;border-radius:2cqw;box-shadow:0 3cqw 8cqw rgba(0,0,0,.7);display:grid;place-items:center;overflow:hidden;transform:rotate(-1.5deg)}.mp-pin svg.c-map{position:absolute;inset:0;width:100%;height:100%}.mp-pin .pulse-ring{position:absolute;width:32cqw;height:32cqw;border-radius:50%;border:2px solid var(--ac);animation:mpPulse 2s cubic-bezier(0,0,.2,1) infinite}.mp-pin .pin-svg{width:14cqw;height:22cqw;position:relative;z-index:4;filter:drop-shadow(0 3cqw 4cqw rgba(0,0,0,.8));animation:mpPinDrop var(--D) var(--ov) infinite}.mp-pin .card{position:relative;z-index:3;background:#fafaf9;color:#1c1917;border-radius:2.5cqw;padding:4cqw;text-align:center;box-shadow:0 3cqw 8cqw rgba(0,0,0,.8);border-left:4px solid var(--ac)}.mp-pin h2{font-family:Georgia,serif;font-size:7.2cqw;font-weight:900;margin:0;color:#1c1917}.mp-pin .meta{font-size:3.2cqw;color:#78716c;margin-top:.8cqh;font-family:monospace}@keyframes mpPinDrop{0%,15%{transform:translateY(-20cqh) scale(1.6);opacity:0}28%{transform:translateY(0) scale(0.92);opacity:1}34%,85%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(8cqh);opacity:0}}@keyframes mpPulse{0%{transform:scale(0.1);opacity:1}100%{transform:scale(1.5);opacity:0}}',
    html: function (o) {
      return '<div class="mp-pin">'
        + '<div class="cork-bg"></div>'
        + '<div class="doc-tag"><span>EXHIBIT #4 // CRIME SCENE</span><span>CONFIDENTIAL</span></div>'
        + '<div class="stage">'
        + '<div class="parchment">'
        + '<svg class="c-map" viewBox="0 0 300 200">'
        + '<defs><pattern id="dcG" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(120,53,15,0.1)" stroke-width="1"/></pattern></defs>'
        + '<rect width="100%" height="100%" fill="url(#dcG)"/>'
        + '<path d="M20,60 Q80,40 140,80 T260,50 T280,140 T180,180 T60,150 Z" fill="rgba(120,53,15,0.08)" stroke="rgba(120,53,15,0.3)" stroke-width="1.5"/>'
        + '</svg>'
        + '<div class="pulse-ring"></div>'
        + '<svg class="pin-svg" viewBox="0 0 40 60">'
        + '<defs><linearGradient id="pG2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ef4444"/><stop offset="100%" stop-color="#991b1b"/></linearGradient></defs>'
        + '<path d="M20,0 C8.95,0 0,8.95 0,20 C0,34 20,60 20,60 C20,60 40,34 40,20 C40,8.95 31.05,0 20,0 Z" fill="url(#pG2)"/>'
        + '<circle cx="20" cy="20" r="7" fill="#fff"/>'
        + '</svg>'
        + '</div>'
        + '</div>'
        + '<div class="card">'
        + '<h2>' + esc(o.lines[0] || "Target Location Found") + '</h2>'
        + '<div class="meta">' + esc(o.lines[1] || "Lat 47.3769° N, Lon 8.5417° E") + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* 4.2 Documentary Flight Route Arc */
  T["maps-flight-path"] = {
    name: "Documentary Flight Route", cat: "maps", dark: true, accent: "#38bdf8",
    desc: "Aged oceanic navigation chart with dashed flight trajectory and compass rose",
    css: '.mp-flt{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:5cqh 6cqw;background:#0c121e;color:#fff;overflow:hidden}.mp-flt .top-bar{display:flex;justify-content:space-between;align-items:center;background:rgba(15,23,42,.85);border:1px solid rgba(255,255,255,.14);border-radius:2.5cqw;padding:2.5cqw 4cqw;font-family:monospace;font-size:3cqw;color:#38bdf8}.mp-flt .stage{position:relative;flex:1;display:grid;place-items:center;margin:1cqh 0}.mp-flt svg.ocean-map{width:100%;height:38cqh;border-radius:2cqw;background:#0f172a;border:1px solid rgba(255,255,255,.1)}.mp-flt .arc-path{fill:none;stroke:var(--ac);stroke-width:3;stroke-dasharray:8 6;animation:mpDash 1.2s linear infinite}.mp-flt .plane-icon{transform-origin:center;animation:mpPlaneFly var(--D) ease-in-out infinite}.mp-flt .log-card{background:#1e293b;border:1px solid rgba(255,255,255,.12);border-radius:3cqw;padding:3.5cqw 5cqw;display:flex;justify-content:space-between;align-items:center}.mp-flt .cities{font-size:6.4cqw;font-weight:900;color:#fff}@keyframes mpDash{to{stroke-dashoffset:-14}}@keyframes mpPlaneFly{0%,10%{transform:translate(30px,150px) rotate(-35deg);opacity:0}20%{opacity:1}85%{transform:translate(250px,50px) rotate(-15deg);opacity:1}95%,100%{transform:translate(270px,40px) rotate(-10deg);opacity:0}}',
    html: function (o) {
      return '<div class="mp-flt">'
        + '<div class="top-bar"><span>TRANSATLANTIC FLIGHT LOG</span><span>ALT: 38,000 FT</span></div>'
        + '<div class="stage">'
        + '<svg class="ocean-map" viewBox="0 0 300 200">'
        + '<line x1="0" y1="100" x2="300" y2="100" stroke="rgba(255,255,255,0.06)" stroke-dasharray="4 4"/>'
        + '<line x1="150" y1="0" x2="150" y2="200" stroke="rgba(255,255,255,0.06)" stroke-dasharray="4 4"/>'
        + '<path d="M10,120 Q50,90 90,110 T150,150 T90,190 Z" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.15)"/>'
        + '<path d="M180,60 Q230,30 280,50 T290,120 T210,130 Z" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.15)"/>'
        + '<path class="arc-path" d="M40,160 Q150,30 260,60"/>'
        + '<circle cx="40" cy="160" r="5" fill="#38bdf8"/>'
        + '<circle cx="260" cy="60" r="5" fill="#22c55e"/>'
        + '<g class="plane-icon"><path d="M0,-8 L4,2 L12,4 L4,6 L2,12 L0,8 L-2,12 L-4,6 L-12,4 L-4,2 Z" fill="#fff" filter="drop-shadow(0 0 6px #38bdf8)"/></g>'
        + '</svg>'
        + '</div>'
        + '<div class="log-card">'
        + '<div class="cities"><span>' + esc(o.lines[0] || "JFK") + '</span> <span style="color:var(--ac);font-size:5cqw">✈</span> <span>' + esc(o.lines[1] || "LHR") + '</span></div>'
        + '<div style="font-family:monospace;font-size:3.2cqw;color:#94a3b8">' + esc(o.lines[2] || "3,459 MILES // 7h 45m") + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* 4.3 Cold War Archival Radar CRT */
  T["maps-radar-sweep"] = {
    name: "Cold War Archival Radar", cat: "maps", dark: true, accent: "#22c55e",
    desc: "Retro CRT oscilloscope radar screen with scanlines, range rings and target blips",
    css: '.mp-rad{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:5cqh 6cqw;background:#030c06;color:#22c55e;font-family:monospace;overflow:hidden}.mp-rad .crt-scan{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,.25) 0px,rgba(0,0,0,.25) 1px,transparent 1px,transparent 3px);pointer-events:none;z-index:5}.mp-rad .top-stat{display:flex;justify-content:space-between;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.25);border-radius:2cqw;padding:2cqw 4cqw;font-size:2.8cqw}.mp-rad .dish-box{position:relative;flex:1;display:grid;place-items:center}.mp-rad .dish{position:relative;width:64cqw;height:64cqw;border-radius:50%;border:2px solid #22c55e;background:radial-gradient(circle,rgba(34,197,94,.12) 0%,rgba(3,12,6,.95) 75%);box-shadow:0 0 4cqw rgba(34,197,94,.3);overflow:hidden}.mp-rad .ring-1{position:absolute;width:66%;height:66%;border-radius:50%;border:1px dashed rgba(34,197,94,.35)}.mp-rad .ring-2{position:absolute;width:33%;height:33%;border-radius:50%;border:1px dashed rgba(34,197,94,.35)}.mp-rad .axis-x{position:absolute;left:0;right:0;height:1px;background:rgba(34,197,94,.3)}.mp-rad .axis-y{position:absolute;top:0;bottom:0;width:1px;background:rgba(34,197,94,.3)}.mp-rad .sweep-beam{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg,transparent 0deg,#22c55e 55deg,transparent 55deg);animation:mpSweep 2.2s linear infinite}.mp-rad .tgt{position:absolute;width:4cqw;height:4cqw;border:1.5px solid #ef4444;transform:rotate(45deg);animation:mpBlink .8s infinite alternate}.mp-rad .t1{top:25%;right:30%}.mp-rad .t2{bottom:35%;left:28%}.mp-rad .foot-hud{background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.25);border-radius:2.5cqw;padding:3cqw 4cqw;text-align:center}.mp-rad h3{font-size:5.6cqw;font-weight:900;color:#22c55e;margin:0}@keyframes mpSweep{to{transform:rotate(360deg)}}@keyframes mpBlink{0%{opacity:.4;transform:rotate(45deg) scale(0.9)}100%{opacity:1;transform:rotate(45deg) scale(1.15)}}',
    html: function (o) {
      return '<div class="mp-rad">'
        + '<div class="crt-scan"></div>'
        + '<div class="top-stat"><span>ARCHIVE RADAR // 1974</span><span>DECLASSIFIED</span></div>'
        + '<div class="dish-box">'
        + '<div class="dish">'
        + '<div class="axis-x"></div><div class="axis-y"></div>'
        + '<div class="ring-1"></div><div class="ring-2"></div>'
        + '<div class="sweep-beam"></div>'
        + '<div class="tgt t1"></div><div class="tgt t2"></div>'
        + '</div>'
        + '</div>'
        + '<div class="foot-hud">'
        + '<h3>' + esc(o.lines[0] || "2 TARGETS TRACKED") + '</h3>'
        + '<div style="font-size:3cqw;color:#86efac;margin-top:.6cqh">' + esc(o.lines[1] || "AIR DEFENSE INTERCEPT // SECTOR 04") + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* 4.4 Johnny Harris Conflict Zone */
  T["maps-border"] = {
    name: "Geopolitical Conflict Zone", cat: "maps", dark: true, accent: "#f59e0b",
    desc: "Johnny Harris style geopolitical border dispute with animated hazard shading",
    css: '.mp-bor{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:5cqh 6cqw;background:#0d1117;color:#fff;overflow:hidden}.mp-bor .hdr{background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.3);border-radius:2cqw;padding:2cqw 4cqw;display:flex;justify-content:space-between;font-family:monospace;font-size:2.8cqw;color:#f59e0b}.mp-bor .stage{flex:1;position:relative;display:grid;place-items:center}.mp-bor svg{width:100%;height:38cqh}.mp-bor polygon.contested{fill:rgba(245,158,11,.18);stroke:var(--ac);stroke-width:3;stroke-dasharray:400;stroke-dashoffset:400;animation:mpDrawBorder var(--D) var(--sp) infinite}.mp-bor .info-card{background:#161b22;border:1px solid rgba(255,255,255,.14);border-radius:3cqw;padding:4cqw;text-align:center}.mp-bor h2{font-size:6.8cqw;font-weight:900;color:#fff;margin:0}@keyframes mpDrawBorder{0%,15%{stroke-dashoffset:400}35%,85%{stroke-dashoffset:0}100%{stroke-dashoffset:400}}',
    html: function (o) {
      return '<div class="mp-bor">'
        + '<div class="hdr"><span>GEOPOLITICAL FRONTIER</span><span>STANDOFF ZONE</span></div>'
        + '<div class="stage">'
        + '<svg viewBox="0 0 300 200">'
        + '<path d="M20,30 L110,40 L160,110 L90,170 L20,130 Z" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)"/>'
        + '<path d="M190,40 L280,30 L270,140 L200,180 L150,110 Z" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)"/>'
        + '<polygon class="contested" points="110,40 190,40 200,180 90,170 160,110"/>'
        + '<text x="135" y="115" fill="#f59e0b" font-size="10" font-family="monospace" font-weight="bold">CONTESTED</text>'
        + '</svg>'
        + '</div>'
        + '<div class="info-card">'
        + '<h2>' + esc(o.lines[0] || "Disputed Territory") + '</h2>'
        + '<div style="font-size:3.4cqw;color:#94a3b8;font-family:monospace;margin-top:.8cqh">' + esc(o.lines[1] || "42,500 SQ KM BUFFER REGION") + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* 4.5 CIA Reconnaissance Satellite Dossier */
  T["maps-satellite"] = {
    name: "CIA Recon Satellite Dossier", cat: "maps", dark: true, accent: "#00f0ff",
    desc: "Classified military surveillance frame with targeting reticle and coordinate lock",
    css: '.mp-sat{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:5cqh 6cqw;background:#030712;color:#00f0ff;font-family:monospace;overflow:hidden}.mp-sat .top-hud{display:flex;justify-content:space-between;font-size:2.8cqw;border-bottom:1px solid rgba(0,240,255,.25);padding-bottom:1.5cqh}.mp-sat .reticle-box{flex:1;position:relative;display:grid;place-items:center}.mp-sat .ring-outer{position:absolute;width:54cqw;height:54cqw;border:2px dashed rgba(0,240,255,.4);border-radius:50%;animation:mpLockRot 6s linear infinite}.mp-sat .ring-inner{position:absolute;width:34cqw;height:34cqw;border:1.5px solid #00f0ff;border-radius:50%}.mp-sat .cross-laser{position:absolute;width:60cqw;height:1px;background:#00f0ff;box-shadow:0 0 8px #00f0ff}.mp-sat .cross-laser.v{width:1px;height:60cqw}.mp-sat .bracket{position:absolute;width:8cqw;height:8cqw;border-color:#00f0ff;border-style:solid;border-width:0}.mp-sat .b-tl{top:15%;left:15%;border-top-width:3px;border-left-width:3px}.mp-sat .b-br{bottom:15%;right:15%;border-bottom-width:3px;border-right-width:3px}.mp-sat .bottom-data{background:#0b1329;border:1px solid rgba(0,240,255,.3);border-radius:3cqw;padding:3.5cqw 4cqw;text-align:center}.mp-sat h2{font-size:6.4cqw;font-weight:900;color:#00f0ff;margin:0}@keyframes mpLockRot{to{transform:rotate(360deg)}}',
    html: function (o) {
      return '<div class="mp-sat">'
        + '<div class="top-hud"><span>KEYHOLE KH-11 // RECON</span><span>OPTICAL: 32X</span></div>'
        + '<div class="reticle-box">'
        + '<div class="ring-outer"></div><div class="ring-inner"></div>'
        + '<div class="cross-laser"></div><div class="cross-laser v"></div>'
        + '<div class="bracket b-tl"></div><div class="bracket b-br"></div>'
        + '</div>'
        + '<div class="bottom-data">'
        + '<h2>' + esc(o.lines[0] || "TARGET LOCKED // 100%") + '</h2>'
        + '<div style="font-size:3.2cqw;color:#a5f3fc;margin-top:.6cqh">' + esc(o.lines[1] || "34°03'08\"N, 118°14'37\"W") + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* 4.6 Historical Expedition Journey Route */
  T["maps-route"] = {
    name: "Expedition Waypoint Route", cat: "maps", dark: true, accent: "#f59e0b",
    desc: "Historical expedition path advancing through numbered campsite checkpoints",
    css: '.mp-rt{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:5cqh 6cqw;background:#181512;color:#fff;overflow:hidden}.mp-rt .hdr{background:#29221d;border:1px solid #44372e;border-radius:2cqw;padding:2cqw 4cqw;display:flex;justify-content:space-between;font-family:monospace;font-size:2.8cqw;color:#fde68a}.mp-rt .stage{flex:1;position:relative;display:grid;place-items:center}.mp-rt svg{width:100%;height:38cqh}.mp-rt .route-line{fill:none;stroke:#f59e0b;stroke-width:6;stroke-dasharray:300;stroke-dashoffset:300;animation:mpDrawRoute var(--D) var(--sp) infinite}.mp-rt .summit-dot{animation:mpSummitPulse 1.4s ease-in-out infinite}@keyframes mpSummitPulse{0%,100%{r:9;opacity:1}50%{r:11;opacity:.65}}.mp-rt .log-card{background:#231d18;border:1px solid #44372e;border-radius:3cqw;padding:4cqw;text-align:center}.mp-rt h2{font-family:Georgia,serif;font-size:6.8cqw;font-weight:900;color:#fff;margin:0}@keyframes mpDrawRoute{0%,15%{stroke-dashoffset:300}35%,85%{stroke-dashoffset:0}100%{stroke-dashoffset:300}}',
    html: function (o) {
      return '<div class="mp-rt">'
        + '<div class="hdr"><span>EXPEDITION TIMELINE</span><span>DAY 14 REEL</span></div>'
        + '<div class="stage">'
        + '<svg viewBox="0 0 300 200">'
        + '<path d="M30,170 Q100,160 140,110 T260,40" class="route-line"/>'
        + '<circle cx="30" cy="170" r="7" fill="#f59e0b"/>'
        + '<circle cx="140" cy="110" r="7" fill="#f59e0b"/>'
        + '<circle class="summit-dot" cx="260" cy="40" r="9" fill="#ef4444"/>'
        + '<text x="45" y="175" fill="#aaa" font-size="10" font-family="monospace">Base Camp</text>'
        + '<text x="155" y="115" fill="#aaa" font-size="10" font-family="monospace">Ridge Pass</text>'
        + '<text x="210" y="35" fill="#fca5a5" font-size="10" font-family="monospace" font-weight="bold">Summit</text>'
        + '</svg>'
        + '</div>'
        + '<div class="log-card">'
        + '<h2>' + esc(o.lines[0] || "The Antarctic Crossing") + '</h2>'
        + '<div style="font-size:3.4cqw;color:#a8a29e;font-family:monospace;margin-top:.8cqh">' + esc(o.lines[1] || "480 KM TRAVERSED // -42°C") + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* 4.7 Vintage Ornate Compass Rose */
  T["maps-compass"] = {
    name: "Vintage Compass Rose", cat: "maps", dark: true, accent: "#d97706",
    desc: "18th-century antique maritime chart with ornate 32-point compass rose and rhumb lines",
    css: '.mp-cmp{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:5cqh 6cqw;background:#14110e;color:#fff;overflow:hidden}.mp-cmp .top-tag{display:flex;justify-content:space-between;font-family:Georgia,serif;font-style:italic;font-size:3.2cqw;color:#d6cebe}.mp-cmp .stage{flex:1;position:relative;display:grid;place-items:center}.mp-cmp .bezel{position:relative;width:58cqw;height:58cqw;border-radius:50%;border:2px solid #b45309;display:grid;place-items:center;animation:mpCmpSpin 8s ease-in-out infinite alternate}.mp-cmp .needle{position:absolute;width:4px;height:48cqw;background:linear-gradient(to bottom,#ef4444 50%,#d6cebe 50%)}.mp-cmp .hud-card{background:#231d18;border:1px solid #44372e;border-radius:3cqw;padding:4cqw;text-align:center}.mp-cmp h2{font-family:Georgia,serif;font-size:7cqw;font-weight:900;color:#fde68a;margin:0}@keyframes mpCmpSpin{0%{transform:rotate(-25deg)}100%{transform:rotate(35deg)}}',
    html: function (o) {
      return '<div class="mp-cmp">'
        + '<div class="top-tag"><span>Navigational Chart</span><span>Anno 1782</span></div>'
        + '<div class="stage">'
        + '<div class="bezel">'
        + '<div class="needle"></div>'
        + '<div style="position:absolute;top:4%;font-family:Georgia,serif;font-weight:900;color:#ef4444;font-size:4.5cqw">N</div>'
        + '<div style="position:absolute;bottom:4%;font-family:Georgia,serif;font-weight:900;color:#d6cebe;font-size:4.5cqw">S</div>'
        + '<div style="position:absolute;right:4%;font-family:Georgia,serif;font-weight:900;color:#d6cebe;font-size:4.5cqw">E</div>'
        + '<div style="position:absolute;left:4%;font-family:Georgia,serif;font-weight:900;color:#d6cebe;font-size:4.5cqw">W</div>'
        + '</div>'
        + '</div>'
        + '<div class="hud-card">'
        + '<h2>' + esc(o.lines[0] || "BEARING 045° NE") + '</h2>'
        + '<div style="font-size:3.4cqw;color:#a8a29e;font-family:monospace;margin-top:.8cqh">' + esc(o.lines[1] || "MAGNETIC DECLINATION: 2°40' W") + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* 4.8 Urban Architectural City Grid */
  T["maps-transit"] = {
    name: "City Blueprint Breakdown", cat: "maps", dark: true, accent: "#38bdf8",
    desc: "Architectural city block blueprint with highlighted target sector and coordinates",
    css: '.mp-trn{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:5cqh 6cqw;background:radial-gradient(ellipse at 50% 50%,#091d36 0%,#030914 100%);color:#fff;overflow:hidden;font-family:Inter,sans-serif}'
      + '.mp-trn .hdr{background:rgba(56,189,248,.12);border:1px solid rgba(56,189,248,.3);border-radius:2cqw;padding:2cqw 4cqw;display:flex;justify-content:space-between;font-family:monospace;font-size:2.8cqw;color:#38bdf8}'
      + '.mp-trn .stage{flex:1;position:relative;display:grid;place-items:center;margin:1cqh 0}'
      + '.mp-trn svg{width:100%;height:38cqh;border-radius:2.5cqw;background:#051224;border:1px solid rgba(56,189,248,.2);box-shadow:0 0 30px rgba(56,189,248,.15)}'
      + '.mp-trn .laser-line{stroke:#38bdf8;stroke-width:2;filter:drop-shadow(0 0 8px #38bdf8);animation:laserScan var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.mp-trn .foot-card{background:#081324;border:1px solid rgba(56,189,248,.35);border-radius:3cqw;padding:4cqw;text-align:center;box-shadow:0 4cqw 12cqw rgba(0,0,0,.8);animation:trnCardPop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.mp-trn h2{font-size:6.8cqw;font-weight:900;color:#fff;margin:0}'
      + '@keyframes laserScan{0%,10%{transform:translateY(-100px);opacity:0}20%{opacity:1}85%{transform:translateY(160px);opacity:1}100%{opacity:0}}'
      + '@keyframes trnCardPop{0%,12%{transform:scale(.92);opacity:0}25%,85%{transform:scale(1);opacity:1}100%{transform:scale(1.04);opacity:0}}',
    html: function (o) {
      return '<div class="mp-trn">'
        + '<div class="hdr"><span>ARCHITECTURAL SECTOR</span><span>GRID #104</span></div>'
        + '<div class="stage">'
        + '<svg viewBox="0 0 300 180">'
        + '<line x1="20" y1="30" x2="280" y2="30" stroke="rgba(56,189,248,0.2)"/>'
        + '<line x1="20" y1="90" x2="280" y2="90" stroke="rgba(56,189,248,0.2)"/>'
        + '<line x1="20" y1="150" x2="280" y2="150" stroke="rgba(56,189,248,0.2)"/>'
        + '<rect x="60" y="45" width="70" height="35" fill="rgba(56,189,248,0.06)" stroke="rgba(56,189,248,0.3)"/>'
        + '<rect x="160" y="45" width="90" height="35" fill="rgba(245,158,11,0.25)" stroke="#f59e0b" stroke-width="2"/>'
        + '<rect x="60" y="105" width="190" height="35" fill="rgba(56,189,248,0.06)" stroke="rgba(56,189,248,0.3)"/>'
        + '<line class="laser-line" x1="0" y1="20" x2="300" y2="20"/>'
        + '<text x="175" y="67" fill="#fde68a" font-size="9" font-family="monospace" font-weight="bold">TARGET BLOCK</text>'
        + '</svg>'
        + '</div>'
        + '<div class="foot-card">'
        + '<h2>' + esc(o.lines[0] || "5th Avenue District") + '</h2>'
        + '<div style="font-size:3.4cqw;color:#94a3b8;font-family:monospace;margin-top:.8cqh">' + esc(o.lines[1] || "SURVEILLANCE SECTOR 12 // MANHATTAN") + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* 4.9 National Geographic Mountain Summit */
  T["maps-topo"] = {
    name: "National Geographic Summit", cat: "maps", dark: true, accent: "#10b981",
    desc: "Documentary elevation contour isolines with alpine altitude markers and peak flag",
    css: '.mp-top{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:5cqh 6cqw;background:radial-gradient(ellipse at 50% 50%,#0b2318 0%,#030a06 100%);color:#fff;overflow:hidden;font-family:Inter,sans-serif}'
      + '.mp-top .top-bar{display:flex;justify-content:space-between;font-family:monospace;font-size:2.8cqw;color:#6ee7b7;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.25);border-radius:2cqw;padding:2cqw 4cqw}'
      + '.mp-top .stage{flex:1;position:relative;display:grid;place-items:center;margin:1cqh 0}'
      + '.mp-top svg{width:100%;height:38cqh;stroke:var(--ac);fill:none;border-radius:2.5cqw;background:#05170e;border:1px solid rgba(16,185,129,.2);box-shadow:0 0 30px rgba(16,185,129,.15)}'
      + '.mp-top .contour-pulse{animation:topoPulse var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.mp-top .summit-card{background:#062317;border:1px solid rgba(16,185,129,.35);border-radius:3cqw;padding:4cqw;text-align:center;box-shadow:0 4cqw 12cqw rgba(0,0,0,.8);animation:topCardPop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.mp-top h2{font-family:Georgia,serif;font-size:7.2cqw;font-weight:900;color:#fff;margin:0}'
      + '@keyframes topoPulse{0%,15%{transform:scale(0.85);opacity:0}30%,85%{transform:scale(1);opacity:1}100%{transform:scale(1.05);opacity:0}}'
      + '@keyframes topCardPop{0%,12%{transform:scale(.92);opacity:0}25%,85%{transform:scale(1);opacity:1}100%{transform:scale(1.04);opacity:0}}',
    html: function (o) {
      return '<div class="mp-top">'
        + '<div class="top-bar"><span>NAT GEO ELEVATION CHART</span><span>CONTOUR: 500M</span></div>'
        + '<div class="stage">'
        + '<svg viewBox="0 0 300 200">'
        + '<ellipse cx="150" cy="100" rx="130" ry="75" stroke-width="1.5" stroke="rgba(16,185,129,0.3)"/>'
        + '<ellipse cx="150" cy="100" rx="95" ry="55" stroke-width="2" stroke="rgba(16,185,129,0.6)"/>'
        + '<ellipse class="contour-pulse" cx="150" cy="100" rx="60" ry="35" stroke-width="2.5" stroke="#10b981"/>'
        + '<ellipse class="contour-pulse" cx="150" cy="100" rx="25" ry="15" stroke-width="3" stroke="#34d399"/>'
        + '<polygon points="150,85 158,95 142,95" fill="#facc15" filter="drop-shadow(0 0 6px #facc15)"/>'
        + '</svg>'
        + '</div>'
        + '<div class="summit-card">'
        + '<h2>' + esc(o.lines[0] || "Mont Blanc Summit") + '</h2>'
        + '<div style="font-size:3.4cqw;color:#a7f3d0;font-family:monospace;margin-top:.8cqh">' + esc(o.lines[1] || "PEAK ELEVATION: 4,810M / 15,781 FT") + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* 4.10 Geopolitical Maritime Chokepoint */
  T["maps-trade-route"] = {
    name: "Maritime Trade Chokepoint", cat: "maps", dark: true, accent: "#38bdf8",
    desc: "Strategic strait waterway with cargo ship traffic, bathymetry and trade impact metrics",
    css: '.mp-sea{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:5cqh 6cqw;background:radial-gradient(ellipse at 50% 50%,#092344 0%,#020b17 100%);color:#fff;overflow:hidden;font-family:Inter,sans-serif}'
      + '.mp-sea .top-bar{display:flex;justify-content:space-between;font-size:2.8cqw;font-family:monospace;color:#38bdf8;background:rgba(56,189,248,.1);border:1px solid rgba(56,189,248,.25);border-radius:2cqw;padding:2cqw 4cqw}'
      + '.mp-sea .stage{flex:1;position:relative;display:grid;place-items:center;margin:1cqh 0}'
      + '.mp-sea svg{width:100%;height:38cqh;border-radius:2.5cqw;background:#041429;border:1px solid rgba(56,189,248,.2);box-shadow:0 0 30px rgba(56,189,248,.15)}'
      + '.mp-sea .ship-path{stroke:#38bdf8;stroke-width:3;stroke-dasharray:6 6;fill:none;animation:seaDash 1.5s linear infinite}'
      + '.mp-sea .card{background:#081c36;border:1px solid rgba(56,189,248,.35);border-radius:3cqw;padding:4cqw;text-align:center;box-shadow:0 4cqw 12cqw rgba(0,0,0,.8);animation:seaCardPop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.mp-sea h2{font-size:7cqw;font-weight:900;color:#fff;margin:0}'
      + '@keyframes seaDash{to{stroke-dashoffset:-24}}'
      + '@keyframes seaCardPop{0%,12%{transform:scale(.92);opacity:0}25%,85%{transform:scale(1);opacity:1}100%{transform:scale(1.04);opacity:0}}',
    html: function (o) {
      return '<div class="mp-sea">'
        + '<div class="top-bar"><span>GLOBAL TRADE CHOKEPOINT</span><span>AIS RADAR ACTIVE</span></div>'
        + '<div class="stage">'
        + '<svg viewBox="0 0 300 200">'
        + '<path d="M0,40 Q100,60 140,20 T300,10 L300,0 L0,0 Z" fill="rgba(255,255,255,0.06)"/>'
        + '<path d="M0,160 Q120,130 180,180 T300,150 L300,200 L0,200 Z" fill="rgba(255,255,255,0.06)"/>'
        + '<path class="ship-path" d="M20,100 Q150,110 280,85"/>'
        + '<circle cx="150" cy="105" r="5" fill="#38bdf8" filter="drop-shadow(0 0 8px #38bdf8)"/>'
        + '</svg>'
        + '</div>'
        + '<div class="card">'
        + '<h2>' + esc(o.lines[0] || "Strait of Malacca") + '</h2>'
        + '<div style="font-size:3.4cqw;color:#94a3b8;font-family:monospace;margin-top:.8cqh">' + esc(o.lines[1] || "30% OF GLOBAL MARITIME TRADE") + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* ============================================================
     CATEGORY 5: FINANCE & ECONOMY (10 templates)
     ============================================================ */

  /* 5.1 Candlestick Trading Surge */
  T["money-candlestick"] = {
    name: "Trading Candlestick", cat: "money", dark: true, accent: "#22c55e",
    desc: "Green and red stock trading candlestick chart drawing breakout surge with glowing EMA line",
    css: '.sc-trade-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:8cqh 7cqw;background:radial-gradient(ellipse at 50% 40%,#0e1726 0%,#060911 100%);overflow:hidden;font-family:"Space Grotesk",sans-serif;color:#fff}'
      + '.sc-trade-head{display:flex;justify-content:space-between;align-items:flex-start;z-index:2}'
      + '.sc-trade-ticker{font-size:4.2cqw;font-weight:700;color:var(--dim);letter-spacing:.08em}'
      + '.sc-trade-gain{display:inline-flex;align-items:center;gap:1.5cqw;padding:.8cqh 2.5cqw;border-radius:999px;background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.4);font-size:4.8cqw;font-weight:900;color:#22c55e;box-shadow:0 0 20px rgba(34,197,94,.3);animation:tradeGainPulse 2s ease-in-out infinite}'
      + '.sc-trade-chart-box{position:relative;width:100%;height:44cqh;display:flex;align-items:flex-end;gap:3.5cqw;padding:0 2cqw 2cqh;border-bottom:1px solid rgba(255,255,255,.12);background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:6cqw 6cqw}'
      + '.sc-trade-svg-line{position:absolute;inset:0;width:100%;height:100%;z-index:3;pointer-events:none}'
      + '.sc-trade-ema-path{fill:none;stroke:#38bdf8;stroke-width:4;stroke-linecap:round;filter:drop-shadow(0 0 10px #38bdf8);stroke-dasharray:600;stroke-dashoffset:600;animation:tradeEmaDraw var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-trade-bar{flex:1;position:relative;border-radius:3px;box-shadow:0 0 16px rgba(34,197,94,.35);animation:tradeBarRise var(--D) cubic-bezier(.16,1,.3,1) infinite;transform-origin:bottom}'
      + '.sc-trade-bar::before{content:"";position:absolute;left:50%;top:-3cqh;bottom:-3cqh;width:2px;background:inherit;transform:translateX(-50%);opacity:.85}'
      + '.sc-trade-b-green{background:#22c55e;color:#22c55e}'
      + '.sc-trade-b-red{background:#ef4444;color:#ef4444;box-shadow:0 0 16px rgba(239,68,68,.35)}'
      + '.sc-trade-foot{display:flex;justify-content:space-between;align-items:center;font-size:3.4cqw;color:var(--dim);border-top:1px solid rgba(255,255,255,.06);padding-top:1.5cqh}'
      + '@keyframes tradeBarRise{0%,12%{transform:scaleY(0);opacity:0}25%,85%{transform:scaleY(1);opacity:1}100%{transform:scaleY(0.95);opacity:0}}'
      + '@keyframes tradeEmaDraw{0%,18%{stroke-dashoffset:600}40%,85%{stroke-dashoffset:0}100%{stroke-dashoffset:600}}'
      + '@keyframes tradeGainPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05);box-shadow:0 0 28px rgba(34,197,94,.5)}}',
    html: function (o) {
      var ticker = getP(o, "ticker", o.lines[0] || "NASDAQ: NVDA");
      var gain = getP(o, "gain", "+14.8% ↗");
      var cap = getP(o, "cap", o.lines[1] || "MARKET CAP // $3.2T");
      return '<div class="sc-trade-wrap">'
        + '<div class="sc-trade-head">'
        + '<div class="sc-trade-ticker">' + esc(ticker) + '</div>'
        + '<div class="sc-trade-gain">' + esc(gain) + '</div>'
        + '</div>'
        + '<div class="sc-trade-chart-box">'
        + '<svg class="sc-trade-svg-line" viewBox="0 0 300 200">'
        + '<path class="sc-trade-ema-path" d="M 15 160 Q 90 140 160 90 T 285 25" />'
        + '</svg>'
        + '<div class="sc-trade-bar sc-trade-b-green" style="height:32%;animation-delay:.05s;"></div>'
        + '<div class="sc-trade-bar sc-trade-b-red" style="height:48%;animation-delay:.12s;"></div>'
        + '<div class="sc-trade-bar sc-trade-b-green" style="height:64%;animation-delay:.18s;"></div>'
        + '<div class="sc-trade-bar sc-trade-b-green" style="height:92%;animation-delay:.25s;"></div>'
        + '</div>'
        + '<div class="sc-trade-foot">'
        + '<span>VOL 42.8M</span>'
        + '<span>' + esc(cap) + '</span>'
        + '</div>'
        + '</div>';
    }
  };

  /* 5.2 3D Isometric Cash Stack */
  T["money-cash-stack"] = {
    name: "3D Cash Stack", cat: "money", dark: true, accent: "#34d17a",
    desc: "3D isometric currency bills floating and stacking with banknote details",
    css: '.sc-cash-wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8cqw;background:radial-gradient(ellipse at 50% 50%,#0c2014 0%,#040a06 100%);overflow:hidden;font-family:Inter,sans-serif;color:#fff;perspective:900px}'
      + '.sc-cash-stage{position:relative;width:68cqw;height:32cqh;transform-style:preserve-3d;transform:rotateX(30deg) rotateZ(-12deg);animation:cashFloat 5s ease-in-out infinite alternate}'
      + '.sc-cash-bill{position:absolute;width:100%;height:18cqh;border-radius:2.5cqw;background:linear-gradient(135deg,#1f6b3e 0%,#0f4023 100%);border:2px solid #34d17a;box-shadow:0 12px 30px rgba(0,0,0,.7),0 0 20px rgba(52,209,122,.2);display:flex;align-items:center;justify-content:space-between;padding:3cqw 4cqw;animation:billSlam var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-cash-b1{bottom:0cqh;animation-delay:.05s}'
      + '.sc-cash-b2{bottom:4cqh;animation-delay:.15s}'
      + '.sc-cash-b3{bottom:8cqh;animation-delay:.25s}'
      + '.sc-cash-circle{width:9cqw;height:9cqw;border-radius:50%;border:2px dashed #a7f3d0;display:grid;place-items:center;font-size:4.5cqw;font-weight:900;color:#34d17a}'
      + '.sc-cash-val{font-family:"Space Grotesk",sans-serif;font-size:5.5cqw;font-weight:900;color:#f0fdf4}'
      + '.sc-cash-info{margin-top:4cqh;text-align:center;z-index:5}'
      + '.sc-cash-total{font-size:13cqw;font-weight:900;letter-spacing:-.04em;line-height:1;color:#fff;text-shadow:0 0 35px rgba(52,209,122,.5);animation:cashTotalPop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-cash-sub{font-size:3.6cqw;letter-spacing:.2em;text-transform:uppercase;color:#86efac;font-weight:700;margin-top:1cqh}'
      + '@keyframes cashFloat{0%{transform:rotateX(28deg) rotateZ(-10deg) translateY(0)}100%{transform:rotateX(34deg) rotateZ(-14deg) translateY(-1.5cqh)}}'
      + '@keyframes billSlam{0%,10%{transform:translateY(-8cqh) scale(.8);opacity:0}22%,88%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(0);opacity:0}}'
      + '@keyframes cashTotalPop{0%,18%{transform:scale(.85);opacity:0}28%,88%{transform:scale(1);opacity:1}100%{transform:scale(1);opacity:0}}',
    html: function (o) {
      var total = getP(o, "total", o.lines[0] || "$50,000");
      var sub = getP(o, "sub", o.lines[1] || "Monthly Revenue");
      return '<div class="sc-cash-wrap">'
        + '<div class="sc-cash-stage">'
        + '<div class="sc-cash-bill sc-cash-b1"><div class="sc-cash-circle">$</div><div class="sc-cash-val">100</div></div>'
        + '<div class="sc-cash-bill sc-cash-b2"><div class="sc-cash-circle">$</div><div class="sc-cash-val">100</div></div>'
        + '<div class="sc-cash-bill sc-cash-b3"><div class="sc-cash-circle">$</div><div class="sc-cash-val">100</div></div>'
        + '</div>'
        + '<div class="sc-cash-info">'
        + '<div class="sc-cash-total">' + esc(total) + '</div>'
        + '<div class="sc-cash-sub">' + esc(sub) + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* 5.3 Tech Giant 3D Breakout Stat Card */
  T["money-titanium-card"] = {
    name: "Tech Giant Stat Card", cat: "money", dark: true, accent: "#10b981",
    desc: "3D neon emerald gradient ad card with gigantic impact percentage stat and clean corporate typography",
    css: '.sc-statcard-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:6cqw;background:#031309;font-family:-apple-system,BlinkMacSystemFont,sans-serif;overflow:hidden}.sc-statcard-bg{position:absolute;inset:0;background:radial-gradient(circle at 50% 60%,rgba(16,185,129,.4) 0%,rgba(3,19,9,.95) 75%)}.sc-statcard-card{position:relative;z-index:2;width:86cqw;background:linear-gradient(180deg,#0a2315 0%,#04140b 100%);border:1px solid rgba(16,185,129,.3);border-radius:5cqw;padding:8cqw 6cqw;box-shadow:0 4cqw 14cqw rgba(0,0,0,.9),0 0 8cqw rgba(16,185,129,.15);display:flex;flex-direction:column;align-items:center;text-align:center;animation:statcardPop var(--D) cubic-bezier(.16,1,.3,1) infinite}.sc-statcard-brand{font-size:5cqw;font-weight:900;letter-spacing:-.02em;color:#ffffff;margin-bottom:3cqh}.sc-statcard-num{font-size:24cqw;font-weight:900;line-height:.9;color:#10b981;letter-spacing:-.05em;text-shadow:0 0 30px rgba(16,185,129,.6),0 4px 12px rgba(0,0,0,.8);margin:1.5cqh 0}.sc-statcard-desc{font-size:3.8cqw;font-weight:600;color:#e2e8f0;line-height:1.4;max-width:90%;margin-top:1cqh}.sc-statcard-footer{font-size:3.4cqw;font-weight:800;color:#34d399;letter-spacing:.02em;margin-top:2cqh}@keyframes statcardPop{0%,15%{transform:scale(.9) translateY(2cqh);opacity:0}30%,85%{transform:scale(1) translateY(0);opacity:1}100%{transform:scale(1.04);opacity:0}}',
    html: function (o) {
      var brand = getP(o, "brand", o.lines[0] || "Upwork");
      var num = getP(o, "num", "41%");
      var desc = getP(o, "desc", o.lines[1] || "of top companies agree");
      var footer = getP(o, "footer", "AI works best when humans lead.");
      return '<div class="sc-statcard-wrap">'
        + '<div class="sc-statcard-bg"></div>'
        + '<div class="sc-statcard-card">'
        + '<div class="sc-statcard-brand">' + esc(brand) + '</div>'
        + '<div class="sc-statcard-num">' + esc(num) + '</div>'
        + '<div class="sc-statcard-desc">' + esc(desc) + '</div>'
        + '<div class="sc-statcard-footer">' + esc(footer) + '</div>'
        + '</div>'
        + '</div>';
    },
    reactCode: `function Scene(props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = props || {};
  const brand = p.brand || 'Upwork';
  const num = p.num || '41%';
  const desc = p.desc || 'of top companies agree';
  const footer = p.footer || 'AI works best when humans lead.';

  const pop = spring({ frame, fps, config: { damping: 14, stiffness: 85 } });
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      backgroundColor: '#031309',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '6%',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        top: '20%',
        width: 350,
        height: 350,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(16,185,129,0.35) 0%, transparent 70%)',
        filter: 'blur(40px)',
        pointerEvents: 'none'
      }} />

      <div style={{
        position: 'relative',
        zIndex: 2,
        width: '90%',
        background: 'linear-gradient(180deg, #0a2315 0%, #04140b 100%)',
        border: '1px solid rgba(16,185,129,0.35)',
        borderRadius: 24,
        padding: '36px 24px',
        boxShadow: '0 30px 80px rgba(0,0,0,0.9), 0 0 40px rgba(16,185,129,0.18)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        transform: "scale(" + pop + ")",
        opacity: opacity
      }}>
        <div style={{
          fontSize: 20,
          fontWeight: 900,
          letterSpacing: '-0.02em',
          color: '#ffffff',
          marginBottom: 16
        }}>
          {brand}
        </div>

        <div style={{
          fontSize: 88,
          fontWeight: 900,
          lineHeight: 0.9,
          color: '#10b981',
          letterSpacing: '-0.05em',
          textShadow: '0 0 35px rgba(16,185,129,0.7), 0 4px 14px rgba(0,0,0,0.8)',
          margin: '12px 0'
        }}>
          {num}
        </div>

        <div style={{
          fontSize: 15,
          fontWeight: 600,
          color: '#e2e8f0',
          lineHeight: 1.4,
          maxWidth: '90%',
          marginTop: 6
        }}>
          {desc}
        </div>

        <div style={{
          fontSize: 13,
          fontWeight: 800,
          color: '#34d399',
          letterSpacing: '0.02em',
          marginTop: 14
        }}>
          {footer}
        </div>
      </div>
    </AbsoluteFill>
  );
}`
  };

  /* 5.4 Crypto Bitcoin Flip */
  T["money-crypto-surge"] = {
    name: "Bitcoin Gold Ticker", cat: "money", dark: true, accent: "#f59e0b",
    desc: "Floating 3D gold Bitcoin coin spinning with price breakout and particle glow",
    css: '.sc-btc-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:8cqw;background:radial-gradient(ellipse at 50% 50%,#261504 0%,#0a0501 100%);overflow:hidden;font-family:"Space Grotesk",sans-serif;color:#fff;perspective:900px}'
      + '.sc-btc-3d-img{width:36cqw;height:36cqw;object-fit:contain;filter:drop-shadow(0 0 35px rgba(245,158,11,.6)) drop-shadow(0 15px 30px rgba(0,0,0,.8));animation:btcSpin 5s ease-in-out infinite alternate}'
      + '.sc-btc-card{margin-top:3.5cqh;text-align:center;animation:btcCardPop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-btc-price{font-size:14cqw;font-weight:900;letter-spacing:-.04em;line-height:1;color:#fff;text-shadow:0 0 30px rgba(245,158,11,.4)}'
      + '.sc-btc-badge{display:inline-flex;align-items:center;gap:1.5cqw;padding:.8cqh 3cqw;border-radius:999px;background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.4);font-size:3.8cqw;font-weight:800;color:#22c55e;margin-top:1.5cqh;box-shadow:0 0 16px rgba(34,197,94,.3)}'
      + '@keyframes btcSpin{0%{transform:rotateY(-15deg) rotateX(10deg) scale(0.96)}100%{transform:rotateY(25deg) rotateX(-10deg) scale(1.04)}}'
      + '@keyframes btcCardPop{0%,15%{transform:translateY(3cqh);opacity:0}28%,85%{transform:translateY(0);opacity:1}100%{transform:translateY(-2cqh);opacity:0}}',
    html: function (o) {
      var price = getP(o, "price", o.lines[0] || "$98,400");
      var gain = getP(o, "gain", o.lines[1] || "▲ +8.4% 24H BREAKOUT");
      return '<div class="sc-btc-wrap">'
        + '<img src="/assets/bitcoin_gold_3d.png" class="sc-btc-3d-img" alt="3D Gold Bitcoin" />'
        + '<div class="sc-btc-card">'
        + '<div class="sc-btc-price">' + esc(price) + '</div>'
        + '<div class="sc-btc-badge">' + esc(gain) + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* 5.5 Gold Bullion Vault */
  T["money-gold-vault"] = {
    name: "Gold Bullion Stack", cat: "money", dark: true, accent: "#ffd700",
    desc: "Golden bullion bars stacking in bank vault with metallic glint",
    css: '.sc-gold-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:8cqw;background:radial-gradient(ellipse at 50% 50%,#241b06 0%,#0a0802 100%);overflow:hidden;font-family:Inter,sans-serif;color:#fff;perspective:900px}'
      + '.sc-gold-stage{position:relative;width:68cqw;height:28cqh;display:flex;align-items:center;justify-content:center;animation:goldFloat 5s ease-in-out infinite alternate}'
      + '.sc-gold-3d-img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 20px 40px rgba(0,0,0,.9)) drop-shadow(0 0 35px rgba(234,179,8,.5))}'
      + '.sc-gold-info{margin-top:2cqh;text-align:center;z-index:5}'
      + '.sc-gold-title{font-size:12cqw;font-weight:900;color:#ffd700;letter-spacing:-.03em;line-height:1;text-shadow:0 0 30px rgba(255,215,0,.5);animation:goldTextPop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-gold-sub{font-size:3.6cqw;letter-spacing:.2em;text-transform:uppercase;color:#fde047;font-weight:700;margin-top:.8cqh}'
      + '@keyframes goldFloat{0%{transform:rotateX(10deg) translateY(0)}100%{transform:rotateX(-6deg) translateY(-1.5cqh)}}'
      + '@keyframes goldTextPop{0%,18%{transform:scale(.9);opacity:0}28%,85%{transform:scale(1);opacity:1}100%{transform:scale(1);opacity:0}}',
    html: function (o) {
      var title = getP(o, "title", o.lines[0] || "1,000 OUNCES");
      var sub = getP(o, "sub", o.lines[1] || "Federal Reserve Bullion Asset");
      return '<div class="sc-gold-wrap">'
        + '<div class="sc-gold-stage">'
        + '<img src="/assets/gold_bullion_3d.png" class="sc-gold-3d-img" alt="3D Gold Bullion" />'
        + '</div>'
        + '<div class="sc-gold-info">'
        + '<div class="sc-gold-title">' + esc(title) + '</div>'
        + '<div class="sc-gold-sub">' + esc(sub) + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* 5.6 Wealth Burn Meter */
  T["money-burn"] = {
    name: "Inflation Burn Meter", cat: "money", dark: true, accent: "#ef4444",
    desc: "Inflation pressure meter burning with flame indicators and warning strobe",
    css: '.sc-burn-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:8cqw;background:radial-gradient(ellipse at 50% 50%,#2b0808 0%,#090202 100%);overflow:hidden;font-family:Inter,sans-serif;color:#fff}'
      + '.sc-burn-icon{font-size:18cqw;filter:drop-shadow(0 0 30px #ef4444);animation:flamePulse 1.2s ease-in-out infinite alternate}'
      + '.sc-burn-info{margin-top:2.5cqh;text-align:center;animation:burnTextPop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-burn-val{font-family:"Space Grotesk",sans-serif;font-size:13cqw;font-weight:900;letter-spacing:-.04em;line-height:1;color:#ef4444;text-shadow:0 0 35px rgba(239,68,68,.6)}'
      + '.sc-burn-sub{font-size:3.6cqw;letter-spacing:.2em;text-transform:uppercase;color:#fca5a5;font-weight:700;margin-top:.8cqh}'
      + '@keyframes flamePulse{0%{transform:scale(0.92) rotate(-3deg)}100%{transform:scale(1.1) rotate(3deg)}}'
      + '@keyframes burnTextPop{0%,15%{transform:scale(.9);opacity:0}26%,85%{transform:scale(1);opacity:1}100%{transform:scale(1);opacity:0}}',
    html: function (o) {
      var val = getP(o, "val", o.lines[0] || "-$24,000/DAY");
      var sub = getP(o, "sub", o.lines[1] || "Daily Cash Burn Rate");
      return '<div class="sc-burn-wrap">'
        + '<div class="sc-burn-icon">🔥</div>'
        + '<div class="sc-burn-info">'
        + '<div class="sc-burn-val">' + esc(val) + '</div>'
        + '<div class="sc-burn-sub">' + esc(sub) + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* 5.7 Digital Receipt Print */
  T["money-receipt"] = {
    name: "Thermal Receipt Print", cat: "money", dark: true, accent: "#ffffff",
    desc: "Digital thermal receipt printing out with line items and barcode",
    css: '.sc-rec-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:8cqw;background:#09090b;overflow:hidden;font-family:ui-monospace,monospace}'
      + '.sc-rec-slip{width:84cqw;background:#fff;color:#09090b;border-radius:2px;padding:6cqw;box-shadow:0 20px 50px rgba(0,0,0,.9);animation:receiptSlide var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-rec-title{font-size:5cqw;font-weight:900;text-align:center;letter-spacing:.1em;border-bottom:2px dashed #a1a1aa;padding-bottom:1.5cqh;margin-bottom:2cqh}'
      + '.sc-rec-row{display:flex;justify-content:space-between;font-size:3.8cqw;font-weight:700;margin-bottom:1cqh}'
      + '.sc-rec-bar{font-size:2.8cqw;letter-spacing:.35em;text-align:center;border-top:2px solid #000;border-bottom:4px solid #000;padding:.8cqh 0;margin-top:2cqh}'
      + '@keyframes receiptSlide{0%,12%{transform:translateY(-10cqh);opacity:0}25%{transform:translateY(0);opacity:1}50%{transform:translateY(-.4cqh);opacity:1}70%{transform:translateY(.3cqh);opacity:1}85%{transform:translateY(0);opacity:1}100%{transform:translateY(4cqh);opacity:0}}',
    html: function (o) {
      var header = getP(o, "header", o.lines[0] || "INVOICE PAID");
      var item = getP(o, "item", "ShortsCraft Pro Plan");
      var price = getP(o, "price", "$99.00");
      return '<div class="sc-rec-wrap">'
        + '<div class="sc-rec-slip">'
        + '<div class="sc-rec-title">' + esc(header) + '</div>'
        + '<div class="sc-rec-row"><span>' + esc(item) + '</span><b>' + esc(price) + '</b></div>'
        + '<div class="sc-rec-row" style="color:#71717a"><span>TAX // VAT (0%)</span><span>$0.00</span></div>'
        + '<div class="sc-rec-bar">|||| | ||||| |||| | |||</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* 5.8 Wallet Net Worth Unlock */
  T["money-wallet-unlock"] = {
    name: "Net Worth Unlock", cat: "money", dark: true, accent: "#38bdf8",
    desc: "Secured biometric padlock unlocking into high net-worth wallet balance",
    css: '.sc-lock-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:8cqw;background:radial-gradient(ellipse at 50% 50%,#091c36 0%,#020b17 100%);overflow:hidden;font-family:Inter,sans-serif;color:#fff}'
      + '.sc-lock-icon{font-size:18cqw;animation:lockPop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-lock-info{margin-top:2.5cqh;text-align:center;animation:lockTextPop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-lock-val{font-family:"Space Grotesk",sans-serif;font-size:13cqw;font-weight:900;letter-spacing:-.04em;line-height:1;color:#fff;text-shadow:0 0 35px rgba(56,189,248,.5)}'
      + '.sc-lock-sub{font-size:3.6cqw;letter-spacing:.2em;text-transform:uppercase;color:#7dd3fc;font-weight:700;margin-top:.8cqh}'
      + '@keyframes lockPop{0%,12%{transform:scale(.7) rotate(-15deg);opacity:0}24%,85%{transform:scale(1) rotate(0);opacity:1}100%{transform:scale(1.05);opacity:0}}'
      + '@keyframes lockTextPop{0%,18%{transform:translateY(2cqh);opacity:0}28%,85%{transform:translateY(0);opacity:1}100%{transform:translateY(-1cqh);opacity:0}}',
    html: function (o) {
      var val = getP(o, "val", o.lines[0] || "$1,250,000");
      var sub = getP(o, "sub", o.lines[1] || "Liquid Net Worth Unlocked");
      return '<div class="sc-lock-wrap">'
        + '<div class="sc-lock-icon">🔓</div>'
        + '<div class="sc-lock-info">'
        + '<div class="sc-lock-val">' + esc(val) + '</div>'
        + '<div class="sc-lock-sub">' + esc(sub) + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* 5.9 Sale Price Slash */
  T["money-sale-slash"] = {
    name: "50% Off Price Slash", cat: "money", dark: true, accent: "#ef4444",
    desc: "Original retail price crossed out with bold red line and discount badge",
    css: '.sc-slash-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:8cqw;background:radial-gradient(ellipse at 50% 50%,#260808 0%,#090202 100%);overflow:hidden;font-family:Inter,sans-serif;color:#fff}'
      + '.sc-slash-old{position:relative;font-size:9cqw;font-weight:700;color:var(--dim);display:inline-block;animation:oldPricePop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-slash-old::after{content:"";position:absolute;left:-8%;right:-8%;top:50%;height:4px;background:#ef4444;transform:rotate(-12deg);box-shadow:0 0 10px #ef4444;animation:lineDraw var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-slash-new{font-family:"Space Grotesk",sans-serif;font-size:16cqw;font-weight:900;color:#fff;line-height:1;margin:2cqh 0;text-shadow:0 0 35px rgba(239,68,68,.5);animation:newPricePop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-slash-badge{background:#ef4444;color:#fff;padding:1.5cqh 5cqw;border-radius:999px;font-size:4.2cqw;font-weight:900;letter-spacing:.08em;box-shadow:0 0 25px rgba(239,68,68,.6);animation:badgePop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '@keyframes oldPricePop{0%,10%{transform:scale(.8);opacity:0}20%,85%{transform:scale(1);opacity:1}100%{opacity:0}}'
      + '@keyframes lineDraw{0%,20%{transform:scaleX(0) rotate(-12deg)}30%,85%{transform:scaleX(1) rotate(-12deg)}100%{transform:scaleX(0) rotate(-12deg)}}'
      + '@keyframes newPricePop{0%,22%{transform:scale(1.4);opacity:0}32%,85%{transform:scale(1);opacity:1}100%{opacity:0}}'
      + '@keyframes badgePop{0%,28%{transform:scale(0);opacity:0}38%,85%{transform:scale(1);opacity:1}100%{opacity:0}}',
    html: function (o) {
      var oldPrice = getP(o, "oldPrice", o.lines[0] || "$99/mo");
      var newPrice = getP(o, "newPrice", o.lines[1] || "$9/mo");
      var badge = getP(o, "badge", o.lines[2] || "90% OFF LAUNCH SALE");
      return '<div class="sc-slash-wrap">'
        + '<div class="sc-slash-old">' + esc(oldPrice) + '</div>'
        + '<div class="sc-slash-new">' + esc(newPrice) + '</div>'
        + '<div class="sc-slash-badge">' + esc(badge) + '</div>'
        + '</div>';
    }
  };

  /* 5.10 ATM Cash Dispense */
  T["money-atm"] = {
    name: "ATM Cash Dispenser", cat: "money", dark: true, accent: "#10b981",
    desc: "Cash banknotes smoothly sliding out of high-tech ATM slot",
    css: '.sc-atm-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:8cqw;background:radial-gradient(ellipse at 50% 50%,#092416 0%,#020b06 100%);overflow:hidden;font-family:Inter,sans-serif;color:#fff}'
      + '.sc-atm-slot{width:75cqw;height:5cqh;border-radius:99px;background:#05140b;border:2px solid #10b981;box-shadow:0 0 25px rgba(16,185,129,.4),inset 0 0 10px rgba(0,0,0,.8);position:relative;margin-bottom:2cqh}'
      + '.sc-atm-bill{width:68cqw;height:14cqh;border-radius:2cqw;background:linear-gradient(135deg,#10b981 0%,#047857 100%);border:2px solid #6ee7b7;box-shadow:0 15px 35px rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;font-family:"Space Grotesk",sans-serif;font-size:6.5cqw;font-weight:900;color:#fff;animation:atmDispense var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-atm-info{margin-top:3.5cqh;text-align:center;animation:atmTextPop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-atm-title{font-size:7.2cqw;font-weight:900;color:#fff;letter-spacing:-.02em}'
      + '.sc-atm-sub{font-size:3.6cqw;color:#6ee7b7;font-weight:700;margin-top:.6cqh}'
      + '@keyframes atmDispense{0%,12%{transform:translateY(-8cqh) scale(.8);opacity:0}26%,85%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(4cqh);opacity:0}}'
      + '@keyframes atmTextPop{0%,18%{transform:translateY(2cqh);opacity:0}28%,85%{transform:translateY(0);opacity:1}100%{transform:translateY(-1cqh);opacity:0}}',
    html: function (o) {
      var val = getP(o, "val", o.lines[0] || "$10,000 PAYOUT");
      var sub = getP(o, "sub", o.lines[1] || "Instant Automated Transfer");
      return '<div class="sc-atm-wrap">'
        + '<div class="sc-atm-slot"></div>'
        + '<div class="sc-atm-bill">' + esc(val) + '</div>'
        + '<div class="sc-atm-info">'
        + '<div class="sc-atm-title">CASH DISPENSED</div>'
        + '<div class="sc-atm-sub">' + esc(sub) + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* ============================================================
     CATEGORY 6: UI & DEVICES (10 templates)
     ============================================================ */

  /* 6.1 iOS Notification Pop */
  T["ui-ios-notify"] = {
    name: "iOS Push Notification", cat: "ui", dark: true, accent: "#5b8cff",
    desc: "Floating frosted glass iOS push notification banner with app icon",
    css: '.sc-notify-wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;padding:12cqh 6cqw 0;background:radial-gradient(ellipse at 50% 30%,#18152e 0%,#08080f 100%);overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#fff}'
      + '.sc-notify-time{font-size:18cqw;font-weight:200;text-align:center;margin-bottom:5cqh;opacity:.9}'
      + '.sc-notify-card{display:flex;gap:3.5cqw;align-items:flex-start;padding:4.5cqw;border-radius:5cqw;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);backdrop-filter:blur(24px);box-shadow:0 20px 50px rgba(0,0,0,.7),0 0 25px rgba(121,82,255,.2);width:100%;animation:notifyDrop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-notify-ico{width:11cqw;height:11cqw;background:linear-gradient(135deg,#7952ff,#00d2ff);border-radius:2.8cqw;display:grid;place-items:center;font-size:5.5cqw;flex-shrink:0;box-shadow:0 4px 12px rgba(121,82,255,.4)}'
      + '@keyframes notifyDrop{0%,12%{transform:translateY(-6cqh) scale(.92);opacity:0}24%,85%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(-2cqh);opacity:0}}',
    html: function (o) {
      var app = getP(o, "app", o.lines[0] || "SHORTSCRAFT");
      var icon = getP(o, "icon", "⚡");
      var time = getP(o, "time", "now");
      var body = getP(o, "body", o.lines[1] || "Your 4K Short is ready to post 🚀");
      return '<div class="sc-notify-wrap">'
        + '<div class="sc-notify-time">9:41</div>'
        + '<div class="sc-notify-card">'
        + '<div class="sc-notify-ico">' + renderAvatar(icon, "⚡") + '</div>'
        + '<div style="flex:1">'
        + '<div style="display:flex;justify-content:space-between;font-size:2.8cqw;font-weight:700;color:rgba(255,255,255,.6)"><span>' + esc(app) + '</span><span>' + esc(time) + '</span></div>'
        + '<div style="font-size:4cqw;font-weight:700;color:#fff;margin-top:.6cqh">' + esc(body) + '</div>'
        + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* 6.2 Safari Browser Scroll */
  T["ui-safari-scroll"] = {
    name: "Safari Window 3D", cat: "ui", dark: true, accent: "#38bdf8",
    desc: "macOS Safari browser window with URL bar, tabs, and hero webpage scroll",
    css: '.sc-safari-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:6cqw;background:radial-gradient(ellipse at 50% 50%,#091a33 0%,#030914 100%);overflow:hidden;font-family:Inter,sans-serif;perspective:900px}'
      + '.sc-safari-win{background:#111827;border:1px solid rgba(255,255,255,.15);border-radius:4cqw;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.9),0 0 30px rgba(56,189,248,.2);transform-style:preserve-3d;transform:rotateX(12deg) rotateY(-8deg);animation:safariFloat 6s ease-in-out infinite alternate}'
      + '.sc-safari-top{display:flex;align-items:center;gap:2cqw;padding:2.5cqw 4cqw;background:#1f2937;border-bottom:1px solid rgba(255,255,255,.08)}'
      + '.sc-safari-dot{width:2.4cqw;height:2.4cqw;border-radius:50%}'
      + '.sc-safari-body{padding:8cqw 6cqw;text-align:center;background:linear-gradient(180deg,#111827 0%,#0b0f19 100%)}'
      + '.sc-safari-title{font-size:7.2cqw;font-weight:900;color:#fff;letter-spacing:-.03em;line-height:1.15}'
      + '@keyframes safariFloat{0%{transform:rotateX(10deg) rotateY(-6deg)}100%{transform:rotateX(15deg) rotateY(-10deg) translateY(-1.5cqh)}}',
    html: function (o) {
      return '<div class="sc-safari-wrap">'
        + '<div class="sc-safari-win">'
        + '<div class="sc-safari-top">'
        + '<div class="sc-safari-dot" style="background:#ef4444"></div>'
        + '<div class="sc-safari-dot" style="background:#f59e0b"></div>'
        + '<div class="sc-safari-dot" style="background:#10b981"></div>'
        + '<div style="flex:1;background:#111827;border-radius:99px;font-size:2.6cqw;color:var(--dim);text-align:center;padding:1cqw;border:1px solid rgba(255,255,255,.08)">https://shortscraft.online</div>'
        + '</div>'
        + '<div class="sc-safari-body">'
        + '<div class="sc-safari-title">' + esc(o.lines[0] || "AI Motion Graphics Studio") + '</div>'
        + '<div style="font-size:3.6cqw;color:#38bdf8;font-weight:700;margin-top:1.5cqh">' + esc(o.lines[1] || "Create Viral Animations in 60s") + '</div>'
        + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* 6.3 Google Search Autocomplete */
  T["ui-google-search"] = {
    name: "Google Search Suggest", cat: "ui", dark: false, accent: "#4285f4",
    desc: "Google search bar typing query with instant autocomplete dropdown",
    css: '.ui-sch{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:8cqw;background:#ffffff;color:#202124}.ui-sch .bar{display:flex;align-items:center;gap:3cqw;border:1px solid #dfe1e5;border-radius:99px;padding:3.2cqw 6cqw;box-shadow:0 1px 6px rgba(32,33,36,.28);opacity:0;transform:translateY(-1cqh);animation:schBarIn var(--D) var(--sp) infinite}.ui-sch .bar b{position:relative;padding-right:1cqw}.ui-sch .bar b::after{content:"";position:absolute;right:-.4cqw;top:.3cqh;width:.5cqw;height:4.2cqw;background:#4285f4;animation:schCaret calc(var(--D) / 8) steps(1) infinite}.ui-sch .drop{border:1px solid #dfe1e5;border-radius:3cqw;padding:4cqw;margin-top:2cqh;box-shadow:0 4px 12px rgba(0,0,0,.1);opacity:0;transform:translateY(-1cqh);animation:schDropIn var(--D) var(--sp) infinite}@keyframes schBarIn{0%,5%{opacity:0;transform:translateY(-1cqh)}20%,100%{opacity:1;transform:translateY(0)}}@keyframes schCaret{0%,50%{opacity:1}50.01%,100%{opacity:0}}@keyframes schDropIn{0%,32%{opacity:0;transform:translateY(-1cqh)}48%,100%{opacity:1;transform:translateY(0)}}',
    html: function (o) {
      return '<div class="ui-sch"><div class="bar"><span style="font-size:4cqw">🔍</span><b style="font-size:4cqw">' + esc(o.lines[0] || "how to make viral motion graphics") + '</b></div><div class="drop"><div style="font-size:3.4cqw;padding:1.5cqw 0">↳ <b>shortscraft.online</b> (best AI generator)</div></div></div>';
    }
  };

  /* 6.4 iMessage Thread */
  T["ui-imessage"] = {
    name: "iMessage Chat Thread", cat: "ui", dark: true, accent: "#3b82f6",
    desc: "Interactive chat message bubbles typing with 3-dot animation and reply",
    css: '.im{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:8cqw 6cqw}.im .bubble{max-width:75%;padding:3.2cqw 4.6cqw;border-radius:4.4cqw;font-size:3.8cqw;line-height:1.4;margin-bottom:2cqh;opacity:0;transform:translateY(1cqh) scale(.9)}.im .in{background:rgba(255,255,255,.14);color:#fff;border-bottom-left-radius:1cqw;align-self:flex-start;animation:imIn var(--D) var(--sp) infinite}.im .out{background:var(--ac);color:#fff;border-bottom-right-radius:1cqw;align-self:flex-end;animation:imOut var(--D) var(--sp) infinite}.im .dots{display:inline-flex;gap:.8cqw;padding:2.6cqw 3.6cqw;background:rgba(255,255,255,.14);border-radius:4.4cqw;border-bottom-left-radius:1cqw;align-self:flex-start;margin-bottom:2cqh;opacity:0;animation:imDots var(--D) linear infinite}.im .dots span{width:1.6cqw;height:1.6cqw;border-radius:50%;background:rgba(255,255,255,.7);display:inline-block;animation:imDotBounce .9s ease-in-out infinite}.im .dots span:nth-child(2){animation-delay:.15s}.im .dots span:nth-child(3){animation-delay:.3s}@keyframes imDotBounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-.7cqh)}}@keyframes imIn{0%,4%{opacity:0;transform:translateY(1cqh) scale(.9)}16%,100%{opacity:1;transform:translateY(0) scale(1)}}@keyframes imDots{0%,20%{opacity:0}26%,54%{opacity:1}60%,100%{opacity:0}}@keyframes imOut{0%,58%{opacity:0;transform:translateY(1cqh) scale(.9)}72%,100%{opacity:1;transform:translateY(0) scale(1)}}',
    html: function (o) {
      var inMsg = getP(o, "inMsg", o.lines[0] || "How did you get 1M views?!");
      var outMsg = getP(o, "outMsg", o.lines[1] || "Used ShortsCraft motion graphics! ⚡");
      var bubbleColor = getP(o, "bubbleColor", "#3b82f6");
      return '<div class="im"><div class="bubble in">' + esc(inMsg) + '</div><div class="dots"><span></span><span></span><span></span></div><div class="bubble out" style="background:' + esc(bubbleColor) + '">' + esc(outMsg) + '</div></div>';
    }
  };

  /* 6.5 Glow Toggle */
  T["ui-toggle"] = {
    name: "Glow Toggle", cat: "ui", dark: true, accent: "#00ffaa",
    desc: "Neon toggle switch with smooth spring translation, glowing ambient aura, and tactile status toggle",
    css: '.sc-toggle-wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#040608;font-family:Inter,sans-serif;overflow:hidden}.sc-toggle-glow{position:absolute;width:60cqw;height:60cqw;border-radius:50%;background:radial-gradient(circle,var(--ac) 0%,transparent 70%);opacity:.3;filter:blur(6cqw);pointer-events:none}.sc-toggle-title{font-size:3.2cqw;letter-spacing:.3em;color:rgba(255,255,255,.4);text-transform:uppercase;margin-bottom:3cqh;font-weight:700}.sc-toggle-track{width:42cqw;height:23cqw;border-radius:99px;background:rgba(0,255,170,.15);border:2px solid var(--ac);box-shadow:0 0 5cqw rgba(0,255,170,.4),inset 0 0 2cqw rgba(0,255,170,.2);position:relative;padding:1.5cqw;display:flex;align-items:center}.sc-toggle-knob{width:18cqw;height:18cqw;border-radius:50%;background:#fff;box-shadow:0 0 3cqw #fff,0 1cqw 3cqw rgba(0,0,0,.5);position:absolute;right:1.5cqw;display:grid;place-items:center;font-size:5cqw;animation:knobSlide var(--D) cubic-bezier(.16,1,.3,1) infinite}.sc-toggle-status{margin-top:3.5cqh;font-size:4.2cqw;font-weight:800;letter-spacing:.15em;color:var(--ac);text-shadow:0 0 2cqw var(--ac)}@keyframes knobSlide{0%,20%{transform:translateX(-19cqw)}40%,85%{transform:translateX(0)}100%{transform:translateX(-19cqw)}}',
    html: function (o) {
      var title = getP(o, "title", "VIRAL ENGINE");
      var status = getP(o, "status", o.lines[0] || "ACTIVE // 60 FPS");
      var accentColor = getP(o, "accentColor", "#00ffaa");
      return '<div class="sc-toggle-wrap" style="--ac:' + esc(accentColor) + '">'
        + '<div class="sc-toggle-glow"></div>'
        + '<div class="sc-toggle-title">' + esc(title) + '</div>'
        + '<div class="sc-toggle-track">'
        + '<div class="sc-toggle-knob">⚡</div>'
        + '</div>'
        + '<div class="sc-toggle-status">' + esc(status) + '</div>'
        + '</div>';
    },
    reactCode: `function Scene(props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const title = (props && props.title) || "VIRAL ENGINE";
  const statusOn = (props && props.statusOn) || "ACTIVE // 60 FPS";
  const statusOff = (props && props.statusOff) || "STANDBY";
  const accentColor = (props && props.accentColor) || "#00ffaa";

  const isToggled = (frame % 90) > 30;
  const toggleProgress = spring({
    frame: (frame % 90) > 30 ? (frame % 90) - 30 : (frame % 90),
    fps,
    config: { damping: 14, stiffness: 140, mass: 0.9 }
  });

  const knobX = isToggled ? interpolate(toggleProgress, [0, 1], [0, 68]) : interpolate(toggleProgress, [0, 1], [68, 0]);
  const glowOpacity = isToggled ? interpolate(toggleProgress, [0, 1], [0.2, 0.85]) : interpolate(toggleProgress, [0, 1], [0.85, 0.2]);

  return (
    <AbsoluteFill style={{
      backgroundColor: '#040608',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <div style={{
        position: 'absolute',
        width: 320,
        height: 320,
        borderRadius: '50%',
        background: "radial-gradient(circle, " + accentColor + " 0%, transparent 70%)",
        opacity: glowOpacity * 0.4,
        filter: 'blur(50px)',
        pointerEvents: 'none'
      }} />

      <div style={{
        fontSize: 14,
        letterSpacing: '0.3em',
        color: 'rgba(255,255,255,0.4)',
        textTransform: 'uppercase',
        marginBottom: 24,
        fontWeight: 700
      }}>
        {title}
      </div>

      <div style={{
        width: 148,
        height: 80,
        borderRadius: 40,
        backgroundColor: isToggled ? 'rgba(0,255,170,0.15)' : 'rgba(255,255,255,0.06)',
        border: "2px solid " + (isToggled ? accentColor : 'rgba(255,255,255,0.18)'),
        boxShadow: isToggled ? ("0 0 35px " + accentColor + "66, inset 0 0 15px " + accentColor + "33") : 'none',
        position: 'relative',
        padding: 6,
        display: 'flex',
        alignItems: 'center'
      }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          backgroundColor: '#ffffff',
          boxShadow: isToggled ? "0 0 20px #ffffff, 0 4px 12px rgba(0,0,0,0.5)" : '0 4px 12px rgba(0,0,0,0.5)',
          transform: "translateX(" + knobX + "px)",
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22
        }}>
          {isToggled ? '⚡' : '○'}
        </div>
      </div>

      <div style={{
        marginTop: 28,
        fontSize: 18,
        fontWeight: 800,
        letterSpacing: '0.15em',
        color: isToggled ? accentColor : 'rgba(255,255,255,0.4)',
        textShadow: isToggled ? ("0 0 15px " + accentColor + "88") : 'none'
      }}>
        {isToggled ? statusOn : statusOff}
      </div>
    </AbsoluteFill>
  );
}`
  };

  /* 6.6 Liquid Fluid Morphing Blob */
  T["ui-slider"] = {
    name: "Liquid Morphing Fluid Blob", cat: "ui", dark: true, accent: "#ff0080",
    desc: "Organic fluid SVG metaball blob morphing smoothly with glassmorphism glow and floating typography",
    css: '.sc-blob-wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#09090b;overflow:hidden;font-family:Space Grotesk,sans-serif}.sc-blob-bg{position:absolute;width:76cqw;height:76cqw;background:linear-gradient(135deg,#7928ca,#ff0080,#00dfd8);border-radius:42% 58% 70% 30% / 45% 45% 55% 55%;filter:blur(3cqw);opacity:.85;box-shadow:0 0 12cqw rgba(121,40,202,.6);animation:morphBlob 6s ease-in-out infinite alternate}.sc-blob-card{position:relative;z-index:2;background:rgba(255,255,255,.05);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.18);padding:8cqw 6cqw;border-radius:4cqw;text-align:center;box-shadow:0 4cqw 10cqw rgba(0,0,0,.7);animation:blobFloat 3s ease-in-out infinite alternate}.sc-blob-title{font-size:13cqw;font-weight:900;color:#fff;letter-spacing:-.04em;line-height:1;text-shadow:0 .4cqw 2cqw rgba(0,0,0,.5)}.sc-blob-sub{font-size:3.8cqw;color:rgba(255,255,255,.8);margin-top:2cqh;font-weight:500;letter-spacing:.05em}@keyframes morphBlob{0%{border-radius:42% 58% 70% 30% / 45% 45% 55% 55%;transform:rotate(0deg) scale(1)}50%{border-radius:70% 30% 46% 54% / 30% 60% 40% 70%;transform:rotate(90deg) scale(1.1)}100%{border-radius:100% 60% 60% 100% / 100% 100% 60% 60%;transform:rotate(180deg) scale(1.05)}}@keyframes blobFloat{0%{transform:translateY(0) scale(1)}100%{transform:translateY(-2cqh) scale(1.02)}}',
    html: function (o) {
      var title = getP(o, "title", o.lines[0] || "SWISHY");
      var sub = getP(o, "sub", o.lines[1] || "Fluid Motion Design Reimagined");
      var blobGradient = getP(o, "blobGradient", "linear-gradient(135deg,#7928ca,#ff0080,#00dfd8)");
      return '<div class="sc-blob-wrap">'
        + '<div class="sc-blob-bg" style="background:' + esc(blobGradient) + '"></div>'
        + '<div class="sc-blob-card">'
        + '<h1 class="sc-blob-title">' + esc(title) + '</h1>'
        + '<div class="sc-blob-sub">' + esc(sub) + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* 6.7 Phone Mockup Scroll */
  T["ui-phone-mockup"] = {
    name: "Smartphone 9:16 Feed", cat: "ui", dark: true, accent: "#7952ff",
    desc: "Realistic 3D titanium iPhone frame with Dynamic Island and smooth feed animations",
    css: '.sc-phone-wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4cqw;background:radial-gradient(ellipse at 50% 50%,#18152e 0%,#08080f 100%);overflow:hidden;font-family:Inter,sans-serif;color:#fff;perspective:1000px}'
      + '.sc-phone-glow{position:absolute;width:65cqw;height:65cqh;border-radius:50%;background:radial-gradient(circle,rgba(121,82,255,.35) 0%,transparent 70%);filter:blur(35px);pointer-events:none}'
      + '.sc-phone-device{position:relative;width:62cqw;height:78cqh;border-radius:9cqw;background:#0d0d14;border:4px solid #3b3952;box-shadow:0 30px 80px rgba(0,0,0,.9),0 0 35px rgba(121,82,255,.25),inset 0 0 4px rgba(255,255,255,.2);display:flex;flex-direction:column;align-items:center;padding:2.5cqw;transform-style:preserve-3d;transform:rotateX(14deg) rotateY(-10deg) rotateZ(2deg);animation:phoneFloat 6s ease-in-out infinite alternate}'
      + '.sc-phone-screen{width:100%;height:100%;border-radius:7cqw;background:#000;overflow:hidden;display:flex;flex-direction:column;position:relative;border:1px solid rgba(255,255,255,.08)}'
      + '.sc-phone-island{position:absolute;top:1.8cqh;left:50%;transform:translateX(-50%);width:24cqw;height:3.8cqh;border-radius:99px;background:#000;border:1px solid rgba(255,255,255,.15);display:flex;align-items:center;justify-content:space-between;padding:0 2.5cqw;z-index:10;box-shadow:0 2px 10px rgba(0,0,0,.8)}'
      + '.sc-island-dot{width:1.8cqw;height:1.8cqw;border-radius:50%;background:#22c55e;box-shadow:0 0 8px #22c55e}'
      + '.sc-island-wave{display:flex;gap:2px;align-items:center;height:1.8cqh}'
      + '.sc-island-wave span{width:2px;height:100%;background:#7952ff;border-radius:1px;animation:islandWave .8s ease-in-out infinite alternate}'
      + '.sc-phone-content{padding:7cqh 4cqw 3cqw;display:flex;flex-direction:column;justify-content:space-between;height:100%}'
      + '.sc-phone-card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:4cqw;padding:4cqw;backdrop-filter:blur(16px);animation:phoneCardPop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-phone-title{font-size:5cqw;font-weight:900;line-height:1.2;color:#fff;margin-bottom:1.5cqh}'
      + '.sc-phone-author{display:flex;align-items:center;gap:2.5cqw;font-size:3.4cqw;color:var(--dim)}'
      + '.sc-phone-av{width:7cqw;height:7cqw;border-radius:50%;background:linear-gradient(135deg,#7952ff,#00d2ff);display:grid;place-items:center;font-size:3.5cqw;font-weight:900;color:#fff}'
      + '.sc-phone-actions{display:flex;gap:3cqw;margin-top:2cqh}'
      + '.sc-phone-btn{padding:.8cqh 3cqw;border-radius:99px;background:rgba(255,255,255,.08);font-size:3cqw;font-weight:700;color:#e2e8f0;display:flex;align-items:center;gap:1.5cqw}'
      + '@keyframes phoneFloat{0%{transform:rotateX(12deg) rotateY(-8deg) translateY(0)}100%{transform:rotateX(16deg) rotateY(-12deg) translateY(-2cqh)}}'
      + '@keyframes islandWave{0%{height:30%}100%{height:100%}}'
      + '@keyframes phoneCardPop{0%,15%{transform:translateY(4cqh);opacity:0}28%,85%{transform:translateY(0);opacity:1}100%{transform:translateY(-2cqh);opacity:0}}',
    html: function (o) {
      var title = getP(o, "title", o.lines[0] || "How to 10X Retention");
      var author = getP(o, "author", "@creator_pro");
      return '<div class="sc-phone-wrap">'
        + '<div class="sc-phone-glow"></div>'
        + '<div class="sc-phone-device">'
        + '<div class="sc-phone-screen">'
        + '<div class="sc-phone-island">'
        + '<div class="sc-island-dot"></div>'
        + '<div class="sc-island-wave"><span></span><span style="animation-delay:.2s"></span><span style="animation-delay:.4s"></span></div>'
        + '</div>'
        + '<div class="sc-phone-content">'
        + '<div class="sc-phone-card">'
        + '<div class="sc-phone-title">' + esc(title) + '</div>'
        + '<div class="sc-phone-author"><div class="sc-phone-av">✦</div><span>' + esc(author) + '</span></div>'
        + '<div class="sc-phone-actions">'
        + '<span class="sc-phone-btn">❤️ 42.8K</span>'
        + '<span class="sc-phone-btn">💬 1.2K</span>'
        + '</div>'
        + '</div>'
        + '</div>'
        + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* 6.8 Apple iOS Settings & Widget Cascade */
  T["ui-tabs"] = {
    name: "Apple iOS App List", cat: "ui", dark: true, accent: "#007aff",
    desc: "Cascading Apple iOS settings and widgets list with smooth spring reveal and app icons",
    css: '.sc-ios-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:6cqw;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,sans-serif}.sc-ios-sheet{width:86cqw;background:#ffffff;color:#000000;border-radius:5cqw;padding:6cqw;box-shadow:0 4cqw 14cqw rgba(0,0,0,.85);animation:iosPop var(--D) cubic-bezier(.16,1,.3,1) infinite}.sc-ios-hdr{display:flex;align-items:center;gap:3cqw;margin-bottom:3cqh}.sc-ios-av{width:11cqw;height:11cqw;border-radius:50%;background:#e4e4e7;display:grid;place-items:center;font-size:5cqw}.sc-ios-title{font-size:4.8cqw;font-weight:800}.sc-ios-list{display:flex;flex-direction:column;gap:1.5cqh}.sc-ios-item{display:flex;align-items:center;justify-content:space-between;padding:2cqh 3cqw;background:#f4f4f5;border-radius:3cqw}.sc-ios-left{display:flex;align-items:center;gap:3cqw}.sc-ios-icon{width:8cqw;height:8cqw;border-radius:2cqw;display:grid;place-items:center;font-size:4cqw}.sc-ios-name{font-size:3.6cqw;font-weight:700}.sc-ios-sub{font-size:2.6cqw;color:#71717a}.sc-ios-chevron{color:#a1a1aa;font-size:4cqw}@keyframes iosPop{0%,15%{transform:scale(.88) translateY(3cqh);opacity:0}30%,85%{transform:scale(1) translateY(0);opacity:1}100%{transform:scale(1.04);opacity:0}}',
    html: function (o) {
      var user = getP(o, "user", o.lines[0] || "ShortsCraft Apps");
      var a1 = getP(o, "app1", "Calendar · 2 upcoming events");
      var a2 = getP(o, "app2", "Photos · 128 memories");
      var a3 = getP(o, "app3", "Music · Now playing");
      var a4 = getP(o, "app4", "Fitness · Goal 10,000 steps");
      return '<div class="sc-ios-wrap">'
        + '<div class="sc-ios-sheet">'
        + '<div class="sc-ios-hdr">'
        + '<div class="sc-ios-av">👤</div>'
        + '<div class="sc-ios-title">' + esc(user) + '</div>'
        + '</div>'
        + '<div class="sc-ios-list">'
        + '<div class="sc-ios-item"><div class="sc-ios-left"><div class="sc-ios-icon" style="background:#fee2e2">📅</div><div><div class="sc-ios-name">Calendar</div><div class="sc-ios-sub">' + esc(a1) + '</div></div></div><span class="sc-ios-chevron">›</span></div>'
        + '<div class="sc-ios-item"><div class="sc-ios-left"><div class="sc-ios-icon" style="background:#e0e7ff">📸</div><div><div class="sc-ios-name">Photos</div><div class="sc-ios-sub">' + esc(a2) + '</div></div></div><span class="sc-ios-chevron">›</span></div>'
        + '<div class="sc-ios-item"><div class="sc-ios-left"><div class="sc-ios-icon" style="background:#fce7f3">🎵</div><div><div class="sc-ios-name">Music</div><div class="sc-ios-sub">' + esc(a3) + '</div></div></div><span class="sc-ios-chevron">›</span></div>'
        + '<div class="sc-ios-item"><div class="sc-ios-left"><div class="sc-ios-icon" style="background:#dcfce7">🏃</div><div><div class="sc-ios-name">Fitness</div><div class="sc-ios-sub">' + esc(a4) + '</div></div></div><span class="sc-ios-chevron">›</span></div>'
        + '</div>'
        + '</div>'
        + '</div>';
    },
    reactCode: `function Scene(props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = props || {};
  const user = p.user || 'ShortsCraft Apps';
  const a1 = p.app1 || 'Calendar · 2 upcoming events';
  const a2 = p.app2 || 'Photos · 128 memories';
  const a3 = p.app3 || 'Music · Now playing';
  const a4 = p.app4 || 'Fitness · Goal 10,000 steps';

  const pop = spring({ frame, fps, config: { damping: 15, stiffness: 90 } });
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      backgroundColor: '#09090b',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '6%',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      <div style={{
        width: '90%',
        backgroundColor: '#ffffff',
        color: '#000000',
        borderRadius: 24,
        padding: '24px 20px',
        boxShadow: '0 30px 80px rgba(0,0,0,0.85)',
        transform: "scale(" + pop + ")",
        opacity: opacity
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            backgroundColor: '#e4e4e7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20
          }}>
            👤
          </div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{user}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            backgroundColor: '#f4f4f5',
            borderRadius: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16
              }}>
                📅
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Calendar</div>
                <div style={{ fontSize: 11, color: '#71717a' }}>{a1}</div>
              </div>
            </div>
            <span style={{ color: '#a1a1aa', fontSize: 16 }}>›</span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            backgroundColor: '#f4f4f5',
            borderRadius: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: '#e0e7ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16
              }}>
                📸
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Photos</div>
                <div style={{ fontSize: 11, color: '#71717a' }}>{a2}</div>
              </div>
            </div>
            <span style={{ color: '#a1a1aa', fontSize: 16 }}>›</span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            backgroundColor: '#f4f4f5',
            borderRadius: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: '#fce7f3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16
              }}>
                🎵
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Music</div>
                <div style={{ fontSize: 11, color: '#71717a' }}>{a3}</div>
              </div>
            </div>
            <span style={{ color: '#a1a1aa', fontSize: 16 }}>›</span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            backgroundColor: '#f4f4f5',
            borderRadius: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: '#dcfce7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16
              }}>
                🏃
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Fitness</div>
                <div style={{ fontSize: 11, color: '#71717a' }}>{a4}</div>
              </div>
            </div>
            <span style={{ color: '#a1a1aa', fontSize: 16 }}>›</span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}`
  };

  /* 6.9 OTP Passcode */
  T["ui-otp"] = {
    name: "OTP Passcode Security", cat: "ui", dark: true, accent: "#22c55e",
    desc: "4-digit security OTP PIN boxes auto-populating and turning verified green",
    css: '.otp{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:8cqw}.otp h3{opacity:0;transform:translateY(.6cqh);animation:otpTitle var(--D) var(--sp) infinite}.otp .row{display:flex;gap:3cqw}.otp .box{opacity:0;transform:translateY(1cqh) scale(.6);animation:otpBox var(--D) var(--ov) infinite,otpGlow calc(var(--D) / 4) ease-in-out infinite alternate}.otp .box:nth-child(2){animation-delay:90ms,90ms}.otp .box:nth-child(3){animation-delay:180ms,180ms}.otp .box:nth-child(4){animation-delay:270ms,270ms}@keyframes otpTitle{0%,4%{opacity:0;transform:translateY(.6cqh)}18%,100%{opacity:1;transform:translateY(0)}}@keyframes otpBox{0%{opacity:0;transform:translateY(1cqh) scale(.6)}55%{opacity:1;transform:translateY(0) scale(1.15)}68%,100%{opacity:1;transform:translateY(0) scale(1)}}@keyframes otpGlow{0%{box-shadow:0 0 0 rgba(34,197,94,0)}100%{box-shadow:0 0 2.2cqw rgba(34,197,94,.6)}}',
    html: function (o) {
      return '<div class="otp"><h3 style="font-size:5.6cqw;font-weight:800;color:#fff;margin-bottom:3cqh">' + esc(o.lines[0] || "Security Code Verified") + '</h3><div class="row"><div class="box" style="width:14cqw;height:16cqw;border-radius:3cqw;border:2px solid #22c55e;color:#22c55e;font-size:8cqw;font-weight:900;display:grid;place-items:center">9</div><div class="box" style="width:14cqw;height:16cqw;border-radius:3cqw;border:2px solid #22c55e;color:#22c55e;font-size:8cqw;font-weight:900;display:grid;place-items:center">4</div><div class="box" style="width:14cqw;height:16cqw;border-radius:3cqw;border:2px solid #22c55e;color:#22c55e;font-size:8cqw;font-weight:900;display:grid;place-items:center">2</div><div class="box" style="width:14cqw;height:16cqw;border-radius:3cqw;border:2px solid #22c55e;color:#22c55e;font-size:8cqw;font-weight:900;display:grid;place-items:center">0</div></div></div>';
    }
  };

  /* 6.10 App Store Rating */
  T["ui-store-badges"] = {
    name: "5-Star Rating Badges", cat: "ui", dark: true, accent: "#ffd700",
    desc: "Official App Store & Google Play badges with glowing 5-star rating",
    css: '.asb{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:8cqw;text-align:center}.asb .stars{display:flex;gap:.6cqw;margin-bottom:2cqh}.asb .stars span{font-size:7cqw;color:#ffd700;opacity:0;transform:scale(0) rotate(-90deg);display:inline-block;animation:starPop var(--D) var(--ov) infinite}.asb .stars span:nth-child(2){animation-delay:90ms}.asb .stars span:nth-child(3){animation-delay:180ms}.asb .stars span:nth-child(4){animation-delay:270ms}.asb .stars span:nth-child(5){animation-delay:360ms}.asb h2{opacity:0;transform:translateY(1cqh);animation:asbH2 var(--D) var(--sp) infinite,asbGlow calc(var(--D) / 3) ease-in-out infinite alternate}@keyframes starPop{0%{opacity:0;transform:scale(0) rotate(-90deg)}60%{opacity:1;transform:scale(1.3) rotate(8deg)}75%,100%{opacity:1;transform:scale(1) rotate(0)}}@keyframes asbH2{0%,40%{opacity:0;transform:translateY(1cqh)}56%,100%{opacity:1;transform:translateY(0)}}@keyframes asbGlow{0%{text-shadow:0 0 0 rgba(255,215,0,0)}100%{text-shadow:0 0 2cqw rgba(255,215,0,.55)}}',
    html: function (o) {
      return '<div class="asb"><div class="stars"><span>★</span><span>★</span><span>★</span><span>★</span><span>★</span></div><h2 style="font-size:8cqw;font-weight:900;color:#fff">' + esc(o.lines[0] || "5.0 Rated by 100K+ Creators") + '</h2></div>';
    }
  };

  /* ============================================================
     CATEGORY 7: SOCIAL PROOF & VIRAL (10 templates)
     ============================================================ */

  /* 7.1 Viral Tweet Card */
  T["social-tweet-card"] = {
    name: "Viral Tweet / X Card", cat: "social", dark: true, accent: "#1d9bf0",
    desc: "Dark mode X / Twitter viral post card with avatar, badge, and metrics",
    css: '.sc-twt{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:8cqw}.sc-twt .card{border-radius:4cqw;padding:6cqw;box-shadow:0 3cqw 8cqw rgba(0,0,0,.8);transition:background .2s;opacity:0;transform:translateY(2cqh) scale(.94);animation:twtIn var(--D) var(--sp) infinite}.sc-twt .head{display:flex;gap:3cqw;align-items:center;margin-bottom:2cqh}.sc-twt .av{width:11cqw;height:11cqw;border-radius:50%;background:#1d9bf0;display:grid;place-items:center;font-size:5cqw;color:#fff;font-weight:900;overflow:hidden;flex-shrink:0;animation:twtAvPulse calc(var(--D) / 3) ease-in-out infinite alternate}.sc-twt .txt{font-size:4.4cqw;line-height:1.4;margin-bottom:3cqh;word-break:break-word}.sc-twt .stats{display:flex;justify-content:space-between;font-size:3.2cqw;color:#71767b;border-top:1px solid rgba(255,255,255,.1);padding-top:2cqh}.sc-twt .stats span{opacity:0;animation:twtS1 var(--D) var(--sp) infinite}.sc-twt .stats span:nth-child(2){animation-name:twtS2}.sc-twt .stats span:nth-child(3){animation-name:twtS3}@keyframes twtIn{0%,6%{opacity:0;transform:translateY(2cqh) scale(.94)}22%,100%{opacity:1;transform:translateY(0) scale(1)}}@keyframes twtAvPulse{0%{box-shadow:0 0 0 rgba(29,155,240,0)}100%{box-shadow:0 0 1.6cqw rgba(29,155,240,.7)}}@keyframes twtS1{0%,26%{opacity:0}34%,100%{opacity:1}}@keyframes twtS2{0%,32%{opacity:0}40%,100%{opacity:1}}@keyframes twtS3{0%,38%{opacity:0}46%,100%{opacity:1}}',
    html: function (o) {
      var name = getP(o, "name", o.lines[0] || "Creator Insights");
      var handle = getP(o, "handle", "@creatorgrowth");
      var verified = getP(o, "verified", true);
      var avatar = getP(o, "avatar", "✦");
      var body = getP(o, "body", o.lines[1] || "The top 1% of creators use motion graphics to double their retention.");
      var comments = getP(o, "comments", "1.4K");
      var retweets = getP(o, "retweets", "8.9K");
      var likes = getP(o, "likes", "42.5K");
      var cardBg = getP(o, "cardBg", "#000000");
      var isLight = cardBg === "#ffffff" || cardBg === "#fafafa" || cardBg === "#f4f4f5";
      var textColor = isLight ? "#0f1419" : "#e7e9ea";
      var borderColor = isLight ? "#cfd9de" : "#2f3336";
      var statsColor = isLight ? "#536471" : "#71767b";

      return '<div class="sc-twt">'
        + '<div class="card" style="background:' + esc(cardBg) + ';border:1px solid ' + esc(borderColor) + '">'
        + '<div class="head">'
        + '<div class="av">' + renderAvatar(avatar, "✦") + '</div>'
        + '<div>'
        + '<b style="font-size:3.8cqw;color:' + (isLight ? "#0f1419" : "#fff") + '">' + esc(name) + (verified ? ' <span style="color:#1d9bf0">✓</span>' : '') + '</b>'
        + '<div style="font-size:2.8cqw;color:' + esc(statsColor) + '">' + esc(handle) + '</div>'
        + '</div>'
        + '</div>'
        + '<div class="txt" style="color:' + esc(textColor) + '">' + esc(body) + '</div>'
        + '<div class="stats" style="color:' + esc(statsColor) + ';border-top-color:' + esc(borderColor) + '">'
        + '<span>💬 ' + esc(comments) + '</span>'
        + '<span>🔄 ' + esc(retweets) + '</span>'
        + '<span style="color:#f91880">❤️ ' + esc(likes) + '</span>'
        + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* 7.2 Like Heart Burst */
  T["social-like-burst"] = {
    name: "Like Heart Burst", cat: "social", dark: true, accent: "#ff3b5c",
    desc: "Heart burst like button with radial particle spark explosion and counter",
    css: '.sc-like-wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8cqw;background:radial-gradient(ellipse at 50% 50%,#260814 0%,#090306 100%);overflow:hidden;font-family:Inter,sans-serif;color:#fff}'
      + '.sc-like-stage{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center}'
      + '.sc-like-ring{position:absolute;width:28cqw;height:28cqw;border-radius:50%;border:2px solid #ff3b5c;animation:likeShockwave var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-like-heart{font-size:22cqw;filter:drop-shadow(0 0 30px rgba(255,59,92,.8));animation:likeHeartPop var(--D) cubic-bezier(.175,.885,.32,1.275) infinite}'
      + '.sc-like-info{margin-top:3cqh;text-align:center;animation:likeTextPop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-like-num{font-family:"Space Grotesk",sans-serif;font-size:13.5cqw;font-weight:900;letter-spacing:-.03em;color:#fff;text-shadow:0 0 25px rgba(255,59,92,.5)}'
      + '.sc-like-sub{font-size:3.4cqw;letter-spacing:.22em;text-transform:uppercase;color:#fda4af;font-weight:700;margin-top:.8cqh}'
      + '@keyframes likeHeartPop{0%,12%{transform:scale(0);opacity:0}24%{transform:scale(1.25);opacity:1}32%,85%{transform:scale(1);opacity:1}100%{transform:scale(0.85);opacity:0}}'
      + '@keyframes likeShockwave{0%,18%{transform:scale(.3);opacity:0}28%{transform:scale(1.8);opacity:1}38%,85%{transform:scale(2.2);opacity:0}100%{opacity:0}}'
      + '@keyframes likeTextPop{0%,20%{transform:translateY(2cqh);opacity:0}32%,85%{transform:translateY(0);opacity:1}100%{transform:translateY(-1cqh);opacity:0}}',
    html: function (o) {
      var count = getP(o, "count", o.lines[0] || "1,248,000");
      var label = getP(o, "label", o.lines[1] || "Likes & Shares");
      var icon = getP(o, "icon", "❤️");
      return '<div class="sc-like-wrap">'
        + '<div class="sc-like-stage">'
        + '<div class="sc-like-ring"></div>'
        + '<div class="sc-like-heart">' + esc(icon) + '</div>'
        + '<div class="sc-like-info">'
        + '<div class="sc-like-num">' + esc(count) + '</div>'
        + '<div class="sc-like-sub">' + esc(label) + '</div>'
        + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* 7.3 Subscribe & Bell Ring */
  T["social-sub-bell"] = {
    name: "YouTube Subscribe Bell", cat: "social", dark: true, accent: "#ff0000",
    desc: "YouTube Subscribe button turning to Subscribed with ringing bell and spark burst",
    css: '.sc-sub-wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8cqw;background:radial-gradient(ellipse at 50% 50%,#240909 0%,#090303 100%);overflow:hidden;font-family:Inter,sans-serif;color:#fff}'
      + '.sc-sub-cta{font-size:7.2cqw;font-weight:900;text-align:center;letter-spacing:-.03em;line-height:1.2;margin-bottom:3.5cqh;animation:subCtaDrop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-sub-pill{position:relative;padding:3.8cqw 7cqw;border-radius:999px;background:#ff0000;color:#fff;font-size:4.8cqw;font-weight:800;display:flex;align-items:center;gap:3cqw;box-shadow:0 12px 35px rgba(255,0,0,.45),0 0 20px rgba(255,0,0,.3);cursor:pointer;animation:subBtnTransform var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-sub-av{width:6.8cqw;height:6.8cqw;border-radius:50%;background:#fff;color:#ff0000;display:grid;place-items:center;font-size:3.6cqw;font-weight:900}'
      + '.sc-sub-bell{font-size:5.4cqw;animation:bellRinging 1.5s ease-in-out infinite}'
      + '@keyframes subCtaDrop{0%,12%{transform:translateY(-2cqh);opacity:0}24%,85%{transform:translateY(0);opacity:1}100%{transform:translateY(1cqh);opacity:0}}'
      + '@keyframes subBtnTransform{0%,16%{transform:scale(.85);opacity:0}28%{transform:scale(1.08);background:#ff0000;box-shadow:0 0 40px rgba(255,0,0,.8)}45%,85%{transform:scale(1);background:#27272a;box-shadow:0 4px 18px rgba(0,0,0,.6)}100%{transform:scale(.95);opacity:0}}'
      + '@keyframes bellRinging{0%,100%{transform:rotate(0)}20%{transform:rotate(-18deg)}40%{transform:rotate(18deg)}60%{transform:rotate(-12deg)}80%{transform:rotate(12deg)}}',
    html: function (o) {
      var cta = getP(o, "cta", o.lines[0] || "Join 500,000+ Creators");
      var btnText = getP(o, "btnText", "Subscribe");
      var avatar = getP(o, "avatar", "▶");
      return '<div class="sc-sub-wrap">'
        + '<div class="sc-sub-cta">' + esc(cta) + '</div>'
        + '<div class="sc-sub-pill">'
        + '<div class="sc-sub-av">' + renderAvatar(avatar, "▶") + '</div>'
        + '<span>' + esc(btnText) + '</span>'
        + '<span class="sc-sub-bell">🔔</span>'
        + '</div>'
        + '</div>';
    }
  };

  /* 7.4 Live Comment Stream */
  T["social-comment-stream"] = {
    name: "Live Chat Bubble Stream", cat: "social", dark: true, accent: "#38bdf8",
    desc: "Streaming live chat comment bubbles floating up like TikTok live with avatar badges",
    css: '.sc-stream-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;padding:8cqh 6cqw;background:radial-gradient(ellipse at 50% 100%,#18152e 0%,#08080f 100%);overflow:hidden;font-family:Inter,sans-serif;color:#fff}'
      + '.sc-stream-item{display:flex;align-items:center;gap:3cqw;background:rgba(255,255,255,.08);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.15);border-radius:999px;padding:2cqw 4cqw;margin-bottom:2cqh;box-shadow:0 8px 25px rgba(0,0,0,.6);animation:streamFloatUp var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-stream-i1{animation-delay:.05s}'
      + '.sc-stream-i2{animation-delay:.18s}'
      + '.sc-stream-av{width:7.5cqw;height:7.5cqw;border-radius:50%;background:linear-gradient(135deg,#7952ff,#00d2ff);display:grid;place-items:center;font-size:3.8cqw;font-weight:900}'
      + '.sc-stream-user{font-size:3.4cqw;font-weight:800;color:#7dd3fc;margin-right:1.5cqw}'
      + '.sc-stream-txt{font-size:3.4cqw;color:#fff;font-weight:600}'
      + '@keyframes streamFloatUp{0%,10%{transform:translateY(6cqh) scale(.85);opacity:0}24%{transform:translateY(0) scale(1);opacity:1}48%{transform:translateY(-.3cqh) scale(1.01);opacity:1}68%{transform:translateY(.25cqh) scale(.995);opacity:1}85%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(-6cqh) scale(.9);opacity:0}}',
    html: function (o) {
      var comment1User = getP(o, "comment1User", "@alex_motion");
      var comment1Text = getP(o, "comment1Text", o.lines[0] || "How did you animate this?! 🔥");
      var comment2User = getP(o, "comment2User", "@sam_creator");
      var comment2Text = getP(o, "comment2Text", o.lines[1] || "ShortsCraft AI is insane! 🚀");
      return '<div class="sc-stream-wrap">'
        + '<div class="sc-stream-item sc-stream-i1">'
        + '<div class="sc-stream-av">✦</div>'
        + '<div><span class="sc-stream-user">' + esc(comment1User) + '</span><span class="sc-stream-txt">' + esc(comment1Text) + '</span></div>'
        + '</div>'
        + '<div class="sc-stream-item sc-stream-i2">'
        + '<div class="sc-stream-av" style="background:linear-gradient(135deg,#ff3b5c,#ff8800)">★</div>'
        + '<div><span class="sc-stream-user">' + esc(comment2User) + '</span><span class="sc-stream-txt">' + esc(comment2Text) + '</span></div>'
        + '</div>'
        + '</div>';
    }
  };

  /* 7.5 Spotify Vinyl Spinout Player */
  T["social-views-counter"] = {
    name: "Spotify Vinyl Player", cat: "social", dark: true, accent: "#1db954",
    desc: "Photorealistic vinyl record disc sliding out from album jacket and spinning with animated music waveform",
    css: '.sc-vinyl-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:5cqh 6cqw;background:#0d0e12;overflow:hidden;box-shadow:inset 0 0 16cqw rgba(0,0,0,.95);font-family:-apple-system,BlinkMacSystemFont,sans-serif}.sc-vinyl-deck{position:relative;width:78cqw;height:78cqw;display:flex;align-items:center;justify-content:center;margin-bottom:3cqh}.sc-vinyl-disc{position:absolute;width:66cqw;height:66cqw;border-radius:50%;overflow:hidden;box-shadow:0 3cqw 10cqw rgba(0,0,0,.9);animation:vinylSpinout var(--D) cubic-bezier(.16,1,.3,1) infinite}.sc-vinyl-img{width:100%;height:100%;object-fit:cover;animation:vinylRotate 4s linear infinite}.sc-vinyl-jacket{position:relative;z-index:3;width:66cqw;height:66cqw;border-radius:3cqw;background:linear-gradient(135deg,#1e1e24,#111115);border:1px solid rgba(255,255,255,.12);box-shadow:0 4cqw 12cqw rgba(0,0,0,.85);display:flex;flex-direction:column;justify-content:space-between;padding:5cqw;transform:translateX(-14cqw)}.sc-vinyl-art{width:100%;height:65%;border-radius:2cqw;background:linear-gradient(135deg,#3b82f6,#8b5cf6,#ec4899);display:grid;place-items:center;font-size:12cqw;box-shadow:inset 0 0 3cqw rgba(0,0,0,.3)}.sc-vinyl-info{text-align:center;width:82cqw;z-index:4}.sc-vinyl-song{font-size:6.8cqw;font-weight:900;color:#fff;letter-spacing:-.02em;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sc-vinyl-artist{font-size:3.8cqw;color:#94a3b8;margin-top:.6cqh;font-weight:500}.sc-vinyl-bar{width:100%;height:4px;background:rgba(255,255,255,.15);border-radius:2px;margin:2cqh 0;overflow:hidden}.sc-vinyl-progress{height:100%;background:#1db954;width:62%;box-shadow:0 0 12px #1db954;animation:musicProg var(--D) linear infinite}.sc-vinyl-time{display:flex;justify-content:space-between;font-size:2.8cqw;font-family:monospace;color:rgba(255,255,255,.45)}@keyframes vinylSpinout{0%,15%{transform:translateX(0) rotate(0deg);opacity:0}30%,85%{transform:translateX(16cqw) rotate(180deg);opacity:1}100%{transform:translateX(24cqw) rotate(360deg);opacity:0}}@keyframes vinylRotate{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes musicProg{0%{width:10%}100%{width:95%}}',
    html: function (o) {
      var song = getP(o, "song", o.lines[0] || "Synthetic Dreams");
      var artist = getP(o, "artist", o.lines[1] || "Echo Labs · Side A");
      var coverIcon = getP(o, "coverIcon", "🎵");
      return '<div class="sc-vinyl-wrap">'
        + '<div class="sc-vinyl-deck">'
        + '<div class="sc-vinyl-jacket">'
        + '<div class="sc-vinyl-art">' + esc(coverIcon) + '</div>'
        + '<div style="font-size:2.6cqw;color:rgba(255,255,255,0.4);font-family:monospace;letter-spacing:0.1em">STEREO LP 33 RPM</div>'
        + '</div>'
        + '<div class="sc-vinyl-disc">'
        + '<img class="sc-vinyl-img" src="/assets/vinyl_disc.jpg" alt="Vinyl LP" />'
        + '</div>'
        + '</div>'
        + '<div class="sc-vinyl-info">'
        + '<h2 class="sc-vinyl-song">' + esc(song) + '</h2>'
        + '<div class="sc-vinyl-artist">' + esc(artist) + '</div>'
        + '<div class="sc-vinyl-bar"><div class="sc-vinyl-progress"></div></div>'
        + '<div class="sc-vinyl-time"><span>1:42</span><span>3:18</span></div>'
        + '</div>'
        + '</div>';
    },
    reactCode: `function Scene(props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = props || {};
  const song = p.song || 'Synthetic Dreams';
  const artist = p.artist || 'Echo Labs · Side A';

  const slide = spring({ frame, fps, config: { damping: 15, stiffness: 70 } });
  const rotation = frame * 2.5;
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const progWidth = interpolate(frame, [0, 120], [10, 90], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      backgroundColor: '#0d0e12',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '6%',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'relative',
        width: 280,
        height: 280,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24
      }}>
        <div style={{
          position: 'relative',
          zIndex: 3,
          width: 240,
          height: 240,
          borderRadius: 16,
          background: 'linear-gradient(135deg, #1e1e24, #111115)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.85)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 16,
          transform: 'translateX(-45px)'
        }}>
          <div style={{
            width: '100%',
            height: '68%',
            borderRadius: 10,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 48
          }}>
            🎵
          </div>
          <div style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.4)',
            fontFamily: 'monospace',
            letterSpacing: '0.1em'
          }}>
            STEREO LP 33 RPM
          </div>
        </div>

        <div style={{
          position: 'absolute',
          width: 235,
          height: 235,
          borderRadius: '50%',
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(0,0,0,0.9)',
          transform: "translateX(" + (slide * 60) + "px) rotate(" + rotation + "deg)",
          opacity: opacity
        }}>
          <img
            src="/assets/vinyl_disc.jpg"
            alt="Vinyl LP"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      </div>

      <div style={{ textAlign: 'center', width: '85%', zIndex: 4, opacity: opacity }}>
        <h2 style={{
          fontSize: 24,
          fontWeight: 900,
          color: '#ffffff',
          letterSpacing: '-0.02em',
          margin: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {song}
        </h2>
        <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 4, fontWeight: 500 }}>
          {artist}
        </div>

        <div style={{
          width: '100%',
          height: 4,
          backgroundColor: 'rgba(255,255,255,0.15)',
          borderRadius: 2,
          margin: '18px 0',
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            backgroundColor: '#1db954',
            width: progWidth + '%',
            boxShadow: '0 0 10px #1db954'
          }} />
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          fontFamily: 'monospace',
          color: 'rgba(255,255,255,0.45)'
        }}>
          <span>1:42</span>
          <span>3:18</span>
        </div>
      </div>
    </AbsoluteFill>
  );
}`
  };

  /* 7.6 Story Progress Bars */
  T["social-story-progress"] = {
    name: "Instagram Story Timer", cat: "social", dark: true, accent: "#ffffff",
    desc: "Segmented Instagram story progress bars with creator avatar",
    css: '.stb{position:absolute;inset:0;padding:6cqh 5cqw;display:flex;flex-direction:column}.stb .segs{display:flex;gap:1.5cqw}.stb .seg{flex:1;height:2px;border-radius:2px;background:rgba(255,255,255,.3);overflow:hidden;position:relative}.stb .seg.done{background:#fff}.stb .seg.active .fill{position:absolute;inset:0;background:#fff;width:0;animation:stbFill var(--D) linear infinite}.stb .av{width:8cqw;height:8cqw;border-radius:50%;background:#e11d48;animation:stbAv calc(var(--D) / 3) ease-in-out infinite alternate}.stb h2{opacity:0;transform:scale(.92);animation:stbH2 var(--D) var(--sp) infinite}@keyframes stbFill{0%,4%{width:0}96%,100%{width:100%}}@keyframes stbAv{0%{box-shadow:0 0 0 rgba(225,29,72,0)}100%{box-shadow:0 0 1.6cqw rgba(225,29,72,.8)}}@keyframes stbH2{0%,14%{opacity:0;transform:scale(.92)}30%,100%{opacity:1;transform:scale(1)}}',
    html: function (o) {
      return '<div class="stb"><div class="segs"><div class="seg done"></div><div class="seg active"><div class="fill"></div></div><div class="seg"></div></div><div style="display:flex;align-items:center;gap:3cqw;margin-top:2cqh"><div class="av"></div><b style="font-size:3.6cqw;color:#fff">' + esc(o.lines[0] || "shortscraft.ai") + '</b></div><div style="flex:1;display:grid;place-items:center"><h2 style="font-size:9cqw;font-weight:900;color:#fff;text-align:center">' + esc(o.lines[1] || "Behind The Viral Edit") + '</h2></div></div>';
    }
  };

  /* 7.7 Instagram iOS Creator Profile Card */
  T["social-verified-badge"] = {
    name: "Instagram Profile Card", cat: "social", dark: true, accent: "#0095f6",
    desc: "Realistic Apple iOS Instagram creator profile sheet with verified badge, live follower counters, and interactive buttons",
    css: '.sc-ig-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:6cqw;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,sans-serif}.sc-ig-card{width:86cqw;background:#ffffff;color:#000000;border-radius:5cqw;padding:6cqw 5cqw;box-shadow:0 4cqw 14cqw rgba(0,0,0,.85);animation:igPop var(--D) cubic-bezier(.16,1,.3,1) infinite}.sc-ig-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:3cqh}.sc-ig-av{width:18cqw;height:18cqw;border-radius:50%;background:linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);padding:3px;display:grid;place-items:center}.sc-ig-avinner{width:100%;height:100%;border-radius:50%;background:#18181b;display:grid;place-items:center;overflow:hidden;font-size:8cqw;color:#fff}.sc-ig-stats{display:flex;gap:4.5cqw;text-align:center}.sc-ig-statval{font-size:4.6cqw;font-weight:800;line-height:1.2}.sc-ig-statlbl{font-size:2.8cqw;color:#71717a}.sc-ig-bio{margin-bottom:3cqh}.sc-ig-name{font-size:4.2cqw;font-weight:800;display:flex;align-items:center;gap:1.5cqw}.sc-ig-bluecheck{width:3.8cqw;height:3.8cqw;border-radius:50%;background:#0095f6;color:#fff;display:inline-grid;place-items:center;font-size:2.4cqw;font-weight:900}.sc-ig-sub{font-size:3.2cqw;color:#52525b;margin-top:.4cqh;line-height:1.4}.sc-ig-btns{display:flex;gap:2cqw}.sc-ig-btn{flex:1;height:4.6cqh;border-radius:2cqw;display:grid;place-items:center;font-size:3.6cqw;font-weight:700;border:none;cursor:pointer}.sc-ig-btn-pri{background:#0095f6;color:#fff}.sc-ig-btn-sec{background:#ef4444;color:#fff}@keyframes igPop{0%,15%{transform:scale(.88) translateY(3cqh);opacity:0}30%{transform:scale(1) translateY(0);opacity:1}55%{transform:scale(1.012) translateY(-.5cqh);opacity:1}75%{transform:scale(.997) translateY(.3cqh);opacity:1}85%{transform:scale(1) translateY(0);opacity:1}100%{transform:scale(1.04);opacity:0}}',
    html: function (o) {
      var handle = getP(o, "handle", o.lines[0] || "artzenmedia");
      var bio = getP(o, "bio", o.lines[1] || "Helping you make better content · Editing tips / tutorials");
      var posts = getP(o, "posts", "178");
      var followers = getP(o, "followers", "143K");
      var following = getP(o, "following", "275");
      var avatar = getP(o, "avatar", "⚡");
      return '<div class="sc-ig-wrap">'
        + '<div class="sc-ig-card">'
        + '<div class="sc-ig-top">'
        + '<div class="sc-ig-av"><div class="sc-ig-avinner">' + renderAvatar(avatar, "⚡") + '</div></div>'
        + '<div class="sc-ig-stats">'
        + '<div><div class="sc-ig-statval">' + esc(posts) + '</div><div class="sc-ig-statlbl">posts</div></div>'
        + '<div><div class="sc-ig-statval">' + esc(followers) + '</div><div class="sc-ig-statlbl">followers</div></div>'
        + '<div><div class="sc-ig-statval">' + esc(following) + '</div><div class="sc-ig-statlbl">following</div></div>'
        + '</div>'
        + '</div>'
        + '<div class="sc-ig-bio">'
        + '<div class="sc-ig-name"><span>' + esc(handle) + '</span><span class="sc-ig-bluecheck">✓</span></div>'
        + '<div class="sc-ig-sub">' + esc(bio) + '</div>'
        + '</div>'
        + '<div class="sc-ig-btns">'
        + '<div class="sc-ig-btn sc-ig-btn-pri">Follow</div>'
        + '<div class="sc-ig-btn" style="background:#f4f4f5;color:#000;">Message</div>'
        + '</div>'
        + '</div>'
        + '</div>';
    },
    reactCode: `function Scene(props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = props || {};
  const handle = p.handle || 'artzenmedia';
  const bio = p.bio || 'Helping you make better content · Editing tips / tutorials';
  const posts = p.posts || '178';
  const followers = p.followers || '143K';
  const following = p.following || '275';

  const pop = spring({ frame, fps, config: { damping: 15, stiffness: 90 } });
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      backgroundColor: '#09090b',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '6%',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      <div style={{
        width: '90%',
        backgroundColor: '#ffffff',
        color: '#000000',
        borderRadius: 24,
        padding: '24px 20px',
        boxShadow: '0 30px 80px rgba(0,0,0,0.85)',
        transform: "scale(" + pop + ")",
        opacity: opacity
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 18
        }}>
          <div style={{
            width: 66,
            height: 66,
            borderRadius: '50%',
            background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
            padding: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              backgroundColor: '#18181b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              color: '#ffffff'
            }}>
              ⚡
            </div>
          </div>

          <div style={{ display: 'flex', gap: 20, textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>{posts}</div>
              <div style={{ fontSize: 11, color: '#71717a' }}>posts</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>{followers}</div>
              <div style={{ fontSize: 11, color: '#71717a' }}>followers</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>{following}</div>
              <div style={{ fontSize: 11, color: '#71717a' }}>following</div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{handle}</span>
            <span style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              backgroundColor: '#0095f6',
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 900
            }}>
              ✓
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#52525b', marginTop: 4, lineHeight: 1.4 }}>
            {bio}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{
            flex: 1,
            height: 36,
            borderRadius: 8,
            backgroundColor: '#0095f6',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 700
          }}>
            Follow
          </div>
          <div style={{
            flex: 1,
            height: 36,
            borderRadius: 8,
            backgroundColor: '#f4f4f5',
            color: '#000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 700
          }}>
            Message
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}`
  };

  /* 7.8 Interactive Poll Card */
  T["social-poll"] = {
    name: "2-Choice Poll Card", cat: "social", dark: true, accent: "#6366f1",
    desc: "2-choice voting poll card with animated percentage reveal and glowing winner pill",
    css: '.sc-poll-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:8cqw;background:radial-gradient(ellipse at 50% 50%,#18152e 0%,#08080f 100%);overflow:hidden;font-family:Inter,sans-serif;color:#fff}'
      + '.sc-poll-card{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);backdrop-filter:blur(20px);border-radius:5cqw;padding:6cqw;box-shadow:0 25px 60px rgba(0,0,0,.8);animation:pollCardPop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-poll-title{font-size:5.8cqw;font-weight:900;text-align:center;margin-bottom:3.5cqh;line-height:1.2}'
      + '.sc-poll-opt{position:relative;padding:3.2cqw 5cqw;border-radius:3cqw;font-size:4cqw;font-weight:800;display:flex;justify-content:space-between;align-items:center;margin-bottom:2cqw;overflow:hidden}'
      + '.sc-poll-win{background:rgba(99,102,241,.25);border:1px solid #6366f1;color:#fff;box-shadow:0 0 25px rgba(99,102,241,.4)}'
      + '.sc-poll-lose{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#94a3b8}'
      + '@keyframes pollCardPop{0%,12%{transform:scale(.9);opacity:0}24%,85%{transform:scale(1);opacity:1}100%{transform:scale(1.04);opacity:0}}',
    html: function (o) {
      var question = getP(o, "question", o.lines[0] || "Which style gets more retention?");
      var opt1 = getP(o, "opt1", "Motion Graphics");
      var opt2 = getP(o, "opt2", "Static Talking Head");
      return '<div class="sc-poll-wrap">'
        + '<div class="sc-poll-card">'
        + '<h3 class="sc-poll-title">' + esc(question) + '</h3>'
        + '<div class="sc-poll-opt sc-poll-win"><span>' + esc(opt1) + ' ✓</span><b>86%</b></div>'
        + '<div class="sc-poll-opt sc-poll-lose"><span>' + esc(opt2) + '</span><b>14%</b></div>'
        + '</div>'
        + '</div>';
    }
  };

  /* 7.9 Viral Share Modal */
  T["social-share"] = {
    name: "Viral Share Sheet", cat: "social", dark: true, accent: "#38bdf8",
    desc: "Floating share modal with AirDrop and social platform icons",
    css: '.sc-share-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:8cqw;background:radial-gradient(ellipse at 50% 50%,#091a33 0%,#030914 100%);overflow:hidden;font-family:Inter,sans-serif;color:#fff}'
      + '.sc-share-card{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);backdrop-filter:blur(24px);border-radius:5cqw;padding:6cqw;text-align:center;width:88%;box-shadow:0 25px 60px rgba(0,0,0,.85);animation:sharePop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-share-title{font-size:6.2cqw;font-weight:900;color:#fff;margin-bottom:2cqh}'
      + '.sc-share-icons{display:flex;justify-content:center;gap:4cqw;font-size:9cqw;margin-top:2cqh}'
      + '.sc-share-btn{width:16cqw;height:16cqw;border-radius:50%;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);display:grid;place-items:center;box-shadow:0 4px 15px rgba(0,0,0,.4)}'
      + '@keyframes sharePop{0%,12%{transform:translateY(4cqh) scale(.92);opacity:0}24%,85%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(-2cqh);opacity:0}}',
    html: function (o) {
      return '<div class="sc-share-wrap">'
        + '<div class="sc-share-card">'
        + '<div class="sc-share-title">' + esc(o.lines[0] || "Share Video") + '</div>'
        + '<div class="sc-share-icons">'
        + '<div class="sc-share-btn">📱</div>'
        + '<div class="sc-share-btn">💬</div>'
        + '<div class="sc-share-btn">🔗</div>'
        + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* 7.10 Live Stream Tag */
  T["social-live"] = {
    name: "LIVE Stream Badge", cat: "social", dark: true, accent: "#ef4444",
    desc: "Glowing pulsing red LIVE broadcast tag with viewer counter",
    css: '.sc-live-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:8cqw;text-align:center;background:radial-gradient(ellipse at 50% 50%,#260808 0%,#090202 100%);overflow:hidden;font-family:Inter,sans-serif;color:#fff}'
      + '.sc-live-badge{background:#ef4444;color:#fff;padding:1.5cqh 5cqw;border-radius:999px;font-size:4cqw;font-weight:900;letter-spacing:.08em;box-shadow:0 0 30px #ef4444;animation:liveStrobe 1.5s ease-in-out infinite alternate}'
      + '.sc-live-title{font-size:9.5cqw;font-weight:900;letter-spacing:-.03em;color:#fff;margin:3cqh 0 1cqh;text-shadow:0 0 35px rgba(239,68,68,.5);animation:liveTitlePop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-live-views{font-family:"Space Grotesk",sans-serif;font-size:4.5cqw;font-weight:800;color:#fca5a5;animation:liveViewsPop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '@keyframes liveStrobe{0%{box-shadow:0 0 20px rgba(239,68,68,.6)}100%{box-shadow:0 0 45px rgba(239,68,68,1);transform:scale(1.05)}}'
      + '@keyframes liveTitlePop{0%,12%{transform:scale(.9);opacity:0}24%,85%{transform:scale(1);opacity:1}100%{transform:scale(1.04);opacity:0}}'
      + '@keyframes liveViewsPop{0%,16%{transform:translateY(2cqh);opacity:0}28%,85%{transform:translateY(0);opacity:1}100%{transform:translateY(-1cqh);opacity:0}}',
    html: function (o) {
      return '<div class="sc-live-wrap">'
        + '<div class="sc-live-badge">● LIVE STREAM</div>'
        + '<div class="sc-live-title">' + esc(o.lines[0] || "Editing Masterclass") + '</div>'
        + '<div class="sc-live-views">👁️ ' + esc(o.lines[1] || "64,200 Viewers") + '</div>'
        + '</div>';
    }
  };

  /* ============================================================
     CATEGORY 8: CHARTS & INFOGRAPHICS (10 templates)
     ============================================================ */

  /* 8.1 3D Bar Race */
  T["charts-bar-race"] = {
    name: "3D Bar Chart Grow", cat: "charts", dark: true, accent: "#5b8cff",
    desc: "Multi-column 3D isometric bar chart rising with staggered spring heights & values",
    css: '.sc-barrace-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:8cqh 7cqw;background:radial-gradient(ellipse at 50% 40%,#111827 0%,#030712 100%);overflow:hidden;font-family:Inter,sans-serif;color:#fff;perspective:900px}'
      + '.sc-barrace-head{text-align:center;z-index:2}'
      + '.sc-barrace-tag{font-size:3.4cqw;letter-spacing:.2em;text-transform:uppercase;color:#94a3b8;font-weight:700}'
      + '.sc-barrace-title{font-size:6.8cqw;font-weight:900;letter-spacing:-.03em;color:#fff;margin-top:.6cqh;text-shadow:0 0 25px rgba(91,140,255,.4)}'
      + '.sc-barrace-stage{position:relative;width:100%;height:46cqh;display:flex;align-items:flex-end;justify-content:center;gap:4cqw;border-bottom:2px solid rgba(255,255,255,.15);padding:0 2cqw 2cqh;transform-style:preserve-3d;transform:rotateX(18deg)}'
      + '.sc-bar-col{flex:1;position:relative;border-radius:2.5cqw 2.5cqw 0 0;box-shadow:0 10px 30px rgba(0,0,0,.8);animation:barGrow var(--D) cubic-bezier(.16,1,.3,1) infinite;transform-origin:bottom;display:flex;justify-content:center}'
      + '.sc-bar-b1{background:linear-gradient(180deg,#64748b 0%,#334155 100%);animation-delay:.05s}'
      + '.sc-bar-b2{background:linear-gradient(180deg,#38bdf8 0%,#0284c7 100%);box-shadow:0 0 25px rgba(56,189,248,.35);animation-delay:.15s}'
      + '.sc-bar-b3{background:linear-gradient(180deg,#7952ff 0%,#4338ca 100%);box-shadow:0 0 35px rgba(121,82,255,.5);animation-delay:.25s}'
      + '.sc-bar-val{position:absolute;top:-4cqh;font-family:"Space Grotesk",sans-serif;font-size:4.2cqw;font-weight:900;color:#fff;background:rgba(0,0,0,.75);padding:.4cqh 1.8cqw;border-radius:1cqw;border:1px solid rgba(255,255,255,.15);white-space:nowrap}'
      + '@keyframes barGrow{0%,12%{transform:scaleY(0);opacity:0}26%,85%{transform:scaleY(1);opacity:1}100%{transform:scaleY(0.92);opacity:0}}',
    html: function (o) {
      var tag = getP(o, "tag", "PERFORMANCE BENCHMARK");
      var title = getP(o, "title", o.lines[0] || "+320% Retention Surge");
      return '<div class="sc-barrace-wrap">'
        + '<div class="sc-barrace-head">'
        + '<div class="sc-barrace-tag">' + esc(tag) + '</div>'
        + '<div class="sc-barrace-title">' + esc(title) + '</div>'
        + '</div>'
        + '<div class="sc-barrace-stage">'
        + '<div class="sc-bar-col sc-bar-b1" style="height:38%"><span class="sc-bar-val">1.2X</span></div>'
        + '<div class="sc-bar-col sc-bar-b2" style="height:65%"><span class="sc-bar-val">2.8X</span></div>'
        + '<div class="sc-bar-col sc-bar-b3" style="height:95%"><span class="sc-bar-val">4.5X</span></div>'
        + '</div>'
        + '</div>';
    }
  };

  /* 8.2 Circular Progress Ring */
  T["charts-ring"] = {
    name: "Progress Ring 83%", cat: "charts", dark: true, accent: "#34d17a",
    desc: "Circular SVG ring progress sweep with central large percentage and cybernetic glow",
    css: '.sc-ring-wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8cqw;background:radial-gradient(ellipse at 50% 50%,#092015 0%,#030a06 100%);overflow:hidden;font-family:Inter,sans-serif;color:#fff}'
      + '.sc-ring-stage{position:relative;width:56cqw;height:56cqw;display:grid;place-items:center}'
      + '.sc-ring-svg{width:100%;height:100%;transform:rotate(-90deg);overflow:visible}'
      + '.sc-ring-track{fill:none;stroke:rgba(255,255,255,.08);stroke-width:14}'
      + '.sc-ring-bar{fill:none;stroke:#34d17a;stroke-width:14;stroke-linecap:round;filter:drop-shadow(0 0 16px rgba(52,209,122,.7));stroke-dasharray:440;stroke-dashoffset:440;animation:ringSweep var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-ring-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}'
      + '.sc-ring-pct{font-family:"Space Grotesk",sans-serif;font-size:12cqw;font-weight:900;letter-spacing:-.04em;line-height:1;color:#fff;text-shadow:0 0 25px rgba(52,209,122,.5)}'
      + '.sc-ring-label{font-size:3.6cqw;font-weight:700;color:#86efac;letter-spacing:.08em;margin-top:.8cqh}'
      + '@keyframes ringSweep{0%,15%{stroke-dashoffset:440}35%,85%{stroke-dashoffset:75}100%{stroke-dashoffset:440}}',
    html: function (o) {
      var pct = getP(o, "pct", o.lines[0] || "83%");
      var label = getP(o, "label", o.lines[1] || "Average Retention");
      return '<div class="sc-ring-wrap">'
        + '<div class="sc-ring-stage">'
        + '<svg class="sc-ring-svg" viewBox="0 0 160 160">'
        + '<circle class="sc-ring-track" cx="80" cy="80" r="70" />'
        + '<circle class="sc-ring-bar" cx="80" cy="80" r="70" />'
        + '</svg>'
        + '<div class="sc-ring-center">'
        + '<div class="sc-ring-pct">' + esc(pct) + '</div>'
        + '<div class="sc-ring-label">' + esc(label) + '</div>'
        + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* 8.3 Growth Chart */
  T["charts-stock-trend"] = {
    name: "Growth Chart", cat: "charts", dark: true, accent: "#38bdf8",
    desc: "Dynamic curved SVG path drawing with spring interpolation, glowing area gradient, and live metric surge badge",
    css: '.sc-growth-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:8cqw;background:#070a12;font-family:Inter,sans-serif;overflow:hidden}.sc-growth-head{margin-bottom:2cqh}.sc-growth-tag{font-size:3cqw;letter-spacing:.25em;color:rgba(255,255,255,.4);font-weight:700;text-transform:uppercase}.sc-growth-valrow{display:flex;align-items:baseline;gap:2.5cqw;margin-top:.8cqh}.sc-growth-val{font-size:10cqw;font-weight:900;color:#fff;letter-spacing:-.03em;line-height:1}.sc-growth-badge{background:rgba(56,189,248,.15);border:1px solid rgba(56,189,248,.3);border-radius:99px;padding:1cqw 2.5cqw;font-size:2.8cqw;font-weight:700;color:#38bdf8;animation:badgePop var(--D) cubic-bezier(.16,1,.3,1) infinite}.sc-growth-sub{font-size:3.2cqw;color:rgba(255,255,255,.6);margin-top:.8cqh}.sc-growth-box{position:relative;width:100%;height:32cqh;background:rgba(255,255,255,.02);border-radius:3cqw;border:1px solid rgba(255,255,255,.08);padding:3cqw;overflow:hidden}.sc-growth-box svg{width:100%;height:100%;overflow:visible}.sc-growth-curve{fill:none;stroke:var(--ac);stroke-width:4;stroke-linecap:round;stroke-dasharray:600;stroke-dashoffset:600;animation:drawCurve var(--D) cubic-bezier(.16,1,.3,1) infinite;filter:drop-shadow(0 0 8px var(--ac))}@keyframes badgePop{0%,30%{transform:scale(0);opacity:0}45%,85%{transform:scale(1);opacity:1}100%{transform:scale(1.05);opacity:0}}@keyframes drawCurve{0%,10%{stroke-dashoffset:600}45%,85%{stroke-dashoffset:0}100%{stroke-dashoffset:0}}',
    html: function (o) {
      var metric = getP(o, "metric", "AUDIENCE RETENTION");
      var val = getP(o, "val", o.lines[0] || "+384.2%");
      var subtitle = getP(o, "subtitle", o.lines[1] || "Breakout Viral Surge");
      var lineColor = getP(o, "lineColor", "#38bdf8");
      return '<div class="sc-growth-wrap" style="--ac:' + esc(lineColor) + '">'
        + '<div class="sc-growth-head">'
        + '<div class="sc-growth-tag">' + esc(metric) + '</div>'
        + '<div class="sc-growth-valrow">'
        + '<div class="sc-growth-val">' + esc(val) + '</div>'
        + '<div class="sc-growth-badge">▲ SURGE</div>'
        + '</div>'
        + '<div class="sc-growth-sub">' + esc(subtitle) + '</div>'
        + '</div>'
        + '<div class="sc-growth-box">'
        + '<svg viewBox="0 0 400 200">'
        + '<defs><linearGradient id="scGlowG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + esc(lineColor) + '" stop-opacity="0.4"/><stop offset="100%" stop-color="' + esc(lineColor) + '" stop-opacity="0"/></linearGradient></defs>'
        + '<line x1="0" y1="50" x2="400" y2="50" stroke="rgba(255,255,255,0.05)" stroke-dasharray="4 4"/>'
        + '<line x1="0" y1="100" x2="400" y2="100" stroke="rgba(255,255,255,0.05)" stroke-dasharray="4 4"/>'
        + '<line x1="0" y1="150" x2="400" y2="150" stroke="rgba(255,255,255,0.05)" stroke-dasharray="4 4"/>'
        + '<path d="M 10 180 Q 80 170, 140 130 T 260 90 T 390 20 L 390 200 L 10 200 Z" fill="url(#scGlowG)"/>'
        + '<path class="sc-growth-curve" d="M 10 180 Q 80 170, 140 130 T 260 90 T 390 20"/>'
        + '<circle cx="390" cy="20" r="5" fill="#ffffff" stroke="' + esc(lineColor) + '" stroke-width="2"/>'
        + '</svg>'
        + '</div>'
        + '</div>';
    },
    reactCode: `function Scene(props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const metric = (props && props.metric) || "AUDIENCE RETENTION";
  const val = (props && props.val) || "+384.2%";
  const subtitle = (props && props.subtitle) || "Breakout Viral Surge";
  const lineColor = (props && props.lineColor) || "#38bdf8";

  const chartProgress = spring({ frame: Math.max(0, frame - 10), fps, config: { damping: 16, stiffness: 80 } });
  const badgeScale = spring({ frame: Math.max(0, frame - 40), fps, config: { damping: 12, stiffness: 120 } });
  const pathDashOffset = interpolate(chartProgress, [0, 1], [600, 0]);

  return (
    <AbsoluteFill style={{
      backgroundColor: '#070a12',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '8%',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, letterSpacing: '0.25em', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase' }}>
          {metric}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 6 }}>
          <div style={{ fontSize: 44, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.03em' }}>
            {val}
          </div>
          <div style={{
            backgroundColor: 'rgba(56,189,248,0.15)',
            border: '1px solid rgba(56,189,248,0.3)',
            borderRadius: 99,
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: 700,
            color: '#38bdf8',
            transform: "scale(" + badgeScale + ")",
            transformOrigin: 'left center'
          }}>
            ▲ SURGE
          </div>
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
          {subtitle}
        </div>
      </div>

      <div style={{
        position: 'relative',
        width: '100%',
        height: 240,
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.08)',
        padding: 16,
        overflow: 'hidden'
      }}>
        <svg viewBox="0 0 400 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          <defs>
            <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.4" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          <line x1="0" y1="50" x2="400" y2="50" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
          <line x1="0" y1="100" x2="400" y2="100" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
          <line x1="0" y1="150" x2="400" y2="150" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />

          <path
            d="M 10 180 Q 80 170, 140 130 T 260 90 T 390 20 L 390 200 L 10 200 Z"
            fill="url(#chartFill)"
            opacity={chartProgress}
          />

          <path
            d="M 10 180 Q 80 170, 140 130 T 260 90 T 390 20"
            fill="none"
            stroke={lineColor}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="600"
            strokeDashoffset={pathDashOffset}
          />

          {chartProgress > 0.85 && (
            <circle cx="390" cy="20" r="5" fill="#ffffff" stroke={lineColor} strokeWidth="3" />
          )}
        </svg>
      </div>
    </AbsoluteFill>
  );
}`
  };

  /* 8.4 3-Slice Donut Metric */
  T["charts-donut"] = {
    name: "Donut Traffic Split", cat: "charts", dark: true, accent: "#f59e0b",
    desc: "3-slice 3D circular donut breakdown with colored legend pills and percentage tags",
    css: '.sc-donut-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;align-items:center;padding:7cqh 6cqw;background:radial-gradient(ellipse at 50% 40%,#181429 0%,#080612 100%);overflow:hidden;font-family:Inter,sans-serif;color:#fff;perspective:900px}'
      + '.sc-donut-stage{position:relative;width:54cqw;height:54cqw;display:grid;place-items:center;transform-style:preserve-3d;transform:rotateX(18deg);animation:donutFloat 5s ease-in-out infinite alternate}'
      + '.sc-donut-svg{width:100%;height:100%;transform:rotate(-90deg);overflow:visible}'
      + '.sc-donut-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}'
      + '.sc-donut-num{font-family:"Space Grotesk",sans-serif;font-size:9.5cqw;font-weight:900;line-height:1;color:#fff;text-shadow:0 0 20px rgba(245,158,11,.4)}'
      + '.sc-donut-lbl{font-size:2.8cqw;letter-spacing:.2em;text-transform:uppercase;color:#94a3b8;margin-top:.4cqh}'
      + '.sc-donut-legend{width:100%;display:flex;flex-direction:column;gap:1.5cqh;z-index:3}'
      + '.sc-donut-pill{display:flex;justify-content:space-between;align-items:center;padding:1.8cqh 4cqw;border-radius:2.5cqw;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(16px);animation:donutPillPop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-donut-p1{animation-delay:.05s}'
      + '.sc-donut-p2{animation-delay:.15s}'
      + '@keyframes donutFloat{0%{transform:rotateX(14deg)}100%{transform:rotateX(22deg) translateY(-1cqh)}}'
      + '@keyframes donutPillPop{0%,12%{transform:scale(.92);opacity:0}25%,85%{transform:scale(1);opacity:1}100%{transform:scale(1.04);opacity:0}}',
    html: function (o) {
      var title = getP(o, "title", o.lines[0] || "Audience Breakdown");
      var sub = getP(o, "sub", "Traffic Channels");
      return '<div class="sc-donut-wrap">'
        + '<div style="text-align:center"><div style="font-size:3cqw;letter-spacing:.25em;text-transform:uppercase;color:#94a3b8;font-weight:700">' + esc(sub) + '</div><div style="font-size:6.4cqw;font-weight:900;color:#fff;margin-top:.4cqh">' + esc(title) + '</div></div>'
        + '<div class="sc-donut-stage">'
        + '<svg class="sc-donut-svg" viewBox="0 0 140 140">'
        + '<circle cx="70" cy="70" r="50" fill="none" stroke="#7952ff" stroke-width="20" stroke-dasharray="180 300" filter="drop-shadow(0 0 8px rgba(121,82,255,.6))"/>'
        + '<circle cx="70" cy="70" r="50" fill="none" stroke="#38bdf8" stroke-width="20" stroke-dasharray="80 300" stroke-dashoffset="-180"/>'
        + '<circle cx="70" cy="70" r="50" fill="none" stroke="#f59e0b" stroke-width="20" stroke-dasharray="40 300" stroke-dashoffset="-260"/>'
        + '</svg>'
        + '<div class="sc-donut-center"><div class="sc-donut-num">100%</div><div class="sc-donut-lbl">VERIFIED</div></div>'
        + '</div>'
        + '<div class="sc-donut-legend">'
        + '<div class="sc-donut-pill sc-donut-p1"><span style="display:flex;align-items:center;gap:2cqw"><span style="width:3cqw;height:3cqw;border-radius:50%;background:#7952ff"></span><b>YouTube Shorts</b></span><b>60%</b></div>'
        + '<div class="sc-donut-pill sc-donut-p2"><span style="display:flex;align-items:center;gap:2cqw"><span style="width:3cqw;height:3cqw;border-radius:50%;background:#38bdf8"></span><b>Instagram Reels</b></span><b>28%</b></div>'
        + '</div>'
        + '</div>';
    }
  };

  /* 8.5 Area Sparkline Wave */
  T["charts-area-wave"] = {
    name: "Area Sparkline Wave", cat: "charts", dark: true, accent: "#8b5cf6",
    desc: "Gradient-filled area wave chart undulating with glowing baseline and live peak badge",
    css: '.sc-wave-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:8cqh 7cqw;background:radial-gradient(ellipse at 50% 40%,#1a1033 0%,#080414 100%);overflow:hidden;font-family:Inter,sans-serif;color:#fff}'
      + '.sc-wave-head{display:flex;justify-content:space-between;align-items:flex-start}'
      + '.sc-wave-title{font-size:7.2cqw;font-weight:900;letter-spacing:-.03em;color:#fff;line-height:1.15;text-shadow:0 0 25px rgba(139,92,246,.5)}'
      + '.sc-wave-badge{padding:.8cqh 2.8cqw;border-radius:999px;background:rgba(139,92,246,.2);border:1px solid rgba(139,92,246,.4);color:#c4b5fd;font-size:3.6cqw;font-weight:800;white-space:nowrap}'
      + '.sc-wave-box{position:relative;width:100%;height:38cqh;display:grid;place-items:center}'
      + '.sc-wave-box svg{width:100%;height:100%;overflow:visible}'
      + '.sc-wave-curve{fill:none;stroke:#8b5cf6;stroke-width:4;filter:drop-shadow(0 0 12px #8b5cf6);stroke-dasharray:500;stroke-dashoffset:500;animation:waveDraw var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '@keyframes waveDraw{0%,12%{stroke-dashoffset:500}35%,85%{stroke-dashoffset:0}100%{stroke-dashoffset:500}}',
    html: function (o) {
      return '<div class="sc-wave-wrap">'
        + '<div class="sc-wave-head">'
        + '<div class="sc-wave-title">' + esc(o.lines[0] || "User Engagement Surge") + '</div>'
        + '<div class="sc-wave-badge">▲ +420%</div>'
        + '</div>'
        + '<div class="sc-wave-box">'
        + '<svg viewBox="0 0 300 150">'
        + '<defs><linearGradient id="awG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.6"/><stop offset="100%" stop-color="#8b5cf6" stop-opacity="0"/></linearGradient></defs>'
        + '<path d="M0,150 L0,90 Q50,40 100,80 T200,50 T300,20 L300,150 Z" fill="url(#awG)"/>'
        + '<path class="sc-wave-curve" d="M0,90 Q50,40 100,80 T200,50 T300,20"/>'
        + '</svg>'
        + '</div>'
        + '<div style="display:flex;justify-content:space-between;font-size:3.2cqw;color:#94a3b8;border-top:1px solid rgba(255,255,255,.08);padding-top:1.5cqh"><span>WEEK 1</span><span>WEEK 2</span><span>PEAK VIRALITY</span></div>'
        + '</div>';
    }
  };

  /* 8.6 Big KPI Milestone */
  T["charts-kpi-counter"] = {
    name: "Big KPI Milestone", cat: "charts", dark: true, accent: "#ffffff",
    desc: "Gigantic KPI metric counter spinning from zero to target number with particle glow",
    css: '.sc-kpi-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:8cqw;background:radial-gradient(ellipse at 50% 50%,#18182b 0%,#090912 100%);overflow:hidden;font-family:Inter,sans-serif;color:#fff}'
      + '.sc-kpi-tag{font-family:"Space Grotesk",sans-serif;font-size:3.4cqw;letter-spacing:.3em;color:#94a3b8;text-transform:uppercase;margin-bottom:2cqh;font-weight:700}'
      + '.sc-kpi-val{font-family:"Space Grotesk",sans-serif;font-size:18cqw;font-weight:900;letter-spacing:-.04em;line-height:.9;color:#fff;text-shadow:0 0 45px rgba(255,255,255,.6),0 10px 25px rgba(0,0,0,.8);animation:kpiPop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-kpi-sub{font-size:4.8cqw;color:#38bdf8;font-weight:800;margin-top:2.5cqh;letter-spacing:.02em}'
      + '@keyframes kpiPop{0%,12%{transform:scale(.85);opacity:0}24%,85%{transform:scale(1);opacity:1}100%{transform:scale(1.05);opacity:0}}',
    html: function (o) {
      var val = o.lines[0] || "$10,000,000";
      /* 18cqw is sized for a short figure like "1.2M". The default copy is
         eleven characters wide and ran 25px off both edges of a 9:16 frame, so
         the headline number scales down once it stops fitting. 150 is the
         usable width in cqw divided by this face's average advance. */
      var fs = Math.min(18, 150 / Math.max(String(val).length, 1));
      return '<div class="sc-kpi-wrap">'
        + '<div class="sc-kpi-tag">ANNUAL RECORD MILESTONE</div>'
        + '<div class="sc-kpi-val" style="font-size:' + fs.toFixed(2) + 'cqw">' + esc(val) + '</div>'
        + '<div class="sc-kpi-sub">' + esc(o.lines[1] || "ARR in Record Time") + '</div>'
        + '</div>';
    }
  };

  /* 8.7 Versus Battle Bars */
  T["charts-versus-bars"] = {
    name: "A/B Versus Battle", cat: "charts", dark: true, accent: "#ec4899",
    desc: "Two competing progress metric bars clashing with percentage bars and duel glow",
    css: '.sc-vs-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:8cqw;background:radial-gradient(ellipse at 50% 50%,#260a1d 0%,#090207 100%);overflow:hidden;font-family:Inter,sans-serif;color:#fff}'
      + '.sc-vs-title{font-size:7.2cqw;font-weight:900;color:#fff;text-align:center;margin-bottom:4cqh;letter-spacing:-.03em}'
      + '.sc-vs-barbox{margin-bottom:3cqh;animation:vsBarPop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-vs-label{display:flex;justify-content:space-between;font-size:3.8cqw;font-weight:800;color:#fff;margin-bottom:1cqh}'
      + '.sc-vs-track{height:4cqw;background:rgba(255,255,255,.08);border-radius:999px;overflow:hidden;padding:2px}'
      + '.sc-vs-fill{height:100%;border-radius:999px;box-shadow:0 0 16px currentColor}'
      + '@keyframes vsBarPop{0%,12%{transform:scale(.92);opacity:0}24%{transform:scale(1);opacity:1}50%{transform:scale(1.015) translateY(-.4cqh);opacity:1}72%{transform:scale(.996) translateY(.25cqh);opacity:1}85%{transform:scale(1);opacity:1}100%{transform:scale(1.04);opacity:0}}',
    html: function (o) {
      return '<div class="sc-vs-wrap">'
        + '<h3 class="sc-vs-title">' + esc(o.lines[0] || "Shorts vs Long Form") + '</h3>'
        + '<div class="sc-vs-barbox">'
        + '<div class="sc-vs-label"><span>Motion Graphic Shorts</span><b style="color:#38bdf8">86%</b></div>'
        + '<div class="sc-vs-track"><div class="sc-vs-fill" style="width:86%;background:#38bdf8;color:#38bdf8"></div></div>'
        + '</div>'
        + '<div class="sc-vs-barbox">'
        + '<div class="sc-vs-label"><span>Static Talking Head</span><b style="color:#ec4899">14%</b></div>'
        + '<div class="sc-vs-track"><div class="sc-vs-fill" style="width:14%;background:#ec4899;color:#ec4899"></div></div>'
        + '</div>'
        + '</div>';
    }
  };

  /* 8.8 Apple 30s Activity Ring Timer */
  T["charts-speedometer"] = {
    name: "Apple 30s Activity Timer", cat: "charts", dark: true, accent: "#22c55e",
    desc: "Apple Watch style activity ring timer drawing smooth circular progress with dynamic seconds countdown",
    css: '.sc-ap-timer{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle at center,#0c1a14 0%,#040806 70%,#000 100%);font-family:-apple-system,BlinkMacSystemFont,Inter,sans-serif;overflow:hidden}.sc-ap-ring-wrap{position:relative;width:64cqw;height:64cqw;display:grid;place-items:center}.sc-ap-svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}.sc-ap-track{fill:none;stroke:rgba(255,255,255,.08);stroke-width:12}.sc-ap-bar{fill:none;stroke:url(#apGrad);stroke-width:12;stroke-linecap:round;stroke-dasharray:628;stroke-dashoffset:628;animation:apRing var(--D) cubic-bezier(.16,1,.3,1) infinite}.sc-ap-center{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.sc-ap-sec{font-size:16cqw;font-weight:900;color:#fff;letter-spacing:-.04em;line-height:1;font-variant-numeric:tabular-nums}.sc-ap-ms{font-size:6cqw;color:var(--ac);font-weight:700}.sc-ap-tag{display:inline-flex;align-items:center;gap:1.5cqw;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.3);color:#22c55e;padding:1.5cqw 3.5cqw;border-radius:99px;font-size:3cqw;font-weight:700;margin-top:3cqh}.sc-ap-sub{font-size:3.6cqw;color:rgba(255,255,255,.6);margin-top:1.5cqh;font-weight:600}@keyframes apRing{0%,12%{stroke-dashoffset:628}35%,85%{stroke-dashoffset:120}100%{stroke-dashoffset:0}}',
    html: function (o) {
      var sec = getP(o, "sec", o.lines[0] || "00:30");
      var tag = getP(o, "tag", o.lines[1] || "FOCUS SESSION");
      var goal = getP(o, "goal", o.lines[2] || "500 KCAL BURN");
      var ringColor = getP(o, "ringColor", "#22c55e");
      return '<div class="sc-ap-timer">'
        + '<div class="sc-ap-ring-wrap">'
        + '<svg class="sc-ap-svg" viewBox="0 0 220 220">'
        + '<defs><linearGradient id="apGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="' + esc(ringColor) + '"/></linearGradient></defs>'
        + '<circle class="sc-ap-track" cx="110" cy="110" r="95"/>'
        + '<circle class="sc-ap-bar" cx="110" cy="110" r="95"/>'
        + '</svg>'
        + '<div class="sc-ap-center">'
        + '<div class="sc-ap-sec">' + esc(sec) + '</div>'
        + '<div class="sc-ap-ms">.00</div>'
        + '</div>'
        + '</div>'
        + '<div class="sc-ap-tag">⚡ ' + esc(tag) + '</div>'
        + '<div class="sc-ap-sub">' + esc(goal) + '</div>'
        + '</div>';
    }
  };

  /* 8.9 Activity Matrix */
  T["charts-activity-matrix"] = {
    name: "Streak Activity Heatmap", cat: "charts", dark: true, accent: "#22c55e",
    desc: "7x5 matrix of activity squares illuminating in sequential spring wave with glowing intensity",
    css: '.sc-heat-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;align-items:center;padding:7cqh 6cqw;background:radial-gradient(ellipse at 50% 50%,#092416 0%,#020b06 100%);overflow:hidden;font-family:Inter,sans-serif;color:#fff}'
      + '.sc-heat-head{text-align:center}'
      + '.sc-heat-tag{font-size:3cqw;letter-spacing:.25em;text-transform:uppercase;color:#86efac;font-weight:700}'
      + '.sc-heat-title{font-size:6.6cqw;font-weight:900;letter-spacing:-.03em;color:#fff;margin-top:.4cqh;text-shadow:0 0 25px rgba(34,197,94,.4)}'
      + '.sc-heat-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2.5cqw;width:74cqw;padding:4cqw;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:4cqw;box-shadow:0 20px 50px rgba(0,0,0,.8)}'
      + '.sc-heat-cell{width:8cqw;height:8cqw;border-radius:2cqw;background:rgba(255,255,255,.06);animation:cellGlow var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-heat-c1{background:#15803d;box-shadow:0 0 8px rgba(21,128,61,.5)}'
      + '.sc-heat-c2{background:#22c55e;box-shadow:0 0 16px rgba(34,197,94,.7)}'
      + '.sc-heat-c3{background:#4ade80;box-shadow:0 0 22px rgba(74,222,128,.9)}'
      + '.sc-heat-badge{background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.35);padding:1cqh 4cqw;border-radius:999px;font-size:3.6cqw;font-weight:800;color:#86efac}'
      + '@keyframes cellGlow{0%,15%{transform:scale(.8);opacity:.4}30%,85%{transform:scale(1);opacity:1}100%{transform:scale(.8);opacity:.4}}',
    html: function (o) {
      return '<div class="sc-heat-wrap">'
        + '<div class="sc-heat-head">'
        + '<div class="sc-heat-tag">CONSISTENCY SCORE</div>'
        + '<div class="sc-heat-title">' + esc(o.lines[0] || "365-Day Daily Post Streak") + '</div>'
        + '</div>'
        + '<div class="sc-heat-grid">'
        + '<div class="sc-heat-cell sc-heat-c1"></div><div class="sc-heat-cell sc-heat-c2"></div><div class="sc-heat-cell sc-heat-c3"></div><div class="sc-heat-cell sc-heat-c2"></div><div class="sc-heat-cell sc-heat-c3"></div><div class="sc-heat-cell sc-heat-c1"></div><div class="sc-heat-cell sc-heat-c3"></div>'
        + '<div class="sc-heat-cell sc-heat-c2"></div><div class="sc-heat-cell sc-heat-c3"></div><div class="sc-heat-cell sc-heat-c1"></div><div class="sc-heat-cell sc-heat-c3"></div><div class="sc-heat-cell sc-heat-c2"></div><div class="sc-heat-cell sc-heat-c3"></div><div class="sc-heat-cell sc-heat-c2"></div>'
        + '<div class="sc-heat-cell sc-heat-c3"></div><div class="sc-heat-cell sc-heat-c2"></div><div class="sc-heat-cell sc-heat-c3"></div><div class="sc-heat-cell sc-heat-c3"></div><div class="sc-heat-cell sc-heat-c1"></div><div class="sc-heat-cell sc-heat-c2"></div><div class="sc-heat-cell sc-heat-c3"></div>'
        + '</div>'
        + '<div class="sc-heat-badge">🔥 100% Top 1% Creator Retention</div>'
        + '</div>';
    }
  };

  /* 8.10 Conversion Funnel */
  T["charts-funnel"] = {
    name: "Conversion Funnel", cat: "charts", dark: true, accent: "#38bdf8",
    desc: "3-tier customer conversion funnel with drop-off analytics and glowing neon tiers",
    css: '.sc-funnel-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;align-items:center;padding:7cqh 6cqw;background:radial-gradient(ellipse at 50% 50%,#091d36 0%,#020b17 100%);overflow:hidden;font-family:Inter,sans-serif;color:#fff}'
      + '.sc-funnel-title{font-size:6.8cqw;font-weight:900;letter-spacing:-.03em;color:#fff;text-shadow:0 0 25px rgba(56,189,248,.4);text-align:center}'
      + '.sc-funnel-stages{width:100%;display:flex;flex-direction:column;align-items:center;gap:1.8cqh}'
      + '.sc-funnel-bar{border-radius:2.5cqw;padding:2.2cqh 4cqw;font-weight:800;font-size:3.8cqw;display:flex;justify-content:space-between;align-items:center;gap:2cqw;white-space:nowrap;box-shadow:0 15px 35px rgba(0,0,0,.7);animation:funnelPop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-funnel-b1{width:90%;background:linear-gradient(135deg,#38bdf8 0%,#0284c7 100%);color:#fff;box-shadow:0 0 25px rgba(56,189,248,.4);animation-delay:.05s}'
      + '.sc-funnel-b2{width:70%;font-size:3.3cqw;background:linear-gradient(135deg,#7952ff 0%,#4338ca 100%);color:#fff;box-shadow:0 0 25px rgba(121,82,255,.4);animation-delay:.15s}'
      + '.sc-funnel-b3{width:50%;font-size:2.7cqw;background:linear-gradient(135deg,#10b981 0%,#047857 100%);color:#fff;box-shadow:0 0 25px rgba(16,185,129,.4);animation-delay:.25s}'
      + '@keyframes funnelPop{0%,12%{transform:scale(.9);opacity:0}25%{transform:scale(1);opacity:1}45%{transform:scale(1.012);opacity:1}65%{transform:scale(.996);opacity:1}85%{transform:scale(1);opacity:1}100%{transform:scale(1.04);opacity:0}}',
    html: function (o) {
      return '<div class="sc-funnel-wrap">'
        + '<h3 class="sc-funnel-title">' + esc(o.lines[0] || "Audience Conversion") + '</h3>'
        + '<div class="sc-funnel-stages">'
        + '<div class="sc-funnel-bar sc-funnel-b1"><span>1. Impressions</span><b>1,000,000</b></div>'
        + '<div class="sc-funnel-bar sc-funnel-b2"><span>2. Clicks (42%)</span><b>420,000</b></div>'
        + '<div class="sc-funnel-bar sc-funnel-b3"><span>3. Converts (18%)</span><b>180,000</b></div>'
        + '</div>'
        + '<div style="font-size:3.4cqw;color:#94a3b8;font-family:monospace">ROI // 18X REVENUE MULTIPLIER</div>'
        + '</div>';
    }
  };

  /* ── Demo Strings (Tailored for Video Creators) ───────── */
  var DEMO = {
    "blank":                  ["Blank Canvas", "Choose a template or generate with AI.", ""],
    
    // AutoAE Exact 4-Scene Master & Modular Scenes
    "autoae-exact-master":       ["Write me a viral Shorts hook", "Auto-Built", "The Evidence", "First 3 Seconds"],
    "autoae-chatgpt-prompt":     ["Write me a viral Shorts hook", "", ""],
    "autoae-wireframe-stream":   ["FROM PROMPT TO SCENE", "Auto-Built", "SCRIPT"],
    "autoae-blue-evidence":      ["// CASE FILE 004", "The Evidence", ""],
    "autoae-volumetric-clock":   ["// RETENTION WINDOW", "First 3 Seconds", ""],

    // AutoAE Flagship Signature
    "autoae-founder-halftone": ["STARTED", "FACEBOOK", "// ARCHIVE 2004"],
    "autoae-neon-spheres":    ["Stand out in the crowded market?", "// RETENTION RULE #01", ""],
    "autoae-product-can":     ["ENERGY", "IN A CAN", ""],
    "autoae-founder-steps":   ["4-STEP FRAMEWORK", "First-principles thinking to engineer impossible products.", ""],
    "autoae-retro-crt":       ["Telling story...", "HOW IT ALL BEGAN // 1998", ""],
    "autoae-infinity-loop":   ["Creative Flow", "Viral Scale", ""],
    "autoae-scurve-growth":   ["$900", "$6,000", ""],
    "autoae-newspaper-breaking": ["BREAKING NEWS!", "The historic breakthrough that disrupted the entire global market.", ""],

    // Docu
    "docu-confidential":      ["RESTRICTED", "TOP SECRET", ""],
    "docu-red-string":        ["Suspect Alpha", "Shell Company", ""],
    "docu-highlighter":       ["$42,000,000 offshore", "Source: Internal Audit Report", ""],
    "docu-redacted":          ["ROBERT VANCE", "KREMLIN OFFICIALS", "File Ref: CIA-2026-X"],
    "docu-polaroid-pin":      ["Zurich, May 1998", "", ""],
    "docu-magnifying":        ["SUSPECT #04", "PRIMARY TARGET", "MAIN CLUE"],
    "docu-newspaper":         ["CHAPTER IV // REIGN", "THE MONARCH", "Born To Rule · Destined For Glory"],
    "docu-microfilm":         ["CONVERSATION RECORDED", "TRANSCRIPT VERIFIED // 100%", ""],
    "docu-timeline":          ["2008", "The Housing Crisis", "Where it all began"],
    "docu-folder":            ["ARCHIVE // 340 BC", "EFFORTLESS MOTION", "PHILOSOPHY OF DESIGN"],

    // Paper
    "paper-torn-rip":         ["CONFIDENTIAL", "UNCOVER THE TRUTH", ""],
    "paper-tape-strip":       ["Key Takeaway", "Attention is the new currency.", ""],
    "paper-sticker":          ["VIRAL CLUB", "", ""],
    "paper-notebook":         ["Rule #1: The Hook", "First 3 seconds dictate 90% of views.", ""],
    "paper-postit":           ["REMEMBER:", "Story > Equipment", ""],
    "paper-cardboard":        ["FRAGILE", "Handle With Extreme Care", ""],
    "paper-binder":           ["INDEX #01", "Framework for viral storytelling", ""],
    "paper-receipt":          ["RECEIPT #2026", "", ""],
    "paper-double-pol":       ["Production Diary", "", ""],
    "paper-collage":          ["MOTION", "STOP-MOTION FORMULA", ""],

    // Text & Hooks
    "text-highlight-box":     ["THE SECRET FORMULA", "complex editing", ""],
    "text-scribble":          ["DON'T MISS THIS", "10X RETENTION", ""],
    "text-word-punch":        ["HOOK OF THE DAY", "UNSTOPPABLE", "Build your momentum"],
    "text-subtitle-pill":     ["insane videos", "", ""],
    "text-cascade":           ["The truth about", "Consistency", "beats motivation"],
    "text-terminal":          ["execute_growth()", "1,000,000 Views", ""],
    "text-glitch":            ["DIFFERENT", "SWISHY", "CREATIVE"],
    "text-editorial":         ["COLLECTION // 2026", "MAJESTIC", "MONARCH"],
    "text-skew":              ["NETFLIX", "ORIGINAL SERIES", ""],
    "text-split":             ["> INITIALIZE_ENGINE()", "SHORTSCRAFT", ""],

    // Maps
    "maps-gps-pin":           ["Dubai, UAE", "Global Creator Summit", ""],
    "maps-flight-path":       ["NEW YORK (JFK)", "LONDON (LHR)", "7h 45m · 3,459 Miles"],
    "maps-radar-sweep":       ["RADAR SCAN: 1 DETECTED", "", ""],
    "maps-border":            ["Strategic Border", "", ""],
    "maps-satellite":         ["TARGET LOCKED", "34.0522° N, 118.2437° W", ""],
    "maps-route":             ["Fastest Route: 24 min", "", ""],
    "maps-compass":           ["BEARING 045° NE", "", ""],
    "maps-transit":           ["Next Stop: Shibuya", "", ""],
    "maps-topo":              ["Elevation: 4,810m", "", ""],
    "maps-geo-card":          ["Tokyo, Japan", "35.6762° N // 24°C Sunny", ""],

    // Money
    "money-candlestick":      ["NASDAQ: NVDA", "MARKET CAP // $3.2T", ""],
    "money-cash-stack":       ["$50,000", "Monthly Revenue", ""],
    "money-titanium-card":    ["Upwork", "41%", "of top companies agree"],
    "money-crypto-surge":     ["$98,400", "▲ +8.4% Surge", ""],
    "money-gold-vault":       ["1,000 OUNCES", "Federal Reserve Vault Asset", ""],
    "money-burn":             ["-$24,000/DAY", "Cash Burn Rate", ""],
    "money-receipt":          ["INVOICE PAID", "", ""],
    "money-wallet-unlock":    ["$1,250,000", "Liquid Net Worth", ""],
    "money-sale-slash":       ["$99/mo", "$5/mo", "50% OFF NEW USER"],
    "money-atm":              ["$10,000 PAYOUT", "Instant Automated Transfer", ""],

    // UI
    "ui-ios-notify":          ["SHORTSCRAFT", "Your 4K Short is ready to post 🚀", ""],
    "ui-safari-scroll":       ["AI Motion Graphics Studio", "", ""],
    "ui-google-search":       ["how to make viral motion graphics", "", ""],
    "ui-imessage":            ["How did you get 1M views?!", "Used ShortsCraft motion graphics! ⚡", ""],
    "ui-toggle":              ["VIRAL MODE: ON", "", ""],
    "ui-range-slider":        ["Export Quality", "", ""],
    "ui-slider":              ["SWISHY", "Fluid Motion Design Reimagined", ""],
    "ui-phone-mockup":        ["ShortsCraft", "", ""],
    "ui-tabs":                ["ShortsCraft Apps", "Calendar · 2 upcoming events", ""],
    "ui-otp":                 ["Security Code Verified", "", ""],
    "ui-store-badges":        ["5.0 Rated by 100K+ Creators", "", ""],

    // Social
    "social-tweet-card":      ["Creator Insights", "The top 1% of creators use motion graphics to double their retention.", ""],
    "social-like-burst":      ["1,248,000", "", ""],
    "social-sub-bell":        ["Join 500,000+ Creators", "", ""],
    "social-comment-stream":  ["How did you animate this?! 🔥", "ShortsCraft AI is insane! 🚀", ""],
    "social-views-counter":   ["Synthetic Dreams", "Echo Labs · Side A", ""],
    "social-story-progress":  ["shortscraft.ai", "Behind The Viral Edit", ""],
    "social-verified-badge":  ["artzenmedia", "Helping you make better content", ""],
    "social-poll":            ["Which style gets more retention?", "", ""],
    "social-share":           ["Share Video", "", ""],
    "social-live":            ["Editing Masterclass", "64,200 viewers", ""],

    // Charts
    "charts-bar-race":        ["300% Growth Surge", "", ""],
    "charts-ring":            ["83% Retention", "", ""],
    "charts-stock-trend":     ["REVENUE METRIC", "$148,290", ""],
    "charts-donut":           ["Audience Breakdown", "", ""],
    "charts-area-wave":       ["User Engagement Surge", "", ""],
    "charts-kpi-counter":     ["$10,000,000", "ARR in record time", ""],
    "charts-versus-bars":     ["Shorts vs Long Form", "", ""],
    "charts-speedometer":     ["00:30", "FOCUS SESSION", "500 KCAL BURN"],
    "charts-activity-matrix": ["365-Day Daily Post Streak", "", ""],
    "charts-funnel":          ["Audience Conversion", "", ""]
  };

  var FIELDS = {
    "blank":                  ["Title", "Subtitle", ""],
    "docu-confidential":      ["Header Tag", "Stamp Word", ""],
    "docu-red-string":        ["Card 1 Label", "Card 2 Label", ""],
    "docu-highlighter":       ["Highlighted Text", "Source Note", ""],
    "docu-redacted":          ["Blackout Name 1", "Blackout Name 2", "File Reference"],
    "docu-polaroid-pin":      ["Handwritten Caption", "", ""],
    "docu-magnifying":        ["Sticky Note Label", "Target Subtitle", "Main Clue Heading"],
    "docu-newspaper":         ["Chapter Kicker", "Monarch Title", "Subtitle"],
    "docu-microfilm":         ["Archive Heading", "Status", ""],
    "docu-timeline":          ["Year", "Historical Event", "Description"],
    "docu-folder":            ["Archive Tag", "Sculpture Title", "Subtitle"],

    "paper-torn-rip":         ["Paper Top Tag", "Main Torn Heading", ""],
    "paper-tape-strip":       ["Note Heading", "Body Text", ""],
    "paper-sticker":          ["Badge Text", "", ""],
    "paper-notebook":         ["Rule Title", "Note Text", ""],
    "paper-postit":           ["Top Note", "Main Post-It Text", ""],
    "paper-cardboard":        ["Stencil Text", "Handling Note", ""],
    "paper-binder":           ["Card Title", "Card Subtitle", ""],
    "paper-receipt":          ["Receipt Header", "", ""],
    "paper-double-pol":       ["Title", "", ""],
    "paper-collage":          ["Hook Word", "Caption", ""],

    "text-highlight-box":     ["Kicker", "Highlighted Phrase", ""],
    "text-scribble":          ["Pre-heading", "Main Hook", ""],
    "text-word-punch":        ["Tag", "Punch Word", "Subtitle"],
    "text-subtitle-pill":     ["Active Word", "", ""],
    "text-cascade":           ["Top line", "Big word", "Bottom line"],
    "text-terminal":          ["Command", "Output", ""],
    "text-glitch":            ["Pill 1", "Pill 2 (Invert)", "Pill 3"],
    "text-editorial":         ["Top Kicker Tag", "Main Editorial Title", "Accent Subtitle"],
    "text-skew":              ["Main Brand Title", "Tagline / Subtitle", ""],
    "text-split":             ["Terminal Prompt", "Logo Brand Title", ""],

    "maps-gps-pin":           ["City / Target", "Coordinates", "Status Subtitle"],
    "maps-flight-path":       ["Origin IATA", "Destination IATA", "Flight Info"],
    "maps-radar-sweep":       ["Threat Status", "Target Telemetry", ""],
    "maps-border":            ["Territory Name", "Area / Buffer Detail", ""],
    "maps-satellite":         ["Lock Status", "Coordinates", ""],
    "maps-route":             ["Turn Instruction", "Duration", "Distance Info"],
    "maps-compass":           ["Azimuth Heading", "Alignment Info", ""],
    "maps-transit":           ["Next Station", "Transfer Info", ""],
    "maps-topo":              ["Summit Peak Name", "Elevation Data", ""],
    "maps-trade-route":       ["Chokepoint / Strait", "Trade Volume", ""],

    "money-candlestick":      ["Ticker", "Market Cap", ""],
    "money-cash-stack":       ["Amount", "Label", ""],
    "money-titanium-card":    ["Brand Header", "Stat Percentage", "Subtext"],
    "money-crypto-surge":     ["Coin Price", "Growth Percentage", ""],
    "money-gold-vault":       ["Bullion Weight", "Vault Label", ""],
    "money-burn":             ["Burn Amount", "Metric Name", ""],
    "money-receipt":          ["Invoice Header", "", ""],
    "money-wallet-unlock":    ["Net Worth", "Status", ""],
    "money-sale-slash":       ["Old Price", "New Price", "Badge Label"],
    "money-atm":              ["Bill Amount", "Payout Note", ""],

    "ui-ios-notify":          ["App Name", "Notification Body", ""],
    "ui-safari-scroll":       ["Website Title", "", ""],
    "ui-google-search":       ["Search Query", "", ""],
    "ui-imessage":            ["Incoming Message", "Outgoing Reply", ""],
    "ui-toggle":              ["Toggle Status", "", ""],
    "ui-range-slider":        ["Quality Label", "", ""],
    "ui-slider":              ["Main Heading", "Sub-headline", ""],
    "ui-phone-mockup":        ["Brand Title", "", ""],
    "ui-tabs":                ["Header Title", "App 1 Status", ""],
    "ui-otp":                 ["Security Status", "", ""],
    "ui-store-badges":        ["Rating Text", "", ""],

    "social-tweet-card":      ["Profile Name", "Tweet Content", ""],
    "social-like-burst":      ["Like Count", "", ""],
    "social-sub-bell":        ["Subscribe CTA", "", ""],
    "social-comment-stream":  ["Comment 1", "Comment 2", ""],
    "social-views-counter":   ["Song Title", "Artist / Album", ""],
    "social-story-progress":  ["Username", "Story Title", ""],
    "social-verified-badge":  ["Profile Handle", "Bio Description", ""],
    "social-poll":            ["Poll Question", "", ""],
    "social-share":           ["Share Title", "", ""],
    "social-live":            ["Stream Title", "Viewer Count", ""],

    // Charts
    "charts-bar-race":        ["300% Growth Surge", "", ""],
    "charts-ring":            ["83% Retention", "", ""],
    "charts-stock-trend":     ["REVENUE METRIC", "$148,290", ""],
    "charts-donut":           ["Audience Breakdown", "", ""],
    "charts-area-wave":       ["User Engagement Surge", "", ""],
    "charts-kpi-counter":     ["$10,000,000", "ARR in record time", ""],
    "charts-versus-bars":     ["Shorts vs Long Form", "", ""],
    "charts-speedometer":     ["00:30", "FOCUS SESSION", "500 KCAL BURN"],
    "charts-activity-matrix": ["365-Day Daily Post Streak", "", ""],
    "charts-funnel":          ["Audience Conversion", "", ""]
  };

  var FIELDS = {
    "blank":                  ["Main Headline", "Subtitle Tag", "Footnote / CTA"],
    "docu-confidential":      ["Header Tag", "Stamp Word", "File Reference ID"],
    "docu-red-string":        ["Card 1 Label", "Card 2 Label", "Investigation Tag"],
    "docu-highlighter":       ["Category Kicker", "Highlighted Text", "Source Footnote"],
    "docu-redacted":          ["Blackout Name 1", "Blackout Name 2", "File Reference"],
    "docu-polaroid-pin":      ["Handwritten Caption", "Location Stamp", "Year / Date"],
    "docu-magnifying":        ["Sticky Note Label", "Target Subtitle", "Main Clue Heading"],
    "docu-newspaper":         ["Chapter Kicker", "Newspaper Headline", "Sub-headline Story"],
    "docu-microfilm":         ["Archive Heading", "Classified Status", "Subject Dossier"],
    "docu-timeline":          ["Year", "Historical Event", "Description Footnote"],
    "docu-folder":            ["Archive Tag", "Sculpture Title", "Philosophical Subtitle"],

    "paper-torn-rip":         ["Paper Top Tag", "Main Torn Heading", "Sub-label Text"],
    "paper-tape-strip":       ["Note Heading", "Body Text", "Signature / Tag"],
    "paper-sticker":          ["Badge Text", "Serial Code", "Subtitle"],
    "paper-notebook":         ["Rule Title", "Note Text", "Page Number"],
    "paper-postit":           ["Top Note", "Main Post-It Text", "Reminder Detail"],
    "paper-cardboard":        ["Stencil Text", "Handling Note", "Barcode Number"],
    "paper-binder":           ["Card Title", "Card Subtitle", "Folder Code"],
    "paper-receipt":          ["Receipt Header", "Item Line", "Total Amount"],
    "paper-double-pol":       ["Title", "Photo 1 Label", "Photo 2 Label"],
    "paper-collage":          ["Hook Word", "Caption", "Cutout Caption"],

    "text-highlight-box":     ["Kicker Tag", "Highlighted Phrase", "Payoff Subtitle"],
    "text-scribble":          ["Pre-heading", "Main Hook", "Supporting Line"],
    "text-word-punch":        ["Tag", "Punch Word", "Subtitle"],
    "text-subtitle-pill":     ["Active Word", "Sentence Start", "Sentence End"],
    "text-cascade":           ["Top line", "Big word", "Bottom line"],
    "text-terminal":          ["Command Prompt", "Output Result", "System Status"],
    "text-glitch":            ["Alert Badge", "Glitch Word", "Sub-headline"],
    "text-editorial":         ["Top Kicker Tag", "Main Editorial Title", "Accent Subtitle"],
    "text-skew":              ["Main Brand Title", "Tagline / Subtitle", "Release Year"],
    "text-split":             ["Terminal Prompt", "Logo Brand Title", "Engine Version"],

    "maps-gps-pin":           ["City / Target", "Coordinates", "Status Subtitle"],
    "maps-flight-path":       ["Origin IATA", "Destination IATA", "Flight Info & Duration"],
    "maps-radar-sweep":       ["Threat Status", "Target Telemetry", "Distance Radius"],
    "maps-border":            ["Territory Name", "Area / Buffer Detail", "Boundary Length"],
    "maps-satellite":         ["Lock Status", "Coordinates", "Altitude Telemetry"],
    "maps-route":             ["Turn Instruction", "Duration", "Distance Info"],
    "maps-compass":           ["Azimuth Heading", "Alignment Info", "True Bearing"],
    "maps-transit":           ["Next Station", "Transfer Info", "Line Code"],
    "maps-topo":              ["Summit Peak Name", "Elevation Data", "Mountain Range"],
    "maps-trade-route":       ["Chokepoint / Strait", "Trade Volume", "Daily Vessel Count"],

    "money-candlestick":      ["Ticker Symbol", "Market Cap Line", "Current Price"],
    "money-cash-stack":       ["Amount Value", "Metric Label", "Time Period"],
    "money-titanium-card":    ["Cardholder Name", "Stat Percentage", "Subtext Detail"],
    "money-crypto-surge":     ["Coin Price", "Growth Percentage", "24h Volume"],
    "money-gold-vault":       ["Bullion Weight", "Vault Label", "Purity Grade"],
    "money-burn":             ["Burn Amount", "Metric Name", "Runway Months"],
    "money-receipt":          ["Invoice Header", "Item Description", "Grand Total"],
    "money-wallet-unlock":    ["Net Worth Value", "Portfolio Status", "Daily Gain"],
    "money-sale-slash":       ["Old Price", "New Price", "Badge Label"],
    "money-atm":              ["Bill Amount", "Payout Note", "Balance Remaining"],

    "ui-ios-notify":          ["App Name", "Notification Body", "Timestamp Tag"],
    "ui-safari-scroll":       ["Website Title", "URL Domain", "Headline Text"],
    "ui-google-search":       ["Search Query", "Result Title", "Snippet Text"],
    "ui-imessage":            ["Incoming Message", "Outgoing Reply", "Sender Name"],
    "ui-toggle":              ["Toggle Status", "Feature Label", "State Description"],
    "ui-range-slider":        ["Quality Label", "Slider Value", "Metric Unit"],
    "ui-slider":              ["Main Heading", "Sub-headline", "Step Number"],
    "ui-phone-mockup":        ["Brand Title", "Screen Headline", "CTA Button"],
    "ui-tabs":                ["Category Title", "Active Tab", "Tab Description"],
    "ui-otp":                 ["Security Status", "Verification Code", "Timer Countdown"],
    "ui-store-badges":        ["Rating Text", "Review Count", "Store Badge"],

    "social-tweet-card":      ["Profile Name", "Tweet Content", "Handle & Metrics"],
    "social-like-burst":      ["Like Count", "Metric Sub-label", "Reaction Emoji"],
    "social-sub-bell":        ["Subscribe CTA", "Channel Name", "Subscriber Milestone"],
    "social-comment-stream":  ["Comment 1", "Comment 2", "Video Title"],
    "social-views-counter":   ["Song / Track Title", "Artist / Album", "View Count"],
    "social-story-progress":  ["Username", "Story Title", "Timestamp"],
    "social-verified-badge":  ["Creator Name", "Subscriber Count", "Verification Bio"],
    "social-poll":            ["Poll Question", "Option A", "Option B"],
    "social-share":           ["Share Title", "Platform Destination", "Share Count"],
    "social-live":            ["Stream Title", "Viewer Count", "Host Handle"],

    "charts-bar-race":        ["Headline Metric", "Leader Bar Label", "Growth Percentage"],
    "charts-ring":            ["Retention Value", "Ring Label", "Benchmark Target"],
    "charts-stock-trend":     ["Metric Label", "Revenue Figure", "Growth Delta"],
    "charts-donut":           ["Donut Label", "Primary Segment", "Percentage Share"],
    "charts-area-wave":       ["Metric Title", "Peak Value", "Time Interval"],
    "charts-kpi-counter":     ["Metric Amount", "Description", "Annual Target"],
    "charts-versus-bars":     ["Comparison Title", "Option A Value", "Option B Value"],
    "charts-speedometer":     ["Timer Countdown", "Badge Subtitle", "Metric Goal"],
    "charts-activity-matrix": ["Streak Title", "Current Day Count", "Completion Rate"],
    "charts-funnel":          ["Funnel Title", "Top Conversion", "Final Stage"]
  };

  /* ── Component Schemas for Deep Customization ─────────── */
  var SCHEMAS = {
    // 1. Documentary & Retro
    "docu-folder": {
      fields: [
        { key: "tag", label: "Archive Header Tag", type: "text", default: "ARCHIVE // 340 BC", placeholder: "e.g. ARCHIVE // 340 BC" },
        { key: "title", label: "Main Sculpture Headline", type: "text", default: "EFFORTLESS MOTION", placeholder: "e.g. EFFORTLESS MOTION" },
        { key: "subtitle", label: "Philosophical Subtitle", type: "text", default: "PHILOSOPHY OF DESIGN", placeholder: "e.g. PHILOSOPHY OF DESIGN" },
        { key: "image", label: "Sculpture / Artwork Photo (Upload Image)", type: "image", default: "/assets/statue_bust.jpg" },
        { key: "beamColor", label: "Spotlight Beam Color", type: "select", options: [
          { val: "rgba(255,255,255,.22)", label: "⚪ Studio White Chiaroscuro" },
          { val: "rgba(245,158,11,.22)", label: "🟡 Warm Amber Spotlight" },
          { val: "rgba(56,189,248,.22)", label: "🔵 Cyan Blue Cinematic Beam" }
        ], default: "rgba(255,255,255,.22)" }
      ],
      defaults: {
        tag: "ARCHIVE // 340 BC",
        title: "EFFORTLESS MOTION",
        subtitle: "PHILOSOPHY OF DESIGN",
        image: "/assets/statue_bust.jpg",
        beamColor: "rgba(255,255,255,.22)"
      }
    },

    "docu-confidential": {
      fields: [
        { key: "dossier", label: "Dossier Tag / File Number", type: "text", default: "RESTRICTED", placeholder: "e.g. RESTRICTED, CLASSIFIED" },
        { key: "stamp", label: "Rubber Stamp Text", type: "text", default: "TOP SECRET", placeholder: "e.g. TOP SECRET, CONFIDENTIAL, APPROVED" },
        { key: "stampColor", label: "Stamp Ink Color", type: "select", options: [
          { val: "#ef4444", label: "🔴 Crimson Red" },
          { val: "#f59e0b", label: "🟠 Amber Orange" },
          { val: "#10b981", label: "🟢 Emerald Green" },
          { val: "#1e293b", label: "⚫ Dark Black Ink" }
        ], default: "#ef4444" },
        { key: "paperTone", label: "Document Paper Background", type: "select", options: [
          { val: "#e6e1d6", label: "📜 Aged Sepia Parchment" },
          { val: "#fef3c7", label: "📂 Manila Folder" },
          { val: "#0f172a", label: "📐 Blueprint Dark" },
          { val: "#fafaf9", label: "⚪ Clean Paper" }
        ], default: "#e6e1d6" }
      ],
      defaults: {
        dossier: "RESTRICTED",
        stamp: "TOP SECRET",
        stampColor: "#ef4444",
        paperTone: "#e6e1d6"
      }
    },

    "docu-red-string": {
      fields: [
        { key: "card1", label: "Evidence Card 1 Title", type: "text", default: "Suspect Alpha" },
        { key: "card1Icon", label: "Card 1 Photo / Icon (Upload Image)", type: "image", default: "📁" },
        { key: "card2", label: "Evidence Card 2 Title", type: "text", default: "Shell Company" },
        { key: "card2Icon", label: "Card 2 Photo / Icon (Upload Image)", type: "image", default: "🏢" },
        { key: "stringColor", label: "Yarn String Color", type: "color", default: "#ef4444" },
        { key: "boardTheme", label: "Pinboard Background Style", type: "select", options: [
          { val: "#2a2521", label: "📌 Natural Corkboard" },
          { val: "#1c1917", label: "🌑 Dark Noir Board" },
          { val: "#0c1a2e", label: "📐 Blueprint Grid" }
        ], default: "#2a2521" }
      ],
      defaults: {
        card1: "Suspect Alpha",
        card1Icon: "📁",
        card2: "Shell Company",
        card2Icon: "🏢",
        stringColor: "#ef4444",
        boardTheme: "#2a2521"
      }
    },

    "docu-highlighter": {
      fields: [
        { key: "tag", label: "Evidence Category Tag", type: "text", default: "// EXHIBIT A: FINANCIAL AUDIT" },
        { key: "highlight", label: "Highlighted Evidence Text", type: "textarea", default: "$42,000,000 offshore" },
        { key: "source", label: "Footnote / Source Attribution", type: "text", default: "Source: Internal Investigation Report" },
        { key: "markerColor", label: "Highlighter Marker Color", type: "select", options: [
          { val: "#facc15", label: "🟡 Fluorescent Yellow" },
          { val: "#4ade80", label: "🟢 Neon Green" },
          { val: "#38bdf8", label: "🔵 Bright Cyan" },
          { val: "#f472b6", label: "💖 Hot Pink" }
        ], default: "#facc15" }
      ],
      defaults: {
        tag: "// EXHIBIT A: FINANCIAL AUDIT",
        highlight: "$42,000,000 offshore",
        source: "Source: Internal Investigation Report",
        markerColor: "#facc15"
      }
    },

    "docu-redacted": {
      fields: [
        { key: "header", label: "Archive Header Tag", type: "text", default: "DECLASSIFIED UNDER FOIA" },
        { key: "name1", label: "Censored Name / Target 1", type: "text", default: "ROBERT VANCE" },
        { key: "name2", label: "Censored Name / Target 2", type: "text", default: "KREMLIN OFFICIALS" },
        { key: "body", label: "Meeting Context Location", type: "text", default: "in Vienna." },
        { key: "ref", label: "File Reference ID", type: "text", default: "File Ref: CIA-2026-X" }
      ],
      defaults: {
        header: "DECLASSIFIED UNDER FOIA",
        name1: "ROBERT VANCE",
        name2: "KREMLIN OFFICIALS",
        body: "in Vienna.",
        ref: "File Ref: CIA-2026-X"
      }
    },

    "docu-polaroid-pin": {
      fields: [
        { key: "caption", label: "Handwritten Marker Caption", type: "text", default: "Zurich, May 1998" },
        { key: "photo", label: "Polaroid Photo / Image (Upload Image)", type: "image", default: "📸" },
        { key: "pinColor", label: "Pushpin Color", type: "color", default: "#ef4444" }
      ],
      defaults: {
        caption: "Zurich, May 1998",
        photo: "📸",
        pinColor: "#ef4444"
      }
    },

    "docu-magnifying": {
      fields: [
        { key: "note", label: "Sticky Note Label (with tape)", type: "text", default: "SUSPECT #04", placeholder: "e.g. SUSPECT #04, EVIDENCE" },
        { key: "subtext", label: "Target Subtitle", type: "text", default: "PRIMARY TARGET", placeholder: "e.g. PRIMARY TARGET" },
        { key: "maintext", label: "Main Clue Headline", type: "text", default: "MAIN CLUE", placeholder: "e.g. MAIN CLUE" },
        { key: "markerColor", label: "Hand-Drawn Circle Marker Color", type: "select", options: [
          { val: "#ef4444", label: "🔴 Crimson Red Glow" },
          { val: "#f59e0b", label: "🟠 Bright Amber" },
          { val: "#38bdf8", label: "🔵 Cyan Blue" },
          { val: "#22c55e", label: "🟢 Neon Green" }
        ], default: "#ef4444" }
      ],
      defaults: {
        note: "SUSPECT #04",
        subtext: "PRIMARY TARGET",
        maintext: "MAIN CLUE",
        markerColor: "#ef4444"
      }
    },

    // 2. Paper & Cutout
    "paper-torn-rip": {
      fields: [
        { key: "tag", label: "Paper Top Tag", type: "text", default: "CONFIDENTIAL", placeholder: "e.g. CONFIDENTIAL, TOP SECRET" },
        { key: "heading", label: "Main Headline", type: "textarea", default: "UNCOVER THE TRUTH", placeholder: "e.g. UNCOVER THE TRUTH" },
        { key: "paperColor", label: "Torn Paper Color", type: "select", options: [
          { val: "#d32f2f", label: "🔴 Studio Red Textured" },
          { val: "#18181b", label: "⚫ Dark Obsidian" },
          { val: "#ffffff", label: "⚪ Clean White Paper" },
          { val: "#f59e0b", label: "🟠 Amber Kraft" }
        ], default: "#d32f2f" },
        { key: "matColor", label: "Cutting Mat Grid Color", type: "select", options: [
          { val: "#0d2818", label: "🟩 Studio Forest Green" },
          { val: "#0c1a2e", label: "🟦 Dark Navy Blueprint" },
          { val: "#18181b", label: "⬛ Charcoal Dark Mat" }
        ], default: "#0d2818" }
      ],
      defaults: {
        tag: "CONFIDENTIAL",
        heading: "UNCOVER THE TRUTH",
        paperColor: "#d32f2f",
        matColor: "#0d2818"
      }
    },

    // 3. Kinetic Text & Hooks
    "text-editorial": {
      fields: [
        { key: "kicker", label: "Top Category Tag // Year", type: "text", default: "COLLECTION // 2026", placeholder: "e.g. COLLECTION // 2026" },
        { key: "title", label: "Main Editorial Title", type: "text", default: "MAJESTIC", placeholder: "e.g. MAJESTIC" },
        { key: "subtitle", label: "Accent Subtitle", type: "text", default: "MONARCH", placeholder: "e.g. MONARCH" },
        { key: "barcode", label: "Barcode Serial Number", type: "text", default: "8 49204 11092 3", placeholder: "e.g. 8 49204 11092 3" }
      ],
      defaults: {
        kicker: "COLLECTION // 2026",
        title: "MAJESTIC",
        subtitle: "MONARCH",
        barcode: "8 49204 11092 3"
      }
    },

    "text-skew": {
      fields: [
        { key: "title", label: "Main Cinema Title", type: "text", default: "NETFLIX", placeholder: "e.g. NETFLIX, HBO, SHORTSCRAFT" },
        { key: "tagline", label: "Tagline / Subtitle", type: "text", default: "ORIGINAL SERIES", placeholder: "e.g. ORIGINAL SERIES" },
        { key: "ribbonColor", label: "Cinema Ribbon Glow Color", type: "select", options: [
          { val: "#e50914", label: "🔴 Netflix Crimson Red" },
          { val: "#38bdf8", label: "🔵 Cyberpunk Cyan" },
          { val: "#a855f7", label: "🟣 Electric Purple" },
          { val: "#f59e0b", label: "🟠 Amber Gold" }
        ], default: "#e50914" }
      ],
      defaults: {
        title: "NETFLIX",
        tagline: "ORIGINAL SERIES",
        ribbonColor: "#e50914"
      }
    },

    "text-split": {
      fields: [
        { key: "icon", label: "Core Emblem Icon (Emoji or Text)", type: "text", default: "⚡" },
        { key: "cmd", label: "Terminal Command Prompt", type: "text", default: "> INITIALIZE_ENGINE()", placeholder: "e.g. > INITIALIZE_ENGINE()" },
        { key: "title", label: "Main Brand Headline", type: "text", default: "SHORTSCRAFT", placeholder: "e.g. SHORTSCRAFT" },
        { key: "glitchColor", label: "Matrix Glitch Glow Color", type: "select", options: [
          { val: "#00ffaa", label: "🟢 Matrix Neon Green" },
          { val: "#00f0ff", label: "🔵 Cyan Blue Flare" },
          { val: "#ff0055", label: "💖 Cyber Magenta" },
          { val: "#ffd700", label: "🟡 Electric Gold" }
        ], default: "#00ffaa" }
      ],
      defaults: {
        icon: "⚡",
        cmd: "> INITIALIZE_ENGINE()",
        title: "SHORTSCRAFT",
        glitchColor: "#00ffaa"
      }
    },

    // 6. UI & Devices
    "ui-slider": {
      fields: [
        { key: "title", label: "Main Floating Word", type: "text", default: "SWISHY", placeholder: "e.g. SWISHY, MOTION, CREATE" },
        { key: "sub", label: "Sub-headline Tagline", type: "text", default: "Fluid Motion Design Reimagined", placeholder: "e.g. Fluid Motion Design Reimagined" },
        { key: "blobGradient", label: "Fluid Metaball Blob Palette", type: "select", options: [
          { val: "linear-gradient(135deg,#7928ca,#ff0080,#00dfd8)", label: "🔮 Neon Purple, Rose & Cyan" },
          { val: "linear-gradient(135deg,#f59e0b,#ef4444,#ec4899)", label: "🌅 Sunset Amber & Crimson" },
          { val: "linear-gradient(135deg,#10b981,#3b82f6,#8b5cf6)", label: "🌌 Emerald & Indigo Aurora" }
        ], default: "linear-gradient(135deg,#7928ca,#ff0080,#00dfd8)" }
      ],
      defaults: {
        title: "SWISHY",
        sub: "Fluid Motion Design Reimagined",
        blobGradient: "linear-gradient(135deg,#7928ca,#ff0080,#00dfd8)"
      }
    },

    // 8. Charts & Infographics
    "charts-speedometer": {
      fields: [
        { key: "sec", label: "Timer Countdown Seconds", type: "text", default: "00:30", placeholder: "e.g. 00:30, 00:45, 01:00" },
        { key: "tag", label: "Activity Badge Tag", type: "text", default: "FOCUS SESSION", placeholder: "e.g. FOCUS SESSION, SPRINT" },
        { key: "goal", label: "Metric Goal Subtitle", type: "text", default: "500 KCAL BURN", placeholder: "e.g. 500 KCAL BURN, 100% COMPLETE" },
        { key: "ringColor", label: "Apple Activity Ring Color", type: "select", options: [
          { val: "#22c55e", label: "🟢 Apple Activity Green" },
          { val: "#38bdf8", label: "🔵 Cyan Precision" },
          { val: "#ef4444", label: "🔴 Flame Red" },
          { val: "#a855f7", label: "🟣 Ultraviolet" }
        ], default: "#22c55e" }
      ],
      defaults: {
        sec: "00:30",
        tag: "FOCUS SESSION",
        goal: "500 KCAL BURN",
        ringColor: "#22c55e"
      }
    },

    // 7. Social Proof & Viral
    "social-tweet-card": {
      fields: [
        { key: "name", label: "Profile Display Name", type: "text", default: "Creator Insights", placeholder: "e.g. Creator Insights" },
        { key: "handle", label: "Username Handle", type: "text", default: "@creatorgrowth", placeholder: "e.g. @creatorgrowth" },
        { key: "verified", label: "Verified Blue Badge", type: "toggle", default: true },
        { key: "avatar", label: "Profile Avatar (Upload Image or Emoji)", type: "image", default: "✦" },
        { key: "body", label: "Post / Tweet Content", type: "textarea", default: "The top 1% of creators use motion graphics to double their retention." },
        { key: "comments", label: "Comments Count", type: "text", default: "1.4K" },
        { key: "retweets", label: "Retweets Count", type: "text", default: "8.9K" },
        { key: "likes", label: "Likes Count", type: "text", default: "42.5K" },
        { key: "cardBg", label: "Card Background Style", type: "select", options: [
          { val: "#000000", label: "🌑 Pitch Black (OLED)" },
          { val: "#0f172a", label: "🌌 Dark Slate Navy" },
          { val: "#18181b", label: "🔘 Zinc Charcoal" },
          { val: "#ffffff", label: "⚪ Clean White" }
        ], default: "#000000" }
      ],
      defaults: {
        name: "Creator Insights",
        handle: "@creatorgrowth",
        verified: true,
        avatar: "✦",
        body: "The top 1% of creators use motion graphics to double their retention.",
        comments: "1.4K",
        retweets: "8.9K",
        likes: "42.5K",
        cardBg: "#000000"
      }
    },

    "social-like-burst": {
      fields: [
        { key: "count", label: "Like Counter Milestone", type: "text", default: "1,248,000" },
        { key: "label", label: "Action Sub-label", type: "text", default: "Likes & Shares" },
        { key: "icon", label: "Reaction Emoji / Icon", type: "text", default: "❤️" }
      ],
      defaults: {
        count: "1,248,000",
        label: "Likes & Shares",
        icon: "❤️"
      }
    },

    "social-sub-bell": {
      fields: [
        { key: "cta", label: "Channel CTA Heading", type: "text", default: "Join 500,000+ Creators" },
        { key: "btnText", label: "Subscribe Button Label", type: "text", default: "Subscribe" },
        { key: "avatar", label: "Channel Avatar (Upload Image)", type: "image", default: "▶" },
        { key: "btnColor", label: "Button Color", type: "select", options: [
          { val: "#ff0000", label: "🔴 YouTube Red" },
          { val: "#ffffff", label: "⚪ Clean White" },
          { val: "#000000", label: "⚫ Pitch Black" },
          { val: "#38bdf8", label: "🔵 Neon Cyan" }
        ], default: "#ff0000" }
      ],
      defaults: {
        cta: "Join 500,000+ Creators",
        btnText: "Subscribe",
        avatar: "▶",
        btnColor: "#ff0000"
      }
    },

    "social-comment-stream": {
      fields: [
        { key: "comment1User", label: "Comment 1 Username", type: "text", default: "@alex" },
        { key: "comment1Text", label: "Comment 1 Message", type: "text", default: "How did you animate this?! 🔥" },
        { key: "comment2User", label: "Comment 2 Username", type: "text", default: "@sam" },
        { key: "comment2Text", label: "Comment 2 Message", type: "text", default: "ShortsCraft AI is insane! 🚀" }
      ],
      defaults: {
        comment1User: "@alex",
        comment1Text: "How did you animate this?! 🔥",
        comment2User: "@sam",
        comment2Text: "ShortsCraft AI is insane! 🚀"
      }
    },

    "social-verified-badge": {
      fields: [
        { key: "name", label: "Creator Name", type: "text", default: "ShortsCraft Studio" },
        { key: "subscribers", label: "Subscriber / Follower Count", type: "text", default: "1.5 Million Subscribers" },
        { key: "avatar", label: "Profile Avatar (Upload Image)", type: "image", default: "⚡" }
      ],
      defaults: {
        name: "ShortsCraft Studio",
        subscribers: "1.5 Million Subscribers",
        avatar: "⚡"
      }
    },

    // 6. UI & Devices
    "ui-ios-notify": {
      fields: [
        { key: "app", label: "App Name", type: "text", default: "SHORTSCRAFT" },
        { key: "icon", label: "App Icon (Upload or Emoji)", type: "image", default: "⚡" },
        { key: "time", label: "Timestamp Tag", type: "text", default: "now" },
        { key: "body", label: "Notification Message Preview", type: "textarea", default: "Your 4K Short is ready to post 🚀" }
      ],
      defaults: {
        app: "SHORTSCRAFT",
        icon: "⚡",
        time: "now",
        body: "Your 4K Short is ready to post 🚀"
      }
    },

    "ui-imessage": {
      fields: [
        { key: "inMsg", label: "Incoming Message Bubble", type: "textarea", default: "How did you get 1M views?!" },
        { key: "outMsg", label: "Outgoing Reply Bubble", type: "textarea", default: "Used ShortsCraft motion graphics! ⚡" },
        { key: "bubbleColor", label: "Outgoing Bubble Accent", type: "color", default: "#3b82f6" }
      ],
      defaults: {
        inMsg: "How did you get 1M views?!",
        outMsg: "Used ShortsCraft motion graphics! ⚡",
        bubbleColor: "#3b82f6"
      }
    }
  };

  function defaultSchema(id) {
    var f = FIELDS[id] || ["Line 1", "Line 2", "Line 3"];
    var d = DEMO[id] || ["", "", ""];
    var fields = [];
    var defaults = {};
    f.forEach(function (label, i) {
      if (label) {
        var key = "line" + i;
        fields.push({ key: key, label: label, type: "text", default: d[i] || "" });
        defaults[key] = d[i] || "";
      }
    });
    return { fields: fields, defaults: defaults };
  }

  /* ── Public API ───────────────────────────────────────── */
  function list(includeBlank) {
    return Object.keys(T).filter(function (id) {
      return includeBlank ? true : id !== "blank";
    }).map(function (id) {
      var s = SCHEMAS[id] || defaultSchema(id);
      return {
        id: id, name: T[id].name, cat: T[id].cat,
        desc: T[id].desc, dark: !T[id].dark, accent: T[id].accent,
        demo: (DEMO[id] || []).slice(),
        fields: (FIELDS[id] || ["Line 1", "Line 2", "Line 3"]).slice(),
        schema: s
      };
    });
  }

  function build(id, opts) {
    var t = T[id];
    if (!t) return "";

    var o = opts || {};
    var s = SCHEMAS[id] || defaultSchema(id);
    var p = Object.assign({}, s.defaults, o.props || {});

    // If lines were passed explicitly, map them into the schema fields
    if (o.lines && o.lines.length) {
      s.fields.forEach(function (f, idx) {
        if (o.lines[idx] != null && String(o.lines[idx]).trim() !== "") {
          p[f.key] = o.lines[idx];
        }
      });
    }

    var given = o.lines || [];
    var demo = DEMO[id] || [];
    var lines = [];
    for (var i = 0; i < 3; i++) {
      // Precedence: explicit lines → edited props → demo copy.
      // The props step is what makes the editor's content fields work: they
      // write props.line0/1/2, while most templates read o.lines[i]. Without
      // this bridge, typing in the editor changed nothing on screen.
      var v = given[i];
      var fromProps = p["line" + i];
      if (v != null && String(v).trim() !== "") lines.push(String(v));
      else if (fromProps != null && String(fromProps).trim() !== "") lines.push(String(fromProps));
      else lines.push(demo[i] || "");
    }

    var res = {
      p: p,
      props: p,
      lines: lines,
      accent: o.accent || t.accent,
      aspect: AR[o.aspect] ? o.aspect : "9:16",
      dur: Number(o.dur) > 800 ? Number(o.dur) : 4600,
      font: o.font || "inter"
    };

    return '<!doctype html><html lang="en"><head><meta charset="utf-8">'
      + '<meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<title>' + esc(t.name) + '</title><style>'
      + base(t, res) + t.css
      + '</style></head><body><div class="vp">'
      + '<div class="cv">' + t.html(res) + '</div>'
      + '<div class="wm">shortscraft.online</div>'
      + '</div></body></html>';
  }

  function cats() { return CATS.slice(); }
  function fonts() { return FONTS.map(function (f) { return { id: f.id, label: f.label }; }); }
  function aspects() { return Object.keys(AR); }

  function buildCustom(spec, opts) {
    if (!spec || typeof spec.css !== "string" || typeof spec.body !== "string") return "";
    var o = opts || {};
    var t = {
      name: spec.name || "Custom animation",
      dark: spec.dark !== false,
      accent: spec.accent || "#ffffff"
    };
    var res = {
      lines: o.lines || [],
      props: o.props || {},
      p: o.props || {},
      accent: o.accent || t.accent,
      aspect: AR[o.aspect] ? o.aspect : "9:16",
      dur: Number(o.dur) > 800 ? Number(o.dur) : 4600,
      font: o.font || "inter"
    };
    var img = spec.img ? '.vp{--img:url("' + String(spec.img).replace(/["\\\\]/g, "") + '")}' : "";

    return '<!doctype html><html lang="en"><head><meta charset="utf-8">'
      + '<meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<title>' + esc(t.name) + '</title><style>'
      + base(t, res) + img + spec.css
      + '</style></head><body><div class="vp">'
      + '<div class="cv">' + spec.body + '</div>'
      + '<div class="wm">shortscraft.online</div>'
      + '</div></body></html>';
  }

  function getReactCode(id) {
    var t = T[id] || T["blank"];
    if (t.reactCode) return t.reactCode;
    return 'function Scene(props) {\n'
      + '  const frame = useCurrentFrame();\n'
      + '  const { fps } = useVideoConfig();\n'
      + '  const progress = spring({ frame, fps, config: { damping: 14, stiffness: 100 } });\n'
      + '  return (\n'
      + '    <AbsoluteFill style={{\n'
      + '      backgroundColor: ' + (t.dark ? "'#000000'" : "'#ffffff'") + ',\n'
      + '      display: "flex",\n'
      + '      alignItems: "center",\n'
      + '      justifyContent: "center",\n'
      + '      padding: "6%",\n'
      + '      color: ' + (t.dark ? "'#ffffff'" : "'#000000'") + '\n'
      + '    }}>\n'
      + '      <div style={{\n'
      + '        transform: "scale(" + progress + ")",\n'
      + '        textAlign: "center"\n'
      + '      }}>\n'
      + '        <h1 style={{ fontSize: 40, fontWeight: 900, color: "' + (t.accent || "#ffffff") + '" }}>\n'
      + '          ' + esc(t.name) + '\n'
      + '        </h1>\n'
      + '      </div>\n'
      + '    </AbsoluteFill>\n'
      + '  );\n'
      + '}';
  }

  return {
    cats: cats, list: list, build: build, buildCustom: buildCustom,
    fonts: fonts, aspects: aspects, getReactCode: getReactCode
  };
})();

