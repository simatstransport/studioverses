const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const config = require('./config');
const dbService = require('./services/dbService');
const geminiService = require('./services/geminiService');
const imageService = require('./services/imageService');
const posterEngine = require('./services/posterEngine');
const instagramService = require('./services/instagramService');
const cronService = require('./services/cronService');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend and generated images
app.use(express.static(path.join(__dirname, 'public')));
app.use('/generated', express.static(path.join(__dirname, 'public', 'generated')));

// Route for dedicated Login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Ensure generated directory exists
if (!fs.existsSync(config.paths.generated)) {
  fs.mkdirSync(config.paths.generated, { recursive: true });
}

// ==========================================
// API ROUTES
// ==========================================

/**
 * 1. Health & Configuration Status Check
 */
app.get('/api/status', async (req, res) => {
  try {
    const igStatus = await instagramService.testConnection();
    res.json({
      success: true,
      serverTime: new Date().toISOString(),
      databases: {
        kjv: fs.existsSync(config.kjvDbPath),
        tamil: fs.existsSync(config.tamilDbPath)
      },
      apiKeys: {
        geminiConfigured: Boolean(config.geminiApiKey),
        openaiConfigured: Boolean(config.openaiApiKey),
        imageProvider: imageService.provider
      },
      instagram: {
        configured: instagramService.isConfigured(),
        publicBaseUrl: config.publicBaseUrl,
        accountInfo: igStatus
      },
      cron: {
        schedule: config.cronSchedule,
        autoPublish: config.autoPublishOnCron,
        language: config.cronLanguage,
        isRunning: cronService.isRunning
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 2. Fetch a random verse
 */
app.get('/api/verse/random', async (req, res) => {
  try {
    const verse = await dbService.getRandomVerse();
    res.json({ success: true, data: verse });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 3. Search or parse a specific verse reference (e.g. "1 Kings 8:15", "Isa 40:31")
 */
app.get('/api/verse/search', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ success: false, error: 'Query parameter "q" is required.' });
  }

  try {
    // Attempt exact reference parse first
    try {
      const verse = await dbService.getVerse(query);
      return res.json({ success: true, isReference: true, data: verse });
    } catch (refErr) {
      // If not a reference format, perform full text search
      const results = await dbService.search(query, 10);
      return res.json({ success: true, isReference: false, data: results });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 3b. Fetch AI Prompt preview for a verse (for Manual Prompt auto-fill)
 */
app.get('/api/verse/prompt', async (req, res) => {
  const query = req.query.q || '1 Kings 8:15';
  const lang = req.query.lang || 'both';

  try {
    let verseData;
    if (query === 'random') {
      verseData = await dbService.getRandomVerse();
    } else {
      verseData = await dbService.getVerse(query);
    }

    const aiAnalysis = await geminiService.analyzeVerse(verseData, lang);
    res.json({
      success: true,
      data: {
        verse: verseData,
        imagePrompt: aiAnalysis.imagePrompt,
        masterPrompt: aiAnalysis.masterPrompt,
        locationTheme: aiAnalysis.locationTheme,
        highlightEn: aiAnalysis.highlightEn,
        highlightTa: aiAnalysis.highlightTa,
        caption: aiAnalysis.fullInstagramCaption,
        trendingHashtags: aiAnalysis.trendingHashtags
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 4. Generate AI Prompt, Background Artwork & Composite Poster
 */
app.post('/api/poster/generate', async (req, res) => {
  try {
    const result = await cronService.runDailyPipeline(req.body);
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('[API /poster/generate] Failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 5. Manual Publish to Instagram
 */
app.post('/api/instagram/publish', async (req, res) => {
  const { posterUrl, caption } = req.body;

  if (!posterUrl) {
    return res.status(400).json({ success: false, error: 'posterUrl is required to publish.' });
  }

  try {
    const igResult = await instagramService.publishPhoto({
      imageUrl: posterUrl,
      caption: caption || 'Daily scripture verse'
    });

    res.json({ success: true, data: igResult });
  } catch (err) {
    console.error('[API /instagram/publish] Failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 6. Get Generation History
 */
app.get('/api/history', (req, res) => {
  res.json({ success: true, data: cronService.getHistory() });
});

// Start Server
async function startServer() {
  try {
    // Initialize databases
    await dbService.init();

    // Start background cron scheduler
    cronService.start();

    app.listen(config.port, () => {
      console.log(`=======================================================`);
      console.log(` Bible Verse Poster Generator & Instagram Publisher`);
      console.log(` Server active at: http://localhost:${config.port}`);
      console.log(` Dashboard UI:     http://localhost:${config.port}`);
      console.log(` Public Base URL:  ${config.publicBaseUrl}`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
