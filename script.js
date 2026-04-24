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
const descContent      = document.getElementById('descContent');
const hashtagsContent  = document.getElementById('hashtagsContent');
const ideasContent     = document.getElementById('ideasContent');
const thumbnailContent = document.getElementById('thumbnailContent');

// ── STATE ─────────────────────────────────────────────────────
let currentUser = null;
let isPro       = false;
let lastScript='', lastTitles=[], lastDesc='', lastHashtags=[], lastIdeas=[], lastThumbnail=[];

// ── DYNAMIC HERO HEADING ──────────────────────────────────────
const TAB_LABELS = {
  script:      'Script Generator',
  titles:      'Title Generator',
  description: 'Description Generator',
  hashtags:    'Hashtag Generator',
  ideas:       'Ideas Generator',
  thumbnail:   'Thumbnail Generator',
};

function updateHeroHeading(tab) {
  const el = document.getElementById('heroAccent');
  if (!el) return;
  el.style.opacity = '0';
  setTimeout(() => {
    el.textContent = TAB_LABELS[tab] || 'Script Generator';
    el.style.opacity = '1';
  }, 160);
}

// ── TABS ──────────────────────────────────────────────────────
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const tabId = tab.dataset.tab;
    document.getElementById(`panel-${tabId}`)?.classList.add('active');
    updateHeroHeading(tabId);

    // Scroll active tab into view on mobile
    try {
      tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    } catch (_) {}
  });
});

// ── CREDITS ───────────────────────────────────────────────────
const DAILY_FREE = 5;

function getTodayStr() { return new Date().toISOString().split('T')[0]; }

function getCredits() {
  if (isPro) return 999;
  const today = getTodayStr();
  if (localStorage.getItem('sc_credit_date') !== today) {
    localStorage.setItem('sc_credit_date', today);
    localStorage.setItem('sc_credits', DAILY_FREE);
  }
  return parseInt(localStorage.getItem('sc_credits') ?? DAILY_FREE);
}

function setCredits(n) {
  localStorage.setItem('sc_credits', Math.max(0, n));
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
  const display = isPro ? '∞' : c;
  const cntEl = document.getElementById('creditsCount');
  const infoEl = document.getElementById('creditsInfoCount');
  if (cntEl)  cntEl.textContent  = display;
  if (infoEl) infoEl.textContent = display;
  const badge = document.getElementById('creditsBadge');
  if (!badge) return;
  if (currentUser) badge.classList.remove('hidden');
  else badge.classList.add('hidden');
  badge.classList.toggle('low', !isPro && c <= 1);
}

// ── EARN TASKS ────────────────────────────────────────────────
const TASKS = [
  { id: 'share_twitter',  icon: '🐦', label: 'Share ShortsCraft on Twitter/X',       url: 'https://twitter.com/intent/tweet?text=Check%20out%20ShortsCraft%20-%20Free%20AI%20YouTube%20Shorts%20Generator!%20https://youtube-shorts-generator-yngg.onrender.com' },
  { id: 'share_whatsapp', icon: '💬', label: 'Share on WhatsApp with a friend',       url: 'https://wa.me/?text=Free%20YouTube%20Shorts%20Script%20Generator!%20https://youtube-shorts-generator-yngg.onrender.com' },
  { id: 'visit_youtube',  icon: '▶️', label: 'Visit YouTube and watch a Shorts video', url: 'https://youtube.com/shorts' },
  { id: 'star_github',    icon: '⭐', label: 'Star the project on GitHub',             url: 'https://github.com' },
  { id: 'copy_review',    icon: '📝', label: 'Copy & share a review anywhere',         url: null, action: 'review' },
];

function getCompletedTasks() { return JSON.parse(localStorage.getItem('sc_tasks_done') || '[]'); }

