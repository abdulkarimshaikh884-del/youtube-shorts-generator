// 🔥 SUPABASE SETUP
const SUPABASE_URL = "https://mqsimdmogbycrbizrrsm.supabase.co";
const SUPABASE_KEY = "sb_publishable_r_S9UYXjN-I-xfx7s8Plrg_oIL64NEZ";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;

// ── DOM REFS ─────────────────────────────────────────────────
const topicInput     = document.getElementById('topic');
const generateBtn    = document.getElementById('generateBtn');
const statusText     = document.getElementById('status');
const resultsArea    = document.getElementById('resultsArea');
const scriptSections = document.getElementById('scriptSections');
const titlesContent  = document.getElementById('titlesContent');
const hooksContent   = document.getElementById('hooksContent');
const hashtagsContent= document.getElementById('hashtagsContent');
const ideasContent   = document.getElementById('ideasContent');
const thumbnailContent=document.getElementById('thumbnailContent');

// ── STATE ────────────────────────────────────────────────────
let lastScript='', lastTitles=[], lastHooks=[], lastHashtags=[], lastIdeas=[], lastThumbnail=[];
let currentUser = JSON.parse(localStorage.getItem('sc_user') || 'null');
let history     = JSON.parse(localStorage.getItem('sc_history') || '[]');
let saved       = JSON.parse(localStorage.getItem('sc_saved') || '[]');

// ── TOPBAR TABS ───────────────────────────────────────────────
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const panel = document.getElementById(`panel-${tab.dataset.tab}`);
    if (panel) panel.classList.add('active');
  });
});

// ── SIDEBAR ───────────────────────────────────────────────────
const sidebar        = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const sidebarToggle  = document.getElementById('sidebarToggle');
const sidebarClose   = document.getElementById('sidebarClose');

function openSidebar()  { sidebar.classList.add('open'); sidebarOverlay.classList.add('visible'); renderHistory(); }
function closeSidebar() { sidebar.classList.remove('open'); sidebarOverlay.classList.remove('visible'); }

sidebarToggle.addEventListener('click', openSidebar);
sidebarClose.addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);
document.getElementById('viewHistoryBtn')?.addEventListener('click', () => { closeDropdown(); openSidebar(); });
document.getElementById('viewSavedBtn')?.addEventListener('click',  () => { closeDropdown(); openSidebar(); });

document.getElementById('clearHistoryBtn').addEventListener('click', () => {
  history = []; localStorage.setItem('sc_history', '[]'); renderHistory();
});

function saveToHistory(topic, scriptData) {
  history.unshift({ topic, data: scriptData, time: Date.now() });
  if (history.length > 20) history.pop();
  localStorage.setItem('sc_history', JSON.stringify(history));
}

function renderHistory() {
  const histList  = document.getElementById('historyList');
  const savedList = document.getElementById('savedList');

  if (history.length === 0) {
    histList.innerHTML = `<div class="empty-history"><span>🎬</span><p>No scripts yet.<br/>Generate one to get started!</p></div>`;
  } else {
    histList.innerHTML = history.map((item, i) => `
      <div class="history-item" onclick="loadFromHistory(${i})">
        <div class="history-topic">${escapeHtml(item.topic)}</div>
        <div class="history-time">${timeAgo(item.time)}</div>
      </div>`).join('');
  }

  if (saved.length === 0) {
    savedList.innerHTML = `<div class="empty-history"><span>🔖</span><p>No saved scripts yet.<br/>Click ♡ to save one!</p></div>`;
  } else {
    savedList.innerHTML = saved.map((item, i) => `
      <div class="history-item" onclick="loadFromSaved(${i})">
        <div class="history-topic">🔖 ${escapeHtml(item.topic)}</div>
        <div class="history-time">${timeAgo(item.time)}</div>
      </div>`).join('');
  }
}

window.loadFromHistory = function(i) {
  const item = history[i];
  if (!item) return;
  topicInput.value = item.topic;
  applyResults(item.data);
  closeSidebar();
};

window.loadFromSaved = function(i) {
  const item = saved[i];
  if (!item) return;
  topicInput.value = item.topic;
  applyResults(item.data);
  closeSidebar();
};

function applyResults(data) {
  resultsArea.classList.remove('hidden');
  if (data.script)  renderScript(data.script);
  if (data.titles)  renderTitles(data.titles);
  if (data.hooks)   renderHooks(data.hooks);
  if (data.hashtags)renderHashtags(data.hashtags);
  if (data.ideas)   renderIdeas(data.ideas);
  if (data.thumbnail) renderThumbnail(data.thumbnail);
}

