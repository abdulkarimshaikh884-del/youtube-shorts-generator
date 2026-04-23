// ── SUPABASE ──────────────────────────────────────────────────
const SUPABASE_URL = 'https://mqsimdmogbycrbizrrsm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_r_S9UYXjN-I-xfx7s8Plrg_oIL64NEZ';
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── DOM ───────────────────────────────────────────────────────
const topicInput       = document.getElementById('topic');
const generateBtn      = document.getElementById('generateBtn');
const statusText       = document.getElementById('status');
const resultsArea      = document.getElementById('resultsArea');
const scriptSections   = document.getElementById('scriptSections');
const titlesContent    = document.getElementById('titlesContent');
const hooksContent     = document.getElementById('hooksContent');
const hashtagsContent  = document.getElementById('hashtagsContent');
const ideasContent     = document.getElementById('ideasContent');
const thumbnailContent = document.getElementById('thumbnailContent');

// ── STATE ─────────────────────────────────────────────────────
let currentUser = null;
let isPro = false;
let lastScript='', lastTitles=[], lastHooks=[], lastHashtags=[], lastIdeas=[], lastThumbnail=[];

// ── CREDITS SYSTEM ────────────────────────────────────────────
const DAILY_CREDITS = 5;
const CREDITS_KEY   = 'sc_credits';
const DATE_KEY      = 'sc_credits_date';

function getTodayStr() { return new Date().toISOString().split('T')[0]; }

function getCredits() {
  if (isPro) return 999;
  const today = getTodayStr();
  const savedDate = localStorage.getItem(DATE_KEY);
  if (savedDate !== today) {
    localStorage.setItem(DATE_KEY, today);
    localStorage.setItem(CREDITS_KEY, DAILY_CREDITS);
    return DAILY_CREDITS;
  }
  return parseInt(localStorage.getItem(CREDITS_KEY) ?? DAILY_CREDITS);
}

function setCredits(n) {
  localStorage.setItem(CREDITS_KEY, Math.max(0, n));
  updateCreditsBadge();
}

function useCredit() {
  const c = getCredits();
  if (c <= 0) return false;
  setCredits(c - 1);
  return true;
}

function addCredit(n = 1) {
  setCredits(getCredits() + n);
  toast(`+${n} credit earned! ⚡`, 'success');
}

function updateCreditsBadge() {
  const c = getCredits();
  document.getElementById('creditsCount').textContent     = isPro ? '∞' : c;
  document.getElementById('creditsInfoCount').textContent = isPro ? '∞' : c;
  const badge = document.getElementById('creditsBadge');
  if (currentUser) badge.classList.remove('hidden');
  else badge.classList.add('hidden');
  if (!isPro && c <= 1) badge.classList.add('low');
  else badge.classList.remove('low');
}

// ── TASKS FOR EARN CREDITS ────────────────────────────────────
const TASKS = [
  { id: 'share_twitter', label: '🐦 Share ShortsCraft on Twitter/X',       icon: '🐦', url: 'https://twitter.com/intent/tweet?text=Check%20out%20ShortsCraft%20-%20Free%20Hinglish%20YouTube%20Shorts%20Script%20Generator!%20https://youtube-shorts-generator-yngg.onrender.com' },
  { id: 'share_whatsapp', label: '💬 Share on WhatsApp with a friend',     icon: '💬', url: 'https://wa.me/?text=Yaar%20ye%20tool%20dekho%20-%20Free%20YouTube%20Shorts%20Script%20Generator!%20https://youtube-shorts-generator-yngg.onrender.com' },
  { id: 'visit_youtube',  label: '▶️ Visit YouTube and subscribe to a channel', icon: '▶️', url: 'https://youtube.com' },
  { id: 'follow_github',  label: '⭐ Star the project on GitHub',           icon: '⭐', url: 'https://github.com' },
  { id: 'write_review',   label: '📝 Write a review (copy template)',       icon: '📝', url: null, action: 'review' },
];

