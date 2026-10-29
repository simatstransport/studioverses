// Scripture Studio Frontend Logic

let currentPosterUrl = '/generated/test_verified.jpg';
let currentJobData = null;

// DOM Elements
const verseQueryInput = document.getElementById('verseQuery');
const btnRandom = document.getElementById('btnRandom');
const btnGenerate = document.getElementById('btnGenerate');
const btnGenerateText = document.getElementById('btnGenerateText');
const btnDownload = document.getElementById('btnDownload');
const btnFullscreen = document.getElementById('btnFullscreen');
const btnCopyCaption = document.getElementById('btnCopyCaption');
const copyText = document.getElementById('copyText');
const copyIcon = document.getElementById('copyIcon');
const imageProviderSelect = document.getElementById('imageProviderSelect');
const captionBox = document.getElementById('captionBox');
const posterImage = document.getElementById('posterImage');
const posterLoading = document.getElementById('posterLoading');
const loadingStatusText = document.getElementById('loadingStatusText');
const statusBar = document.getElementById('statusBar');
const previewReference = document.getElementById('previewReference');
const hookVal = document.getElementById('hookVal');
const promptVal = document.getElementById('promptVal');
const historyGallery = document.getElementById('historyGallery');
const hashtagsCloud = document.getElementById('hashtagsCloud');

const dbStatusPill = document.getElementById('dbStatus');
const aiStatusPill = document.getElementById('aiStatus');

// Manual Prompt Elements
const toggleManualPrompt = document.getElementById('toggleManualPrompt');
const modeIndicatorDot = document.getElementById('modeIndicatorDot');
const modeTitle = document.getElementById('modeTitle');
const modeDesc = document.getElementById('modeDesc');
const manualPromptSection = document.getElementById('manualPromptSection');
const manualImagePrompt = document.getElementById('manualImagePrompt');
const btnAutoFillPrompt = document.getElementById('btnAutoFillPrompt');
const manualReference = document.getElementById('manualReference');
const manualTextEn = document.getElementById('manualTextEn');
const manualTextTa = document.getElementById('manualTextTa');
const manualHlEn = document.getElementById('manualHlEn');
const manualHlTa = document.getElementById('manualHlTa');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  checkSystemStatus();
  loadHistory();
  setupEventListeners();
});