// ── SAVE SCRIPT ───────────────────────────────────────────────
document.getElementById('saveScriptBtn').addEventListener('click', function() {
  if (!lastScript) return;
  const topic = topicInput.value.trim() || 'Untitled';
  const exists = saved.find(s => s.topic === topic);
  if (!exists) {
    saved.unshift({ topic, data: { script: { hook: '', mainContent: lastScript, cta: '' }, titles: lastTitles, hooks: lastHooks, hashtags: lastHashtags, ideas: lastIdeas, thumbnail: lastThumbnail }, time: Date.now() });
    localStorage.setItem('sc_saved', JSON.stringify(saved));
  }
  this.textContent = '♥';
  this.classList.add('saved');
  setStatus('Script saved! 🔖', 'success');
});

// ── AUTH ──────────────────────────────────────────────────────
const authModal    = document.getElementById('authModal');
const loginBtn     = document.getElementById('loginBtn');
const profileMenu  = document.getElementById('profileMenu');
const profileDropdown = document.getElementById('profileDropdown');

function updateAuthUI() {
  if (currentUser) {
    loginBtn.classList.add('hidden');
    profileMenu.classList.remove('hidden');
    document.getElementById('avatarInitial').textContent   = currentUser.name[0].toUpperCase();
    document.getElementById('avatarInitialLg').textContent = currentUser.name[0].toUpperCase();
    document.getElementById('profileName').textContent  = currentUser.name;
    document.getElementById('profileEmail').textContent = currentUser.email;
  } else {
    loginBtn.classList.remove('hidden');
    profileMenu.classList.add('hidden');
  }
}

loginBtn.addEventListener('click', () => { authModal.classList.remove('hidden'); });
document.getElementById('authModalClose').addEventListener('click', () => authModal.classList.add('hidden'));
authModal.addEventListener('click', e => { if (e.target === authModal) authModal.classList.add('hidden'); });

document.querySelectorAll('.modal-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`auth-${tab.dataset.auth}`).classList.add('active');
  });
});

document.getElementById('signupSubmit').addEventListener('click', () => {
  const name     = document.getElementById('signupName').value.trim();
  const email    = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const errEl    = document.getElementById('signupError');
  if (!name || !email || !password) { showAuthError(errEl, 'Sab fields bharo!'); return; }
  if (password.length < 6)          { showAuthError(errEl, 'Password min 6 characters ka hona chahiye!'); return; }
  const users = JSON.parse(localStorage.getItem('sc_users') || '[]');
  if (users.find(u => u.email === email)) { showAuthError(errEl, 'Email already registered hai!'); return; }
  const user = { name, email, password };
  users.push(user);
  localStorage.setItem('sc_users', JSON.stringify(users));
  currentUser = { name, email };
  localStorage.setItem('sc_user', JSON.stringify(currentUser));
  authModal.classList.add('hidden');
  updateAuthUI();
  setStatus(`Welcome, ${name}! 🎉`, 'success');
});

document.getElementById('loginSubmit').addEventListener('click', () => {
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl    = document.getElementById('loginError');
  if (!email || !password) { showAuthError(errEl, 'Email aur password dono bharo!'); return; }
  const users = JSON.parse(localStorage.getItem('sc_users') || '[]');
  const user  = users.find(u => u.email === email && u.password === password);
  if (!user) { showAuthError(errEl, 'Email ya password galat hai!'); return; }
  currentUser = { name: user.name, email: user.email };
  localStorage.setItem('sc_user', JSON.stringify(currentUser));
  authModal.classList.add('hidden');
  updateAuthUI();
  setStatus(`Welcome back, ${user.name}! 👋`, 'success');
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  currentUser = null;
  localStorage.removeItem('sc_user');
  closeDropdown();
  updateAuthUI();
  setStatus('Logged out ho gaye 👋');
});

// Profile dropdown toggle
document.getElementById('profileAvatar')?.addEventListener('click', e => {
  e.stopPropagation();
  profileDropdown.classList.toggle('hidden');
});
document.addEventListener('click', closeDropdown);
function closeDropdown() { profileDropdown?.classList.add('hidden'); }

function showAuthError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 4000);
}

