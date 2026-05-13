/* ============================================================
   ShortsCraft TRUE VISIBLE VIDEO TEMPLATE ENGINE v6
   - Every style has a different layout/motion language
   - Text is always visible (no background-only bug)
   - Works inside iframe for 9:16, 16:9, square and social ratios
   ============================================================ */
window.SC_VIDEO_TEMPLATES = (function(){
  'use strict';

  const STYLE_ALIASES = {
    'viral-hook':'viral-hook','youtube-viral-hook':'viral-hook','premium-typography':'viral-hook','typography':'viral-hook',
    'clean-minimal':'clean-minimal','minimal':'clean-minimal',
    'neon-cyber':'neon-cyber','neon':'neon-cyber','tech-blueprint':'tech-blueprint','tech-explainer':'tech-blueprint',
    'motivation':'motivation','motivation-reel':'motivation',
    'podcast':'podcast','modern-podcast':'podcast',
    'news':'news','bold-news':'news','bold-breaking-news':'news',
    'horror':'horror','horror-mystery':'horror',
    'luxury':'luxury','luxury-gold':'luxury',
    'social-pop':'social-pop','social-gradient':'social-pop',
    'documentary':'documentary','faceless-documentary':'documentary',
    'gaming':'gaming','gaming-esports':'gaming',
    'classroom':'classroom','educational':'classroom',
    'vhs':'vhs','retro-vhs':'vhs',
    'startup':'startup','startup-saas':'startup'
  };

  const RATIOS = {
    '9:16':[1080,1920], '16:9':[1920,1080], '1:1':[1080,1080],
    '4:5':[1080,1350], '3:4':[1080,1440], '2:3':[1080,1620], '21:9':[1920,823]
  };

  const STYLE_NAMES = {
    'viral-hook':'YouTube Viral Hook', 'clean-minimal':'Clean Minimal White', 'neon-cyber':'Neon Cyber Kinetic',
    'motivation':'Motivation Reel', 'podcast':'Modern Podcast Subtitle', 'news':'Bold Breaking News',
    'horror':'Horror / Mystery', 'luxury':'Luxury Gold Premium', 'social-pop':'Social Gradient Pop',
    'documentary':'Faceless Documentary', 'tech-blueprint':'Tech Explainer Blue', 'gaming':'Gaming Esports',
    'classroom':'Classroom Educational', 'vhs':'Retro VHS Tape', 'startup':'Startup SaaS Clean'
  };

  function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function cleanScript(raw){
    return String(raw||'')
      .replace(/```[\s\S]*?```/g,' ')
      .replace(/\[(HOOK|MAIN|CTA|INTRO|OUTRO|SCENE\s*\d+|VO|NARRATOR)\]\s*:?/gi,'\n')
      .replace(/^\s*(HOOK|MAIN|CTA|INTRO|OUTRO|SCENE\s*\d+|TITLE)\s*[:\-–—]\s*/gim,'')
      .replace(/[*_#`]+/g,'')
      .replace(/[•▪►→·]/g,'\n')
      .replace(/\r/g,'\n')
      .replace(/[ \t]+/g,' ')
      .replace(/\n{2,}/g,'\n')
      .trim();
  }
  function splitScript(raw, aspect='9:16'){
    const tall = ['9:16','4:5','3:4','2:3'].includes(aspect);
    const maxWords = tall ? 7 : 11;
    const maxChars = tall ? 48 : 78;
    const text = cleanScript(raw);
    if(!text) return [];
    const parts = text
      .split(/(?<=[.!?।])\s+|\n+/)
      .map(s=>s.trim())
      .filter(Boolean)
      .flatMap(s=>{
        const words=s.split(/\s+/).filter(Boolean);
        if(words.length<=maxWords && s.length<=maxChars) return [s];
        const chunks=[]; let cur=[];
        words.forEach(w=>{
          const test=[...cur,w].join(' ');
          if(cur.length && (cur.length>=maxWords || test.length>maxChars)){chunks.push(cur.join(' ')); cur=[w];}
          else cur.push(w);
        });
        if(cur.length) chunks.push(cur.join(' '));
        return chunks;
      });
    const merged=[];
    for(const p of parts){
      const last=merged[merged.length-1];
      if(last && last.split(/\s+/).length<3 && (last+' '+p).split(/\s+/).length<=maxWords){merged[merged.length-1]=last+' '+p;}
      else merged.push(p);
    }
    return merged.slice(0,10);
  }
  function wordHTML(text){
    const words=String(text).split(/\s+/).filter(Boolean);
    return words.map((w,i)=>{
      const clean=w.replace(/[.,!?।:;"'()]/g,'');
      const key = clean.length>=6 || i===0 || /[?!।.]$/.test(w) || /^[A-Z]/.test(clean);
      return `<span class="word${key?' key':''}" style="--i:${i}">${esc(w)}</span>`;
    }).join(' ');
  }
  function lineHTML(text){
    const words=String(text).split(/\s+/).filter(Boolean);
    const max = words.length>9 ? 3 : words.length>5 ? 2 : 1;
    if(max===1) return `<div class="headline">${wordHTML(text)}</div>`;
    const per=Math.ceil(words.length/max), lines=[];
    for(let i=0;i<words.length;i+=per) lines.push(words.slice(i,i+per).join(' '));
    return lines.map(l=>`<div class="headline line">${wordHTML(l)}</div>`).join('');
  }
  function sceneDeco(style,i){
    const n=i+1;
    const common = `<div class="scene-num">${String(n).padStart(2,'0')}</div>`;
    const map={
      'viral-hook': `${common}<div class="big-type">VIRAL</div><div class="slash sA"></div><div class="dot d1"></div><div class="dot d2"></div>`,
      'clean-minimal': `${common}<div class="thin-line l1"></div><div class="thin-line l2"></div><div class="soft-circle c1"></div>`,
      'neon-cyber': `${common}<div class="cy-grid"></div><div class="tunnel"></div><div class="neon-orb o1"></div><div class="neon-orb o2"></div>`,
      'motivation': `${common}<div class="sun"></div><div class="float-card f1"></div><div class="float-card f2"></div>`,
      'podcast': `${common}<div class="mic"></div><div class="wavebars"><i></i><i></i><i></i><i></i><i></i></div>`,
      'news': `${common}<div class="breaking">BREAKING</div><div class="news-strip"></div><div class="ticker">SHORTSCRAFT NEWS • LIVE UPDATE</div>`,
      'horror': `${common}<div class="moon"></div><div class="fog"></div><div class="scratch sc1"></div><div class="scratch sc2"></div>`,
      'luxury': `${common}<div class="gold-frame"></div><div class="gold-line gl1"></div><div class="gold-line gl2"></div>`,
      'social-pop': `${common}<div class="bubble b1"></div><div class="bubble b2"></div><div class="bubble b3"></div>`,
      'documentary': `${common}<div class="letterbox top"></div><div class="letterbox bottom"></div><div class="doc-focus"></div>`,
      'tech-blueprint': `${common}<div class="blueprint"></div><div class="hud h1">SYSTEM READY</div><div class="hud h2">DATA FLOW</div>`,
      'gaming': `${common}<div class="hud-frame"></div><div class="energy e1"></div><div class="energy e2"></div><div class="score">XP +${(i+1)*100}</div>`,
      'classroom': `${common}<div class="paper-card"></div><div class="edu-shape es1"></div><div class="edu-shape es2"></div>`,
      'vhs': `${common}<div class="rec">● REC</div><div class="tape">TAPE A-${n}</div><div class="vhs-frame"></div>`,
      'startup': `${common}<div class="saas-card"></div><div class="metric m1">+32%</div><div class="metric m2">FAST</div>`
    };
    return map[style]||map['viral-hook'];
  }

  function bodyClassFor(style){return 'tpl-'+(STYLE_ALIASES[style]||style||'viral-hook').replace(/[^a-z0-9-]/g,'');}
  function styleKey(style){return STYLE_ALIASES[style] || STYLE_ALIASES[String(style).toLowerCase()] || 'viral-hook';}

  function build(rawScript, selectedStyle='viral-hook', aspect='9:16', mods={}){
    const style=styleKey(selectedStyle);
    const scenes=splitScript(rawScript, aspect);
    if(!scenes.length) return null;
    return buildTemplateHTML(scenes, style, aspect, mods);
  }

  function buildTemplateHTML(scenes, selectedStyle='viral-hook', aspect='9:16', mods={}){
    const style=styleKey(selectedStyle);
    const [W,H]=RATIOS[aspect]||RATIOS['9:16'];
    const sceneMs=Math.max(2200, Math.round(3600*(mods?.speed||1)));
    const fontScale=Number(mods?.fontScale||1);
    const modClass=[mods?.yellow?'mod-yellow':'',mods?.darker?'mod-dark':'',mods?.minimal?'mod-minimal':'',mods?.premium?'mod-premium':''].filter(Boolean).join(' ');
    const htmlScenes=scenes.map((txt,i)=>`<section class="scene s${(i%6)+1}${i===0?' active':''}" data-index="${i}">
      ${sceneDeco(style,i)}
      <div class="copy"><div class="copy-inner">${lineHTML(txt)}</div></div>
    </section>`).join('\n');
    const dots=scenes.map((_,i)=>`<span class="dot-ind${i===0?' on':''}"></span>`).join('');
    return `<!doctype html><html lang="hi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(STYLE_NAMES[style]||'ShortsCraft Preview')}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0} html,body{width:100%;height:100%;overflow:hidden;background:#000;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision} body{display:grid;place-items:center;font-family:Inter,'Noto Sans Devanagari','Nirmala UI',Mangal,Arial,sans-serif}.viewport{position:fixed;inset:0;overflow:hidden;background:#000;display:grid;place-items:center}.canvas{position:absolute;left:50%;top:50%;width:${W}px;height:${H}px;transform-origin:center center;overflow:hidden;background:#111;color:#fff;isolation:isolate}.scene{position:absolute;inset:0;opacity:0;visibility:hidden;overflow:hidden;pointer-events:none}.scene.active{opacity:1;visibility:visible;pointer-events:auto}.copy{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;text-align:center;padding:${H>W?'150px 94px':'100px 150px'}}.copy-inner{max-width:${H>W?'920px':'1350px'};position:relative}.headline{font-weight:950;line-height:.94;letter-spacing:-.055em;font-size:calc(${H>W?96:88}px * ${fontScale});text-wrap:balance}.line+.line{margin-top:.18em}.word{display:inline-block;opacity:0;transform:translateY(72px) scale(.94);animation:wordIn .72s cubic-bezier(.17,.84,.22,1) forwards;animation-delay:calc(var(--i)*70ms + .18s);margin:0 .035em;white-space:nowrap}.key{color:var(--accent);font-size:1.08em}.scene-num{position:absolute;left:${H>W?'72px':'84px'};top:${H>W?'68px':'60px'};z-index:25;font:900 ${H>W?24:22}px Inter,Arial,sans-serif;letter-spacing:.2em;color:var(--muted)}.brand{position:absolute;right:${H>W?'58px':'72px'};bottom:${H>W?'50px':'42px'};z-index:30;font:800 ${H>W?19:18}px Inter,Arial,sans-serif;letter-spacing:.11em;color:var(--wm)}.progress{position:absolute;left:${H>W?'58px':'72px'};right:${H>W?'220px':'260px'};bottom:${H>W?'50px':'42px'};height:${H>W?'8px':'6px'};background:rgba(255,255,255,.16);z-index:31;overflow:hidden;border-radius:999px}.bar{height:100%;width:0;background:linear-gradient(90deg,var(--accent),var(--accent2));border-radius:999px;box-shadow:0 0 28px var(--accent)}.dots{position:absolute;left:50%;bottom:${H>W?'73px':'62px'};transform:translateX(-50%);display:flex;gap:10px;z-index:31}.dot-ind{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.25);transition:.3s}.dot-ind.on{width:28px;border-radius:999px;background:var(--accent)}.flash{position:absolute;inset:0;z-index:60;background:#fff;opacity:0;pointer-events:none}.flash.hit{animation:flashHit .18s ease both}@keyframes flashHit{50%{opacity:.12}}@keyframes wordIn{to{opacity:1;transform:translateY(0) scale(1)}}
/* base modifiers */.mod-yellow .key{background:#FFD60A;color:#111;padding:.02em .12em;border-radius:.12em}.mod-dark .canvas{filter:brightness(.72) contrast(1.06)}.mod-premium .headline{text-shadow:0 0 28px rgba(212,175,55,.35)}.mod-minimal .scene *:not(.copy):not(.copy *):not(.scene-num){display:none!important}
/* VIRAL */.tpl-viral-hook .canvas{--accent:#f2072f;--accent2:#111;--muted:rgba(0,0,0,.45);--wm:rgba(0,0,0,.35);background:#fffdf5;color:#070707;font-family:Impact,'Arial Black','Noto Sans Devanagari',sans-serif}.tpl-viral-hook .headline{font-size:calc(${H>W?116:100}px * ${fontScale});text-transform:uppercase;text-shadow:none}.tpl-viral-hook .key{color:#f2072f}.tpl-viral-hook .big-type{position:absolute;right:-80px;bottom:70px;font-size:${H>W?260:180}px;font-weight:1000;color:rgba(0,0,0,.035);transform:rotate(-8deg)}.slash{position:absolute;left:-10%;right:-10%;height:${H>W?210:120}px;background:#f2072f;transform:skewY(-10deg);opacity:.12}.sA{top:62%}.tpl-viral-hook .dot{position:absolute;width:26px;height:26px;background:#111;border-radius:50%;z-index:2}.d1{left:72px;top:96px}.d2{right:72px;top:96px}.tpl-viral-hook .word{animation-name:viralUp}@keyframes viralUp{0%{opacity:0;transform:translateY(150px) rotate(2deg) scale(.9)}75%{opacity:1;transform:translateY(-12px) rotate(-1deg) scale(1.05)}100%{opacity:1;transform:translateY(0) scale(1)}}
/* CLEAN */.tpl-clean-minimal .canvas,.tpl-startup .canvas,.tpl-classroom .canvas{--accent:#111827;--accent2:#2dd4bf;--muted:rgba(15,23,42,.32);--wm:rgba(15,23,42,.28);background:linear-gradient(135deg,#fff,#f8fbff);color:#111827}.tpl-clean-minimal .headline{font-weight:850;letter-spacing:-.065em}.thin-line{position:absolute;height:2px;background:rgba(15,23,42,.10);width:52%;transform:rotate(-9deg)}.l1{top:22%;left:12%}.l2{bottom:18%;right:10%}.soft-circle{position:absolute;width:270px;height:270px;border-radius:50%;background:radial-gradient(circle,rgba(96,165,250,.13),transparent 65%);right:9%;top:12%}.tpl-clean-minimal .word{animation-name:cleanFade}@keyframes cleanFade{from{opacity:0;transform:translateY(28px);filter:blur(5px)}to{opacity:1;transform:none;filter:none}}
/* NEON */.tpl-neon-cyber .canvas{--accent:#00f5ff;--accent2:#b44fff;--muted:rgba(0,245,255,.55);--wm:rgba(0,245,255,.45);background:radial-gradient(circle at 50% 40%,rgba(0,245,255,.13),transparent 35%),linear-gradient(180deg,#02030b,#080015);color:#efffff}.tpl-neon-cyber .headline{text-shadow:0 0 18px #00f5ff,0 0 46px rgba(180,79,255,.6)}.cy-grid,.blueprint{position:absolute;inset:0;background-image:linear-gradient(rgba(0,245,255,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(180,79,255,.10) 1px,transparent 1px);background-size:90px 90px;opacity:.36}.tunnel{position:absolute;inset:8% -18% auto;height:58%;background:conic-gradient(from 90deg,transparent,rgba(0,245,255,.14),transparent,rgba(180,79,255,.14),transparent);animation:spin 16s linear infinite;opacity:.3}.neon-orb{position:absolute;width:500px;height:500px;border-radius:50%;filter:blur(100px);opacity:.45}.o1{left:-180px;top:-160px;background:#00f5ff}.o2{right:-180px;bottom:-160px;background:#b44fff}.tpl-neon-cyber .word{animation-name:neonZoom}@keyframes neonZoom{from{opacity:0;transform:scale(1.55);filter:blur(14px)}to{opacity:1;transform:scale(1);filter:none}}
/* MOTIVATION */.tpl-motivation .canvas{--accent:#fff;--accent2:#FFD60A;--muted:rgba(255,255,255,.65);--wm:rgba(255,255,255,.42);background:linear-gradient(145deg,#ffb703,#fb5607 45%,#e11d48);color:#fff}.sun{position:absolute;inset:-30%;background:conic-gradient(from 0deg,rgba(255,255,255,.16) 0 10deg,transparent 10deg 24deg);animation:spin 20s linear infinite}.float-card{position:absolute;border:2px solid rgba(255,255,255,.24);border-radius:36px;background:rgba(255,255,255,.12);backdrop-filter:blur(3px)}.f1{width:200px;height:200px;right:90px;top:210px;transform:rotate(15deg)}.f2{width:310px;height:90px;right:-80px;bottom:360px;transform:rotate(-12deg)}.tpl-motivation .word{animation-name:bounce}@keyframes bounce{0%{opacity:0;transform:scale(.25) translateY(70px)}72%{opacity:1;transform:scale(1.12)}100%{opacity:1;transform:scale(1)}}
/* PODCAST */.tpl-podcast .canvas{--accent:#FFD60A;--accent2:#fff;--muted:rgba(255,255,255,.4);--wm:rgba(255,255,255,.34);background:#191919;color:#fff}.tpl-podcast .copy{align-items:flex-end;padding-bottom:${H>W?250:150}px}.tpl-podcast .copy-inner{background:rgba(0,0,0,.62);padding:38px 48px;border-radius:28px;box-shadow:0 22px 70px rgba(0,0,0,.48)}.tpl-podcast .headline{font-size:calc(${H>W?76:64}px * ${fontScale});letter-spacing:-.035em}.mic{position:absolute;left:50%;top:22%;width:170px;height:250px;border-radius:90px;background:linear-gradient(#333,#111);transform:translateX(-50%);box-shadow:inset 0 0 0 10px #252525}.wavebars{position:absolute;left:50%;top:40%;display:flex;gap:18px;transform:translateX(-50%)}.wavebars i{width:12px;height:90px;background:#FFD60A;border-radius:999px;animation:bar 1s infinite alternate}.wavebars i:nth-child(2){animation-delay:.1s}.wavebars i:nth-child(3){animation-delay:.2s}.wavebars i:nth-child(4){animation-delay:.3s}.wavebars i:nth-child(5){animation-delay:.4s}@keyframes bar{to{height:150px}}.tpl-podcast .word{animation-name:subUp}@keyframes subUp{from{opacity:0;transform:translateY(60px)}to{opacity:1;transform:none}}
/* NEWS */.tpl-news .canvas{--accent:#d60000;--accent2:#fff;--muted:rgba(255,255,255,.8);--wm:rgba(255,255,255,.45);background:#f8f8f8;color:#111}.breaking{position:absolute;left:0;right:0;top:0;height:${H>W?150:105}px;background:#d60000;color:#fff;display:grid;place-items:center;font:1000 ${H>W?54:42}px Inter,Arial,sans-serif;letter-spacing:.12em}.news-strip{position:absolute;left:0;right:0;top:${H>W?150:105}px;height:14px;background:#111}.ticker{position:absolute;left:0;right:0;bottom:0;height:${H>W?120:80}px;background:#111;color:#fff;display:grid;place-items:center;font:900 ${H>W?30:24}px Inter,sans-serif;letter-spacing:.08em}.tpl-news .headline{font-family:Georgia,'Times New Roman',serif;text-transform:uppercase}.tpl-news .word{animation-name:flashIn}@keyframes flashIn{0%,20%,38%{opacity:0}12%,30%,100%{opacity:1;transform:none}}
/* HORROR */.tpl-horror .canvas{--accent:#8B0000;--accent2:#fff;--muted:rgba(255,255,255,.46);--wm:rgba(255,255,255,.34);background:radial-gradient(circle at 50% 65%,rgba(139,0,0,.18),transparent 45%),#020202;color:#f3e9e5;font-family:Georgia,'Times New Roman','Noto Sans Devanagari',serif}.moon{position:absolute;right:100px;top:150px;width:160px;height:160px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#777,#222);filter:blur(.5px);opacity:.55}.fog{position:absolute;inset:0;background:radial-gradient(circle at 50% 76%,rgba(255,255,255,.10),transparent 35%);animation:fog 5s ease-in-out infinite}.scratch{position:absolute;width:2px;height:360px;background:rgba(139,0,0,.45);transform:rotate(18deg)}.sc1{left:28%;top:20%}.sc2{right:30%;top:40%;transform:rotate(-21deg)}.tpl-horror .headline{text-shadow:0 0 20px #8B0000}.tpl-horror .key{color:#ff2a2a}.tpl-horror .word{animation-name:glitch}@keyframes glitch{0%{opacity:0;transform:translateX(-24px);filter:blur(8px)}30%{opacity:1;transform:translateX(18px)}45%{transform:translateX(-9px)}100%{opacity:1;transform:none;filter:none}}@keyframes fog{50%{opacity:.55;transform:scale(1.05)}}
/* LUXURY */.tpl-luxury .canvas{--accent:#D4AF37;--accent2:#fff3b0;--muted:rgba(212,175,55,.65);--wm:rgba(212,175,55,.45);background:radial-gradient(circle at 50% 30%,rgba(212,175,55,.15),transparent 38%),linear-gradient(145deg,#020200,#120e05);color:#f8e7a2;font-family:Georgia,'Times New Roman','Noto Sans Devanagari',serif}.gold-frame{position:absolute;inset:92px;border:3px solid rgba(212,175,55,.42)}.gold-line{position:absolute;height:2px;width:65%;background:linear-gradient(90deg,transparent,#D4AF37,transparent);transform:rotate(-9deg)}.gl1{top:25%;left:10%}.gl2{bottom:23%;right:10%}.tpl-luxury .headline{font-weight:600;letter-spacing:-.025em;text-shadow:0 0 28px rgba(212,175,55,.42)}.tpl-luxury .word{animation-name:shimmer}@keyframes shimmer{from{opacity:0;letter-spacing:.2em;filter:blur(8px)}to{opacity:1;letter-spacing:inherit;filter:none}}
/* SOCIAL */.tpl-social-pop .canvas{--accent:#fff200;--accent2:#fff;--muted:rgba(255,255,255,.55);--wm:rgba(255,255,255,.42);background:linear-gradient(135deg,#7c3aed,#ec4899 45%,#fb7185);color:#fff}.bubble{position:absolute;border-radius:50%;background:rgba(255,255,255,.18);filter:blur(1px);animation:float 4s ease-in-out infinite}.b1{width:260px;height:260px;left:80px;top:170px}.b2{width:360px;height:360px;right:-100px;bottom:190px}.b3{width:150px;height:150px;right:190px;top:120px}.tpl-social-pop .word{animation-name:pop}@keyframes pop{0%{opacity:0;transform:scale(.2) rotate(-12deg)}72%{opacity:1;transform:scale(1.14) rotate(2deg)}100%{opacity:1;transform:scale(1)}}@keyframes float{50%{transform:translateY(-24px)}}
/* DOCUMENTARY */.tpl-documentary .canvas{--accent:#fbbf24;--accent2:#e5e5e5;--muted:rgba(255,255,255,.5);--wm:rgba(255,255,255,.36);background:linear-gradient(180deg,#050505,#121212);color:#f5f5f5}.letterbox{position:absolute;left:0;right:0;height:${H>W?190:95}px;background:#000;z-index:10}.letterbox.top{top:0}.letterbox.bottom{bottom:0}.doc-focus{position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,transparent 0 45%,rgba(0,0,0,.55) 100%)}.tpl-documentary .headline{font-size:calc(${H>W?78:66}px * ${fontScale});letter-spacing:-.025em;text-shadow:0 10px 32px rgba(0,0,0,.6)}.tpl-documentary .word{animation-name:docFade}@keyframes docFade{from{opacity:0;filter:blur(12px);transform:scale(1.05)}to{opacity:1;filter:none;transform:none}}
/* TECH */.tpl-tech-blueprint .canvas{--accent:#38bdf8;--accent2:#22d3ee;--muted:rgba(56,189,248,.7);--wm:rgba(56,189,248,.45);background:#03162a;color:#e0f2fe}.blueprint{opacity:.45}.hud{position:absolute;color:#38bdf8;font:900 25px 'Courier New',monospace;letter-spacing:.18em}.h1{top:95px;right:80px}.h2{bottom:140px;left:80px}.tpl-tech-blueprint .headline{font-family:'Courier New','Noto Sans Devanagari',monospace;text-shadow:0 0 18px rgba(56,189,248,.8)}.tpl-tech-blueprint .word{animation-name:techReveal}@keyframes techReveal{from{opacity:0;clip-path:inset(0 100% 0 0);transform:translateX(-60px)}to{opacity:1;clip-path:inset(0);transform:none}}
/* GAMING */.tpl-gaming .canvas{--accent:#39ff14;--accent2:#f97316;--muted:rgba(57,255,20,.7);--wm:rgba(255,255,255,.36);background:linear-gradient(145deg,#080a12,#111827);color:#fff}.hud-frame{position:absolute;inset:75px;border:4px solid rgba(57,255,20,.38);clip-path:polygon(0 0,88% 0,100% 12%,100% 100%,12% 100%,0 88%)}.energy{position:absolute;left:-20%;width:140%;height:8px;background:linear-gradient(90deg,transparent,#39ff14,transparent);animation:energy 2.2s linear infinite}.e1{top:28%}.e2{bottom:29%;background:linear-gradient(90deg,transparent,#f97316,transparent);animation-duration:2.8s}.score{position:absolute;right:90px;top:95px;color:#39ff14;font:1000 36px Inter,sans-serif}.tpl-gaming .headline{text-transform:uppercase;text-shadow:0 0 16px rgba(57,255,20,.55)}.tpl-gaming .word{animation-name:gamePop}@keyframes gamePop{0%{opacity:0;transform:translateY(80px) skewX(-12deg)}70%{opacity:1;transform:translateY(-12px) skewX(2deg)}100%{opacity:1;transform:none}}@keyframes energy{to{transform:translateX(50%)}}
/* CLASSROOM */.tpl-classroom .canvas{--accent:#2563eb;--accent2:#f97316;--muted:rgba(15,23,42,.38);--wm:rgba(15,23,42,.30);background:linear-gradient(160deg,#f8fafc,#e2e8f0);color:#0f172a}.paper-card{position:absolute;inset:110px 84px;background:rgba(255,255,255,.62);border:2px solid rgba(15,23,42,.08);border-radius:44px;box-shadow:0 30px 80px rgba(15,23,42,.08)}.edu-shape{position:absolute;border:3px solid rgba(37,99,235,.14)}.es1{width:90px;height:90px;left:110px;top:430px;transform:rotate(45deg)}.es2{width:80px;height:80px;right:160px;bottom:370px;border-radius:18px;transform:rotate(8deg)}.tpl-classroom .word{animation-name:cleanFade}
/* VHS */.tpl-vhs .canvas{--accent:#f472b6;--accent2:#22d3ee;--muted:rgba(255,255,255,.55);--wm:rgba(255,255,255,.35);background:linear-gradient(145deg,#16001a,#001b21);color:#fdf4ff;font-family:'Courier New','Noto Sans Devanagari',monospace}.tpl-vhs .canvas:after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 4px,rgba(255,255,255,.055) 4px,rgba(255,255,255,.055) 8px);z-index:50;pointer-events:none}.rec,.tape{position:absolute;top:60px;font:900 24px 'Courier New',monospace;z-index:12}.rec{left:62px;color:#ff5c8a}.tape{right:62px;color:#22d3ee}.vhs-frame{position:absolute;inset:85px;border:2px solid rgba(255,255,255,.18);box-shadow:inset 0 0 60px rgba(244,114,182,.14)}.tpl-vhs .word{animation-name:vhsJitter}@keyframes vhsJitter{0%{opacity:0;transform:translateX(-30px);filter:blur(4px)}35%{opacity:1;transform:translateX(12px)}50%{transform:translateX(-7px)}100%{opacity:1;transform:none;filter:none}}
/* STARTUP */.tpl-startup .canvas{--accent:#4f46e5;--accent2:#0ea5e9;--muted:rgba(15,23,42,.38);--wm:rgba(15,23,42,.30);background:radial-gradient(circle at 20% 20%,rgba(79,70,229,.16),transparent 34%),radial-gradient(circle at 80% 70%,rgba(14,165,233,.14),transparent 34%),#fff;color:#101828}.saas-card{position:absolute;left:86px;right:86px;top:160px;bottom:160px;background:rgba(255,255,255,.66);border:1px solid rgba(16,24,40,.10);border-radius:48px;box-shadow:0 40px 120px rgba(16,24,40,.10)}.metric{position:absolute;padding:18px 28px;border-radius:999px;background:#101828;color:#fff;font:900 30px Inter,sans-serif}.m1{right:110px;top:190px}.m2{left:110px;bottom:200px}.tpl-startup .word{animation-name:cleanFade}
@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:600px){.headline{font-size:calc(${H>W?88:74}px * ${fontScale})}.tpl-viral-hook .headline{font-size:calc(${H>W?102:84}px * ${fontScale})}}
</style></head><body class="${bodyClassFor(style)} ${modClass}"><div class="viewport"><div class="canvas" id="canvas">${htmlScenes}<div class="progress"><div class="bar" id="bar"></div></div><div class="dots" id="dots">${dots}</div><div class="brand">shortscraft.online</div><div class="flash" id="flash"></div></div></div><script>
(function(){const W=${W},H=${H},DUR=${sceneMs};const cv=document.getElementById('canvas');const scenes=[...document.querySelectorAll('.scene')];const dots=[...document.querySelectorAll('.dot-ind')];const bar=document.getElementById('bar');const flash=document.getElementById('flash');let idx=0;function fit(){const s=Math.min(innerWidth/W,innerHeight/H);cv.style.transform='translate(-50%,-50%) scale('+s+')';}addEventListener('resize',fit,{passive:true});fit();function restartWords(sc){sc.querySelectorAll('.word').forEach(w=>{w.style.animation='none';void w.offsetWidth;w.style.animation='';});}function show(n){scenes[idx]?.classList.remove('active');dots[idx]?.classList.remove('on');idx=n;scenes[idx]?.classList.add('active');dots[idx]?.classList.add('on');restartWords(scenes[idx]);bar.style.transition='none';bar.style.width='0%';requestAnimationFrame(()=>requestAnimationFrame(()=>{bar.style.transition='width '+DUR+'ms linear';bar.style.width='100%';}));}show(0);if(scenes.length>1){setInterval(()=>{flash.classList.remove('hit');void flash.offsetWidth;flash.classList.add('hit');setTimeout(()=>show((idx+1)%scenes.length),130);},DUR);}})();
<\/script></body></html>`;
  }

  return { build, buildTemplateHTML, splitScript, cleanScript };
})();
