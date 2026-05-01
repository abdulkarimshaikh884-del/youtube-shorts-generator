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
let isPro       = localStorage.getItem('sc_is_pro') === '1';
let lastScript='', lastTitles=[], lastDesc='', lastHashtags=[], lastIdeas=[], lastThumbnail=[];
let hasLoadedTrendingIdeas = false;
const FALLBACK_TRENDING_TOPICS = [
  'AI tools that save 2 hours daily',
  'Simple side hustles students can start',
  'Phone camera hacks for cinematic Shorts'
];
const THUMBNAIL_OVERLAYS = ['STOP MAKING THIS MISTAKE', 'DO THIS INSTEAD', 'THE SMART SHORTS FORMULA'];
// Enforces English-only professional thumbnail outputs by filtering common Hinglish terms.
const THUMBNAIL_BANNED_REGEX = /\b(yaar|bhai|zindagi|paisa|kaise|kya|kyu|kyon|aur|nahi|mat|jaldi|sach|desi|jugaad|apna|tum|aap|sab|chalo|dekho)\b/i;
const FEEDBACK_STORAGE_KEY = 'sc_feedback';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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


// ── MOBILE NAVIGATION ─────────────────────────────────────────
(function initMobileNavigation() {
  const toggle = document.getElementById('mobileNavToggle');
  const panel = document.getElementById('mobileNavPanel');
  if (!toggle || !panel) return;

  function closeMobileNav() {
    panel.classList.add('hidden');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = '☰';
  }

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !panel.classList.contains('hidden');
    panel.classList.toggle('hidden', isOpen);
    toggle.setAttribute('aria-expanded', String(!isOpen));
    toggle.textContent = isOpen ? '☰' : '✕';
  });

  panel.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMobileNav));
  document.addEventListener('click', (e) => {
    if (!panel.classList.contains('hidden') && !panel.contains(e.target) && !toggle.contains(e.target)) closeMobileNav();
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 1180) closeMobileNav();
  });
})();

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
  { id: 'share_twitter',  icon: '🐦', label: 'Share ShortsCraft on Twitter/X',       url: 'https://twitter.com/intent/tweet?text=Check%20out%20ShortsCraft%20-%20Free%20AI%20YouTube%20Shorts%20Generator!%20https://shortscraft.online' },
  { id: 'share_whatsapp', icon: '💬', label: 'Share on WhatsApp with a friend',       url: 'https://wa.me/?text=Free%20YouTube%20Shorts%20Script%20Generator!%20https://shortscraft.online' },
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

async function dbDeleteHistory(historyId) {
  if (!currentUser || !historyId) return;
  try { await sb.from('script_history').delete().eq('user_id', currentUser.id).eq('id', historyId); }
  catch(e) { console.error('Delete history:', e); }
}

async function dbSaveFeedback(payload) {
  try {
    const { error } = await sb.from('feedback').insert(payload);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Feedback save:', e);
    return false;
  }
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
  syncFeedbackFormUser();
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
document.getElementById('feedbackModalClose')?.addEventListener('click',() => closeModal('feedbackModal'));
document.getElementById('feedbackCancelBtn')?.addEventListener('click', () => closeModal('feedbackModal'));

['authModal','upgradeModal','earnModal','noCreditsModal','feedbackModal'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', e => { if(e.target.id===id) closeModal(id); });
});

document.getElementById('upgradeBtn').addEventListener('click',        () => { closeDropdown(); openModal('upgradeModal'); });
document.querySelectorAll('.open-upgrade-btn').forEach(btn => {
  btn.addEventListener('click', () => openModal('upgradeModal'));
});
document.getElementById('upgradeSubmit').addEventListener('click',     () => {
  startRazorpayPayment();
});
document.getElementById('earnCreditsLink').addEventListener('click',   () => { closeDropdown(); openModal('earnModal'); renderTasks(); });
document.getElementById('noCreditsEarnBtn').addEventListener('click',  () => { closeModal('noCreditsModal'); openModal('earnModal'); renderTasks(); });
document.getElementById('noCreditsUpgradeBtn').addEventListener('click',()=>{ closeModal('noCreditsModal'); openModal('upgradeModal'); });
document.getElementById('feedbackBtn')?.addEventListener('click',      () => openFeedbackModal());
document.getElementById('profileFeedbackBtn')?.addEventListener('click',() => { closeDropdown(); openFeedbackModal(); });