// ── HELPERS ───────────────────────────────────────────────────
function escapeHtml(t) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(t));
  return d.innerHTML;
}
function setStatus(msg, type='') {
  statusText.textContent = msg;
  statusText.className = `status ${type}`;
}
function setLoading(v) {
  generateBtn.disabled = v;
  generateBtn.querySelector('.btn-text').textContent = v ? 'Generating...' : 'Generate All';
}
function showSkeleton(el, count=3) {
  el.innerHTML = Array(count).fill('<div class="skeleton"></div>').join('');
}
function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff/60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

// ── RENDER ────────────────────────────────────────────────────
function renderScript(data) {
  const s = [];
  if (data.hook) s.push(`<div class="section-block hook"><div class="section-label">🔥 Hook</div><div class="section-text">${escapeHtml(data.hook)}</div></div>`);
  if (data.mainContent) s.push(`<div class="section-block main-content"><div class="section-label">📢 Main Content</div><div class="section-text">${escapeHtml(data.mainContent)}</div></div>`);
  if (data.cta) s.push(`<div class="section-block cta"><div class="section-label">👆 Call to Action</div><div class="section-text">${escapeHtml(data.cta)}</div></div>`);
  scriptSections.innerHTML = s.length ? s.join('') : '<div class="placeholder-block"><p class="placeholder-text">Script nahi aaya 😔</p></div>';
  lastScript = [data.hook?`Hook:\n${data.hook}`:'', data.mainContent?`Main Content:\n${data.mainContent}`:'', data.cta?`CTA:\n${data.cta}`:''].filter(Boolean).join('\n\n');
}

function renderTitles(arr) {
  titlesContent.innerHTML = arr.map((t,i) => `
    <div class="list-item" style="animation-delay:${i*.08}s">
      <span class="item-num">${i+1}</span>
      <span class="item-text">${escapeHtml(t)}</span>
      <button class="item-copy-btn" onclick="copyOne(this,${JSON.stringify(t)})">Copy</button>
    </div>`).join('');
  lastTitles = arr;
}

function renderHooks(arr) {
  const styles=['😱 Shock','🤔 Question','💥 Bold','😢 Pain Point','📖 Story'];
  hooksContent.innerHTML = arr.map((h,i) => `
    <div class="list-item hook-item" style="animation-delay:${i*.08}s">
      <div class="hook-style-badge">${styles[i]||`Hook ${i+1}`}</div>
      <span class="item-text">${escapeHtml(h)}</span>
      <button class="item-copy-btn" onclick="copyOne(this,${JSON.stringify(h)})">Copy</button>
    </div>`).join('');
  lastHooks = arr;
}

function renderHashtags(arr) {
  hashtagsContent.innerHTML = `<div class="hashtags-grid">${arr.map((h,i) =>
    `<span class="hashtag-chip" style="animation-delay:${i*.04}s" onclick="copyOne(this,${JSON.stringify(h)})">${escapeHtml(h)}</span>`
  ).join('')}</div>`;
  lastHashtags = arr;
}

function renderIdeas(arr) {
  ideasContent.innerHTML = arr.map((idea,i) => `
    <div class="list-item" style="animation-delay:${i*.08}s">
      <span class="item-num">${i+1}</span>
      <span class="item-text">${escapeHtml(idea)}</span>
      <button class="item-copy-btn" onclick="copyOne(this,${JSON.stringify(idea)})">Copy</button>
    </div>`).join('');
  lastIdeas = arr;
}

function renderThumbnail(arr) {
  thumbnailContent.innerHTML = arr.map((t,i) => `
    <div class="list-item" style="animation-delay:${i*.08}s">
      <span class="item-num">${i+1}</span>
      <span class="item-text">${escapeHtml(t)}</span>
      <button class="item-copy-btn" onclick="copyOne(this,${JSON.stringify(t)})">Copy</button>
    </div>`).join('');
  lastThumbnail = arr;
}

// ── COPY ──────────────────────────────────────────────────────
window.copyOne = async function(btn, text) {
  try {
    await navigator.clipboard.writeText(text);
    const orig = btn.textContent;
    btn.textContent = '✓'; btn.classList.add('copied');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1500);
  } catch { setStatus('Copy failed.', 'error'); }
};

async function copyAll(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    const orig = btn.innerHTML;
    btn.innerHTML = '✓ Copied!';
    setStatus('Copied! ✅', 'success');
    setTimeout(() => { btn.innerHTML = orig; }, 2000);
  } catch { setStatus('Copy failed.', 'error'); }
}

