const topicInput = document.getElementById('topic');
const generateBtn = document.getElementById('generateBtn');
const copyBtn = document.getElementById('copyBtn');
const statusText = document.getElementById('status');
const scriptSections = document.getElementById('scriptSections');

let lastScript = '';

function showSkeleton() {
  scriptSections.innerHTML = `
    <div class="skeleton"></div>
    <div class="skeleton"></div>
    <div class="skeleton"></div>
  `;
}

function showPlaceholder() {
  scriptSections.innerHTML = `
    <div class="placeholder-block">
      <p class="placeholder-text">Tumhara viral script yahan aayega... ⚡</p>
    </div>
  `;
}

function renderScript(data) {
  const sections = [];

  if (data.hook) {
    sections.push(`
      <div class="section-block hook">
        <div class="section-label">🔥 Hook</div>
        <div class="section-text">${escapeHtml(data.hook)}</div>
      </div>
    `);
  }

  if (data.mainContent) {
    sections.push(`
      <div class="section-block main-content">
        <div class="section-label">📢 Main Content</div>
        <div class="section-text">${escapeHtml(data.mainContent)}</div>
      </div>
    `);
  }

  if (data.cta) {
    sections.push(`
      <div class="section-block cta">
        <div class="section-label">👆 Call to Action</div>
        <div class="section-text">${escapeHtml(data.cta)}</div>
      </div>
    `);
  }

  if (sections.length === 0) {
    showPlaceholder();
    return;
  }

  scriptSections.innerHTML = sections.join('');

  // Save plain text version for copy
  lastScript = [
    data.hook ? `Hook:\n${data.hook}` : '',
    data.mainContent ? `Main Content:\n${data.mainContent}` : '',
    data.cta ? `CTA:\n${data.cta}` : '',
  ].filter(Boolean).join('\n\n');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

function setStatus(message, type = '') {
  statusText.textContent = message;
  statusText.className = `status ${type}`;
}

function setLoading(isLoading) {
  generateBtn.disabled = isLoading;
  const btnText = generateBtn.querySelector('.btn-text');
  btnText.textContent = isLoading ? 'Generating...' : 'Generate';
}

async function handleGenerate() {
  const topic = topicInput.value.trim();

  if (!topic) {
    setStatus('Please enter a topic pehle! 👆', 'error');
    topicInput.focus();
    return;
  }

  setLoading(true);
  setStatus('Script ban raha hai... thoda wait karo ✨');
  showSkeleton();
  copyBtn.disabled = true;
  lastScript = '';

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to generate script.');
    }

    renderScript(data);
    setStatus('Script ready hai! Copy kar lo 🎉', 'success');
    copyBtn.disabled = false;

  } catch (error) {
    showPlaceholder();
    setStatus(error.message || 'Kuch problem ho gayi. Dobara try karo!', 'error');
    copyBtn.disabled = true;
  } finally {
    setLoading(false);
  }
}

generateBtn.addEventListener('click', handleGenerate);

topicInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    handleGenerate();
  }
});

copyBtn.addEventListener('click', async () => {
  if (!lastScript) return;

  try {
    await navigator.clipboard.writeText(lastScript);
    const original = copyBtn.innerHTML;
    copyBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      Copied!
    `;
    setStatus('Clipboard mein copy ho gaya! ✅', 'success');
    setTimeout(() => {
      copyBtn.innerHTML = original;
    }, 2000);
  } catch (_err) {
    setStatus('Copy failed. Manually select karo.', 'error');
  }
});