function getCompletedTasks() { return JSON.parse(localStorage.getItem('sc_tasks_done') || '[]'); }
function markTaskDone(id) {
  const done = getCompletedTasks();
  if (!done.includes(id)) { done.push(id); localStorage.setItem('sc_tasks_done', JSON.stringify(done)); }
}

function renderTasks() {
  const done = getCompletedTasks();
  const list = document.getElementById('tasksList');
  list.innerHTML = TASKS.map(task => {
    const isDone = done.includes(task.id);
    return `
      <div class="task-item ${isDone ? 'done' : ''}">
        <span class="task-icon">${task.icon}</span>
        <span class="task-label">${task.label}</span>
        ${isDone
          ? '<span class="task-done-badge">✓ Done</span>'
          : `<button class="task-btn" onclick="completeTask('${task.id}', '${task.url}', '${task.action||''}')">Do it</button>`}
      </div>`;
  }).join('');
}

window.completeTask = function(id, url, action) {
  const done = getCompletedTasks();
  if (done.includes(id)) { toast('Already completed!'); return; }
  if (action === 'review') {
    navigator.clipboard.writeText('ShortsCraft is amazing! Free Hinglish YouTube Shorts scripts generator. Highly recommend!').then(() => {
      toast('Review template copied! Paste it somewhere 📝');
    });
  } else if (url && url !== 'null') {
    window.open(url, '_blank');
  }
  markTaskDone(id);
  addCredit(1);
  renderTasks();
};

// ── SUPABASE DB HELPERS ───────────────────────────────────────
async function dbSaveScript(topic, data) {
  if (!currentUser) return;
  try {
    await sb.from('saved_scripts').upsert({
      user_id: currentUser.id,
      topic,
      data: JSON.stringify(data),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,topic' });
  } catch (e) { console.error('DB save error:', e); }
}

async function dbLoadHistory() {
  if (!currentUser) return [];
  try {
    const { data, error } = await sb.from('script_history')
      .select('*').eq('user_id', currentUser.id)
      .order('created_at', { ascending: false }).limit(20);
    if (error) throw error;
    return data || [];
  } catch (e) { console.error('DB history error:', e); return []; }
}

async function dbSaveHistory(topic, data) {
  if (!currentUser) return;
  try {
    await sb.from('script_history').insert({
      user_id: currentUser.id,
      topic,
      data: JSON.stringify(data),
    });
  } catch (e) { console.error('DB history save error:', e); }
}

async function dbLoadSaved() {
  if (!currentUser) return [];
  try {
    const { data, error } = await sb.from('saved_scripts')
      .select('*').eq('user_id', currentUser.id)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) { console.error('DB saved error:', e); return []; }
}

async function dbDeleteSaved(topic) {
  if (!currentUser) return;
  try {
    await sb.from('saved_scripts').delete()
      .eq('user_id', currentUser.id).eq('topic', topic);
  } catch (e) { console.error('DB delete error:', e); }
}

// ── AUTH UI ───────────────────────────────────────────────────
function updateAuthUI(user) {
  currentUser = user;
  const loginBtn    = document.getElementById('loginBtn');
  const profileMenu = document.getElementById('profileMenu');
  const creditsBadge= document.getElementById('creditsBadge');

  if (user) {
    loginBtn.classList.add('hidden');
    profileMenu.classList.remove('hidden');
    creditsBadge.classList.remove('hidden');

    const name  = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
    const email = user.email || '';
    const photo = user.user_metadata?.avatar_url || '';
    const init  = name[0].toUpperCase();

    document.getElementById('profileName').textContent  = name;
    document.getElementById('profileEmail').textContent = email;
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
    updateCreditsBadge();
  } else {
    loginBtn.classList.remove('hidden');
    profileMenu.classList.add('hidden');
    creditsBadge.classList.add('hidden');
    currentUser = null;
  }
}

// ── AUTH LISTENER ─────────────────────────────────────────────
sb.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    updateAuthUI(session.user);
    document.getElementById('authModal').classList.add('hidden');
    if (event === 'SIGNED_IN') toast(`Welcome! 🎉`, 'success');
  } else {
    updateAuthUI(null);
  }
});
sb.auth.getSession().then(({ data: { session } }) => {
  if (session?.user) updateAuthUI(session.user);
});

