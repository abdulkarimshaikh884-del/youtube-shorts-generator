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

  /* The watermark is on unless the caller explicitly turns it off. Only the
     export route does that, and only after reading the plan from the credit
     ledger — never from anything the browser sent. Defaulting to ON means a
     new call site, or a forgotten option, leaks a watermark rather than
     silently giving away the paid feature. */
  function wmHtml(o) {
    if (o && o.watermark === false) return "";
    return '<div class="wm">shortscraft.online</div>';
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
      + '@keyframes swFadeUp{0%{opacity:0;transform:translateY(30px)}100%{opacity:1;transform:translateY(0)}}'
      + '@keyframes swPop{0%{opacity:0;transform:scale(0.85)}100%{opacity:1;transform:scale(1)}}'
      + '@keyframes swBlink{0%,49%{opacity:1}50%,100%{opacity:0}}'
      + '@keyframes swFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.5cqh)}}'
      + '@keyframes swPulse{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(1.05);opacity:1}}'
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
     💥 3 NEW ULTRA-PREMIUM REMOTION KINETIC TEXT TEMPLATES 💥
     ============================================================ */

  /* 1. Vox Kinetic Power Impact */
  T["text-vox-impact"] = {
    name: "Vox Kinetic Power Impact", cat: "text", dark: true, accent: "#38BDF8",
    desc: "Magnates Media & Vox style editorial power hook with camera shake impact, RGB chromatic displacement, and glowing golden keyword",
    css: '.vx-imp-wrap{position:absolute;inset:0;background:#08090C;color:#ffffff;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 8cqw;text-align:center;font-family:Inter,system-ui,sans-serif}'
      + '.vx-imp-grid{position:absolute;inset:0;opacity:0.12;background-image:linear-gradient(to right,rgba(255,255,255,0.08) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,0.08) 1px,transparent 1px);background-size:6cqw 6cqw;pointer-events:none}'
      + '.vx-imp-glow{position:absolute;top:40%;left:50%;transform:translate(-50%,-50%);width:85cqw;height:55cqh;border-radius:50%;background:radial-gradient(circle,rgba(56,189,248,0.2) 0%,transparent 70%);filter:blur(60px);pointer-events:none}'
      + '.vx-imp-cross{position:absolute;color:rgba(255,255,255,0.3);font-size:3.5cqw;font-family:ui-monospace,monospace;font-weight:900}'
      + '.vx-imp-cross.tl{top:4cqh;left:6cqw}.vx-imp-cross.tr{top:4cqh;right:6cqw}.vx-imp-cross.bl{bottom:4cqh;left:6cqw}.vx-imp-cross.br{bottom:4cqh;right:6cqw}'
      + '.vx-imp-badge{display:inline-flex;align-items:center;gap:1.5cqw;background:rgba(56,189,248,0.15);border:1.5px solid rgba(56,189,248,0.5);padding:1cqh 4cqw;border-radius:999px;margin-bottom:3cqh;box-shadow:0 0 30px rgba(56,189,248,0.2);animation:swPulse var(--D) infinite alternate}'
      + '.vx-imp-dot{width:2.2cqw;height:2.2cqw;border-radius:50%;background:#38BDF8;box-shadow:0 0 12px #38BDF8}'
      + '.vx-imp-badgetext{font-family:ui-monospace,monospace;font-size:2.8cqw;font-weight:800;letter-spacing:.25em;color:#38BDF8;text-transform:uppercase}'
      + '.vx-imp-l1{font-size:7.5cqw;font-weight:800;letter-spacing:-.03em;color:#E2E8F0;margin:0;line-height:1.1;text-transform:uppercase;animation:swFadeUp var(--D) var(--sp) infinite alternate}'
      + '.vx-imp-power{position:relative;font-size:11cqw;font-weight:950;letter-spacing:-.04em;color:#FFD700;line-height:1;text-transform:uppercase;margin:2cqh 0 3cqh;text-shadow:0 0 40px rgba(255,215,0,0.6),0 10px 30px rgba(0,0,0,0.9);animation:swPop var(--D) var(--ov) infinite alternate}'
      + '.vx-imp-l3{font-size:3.6cqw;font-weight:500;color:#94A3B8;margin:0;line-height:1.4;max-width:85%;animation:swFadeUp var(--D) var(--sp) infinite alternate}',
    html: function (o) {
      var tag = getP(o, "tag", "VIRAL HOOK FRAMEWORK");
      var l1 = getP(o, "l1", o.lines[0] || "STOP MAKING");
      var power = getP(o, "power", o.lines[1] || "BORING VIDEOS");
      var l3 = getP(o, "l3", o.lines[2] || "Retention decides everything.");
      return '<div class="vx-imp-wrap">'
        + '<div class="vx-imp-grid"></div>'
        + '<div class="vx-imp-glow"></div>'
        + '<div class="vx-imp-cross tl">+</div><div class="vx-imp-cross tr">+</div><div class="vx-imp-cross bl">+</div><div class="vx-imp-cross br">+</div>'
        + '<div class="vx-imp-badge"><div class="vx-imp-dot"></div><span class="vx-imp-badgetext">' + esc(tag) + '</span></div>'
        + '<h2 class="vx-imp-l1">' + esc(l1) + '</h2>'
        + '<h1 class="vx-imp-power">' + esc(power) + '</h1>'
        + '<p class="vx-imp-l3">' + esc(l3) + '</p>'
        + '</div>';
    }
  };

  /* 2. Elastic Typography Wave Stream */
  T["text-elastic-wave"] = {
    name: "Elastic Typography Wave Stream", cat: "text", dark: false, accent: "#0A11F6",
    desc: "Swishy signature organic elastic kinetic typography stream flowing with SVG gooey filter and smooth wave motion",
    css: '.el-wv-wrap{position:absolute;inset:0;background:#ffffff;overflow:hidden;display:flex;justify-content:center;align-items:center;font-family:"Source Code Pro",ui-monospace,monospace}'
      + '.el-wv-stream{position:absolute;top:50%;left:0;right:0;display:flex;flex-direction:column;align-items:center;animation:elWaveScroll 6s linear infinite}'
      + '.el-wv-pill{background:#0A11F6;color:#ffffff;padding:1.8cqh 6cqw;border-radius:999px;font-size:6.5cqw;font-weight:800;line-height:1;white-space:nowrap;margin-top:-2.2cqh;box-shadow:0 20px 50px rgba(10,17,246,0.35);letter-spacing:-.02em}'
      + '@keyframes elWaveScroll{0%{transform:translateY(0)}100%{transform:translateY(-50%)}}',
    html: function (o) {
      var w1 = getP(o, "w1", o.lines[0] || "SWISHY");
      var w2 = getP(o, "w2", o.lines[1] || "MOTION");
      var w3 = getP(o, "w3", o.lines[2] || "DESIGN");
      var w4 = getP(o, "w4", "2026");
      var pills = [w1, w2, w3, w4, w1, w2, w3, w4, w1, w2, w3, w4];
      var pillsHtml = pills.map(function (p, i) {
        var rot = (i % 2 === 0 ? 1 : -1) * (4 + (i % 3) * 2);
        var transX = (i % 2 === 0 ? 1 : -1) * (15 + (i % 4) * 5);
        return '<div class="el-wv-pill" style="transform:translateX(' + transX + 'px) rotate(' + rot + 'deg);">' + esc(p) + '</div>';
      }).join("");
      return '<div class="el-wv-wrap">'
        + '<div class="el-wv-stream">' + pillsHtml + '</div>'
        + '</div>';
    }
  };

  /* 3. 3D Kinetic Slot Machine Hook */
  T["text-slot-machine"] = {
    name: "3D Kinetic Slot Machine Hook", cat: "text", dark: true, accent: "#F59E0B",
    desc: "Viral 3D slot machine cylindrical ticker that spins rapidly through keywords and locks into the winning hook word",
    css: '.sl-mc-wrap{position:absolute;inset:0;background:#0A0B10;color:#ffffff;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 6cqw;font-family:Inter,system-ui,sans-serif}'
      + '.sl-mc-grid{position:absolute;inset:0;opacity:0.15;background-image:linear-gradient(to right,rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,0.06) 1px,transparent 1px);background-size:8cqw 8cqw;pointer-events:none}'
      + '.sl-mc-glow{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:85cqw;height:45cqh;border-radius:50%;background:radial-gradient(ellipse,rgba(245,158,11,0.25) 0%,transparent 70%);filter:blur(80px);pointer-events:none}'
      + '.sl-mc-prefix{font-family:ui-monospace,monospace;font-size:3.6cqw;font-weight:800;letter-spacing:.25em;color:#94A3B8;text-transform:uppercase;margin-bottom:3cqh;animation:swFadeUp var(--D) var(--sp) infinite alternate}'
      + '.sl-mc-reel{position:relative;width:100%;height:14cqh;border-top:2px solid rgba(245,158,11,0.8);border-bottom:2px solid rgba(245,158,11,0.8);background:rgba(15,23,42,0.6);box-shadow:0 0 50px rgba(245,158,11,0.25),inset 0 0 25px rgba(0,0,0,0.8);border-radius:3cqw;display:flex;align-items:center;justify-content:center;overflow:hidden;animation:swPop var(--D) var(--ov) infinite alternate}'
      + '.sl-mc-tick{position:absolute;color:#F59E0B;font-size:3.5cqw;font-weight:900;z-index:15}'
      + '.sl-mc-tick.left{left:4cqw}.sl-mc-tick.right{right:4cqw}'
      + '.sl-mc-word{font-size:8.5cqw;font-weight:950;letter-spacing:-.03em;text-transform:uppercase;color:#F59E0B;text-shadow:0 0 35px #F59E0B,0 0 70px rgba(245,158,11,0.6);animation:swPulse var(--D) infinite alternate}'
      + '.sl-mc-suffix{font-size:4.2cqw;font-weight:900;letter-spacing:.1em;color:#E2E8F0;text-transform:uppercase;margin-top:3.5cqh;text-shadow:0 4px 15px rgba(0,0,0,0.8);animation:swFadeUp var(--D) var(--sp) infinite alternate}',
    html: function (o) {
      var prefix = getP(o, "prefix", o.lines[0] || "THE #1 SECRET TO");
      var word = getP(o, "word", o.lines[1] || "RETENTION");
      var suffix = getP(o, "suffix", o.lines[2] || "IS HOOK VELOCITY");
      return '<div class="sl-mc-wrap">'
        + '<div class="sl-mc-grid"></div>'
        + '<div class="sl-mc-glow"></div>'
        + '<div class="sl-mc-prefix">' + esc(prefix) + '</div>'
        + '<div class="sl-mc-reel">'
        + '<div class="sl-mc-tick left">▶</div>'
        + '<div class="sl-mc-word">' + esc(word) + '</div>'
        + '<div class="sl-mc-tick right">◀</div>'
        + '</div>'
        + '<div class="sl-mc-suffix">' + esc(suffix) + '</div>'
        + '</div>';
    }
  };



  

  
  
  
  
  
  /* ============================================================
     ✨ OFFICIAL SWISHY.AI REVERSE-ENGINEERED VIRAL TEMPLATES ✨
     ============================================================ */

  /* 1. Swishy Squiggle Flow Kinetic Stream */
  T["swishy-squiggle-stream"] = {
    name: "Squiggle Flow Kinetic Stream", cat: "text", dark: false, accent: "#0A11F6",
    desc: "Swishy signature organic metaball kinetic text stream flowing through SVG gooey filter with rotating capsules",
    css: '.sw-sq-wrap{position:absolute;inset:0;background:#ffffff;overflow:hidden;display:flex;justify-content:space-evenly;align-items:center;font-family:"Source Code Pro",ui-monospace,monospace}'
      + '.sw-sq-stream{display:flex;flex-direction:column;align-items:center;width:100%;animation:swStreamScroll 6s linear infinite}'
      + '.sw-sq-pill{background:#0A11F6;color:#ffffff;padding:1.4cqh 5cqw;border-radius:999px;font-size:5.5cqw;font-weight:700;line-height:1;white-space:nowrap;margin-top:-1.8cqh;box-shadow:0 10px 30px rgba(10,17,246,0.3)}'
      + '@keyframes swStreamScroll{0%{transform:translateY(0)}100%{transform:translateY(-50%)}}',
    html: function (o) {
      var w1 = getP(o, "w1", o.lines[0] || "SWISHY");
      var w2 = getP(o, "w2", o.lines[1] || "VIRAL");
      var w3 = getP(o, "w3", o.lines[2] || "MOTION");
      var w4 = getP(o, "w4", "2026");
      var pills = [w1, w2, w3, w4, w1, w2, w3, w4, w1, w2, w3, w4];
      var pillsHtml = pills.map(function (p, i) {
        var rot = (i % 2 === 0 ? 1 : -1) * (3 + (i % 3) * 2);
        var transX = (i % 2 === 0 ? 1 : -1) * (10 + (i % 4) * 4);
        return '<div class="sw-sq-pill" style="transform:translateX(' + transX + 'px) rotate(' + rot + 'deg);">' + esc(p) + '</div>';
      }).join("");
      return '<div class="sw-sq-wrap">'
        + '<div class="sw-sq-stream">' + pillsHtml + '</div>'
        + '</div>';
    }
  };

  /* 2. Swishy Stretchy Elastic Typography */
  T["swishy-stretchy-pill"] = {
    name: "Stretchy Elastic Pill Caps", cat: "text", dark: false, accent: "#D6FB00",
    desc: "Swishy signature expanding stretchy neon lime pills with responsive letter spacing and animated connecting squiggles",
    css: '.sw-str-wrap{position:absolute;inset:0;background:#DCE0E2;overflow:hidden;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:6cqw;font-family:Inter,system-ui,sans-serif}'
      + '.sw-str-box{display:flex;flex-direction:column;gap:1.8cqh;width:100%;align-items:center}'
      + '.sw-str-pill{background:#D6FB00;border-radius:999px;padding:1.2cqh 4cqw;display:flex;align-items:center;justify-content:space-between;color:#0F0F0F;font-size:4.8cqw;font-weight:700;box-shadow:0 12px 30px rgba(0,0,0,0.12);animation:swStretch 2.5s cubic-bezier(.34,1.56,.64,1) infinite alternate}'
      + '.sw-str-line{flex-grow:1;height:2px;background:#0F0F0F;margin:0 2cqw;opacity:0.8}'
      + '@keyframes swStretch{0%{width:65%}100%{width:95%}}',
    html: function (o) {
      var l1 = getP(o, "l1", o.lines[0] || "SWISHY");
      var l2 = getP(o, "l2", o.lines[1] || "CREATE");
      var l3 = getP(o, "l3", o.lines[2] || "MOTION");
      return '<div class="sw-str-wrap">'
        + '<div class="sw-str-box">'
        + '<div class="sw-str-pill" style="animation-delay:0s;"><span>S</span><div class="sw-str-line"></div><span>W</span><div class="sw-str-line"></div><span>I</span><span>S</span><div class="sw-str-line"></div><span>H</span><span>Y</span></div>'
        + '<div class="sw-str-pill" style="animation-delay:0.2s;"><span>C</span><div class="sw-str-line"></div><span>R</span><span>E</span><div class="sw-str-line"></div><span>A</span><span>T</span><span>E</span></div>'
        + '<div class="sw-str-pill" style="animation-delay:0.4s;"><span>M</span><div class="sw-str-line"></div><span>O</span><div class="sw-str-line"></div><span>T</span><span>I</span><span>O</span><span>N</span></div>'
        + '</div>'
        + '</div>';
    }
  };

  /* 3. Swishy Vinyl Record Track Player */
  T["swishy-vinyl-player"] = {
    name: "Spotify Vinyl Record Player", cat: "social", dark: true, accent: "#1DB954",
    desc: "Rotating vinyl record disc with realistic vinyl grooves, scrolling marquee song title, Spotify UI controls, and animated progress track",
    css: '.sw-vn-wrap{position:absolute;inset:0;background:#121212;color:#ffffff;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8cqw;font-family:Inter,system-ui,sans-serif}'
      + '.sw-vn-disc{width:65cqw;height:65cqw;border-radius:50%;background:#1A1A1A;position:relative;box-shadow:0 25px 70px rgba(0,0,0,0.9),0 0 0 2px rgba(255,255,255,0.05);display:flex;justify-content:center;align-items:center;animation:swSpin 6s linear infinite}'
      + '.sw-vn-grooves{position:absolute;inset:0;border-radius:50%;background:repeating-radial-gradient(circle,transparent 0px,transparent 3px,rgba(255,255,255,0.03) 3px,rgba(255,255,255,0.03) 4px);pointer-events:none}'
      + '.sw-vn-center{width:28cqw;height:28cqw;border-radius:50%;background:#ffffff;overflow:hidden;position:relative;display:flex;justify-content:center;align-items:center;box-shadow:0 0 20px rgba(0,0,0,0.5)}'
      + '.sw-vn-cover{width:100%;height:100%;background:linear-gradient(135deg,#6366F1,#EC4899);display:flex;align-items:center;justify-content:center;font-size:6cqw;color:#fff;font-weight:900}'
      + '.sw-vn-spindle{position:absolute;width:5cqw;height:5cqw;border-radius:50%;background:#121212;box-shadow:inset 0 2px 5px rgba(0,0,0,0.8)}'
      + '.sw-vn-meta{width:100%;margin-top:4cqh;display:flex;flex-direction:column;gap:.6cqh}'
      + '.sw-vn-title{font-size:5.5cqw;font-weight:700;color:#ffffff;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      + '.sw-vn-artist{font-size:3.6cqw;color:#b3b3b3;font-weight:500}'
      + '.sw-vn-track{width:100%;height:4px;background:#333;border-radius:2px;margin-top:2.5cqh;position:relative}'
      + '.sw-vn-prog{position:absolute;left:0;top:0;height:100%;width:55%;background:#1DB954;border-radius:2px;animation:swProg 6s linear infinite}'
      + '.sw-vn-ctrls{display:flex;justify-content:center;align-items:center;gap:6cqw;margin-top:3cqh}'
      + '.sw-vn-btn{background:none;border:none;color:#ffffff;font-size:6cqw;cursor:pointer}'
      + '.sw-vn-btn.play{width:14cqw;height:14cqw;border-radius:50%;background:#ffffff;color:#121212;display:flex;align-items:center;justify-content:center;font-size:5cqw;box-shadow:0 10px 25px rgba(255,255,255,0.2)}'
      + '@keyframes swSpin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}'
      + '@keyframes swProg{0%{width:0%}100%{width:100%}}',
    html: function (o) {
      var song = getP(o, "song", o.lines[0] || "Midnight City Vibes");
      var artist = getP(o, "artist", o.lines[1] || "ShortsCraft & Swishy");
      return '<div class="sw-vn-wrap">'
        + '<div class="sw-vn-disc">'
        + '<div class="sw-vn-grooves"></div>'
        + '<div class="sw-vn-center">'
        + '<div class="sw-vn-cover">🎵</div>'
        + '<div class="sw-vn-spindle"></div>'
        + '</div>'
        + '</div>'
        + '<div class="sw-vn-meta">'
        + '<div class="sw-vn-title">' + esc(song) + '</div>'
        + '<div class="sw-vn-artist">' + esc(artist) + '</div>'
        + '<div class="sw-vn-track"><div class="sw-vn-prog"></div></div>'
        + '</div>'
        + '<div class="sw-vn-ctrls">'
        + '<span class="sw-vn-btn">⏮</span>'
        + '<span class="sw-vn-btn play">⏸</span>'
        + '<span class="sw-vn-btn">⏭</span>'
        + '</div>'
        + '</div>';
    }
  };

  /* 4. Swishy GitHub Star History Graph */
  T["swishy-github-stars"] = {
    name: "GitHub Star History Graph", cat: "charts", dark: false, accent: "#E85D3B",
    desc: "Clean GitHub Star History chart with animated coordinate line plot, repo badge, and star count markers",
    css: '.sw-gh-wrap{position:absolute;inset:0;background:#ffffff;overflow:hidden;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:6cqw;font-family:Inter,system-ui,sans-serif}'
      + '.sw-gh-head{display:flex;align-items:center;gap:2cqw;margin-bottom:2cqh}'
      + '.sw-gh-title{font-size:5.5cqw;font-weight:700;color:#1a1a1a}'
      + '.sw-gh-badge{background:#ffffff;border:1px solid #e5e5e5;border-radius:4px;padding:.5cqh 3cqw;font-size:3cqw;color:#1a1a1a;margin-bottom:3cqh;display:flex;align-items:center;gap:1.5cqw;box-shadow:0 2px 6px rgba(0,0,0,0.05)}'
      + '.sw-gh-dot{width:2.5cqw;height:2.5cqw;background:#E85D3B;border-radius:50%}'
      + '.sw-gh-stage{position:relative;width:85cqw;height:40cqh;border:1px solid #e5e5e5;border-radius:4px;background:#FAFAFA;padding:2cqh 2cqw}'
      + '.sw-gh-svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}'
      + '.sw-gh-line{fill:none;stroke:#E85D3B;stroke-width:3.5;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1200;stroke-dashoffset:1200;animation:swDrawLine 3s cubic-bezier(.16,1,.3,1) infinite}'
      + '.sw-gh-grid{stroke:#e5e5e5;stroke-dasharray:4 4;stroke-width:1}'
      + '.sw-gh-kpi{position:absolute;top:15%;right:8%;background:#1A1A1A;color:#fff;padding:.6cqh 2.5cqw;border-radius:999px;font-family:ui-monospace,monospace;font-size:3.2cqw;font-weight:700;animation:swPop 1s cubic-bezier(.34,1.56,.64,1) both}'
      + '@keyframes swDrawLine{0%{stroke-dashoffset:1200}60%,100%{stroke-dashoffset:0}}',
    html: function (o) {
      var repo = getP(o, "repo", o.lines[0] || "ShortsCraft/engine");
      var stars = getP(o, "stars", "28,400 Stars");
      return '<div class="sw-gh-wrap">'
        + '<div class="sw-gh-head">'
        + '<span style="font-size:6cqw;">⭐</span>'
        + '<div class="sw-gh-title">Star History</div>'
        + '</div>'
        + '<div class="sw-gh-badge"><div class="sw-gh-dot"></div>' + esc(repo) + '</div>'
        + '<div class="sw-gh-stage">'
        + '<svg class="sw-gh-svg" viewBox="0 0 800 500">'
        + '<line x1="50" y1="100" x2="750" y2="100" class="sw-gh-grid"/>'
        + '<line x1="50" y1="250" x2="750" y2="250" class="sw-gh-grid"/>'
        + '<line x1="50" y1="400" x2="750" y2="400" class="sw-gh-grid"/>'
        + '<path d="M 60 440 C 200 420, 380 340, 520 200 C 620 100, 700 60, 750 40" class="sw-gh-line"/>'
        + '</svg>'
        + '<div class="sw-gh-kpi">✦ ' + esc(stars) + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* 5. Swishy Social Creator Profile Card */
  T["swishy-creator-card"] = {
    name: "Social Creator Profile Card", cat: "social", dark: false, accent: "#3B82F6",
    desc: "Instagram style creator profile badge with verified stats counter, animated bio reveal, and interactive follow actions",
    css: '.sw-pr-wrap{position:absolute;inset:0;background:#ffffff;overflow:hidden;display:flex;align-items:center;justify-content:center;padding:6cqw;font-family:Inter,system-ui,sans-serif}'
      + '.sw-pr-card{width:86cqw;background:#FAFAFA;border:1px solid #E5E7EB;border-radius:5cqw;padding:4cqh 5cqw;box-shadow:0 25px 60px rgba(0,0,0,0.06);animation:swPop var(--D) var(--ov) infinite alternate}'
      + '.sw-pr-top{display:flex;align-items:center;gap:4cqw;margin-bottom:2.5cqh}'
      + '.sw-pr-avatar{width:16cqw;height:16cqw;border-radius:50%;background:linear-gradient(135deg,#3B82F6,#8B5CF6);display:flex;align-items:center;justify-content:center;color:#fff;font-size:7cqw;font-weight:900;animation:swPulse var(--D) infinite alternate}'
      + '.sw-pr-stats{display:flex;gap:4cqw;flex:1;justify-content:space-around}'
      + '.sw-pr-stat{text-align:center}'
      + '.sw-pr-stat b{font-size:4.2cqw;font-weight:800;color:#111827;display:block}'
      + '.sw-pr-stat small{font-size:2.8cqw;color:#6B7280}'
      + '.sw-pr-name{font-size:4.5cqw;font-weight:800;color:#111827;margin-bottom:.5cqh}'
      + '.sw-pr-bio{font-size:3.2cqw;color:#4B5563;line-height:1.4;margin-bottom:3cqh}'
      + '.sw-pr-btns{display:flex;gap:2cqw}'
      + '.sw-pr-btn{flex:1;padding:1.2cqh 0;border-radius:2.5cqw;font-size:3.4cqw;font-weight:700;text-align:center;border:none}'
      + '.sw-pr-btn.primary{background:#3B82F6;color:#ffffff;box-shadow:0 4px 15px rgba(59,130,246,0.3)}'
      + '.sw-pr-btn.sec{background:#E5E7EB;color:#111827}',
    html: function (o) {
      var handle = getP(o, "handle", o.lines[0] || "ShortsCraft Official");
      var bio = getP(o, "bio", o.lines[1] || "Automating cinematic motion graphics for 100K+ content creators.");
      var followers = getP(o, "followers", "143K");
      return '<div class="sw-pr-wrap">'
        + '<div class="sw-pr-card">'
        + '<div class="sw-pr-top">'
        + '<div class="sw-pr-avatar">⚡</div>'
        + '<div class="sw-pr-stats">'
        + '<div class="sw-pr-stat"><b>184</b><small>posts</small></div>'
        + '<div class="sw-pr-stat"><b>' + esc(followers) + '</b><small>followers</small></div>'
        + '<div class="sw-pr-stat"><b>320</b><small>following</small></div>'
        + '</div>'
        + '</div>'
        + '<div class="sw-pr-name">@' + esc(handle.replace(/^@/,"")) + ' ✦</div>'
        + '<div class="sw-pr-bio">' + esc(bio) + '</div>'
        + '<div class="sw-pr-btns">'
        + '<div class="sw-pr-btn primary">Follow</div>'
        + '<div class="sw-pr-btn sec">Message</div>'
        + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* 6. Swishy Global Flight Route Curve */
  T["swishy-flight-route"] = {
    name: "Global Flight Route Arc", cat: "maps", dark: true, accent: "#3B82F6",
    desc: "Global route map with smooth Bézier flight path arc, animated plane icon, pulsing origin/destination nodes, and glowing city markers",
    css: '.sw-fl-wrap{position:absolute;inset:0;background:#060814;color:#ffffff;overflow:hidden;font-family:Inter,system-ui,sans-serif}'
      + '.sw-fl-map{position:absolute;inset:0;opacity:0.25;background-image:radial-gradient(circle at center,#3B82F6 1px,transparent 1px);background-size:24px 24px}'
      + '.sw-fl-svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}'
      + '.sw-fl-arc{fill:none;stroke:#3B82F6;stroke-width:3;stroke-dasharray:8 6;filter:drop-shadow(0 0 10px #3B82F6);animation:swFlightPath 3s linear infinite}'
      + '.sw-fl-node{position:absolute;width:4cqw;height:4cqw;border-radius:50%;background:#60A5FA;box-shadow:0 0 20px #3B82F6;display:flex;align-items:center;justify-content:center}'
      + '.sw-fl-node.n1{top:45%;left:15%}'
      + '.sw-fl-node.n2{top:35%;right:15%}'
      + '.sw-fl-tag{position:absolute;top:120%;background:rgba(0,0,0,0.8);border:1px solid rgba(59,130,246,0.4);border-radius:999px;padding:.4cqh 3cqw;font-family:ui-monospace,monospace;font-size:3cqw;font-weight:800;color:#93C5FD;white-space:nowrap;transform:translateX(-40%)}'
      + '.sw-fl-plane{position:absolute;top:32%;left:50%;font-size:6cqw;transform:translate(-50%,-50%) rotate(25deg);animation:swPlaneHover 2s ease-in-out infinite alternate}'
      + '@keyframes swFlightPath{0%{stroke-dashoffset:100}100%{stroke-dashoffset:0}}'
      + '@keyframes swPlaneHover{0%{transform:translate(-50%,-50%) rotate(20deg) scale(1)}100%{transform:translate(-50%,-50%) rotate(28deg) scale(1.15)}}',
    html: function (o) {
      var from = getP(o, "from", o.lines[0] || "NEW YORK");
      var to = getP(o, "to", o.lines[1] || "DUBAI");
      return '<div class="sw-fl-wrap">'
        + '<div class="sw-fl-map"></div>'
        + '<svg class="sw-fl-svg" viewBox="0 0 1000 1600">'
        + '<path d="M 180 750 Q 500 450 820 580" class="sw-fl-arc"/>'
        + '</svg>'
        + '<div class="sw-fl-node n1"><div class="sw-fl-tag">' + esc(from) + '</div></div>'
        + '<div class="sw-fl-node n2"><div class="sw-fl-tag">' + esc(to) + '</div></div>'
        + '<div class="sw-fl-plane">✈️</div>'
        + '</div>';
    }
  };



  /* ============================================================
     🚀 SWISHY.AI & AUTOAE SIGNATURE VIRAL SUITE (8 Ultra-High-Converting Templates)
     ============================================================ */

  /* 1. Swishy Upwork 41% Metric Stat */
  T["swishy-upwork-ad"] = {
    name: "Upwork 41% Metric Stat", cat: "money", dark: true, accent: "#1FD614",
    desc: "Upwork style green gradient 41% metric stat with glowing neon counter and two-line headline",
    css: '.sw-upwork-wrap{position:absolute;inset:0;background:#000000;color:#ffffff;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif}'
      + '.sw-upwork-bg{position:absolute;inset:0;background:linear-gradient(to bottom,#000000 0%,#000000 35%,rgba(0,35,2,.95) 55%,rgba(0,90,0,.98) 72%,#00A300 90%,#00C800 100%);opacity:.95}'
      + '.sw-upwork-brand{position:relative;z-index:5;font-size:7cqw;font-weight:700;letter-spacing:-.02em;color:#ffffff;margin-bottom:2cqh;animation:swFadeUp var(--D) var(--ae-spring) infinite alternate}'
      + '.sw-upwork-metric{position:relative;z-index:5;font-size:26cqw;font-weight:900;line-height:1;letter-spacing:-.04em;color:#1FD614;text-shadow:0 0 35px rgba(31,214,20,.65),0 0 70px rgba(31,214,20,.35);margin:1.5cqh 0;animation:swPop var(--D) var(--ae-spring) infinite alternate}'
      + '.sw-upwork-sub1{position:relative;z-index:5;font-size:4.2cqw;font-weight:400;color:rgba(255,255,255,.85);margin-bottom:.8cqh;text-align:center;animation:swFadeUp var(--D) var(--ae-spring) infinite alternate}'
      + '.sw-upwork-sub2{position:relative;z-index:5;font-size:5cqw;font-weight:700;color:#ffffff;text-align:center;max-width:85%;animation:swFadeUp var(--D) var(--ae-spring) infinite alternate}'
      + '@keyframes swFadeUp{0%,20%{opacity:0;transform:translateY(30px)}60%,100%{opacity:1;transform:translateY(0)}}'
      + '@keyframes swPop{0%,20%{opacity:0;transform:scale(0.85)}60%,100%{opacity:1;transform:scale(1)}}',
    html: function (o) {
      var brand = getP(o, "brand", o.lines[0] || "Upwork");
      var metric = getP(o, "metric", "41%");
      var sub1 = getP(o, "sub1", o.lines[1] || "of top companies agree");
      var sub2 = getP(o, "sub2", o.lines[2] || "AI works best when humans lead.");
      return '<div class="sw-upwork-wrap">'
        + '<div class="sw-upwork-bg"></div>'
        + '<div class="sw-upwork-bloom"></div>'
        + '<div class="sw-upwork-brand">' + esc(brand) + '</div>'
        + '<div class="sw-upwork-metric">' + esc(metric) + '</div>'
        + '<div class="sw-upwork-sub1">' + esc(sub1) + '</div>'
        + '<div class="sw-upwork-sub2">' + esc(sub2) + '</div>'
        + '</div>';
    }
  };

  /* 2. Swishy macOS Terminal Typing */
  T["swishy-terminal-typing"] = {
    name: "macOS Terminal Code Typing", cat: "ui", dark: true, accent: "#00F2FE",
    desc: "macOS dark code terminal with traffic-light dots, token-aware syntax highlighting and neon cyan blinking cursor",
    css: '.sw-term-wrap{position:absolute;inset:0;background:#0A0A0C;color:#ffffff;overflow:hidden;display:flex;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif}'
      + '.sw-term-glow{position:absolute;width:90cqw;height:50cqh;background:radial-gradient(ellipse at center,rgba(0,242,254,.15) 0%,transparent 70%);filter:blur(50px);pointer-events:none}'
      + '.sw-term-card{position:relative;z-index:5;width:86cqw;background:#12131A;border:1px solid rgba(255,255,255,.1);border-radius:4cqw;box-shadow:0 30px 80px rgba(0,0,0,.9);overflow:hidden;animation:swPop var(--D) var(--ae-spring) infinite alternate}'
      + '.sw-term-head{height:7cqh;background:#181924;border-bottom:1px solid rgba(255,255,255,.05);display:flex;align-items:center;justify-content:space-between;padding:0 4cqw}'
      + '.sw-term-dots{display:flex;gap:1.8cqw}'
      + '.sw-tdot{width:2.6cqw;height:2.6cqw;border-radius:50%}'
      + '.sw-tdot.red{background:#FF5F56}.sw-tdot.yel{background:#FFBD2E}.sw-tdot.grn{background:#27C93F}'
      + '.sw-term-title{font-family:ui-monospace,monospace;font-size:3.2cqw;color:#9ca3af;font-weight:500}'
      + '.sw-term-body{padding:4cqh 5cqw;font-family:ui-monospace,monospace;font-size:4.8cqw;line-height:1.5;color:#e5e7eb}'
      + '.sw-kw{color:#EC4899;font-weight:600;margin-right:1.5cqw}'
      + '.sw-var{color:#E5E7EB;margin-right:1.5cqw}'
      + '.sw-op{color:#F472B6;margin-right:1.5cqw}'
      + '.sw-str{color:#FBBF24}'
      + '.sw-cursor{display:inline-block;width:.8cqw;height:4.5cqw;background:#00F2FE;margin-left:1cqw;vertical-align:middle;box-shadow:0 0 10px #00F2FE;animation:swBlink 0.9s infinite}'
      + '@keyframes swBlink{0%,49%{opacity:1}50%,100%{opacity:0}}',
    html: function (o) {
      var file = getP(o, "file", "index.ts");
      return '<div class="sw-term-wrap">'
        + '<div class="sw-term-glow"></div>'
        + '<div class="sw-term-card">'
        + '<div class="sw-term-head">'
        + '<div class="sw-term-dots"><div class="sw-tdot red"></div><div class="sw-tdot yel"></div><div class="sw-tdot grn"></div></div>'
        + '<div class="sw-term-title">' + esc(file) + '</div>'
        + '<div style="width:8cqw;"></div>'
        + '</div>'
        + '<div class="sw-term-body">'
        + '<span class="sw-kw">const</span><span class="sw-var">var</span><span class="sw-op">=</span><span class="sw-str">\'hello world\'</span>'
        + '<span class="sw-cursor"></span>'
        + '</div>'
        + '</div>'
        + '</div>';
    }
  };



  /* 4. Swishy iOS Alarm Spring Toggle */
  T["swishy-alarm-toggle"] = {
    name: "iOS Alarm Spring Toggle", cat: "ui", dark: true, accent: "#22C55E",
    desc: "iOS lockscreen 9:40 AM digital clock with interactive spring-physics toggle switch and glowing haptic ripple",
    css: '.sw-alm-wrap{position:absolute;inset:0;background:#0A0A0C;color:#ffffff;overflow:hidden;display:flex;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif}'
      + '.sw-alm-glow{position:absolute;width:90cqw;height:50cqh;background:radial-gradient(ellipse at center,rgba(34,197,94,.18) 0%,transparent 70%);filter:blur(60px);pointer-events:none}'
      + '.sw-alm-card{position:relative;z-index:5;width:86cqw;background:#13151D;border:1px solid rgba(255,255,255,.1);border-radius:5cqw;padding:4cqh 5cqw;box-shadow:0 30px 90px rgba(0,0,0,.9);display:flex;align-items:center;justify-content:space-between;animation:swPop var(--D) var(--ae-spring) infinite alternate}'
      + '.sw-alm-time{font-size:11cqw;font-weight:400;color:#ffffff;line-height:1;letter-spacing:-.03em}'
      + '.sw-alm-sub{font-size:3.4cqw;font-weight:500;color:#9ca3af;margin-top:1cqh;display:flex;gap:1.5cqw;align-items:center}'
      + '.sw-alm-sub span{color:#4b5563}'
      + '.sw-alm-track{width:18cqw;height:10.5cqw;background:#22C55E;border-radius:999px;position:relative;box-shadow:0 0 25px rgba(34,197,94,.5),inset 0 2px 4px rgba(0,0,0,.2);animation:swTrackFlip 3s cubic-bezier(.34,1.56,.64,1) infinite alternate}'
      + '.sw-alm-knob{width:9cqw;height:9cqw;background:#ffffff;border-radius:50%;position:absolute;top:.75cqw;left:.75cqw;box-shadow:0 4px 10px rgba(0,0,0,.35);animation:swKnobSlide 3s cubic-bezier(.34,1.56,.64,1) infinite alternate}'
      + '@keyframes swKnobSlide{0%,20%{transform:translateX(0)}60%,100%{transform:translateX(7.5cqw)}}'
      + '@keyframes swTrackFlip{0%,20%{background:#334155;box-shadow:none}60%,100%{background:#22C55E;box-shadow:0 0 25px rgba(34,197,94,.5)}}',
    html: function (o) {
      var time = getP(o, "time", o.lines[0] || "9:40 AM");
      var lbl = getP(o, "label", "Alarm");
      var sub = getP(o, "sub", "Every weekday");
      return '<div class="sw-alm-wrap">'
        + '<div class="sw-alm-glow"></div>'
        + '<div class="sw-alm-card">'
        + '<div>'
        + '<div class="sw-alm-time">' + esc(time) + '</div>'
        + '<div class="sw-alm-sub">' + esc(lbl) + ' <span>•</span> ' + esc(sub) + '</div>'
        + '</div>'
        + '<div class="sw-alm-track">'
        + '<div class="sw-alm-knob"></div>'
        + '</div>'
        + '</div>'
        + '</div>';
    }
  };

  /* 5. Swishy Notion Kinetic Typography */
  T["swishy-notion-kinetic"] = {
    name: "Notion Kinetic Typography", cat: "text", dark: true, accent: "#6366F1",
    desc: "Word-by-word staggered kinetic typography reveal with blur-to-focus and glowing pill highlight",
    css: '.sw-not-wrap{position:absolute;inset:0;background:#0A0A0C;color:#ffffff;overflow:hidden;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;padding:10cqw;font-family:Inter,system-ui,sans-serif}'
      + '.sw-not-glow{position:absolute;width:90cqw;height:50cqh;background:radial-gradient(circle,rgba(99,102,241,.18) 0%,transparent 70%);filter:blur(60px);pointer-events:none}'
      + '.sw-not-badge{position:relative;z-index:5;display:flex;align-items:center;gap:1.5cqw;padding:.8cqh 3.5cqw;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);font-family:ui-monospace,monospace;font-size:2.8cqw;font-weight:700;letter-spacing:.15em;color:#cbd5e1;text-transform:uppercase;margin-bottom:3cqh;animation:swFadeUp var(--D) var(--ae-spring) infinite alternate}'
      + '.sw-not-text{position:relative;z-index:5;font-size:7.5cqw;font-weight:750;line-height:1.2;letter-spacing:-.03em;color:#f8fafc}'
      + '.sw-not-text span{display:inline-block;margin-right:1.8cqw;animation:swBlurIn var(--D) var(--ae-spring) infinite alternate}'
      + '.sw-not-text span.hl{background:rgba(99,102,241,.25);border:1px solid rgba(99,102,241,.6);padding:.2cqh 2cqw;border-radius:2cqw;color:#ffffff;text-shadow:0 0 20px #6366F1;font-weight:900}'
      + '@keyframes swBlurIn{0%,15%{opacity:0;filter:blur(14px);transform:translateY(20px)}60%,100%{opacity:1;filter:blur(0);transform:translateY(0)}}',
    html: function (o) {
      var badge = getP(o, "badge", "PRODUCTIVITY");
      var text = getP(o, "text", o.lines[0] || "Supercharge your creative workflow with automated Remotion video pipelines.");
      var hl = getP(o, "hl", "Remotion");
      var words = text.split(/\s+/);
      var wordsHtml = words.map(function (w, i) {
        var clean = w.replace(/[^a-zA-Z0-9]/g, "");
        var isHl = clean.toLowerCase() === hl.toLowerCase();
        return '<span style="animation-delay:' + (0.1 + i * 0.08) + 's;" class="' + (isHl ? 'hl' : '') + '">' + esc(w) + '</span>';
      }).join(" ");
      return '<div class="sw-not-wrap">'
        + '<div class="sw-not-glow"></div>'
        + '<div class="sw-not-badge">✦ ' + esc(badge) + '</div>'
        + '<div class="sw-not-text">' + wordsHtml + '</div>'
        + '</div>';
    }
  };



  


  /* ============================================================
     AUTOAE EXACT 4-SCENE MASTER SUITE
     Matches: z2dugjhz-6311bd0c8643a51afd55495ef5a024116614b904.mp4
     ============================================================ */

  
  
  
  
  
  /* ============================================================
     AUTOAE FLAGSHIP SIGNATURE SERIES (8 Ultra-Premium Templates)
     ============================================================ */

  
  
  
  
  
  
  
  
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
    css: '.sc-monarch-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;align-items:center;padding:6cqh 6cqw;background:#0d0d11;overflow:hidden;box-shadow:inset 0 0 16cqw rgba(0,0,0,.95);font-family:Impact,sans-serif}.sc-monarch-crop{position:absolute;inset:4cqh 4cqw;border:1px dashed rgba(255,255,255,.15);pointer-events:none}.sc-monarch-barcode{font-family:monospace;font-size:3.2cqw;letter-spacing:.5em;color:#94a3b8;border-top:4px solid #fff;border-bottom:1px solid #fff;padding:.8cqh 0;text-align:center;width:60cqw}.sc-monarch-stage{position:relative;width:76cqw;height:52cqh;border-radius:4cqw;overflow:hidden;box-shadow:0 4cqw 14cqw rgba(0,0,0,.95),0 0 6cqw rgba(251,191,36,.12);animation:monarchZoom var(--D) cubic-bezier(.16,1,.3,1) infinite}.sc-monarch-img{width:100%;height:100%;object-fit:cover;object-position:center top}.sc-monarch-body{text-align:center;position:relative;z-index:2;display:flex;flex-direction:column;align-items:center}.sc-monarch-kicker{font-family:ui-monospace,monospace;font-size:2.8cqw;letter-spacing:.3em;color:#fbbf24;text-transform:uppercase;margin-bottom:.6cqh}.sc-monarch-title{font-size:10cqw;font-weight:900;letter-spacing:.04em;color:#ffffff;line-height:1;margin:0;text-transform:uppercase;text-shadow:0 .4cqw 2cqw rgba(0,0,0,.9)}.sc-monarch-sub{font-family:-apple-system,sans-serif;font-size:3.6cqw;font-weight:600;letter-spacing:.08em;color:#cbd5e1;margin-top:.8cqh}@keyframes monarchZoom{0%,15%{transform:scale(.94);opacity:0}30%{transform:scale(1);opacity:1}55%{transform:scale(1.012) translateY(-.4cqh);opacity:1}75%{transform:scale(1.004) translateY(.25cqh);opacity:1}85%{transform:scale(1);opacity:1}100%{transform:scale(1.05);opacity:0}}',
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

  
  
  /* ============================================================
     CATEGORY 3: KINETIC TEXT & HOOKS (10 templates)
     ============================================================ */

  
  
  
  /* 3.5 Kinetic Cascade Typography (Default Starter) */
  T["text-cascade"] = {
    name: "Type Cascade Up", cat: "text", dark: true, accent: "#38BDF8",
    desc: "Punchy word-by-word cascading typography with spring bounce easing and glowing keyword spotlight",
    css: '.tx-cas-wrap{position:absolute;inset:0;background:#08090C;color:#ffffff;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 8cqw;text-align:center;font-family:Inter,system-ui,sans-serif}'
      + '.tx-cas-glow{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:90cqw;height:55cqh;border-radius:50%;background:radial-gradient(circle,rgba(56,189,248,0.22) 0%,transparent 70%);filter:blur(60px);pointer-events:none}'
      + '.tx-cas-l1{font-size:6.8cqw;font-weight:700;letter-spacing:-.02em;color:#94A3B8;text-transform:uppercase;margin-bottom:1.5cqh;animation:swFadeUp var(--D) var(--sp) infinite alternate}'
      + '.tx-cas-l2{font-size:12.5cqw;font-weight:950;letter-spacing:-.04em;line-height:1;color:var(--ac);text-transform:uppercase;margin:0 0 2cqh;text-shadow:0 0 40px var(--ac);animation:swPop var(--D) var(--ov) infinite alternate}'
      + '.tx-cas-l3{font-size:4.5cqw;font-weight:600;color:#E2E8F0;letter-spacing:.05em;text-transform:uppercase;animation:swFadeUp var(--D) var(--sp) infinite alternate}',
    html: function (o) {
      var l1 = getP(o, "line0", o.lines[0] || "HOW TO DOUBLE");
      var l2 = getP(o, "line1", o.lines[1] || "YOUR VIEWS");
      var l3 = getP(o, "line2", o.lines[2] || "WITH MOTION GRAPHICS");
      return '<div class="tx-cas-wrap">'
        + '<div class="tx-cas-glow"></div>'
        + '<div class="tx-cas-l1">' + esc(l1) + '</div>'
        + '<h1 class="tx-cas-l2">' + esc(l2) + '</h1>'
        + '<div class="tx-cas-l3">' + esc(l3) + '</div>'
        + '</div>';
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

  
  
  
  
  
  
  
  
  
  /* ============================================================
     CATEGORY 5: FINANCE & ECONOMY (10 templates)
     ============================================================ */

  
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
      var url = getP(o, "url", "https://shortscraft.online");
      var title = getP(o, "title", o.lines[0] || "AI Motion Graphics Studio");
      var subtitle = getP(o, "subtitle", o.lines[1] || "Create Viral Animations in 60s");
      var subColor = getP(o, "subColor", "#38bdf8");
      return '<div class="sc-safari-wrap">'
        + '<div class="sc-safari-win">'
        + '<div class="sc-safari-top">'
        + '<div class="sc-safari-dot" style="background:#ef4444"></div>'
        + '<div class="sc-safari-dot" style="background:#f59e0b"></div>'
        + '<div class="sc-safari-dot" style="background:#10b981"></div>'
        + '<div style="flex:1;background:#111827;border-radius:99px;font-size:2.6cqw;color:var(--dim);text-align:center;padding:1cqw;border:1px solid rgba(255,255,255,.08)">' + esc(url) + '</div>'
        + '</div>'
        + '<div class="sc-safari-body">'
        + '<div class="sc-safari-title">' + esc(title) + '</div>'
        + '<div style="font-size:3.6cqw;color:' + esc(subColor) + ';font-weight:700;margin-top:1.5cqh">' + esc(subtitle) + '</div>'
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
      var query = getP(o, "query", o.lines[0] || "how to make viral motion graphics");
      var suggest1 = getP(o, "suggest1", o.lines[1] || "shortscraft.online (best AI generator)");
      return '<div class="ui-sch"><div class="bar"><span style="font-size:4cqw">🔍</span><b style="font-size:4cqw">' + esc(query) + '</b></div><div class="drop"><div style="font-size:3.4cqw;padding:1.5cqw 0">↳ <b>' + esc(suggest1) + '</b></div></div></div>';
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

  /* 6.5 Interactive Spring Toggle Switch */
  T["ui-toggle"] = {
    name: "Toggle Switch", cat: "ui", dark: true, accent: "#22C55E",
    desc: "Clean iOS-style spring toggle switch with dynamic state transitions and glowing haptic indicator",
    css: '.sw-tog-wrap{position:absolute;inset:0;background:#0A0B10;color:#ffffff;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 6cqw;font-family:Inter,system-ui,sans-serif}'
      + '.sw-tog-glow{position:absolute;width:90cqw;height:50cqh;background:radial-gradient(ellipse at center,rgba(34,197,94,.2) 0%,transparent 70%);filter:blur(60px);pointer-events:none}'
      + '.sw-tog-card{position:relative;z-index:5;width:86cqw;background:#13151D;border:1px solid rgba(255,255,255,.1);border-radius:5cqw;padding:4cqh 5cqw;box-shadow:0 30px 90px rgba(0,0,0,.9);display:flex;align-items:center;justify-content:space-between;animation:swPop var(--D) var(--ae-spring) infinite alternate}'
      + '.sw-tog-info{display:flex;flex-direction:column;gap:.8cqh}'
      + '.sw-tog-title{font-size:7cqw;font-weight:800;color:#ffffff;line-height:1.1;letter-spacing:-.02em}'
      + '.sw-tog-sub{font-size:3.4cqw;font-weight:500;color:#94A3B8}'
      + '.sw-tog-track{width:18cqw;height:10.5cqw;background:#22C55E;border-radius:999px;position:relative;box-shadow:0 0 25px rgba(34,197,94,.5);animation:swTrackFlip var(--D) var(--ae-spring) infinite alternate}'
      + '.sw-tog-knob{width:9cqw;height:9cqw;background:#ffffff;border-radius:50%;position:absolute;top:.75cqw;left:.75cqw;box-shadow:0 4px 10px rgba(0,0,0,.35);animation:swKnobSlide var(--D) var(--ae-spring) infinite alternate}'
      + '@keyframes swKnobSlide{0%,20%{transform:translateX(0)}60%,100%{transform:translateX(7.5cqw)}}'
      + '@keyframes swTrackFlip{0%,20%{background:#334155;box-shadow:none}60%,100%{background:var(--ac);box-shadow:0 0 25px var(--ac)}}',
    html: function (o) {
      var title = getP(o, "title", o.lines[0] || "VIRAL MODE");
      var sub = getP(o, "sub", o.lines[1] || "High-retention animations");
      return '<div class="sw-tog-wrap">'
        + '<div class="sw-tog-glow"></div>'
        + '<div class="sw-tog-card">'
        + '<div class="sw-tog-info">'
        + '<div class="sw-tog-title">' + esc(title) + '</div>'
        + '<div class="sw-tog-sub">' + esc(sub) + '</div>'
        + '</div>'
        + '<div class="sw-tog-track"><div class="sw-tog-knob"></div></div>'
        + '</div></div>';
    }
  };

  /* 6.8 Apple iOS Settings & Widget Cascade */
  T["ui-tabs"] = {
    name: "Apple iOS App List", cat: "ui", dark: true, accent: "#007aff",
    desc: "Cascading Apple iOS settings and widgets list with smooth spring reveal and app icons",
    css: '.sc-ios-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:6cqw;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,sans-serif}.sc-ios-sheet{width:86cqw;background:#ffffff;color:#000000;border-radius:5cqw;padding:6cqw;box-shadow:0 4cqw 14cqw rgba(0,0,0,.85);animation:iosPop var(--D) cubic-bezier(.16,1,.3,1) infinite}.sc-ios-hdr{display:flex;align-items:center;gap:3cqw;margin-bottom:3cqh}.sc-ios-av{width:11cqw;height:11cqw;border-radius:50%;background:#e4e4e7;display:grid;place-items:center;font-size:5cqw;overflow:hidden}.sc-ios-title{font-size:4.8cqw;font-weight:800}.sc-ios-list{display:flex;flex-direction:column;gap:1.5cqh}.sc-ios-item{display:flex;align-items:center;justify-content:space-between;padding:2cqh 3cqw;background:#f4f4f5;border-radius:3cqw}.sc-ios-left{display:flex;align-items:center;gap:3cqw}.sc-ios-icon{width:8cqw;height:8cqw;border-radius:2cqw;display:grid;place-items:center;font-size:4cqw;overflow:hidden}.sc-ios-name{font-size:3.6cqw;font-weight:700}.sc-ios-sub{font-size:2.6cqw;color:#71717a}.sc-ios-chevron{color:#a1a1aa;font-size:4cqw}@keyframes iosPop{0%,15%{transform:scale(.88) translateY(3cqh);opacity:0}30%,85%{transform:scale(1) translateY(0);opacity:1}100%{transform:scale(1.04);opacity:0}}',
    html: function (o) {
      var user = getP(o, "user", o.lines[0] || "ShortsCraft Apps");
      var avatar = getP(o, "avatar", "👤");
      var a1Name = getP(o, "app1Name", "Calendar");
      var a1Sub = getP(o, "app1Sub", getP(o, "app1", o.lines[1] || "Calendar · 2 upcoming events"));
      var a1Icon = getP(o, "app1Icon", "📅");
      var a1Color = getP(o, "app1Color", "#fee2e2");

      var a2Name = getP(o, "app2Name", "Photos");
      var a2Sub = getP(o, "app2Sub", getP(o, "app2", "Photos · 128 memories"));
      var a2Icon = getP(o, "app2Icon", "📸");
      var a2Color = getP(o, "app2Color", "#e0e7ff");

      var a3Name = getP(o, "app3Name", "Music");
      var a3Sub = getP(o, "app3Sub", getP(o, "app3", "Music · Now playing"));
      var a3Icon = getP(o, "app3Icon", "🎵");
      var a3Color = getP(o, "app3Color", "#fce7f3");

      var a4Name = getP(o, "app4Name", "Fitness");
      var a4Sub = getP(o, "app4Sub", getP(o, "app4", "Fitness · Goal 10,000 steps"));
      var a4Icon = getP(o, "app4Icon", "🏃");
      var a4Color = getP(o, "app4Color", "#dcfce7");

      return '<div class="sc-ios-wrap">'
        + '<div class="sc-ios-sheet">'
        + '<div class="sc-ios-hdr">'
        + '<div class="sc-ios-av">' + renderAvatar(avatar, "👤") + '</div>'
        + '<div class="sc-ios-title">' + esc(user) + '</div>'
        + '</div>'
        + '<div class="sc-ios-list">'
        + '<div class="sc-ios-item"><div class="sc-ios-left"><div class="sc-ios-icon" style="background:' + esc(a1Color) + '">' + renderAvatar(a1Icon, "📅") + '</div><div><div class="sc-ios-name">' + esc(a1Name) + '</div><div class="sc-ios-sub">' + esc(a1Sub) + '</div></div></div><span class="sc-ios-chevron">›</span></div>'
        + '<div class="sc-ios-item"><div class="sc-ios-left"><div class="sc-ios-icon" style="background:' + esc(a2Color) + '">' + renderAvatar(a2Icon, "📸") + '</div><div><div class="sc-ios-name">' + esc(a2Name) + '</div><div class="sc-ios-sub">' + esc(a2Sub) + '</div></div></div><span class="sc-ios-chevron">›</span></div>'
        + '<div class="sc-ios-item"><div class="sc-ios-left"><div class="sc-ios-icon" style="background:' + esc(a3Color) + '">' + renderAvatar(a3Icon, "🎵") + '</div><div><div class="sc-ios-name">' + esc(a3Name) + '</div><div class="sc-ios-sub">' + esc(a3Sub) + '</div></div></div><span class="sc-ios-chevron">›</span></div>'
        + '<div class="sc-ios-item"><div class="sc-ios-left"><div class="sc-ios-icon" style="background:' + esc(a4Color) + '">' + renderAvatar(a4Icon, "🏃") + '</div><div><div class="sc-ios-name">' + esc(a4Name) + '</div><div class="sc-ios-sub">' + esc(a4Sub) + '</div></div></div><span class="sc-ios-chevron">›</span></div>'
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
      + '@keyframes subBtnTransform{0%,16%{transform:scale(.85);opacity:0}28%{transform:scale(1.08);background:#ff0000;box-shadow:0 0 40px rgba(255,0,0,.8)}45%{transform:scale(1);background:#27272a;box-shadow:0 4px 18px rgba(0,0,0,.6)}65%{transform:scale(1.04);background:#27272a;box-shadow:0 6px 24px rgba(255,0,0,.4)}85%{transform:scale(1);background:#27272a;box-shadow:0 4px 18px rgba(0,0,0,.6)}100%{transform:scale(.95);opacity:0}}'
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
    css: '.stb{position:absolute;inset:0;padding:6cqh 5cqw;display:flex;flex-direction:column}.stb .segs{display:flex;gap:1.5cqw}.stb .seg{flex:1;height:2px;border-radius:2px;background:rgba(255,255,255,.3);overflow:hidden;position:relative}.stb .seg.done{background:#fff}.stb .seg.active .fill{position:absolute;inset:0;background:#fff;width:0;animation:stbFill var(--D) linear infinite}.stb .av{width:8cqw;height:8cqw;border-radius:50%;background:#e11d48;animation:stbAv calc(var(--D) / 3) ease-in-out infinite alternate;display:grid;place-items:center;overflow:hidden;font-size:4cqw;color:#fff}.stb h2{opacity:0;transform:scale(.92);animation:stbH2 var(--D) var(--sp) infinite}@keyframes stbFill{0%,4%{width:0}96%,100%{width:100%}}@keyframes stbAv{0%{box-shadow:0 0 0 rgba(225,29,72,0)}100%{box-shadow:0 0 1.6cqw rgba(225,29,72,.8)}}@keyframes stbH2{0%,14%{opacity:0;transform:scale(.92)}30%,100%{opacity:1;transform:scale(1)}}',
    html: function (o) {
      var handle = getP(o, "handle", o.lines[0] || "shortscraft.ai");
      var title = getP(o, "title", o.lines[1] || "Behind The Viral Edit");
      var avatar = getP(o, "avatar", "⚡");
      return '<div class="stb"><div class="segs"><div class="seg done"></div><div class="seg active"><div class="fill"></div></div><div class="seg"></div></div><div style="display:flex;align-items:center;gap:3cqw;margin-top:2cqh"><div class="av">' + renderAvatar(avatar, "⚡") + '</div><b style="font-size:3.6cqw;color:#fff">' + esc(handle) + '</b></div><div style="flex:1;display:grid;place-items:center"><h2 style="font-size:9cqw;font-weight:900;color:#fff;text-align:center">' + esc(title) + '</h2></div></div>';
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

  /* 7.9 Viral Share Sheet */
  T["social-share"] = {
    name: "Viral Share Sheet", cat: "social", dark: true, accent: "#38bdf8",
    desc: "Floating share modal with AirDrop and social platform icons",
    css: '.sc-share-wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:8cqw;background:radial-gradient(ellipse at 50% 50%,#091a33 0%,#030914 100%);overflow:hidden;font-family:Inter,sans-serif;color:#fff}'
      + '.sc-share-card{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);backdrop-filter:blur(24px);border-radius:5cqw;padding:6cqw;text-align:center;width:88%;box-shadow:0 25px 60px rgba(0,0,0,.85);animation:sharePop var(--D) cubic-bezier(.16,1,.3,1) infinite}'
      + '.sc-share-title{font-size:6.2cqw;font-weight:900;color:#fff;margin-bottom:2cqh}'
      + '.sc-share-icons{display:flex;justify-content:center;gap:4cqw;font-size:9cqw;margin-top:2cqh}'
      + '.sc-share-btn{width:16cqw;height:16cqw;border-radius:50%;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);display:grid;place-items:center;box-shadow:0 4px 15px rgba(0,0,0,.4);overflow:hidden}'
      + '@keyframes sharePop{0%,12%{transform:translateY(4cqh) scale(.92);opacity:0}24%,85%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(-2cqh);opacity:0}}',
    html: function (o) {
      var title = getP(o, "title", o.lines[0] || "Share Video");
      var icon1 = getP(o, "icon1", "📱");
      var icon2 = getP(o, "icon2", "💬");
      var icon3 = getP(o, "icon3", "🔗");
      return '<div class="sc-share-wrap">'
        + '<div class="sc-share-card">'
        + '<div class="sc-share-title">' + esc(title) + '</div>'
        + '<div class="sc-share-icons">'
        + '<div class="sc-share-btn">' + renderAvatar(icon1, "📱") + '</div>'
        + '<div class="sc-share-btn">' + renderAvatar(icon2, "💬") + '</div>'
        + '<div class="sc-share-btn">' + renderAvatar(icon3, "🔗") + '</div>'
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
      var badge = getP(o, "badge", "● LIVE STREAM");
      var title = getP(o, "title", o.lines[0] || "Editing Masterclass");
      var views = getP(o, "views", o.lines[1] || "64,200 Viewers");
      return '<div class="sc-live-wrap">'
        + '<div class="sc-live-badge">' + esc(badge) + '</div>'
        + '<div class="sc-live-title">' + esc(title) + '</div>'
        + '<div class="sc-live-views">👁️ ' + esc(views) + '</div>'
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
      var val1 = getP(o, "val1", "1.2X");
      var val2 = getP(o, "val2", "2.8X");
      var val3 = getP(o, "val3", "4.5X");
      return '<div class="sc-barrace-wrap">'
        + '<div class="sc-barrace-head">'
        + '<div class="sc-barrace-tag">' + esc(tag) + '</div>'
        + '<div class="sc-barrace-title">' + esc(title) + '</div>'
        + '</div>'
        + '<div class="sc-barrace-stage">'
        + '<div class="sc-bar-col sc-bar-b1" style="height:38%"><span class="sc-bar-val">' + esc(val1) + '</span></div>'
        + '<div class="sc-bar-col sc-bar-b2" style="height:65%"><span class="sc-bar-val">' + esc(val2) + '</span></div>'
        + '<div class="sc-bar-col sc-bar-b3" style="height:95%"><span class="sc-bar-val">' + esc(val3) + '</span></div>'
        + '</div>'
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
  "ui-tabs": {
    "fields": [
      {
        "key": "user",
        "label": "Header Title",
        "type": "text",
        "default": "ShortsCraft Apps",
        "placeholder": "e.g. ShortsCraft Apps, Creator Tools"
      },
      {
        "key": "avatar",
        "label": "Header Avatar (Emoji or Upload)",
        "type": "image",
        "default": "👤"
      },
      {
        "key": "app1Name",
        "label": "Row 1 App Title",
        "type": "text",
        "default": "Calendar"
      },
      {
        "key": "app1Sub",
        "label": "Row 1 Detail Subtitle",
        "type": "text",
        "default": "Calendar · 2 upcoming events"
      },
      {
        "key": "app1Icon",
        "label": "Row 1 Icon (Emoji or Upload)",
        "type": "image",
        "default": "📅"
      },
      {
        "key": "app1Color",
        "label": "Row 1 Icon Background",
        "type": "color",
        "default": "#fee2e2"
      },
      {
        "key": "app2Name",
        "label": "Row 2 App Title",
        "type": "text",
        "default": "Photos"
      },
      {
        "key": "app2Sub",
        "label": "Row 2 Detail Subtitle",
        "type": "text",
        "default": "Photos · 128 memories"
      },
      {
        "key": "app2Icon",
        "label": "Row 2 Icon (Emoji or Upload)",
        "type": "image",
        "default": "📸"
      },
      {
        "key": "app2Color",
        "label": "Row 2 Icon Background",
        "type": "color",
        "default": "#e0e7ff"
      },
      {
        "key": "app3Name",
        "label": "Row 3 App Title",
        "type": "text",
        "default": "Music"
      },
      {
        "key": "app3Sub",
        "label": "Row 3 Detail Subtitle",
        "type": "text",
        "default": "Music · Now playing"
      },
      {
        "key": "app3Icon",
        "label": "Row 3 Icon (Emoji or Upload)",
        "type": "image",
        "default": "🎵"
      },
      {
        "key": "app3Color",
        "label": "Row 3 Icon Background",
        "type": "color",
        "default": "#fce7f3"
      },
      {
        "key": "app4Name",
        "label": "Row 4 App Title",
        "type": "text",
        "default": "Fitness"
      },
      {
        "key": "app4Sub",
        "label": "Row 4 Detail Subtitle",
        "type": "text",
        "default": "Fitness · Goal 10,000 steps"
      },
      {
        "key": "app4Icon",
        "label": "Row 4 Icon (Emoji or Upload)",
        "type": "image",
        "default": "🏃"
      },
      {
        "key": "app4Color",
        "label": "Row 4 Icon Background",
        "type": "color",
        "default": "#dcfce7"
      }
    ],
    "defaults": {
      "user": "ShortsCraft Apps",
      "avatar": "👤",
      "app1Name": "Calendar",
      "app1Sub": "Calendar · 2 upcoming events",
      "app1Icon": "📅",
      "app1Color": "#fee2e2",
      "app2Name": "Photos",
      "app2Sub": "Photos · 128 memories",
      "app2Icon": "📸",
      "app2Color": "#e0e7ff",
      "app3Name": "Music",
      "app3Sub": "Music · Now playing",
      "app3Icon": "🎵",
      "app3Color": "#fce7f3",
      "app4Name": "Fitness",
      "app4Sub": "Fitness · Goal 10,000 steps",
      "app4Icon": "🏃",
      "app4Color": "#dcfce7"
    }
  },
  "ui-ios-notify": {
    "fields": [
      {
        "key": "app",
        "label": "App Name",
        "type": "text",
        "default": "SHORTSCRAFT"
      },
      {
        "key": "icon",
        "label": "Notification Icon (Upload or Emoji)",
        "type": "image",
        "default": "⚡"
      },
      {
        "key": "time",
        "label": "Timestamp Tag",
        "type": "text",
        "default": "now"
      },
      {
        "key": "body",
        "label": "Notification Message Preview",
        "type": "textarea",
        "default": "Your 4K Short is ready to post 🚀"
      }
    ],
    "defaults": {
      "app": "SHORTSCRAFT",
      "icon": "⚡",
      "time": "now",
      "body": "Your 4K Short is ready to post 🚀"
    }
  },
  "ui-safari-scroll": {
    "fields": [
      {
        "key": "url",
        "label": "Browser URL Address",
        "type": "text",
        "default": "https://shortscraft.online"
      },
      {
        "key": "title",
        "label": "Main Headline",
        "type": "text",
        "default": "AI Motion Graphics Studio"
      },
      {
        "key": "subtitle",
        "label": "Sub-Headline Tagline",
        "type": "text",
        "default": "Create Viral Animations in 60s"
      },
      {
        "key": "subColor",
        "label": "Sub-Headline Accent Color",
        "type": "color",
        "default": "#38bdf8"
      }
    ],
    "defaults": {
      "url": "https://shortscraft.online",
      "title": "AI Motion Graphics Studio",
      "subtitle": "Create Viral Animations in 60s",
      "subColor": "#38bdf8"
    }
  },
  "ui-google-search": {
    "fields": [
      {
        "key": "query",
        "label": "Search Bar Query",
        "type": "text",
        "default": "how to make viral motion graphics"
      },
      {
        "key": "suggest1",
        "label": "Top Search Autocomplete Suggestion",
        "type": "text",
        "default": "shortscraft.online (best AI generator)"
      }
    ],
    "defaults": {
      "query": "how to make viral motion graphics",
      "suggest1": "shortscraft.online (best AI generator)"
    }
  },
  "ui-imessage": {
    "fields": [
      {
        "key": "inMsg",
        "label": "Incoming Message Bubble",
        "type": "textarea",
        "default": "How did you get 1M views?!"
      },
      {
        "key": "outMsg",
        "label": "Outgoing Reply Bubble",
        "type": "textarea",
        "default": "Used ShortsCraft motion graphics! ⚡"
      },
      {
        "key": "bubbleColor",
        "label": "Outgoing Bubble Accent",
        "type": "color",
        "default": "#3b82f6"
      }
    ],
    "defaults": {
      "inMsg": "How did you get 1M views?!",
      "outMsg": "Used ShortsCraft motion graphics! ⚡",
      "bubbleColor": "#3b82f6"
    }
  },
  "ui-toggle": {
    "fields": [
      {
        "key": "title",
        "label": "Switch Feature Headline",
        "type": "text",
        "default": "VIRAL MODE"
      },
      {
        "key": "sub",
        "label": "Switch Description Subtitle",
        "type": "text",
        "default": "High-retention animations"
      },
      {
        "key": "status",
        "label": "Active Status Tag",
        "type": "text",
        "default": "ACTIVE"
      }
    ],
    "defaults": {
      "title": "VIRAL MODE",
      "sub": "High-retention animations",
      "status": "ACTIVE"
    }
  },
  "swishy-alarm-toggle": {
    "fields": [
      {
        "key": "time",
        "label": "Alarm Time Display",
        "type": "text",
        "default": "6:30 AM"
      },
      {
        "key": "label",
        "label": "Alarm Label / Purpose",
        "type": "text",
        "default": "Workout & Grind"
      },
      {
        "key": "repeat",
        "label": "Repeat Schedule Tag",
        "type": "text",
        "default": "Every Weekday"
      }
    ],
    "defaults": {
      "time": "6:30 AM",
      "label": "Workout & Grind",
      "repeat": "Every Weekday"
    }
  },
  "social-tweet-card": {
    "fields": [
      {
        "key": "name",
        "label": "Profile Display Name",
        "type": "text",
        "default": "Creator Insights"
      },
      {
        "key": "handle",
        "label": "Username Handle",
        "type": "text",
        "default": "@creatorgrowth"
      },
      {
        "key": "verified",
        "label": "Verified Blue Badge",
        "type": "toggle",
        "default": true
      },
      {
        "key": "avatar",
        "label": "Profile Avatar (Upload Image or Emoji)",
        "type": "image",
        "default": "✦"
      },
      {
        "key": "body",
        "label": "Post / Tweet Content",
        "type": "textarea",
        "default": "The top 1% of creators use motion graphics to double their retention."
      },
      {
        "key": "comments",
        "label": "Comments Count",
        "type": "text",
        "default": "1.4K"
      },
      {
        "key": "retweets",
        "label": "Retweets Count",
        "type": "text",
        "default": "8.9K"
      },
      {
        "key": "likes",
        "label": "Likes Count",
        "type": "text",
        "default": "42.5K"
      },
      {
        "key": "cardBg",
        "label": "Card Background Style",
        "type": "select",
        "options": [
          {
            "val": "#000000",
            "label": "🌑 Pitch Black (OLED)"
          },
          {
            "val": "#0f172a",
            "label": "🌌 Dark Slate Navy"
          },
          {
            "val": "#18181b",
            "label": "🔘 Zinc Charcoal"
          },
          {
            "val": "#ffffff",
            "label": "⚪ Clean White"
          }
        ],
        "default": "#000000"
      }
    ],
    "defaults": {
      "name": "Creator Insights",
      "handle": "@creatorgrowth",
      "verified": true,
      "avatar": "✦",
      "body": "The top 1% of creators use motion graphics to double their retention.",
      "comments": "1.4K",
      "retweets": "8.9K",
      "likes": "42.5K",
      "cardBg": "#000000"
    }
  },
  "social-like-burst": {
    "fields": [
      {
        "key": "count",
        "label": "Like Counter Milestone",
        "type": "text",
        "default": "1,248,000"
      },
      {
        "key": "label",
        "label": "Action Sub-label",
        "type": "text",
        "default": "Likes & Shares"
      },
      {
        "key": "icon",
        "label": "Reaction Emoji / Icon",
        "type": "image",
        "default": "❤️"
      }
    ],
    "defaults": {
      "count": "1,248,000",
      "label": "Likes & Shares",
      "icon": "❤️"
    }
  },
  "social-sub-bell": {
    "fields": [
      {
        "key": "cta",
        "label": "Channel CTA Heading",
        "type": "text",
        "default": "Join 500,000+ Creators"
      },
      {
        "key": "btnText",
        "label": "Subscribe Button Label",
        "type": "text",
        "default": "Subscribe"
      },
      {
        "key": "avatar",
        "label": "Channel Avatar (Upload Image)",
        "type": "image",
        "default": "▶"
      }
    ],
    "defaults": {
      "cta": "Join 500,000+ Creators",
      "btnText": "Subscribe",
      "avatar": "▶"
    }
  },
  "social-comment-stream": {
    "fields": [
      {
        "key": "comment1User",
        "label": "Comment 1 Username",
        "type": "text",
        "default": "@alex_motion"
      },
      {
        "key": "comment1Text",
        "label": "Comment 1 Message",
        "type": "text",
        "default": "How did you animate this?! 🔥"
      },
      {
        "key": "comment2User",
        "label": "Comment 2 Username",
        "type": "text",
        "default": "@sam_creator"
      },
      {
        "key": "comment2Text",
        "label": "Comment 2 Message",
        "type": "text",
        "default": "ShortsCraft AI is insane! 🚀"
      }
    ],
    "defaults": {
      "comment1User": "@alex_motion",
      "comment1Text": "How did you animate this?! 🔥",
      "comment2User": "@sam_creator",
      "comment2Text": "ShortsCraft AI is insane! 🚀"
    }
  },
  "social-views-counter": {
    "fields": [
      {
        "key": "song",
        "label": "Song / Track Title",
        "type": "text",
        "default": "Synthetic Dreams"
      },
      {
        "key": "artist",
        "label": "Artist / Album Name",
        "type": "text",
        "default": "Echo Labs · Side A"
      },
      {
        "key": "coverIcon",
        "label": "Album Artwork (Emoji or Upload)",
        "type": "image",
        "default": "🎵"
      }
    ],
    "defaults": {
      "song": "Synthetic Dreams",
      "artist": "Echo Labs · Side A",
      "coverIcon": "🎵"
    }
  },
  "social-story-progress": {
    "fields": [
      {
        "key": "handle",
        "label": "Creator Username",
        "type": "text",
        "default": "shortscraft.ai"
      },
      {
        "key": "avatar",
        "label": "Creator Avatar (Upload or Emoji)",
        "type": "image",
        "default": "⚡"
      },
      {
        "key": "title",
        "label": "Story Hook Headline",
        "type": "text",
        "default": "Behind The Viral Edit"
      }
    ],
    "defaults": {
      "handle": "shortscraft.ai",
      "avatar": "⚡",
      "title": "Behind The Viral Edit"
    }
  },
  "social-verified-badge": {
    "fields": [
      {
        "key": "handle",
        "label": "Profile Handle",
        "type": "text",
        "default": "artzenmedia"
      },
      {
        "key": "bio",
        "label": "Profile Bio Text",
        "type": "textarea",
        "default": "Helping you make better content · Editing tips / tutorials"
      },
      {
        "key": "posts",
        "label": "Posts Count",
        "type": "text",
        "default": "178"
      },
      {
        "key": "followers",
        "label": "Followers Count",
        "type": "text",
        "default": "143K"
      },
      {
        "key": "following",
        "label": "Following Count",
        "type": "text",
        "default": "275"
      },
      {
        "key": "avatar",
        "label": "Profile Avatar (Upload Image)",
        "type": "image",
        "default": "⚡"
      }
    ],
    "defaults": {
      "handle": "artzenmedia",
      "bio": "Helping you make better content · Editing tips / tutorials",
      "posts": "178",
      "followers": "143K",
      "following": "275",
      "avatar": "⚡"
    }
  },
  "social-poll": {
    "fields": [
      {
        "key": "question",
        "label": "Poll Question",
        "type": "textarea",
        "default": "Which style gets more retention?"
      },
      {
        "key": "opt1",
        "label": "Winning Option Label",
        "type": "text",
        "default": "Motion Graphics"
      },
      {
        "key": "opt2",
        "label": "Losing Option Label",
        "type": "text",
        "default": "Static Talking Head"
      }
    ],
    "defaults": {
      "question": "Which style gets more retention?",
      "opt1": "Motion Graphics",
      "opt2": "Static Talking Head"
    }
  },
  "social-share": {
    "fields": [
      {
        "key": "title",
        "label": "Share Sheet Title",
        "type": "text",
        "default": "Share Video"
      },
      {
        "key": "icon1",
        "label": "App Icon 1 (Upload or Emoji)",
        "type": "image",
        "default": "📱"
      },
      {
        "key": "icon2",
        "label": "App Icon 2 (Upload or Emoji)",
        "type": "image",
        "default": "💬"
      },
      {
        "key": "icon3",
        "label": "App Icon 3 (Upload or Emoji)",
        "type": "image",
        "default": "🔗"
      }
    ],
    "defaults": {
      "title": "Share Video",
      "icon1": "📱",
      "icon2": "💬",
      "icon3": "🔗"
    }
  },
  "social-live": {
    "fields": [
      {
        "key": "badge",
        "label": "Live Broadcast Badge",
        "type": "text",
        "default": "● LIVE STREAM"
      },
      {
        "key": "title",
        "label": "Stream Event Headline",
        "type": "text",
        "default": "Editing Masterclass"
      },
      {
        "key": "views",
        "label": "Active Viewers Readout",
        "type": "text",
        "default": "64,200 Viewers"
      }
    ],
    "defaults": {
      "badge": "● LIVE STREAM",
      "title": "Editing Masterclass",
      "views": "64,200 Viewers"
    }
  },
  "swishy-creator-card": {
    "fields": [
      {
        "key": "name",
        "label": "Creator Name",
        "type": "text",
        "default": "Alex Rivers"
      },
      {
        "key": "handle",
        "label": "Social Handle",
        "type": "text",
        "default": "@alexrivers"
      },
      {
        "key": "role",
        "label": "Tagline / Niche",
        "type": "text",
        "default": "Motion Designer & 3D Artist"
      },
      {
        "key": "stats",
        "label": "Audience Stat Tag",
        "type": "text",
        "default": "1.2M Community"
      },
      {
        "key": "avatar",
        "label": "Creator Avatar (Upload or Emoji)",
        "type": "image",
        "default": "⚡"
      }
    ],
    "defaults": {
      "name": "Alex Rivers",
      "handle": "@alexrivers",
      "role": "Motion Designer & 3D Artist",
      "stats": "1.2M Community",
      "avatar": "⚡"
    }
  },
  "swishy-github-stars": {
    "fields": [
      {
        "key": "repo",
        "label": "Repository Name",
        "type": "text",
        "default": "shortscraft/motion-ai"
      },
      {
        "key": "stars",
        "label": "Star Count",
        "type": "text",
        "default": "24.8k"
      },
      {
        "key": "forks",
        "label": "Fork Count",
        "type": "text",
        "default": "3.2k"
      },
      {
        "key": "desc",
        "label": "Repository Description",
        "type": "text",
        "default": "CSS-only viral motion graphics generator"
      }
    ],
    "defaults": {
      "repo": "shortscraft/motion-ai",
      "stars": "24.8k",
      "forks": "3.2k",
      "desc": "CSS-only viral motion graphics generator"
    }
  },
  "charts-bar-race": {
    "fields": [
      {
        "key": "tag",
        "label": "Metric Benchmark Tag",
        "type": "text",
        "default": "PERFORMANCE BENCHMARK"
      },
      {
        "key": "title",
        "label": "Main Surge Headline",
        "type": "text",
        "default": "+320% Retention Surge"
      },
      {
        "key": "val1",
        "label": "Column 1 Multiplier",
        "type": "text",
        "default": "1.2X"
      },
      {
        "key": "val2",
        "label": "Column 2 Multiplier",
        "type": "text",
        "default": "2.8X"
      },
      {
        "key": "val3",
        "label": "Column 3 Multiplier",
        "type": "text",
        "default": "4.5X"
      }
    ],
    "defaults": {
      "tag": "PERFORMANCE BENCHMARK",
      "title": "+320% Retention Surge",
      "val1": "1.2X",
      "val2": "2.8X",
      "val3": "4.5X"
    }
  },
  "charts-versus-bars": {
    "fields": [
      {
        "key": "title",
        "label": "Battle Title",
        "type": "text",
        "default": "Shorts vs Long Form"
      },
      {
        "key": "item1Name",
        "label": "Option A Name",
        "type": "text",
        "default": "Motion Graphic Shorts"
      },
      {
        "key": "item1Val",
        "label": "Option A Percentage",
        "type": "text",
        "default": "86%"
      },
      {
        "key": "item1Color",
        "label": "Option A Color",
        "type": "color",
        "default": "#38bdf8"
      },
      {
        "key": "item2Name",
        "label": "Option B Name",
        "type": "text",
        "default": "Static Talking Head"
      },
      {
        "key": "item2Val",
        "label": "Option B Percentage",
        "type": "text",
        "default": "14%"
      },
      {
        "key": "item2Color",
        "label": "Option B Color",
        "type": "color",
        "default": "#ec4899"
      }
    ],
    "defaults": {
      "title": "Shorts vs Long Form",
      "item1Name": "Motion Graphic Shorts",
      "item1Val": "86%",
      "item1Color": "#38bdf8",
      "item2Name": "Static Talking Head",
      "item2Val": "14%",
      "item2Color": "#ec4899"
    }
  },
  "docu-folder": {
    "fields": [
      {
        "key": "tag",
        "label": "Archive Header Tag",
        "type": "text",
        "default": "ARCHIVE // 340 BC"
      },
      {
        "key": "title",
        "label": "Main Headline",
        "type": "text",
        "default": "EFFORTLESS MOTION"
      },
      {
        "key": "subtitle",
        "label": "Philosophical Subtitle",
        "type": "text",
        "default": "PHILOSOPHY OF DESIGN"
      },
      {
        "key": "image",
        "label": "Sculpture / Artwork (Upload Image)",
        "type": "image",
        "default": "/assets/statue_bust.jpg"
      },
      {
        "key": "beamColor",
        "label": "Spotlight Beam Color",
        "type": "select",
        "options": [
          {
            "val": "rgba(255,255,255,.22)",
            "label": "⚪ Studio White Chiaroscuro"
          },
          {
            "val": "rgba(245,158,11,.22)",
            "label": "🟡 Warm Amber Spotlight"
          },
          {
            "val": "rgba(56,189,248,.22)",
            "label": "🔵 Cyan Blue Cinematic Beam"
          }
        ],
        "default": "rgba(255,255,255,.22)"
      }
    ],
    "defaults": {
      "tag": "ARCHIVE // 340 BC",
      "title": "EFFORTLESS MOTION",
      "subtitle": "PHILOSOPHY OF DESIGN",
      "image": "/assets/statue_bust.jpg",
      "beamColor": "rgba(255,255,255,.22)"
    }
  },
  "docu-confidential": {
    "fields": [
      {
        "key": "dossier",
        "label": "Dossier Tag / File Number",
        "type": "text",
        "default": "RESTRICTED"
      },
      {
        "key": "stamp",
        "label": "Rubber Stamp Text",
        "type": "text",
        "default": "TOP SECRET"
      },
      {
        "key": "stampColor",
        "label": "Stamp Ink Color",
        "type": "select",
        "options": [
          {
            "val": "#ef4444",
            "label": "🔴 Crimson Red"
          },
          {
            "val": "#f59e0b",
            "label": "🟠 Amber Orange"
          },
          {
            "val": "#10b981",
            "label": "🟢 Emerald Green"
          },
          {
            "val": "#1e293b",
            "label": "⚫ Dark Black Ink"
          }
        ],
        "default": "#ef4444"
      },
      {
        "key": "paperTone",
        "label": "Document Paper Background",
        "type": "select",
        "options": [
          {
            "val": "#e6e1d6",
            "label": "📜 Aged Sepia Parchment"
          },
          {
            "val": "#fef3c7",
            "label": "📂 Manila Folder"
          },
          {
            "val": "#0f172a",
            "label": "📐 Blueprint Dark"
          },
          {
            "val": "#fafaf9",
            "label": "⚪ Clean Paper"
          }
        ],
        "default": "#e6e1d6"
      }
    ],
    "defaults": {
      "dossier": "RESTRICTED",
      "stamp": "TOP SECRET",
      "stampColor": "#ef4444",
      "paperTone": "#e6e1d6"
    }
  },
  "docu-red-string": {
    "fields": [
      {
        "key": "card1",
        "label": "Evidence Card 1 Title",
        "type": "text",
        "default": "Suspect Alpha"
      },
      {
        "key": "card1Icon",
        "label": "Card 1 Photo / Icon (Upload)",
        "type": "image",
        "default": "📁"
      },
      {
        "key": "card2",
        "label": "Evidence Card 2 Title",
        "type": "text",
        "default": "Shell Company"
      },
      {
        "key": "card2Icon",
        "label": "Card 2 Photo / Icon (Upload)",
        "type": "image",
        "default": "🏢"
      },
      {
        "key": "stringColor",
        "label": "Yarn String Color",
        "type": "color",
        "default": "#ef4444"
      },
      {
        "key": "boardTheme",
        "label": "Pinboard Background Style",
        "type": "select",
        "options": [
          {
            "val": "#2a2521",
            "label": "📌 Natural Corkboard"
          },
          {
            "val": "#1c1917",
            "label": "🌑 Dark Noir Board"
          },
          {
            "val": "#0c1a2e",
            "label": "📐 Blueprint Grid"
          }
        ],
        "default": "#2a2521"
      }
    ],
    "defaults": {
      "card1": "Suspect Alpha",
      "card1Icon": "📁",
      "card2": "Shell Company",
      "card2Icon": "🏢",
      "stringColor": "#ef4444",
      "boardTheme": "#2a2521"
    }
  },
  "docu-highlighter": {
    "fields": [
      {
        "key": "tag",
        "label": "Evidence Category Tag",
        "type": "text",
        "default": "// EXHIBIT A: FINANCIAL AUDIT"
      },
      {
        "key": "highlight",
        "label": "Highlighted Evidence Text",
        "type": "textarea",
        "default": "$42,000,000 offshore"
      },
      {
        "key": "source",
        "label": "Footnote / Source Attribution",
        "type": "text",
        "default": "Source: Internal Investigation Report"
      },
      {
        "key": "markerColor",
        "label": "Highlighter Marker Color",
        "type": "select",
        "options": [
          {
            "val": "#facc15",
            "label": "🟡 Fluorescent Yellow"
          },
          {
            "val": "#4ade80",
            "label": "🟢 Neon Green"
          },
          {
            "val": "#38bdf8",
            "label": "🔵 Bright Cyan"
          },
          {
            "val": "#f472b6",
            "label": "💖 Hot Pink"
          }
        ],
        "default": "#facc15"
      }
    ],
    "defaults": {
      "tag": "// EXHIBIT A: FINANCIAL AUDIT",
      "highlight": "$42,000,000 offshore",
      "source": "Source: Internal Investigation Report",
      "markerColor": "#facc15"
    }
  },
  "docu-redacted": {
    "fields": [
      {
        "key": "header",
        "label": "Archive Header Tag",
        "type": "text",
        "default": "DECLASSIFIED UNDER FOIA"
      },
      {
        "key": "name1",
        "label": "Censored Name / Target 1",
        "type": "text",
        "default": "ROBERT VANCE"
      },
      {
        "key": "name2",
        "label": "Censored Name / Target 2",
        "type": "text",
        "default": "KREMLIN OFFICIALS"
      },
      {
        "key": "body",
        "label": "Meeting Context Location",
        "type": "text",
        "default": "in Vienna."
      },
      {
        "key": "ref",
        "label": "File Reference ID",
        "type": "text",
        "default": "File Ref: CIA-2026-X"
      }
    ],
    "defaults": {
      "header": "DECLASSIFIED UNDER FOIA",
      "name1": "ROBERT VANCE",
      "name2": "KREMLIN OFFICIALS",
      "body": "in Vienna.",
      "ref": "File Ref: CIA-2026-X"
    }
  },
  "docu-polaroid-pin": {
    "fields": [
      {
        "key": "caption",
        "label": "Handwritten Marker Caption",
        "type": "text",
        "default": "Zurich, May 1998"
      },
      {
        "key": "photo",
        "label": "Polaroid Photo / Image (Upload Image)",
        "type": "image",
        "default": "📸"
      },
      {
        "key": "pinColor",
        "label": "Pushpin Color",
        "type": "color",
        "default": "#ef4444"
      }
    ],
    "defaults": {
      "caption": "Zurich, May 1998",
      "photo": "📸",
      "pinColor": "#ef4444"
    }
  },
  "docu-magnifying": {
    "fields": [
      {
        "key": "note",
        "label": "Sticky Note Label",
        "type": "text",
        "default": "SUSPECT #04"
      },
      {
        "key": "subtext",
        "label": "Target Subtitle",
        "type": "text",
        "default": "PRIMARY TARGET"
      },
      {
        "key": "maintext",
        "label": "Main Clue Headline",
        "type": "text",
        "default": "MAIN CLUE"
      },
      {
        "key": "markerColor",
        "label": "Circle Color",
        "type": "select",
        "options": [
          {
            "val": "#ef4444",
            "label": "🔴 Crimson Red Glow"
          },
          {
            "val": "#f59e0b",
            "label": "🟠 Bright Amber"
          },
          {
            "val": "#38bdf8",
            "label": "🔵 Cyan Blue"
          },
          {
            "val": "#22c55e",
            "label": "🟢 Neon Green"
          }
        ],
        "default": "#ef4444"
      }
    ],
    "defaults": {
      "note": "SUSPECT #04",
      "subtext": "PRIMARY TARGET",
      "maintext": "MAIN CLUE",
      "markerColor": "#ef4444"
    }
  },
  "docu-newspaper": {
    "fields": [
      {
        "key": "kicker",
        "label": "Chapter Header Tag",
        "type": "text",
        "default": "CHAPTER IV // REIGN"
      },
      {
        "key": "headline",
        "label": "Main Newspaper Headline",
        "type": "text",
        "default": "THE MONARCH"
      },
      {
        "key": "sub",
        "label": "Sub-headline Tagline",
        "type": "text",
        "default": "Born To Rule · Destined For Glory"
      }
    ],
    "defaults": {
      "kicker": "CHAPTER IV // REIGN",
      "headline": "THE MONARCH",
      "sub": "Born To Rule · Destined For Glory"
    }
  },
  "docu-microfilm": {
    "fields": [
      {
        "key": "header",
        "label": "Wiretap Header Tag",
        "type": "text",
        "default": "CONVERSATION RECORDED"
      },
      {
        "key": "transcript",
        "label": "Transcript Verified Stamp",
        "type": "text",
        "default": "TRANSCRIPT VERIFIED // 100%"
      }
    ],
    "defaults": {
      "header": "CONVERSATION RECORDED",
      "transcript": "TRANSCRIPT VERIFIED // 100%"
    }
  },
  "docu-timeline": {
    "fields": [
      {
        "key": "year",
        "label": "Milestone Year",
        "type": "text",
        "default": "2008"
      },
      {
        "key": "event",
        "label": "Event Title",
        "type": "text",
        "default": "The Housing Crisis"
      },
      {
        "key": "desc",
        "label": "Event Description",
        "type": "text",
        "default": "Where it all began"
      }
    ],
    "defaults": {
      "year": "2008",
      "event": "The Housing Crisis",
      "desc": "Where it all began"
    }
  },
  "paper-tape-strip": {
    "fields": [
      {
        "key": "title",
        "label": "Washi Tape Punch Hook",
        "type": "text",
        "default": "FIRST 3 SECONDS"
      },
      {
        "key": "subtitle",
        "label": "Pinned Paper Note",
        "type": "text",
        "default": "Hook your viewer or lose the click"
      }
    ],
    "defaults": {
      "title": "FIRST 3 SECONDS",
      "subtitle": "Hook your viewer or lose the click"
    }
  },
  "paper-notebook": {
    "fields": [
      {
        "key": "header",
        "label": "Legal Pad Header",
        "type": "text",
        "default": "RETENTION RULES"
      },
      {
        "key": "body",
        "label": "Rules List Content",
        "type": "textarea",
        "default": "First-principles thinking to engineer impossible products."
      }
    ],
    "defaults": {
      "header": "RETENTION RULES",
      "body": "First-principles thinking to engineer impossible products."
    }
  },
  "paper-postit": {
    "fields": [
      {
        "key": "note",
        "label": "Sticky Note Punchline",
        "type": "text",
        "default": "DON'T SCROLL!"
      },
      {
        "key": "sub",
        "label": "Sticky Note Sub-reminder",
        "type": "text",
        "default": "This secret changes everything"
      }
    ],
    "defaults": {
      "note": "DON'T SCROLL!",
      "sub": "This secret changes everything"
    }
  },
  "paper-double-pol": {
    "fields": [
      {
        "key": "card1Title",
        "label": "Photo 1 Caption",
        "type": "text",
        "default": "Before (Zero views)"
      },
      {
        "key": "card2Title",
        "label": "Photo 2 Caption",
        "type": "text",
        "default": "After (100k views/day)"
      },
      {
        "key": "badge",
        "label": "Comparison Badge Tag",
        "type": "text",
        "default": "10X CHANNEL GROWTH"
      }
    ],
    "defaults": {
      "card1Title": "Before (Zero views)",
      "card2Title": "After (100k views/day)",
      "badge": "10X CHANNEL GROWTH"
    }
  },
  "maps-gps-pin": {
    "fields": [
      {
        "key": "locName",
        "label": "Location Headline",
        "type": "text",
        "default": "Zurich Safe House"
      },
      {
        "key": "coords",
        "label": "GPS Coordinates",
        "type": "text",
        "default": "47.3769° N, 8.5417° E"
      },
      {
        "key": "pinEmoji",
        "label": "Pin Marker Emoji",
        "type": "text",
        "default": "📍"
      }
    ],
    "defaults": {
      "locName": "Zurich Safe House",
      "coords": "47.3769° N, 8.5417° E",
      "pinEmoji": "📍"
    }
  },
  "swishy-flight-route": {
    "fields": [
      {
        "key": "fromCity",
        "label": "Departure City",
        "type": "text",
        "default": "SAN FRANCISCO"
      },
      {
        "key": "fromCode",
        "label": "Departure Code",
        "type": "text",
        "default": "SFO"
      },
      {
        "key": "toCity",
        "label": "Destination City",
        "type": "text",
        "default": "TOKYO"
      },
      {
        "key": "toCode",
        "label": "Destination Code",
        "type": "text",
        "default": "HND"
      },
      {
        "key": "flightNum",
        "label": "Flight Number Tag",
        "type": "text",
        "default": "FLIGHT JL001"
      },
      {
        "key": "status",
        "label": "Flight Status",
        "type": "text",
        "default": "IN TRANSIT · 9h 45m"
      }
    ],
    "defaults": {
      "fromCity": "SAN FRANCISCO",
      "fromCode": "SFO",
      "toCity": "TOKYO",
      "toCode": "HND",
      "flightNum": "FLIGHT JL001",
      "status": "IN TRANSIT · 9h 45m"
    }
  },
  "money-cash-stack": {
    "fields": [
      {
        "key": "amount",
        "label": "Revenue / Cash Amount",
        "type": "text",
        "default": "$100,000"
      },
      {
        "key": "tag",
        "label": "Category Badge",
        "type": "text",
        "default": "MONTHLY REVENUE"
      },
      {
        "key": "sub",
        "label": "Growth Subtitle",
        "type": "text",
        "default": "+240% MRR Surge"
      }
    ],
    "defaults": {
      "amount": "$100,000",
      "tag": "MONTHLY REVENUE",
      "sub": "+240% MRR Surge"
    }
  },
  "money-gold-vault": {
    "fields": [
      {
        "key": "title",
        "label": "Vault Asset Title",
        "type": "text",
        "default": "GOLD RESERVES"
      },
      {
        "key": "value",
        "label": "Total Valuation Figure",
        "type": "text",
        "default": "$4,250,000,000"
      },
      {
        "key": "purity",
        "label": "Asset Purity / Tag",
        "type": "text",
        "default": "99.99% FINE GOLD"
      }
    ],
    "defaults": {
      "title": "GOLD RESERVES",
      "value": "$4,250,000,000",
      "purity": "99.99% FINE GOLD"
    }
  },
  "money-sale-slash": {
    "fields": [
      {
        "key": "discount",
        "label": "Discount Badge",
        "type": "text",
        "default": "50% OFF"
      },
      {
        "key": "oldPrice",
        "label": "Original Slashed Price",
        "type": "text",
        "default": "$199"
      },
      {
        "key": "newPrice",
        "label": "Special Sale Price",
        "type": "text",
        "default": "$99"
      },
      {
        "key": "tag",
        "label": "Offer Tagline",
        "type": "text",
        "default": "LIFETIME ACCESS · LIMITED TIME"
      }
    ],
    "defaults": {
      "discount": "50% OFF",
      "oldPrice": "$199",
      "newPrice": "$99",
      "tag": "LIFETIME ACCESS · LIMITED TIME"
    }
  },
  "text-vox-impact": {
    "fields": [
      {
        "key": "line1",
        "label": "Hook Line 1",
        "type": "text",
        "default": "THE REASON"
      },
      {
        "key": "line2",
        "label": "Impact Punchline",
        "type": "text",
        "default": "YOU ARE BROKE"
      },
      {
        "key": "line3",
        "label": "Sub-hook Line 3",
        "type": "text",
        "default": "IS NOT WHAT YOU THINK"
      }
    ],
    "defaults": {
      "line1": "THE REASON",
      "line2": "YOU ARE BROKE",
      "line3": "IS NOT WHAT YOU THINK"
    }
  },
  "text-elastic-wave": {
    "fields": [
      {
        "key": "line1",
        "label": "Elastic Line 1",
        "type": "text",
        "default": "STOP WASTING"
      },
      {
        "key": "line2",
        "label": "Elastic Line 2",
        "type": "text",
        "default": "YOUR 20s"
      },
      {
        "key": "sub",
        "label": "Subtitle Callout",
        "type": "text",
        "default": "Daily Discipline > Motivation"
      }
    ],
    "defaults": {
      "line1": "STOP WASTING",
      "line2": "YOUR 20s",
      "sub": "Daily Discipline > Motivation"
    }
  },
  "text-slot-machine": {
    "fields": [
      {
        "key": "pre",
        "label": "Top Pre-roll Word",
        "type": "text",
        "default": "UNLOCK YOUR"
      },
      {
        "key": "slot1",
        "label": "Reel Word 1",
        "type": "text",
        "default": "FREEDOM"
      },
      {
        "key": "slot2",
        "label": "Reel Word 2",
        "type": "text",
        "default": "FOCUS"
      },
      {
        "key": "slot3",
        "label": "Reel Word 3",
        "type": "text",
        "default": "WEALTH"
      }
    ],
    "defaults": {
      "pre": "UNLOCK YOUR",
      "slot1": "FREEDOM",
      "slot2": "FOCUS",
      "slot3": "WEALTH"
    }
  },
  "swishy-squiggle-stream": {
    "fields": [
      {
        "key": "line1",
        "label": "Stream Title",
        "type": "text",
        "default": "THE ALGORITHM"
      },
      {
        "key": "line2",
        "label": "Stream Punchline",
        "type": "text",
        "default": "REWARDS CONSISTENCY"
      },
      {
        "key": "tag",
        "label": "Pill Tag",
        "type": "text",
        "default": "VIRAL HOOK"
      }
    ],
    "defaults": {
      "line1": "THE ALGORITHM",
      "line2": "REWARDS CONSISTENCY",
      "tag": "VIRAL HOOK"
    }
  },
  "swishy-stretchy-pill": {
    "fields": [
      {
        "key": "pill1",
        "label": "Pill 1 Text",
        "type": "text",
        "default": "99% QUIT"
      },
      {
        "key": "pill2",
        "label": "Pill 2 Text",
        "type": "text",
        "default": "1% DOMINATE"
      },
      {
        "key": "footer",
        "label": "Footnote Question",
        "type": "text",
        "default": "WHICH SIDE ARE YOU ON?"
      }
    ],
    "defaults": {
      "pill1": "99% QUIT",
      "pill2": "1% DOMINATE",
      "footer": "WHICH SIDE ARE YOU ON?"
    }
  },
  "swishy-vinyl-player": {
    "fields": [
      {
        "key": "song",
        "label": "Track / Song Title",
        "type": "text",
        "default": "Synthetic Dreams"
      },
      {
        "key": "artist",
        "label": "Artist / Channel Name",
        "type": "text",
        "default": "Echo Labs · Side A"
      },
      {
        "key": "coverIcon",
        "label": "Album Art (Upload or Emoji)",
        "type": "image",
        "default": "🎵"
      }
    ],
    "defaults": {
      "song": "Synthetic Dreams",
      "artist": "Echo Labs · Side A",
      "coverIcon": "🎵"
    }
  },
  "swishy-upwork-ad": {
    "fields": [
      {
        "key": "rate",
        "label": "Hourly Rate",
        "type": "text",
        "default": "$120/hr"
      },
      {
        "key": "badge",
        "label": "Upwork Badge",
        "type": "text",
        "default": "TOP RATED PLUS"
      },
      {
        "key": "role",
        "label": "Professional Title",
        "type": "text",
        "default": "Senior Motion Graphics Editor"
      },
      {
        "key": "earned",
        "label": "Earnings Stat",
        "type": "text",
        "default": "$200K+ Earned"
      }
    ],
    "defaults": {
      "rate": "$120/hr",
      "badge": "TOP RATED PLUS",
      "role": "Senior Motion Graphics Editor",
      "earned": "$200K+ Earned"
    }
  },
  "swishy-terminal-typing": {
    "fields": [
      {
        "key": "cmd",
        "label": "Terminal Command",
        "type": "text",
        "default": "npm install @shortscraft/viral"
      },
      {
        "key": "output",
        "label": "Command Execution Output",
        "type": "text",
        "default": "✔ Generated 1080p 60fps Short in 1.4s"
      },
      {
        "key": "status",
        "label": "Status Badge",
        "type": "text",
        "default": "SUCCESS 200 OK"
      }
    ],
    "defaults": {
      "cmd": "npm install @shortscraft/viral",
      "output": "✔ Generated 1080p 60fps Short in 1.4s",
      "status": "SUCCESS 200 OK"
    }
  },
  "swishy-notion-kinetic": {
    "fields": [
      {
        "key": "title",
        "label": "Notion Page Title",
        "type": "text",
        "default": "2026 Content Blueprint"
      },
      {
        "key": "icon",
        "label": "Page Icon (Upload or Emoji)",
        "type": "image",
        "default": "🚀"
      },
      {
        "key": "item1",
        "label": "Task Line 1",
        "type": "text",
        "default": "Script 10 YouTube Shorts"
      },
      {
        "key": "item2",
        "label": "Task Line 2",
        "type": "text",
        "default": "Animate kinetic typography hooks"
      },
      {
        "key": "item3",
        "label": "Task Line 3",
        "type": "text",
        "default": "Publish 4K exports to Reels"
      }
    ],
    "defaults": {
      "title": "2026 Content Blueprint",
      "icon": "🚀",
      "item1": "Script 10 YouTube Shorts",
      "item2": "Animate kinetic typography hooks",
      "item3": "Publish 4K exports to Reels"
    }
  },
  "text-cascade": {
    "fields": [
      {
        "key": "line1",
        "label": "Cascade Header 1",
        "type": "text",
        "default": "FIRST 3 SECONDS"
      },
      {
        "key": "line2",
        "label": "Cascade Header 2",
        "type": "text",
        "default": "DON'T SCROLL AWAY"
      },
      {
        "key": "line3",
        "label": "Bottom Callout",
        "type": "text",
        "default": "shortscraft.online"
      }
    ],
    "defaults": {
      "line1": "FIRST 3 SECONDS",
      "line2": "DON'T SCROLL AWAY",
      "line3": "shortscraft.online"
    }
  },
  "text-subtitle-pill": {
    "fields": [
      {
        "key": "line1",
        "label": "Subtitle Hook Line 1",
        "type": "text",
        "default": "THIS ONE HABIT"
      },
      {
        "key": "line2",
        "label": "Punch Word Line 2",
        "type": "text",
        "default": "CHANGES EVERYTHING"
      },
      {
        "key": "punchColor",
        "label": "Punch Word Highlight Color",
        "type": "color",
        "default": "#fbbf24"
      }
    ],
    "defaults": {
      "line1": "THIS ONE HABIT",
      "line2": "CHANGES EVERYTHING",
      "punchColor": "#fbbf24"
    }
  },
  "text-terminal": {
    "fields": [
      {
        "key": "prompt",
        "label": "Hacker Terminal Prompt",
        "type": "text",
        "default": "root@shortscraft:~$ start_render"
      },
      {
        "key": "line1",
        "label": "Terminal Output Line 1",
        "type": "text",
        "default": "> Analyzing video retention hooks..."
      },
      {
        "key": "line2",
        "label": "Terminal Output Line 2",
        "type": "text",
        "default": "> Boosting engagement by 340%..."
      },
      {
        "key": "status",
        "label": "Status Stamp",
        "type": "text",
        "default": "[RENDER COMPLETE]"
      }
    ],
    "defaults": {
      "prompt": "root@shortscraft:~$ start_render",
      "line1": "> Analyzing video retention hooks...",
      "line2": "> Boosting engagement by 340%...",
      "status": "[RENDER COMPLETE]"
    }
  },
  "text-glitch": {
    "fields": [
      {
        "key": "title",
        "label": "Glitch Main Headline",
        "type": "text",
        "default": "SYSTEM BREACH"
      },
      {
        "key": "sub",
        "label": "Warning Sub-headline",
        "type": "text",
        "default": "UNAUTHORIZED ACCESS DETECTED"
      },
      {
        "key": "code",
        "label": "Glitch Error Code",
        "type": "text",
        "default": "ERROR 0x4F92B"
      }
    ],
    "defaults": {
      "title": "SYSTEM BREACH",
      "sub": "UNAUTHORIZED ACCESS DETECTED",
      "code": "ERROR 0x4F92B"
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

    /* Seed the schema fields from the positional lines array — but never on
       top of a field the caller set explicitly in props. The editor sends both
       (lines carries the template's demo copy, props carries what you typed),
       so an unconditional copy here overwrote every custom-field edit on the
       very next render: typing in "Evidence Card 1 Title" changed nothing on
       screen. Explicit props win; lines only fill what props left alone. */
    if (o.lines && o.lines.length) {
      var explicit = o.props || {};
      s.fields.forEach(function (f, idx) {
        var setByCaller = explicit[f.key] != null && String(explicit[f.key]).trim() !== "";
        if (setByCaller) return;
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
      + wmHtml(o)
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
      + wmHtml(o)
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

