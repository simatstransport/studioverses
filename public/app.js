// Scripture Studio Frontend Logic

let currentPosterUrl = '/generated/test_verified.jpg';
let currentJobData = null;

// DOM Elements
const verseQueryInput = document.getElementById('verseQuery');
const btnRandom = document.getElementById('btnRandom');
const btnGenerate = document.getElementById('btnGenerate');
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  checkSystemStatus();
  loadHistory();
  setupEventListeners();
});

function setupEventListeners() {
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
      }
    } catch (e) {
      console.error(e);
    } finally {
      btnRandom.disabled = false;
    }
  });

  // Example chips
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      verseQueryInput.value = chip.dataset.ref;
      previewReference.textContent = chip.dataset.ref.toUpperCase();
    });
  });

  // Generate Poster button
  btnGenerate.addEventListener('click', handleGeneratePoster);

  // Copy Caption Button
  btnCopyCaption.addEventListener('click', handleCopyCaption);

  // Fullscreen button
  btnFullscreen.addEventListener('click', () => {
    if (posterImage.src) {
      window.open(posterImage.src, '_blank');
    }
  });
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

// 2. Generate Poster
async function handleGeneratePoster() {
  const reference = verseQueryInput.value.trim();
  const selectedLang = document.querySelector('input[name="language"]:checked')?.value || 'both';
  const provider = imageProviderSelect.value;

  btnGenerate.disabled = true;
  posterLoading.classList.remove('hidden');
  loadingStatusText.textContent = '1/3 Querying scripture & generating Gemini hook...';
  statusBar.textContent = 'Connecting to Google Gemini for hook, prompt and viral caption...';

  const stepTimer = setTimeout(() => {
    loadingStatusText.textContent = '2/3 Generating background artwork...';
  }, 2500);

  const stepTimer2 = setTimeout(() => {
    loadingStatusText.textContent = '3/3 Compositing 1080x1350 luxury typography...';
  }, 5000);

  try {
    const res = await fetch('/api/poster/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reference: reference || null,
        language: selectedLang,
        imageProvider: provider
      })
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
    previewReference.textContent = job.reference?.toUpperCase() || reference.toUpperCase();

    // Update Details
    hookVal.textContent = job.shortHook || '—';
    promptVal.textContent = job.aiAnalysis?.imagePrompt || '—';

    // Update Caption Box (Below Poster)
    const fullCaption = job.fullInstagramCaption || job.aiAnalysis?.fullInstagramCaption || '';
    captionBox.value = fullCaption;

    // Update Hashtags Cloud
    const tagsString = job.trendingHashtags || job.aiAnalysis?.trendingHashtags || '';
    updateHashtagChips(tagsString);

    // Update Download Button
    btnDownload.href = imageSource;
    btnDownload.download = `scripture_${job.reference.replace(/[^a-zA-Z0-9]/g, '_')}_1080x1350.jpg`;
    btnDownload.style.display = 'inline-flex';

    statusBar.textContent = `✓ Generated successfully in ${(job.durationMs / 1000).toFixed(1)}s! Ready to download and post to Instagram.`;
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
    // Fallback copy for older browsers
    captionBox.select();
    document.execCommand('copy');
    alert('Caption copied to clipboard!');
  }
}

function updateHashtagChips(tagsString) {
  if (!tagsString || !hashtagsCloud) return;
  const tags = tagsString.split(/\s+/).filter(t => t.startsWith('#'));
  if (tags.length === 0) return;

  hashtagsCloud.innerHTML = '';
  tags.forEach(tag => {
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
