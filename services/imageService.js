const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../config');

class ImageService {
  constructor() {
    this.provider = config.imageProvider || 'pollinations'; // 'pollinations' | 'imagen' | 'dalle' | 'mock'
  }

  /**
   * Generates a unique, verse-specific background image (1080x1350)
   * @param {string} prompt - Detailed prompt from Gemini
   * @param {string} verseReference - e.g. "1 Kings 8:15"
   * @returns {Promise<Buffer>}
   */
  async generateBackground(prompt, verseReference = 'verse') {
    console.log(`[ImageService] Generating background for "${verseReference}"...`);
    console.log(`[ImageService] Prompt: ${prompt.slice(0, 120)}...`);

    // 1. Pollinations AI (High-resolution Flux / SDXL - Free, photorealistic, no rate limit)
    try {
      return await this._generateWithPollinations(prompt);
    } catch (err) {
      console.warn(`[ImageService] Pollinations generation error (${err.message}). Trying secondary...`);
    }

    // 2. Google Imagen 3 (if Gemini API key configured)
    if (config.geminiApiKey) {
      try {
        return await this._generateWithImagen(prompt);
      } catch (err) {
        console.warn(`[ImageService] Imagen generation failed: ${err.message}`);
      }
    }

    // 3. Fallback Procedural Atmosphere
    return this._generateProceduralAtmosphere(prompt);
  }

  /**
   * Pollinations AI (Photorealistic 1080x1350 vertical cinematic artwork)
   */
  async _generateWithPollinations(prompt) {
    // Clean and encode prompt with exact masterclass visual cues
    const enhancedPrompt = `${prompt}, aspect ratio 4:5 vertical portrait, cinematic lighting, deep navy blue, royal blue, antique gold and warm ivory, photorealistic 8k, reverent sacred biblical digital art, upper half dark navy clouds with god rays, lower half majestic panoramic scenery, volumetric lighting`;
    const encoded = encodeURIComponent(enhancedPrompt.slice(0, 480));
    const seed = Math.floor(Math.random() * 999999);
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=1080&height=1350&nologo=true&seed=${seed}&model=flux`;

    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 35000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    if (!res.data || res.data.length < 5000) {
      throw new Error('Invalid image buffer received from Pollinations');
    }

    return Buffer.from(res.data);
  }

  /**
   * Google Imagen 3 via Gemini REST API
   */
  async _generateWithImagen(prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${config.geminiApiKey}`;
    const response = await axios.post(
      url,
      {
        instances: [{ prompt: `${prompt}, 4:5 portrait aspect ratio, cinematic lighting, upper half dark volumetric clouds, lower half majestic biblical landscape` }],
        parameters: {
          sampleCount: 1,
          aspectRatio: '3:4',
          outputMimeType: 'image/jpeg'
        }
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 40000
      }
    );

    const b64 = response.data?.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) throw new Error('No bytes returned from Imagen');
    return Buffer.from(b64, 'base64');
  }

  /**
   * High-quality procedural cinematic generator (instant offline backup)
   */
  async _generateProceduralAtmosphere(prompt) {
    const { createCanvas } = require('@napi-rs/canvas');
    const width = 1080;
    const height = 1350;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Deep moody sky at the top
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.7);
    skyGrad.addColorStop(0, '#060912');
    skyGrad.addColorStop(0.4, '#131929');
    skyGrad.addColorStop(0.7, '#24202d');
    skyGrad.addColorStop(1, '#4a3424');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Radiant sunburst on upper right
    const sunX = width * 0.85;
    const sunY = height * 0.22;
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 15, sunX, sunY, 700);
    sunGrad.addColorStop(0, 'rgba(255, 240, 190, 0.9)');
    sunGrad.addColorStop(0.2, 'rgba(248, 195, 90, 0.5)');
    sunGrad.addColorStop(0.5, 'rgba(180, 100, 35, 0.2)');
    sunGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, width, height);

    // God rays streaming diagonally down
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#fff4d5';
    for (let i = 0; i < 9; i++) {
      const angle = 2.0 + (i * 0.08);
      ctx.beginPath();
      ctx.moveTo(sunX, sunY);
      ctx.lineTo(sunX + Math.cos(angle) * 1600, sunY + Math.sin(angle) * 1600);
      ctx.lineTo(sunX + Math.cos(angle + 0.04) * 1600, sunY + Math.sin(angle + 0.04) * 1600);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Ancient stone temple / Jerusalem panorama in the lower third (matching sample)
    const templeY = height * 0.65;
    ctx.save();
    ctx.fillStyle = '#c8a872';
    // Base temple sanctuary structure
    ctx.fillRect(width * 0.6, templeY - 80, 260, 120);
    ctx.fillStyle = '#a88650';
    ctx.fillRect(width * 0.64, templeY - 140, 180, 60);

    // City walls and buildings stretching left
    ctx.fillStyle = '#9b7842';
    ctx.beginPath();
    ctx.moveTo(0, height * 0.74);
    ctx.lineTo(width * 0.6, height * 0.70);
    ctx.lineTo(width, height * 0.72);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    // Foreground stone ledge
    ctx.fillStyle = '#423321';
    ctx.fillRect(0, height * 0.88, width, height * 0.12);
    ctx.restore();

    return canvas.toBuffer('image/jpeg');
  }
}

module.exports = new ImageService();