// ── GOOGLE AUTH ───────────────────────────────────────────────
async function signInWithGoogle() {
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
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
  if (password.length < 6) { showAuthError(errEl, 'Password min 6 characters!'); return; }
  const btn = document.getElementById('signupSubmit');
  btn.textContent = 'Creating...'; btn.disabled = true;
  const { error } = await sb.auth.signUp({ email, password, options: { data: { full_name: name } } });
  btn.textContent = 'Create Account'; btn.disabled = false;
  if (error) { showAuthError(errEl, error.message); return; }
  toast('Account bana! Email confirm karo 📧', 'success');
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
  toast('Logged out 👋');
});

function showAuthError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden'); el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 4000);
}

// ── MODALS ────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

document.getElementById('loginBtn').addEventListener('click', () => openModal('authModal'));
document.getElementById('authModalClose').addEventListener('click', () => closeModal('authModal'));
document.getElementById('authModal').addEventListener('click', e => { if(e.target.id==='authModal') closeModal('authModal'); });

document.getElementById('upgradeBtn').addEventListener('click', () => { closeDropdown(); openModal('upgradeModal'); });
document.getElementById('upgradeModalClose').addEventListener('click', () => closeModal('upgradeModal'));
document.getElementById('upgradeModal').addEventListener('click', e => { if(e.target.id==='upgradeModal') closeModal('upgradeModal'); });
document.getElementById('upgradeSubmit').addEventListener('click', () => { toast('Payment integration coming soon! Contact us 📧'); });

document.getElementById('earnCreditsLink').addEventListener('click', () => { closeDropdown(); openModal('earnModal'); renderTasks(); });
document.getElementById('earnModalClose').addEventListener('click', () => closeModal('earnModal'));
document.getElementById('earnModal').addEventListener('click', e => { if(e.target.id==='earnModal') closeModal('earnModal'); });

document.getElementById('noCreditsModalClose').addEventListener('click', () => closeModal('noCreditsModal'));
document.getElementById('noCreditsEarnBtn').addEventListener('click', () => { closeModal('noCreditsModal'); openModal('earnModal'); renderTasks(); });
document.getElementById('noCreditsUpgradeBtn').addEventListener('click', () => { closeModal('noCreditsModal'); openModal('upgradeModal'); });

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
function closeDropdown() { document.getElementById('profileDropdown')?.classList.add('hidden'); }

document.getElementById('viewHistoryBtn')?.addEventListener('click', () => { closeDropdown(); openSidebar(); });
document.getElementById('viewSavedBtn')?.addEventListener('click',  () => { closeDropdown(); openSidebar(); });

// ── SIDEBAR ───────────────────────────────────────────────────
const sidebar        = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');

function openSidebar()  { sidebar.classList.add('open'); sidebarOverlay.classList.add('visible'); renderSidebar(); }
function closeSidebar() { sidebar.classList.remove('open'); sidebarOverlay.classList.remove('visible'); }

document.getElementById('sidebarToggle').addEventListener('click', openSidebar);
document.getElementById('sidebarClose').addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

document.getElementById('clearHistoryBtn').addEventListener('click', async () => {
  if (currentUser) { try { await sb.from('script_history').delete().eq('user_id', currentUser.id); } catch(e){} }
  document.getElementById('historyList').innerHTML = '<div class="empty-history"><span>🎬</span><p>No scripts yet!</p></div>';
  toast('History cleared 🗑');
});