document.querySelectorAll('.modal-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`auth-${tab.dataset.auth}`).classList.add('active');
  });
});

// ── PROFILE DROPDOWN ──────────────────────────────────────────
(function initProfileDropdown() {
  const avatarBtn = document.getElementById('profileAvatar');
  const dropdown  = document.getElementById('profileDropdown');
  const menu      = document.getElementById('profileMenu');
  if (!avatarBtn || !dropdown || !menu) return;

  // Toggle on avatar click — works for both mouse and touch
  function toggleDropdown(e) {
    e.stopPropagation();
    e.preventDefault();
    const isOpen = !dropdown.classList.contains('hidden');
    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  }

  function openDropdown() {
    dropdown.classList.remove('hidden');

    // On mobile: use fixed positioning anchored below topbar
    if (window.innerWidth <= 640) {
      const topbarH = document.querySelector('.topbar')?.offsetHeight || 58;
      dropdown.style.top   = (topbarH + 8) + 'px';
      dropdown.style.right = '12px';
    } else {
      dropdown.style.top   = '';
      dropdown.style.right = '';
    }
  }

  avatarBtn.addEventListener('click',      toggleDropdown);
  avatarBtn.addEventListener('touchstart', toggleDropdown, { passive: false });

  // Close when clicking/touching OUTSIDE the dropdown
  function handleOutsideInteraction(e) {
    if (!dropdown || dropdown.classList.contains('hidden')) return;
    // If the click is inside the dropdown or on the avatar, do NOT close
    if (dropdown.contains(e.target) || avatarBtn.contains(e.target)) return;
    closeDropdown();
  }

  document.addEventListener('click',      handleOutsideInteraction);
  document.addEventListener('touchstart', handleOutsideInteraction, { passive: true });

  // Re-position on resize (desktop↔mobile switch)
  window.addEventListener('resize', () => {
    if (!dropdown.classList.contains('hidden')) {
      if (window.innerWidth > 640) {
        dropdown.style.top   = '';
        dropdown.style.right = '';
      } else {
        const topbarH = document.querySelector('.topbar')?.offsetHeight || 58;
        dropdown.style.top   = (topbarH + 8) + 'px';
        dropdown.style.right = '12px';
      }
    }
  });
})();

function closeDropdown() {
  const dd = document.getElementById('profileDropdown');
  if (!dd) return;
  dd.classList.add('hidden');
  dd.style.top   = '';
  dd.style.right = '';
}

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
  window._histData = [];
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
        <div class="history-item" onclick="loadHistoryItem(${i},'history')">
          <div style="flex:1;min-width:0"><div class="history-topic">${escapeHtml(item.topic)}</div><div class="history-time">${timeAgo(item.created_at)}</div></div>
          <button class="item-copy-btn" onclick="deleteHistoryItem(${i},this,event)">🗑</button>
        </div>`).join('');

  savedList.innerHTML = savedData.length === 0
    ? '<div class="empty-history"><span>🔖</span><p>No saved scripts yet!</p></div>'
    : savedData.map((item,i) => `
        <div class="history-item">
          <div style="flex:1;cursor:pointer" onclick="loadHistoryItem(${i},'saved')">
            <div class="history-topic">🔖 ${escapeHtml(item.topic)}</div>
            <div class="history-time">${timeAgo(item.updated_at)}</div>
          </div>
          <button class="item-copy-btn" onclick="deleteSavedIndex(${i},this,event)">🗑</button>
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

