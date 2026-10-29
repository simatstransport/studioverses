const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../config');

class ImageService {
  constructor() {
    this.provider = config.imageProvider || 'flux'; // 'flux' | 'imagen' | 'dalle' | 'mock'
  }

  /**
   * Generates a high-definition 1080x1350 vertical artwork matching the requested prompt and model
   * @param {string} prompt - Detailed prompt (manual or AI-generated)
   * @param {string} verseReference - e.g. "1 Kings 8:15"
   * @param {string} requestedProvider - 'flux' | 'dalle' | 'imagen' | 'mock'
   * @returns {Promise<Buffer>}
   */
  async generateBackground(prompt, verseReference = 'verse', requestedProvider = null) {
    const provider = requestedProvider || this.provider || 'flux';
    console.log(`[ImageService] Generating background for "${verseReference}" using model/provider: "${provider}"...`);
    console.log(`[ImageService] Prompt: ${prompt.slice(0, 140)}...`);

    // 1. If OpenAI DALL-E 3 is requested
    if ((provider === 'dalle' || provider === 'dalle3') && config.openaiApiKey) {
      try {
        console.log('[ImageService] Calling OpenAI DALL-E 3 HD...');
        return await this._generateWithDalle(prompt);
      } catch (err) {
        console.warn(`[ImageService] DALL-E 3 failed (${err.message}). Falling back to Flux...`);
      }
    }

    // 2. If Google Imagen is requested
    if (provider === 'imagen' && config.geminiApiKey) {
      try {
        console.log('[ImageService] Calling Google Imagen 3...');
        return await this._generateWithImagen(prompt);
      } catch (err) {
        console.warn(`[ImageService] Imagen failed (${err.message}). Falling back to Flux...`);
      }
    }

    // 3. Primary High-Definition Model: Black Forest Labs FLUX.1 (Via Pollinations)
    if (provider !== 'mock') {
      try {
        console.log('[ImageService] Generating via High-Definition FLUX.1 (8K Photorealistic)...');
        return await this._generateWithFlux(prompt);
      } catch (err) {
        console.warn(`[ImageService] Flux generation failed (${err.message}). Trying secondary...`);
      }
    }

    // 4. Procedural Atmospheric Engine (Zero-latency offline fallback)
    console.log('[ImageService] Generating via Procedural Studio Engine...');
    return this._generateProceduralAtmosphere(prompt);
  }

  /**
   * High-Definition FLUX.1 Model
   * Photorealistic 1080x1350 vertical portrait with cinematic masterclass cues
   */
  async _generateWithFlux(prompt) {
    const enhancedPrompt = this._enhancePrompt(prompt);
    // Allow up to 1500 chars for deep prompt fidelity
    const encoded = encodeURIComponent(enhancedPrompt.slice(0, 1500));
    const seed = Math.floor(Math.random() * 9999999);
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=1080&height=1350&nologo=true&seed=${seed}&model=flux`;

    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 45000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!res.data || res.data.length < 5000) {
      throw new Error('Invalid image buffer received from Flux endpoint');
    }

    return Buffer.from(res.data);
  }

  /**
   * OpenAI DALL-E 3 HD Generator
   */
  async _generateWithDalle(prompt) {
    const url = 'https://api.openai.com/v1/images/generations';
    const enhancedPrompt = `${prompt.slice(0, 900)}, vertical portrait 1024x1792, cinematic lighting, 8k photorealistic, upper half dark volumetric clouds, lower half majestic sacred biblical landscape`;

    const res = await axios.post(
      url,
      {
        model: 'dall-e-3',
        prompt: enhancedPrompt,
        n: 1,
        size: '1024x1792',
        quality: 'hd',
        response_format: 'b64_json'
      },
      {
        headers: {
          'Authorization': `Bearer ${config.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    const b64 = res.data?.data?.[0]?.b64_json;
    if (!b64) throw new Error('No b64 image returned from DALL-E 3 API');
    return Buffer.from(b64, 'base64');
  }

  /**
   * Google Imagen 3 Generator
   */
  async _generateWithImagen(prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${config.geminiApiKey}`;
    const response = await axios.post(
      url,
      {
        instances: [{
          prompt: `${prompt.slice(0, 900)}, vertical 4:5 portrait, cinematic volumetric lighting, 8k, dark navy storm clouds upper half, majestic biblical landscape lower half`
        }],
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
   * Enhances prompts with elite visual cues to prevent boring imagery
   */
  _enhancePrompt(prompt) {
    const clean = (prompt || '').trim();
    const additions = [];

    if (!/4:5|portrait|vertical/i.test(clean)) {
      additions.push('vertical 4:5 portrait composition');
    }
    if (!/cinematic|volumetric/i.test(clean)) {
      additions.push('cinematic volumetric god rays, majestic spiritual atmosphere');
    }
    if (!/navy|gold|ivory/i.test(clean)) {
      additions.push('deep navy blue, royal blue, antique gold and warm ivory palette');
    }
    if (!/8k|photoreal|realistic/i.test(clean)) {
      additions.push('photorealistic 8k visual quality, extraordinary atmospheric depth');
    }
    if (!/upper|clouds|negative space/i.test(clean)) {
      additions.push('upper 55% dramatic dark navy volumetric clouds with heavenly sunburst, lower 45% majestic sacred architecture or landscape');
    }

    return additions.length > 0 ? `${clean}, ${additions.join(', ')}` : clean;
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

    // Ancient stone temple / Jerusalem panorama in the lower third
    const templeY = height * 0.65;
    ctx.save();
    ctx.fillStyle = '#c8a872';
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
