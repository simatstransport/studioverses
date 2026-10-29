require('dotenv').config();
const path = require('path');

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:3000',

  // Database Paths (defaults to ./data/ inside project)
  kjvDbPath: process.env.KJV_DB_PATH || path.join(__dirname, 'data', 'kjv.db'),
  tamilDbPath: process.env.TAMIL_DB_PATH || path.join(__dirname, 'data', 'tamil.db'),

  // AI & APIs
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  imageProvider: process.env.IMAGE_PROVIDER || 'imagen', // 'imagen' | 'dalle' | 'mock'
  openaiApiKey: process.env.OPENAI_API_KEY || '',

  // Instagram Graph API
  instagramAccountId: process.env.INSTAGRAM_ACCOUNT_ID || '',
  instagramAccessToken: process.env.INSTAGRAM_ACCESS_TOKEN || '',

  // Automation / Cron
  cronSchedule: process.env.CRON_SCHEDULE || '0 8 * * *', // Daily 08:00 AM
  autoPublishOnCron: process.env.AUTO_PUBLISH_ON_CRON === 'true',
  cronLanguage: process.env.CRON_LANGUAGE || 'both', // 'en' | 'ta' | 'both'

  // Paths
  paths: {
    fonts: path.join(__dirname, 'fonts'),
    generated: path.join(__dirname, 'public', 'generated'),
    data: path.join(__dirname, 'data')
  }
};