window.deleteSavedIndex = async function(i, btn, ev) {
  ev?.stopPropagation();
  const item = window._savedData?.[i];
  if (!item) return;
  btn.textContent='...'; btn.disabled=true;
  await dbDeleteSaved(item.topic);
  toast('Deleted 🗑');
  renderSidebar();
};

window.deleteHistoryItem = async function(i, btn, ev) {
  ev?.stopPropagation();
  const item = window._histData?.[i];
  if (!item) return;
  btn.textContent='...'; btn.disabled=true;
  await dbDeleteHistory(item.id);
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
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function encodeDataText(v){ return encodeURIComponent(String(v ?? '')); }
function decodeDataText(v){ try { return decodeURIComponent(v || ''); } catch { return v || ''; } }
function timeAgo(ts) {
  const ms = typeof ts==='string' ? new Date(ts).getTime() : ts;
  const m  = Math.floor((Date.now()-ms)/60000);
  if(m<1) return 'Just now'; if(m<60) return `${m}m ago`;
  const h=Math.floor(m/60); if(h<24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

function setProStatus(value,{silent=false, label='Pro Activated! ⭐'}={}) {
  isPro = !!value;
  localStorage.setItem('sc_is_pro', isPro ? '1' : '0');
  updateCreditsBadge();
  if (isPro && !silent) toast(label, 'success');
}

function showWakeScreen(msg='Waking server... please wait') {
  let el = document.getElementById('wakeOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'wakeOverlay';
    el.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(5,8,14,.92);display:flex;align-items:center;justify-content:center;padding:20px;color:#fff;font-family:"Nunito",sans-serif;font-weight:700;font-size:1rem;text-align:center';
    el.innerHTML = '<div style="padding:18px 22px;border:1px solid rgba(255,255,255,.16);border-radius:14px;background:rgba(255,255,255,.04)">Waking server... please wait</div>';
    document.body.appendChild(el);
  }
  el.querySelector('div').textContent = msg;
  el.style.display = 'flex';
}

function hideWakeScreen() {
  const el = document.getElementById('wakeOverlay');
  if (el) el.style.display = 'none';
}

async function ensureServerAwake(maxAttempts = 5) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`${window.location.origin}/`, { cache: 'no-store' });
      if (response.ok) return true;
    } catch {}
    if (attempt === 1) showWakeScreen();
    await sleep(Math.min(1000 * Math.pow(2, attempt - 1), 5000));
  }
  return false;
}

async function postJsonWithRetry(url, topic, { maxAttempts = 4 } = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ topic })
      });
      if (response.ok) return await response.json();
      if (response.status >= 500 || response.status === 429 || response.status === 408) {
        lastError = new Error(`HTTP ${response.status}`);
      } else {
        return null;
      }
    } catch (e) {
      lastError = e;
    }
    if (attempt === 2) showWakeScreen();
    await sleep(Math.min(1000 * Math.pow(2, attempt - 1), 5000));
  }
  throw lastError || new Error('Server unavailable');
}

