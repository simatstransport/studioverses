const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const config = require('../config');
const dbService = require('./dbService');
const geminiService = require('./geminiService');
const imageService = require('./imageService');
const posterEngine = require('./posterEngine');
const instagramService = require('./instagramService');

class CronService {
  constructor() {
    this.task = null;
    this.history = [];
    this.isRunning = false;
    this.scheduleExpression = config.cronSchedule || '0 8 * * *';
    this.autoPublish = config.autoPublishOnCron;
    this.language = config.cronLanguage || 'both';
  }

  start() {
    // Only schedule if explicitly enabled
    if (this.autoPublish) {
      if (this.task) this.task.stop();
      this.task = cron.schedule(this.scheduleExpression, async () => {
        try {
          await this.runDailyPipeline();
        } catch (err) {
          console.error('[CronService] Daily pipeline failed:', err.message);
        }
      });
      console.log(`[CronService] Active on schedule: ${this.scheduleExpression}`);
    } else {
      console.log('[CronService] Auto-publish is disabled. Manual mode active.');
    }
  }

  stop() {
    if (this.task) {
      this.task.stop();
    }
  }

  /**
   * Executes the poster generation pipeline:
   * Verse -> Gemini Analysis -> Background Art -> Canvas Compositor -> Base64 & File
   */
  async runDailyPipeline(customReference = null, customLanguage = null) {
    if (this.isRunning) {
      throw new Error('Pipeline is already busy processing a request. Please wait a moment.');
    }

    this.isRunning = true;
    const startTime = Date.now();
    const jobId = `job_${Date.now()}`;
    const targetLang = customLanguage || this.language;

    const record = {
      id: jobId,
      timestamp: new Date().toISOString(),
      status: 'PROCESSING',
      reference: null,
      shortHook: null,
      posterUrl: null,
      posterDataUri: null,
      fullInstagramCaption: null,
      trendingHashtags: null,
      durationMs: 0,
      logs: []
    };

    const log = (msg) => {
      console.log(`[Pipeline] ${msg}`);
      record.logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
    };

    try {
      // 1. Fetch verse from DB
      let verseData;
      if (customReference) {
        log(`Fetching verse: "${customReference}"...`);
        verseData = await dbService.getVerse(customReference);
      } else {
        log('Fetching daily random verse from SQLite database...');
        verseData = await dbService.getRandomVerse();
      }

      record.reference = verseData.referenceEn;
      log(`Scripture: ${verseData.referenceEn} (${verseData.referenceTa})`);

      // 2. Analyze with Gemini
      log('Generating theological hook, image prompt & viral caption...');
      const aiAnalysis = await geminiService.analyzeVerse(verseData, targetLang);
      record.shortHook = aiAnalysis.shortHook;
      record.fullInstagramCaption = aiAnalysis.fullInstagramCaption;
      record.trendingHashtags = aiAnalysis.trendingHashtags;
      log(`Gemini Hook: "${aiAnalysis.shortHook}"`);

      // 3. Generate background artwork
      log(`Generating background artwork via ${imageService.provider}...`);
      const bgBuffer = await imageService.generateBackground(aiAnalysis.imagePrompt, verseData.referenceEn);

      // 4. Composite 1080x1350 poster with Canvas
      log('Compositing 1080x1350 luxury typography poster matching premium reference...');
      const posterBuffer = await posterEngine.renderPoster({
        backgroundImage: bgBuffer,
        referenceEn: verseData.referenceEn,
        referenceTa: verseData.referenceTa,
        verseTextEn: verseData.textEn,
        verseTextTa: verseData.textTa,
        highlightEn: aiAnalysis.highlightEn,
        highlightTa: aiAnalysis.highlightTa,
        language: targetLang
      });

      // Encode as Base64 Data URI (works seamlessly on Vercel serverless without disk persistence)
      record.posterDataUri = `data:image/jpeg;base64,${posterBuffer.toString('base64')}`;

      // Try saving to disk (local environment or /tmp on Vercel)
      const filename = `poster_${verseData.referenceEn.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.jpg`;
      const outDir = config.paths.generated;

      try {
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }
        fs.writeFileSync(path.join(outDir, filename), posterBuffer);
        record.posterUrl = `/generated/${filename}`;
      } catch (writeErr) {
        // Fallback to /tmp in serverless environments
        try {
          const tmpPath = path.join(os.tmpdir(), filename);
          fs.writeFileSync(tmpPath, posterBuffer);
          record.posterUrl = record.posterDataUri; // use data uri directly
        } catch (tmpErr) {
          record.posterUrl = record.posterDataUri;
        }
      }

      log(`Poster created successfully!`);

      record.status = 'COMPLETED';
      record.verseData = verseData;
      record.aiAnalysis = aiAnalysis;
    } catch (err) {
      log(`Pipeline Error: ${err.message}`);
      record.status = 'FAILED';
      record.error = err.message;
      throw err;
    } finally {
      record.durationMs = Date.now() - startTime;
      this.isRunning = false;
      this.history.unshift(record);
      if (this.history.length > 30) this.history.pop();
    }

    return record;
  }

  getHistory() {
    return this.history;
  }
}

module.exports = new CronService();