function setupEventListeners() {
  // Mode Switcher Toggle: Auto Scripture Mode <--> Manual Prompt Mode
  if (toggleManualPrompt) {
    toggleManualPrompt.addEventListener('change', () => {
      const isManual = toggleManualPrompt.checked;

      if (isManual) {
        manualPromptSection.classList.remove('hidden');
        if (modeIndicatorDot) modeIndicatorDot.classList.add('manual');
        if (modeTitle) modeTitle.textContent = 'Manual Prompt Mode';
        if (modeDesc) modeDesc.textContent = 'Craft custom scenery prompts, enter custom scripture, or pick high-end AI models directly.';
        if (btnGenerateText) btnGenerateText.textContent = '🎨 Create Poster via Prompt';
        statusBar.textContent = '✏️ Manual Prompt Mode active. Craft your scenery prompt or click "Fill from Verse".';

        // Auto-fill prompt if empty
        if (!manualImagePrompt.value.trim()) {
          autoFillPromptFromVerse();
        }
      } else {
        manualPromptSection.classList.add('hidden');
        if (modeIndicatorDot) modeIndicatorDot.classList.remove('manual');
        if (modeTitle) modeTitle.textContent = 'Auto Scripture Mode';
        if (modeDesc) modeDesc.textContent = 'AI automatically crafts 8K scenery & master prompts from your selected verse.';
        if (btnGenerateText) btnGenerateText.textContent = '✨ Generate 1080x1350 Poster';
        statusBar.textContent = '🌟 Auto Scripture Mode active. Select a verse or click Random.';
      }
    });
  }

  // Auto-Fill Prompt from Verse Button
  if (btnAutoFillPrompt) {
    btnAutoFillPrompt.addEventListener('click', autoFillPromptFromVerse);
  }

  // Prompt Pill Quick Cues
  document.querySelectorAll('.prompt-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const text = pill.dataset.text;
      if (!text || !manualImagePrompt) return;

      const current = manualImagePrompt.value.trim();
      if (!current) {
        manualImagePrompt.value = text;
      } else {
        manualImagePrompt.value = current.endsWith(',') ? `${current} ${text}` : `${current}, ${text}`;
      }
      manualImagePrompt.focus();
    });
  });

  // Random button
  btnRandom.addEventListener('click', async () => {
    btnRandom.disabled = true;
    try {
      const res = await fetch('/api/verse/random');
      const data = await res.json();
      if (data.success && data.data) {
        verseQueryInput.value = data.data.referenceEn;
        previewReference.textContent = data.data.referenceEn.toUpperCase();
        statusBar.textContent = `Random scripture selected: ${data.data.referenceEn} (${data.data.referenceTa})`;

        // If manual mode is active, sync it as well
        if (toggleManualPrompt && toggleManualPrompt.checked) {
          autoFillPromptFromVerse();
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      btnRandom.disabled = false;
    }
  });

  // Auth change listener
  window.addEventListener('auth-changed', (e) => {
    const user = e.detail?.user;
    if (user) {
      statusBar.textContent = `Welcome, ${user.displayName || 'Believer'}! Signed in with Google.`;
    } else {
      statusBar.textContent = 'Ready to generate. Select a scripture or click Random Verse.';
    }
  });

  // Example chips
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      verseQueryInput.value = chip.dataset.ref;
      previewReference.textContent = chip.dataset.ref.toUpperCase();
      if (toggleManualPrompt && toggleManualPrompt.checked) {
        autoFillPromptFromVerse();
      }
    });
  });

  // Generate Poster button (handles both Auto and Manual Prompt modes)
  btnGenerate.addEventListener('click', handleGeneratePoster);

  // Copy Caption Button
  btnCopyCaption.addEventListener('click', handleCopyCaption);

  // Copy Master Prompt Button
  const btnCopyMasterPrompt = document.getElementById('btnCopyMasterPrompt');
  if (btnCopyMasterPrompt) {
    btnCopyMasterPrompt.addEventListener('click', () => {
      const val = promptVal.value || promptVal.textContent;
      if (val) {
        navigator.clipboard.writeText(val);
        btnCopyMasterPrompt.textContent = '✓ Copied!';
        setTimeout(() => { btnCopyMasterPrompt.textContent = '📋 Copy'; }, 2000);
      }
    });
  }

  // Fullscreen button
  btnFullscreen.addEventListener('click', () => {
    if (posterImage.src) {
      window.open(posterImage.src, '_blank');
    }
  });
}

// Auto-fill custom prompt fields from selected verse
async function autoFillPromptFromVerse() {
  const query = verseQueryInput.value.trim() || '1 Kings 8:15';
  const selectedLang = document.querySelector('input[name="language"]:checked')?.value || 'both';

  if (btnAutoFillPrompt) btnAutoFillPrompt.textContent = '⏳ Loading...';

  try {
    const res = await fetch(`/api/verse/prompt?q=${encodeURIComponent(query)}&lang=${selectedLang}`);
    const data = await res.json();

    if (data.success && data.data) {
      const d = data.data;
      if (manualImagePrompt) manualImagePrompt.value = d.imagePrompt;
      if (manualReference) manualReference.value = `${d.verse.referenceEn} | ${d.verse.referenceTa}`;
      if (manualTextEn) manualTextEn.value = d.verse.textEn;
      if (manualTextTa) manualTextTa.value = d.verse.textTa;
      if (manualHlEn) manualHlEn.value = d.highlightEn || '';
      if (manualHlTa) manualHlTa.value = d.highlightTa || '';

      statusBar.textContent = `🪄 Prompt auto-filled for ${d.verse.referenceEn}. You can now tweak the scenery!`;

      if (btnAutoFillPrompt) {
        btnAutoFillPrompt.textContent = '✓ Prompt Filled!';
        setTimeout(() => { btnAutoFillPrompt.textContent = '🪄 Fill from Verse'; }, 2000);
      }
    }
  } catch (err) {
    console.warn('Auto-fill prompt warning:', err);
    if (btnAutoFillPrompt) btnAutoFillPrompt.textContent = '🪄 Fill from Verse';
  }
}