async function renderSidebar() {
  const histList  = document.getElementById('historyList');
  const savedList = document.getElementById('savedList');

  if (!currentUser) {
    histList.innerHTML  = '<div class="empty-history"><span>🔒</span><p>Sign in to see history</p></div>';
    savedList.innerHTML = '<div class="empty-history"><span>🔒</span><p>Sign in to see saved scripts</p></div>';
    return;
  }

  histList.innerHTML  = '<div class="skeleton" style="height:60px"></div>';
  savedList.innerHTML = '<div class="skeleton" style="height:60px"></div>';

  const [histData, savedData] = await Promise.all([dbLoadHistory(), dbLoadSaved()]);

  histList.innerHTML = histData.length === 0
    ? '<div class="empty-history"><span>🎬</span><p>No scripts yet!</p></div>'
    : histData.map((item, i) => `
        <div class="history-item" onclick="loadHistoryItem(${i}, 'history')">
          <div class="history-topic">${escapeHtml(item.topic)}</div>
          <div class="history-time">${timeAgo(item.created_at)}</div>
        </div>`).join('');

  savedList.innerHTML = savedData.length === 0
    ? '<div class="empty-history"><span>🔖</span><p>No saved scripts yet!</p></div>'
    : savedData.map((item, i) => `
        <div class="history-item">
          <div onclick="loadHistoryItem(${i}, 'saved')" style="flex:1;cursor:pointer">
            <div class="history-topic">🔖 ${escapeHtml(item.topic)}</div>
            <div class="history-time">${timeAgo(item.updated_at)}</div>
          </div>
          <button class="item-copy-btn" onclick="deleteSaved('${escapeHtml(item.topic)}', this)" style="margin-top:4px">🗑</button>
        </div>`).join('');

  // Store for click loading
  window._histData  = histData;
  window._savedData = savedData;
}

window.loadHistoryItem = function(i, type) {
  const arr = type === 'saved' ? window._savedData : window._histData;
  const item = arr?.[i]; if (!item) return;
  const data = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
  topicInput.value = item.topic;
  applyResults(data);
  closeSidebar();
};

window.deleteSaved = async function(topic, btn) {
  btn.textContent = '...'; btn.disabled = true;
  await dbDeleteSaved(topic);
  toast('Deleted 🗑');
  renderSidebar();
};

