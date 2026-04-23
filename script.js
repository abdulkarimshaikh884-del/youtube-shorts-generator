// ── SUPABASE INIT ─────────────────────────────────────────────
const SUPABASE_URL  = 'https://mqsimdmogbycrbizrrsm.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_r_S9UYXjN-I-xfx7s8Plrg_oIL64NEZ';
const REDIRECT_URL  = window.location.origin;

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── DOM REFS ─────────────────────────────────────────────────
const topicInput      = document.getElementById('topic');
const generateBtn     = document.getElementById('generateBtn');
const statusText      = document.getElementById('status');
const resultsArea     = document.getElementById('resultsArea');
const scriptSections  = document.getElementById('scriptSections');
const titlesContent   = document.getElementById('titlesContent');
const hooksContent    = document.getElementById('hooksContent');
const hashtagsContent = document.getElementById('hashtagsContent');
const ideasContent    = document.getElementById('ideasContent');
const thumbnailContent= document.getElementById('thumbnailContent');

// ── STATE ────────────────────────────────────────────────────
let lastScript='', lastTitles=[], lastHooks=[], lastHashtags=[], lastIdeas=[], lastThumbnail=[];
let history = JSON.parse(localStorage.getItem('sc_history') || '[]');
let saved   = JSON.parse(localStorage.getItem('sc_saved')   || '[]');
let currentUser = null;

// ── TOAST ────────────────────────────────────────────────────
function toast(msg, type='') {
  let t = document.getElementById('sc-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'sc-toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = `toast ${type}`;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => t.classList.add('show'));
  });
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}

// ── AUTH UI ───────────────────────────────────────────────────
function updateAuthUI(user) {
  currentUser = user;
  const loginBtn    = document.getElementById('loginBtn');
  const profileMenu = document.getElementById('profileMenu');

  if (user) {
    loginBtn.classList.add('hidden');
    profileMenu.classList.remove('hidden');

    const name  = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
    const email = user.email || '';
    const photo = user.user_metadata?.avatar_url || '';
    const init  = name[0].toUpperCase();

    document.getElementById('profileName').textContent  = name;
    document.getElementById('profileEmail').textContent = email;

    // Avatar — photo or initial
    ['avatarImg','avatarImgLg'].forEach(id => {
      const img = document.getElementById(id);
      if (photo) { img.src = photo; img.style.display = 'block'; }
      else img.style.display = 'none';
    });
    ['avatarInitial','avatarInitialLg'].forEach(id => {
      const el = document.getElementById(id);
      el.textContent = init;
      el.style.display = photo ? 'none' : 'block';
    });
  } else {
    loginBtn.classList.remove('hidden');
    profileMenu.classList.add('hidden');
  }
}

// ── SUPABASE AUTH LISTENER ────────────────────────────────────
sb.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    updateAuthUI(session.user);
    document.getElementById('authModal').classList.add('hidden');
    if (event === 'SIGNED_IN') toast(`Welcome! 🎉`, 'success');
  } else {
    updateAuthUI(null);
  }
});

// On load — check existing session
sb.auth.getSession().then(({ data: { session } }) => {
  if (session?.user) updateAuthUI(session.user);
});

// ── GOOGLE SIGN IN ────────────────────────────────────────────
async function signInWithGoogle() {
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: REDIRECT_URL }
  });
  if (error) toast('Google sign in failed: ' + error.message, 'error');
}

document.getElementById('googleSignInBtn').addEventListener('click', signInWithGoogle);
document.getElementById('googleSignUpBtn').addEventListener('click', signInWithGoogle);

// ── EMAIL AUTH ────────────────────────────────────────────────
document.getElementById('signupSubmit').addEventListener('click', async () => {
  const name     = document.getElementById('signupName').value.trim();
  const email    = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const errEl    = document.getElementById('signupError');

  if (!name || !email || !password) { showAuthError(errEl, 'Sab fields bharo!'); return; }
  if (password.length < 6)          { showAuthError(errEl, 'Password min 6 characters!'); return; }

  const btn = document.getElementById('signupSubmit');
  btn.textContent = 'Creating...'; btn.disabled = true;

  const { error } = await sb.auth.signUp({
    email, password,
    options: { data: { full_name: name } }
  });

  btn.textContent = 'Create Account'; btn.disabled = false;

  if (error) { showAuthError(errEl, error.message); return; }
  toast('Account bana! Email check karo to confirm 📧', 'success');
  document.getElementById('authModal').classList.add('hidden');
});