document.getElementById('copyScriptBtn').addEventListener('click', function() { if(lastScript) copyAll(lastScript, this); });
document.getElementById('copyTitlesBtn').addEventListener('click', function() { if(lastTitles.length) copyAll(lastTitles.join('\n'), this); });
document.getElementById('copyHooksBtn').addEventListener('click', function() { if(lastHooks.length) copyAll(lastHooks.join('\n\n'), this); });
document.getElementById('copyHashtagsBtn').addEventListener('click', function() { if(lastHashtags.length) copyAll(lastHashtags.join(' '), this); });
document.getElementById('copyIdeasBtn').addEventListener('click', function() { if(lastIdeas.length) copyAll(lastIdeas.join('\n'), this); });
document.getElementById('copyThumbnailBtn').addEventListener('click', function() { if(lastThumbnail.length) copyAll(lastThumbnail.join('\n'), this); });

// ── GENERATE ──────────────────────────────────────────────────
async function handleGenerate() {
  const topic = topicInput.value.trim();
  if (!topic) { setStatus('Pehle topic likho! 👆','error'); topicInput.focus(); return; }

  setLoading(true);
  setStatus('Sab generate ho raha hai... ✨');
  resultsArea.classList.remove('hidden');
  showSkeleton(scriptSections, 3);
  showSkeleton(titlesContent, 5);
  showSkeleton(hooksContent, 5);
  showSkeleton(hashtagsContent, 2);
  showSkeleton(ideasContent, 5);
  showSkeleton(thumbnailContent, 5);
  document.getElementById('saveScriptBtn').textContent = '♡';
  document.getElementById('saveScriptBtn').classList.remove('saved');

  const post = (url) => fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({topic}) });

  try {
    const [sR, tR, hR, htR, iR, thR] = await Promise.allSettled([
      post('/api/generate'), post('/api/titles'), post('/api/hooks'),
      post('/api/hashtags'), post('/api/ideas'), post('/api/thumbnail'),
    ]);

    let scriptData = { hook:'', mainContent:'', cta:'' };

    if (sR.status==='fulfilled' && sR.value.ok) { const d=await sR.value.json(); renderScript(d); scriptData=d; }
    else scriptSections.innerHTML='<div class="placeholder-block"><p class="placeholder-text">Script error 😔 Retry karo</p></div>';

    if (tR.status==='fulfilled' && tR.value.ok) renderTitles((await tR.value.json()).titles||[]);
    else titlesContent.innerHTML='<div class="placeholder-block"><p class="placeholder-text">Titles error 😔</p></div>';

    if (hR.status==='fulfilled' && hR.value.ok) renderHooks((await hR.value.json()).hooks||[]);
    else hooksContent.innerHTML='<div class="placeholder-block"><p class="placeholder-text">Hooks error 😔</p></div>';

    if (htR.status==='fulfilled' && htR.value.ok) renderHashtags((await htR.value.json()).hashtags||[]);
    else hashtagsContent.innerHTML='<div class="placeholder-block"><p class="placeholder-text">Hashtags error 😔</p></div>';

    if (iR.status==='fulfilled' && iR.value.ok) renderIdeas((await iR.value.json()).ideas||[]);
    else ideasContent.innerHTML='<div class="placeholder-block"><p class="placeholder-text">Ideas error 😔</p></div>';

    if (thR.status==='fulfilled' && thR.value.ok) renderThumbnail((await thR.value.json()).thumbnail||[]);
    else thumbnailContent.innerHTML='<div class="placeholder-block"><p class="placeholder-text">Thumbnail ideas error 😔</p></div>';

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

// ── INIT ──────────────────────────────────────────────────────
updateAuthUI();

// 🔐 AUTH SYSTEM

async function checkUser() {
  const { data: { user } } = await supabase.auth.getUser();
  currentUser = user;
  console.log("User:", user);
}

async function signup(email, password) {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) alert(error.message);
  else alert("Signup success! Check email 📩");
}

async function login(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) alert(error.message);
  else {
    alert("Login success 🎉");
    checkUser();
  }
}

async function logout() {
  await supabase.auth.signOut();
  currentUser = null;
}

// 💾 SAVE HISTORY
async function saveHistory(topic, script) {
  if (!currentUser) return;

  await supabase.from("history").insert([
    {
      user_id: currentUser.id,
      topic,
      script
    }
  ]);
}

// 🚀 INIT
checkUser();