// 1. Check System Status
async function checkSystemStatus() {
  try {
    const res = await fetch('/api/status');
    const status = await res.json();

    if (status.success) {
      if (status.databases.kjv && status.databases.tamil) {
        dbStatusPill.className = 'status-pill online';
        dbStatusPill.innerHTML = '<span class="dot"></span> SQLite: Connected (KJV + Tamil)';
      }

      if (status.apiKeys.geminiConfigured) {
        aiStatusPill.className = 'status-pill online';
        aiStatusPill.innerHTML = '<span class="dot"></span> Gemini AI: Connected';
      } else {
        aiStatusPill.className = 'status-pill warning';
        aiStatusPill.innerHTML = '<span class="dot"></span> Gemini AI: Offline Mode';
      }
    }
  } catch (err) {
    console.warn('Could not fetch status:', err);
  }
}

// 2. Generate Poster (Handles both Auto & Manual Prompt Modes)
async function handleGeneratePoster() {
  const isManualMode = toggleManualPrompt && toggleManualPrompt.checked;
  const selectedLang = document.querySelector('input[name="language"]:checked')?.value || 'both';
  const provider = imageProviderSelect.value;

  btnGenerate.disabled = true;
  posterLoading.classList.remove('hidden');

  let payload = {
    language: selectedLang,
    imageProvider: provider
  };

  if (isManualMode) {
    const customPrompt = manualImagePrompt?.value.trim();
    const customRef = manualReference?.value.trim();
    const customEn = manualTextEn?.value.trim();
    const customTa = manualTextTa?.value.trim();
    const hlEn = manualHlEn?.value.trim();
    const hlTa = manualHlTa?.value.trim();

    payload.reference = customRef || verseQueryInput.value.trim() || 'HOLY SCRIPTURE';
    payload.customPrompt = customPrompt || undefined;
    payload.verseTextEn = customEn || undefined;
    payload.verseTextTa = customTa || undefined;
    payload.highlightEn = hlEn || undefined;
    payload.highlightTa = hlTa || undefined;

    loadingStatusText.textContent = `1/2 Generating 8K background artwork via [${provider.toUpperCase()}]...`;
    statusBar.textContent = `Generating high-definition background artwork from custom prompt via ${provider.toUpperCase()}...`;
  } else {
    const reference = verseQueryInput.value.trim();
    payload.reference = reference || null;

    loadingStatusText.textContent = '1/3 Querying scripture & generating Gemini hook...';
    statusBar.textContent = 'Connecting to Google Gemini for hook, prompt and viral caption...';
  }

  const stepTimer = setTimeout(() => {
    loadingStatusText.textContent = '2/3 Generating background artwork...';
  }, 3000);

  const stepTimer2 = setTimeout(() => {
    loadingStatusText.textContent = '3/3 Compositing 1080x1350 luxury typography & Holy Bible emblem...';
  }, 6000);

  try {
    const res = await fetch('/api/poster/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    clearTimeout(stepTimer);
    clearTimeout(stepTimer2);

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Generation failed');
    }

    const job = data.data;
    currentJobData = job;

    // Prefer data URI for instant rendering (Vercel serverless friendly)
    const imageSource = job.posterDataUri || job.posterUrl;
    currentPosterUrl = imageSource;

    // Update Image Preview
    posterImage.src = imageSource;
    previewReference.textContent = job.reference?.toUpperCase() || (payload.reference || 'HOLY SCRIPTURE').toUpperCase();

    // Update Details
    hookVal.textContent = job.shortHook || job.aiAnalysis?.locationTheme || 'Solomon’s Temple in Jerusalem';
    const masterText = job.aiAnalysis?.masterPrompt || job.aiAnalysis?.imagePrompt || payload.customPrompt || '—';
    if (promptVal.tagName === 'TEXTAREA') {
      promptVal.value = masterText;
    } else {
      promptVal.textContent = masterText;
    }

    // Update Caption Box (Below Poster)
    const fullCaption = job.fullInstagramCaption || job.aiAnalysis?.fullInstagramCaption || '';
    captionBox.value = fullCaption;

    // Update Hashtags Cloud
    const rawTags = job.trendingHashtags || job.aiAnalysis?.trendingHashtags || '';
    updateHashtagChips(rawTags);

    // Update Download Button
    btnDownload.href = imageSource;
    btnDownload.download = `scripture_${(job.reference || 'verse').replace(/[^a-zA-Z0-9]/g, '_')}_1080x1350.jpg`;
    btnDownload.style.display = 'inline-flex';

    statusBar.textContent = `✓ Generated successfully in ${(job.durationMs / 1000).toFixed(1)}s via ${provider.toUpperCase()}! Ready to download and post to Instagram.`;
    loadHistory();
  } catch (err) {
    clearTimeout(stepTimer);
    clearTimeout(stepTimer2);
    statusBar.textContent = `❌ Error: ${err.message}`;
    alert(`Generation Error: ${err.message}`);
  } finally {
    btnGenerate.disabled = false;
    posterLoading.classList.add('hidden');
  }
}