document.getElementById('loginSubmit').addEventListener('click', async () => {
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl    = document.getElementById('loginError');

  if (!email || !password) { showAuthError(errEl, 'Email aur password bharo!'); return; }

  const btn = document.getElementById('loginSubmit');
  btn.textContent = 'Signing in...'; btn.disabled = true;

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  btn.textContent = 'Sign In'; btn.disabled = false;

  if (error) { showAuthError(errEl, 'Email ya password galat hai!'); return; }
  updateAuthUI(data.user);
  document.getElementById('authModal').classList.add('hidden');
  toast(`Welcome back! 👋`, 'success');
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await sb.auth.signOut();
  closeDropdown();
  toast('Logged out ho gaye 👋');
});

function showAuthError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 4000);
}

// ── MODAL ─────────────────────────────────────────────────────
document.getElementById('loginBtn').addEventListener('click', () => {
  document.getElementById('authModal').classList.remove('hidden');
});
document.getElementById('authModalClose').addEventListener('click', () => {
  document.getElementById('authModal').classList.add('hidden');
});
document.getElementById('authModal').addEventListener('click', e => {
  if (e.target === document.getElementById('authModal'))
    document.getElementById('authModal').classList.add('hidden');
});
document.querySelectorAll('.modal-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`auth-${tab.dataset.auth}`).classList.add('active');
  });
});

// ── PROFILE DROPDOWN ──────────────────────────────────────────
document.getElementById('profileAvatar')?.addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('profileDropdown').classList.toggle('hidden');
});
document.addEventListener('click', closeDropdown);
function closeDropdown() {
  document.getElementById('profileDropdown')?.classList.add('hidden');
}
document.getElementById('viewHistoryBtn')?.addEventListener('click', () => { closeDropdown(); openSidebar(); });
document.getElementById('viewSavedBtn')?.addEventListener('click',  () => { closeDropdown(); openSidebar(); });

// ── SIDEBAR ───────────────────────────────────────────────────
const sidebar        = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');

function openSidebar()  { sidebar.classList.add('open'); sidebarOverlay.classList.add('visible'); renderHistory(); }
function closeSidebar() { sidebar.classList.remove('open'); sidebarOverlay.classList.remove('visible'); }

document.getElementById('sidebarToggle').addEventListener('click', openSidebar);
document.getElementById('sidebarClose').addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

document.getElementById('clearHistoryBtn').addEventListener('click', () => {
  history = []; localStorage.setItem('sc_history', '[]'); renderHistory();
  toast('History clear ho gayi 🗑');
});

function saveToHistory(topic, data) {
  history.unshift({ topic, data, time: Date.now() });
  if (history.length > 20) history.pop();
  localStorage.setItem('sc_history', JSON.stringify(history));
}

function renderHistory() {
  const histList  = document.getElementById('historyList');
  const savedList = document.getElementById('savedList');

  histList.innerHTML = history.length === 0
    ? `<div class="empty-history"><span>🎬</span><p>No scripts yet.<br/>Generate one!</p></div>`
    : history.map((item, i) => `
        <div class="history-item" onclick="loadFromHistory(${i})">
          <div class="history-topic">${escapeHtml(item.topic)}</div>
          <div class="history-time">${timeAgo(item.time)}</div>
        </div>`).join('');

  savedList.innerHTML = saved.length === 0
    ? `<div class="empty-history"><span>🔖</span><p>No saved scripts yet.<br/>Click ♡ to save one!</p></div>`
    : saved.map((item, i) => `
        <div class="history-item" onclick="loadFromSaved(${i})">
          <div class="history-topic">🔖 ${escapeHtml(item.topic)}</div>
          <div class="history-time">${timeAgo(item.time)}</div>
        </div>`).join('');
}

window.loadFromHistory = (i) => { const item = history[i]; if (item) { topicInput.value = item.topic; applyResults(item.data); closeSidebar(); } };
window.loadFromSaved   = (i) => { const item = saved[i];   if (item) { topicInput.value = item.topic; applyResults(item.data); closeSidebar(); } };

function applyResults(data) {
  resultsArea.classList.remove('hidden');
  if (data.script)    renderScript(data.script);
  if (data.titles)    renderTitles(data.titles);
  if (data.hooks)     renderHooks(data.hooks);
  if (data.hashtags)  renderHashtags(data.hashtags);
  if (data.ideas)     renderIdeas(data.ideas);
  if (data.thumbnail) renderThumbnail(data.thumbnail);
}

// ── SAVE SCRIPT ───────────────────────────────────────────────
document.getElementById('saveScriptBtn').addEventListener('click', function() {
  if (!lastScript) return;
  const topic = topicInput.value.trim() || 'Untitled';
  if (!saved.find(s => s.topic === topic)) {
    saved.unshift({ topic, data: { script: { hook:'', mainContent: lastScript, cta:'' }, titles: lastTitles, hooks: lastHooks, hashtags: lastHashtags, ideas: lastIdeas, thumbnail: lastThumbnail }, time: Date.now() });
    localStorage.setItem('sc_saved', JSON.stringify(saved));
  }
  this.textContent = '♥';
  this.classList.add('saved');
  toast('Script saved! 🔖', 'success');
});