function renderTasks() {
  const done = getCompletedTasks();
  document.getElementById('tasksList').innerHTML = TASKS.map(task => {
    const isDone = done.includes(task.id);
    return `<div class="task-item ${isDone ? 'done' : ''}">
      <span class="task-icon">${task.icon}</span>
      <span class="task-label">${task.label}</span>
      ${isDone
        ? '<span class="task-done-badge">✓ Done</span>'
        : `<button class="task-btn" onclick="completeTask('${task.id}','${task.url||''}','${task.action||''}')">Do it</button>`}
    </div>`;
  }).join('');
}

window.completeTask = function(id, url, action) {
  const done = getCompletedTasks();
  if (done.includes(id)) { toast('Already completed!'); return; }
  if (action === 'review') {
    navigator.clipboard.writeText('ShortsCraft is amazing! Free AI YouTube Shorts script & content generator for Indian creators. Highly recommend!').then(() => toast('Review copied! Paste it anywhere 📝'));
  } else if (url) {
    window.open(url, '_blank');
  }
  done.push(id);
  localStorage.setItem('sc_tasks_done', JSON.stringify(done));
  addCredit(1);
  renderTasks();
};

// ── SUPABASE DB ───────────────────────────────────────────────
async function dbSaveHistory(topic, data) {
  if (!currentUser) return;
  try { await sb.from('script_history').insert({ user_id: currentUser.id, topic, data: JSON.stringify(data) }); }
  catch(e) { console.error('History save:', e); }
}

async function dbLoadHistory() {
  if (!currentUser) return [];
  try {
    const { data } = await sb.from('script_history').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(25);
    return data || [];
  } catch { return []; }
}

async function dbDeleteHistory(item) {
  if (!currentUser || !item) return;
  try {
    if (item.id != null) {
      await sb.from('script_history').delete().eq('user_id', currentUser.id).eq('id', item.id);
      return;
    }
    if (item.created_at) {
      await sb.from('script_history').delete().eq('user_id', currentUser.id).eq('topic', item.topic).eq('created_at', item.created_at);
      return;
    }
    await sb.from('script_history').delete().eq('user_id', currentUser.id).eq('topic', item.topic);
  } catch (e) { console.error('Delete history:', e); }
}

async function dbSaveScript(topic, data) {
  if (!currentUser) return;
  try {
    await sb.from('saved_scripts').upsert({ user_id: currentUser.id, topic, data: JSON.stringify(data), updated_at: new Date().toISOString() }, { onConflict: 'user_id,topic' });
  } catch(e) { console.error('Save script:', e); }
}

async function dbLoadSaved() {
  if (!currentUser) return [];
  try {
    const { data } = await sb.from('saved_scripts').select('*').eq('user_id', currentUser.id).order('updated_at', { ascending: false });
    return data || [];
  } catch { return []; }
}

async function dbDeleteSaved(topic) {
  if (!currentUser) return;
  try { await sb.from('saved_scripts').delete().eq('user_id', currentUser.id).eq('topic', topic); }
  catch(e) { console.error('Delete saved:', e); }
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
    const photo = user.user_metadata?.avatar_url || '';
    document.getElementById('profileName').textContent  = name;
    document.getElementById('profileEmail').textContent = user.email || '';
    ['avatarImg','avatarImgLg'].forEach(id => {
      const img = document.getElementById(id);
      img.src = photo; img.style.display = photo ? 'block' : 'none';
    });
    ['avatarInitial','avatarInitialLg'].forEach(id => {
      const el = document.getElementById(id);
      el.textContent = name[0].toUpperCase(); el.style.display = photo ? 'none' : 'block';
    });
    updateCreditsBadge();
  } else {
    loginBtn.classList.remove('hidden');
    profileMenu.classList.add('hidden');
    document.getElementById('creditsBadge').classList.add('hidden');
    currentUser = null;
  }
}

sb.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    updateAuthUI(session.user);
    closeModal('authModal');
    if (event === 'SIGNED_IN') toast('Welcome to ShortsCraft! 🎉', 'success');
  } else {
    updateAuthUI(null);
  }
});
sb.auth.getSession().then(({ data: { session } }) => { if (session?.user) updateAuthUI(session.user); });