// ── SAVE SCRIPT ───────────────────────────────────────────────
document.getElementById('saveScriptBtn').addEventListener('click', async function() {
  if (!lastScript) return;
  if (!currentUser) { toast('Pehle sign in karo! 🔐', 'error'); openModal('authModal'); return; }
  const topic = topicInput.value.trim() || 'Untitled';
  const data = { script: { hook:'', mainContent: lastScript, cta:'' }, titles: lastTitles, hooks: lastHooks, hashtags: lastHashtags, ideas: lastIdeas, thumbnail: lastThumbnail };
  await dbSaveScript(topic, data);
  this.textContent = '♥'; this.classList.add('saved');
  toast('Script saved to your account! 🔖', 'success');
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
function escapeHtml(t) { const d=document.createElement('div'); d.appendChild(document.createTextNode(t)); return d.innerHTML; }
function setStatus(msg, type='') { statusText.textContent=msg; statusText.className=`status ${type}`; }
function setLoading(v) { generateBtn.disabled=v; generateBtn.querySelector('.btn-text').textContent=v?'Generating...':'Generate All'; }
function showSkeleton(el, n=3) { el.innerHTML=Array(n).fill('<div class="skeleton"></div>').join(''); }
function timeAgo(ts) {
  const ms = typeof ts === 'string' ? new Date(ts).getTime() : ts;
  const m = Math.floor((Date.now()-ms)/60000);
  if(m<1) return 'Just now'; if(m<60) return `${m}m ago`;
  const h=Math.floor(m/60); if(h<24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

function applyResults(data) {
  resultsArea.classList.remove('hidden');
  if (data.script)    renderScript(data.script);
  if (data.titles)    renderTitles(data.titles);
  if (data.hooks)     renderHooks(data.hooks);
  if (data.hashtags)  renderHashtags(data.hashtags);
  if (data.ideas)     renderIdeas(data.ideas);
  if (data.thumbnail) renderThumbnail(data.thumbnail);
}

// ── RENDER ────────────────────────────────────────────────────
function renderScript(data) {
  const s=[];
  if(data.hook) s.push(`<div class="section-block hook"><div class="section-label">🔥 Hook</div><div class="section-text">${escapeHtml(data.hook)}</div></div>`);
  if(data.mainContent) s.push(`<div class="section-block main-content"><div class="section-label">📢 Main Content</div><div class="section-text">${escapeHtml(data.mainContent)}</div></div>`);
  if(data.cta) s.push(`<div class="section-block cta"><div class="section-label">👆 Call to Action</div><div class="section-text">${escapeHtml(data.cta)}</div></div>`);
  scriptSections.innerHTML=s.length?s.join(''):'<div class="placeholder-block"><p class="placeholder-text">Script nahi aaya 😔</p></div>';
  lastScript=[data.hook?`Hook:\n${data.hook}`:'',data.mainContent?`Main Content:\n${data.mainContent}`:'',data.cta?`CTA:\n${data.cta}`:''].filter(Boolean).join('\n\n');
}
function renderTitles(arr) {
  titlesContent.innerHTML=arr.map((t,i)=>`<div class="list-item" style="animation-delay:${i*.08}s"><span class="item-num">${i+1}</span><span class="item-text">${escapeHtml(t)}</span><button class="item-copy-btn" onclick="copyOne(this,${JSON.stringify(t)})">Copy</button></div>`).join('');
  lastTitles=arr;
}
function renderHooks(arr) {
  const styles=['😱 Shock','🤔 Question','💥 Bold','😢 Pain Point','📖 Story'];
  hooksContent.innerHTML=arr.map((h,i)=>`<div class="list-item hook-item" style="animation-delay:${i*.08}s"><div class="hook-style-badge">${styles[i]||`Hook ${i+1}`}</div><span class="item-text">${escapeHtml(h)}</span><button class="item-copy-btn" onclick="copyOne(this,${JSON.stringify(h)})">Copy</button></div>`).join('');
  lastHooks=arr;
}
function renderHashtags(arr) {
  hashtagsContent.innerHTML=`<div class="hashtags-grid">${arr.map((h,i)=>`<span class="hashtag-chip" style="animation-delay:${i*.04}s" onclick="copyOne(this,${JSON.stringify(h)})">${escapeHtml(h)}</span>`).join('')}</div>`;
  lastHashtags=arr;
}
function renderIdeas(arr) {
  ideasContent.innerHTML=arr.map((x,i)=>`<div class="list-item" style="animation-delay:${i*.08}s"><span class="item-num">${i+1}</span><span class="item-text">${escapeHtml(x)}</span><button class="item-copy-btn" onclick="copyOne(this,${JSON.stringify(x)})">Copy</button></div>`).join('');
  lastIdeas=arr;
}
function renderThumbnail(arr) {
  thumbnailContent.innerHTML=arr.map((t,i)=>`
    <div class="list-item thumb-prompt-item" style="animation-delay:${i*.1}s">
      <div class="thumb-prompt-header">
        <span class="thumb-prompt-num">Prompt ${i+1}</span>
        <button class="item-copy-btn" onclick="copyOne(this,${JSON.stringify(t)})">Copy</button>
      </div>
      <div class="thumb-prompt-text">${escapeHtml(t)}</div>
    </div>`).join('');
  lastThumbnail=arr;
}

// ── COPY ──────────────────────────────────────────────────────
window.copyOne = async function(btn, text) {
  try {
    await navigator.clipboard.writeText(text);
    const orig=btn.textContent; btn.textContent='✓'; btn.classList.add('copied');
    setTimeout(()=>{ btn.textContent=orig; btn.classList.remove('copied'); },1500);
  } catch { toast('Copy failed','error'); }
};
async function copyAll(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    const orig=btn.innerHTML; btn.innerHTML='✓ Copied!';
    toast('Copied! ✅','success');
    setTimeout(()=>{ btn.innerHTML=orig; },2000);
  } catch { toast('Copy failed','error'); }
}
document.getElementById('copyScriptBtn').addEventListener('click',    function(){ if(lastScript) copyAll(lastScript,this); });
document.getElementById('copyTitlesBtn').addEventListener('click',    function(){ if(lastTitles.length) copyAll(lastTitles.join('\n'),this); });
document.getElementById('copyHooksBtn').addEventListener('click',     function(){ if(lastHooks.length) copyAll(lastHooks.join('\n\n'),this); });
document.getElementById('copyHashtagsBtn').addEventListener('click',  function(){ if(lastHashtags.length) copyAll(lastHashtags.join(' '),this); });
document.getElementById('copyIdeasBtn').addEventListener('click',     function(){ if(lastIdeas.length) copyAll(lastIdeas.join('\n'),this); });
document.getElementById('copyThumbnailBtn').addEventListener('click', function(){ if(lastThumbnail.length) copyAll(lastThumbnail.join('\n\n---\n\n'),this); });

// ── GENERATE ──────────────────────────────────────────────────
async function handleGenerate() {
  const topic = topicInput.value.trim();
  if (!topic) { setStatus('Pehle topic likho! 👆','error'); topicInput.focus(); return; }

  // Credit check
  if (!currentUser) { toast('Pehle sign in karo!','error'); openModal('authModal'); return; }
  if (!isPro && getCredits() <= 0) { openModal('noCreditsModal'); return; }

  if (!useCredit()) { openModal('noCreditsModal'); return; }

  setLoading(true);
  setStatus('Sab generate ho raha hai... ✨');
  resultsArea.classList.remove('hidden');
  showSkeleton(scriptSections,3); showSkeleton(titlesContent,5);
  showSkeleton(hooksContent,5);   showSkeleton(hashtagsContent,2);
  showSkeleton(ideasContent,5);   showSkeleton(thumbnailContent,3);
  document.getElementById('saveScriptBtn').textContent='♡';
  document.getElementById('saveScriptBtn').classList.remove('saved');

  const post = url => fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic})});

  try {
    const [sR,tR,hR,htR,iR,thR] = await Promise.allSettled([
      post('/api/generate'), post('/api/titles'), post('/api/hooks'),
      post('/api/hashtags'), post('/api/ideas'), post('/api/thumbnail'),
    ]);

    let scriptData={hook:'',mainContent:'',cta:''};
    if(sR.status==='fulfilled'&&sR.value.ok){ const d=await sR.value.json(); renderScript(d); scriptData=d; }
    else scriptSections.innerHTML='<div class="placeholder-block"><p class="placeholder-text">Script error 😔</p></div>';
    if(tR.status==='fulfilled'&&tR.value.ok) renderTitles((await tR.value.json()).titles||[]);
    if(hR.status==='fulfilled'&&hR.value.ok) renderHooks((await hR.value.json()).hooks||[]);
    if(htR.status==='fulfilled'&&htR.value.ok) renderHashtags((await htR.value.json()).hashtags||[]);
    if(iR.status==='fulfilled'&&iR.value.ok) renderIdeas((await iR.value.json()).ideas||[]);
    if(thR.status==='fulfilled'&&thR.value.ok) renderThumbnail((await thR.value.json()).thumbnail||[]);

    const allData={script:scriptData,titles:lastTitles,hooks:lastHooks,hashtags:lastHashtags,ideas:lastIdeas,thumbnail:lastThumbnail};
    await dbSaveHistory(topic, allData);
    setStatus(`Sab ready hai! ⚡ ${isPro?'∞':getCredits()} credits remaining`,'success');

  } catch(err) {
    setStatus(err.message||'Kuch problem ho gayi!','error');
  } finally {
    setLoading(false);
  }
}

generateBtn.addEventListener('click', handleGenerate);
topicInput.addEventListener('keydown', e => { if(e.key==='Enter') handleGenerate(); });

// ── TOAST ─────────────────────────────────────────────────────
function toast(msg, type='') {
  let t=document.getElementById('sc-toast');
  if(!t){ t=document.createElement('div'); t.id='sc-toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent=msg; t.className=`toast ${type}`;
  requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add('show')));
  clearTimeout(t._timer);
  t._timer=setTimeout(()=>t.classList.remove('show'),3000);
}

// ── INIT ──────────────────────────────────────────────────────
updateCreditsBadge();