// ── TABS ──────────────────────────────────────────────────────
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.tab}`)?.classList.add('active');
  });
});

// ── HELPERS ───────────────────────────────────────────────────
function escapeHtml(t) { const d = document.createElement('div'); d.appendChild(document.createTextNode(t)); return d.innerHTML; }
function setStatus(msg, type='') { statusText.textContent = msg; statusText.className = `status ${type}`; }
function setLoading(v) { generateBtn.disabled = v; generateBtn.querySelector('.btn-text').textContent = v ? 'Generating...' : 'Generate All'; }
function showSkeleton(el, n=3) { el.innerHTML = Array(n).fill('<div class="skeleton"></div>').join(''); }
function timeAgo(ts) {
  const m = Math.floor((Date.now()-ts)/60000);
  if (m<1) return 'Just now'; if (m<60) return `${m}m ago`;
  const h = Math.floor(m/60); if (h<24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

// ── RENDER ────────────────────────────────────────────────────
function renderScript(data) {
  const s = [];
  if (data.hook)        s.push(`<div class="section-block hook"><div class="section-label">🔥 Hook</div><div class="section-text">${escapeHtml(data.hook)}</div></div>`);
  if (data.mainContent) s.push(`<div class="section-block main-content"><div class="section-label">📢 Main Content</div><div class="section-text">${escapeHtml(data.mainContent)}</div></div>`);
  if (data.cta)         s.push(`<div class="section-block cta"><div class="section-label">👆 Call to Action</div><div class="section-text">${escapeHtml(data.cta)}</div></div>`);
  scriptSections.innerHTML = s.length ? s.join('') : '<div class="placeholder-block"><p class="placeholder-text">Script nahi aaya 😔</p></div>';
  lastScript = [data.hook?`Hook:\n${data.hook}`:'', data.mainContent?`Main Content:\n${data.mainContent}`:'', data.cta?`CTA:\n${data.cta}`:''].filter(Boolean).join('\n\n');
}

function renderTitles(arr) {
  titlesContent.innerHTML = arr.map((t,i) => `<div class="list-item" style="animation-delay:${i*.08}s"><span class="item-num">${i+1}</span><span class="item-text">${escapeHtml(t)}</span><button class="item-copy-btn" onclick="copyOne(this,${JSON.stringify(t)})">Copy</button></div>`).join('');
  lastTitles = arr;
}

function renderHooks(arr) {
  const styles=['😱 Shock','🤔 Question','💥 Bold','😢 Pain Point','📖 Story'];
  hooksContent.innerHTML = arr.map((h,i) => `<div class="list-item hook-item" style="animation-delay:${i*.08}s"><div class="hook-style-badge">${styles[i]||`Hook ${i+1}`}</div><span class="item-text">${escapeHtml(h)}</span><button class="item-copy-btn" onclick="copyOne(this,${JSON.stringify(h)})">Copy</button></div>`).join('');
  lastHooks = arr;
}

function renderHashtags(arr) {
  hashtagsContent.innerHTML = `<div class="hashtags-grid">${arr.map((h,i) => `<span class="hashtag-chip" style="animation-delay:${i*.04}s" onclick="copyOne(this,${JSON.stringify(h)})">${escapeHtml(h)}</span>`).join('')}</div>`;
  lastHashtags = arr;
}

function renderIdeas(arr) {
  ideasContent.innerHTML = arr.map((idea,i) => `<div class="list-item" style="animation-delay:${i*.08}s"><span class="item-num">${i+1}</span><span class="item-text">${escapeHtml(idea)}</span><button class="item-copy-btn" onclick="copyOne(this,${JSON.stringify(idea)})">Copy</button></div>`).join('');
  lastIdeas = arr;
}

function renderThumbnail(arr) {
  thumbnailContent.innerHTML = arr.map((t,i) => `<div class="list-item" style="animation-delay:${i*.08}s"><span class="item-num">${i+1}</span><span class="item-text">${escapeHtml(t)}</span><button class="item-copy-btn" onclick="copyOne(this,${JSON.stringify(t)})">Copy</button></div>`).join('');
  lastThumbnail = arr;
}

// ── COPY ──────────────────────────────────────────────────────
window.copyOne = async function(btn, text) {
  try {
    await navigator.clipboard.writeText(text);
    const orig = btn.textContent; btn.textContent='✓'; btn.classList.add('copied');
    setTimeout(() => { btn.textContent=orig; btn.classList.remove('copied'); }, 1500);
  } catch { toast('Copy failed.','error'); }
};

async function copyAll(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    const orig = btn.innerHTML; btn.innerHTML='✓ Copied!';
    toast('Copied! ✅','success');
    setTimeout(() => { btn.innerHTML=orig; }, 2000);
  } catch { toast('Copy failed.','error'); }
}

document.getElementById('copyScriptBtn').addEventListener('click',    function(){ if(lastScript) copyAll(lastScript, this); });
document.getElementById('copyTitlesBtn').addEventListener('click',    function(){ if(lastTitles.length) copyAll(lastTitles.join('\n'), this); });
document.getElementById('copyHooksBtn').addEventListener('click',     function(){ if(lastHooks.length) copyAll(lastHooks.join('\n\n'), this); });
document.getElementById('copyHashtagsBtn').addEventListener('click',  function(){ if(lastHashtags.length) copyAll(lastHashtags.join(' '), this); });
document.getElementById('copyIdeasBtn').addEventListener('click',     function(){ if(lastIdeas.length) copyAll(lastIdeas.join('\n'), this); });
document.getElementById('copyThumbnailBtn').addEventListener('click', function(){ if(lastThumbnail.length) copyAll(lastThumbnail.join('\n'), this); });

// ── GENERATE ──────────────────────────────────────────────────
async function handleGenerate() {
  const topic = topicInput.value.trim();
  if (!topic) { setStatus('Pehle topic likho! 👆','error'); topicInput.focus(); return; }

  setLoading(true);
  setStatus('Sab generate ho raha hai... ✨');
  resultsArea.classList.remove('hidden');
  showSkeleton(scriptSections, 3); showSkeleton(titlesContent, 5);
  showSkeleton(hooksContent, 5);   showSkeleton(hashtagsContent, 2);
  showSkeleton(ideasContent, 5);   showSkeleton(thumbnailContent, 5);
  document.getElementById('saveScriptBtn').textContent = '♡';
  document.getElementById('saveScriptBtn').classList.remove('saved');

  const post = url => fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({topic}) });

  try {
    const [sR,tR,hR,htR,iR,thR] = await Promise.allSettled([
      post('/api/generate'), post('/api/titles'),    post('/api/hooks'),
      post('/api/hashtags'), post('/api/ideas'),     post('/api/thumbnail'),
    ]);

    let scriptData = { hook:'', mainContent:'', cta:'' };

    if (sR.status==='fulfilled'&&sR.value.ok)  { const d=await sR.value.json(); renderScript(d); scriptData=d; }
    else scriptSections.innerHTML='<div class="placeholder-block"><p class="placeholder-text">Script error 😔 Retry karo</p></div>';

    if (tR.status==='fulfilled'&&tR.value.ok)  renderTitles((await tR.value.json()).titles||[]);
    else titlesContent.innerHTML='<div class="placeholder-block"><p class="placeholder-text">Titles error 😔</p></div>';

    if (hR.status==='fulfilled'&&hR.value.ok)  renderHooks((await hR.value.json()).hooks||[]);
    else hooksContent.innerHTML='<div class="placeholder-block"><p class="placeholder-text">Hooks error 😔</p></div>';

    if (htR.status==='fulfilled'&&htR.value.ok) renderHashtags((await htR.value.json()).hashtags||[]);
    else hashtagsContent.innerHTML='<div class="placeholder-block"><p class="placeholder-text">Hashtags error 😔</p></div>';

    if (iR.status==='fulfilled'&&iR.value.ok)  renderIdeas((await iR.value.json()).ideas||[]);
    else ideasContent.innerHTML='<div class="placeholder-block"><p class="placeholder-text">Ideas error 😔</p></div>';

    if (thR.status==='fulfilled'&&thR.value.ok) renderThumbnail((await thR.value.json()).thumbnail||[]);
    else thumbnailContent.innerHTML='<div class="placeholder-block"><p class="placeholder-text">Thumbnail error 😔</p></div>';

    saveToHistory(topic, { script:scriptData, titles:lastTitles, hooks:lastHooks, hashtags:lastHashtags, ideas:lastIdeas, thumbnail:lastThumbnail });
    setStatus('Sab ready hai! Tabs check karo 🎉','success');

  } catch(err) {
    setStatus(err.message||'Kuch problem ho gayi. Retry karo!','error');
  } finally {
    setLoading(false);
  }
}

generateBtn.addEventListener('click', handleGenerate);
topicInput.addEventListener('keydown', e => { if(e.key==='Enter') handleGenerate(); });