// ── GOOGLE AUTH ───────────────────────────────────────────────
async function signInWithGoogle() {
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
  if (error) toast('Google sign in failed: ' + error.message, 'error');
}
document.getElementById('googleSignInBtn').addEventListener('click', signInWithGoogle);
document.getElementById('googleSignUpBtn').addEventListener('click', signInWithGoogle);

// ── EMAIL AUTH ────────────────────────────────────────────────
document.getElementById('signupSubmit').addEventListener('click', async () => {
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const pass  = document.getElementById('signupPassword').value;
  const errEl = document.getElementById('signupError');
  if (!name||!email||!pass) { showAuthErr(errEl,'Sab fields bharo!'); return; }
  if (pass.length < 6) { showAuthErr(errEl,'Password min 6 characters!'); return; }
  const btn = document.getElementById('signupSubmit');
  btn.textContent='Creating...'; btn.disabled=true;
  const { error } = await sb.auth.signUp({ email, password: pass, options: { data: { full_name: name } } });
  btn.textContent='Create Account'; btn.disabled=false;
  if (error) { showAuthErr(errEl, error.message); return; }
  toast('Account bana! Email confirm karo 📧', 'success');
  closeModal('authModal');
});

document.getElementById('loginSubmit').addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  if (!email||!pass) { showAuthErr(errEl,'Email aur password bharo!'); return; }
  const btn = document.getElementById('loginSubmit');
  btn.textContent='Signing in...'; btn.disabled=true;
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  btn.textContent='Sign In'; btn.disabled=false;
  if (error) { showAuthErr(errEl,'Email ya password galat hai!'); return; }
  updateAuthUI(data.user); closeModal('authModal');
  toast('Welcome back! 👋', 'success');
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await sb.auth.signOut(); closeDropdown(); toast('Logged out 👋');
});

function showAuthErr(el, msg) {
  el.textContent=msg; el.classList.remove('hidden'); el.classList.add('visible');
  setTimeout(()=>el.classList.remove('visible'),4000);
}

// ── MODAL HELPERS ─────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

document.getElementById('loginBtn').addEventListener('click', () => openModal('authModal'));
document.getElementById('authModalClose').addEventListener('click',    () => closeModal('authModal'));
document.getElementById('upgradeModalClose').addEventListener('click', () => closeModal('upgradeModal'));
document.getElementById('earnModalClose').addEventListener('click',    () => closeModal('earnModal'));
document.getElementById('noCreditsModalClose').addEventListener('click',()=> closeModal('noCreditsModal'));
document.getElementById('feedbackModalClose').addEventListener('click',()=> closeModal('feedbackModal'));

['authModal','upgradeModal','earnModal','noCreditsModal','feedbackModal'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', e => { if(e.target.id===id) closeModal(id); });
});

document.getElementById('upgradeBtn').addEventListener('click',        () => { closeDropdown(); openModal('upgradeModal'); });
document.getElementById('upgradeSubmit').addEventListener('click',     () => toast('Payment coming soon! Contact us 📧'));
document.getElementById('earnCreditsLink').addEventListener('click',   () => { closeDropdown(); openModal('earnModal'); renderTasks(); });
document.getElementById('noCreditsEarnBtn').addEventListener('click',  () => { closeModal('noCreditsModal'); openModal('earnModal'); renderTasks(); });
document.getElementById('noCreditsUpgradeBtn').addEventListener('click',()=>{ closeModal('noCreditsModal'); openModal('upgradeModal'); });
document.getElementById('feedbackBtn').addEventListener('click',       () => openModal('feedbackModal'));