// 3. Copy Caption & Hashtags
async function handleCopyCaption() {
  const text = captionBox.value.trim();
  if (!text) {
    alert('Please generate a poster first to get the caption.');
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    copyText.textContent = 'Copied to Clipboard! 🎉';
    copyIcon.textContent = '✓';
    btnCopyCaption.style.background = '#7ce3b6';
    btnCopyCaption.style.color = '#000';

    setTimeout(() => {
      copyText.textContent = 'Copy Full Caption & Hashtags';
      copyIcon.textContent = '📋';
      btnCopyCaption.style.background = '';
      btnCopyCaption.style.color = '';
    }, 2500);
  } catch (err) {
    captionBox.select();
    document.execCommand('copy');
    alert('Caption copied to clipboard!');
  }
}

function updateHashtagChips(tagsInput) {
  if (!tagsInput || !hashtagsCloud) return;
  let tags = [];
  if (Array.isArray(tagsInput)) {
    tags = tagsInput.map(t => String(t).trim()).filter(t => t.length > 0).map(t => t.startsWith('#') ? t : `#${t}`);
  } else if (typeof tagsInput === 'string') {
    tags = tagsInput.split(/\s+/).filter(t => t.startsWith('#'));
  } else {
    return;
  }
  if (tags.length === 0) return;

  hashtagsCloud.innerHTML = '';
  tags.slice(0, 15).forEach(tag => {
    const span = document.createElement('span');
    span.className = 'htag';
    span.textContent = tag;
    span.addEventListener('click', () => {
      navigator.clipboard.writeText(tag);
      statusBar.textContent = `Copied ${tag} to clipboard!`;
    });
    hashtagsCloud.appendChild(span);
  });
}

// 4. Load History
async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    const data = await res.json();

    if (data.success && data.data && data.data.length > 0) {
      historyGallery.innerHTML = '';
      data.data.forEach(item => {
        const src = item.posterDataUri || item.posterUrl;
        if (!src) return;
        const div = document.createElement('div');
        div.className = 'history-item';
        div.title = `${item.reference} - ${item.shortHook}`;
        div.innerHTML = `<img src="${src}" alt="${item.reference}">`;
        div.addEventListener('click', () => {
          posterImage.src = src;
          previewReference.textContent = (item.reference || '').toUpperCase();
          hookVal.textContent = item.shortHook || '—';
          promptVal.textContent = item.aiAnalysis?.imagePrompt || '—';
          captionBox.value = item.fullInstagramCaption || item.aiAnalysis?.fullInstagramCaption || '';
          updateHashtagChips(item.trendingHashtags || item.aiAnalysis?.trendingHashtags || '');
          currentPosterUrl = src;
          btnDownload.href = src;
          btnDownload.download = `scripture_${(item.reference || 'verse').replace(/[^a-zA-Z0-9]/g, '_')}_1080x1350.jpg`;
        });
        historyGallery.appendChild(div);
      });
    } else {
      historyGallery.innerHTML = '<p class="hint-text">No recent history yet.</p>';
    }
  } catch (e) {
    console.warn('Could not load history:', e);
  }
}