function createFallbackDescription(topic, scriptText = '', hashtags = []) {
  const points = (scriptText || '')
    .split('\n')
    .map(x => x.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map(x => `✅ ${x.replace(/^Hook:|^Main Content:|^CTA:/g, '').trim()}`);
  const normalizedTags = (hashtags || [])
    .filter(Boolean)
    .slice(0, 10)
    .map(h => h.startsWith('#') ? h : `#${h.replace(/\s+/g, '')}`);
  const tagLine = normalizedTags.length ? normalizedTags.join(' ') : '#shorts #youtube #viral #contentcreator #growth';
  return [
    `🚀 Want to master "${topic}" in under a minute? This Shorts breaks it down in a clear and practical way.`,
    '',
    'In this video you\'ll learn:',
    ...(points.length ? points : ['✅ A practical framework you can apply today', '✅ Common mistakes to avoid', '✅ A fast action plan for better results']),
    '',
    '💬 If this helped, like the video, comment your biggest takeaway, and subscribe for daily Shorts tips!',
    '',
    tagLine
  ].join('\n');
}

function buildProfessionalThumbnailPrompt(topic, index) {
  return `Ultra-realistic YouTube thumbnail featuring a confident creator demonstrating "${topic}" with an expressive face and dynamic hand gesture, dramatic cinematic rim lighting with high-contrast shadows, a detailed modern studio background with subtle storytelling elements tied to ${topic}, vibrant saturated red-orange-blue color palette, bold English text overlay "${THUMBNAIL_OVERLAYS[index % THUMBNAIL_OVERLAYS.length]}", close-up composition in 16:9 aspect ratio, eye-catching viral YouTube thumbnail style, 8k cinematic clarity.`;
}

function normalizeThumbnailPrompts(prompts, topic) {
  const clean = Array.isArray(prompts) ? prompts.filter(Boolean).slice(0, 3) : [];
  while (clean.length < 3) clean.push(buildProfessionalThumbnailPrompt(topic, clean.length));
  return clean.map((line, i) => {
    const text = String(line).trim();
    if (!text || THUMBNAIL_BANNED_REGEX.test(text) || /[^\x00-\x7F]/.test(text)) return buildProfessionalThumbnailPrompt(topic, i);
    return text;
  });
}

function ensureMobileNavbarVisibility() {
  const brandName = document.querySelector('.brand-name');
  const brandWrap = document.querySelector('.topbar-brand');
  const rightWrap = document.querySelector('.topbar-right');
  if (brandName) {
    brandName.style.setProperty('display', 'inline-block', 'important');
    brandName.style.whiteSpace = 'nowrap';
  }
  if (brandWrap) brandWrap.style.minWidth = 'max-content';
  if (rightWrap) rightWrap.style.minWidth = '0';
}

function applyMobileSidebarFixes() {
  const sidebar = document.getElementById('sidebar');
  const footer = sidebar?.querySelector('.sidebar-footer');
  const clearBtn = document.getElementById('clearHistoryBtn');
  if (!sidebar || !footer || !clearBtn) return;
  if (window.innerWidth <= 640) {
    sidebar.style.width = '92vw';
    footer.style.position = 'sticky';
    footer.style.bottom = '0';
    footer.style.background = 'rgba(8,11,22,0.98)';
    clearBtn.style.display = 'block';
    clearBtn.style.width = '100%';
  } else {
    sidebar.style.width = '';
    footer.style.position = '';
    footer.style.bottom = '';
    footer.style.background = '';
  }
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
  titlesContent.innerHTML = arr.map((t,i)=>`<div class="list-item" style="animation-delay:${i*.08}s"><span class="item-num">${i+1}</span><span class="item-text">${escapeHtml(t)}</span><button class="item-copy-btn" data-copy-text="${encodeDataText(t)}">Copy</button></div>`).join('');
  lastTitles=arr;
}

function renderDesc(text) {
  descContent.innerHTML = `<div class="desc-content"><div class="desc-text">${escapeHtml(text)}</div></div>`;
  lastDesc = text;
}

function renderHashtags(arr) {
  hashtagsContent.innerHTML = `<div class="hashtags-grid">${arr.map((h,i)=>`<span class="hashtag-chip" style="animation-delay:${i*.04}s" data-copy-text="${encodeDataText(h)}">${escapeHtml(h)}</span>`).join('')}</div>`;
  lastHashtags=arr;
}

function renderIdeas(arr) {
  ideasContent.innerHTML = arr.map((x,i)=>`<div class="list-item" style="animation-delay:${i*.08}s"><span class="item-num">${i+1}</span><span class="item-text">${escapeHtml(x)}</span><button class="item-copy-btn" data-copy-text="${encodeDataText(x)}">Copy</button></div>`).join('');
  lastIdeas=arr;
}

function renderThumbnail(arr) {
  const normalized = normalizeThumbnailPrompts(arr, topicInput.value.trim() || 'YouTube Shorts');
  thumbnailContent.innerHTML = normalized.map((t,i)=>`<div class="list-item thumb-prompt-item" style="animation-delay:${i*.1}s"><div class="thumb-prompt-header"><span class="thumb-prompt-num">PROMPT ${i+1}</span><button class="item-copy-btn" data-copy-text="${encodeDataText(t)}">Copy</button></div><div class="thumb-prompt-text">${escapeHtml(t)}</div></div>`).join('');
  lastThumbnail=normalized;
}

// ── COPY ──────────────────────────────────────────────────────
window.copyOne = async function(btn,text) {
  try {
    await navigator.clipboard.writeText(text);
    const orig=btn.textContent; btn.textContent='✓'; btn.classList.add('copied');
    setTimeout(()=>{ btn.textContent=orig; btn.classList.remove('copied'); },1500);
  } catch { toast('Copy failed','error'); }
};
document.addEventListener('click', (e) => {
  const copyEl = e.target.closest('[data-copy-text]');
  if (!copyEl) return;
  const text = decodeDataText(copyEl.dataset.copyText);
  copyOne(copyEl, text);
});
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

// ── IDEAS (TRENDING FALLBACK) ──────────────────────────────────
function renderTrendingIdeas(topics, source = 'Trending Now') {
  const top3 = (topics || []).filter(Boolean).slice(0, 3);
  if (!top3.length) return;
  ideasContent.innerHTML = top3.map((idea, i) => `
    <div class="list-item" style="animation-delay:${i * .08}s">
      <span class="item-num">🔥</span>
      <span class="item-text">${escapeHtml(idea)}</span>
      <button class="item-copy-btn" data-copy-text="${encodeDataText(idea)}">Copy</button>
    </div>`).join('');
  lastIdeas = top3;
  const hint = document.createElement('p');
  hint.className = 'tab-hint';
  hint.style.marginTop = '12px';
  hint.textContent = `${source}: 3 trending YouTube topics`;
  ideasContent.appendChild(hint);
}

async function loadTrendingIdeas() {
  if (hasLoadedTrendingIdeas) return;
  hasLoadedTrendingIdeas = true;
  try {
    const data = await postJsonWithRetry('/api/ideas', 'Top 3 trending YouTube Shorts topics right now for creators', { maxAttempts: 2 });
    const ideas = (data?.ideas || []).slice(0, 3);
    if (ideas.length) {
      renderTrendingIdeas(ideas, 'Live Trends');
      return;
    }
  } catch {}
  renderTrendingIdeas(FALLBACK_TRENDING_TOPICS, 'Fallback Trends');
}

// ── RAZORPAY PAYMENT ──────────────────────────────────────────
async function startRazorpayPayment() {
  const btn = document.getElementById('upgradeSubmit');
  const noteEl = document.getElementById('upgradeNote');
  btn.disabled = true;
  btn.textContent = 'Setting up payment...';
  if (noteEl) noteEl.style.display = 'none';

  try {
    const orderRes = await fetch('/api/create-order', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const orderData = await orderRes.json();

    if (!orderRes.ok || orderData.error) {
      const msg = orderData.error || 'Payment setup failed.';
      if (noteEl) { noteEl.textContent = msg; noteEl.style.display = 'block'; }
      toast(msg, 'error');
      return;
    }

    const { order_id, key_id, amount, currency } = orderData;
    const userName = currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || '';
    const userEmail = currentUser?.email || '';

    const options = {
      key: key_id,
      amount,
      currency,
      name: 'ShortsCraft',
      description: 'ShortsCraft Pro — ₹99/month',
      order_id,
      prefill: { name: userName, email: userEmail },
      theme: { color: '#ff4560' },
      handler: async function(response) {
        btn.textContent = 'Verifying payment...';
        try {
          const verifyRes = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const verifyData = await verifyRes.json();

          if (verifyData.success) {
            // Save pro status
            localStorage.setItem('sc_is_pro', '1');
            localStorage.setItem('sc_pro_payment_id', response.razorpay_payment_id);
            if (currentUser) {
              try {
                await sb.from('profiles').upsert({ user_id: currentUser.id, is_pro: true, pro_payment_id: response.razorpay_payment_id, pro_since: new Date().toISOString() }, { onConflict: 'user_id' });
              } catch(e) { console.warn('Pro save to Supabase failed:', e); }
            }
            setProStatus(true, { label: '🎉 Welcome to Pro! Unlimited generations unlocked!' });
            closeModal('upgradeModal');
          } else {
            toast('Payment verification failed. Contact support.', 'error');
          }
        } catch(e) {
          toast('Verification error: ' + e.message, 'error');
        }
      },
      modal: {
        ondismiss: function() {
          btn.disabled = false;
          btn.textContent = 'Upgrade to Pro — ₹99/month ⭐';
        }
      }
    };

    const rzp = new window.Razorpay(options);
    rzp.open();

  } catch(e) {
    const msg = e.message || 'Payment error. Try again.';
    if (noteEl) { noteEl.textContent = msg; noteEl.style.display = 'block'; }
    toast(msg, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Upgrade to Pro — ₹99/month ⭐';
  }
}

// ── FEEDBACK ────────────────────────────────────────────────────
function getFeedbackStorage() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FEEDBACK_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFeedbackBackup(entry) {
  const stored = getFeedbackStorage();
  stored.unshift(entry);
  localStorage.setItem('sc_feedback_backup', JSON.stringify(stored.slice(0, 100)));
}

function getFeedbackFormData() {
  return {
    name: document.getElementById('feedbackName')?.value.trim() || '',
    email: document.getElementById('feedbackEmail')?.value.trim() || '',
    message: document.getElementById('feedbackMessage')?.value.trim() || '',
  };
}

function getFeedbackUserName() {
  return currentUser?.user_metadata?.full_name
    || currentUser?.user_metadata?.name
    || currentUser?.email?.split('@')[0]
    || '';
}

function syncFeedbackFormUser() {
  const nameInput = document.getElementById('feedbackName');
  const emailInput = document.getElementById('feedbackEmail');
  if (!nameInput || !emailInput) return;

  if (currentUser) {
    nameInput.value = getFeedbackUserName();
    emailInput.value = currentUser.email || '';
  } else {
    nameInput.value = '';
    emailInput.value = '';
  }
}

function openFeedbackModal() {
  syncFeedbackFormUser();
  openModal('feedbackModal');
  document.getElementById('feedbackMessage')?.focus();
}

async function sendFeedbackEmail(payload) {
  const serviceId = window.EMAILJS_SERVICE_ID;
  const templateId = window.EMAILJS_TEMPLATE_ID;
  const publicKey = window.EMAILJS_PUBLIC_KEY;
  if (!serviceId || !templateId || !publicKey || !window.emailjs?.send) return false;

  try {
    await window.emailjs.send(serviceId, templateId, payload, publicKey);
    return true;
  } catch (e) {
    console.error('Feedback email:', e);
    return false;
  }
}

async function submitFeedback() {
  const submitBtn = document.getElementById('feedbackSubmit');
  const messageInput = document.getElementById('feedbackMessage');
  const { name, email, message } = getFeedbackFormData();

  if (!message) {
    toast('Message is required.', 'error');
    messageInput?.focus();
    return;
  }
  if (message.length < 5) {
    toast('Message must be at least 5 characters.', 'error');
    messageInput?.focus();
    return;
  }
  if (email && !EMAIL_REGEX.test(email)) {
    toast('Please enter a valid email address.', 'error');
    document.getElementById('feedbackEmail')?.focus();
    return;
  }

  const entry = {
    user_id: currentUser?.id || null,
    name,
    email,
    message,
    page_url: window.location.href,
    user_agent: navigator.userAgent,
    created_at: new Date().toISOString(),
  };

  submitBtn.textContent = 'Submitting...';
  submitBtn.disabled = true;

  let savedRemotely = false;
  try {
    savedRemotely = await dbSaveFeedback(entry);
    await sendFeedbackEmail(entry);
    if (!savedRemotely) {
      saveFeedbackBackup({ ...entry, source: 'local' });
      messageInput.value = '';
      closeModal('feedbackModal');
      toast('Feedback saved locally. Supabase failed.', 'error');
    } else {
      messageInput.value = '';
      closeModal('feedbackModal');
      toast('Thanks! Feedback sent successfully.', 'success');
    }
  } finally {
    submitBtn.textContent = 'Submit';
    submitBtn.disabled = false;
  }
}

function initFeedbackUI() {
  document.getElementById('feedbackSubmit')?.addEventListener('click', submitFeedback);
  document.getElementById('feedbackMessage')?.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submitFeedback();
  });
  syncFeedbackFormUser();
}

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

  try {
    await ensureServerAwake();
    const [sR,tR,dR,htR,iR,thR] = await Promise.allSettled([
      postJsonWithRetry('/api/generate', topic),
      postJsonWithRetry('/api/titles', topic),
      postJsonWithRetry('/api/description', topic),
      postJsonWithRetry('/api/hashtags', topic),
      postJsonWithRetry('/api/ideas', topic),
      postJsonWithRetry('/api/thumbnail', topic),
    ]);

    let scriptData = { hook:'', mainContent:'', cta:'' };

    if(sR.status==='fulfilled'&&sR.value) { renderScript(sR.value); scriptData=sR.value; }
    else scriptSections.innerHTML='<div class="placeholder-block"><p class="placeholder-text">Script error 😔 Retry karo</p></div>';

    if(tR.status==='fulfilled'&&tR.value)  renderTitles(tR.value.titles||[]);
    else titlesContent.innerHTML='<div class="placeholder-block"><p class="placeholder-text">Titles error 😔</p></div>';

    if(dR.status==='fulfilled'&&dR.value)  {
      const safeDesc = (dR.value.description || '').trim() || createFallbackDescription(topic, lastScript, lastHashtags);
      renderDesc(safeDesc);
    } else {
      const currentScript = [scriptData.hook, scriptData.mainContent, scriptData.cta].filter(Boolean).join('\n');
      renderDesc(createFallbackDescription(topic, currentScript || lastScript, lastHashtags));
      toast('Description generated with smart fallback ✅', 'success');
    }

    if(htR.status==='fulfilled'&&htR.value) renderHashtags(htR.value.hashtags||[]);
    else hashtagsContent.innerHTML='<div class="placeholder-block"><p class="placeholder-text">Hashtags error 😔</p></div>';

    if(iR.status==='fulfilled'&&iR.value)  renderIdeas(iR.value.ideas||[]);
    else ideasContent.innerHTML='<div class="placeholder-block"><p class="placeholder-text">Ideas error 😔</p></div>';

    if(thR.status==='fulfilled'&&thR.value) renderThumbnail(thR.value.thumbnail||[]);
    else renderThumbnail([]);

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
    hideWakeScreen();
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



// ── PREMIUM EXPERIENCE: SCROLL PROGRESS, REVEAL, MOCKUP TYPING ─
function initPremiumExperience() {
  const progress = document.getElementById('scrollProgress');
  const topbar = document.querySelector('.topbar');
  const isMobileOrLowPower =
    window.matchMedia('(max-width: 900px)').matches ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);

  function updateScrollProgress() {
    const doc = document.documentElement;
    const total = Math.max(1, doc.scrollHeight - window.innerHeight);
    const pct = Math.min(1, Math.max(0, window.scrollY / total));
    if (progress && !isMobileOrLowPower) {
      progress.style.transform = `scaleX(${pct})`;
    }
    if (topbar) topbar.classList.toggle('scrolled', window.scrollY > 12);
  }

  updateScrollProgress();

  let scrollTicking = false;
  window.addEventListener('scroll', () => {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      updateScrollProgress();
      scrollTicking = false;
    });
  }, { passive: true });

  const revealTargets = document.querySelectorAll([
    '.premium-proof-strip .proof-pill',
    '.generator-shell .section-heading',
    '.input-card',
    '.creator-lab-section .section-heading',
    '.lab-card',
    '.features-section .section-heading',
    '.feature-card',
    '.how-section .section-heading',
    '.step-row',
    '.steps-preview-card',
    '.pricing-section .section-heading',
    '.pricing-card',
    '.faq-section .section-heading',
    '.faq-list details',
    '.premium-hero-copy',
    '.hero-product-mockup',
    '.trust-disclaimer'
  ].join(','));

  // Fast mode: keep all sections visible. This removes scroll stutter on mobile and low-end devices.
  revealTargets.forEach(el => {
    el.classList.add('is-visible');
    el.style.willChange = 'auto';
  });

  const typedTopic = document.getElementById('mockupTypedTopic');
  if (typedTopic && !isMobileOrLowPower) {
    const topics = [
      'AI tools se paisa kaise kamaye?',
      'Study motivation for class 11 students',
      'YouTube Shorts algorithm secret',
      '5 mistakes new creators make'
    ];
    let topicIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let typingTimer = null;

    function typeMockTopic() {
      const word = topics[topicIndex];
      if (!deleting) {
        charIndex += 1;
        typedTopic.textContent = word.slice(0, charIndex);
        if (charIndex >= word.length) {
          deleting = true;
          typingTimer = setTimeout(typeMockTopic, 1800);
          return;
        }
      } else {
        charIndex -= 1;
        typedTopic.textContent = word.slice(0, Math.max(0, charIndex));
        if (charIndex <= 0) {
          deleting = false;
          topicIndex = (topicIndex + 1) % topics.length;
        }
      }
      typingTimer = setTimeout(typeMockTopic, deleting ? 42 : 72);
    }

    typeMockTopic();
    window.addEventListener('pagehide', () => typingTimer && clearTimeout(typingTimer));
  }

  document.getElementById('tryExampleTopicBtn')?.addEventListener('click', () => {
    window.setTopic?.('YouTube Shorts algorithm secret');
    document.getElementById('generator')?.scrollIntoView({
      behavior: isMobileOrLowPower ? 'auto' : 'smooth',
      block: 'start'
    });
    toast('Example topic added — ab Generate All dabao ⚡', 'success');
  });

  // Magnetic hover only on devices with mouse. Disabled on touch/mobile to avoid lag.
  if (!isMobileOrLowPower && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('.magnetic-cta').forEach(btn => {
      let magneticFrame = null;
      let nextTransform = '';
      btn.addEventListener('mousemove', (e) => {
        const r = btn.getBoundingClientRect();
        nextTransform = `translate3d(${(e.clientX - r.left - r.width / 2) / 18}px, ${(e.clientY - r.top - r.height / 2) / 18}px, 0)`;
        if (magneticFrame) return;
        magneticFrame = requestAnimationFrame(() => {
          btn.style.transform = nextTransform;
          magneticFrame = null;
        });
      });
      btn.addEventListener('mouseleave', () => {
        if (magneticFrame) cancelAnimationFrame(magneticFrame);
        magneticFrame = null;
        btn.style.transform = '';
      });
    });
  }
}

// ── INIT ──────────────────────────────────────────────────────
document.querySelector('.upgrade-note')?.remove();
initFeedbackUI();
ensureMobileNavbarVisibility();
applyMobileSidebarFixes();
window.addEventListener('resize', () => {
  ensureMobileNavbarVisibility();
  applyMobileSidebarFixes();
});
document.querySelector('.nav-tab[data-tab="ideas"]')?.addEventListener('click', () => {
  if (!lastIdeas.length) loadTrendingIdeas();
});
initPremiumExperience();
setProStatus(isPro, { silent: true });
updateCreditsBadge();