document.getElementById('feedbackSubmit').addEventListener('click', () => {
  const text = document.getElementById('feedbackText').value.trim();
  if (!text) { toast('Feedback likho pehle ✍️', 'error'); return; }
  const topic = document.getElementById('feedbackTopic').value.trim() || topicInput.value.trim() || '';
  const feedbackStore = JSON.parse(localStorage.getItem('sc_feedback') || '[]');
  feedbackStore.unshift({
    text,
    topic,
    createdAt: new Date().toISOString(),
    userEmail: currentUser?.email || null,
  });
  localStorage.setItem('sc_feedback', JSON.stringify(feedbackStore.slice(0, 100)));
  document.getElementById('feedbackText').value = '';
  document.getElementById('feedbackTopic').value = '';
  closeModal('feedbackModal');
  toast('Feedback saved locally ✅', 'success');
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
document.addEventListener('click', (e) => {
  const dd = document.getElementById('profileDropdown');
  const menu = document.getElementById('profileMenu');
  if (!dd || !menu) return;
  if (!menu.contains(e.target)) closeDropdown();
});
function closeDropdown() { document.getElementById('profileDropdown')?.classList.add('hidden'); }

document.getElementById('viewHistoryBtn')?.addEventListener('click', () => { closeDropdown(); openSidebar(); });
document.getElementById('viewSavedBtn')?.addEventListener('click',   () => { closeDropdown(); openSidebar(); });

// ── SIDEBAR ───────────────────────────────────────────────────
function openSidebar()  {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('visible');
  renderSidebar();
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('visible');
}
document.getElementById('sidebarToggle').addEventListener('click', openSidebar);
document.getElementById('sidebarClose').addEventListener('click', closeSidebar);
document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);

document.getElementById('clearHistoryBtn').addEventListener('click', async () => {
  if (currentUser) { try { await sb.from('script_history').delete().eq('user_id', currentUser.id); } catch(e){} }
  document.getElementById('historyList').innerHTML = '<div class="empty-history"><span>🎬</span><p>History cleared!</p></div>';
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
  histList.innerHTML  = '<div class="skeleton" style="height:56px;margin:0"></div>';
  savedList.innerHTML = '<div class="skeleton" style="height:56px;margin:0"></div>';

  const [histData, savedData] = await Promise.all([dbLoadHistory(), dbLoadSaved()]);
  window._histData  = histData;
  window._savedData = savedData;

  histList.innerHTML = histData.length === 0
    ? '<div class="empty-history"><span>🎬</span><p>No scripts yet!</p></div>'
    : histData.map((item,i) => `
        <div class="history-item">
          <div style="flex:1;cursor:pointer" onclick="loadHistoryItem(${i},'history')">
            <div class="history-topic">${escapeHtml(item.topic)}</div>
            <div class="history-time">${timeAgo(item.created_at)}</div>
          </div>
          <button class="item-copy-btn" onclick="deleteHistoryItem(${i},this)">🗑</button>
        </div>`).join('');

  savedList.innerHTML = savedData.length === 0
    ? '<div class="empty-history"><span>🔖</span><p>No saved scripts yet!</p></div>'
    : savedData.map((item,i) => `
        <div class="history-item">
          <div style="flex:1;cursor:pointer" onclick="loadHistoryItem(${i},'saved')">
            <div class="history-topic">🔖 ${escapeHtml(item.topic)}</div>
            <div class="history-time">${timeAgo(item.updated_at)}</div>
          </div>
          <button class="item-copy-btn" onclick="deleteSaved('${escapeHtml(item.topic)}',this)">🗑</button>
        </div>`).join('');
}

window.loadHistoryItem = function(i, type) {
  const arr  = type==='saved' ? window._savedData : window._histData;
  const item = arr?.[i]; if (!item) return;
  const data = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
  topicInput.value = item.topic;
  applyResults(data);
  closeSidebar();
};

window.deleteSaved = async function(topic, btn) {
  btn.textContent='...'; btn.disabled=true;
  await dbDeleteSaved(topic);
  toast('Deleted 🗑');
  renderSidebar();
};

window.deleteHistoryItem = async function(i, btn) {
  const item = window._histData?.[i];
  if (!item) return;
  btn.textContent = '...'; btn.disabled = true;
  await dbDeleteHistory(item);
  window._histData.splice(i, 1);
  toast('History item deleted 🗑');
  renderSidebar();
};

// ── SAVE SCRIPT ───────────────────────────────────────────────
document.getElementById('saveScriptBtn').addEventListener('click', async function() {
  if (!lastScript) return;
  if (!currentUser) { toast('Pehle sign in karo! 🔐', 'error'); openModal('authModal'); return; }
  const topic = topicInput.value.trim() || 'Untitled';
  const data  = { script:{ hook:'', mainContent:lastScript, cta:'' }, titles:lastTitles, desc:lastDesc, hashtags:lastHashtags, ideas:lastIdeas, thumbnail:lastThumbnail };
  await dbSaveScript(topic, data);
  this.textContent='♥'; this.classList.add('saved');
  toast('Script saved to your account! 🔖', 'success');
});

// ── HINT TAGS ─────────────────────────────────────────────────
window.setTopic = function(text) {
  topicInput.value = text;
  topicInput.focus();
};

// ── DOWNLOAD TXT ──────────────────────────────────────────────
document.getElementById('downloadTxtBtn').addEventListener('click', () => {
  const topic = topicInput.value.trim() || 'shortscraft';
  const parts = [];
  if (lastScript)          parts.push(`=== SCRIPT ===\n${lastScript}`);
  if (lastTitles.length)   parts.push(`\n=== TITLES ===\n${lastTitles.map((t,i)=>`${i+1}. ${t}`).join('\n')}`);
  if (lastDesc)            parts.push(`\n=== DESCRIPTION ===\n${lastDesc}`);
  if (lastHashtags.length) parts.push(`\n=== HASHTAGS ===\n${lastHashtags.join(' ')}`);
  if (lastIdeas.length)    parts.push(`\n=== IDEAS ===\n${lastIdeas.map((t,i)=>`${i+1}. ${t}`).join('\n')}`);
  if (lastThumbnail.length)parts.push(`\n=== THUMBNAIL PROMPTS ===\n${lastThumbnail.map((t,i)=>`[Prompt ${i+1}]\n${t}`).join('\n\n')}`);
  if (!parts.length) { toast('Pehle kuch generate karo!', 'error'); return; }
  const blob = new Blob([parts.join('\n')], { type: 'text/plain' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `shortscraft-${topic.replace(/\s+/g,'-').toLowerCase()}.txt`;
  a.click();
  toast('Downloaded! 📥', 'success');
});

// ── HELPERS ───────────────────────────────────────────────────
function escapeHtml(t) { const d=document.createElement('div'); d.appendChild(document.createTextNode(t)); return d.innerHTML; }
function setStatus(msg,type='') { statusText.textContent=msg; statusText.className=`status ${type}`; }
function setLoading(v) { generateBtn.disabled=v; generateBtn.querySelector('.btn-text').textContent=v?'Generating...':'Generate All'; }
function showSkeleton(el,n=3) { el.innerHTML=Array(n).fill('<div class="skeleton"></div>').join(''); }
function timeAgo(ts) {
  const ms = typeof ts==='string' ? new Date(ts).getTime() : ts;
  const m  = Math.floor((Date.now()-ms)/60000);
  if(m<1) return 'Just now'; if(m<60) return `${m}m ago`;
  const h=Math.floor(m/60); if(h<24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

function applyResults(data) {
  resultsArea.classList.remove('hidden');
  if(data.script)    renderScript(data.script);
  if(data.titles)    renderTitles(data.titles);
  if(data.desc)      renderDesc(data.desc);
  if(data.hashtags)  renderHashtags(data.hashtags);
  if(data.ideas)     renderIdeas(data.ideas);
  if(data.thumbnail) renderThumbnail(data.thumbnail);
}

// ── RENDER ────────────────────────────────────────────────────
function renderScript(data) {
  const s=[];
  if(data.hook)        s.push(`<div class="section-block hook"><div class="section-label">🔥 Hook</div><div class="section-text">${escapeHtml(data.hook)}</div></div>`);
  if(data.mainContent) s.push(`<div class="section-block main-content"><div class="section-label">📢 Main Content</div><div class="section-text">${escapeHtml(data.mainContent)}</div></div>`);
  if(data.cta)         s.push(`<div class="section-block cta"><div class="section-label">👆 Call to Action</div><div class="section-text">${escapeHtml(data.cta)}</div></div>`);
  scriptSections.innerHTML = s.length ? s.join('') : '<div class="placeholder-block"><p class="placeholder-text">Script error 😔</p></div>';
  lastScript = [data.hook?`Hook:\n${data.hook}`:'', data.mainContent?`Main Content:\n${data.mainContent}`:'', data.cta?`CTA:\n${data.cta}`:''].filter(Boolean).join('\n\n');
}

function renderTitles(arr) {
  titlesContent.innerHTML = arr.map((t,i)=>`<div class="list-item" style="animation-delay:${i*.08}s"><span class="item-num">${i+1}</span><span class="item-text">${escapeHtml(t)}</span><button class="item-copy-btn" onclick='copyOne(this,${JSON.stringify(t)})'>Copy</button></div>`).join('');
  lastTitles=arr;
}

function renderDesc(text) {
  descContent.innerHTML = `<div class="desc-content"><div class="desc-text">${escapeHtml(text)}</div></div>`;
  lastDesc = text;
}

function renderHashtags(arr) {
  hashtagsContent.innerHTML = `<div class="hashtags-grid">${arr.map((h,i)=>`<span class="hashtag-chip" style="animation-delay:${i*.04}s" onclick='copyOne(this,${JSON.stringify(h)})'>${escapeHtml(h)}</span>`).join('')}</div>`;
  lastHashtags=arr;
}

function renderIdeas(arr) {
  const normalized = (arr || []).map((x, i) => {
    if (typeof x === 'string') return { view: x, copy: x };
    const title = x?.title ? `Title: ${x.title}` : '';
    const reason = x?.reason ? `Reason: ${x.reason}` : '';
    const angle = x?.angle ? `Angle: ${x.angle}` : '';
    const view = [title, reason, angle].filter(Boolean).join('\n') || `Idea ${i + 1}`;
    return { view, copy: view };
  });
  ideasContent.innerHTML = normalized.map((x,i)=>`<div class="list-item" style="animation-delay:${i*.08}s"><span class="item-num">${i+1}</span><span class="item-text">${escapeHtml(x.view).replace(/\n/g,'<br>')}</span><button class="item-copy-btn" onclick='copyOne(this,${JSON.stringify(x.copy)})'>Copy</button></div>`).join('');
  lastIdeas=normalized.map(x => x.copy);
}

function renderThumbnail(arr) {
  thumbnailContent.innerHTML = arr.map((t,i)=>`<div class="list-item thumb-prompt-item" style="animation-delay:${i*.1}s"><div class="thumb-prompt-header"><span class="thumb-prompt-num">PROMPT ${i+1}</span><button class="item-copy-btn" onclick='copyOne(this,${JSON.stringify(t)})'>Copy</button></div><div class="thumb-prompt-text">${escapeHtml(t)}</div></div>`).join('');
  lastThumbnail=arr;
}

// ── COPY ──────────────────────────────────────────────────────
window.copyOne = async function(btn,text) {
  try {
    await navigator.clipboard.writeText(text);
    const orig=btn.textContent; btn.textContent='✓'; btn.classList.add('copied');
    setTimeout(()=>{ btn.textContent=orig; btn.classList.remove('copied'); },1500);
  } catch { toast('Copy failed','error'); }
};
async function copyAll(text,btn) {
  try {
    await navigator.clipboard.writeText(text);
    const orig=btn.innerHTML; btn.innerHTML='✓ Copied!';
    toast('Copied! ✅','success');
    setTimeout(()=>{ btn.innerHTML=orig; },2000);
  } catch { toast('Copy failed','error'); }
}
document.getElementById('copyScriptBtn').addEventListener('click',    function(){ if(lastScript)          copyAll(lastScript,this); });
document.getElementById('copyTitlesBtn').addEventListener('click',    function(){ if(lastTitles.length)   copyAll(lastTitles.join('\n'),this); });
document.getElementById('copyDescBtn').addEventListener('click',      function(){ if(lastDesc)            copyAll(lastDesc,this); });
document.getElementById('copyHashtagsBtn').addEventListener('click',  function(){ if(lastHashtags.length) copyAll(lastHashtags.join(' '),this); });
document.getElementById('copyIdeasBtn').addEventListener('click',     function(){ if(lastIdeas.length)    copyAll(lastIdeas.join('\n'),this); });
document.getElementById('copyThumbnailBtn').addEventListener('click', function(){ if(lastThumbnail.length)copyAll(lastThumbnail.join('\n\n---\n\n'),this); });

// ── GENERATE ──────────────────────────────────────────────────
async function handleGenerate() {
  const topic = topicInput.value.trim();
  if (!topic) { setStatus('Pehle topic likho! 👆','error'); topicInput.focus(); return; }

  // Credit check — ONLY for logged in users. Guests can generate unlimited.
  if (currentUser && !isPro) {
    if (getCredits() <= 0) { openModal('noCreditsModal'); return; }
    if (!useCredit()) { openModal('noCreditsModal'); return; }
  }

  setLoading(true);
  setStatus('Sab generate ho raha hai... ✨');
  document.getElementById('examplePreview')?.classList.add('hidden');
  resultsArea.classList.remove('hidden');

  showSkeleton(scriptSections,3);   showSkeleton(titlesContent,5);
  showSkeleton(descContent,2);      showSkeleton(hashtagsContent,2);
  showSkeleton(ideasContent,5);     showSkeleton(thumbnailContent,3);
  document.getElementById('saveScriptBtn').textContent='♡';
  document.getElementById('saveScriptBtn').classList.remove('saved');
  document.getElementById('resultsTopic').textContent = `Results for: "${topic}"`;

  const post = url => fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic})});

  try {
    const [sR,tR,dR,htR,iR,thR] = await Promise.allSettled([
      post('/api/generate'),
      post('/api/titles'),
      post('/api/description'),
      post('/api/hashtags'),
      post('/api/ideas'),
      post('/api/thumbnail'),
    ]);

    let scriptData = { hook:'', mainContent:'', cta:'' };

    if(sR.status==='fulfilled'&&sR.value.ok) { const d=await sR.value.json(); renderScript(d); scriptData=d; }
    else scriptSections.innerHTML='<div class="placeholder-block"><p class="placeholder-text">Script error 😔 Retry karo</p></div>';

    if(tR.status==='fulfilled'&&tR.value.ok)  renderTitles((await tR.value.json()).titles||[]);
    else titlesContent.innerHTML='<div class="placeholder-block"><p class="placeholder-text">Titles error 😔</p></div>';

    if(dR.status==='fulfilled'&&dR.value.ok)  {
      const dData = await dR.value.json();
      renderDesc(dData.description || '');
    } else {
      descContent.innerHTML='<div class="placeholder-block"><p class="placeholder-text">Description error 😔</p></div>';
    }

    if(htR.status==='fulfilled'&&htR.value.ok) renderHashtags((await htR.value.json()).hashtags||[]);
    else hashtagsContent.innerHTML='<div class="placeholder-block"><p class="placeholder-text">Hashtags error 😔</p></div>';

    if(iR.status==='fulfilled'&&iR.value.ok)  renderIdeas((await iR.value.json()).ideas||[]);
    else ideasContent.innerHTML='<div class="placeholder-block"><p class="placeholder-text">Ideas error 😔</p></div>';

    if(thR.status==='fulfilled'&&thR.value.ok) renderThumbnail((await thR.value.json()).thumbnail||[]);
    else thumbnailContent.innerHTML='<div class="placeholder-block"><p class="placeholder-text">Thumbnail error 😔</p></div>';

    const allData={script:scriptData,titles:lastTitles,desc:lastDesc,hashtags:lastHashtags,ideas:lastIdeas,thumbnail:lastThumbnail};
    await dbSaveHistory(topic, allData);

    const credLeft = currentUser && !isPro ? ` • ${getCredits()} credits left` : '';
    setStatus(`Sab ready hai! 🎉${credLeft}`, 'success');

    setTimeout(() => {
      resultsArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);

  } catch(err) {
    setStatus(err.message || 'Kuch problem ho gayi. Retry karo!', 'error');
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
