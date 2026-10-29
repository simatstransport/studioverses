const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../config');

class ImageService {
  constructor() {
    this.provider = config.imageProvider || 'imagen';
  }

  /**
   * Generates a background image based on prompt
   * @param {string} prompt - Detailed prompt from Gemini
   * @param {string} verseReference - Used for naming cache files
   * @returns {Promise<Buffer>} - Buffer of the generated image
   */
  async generateBackground(prompt, verseReference = 'daily') {
    const safeRef = verseReference.replace(/[^a-zA-Z0-9_-]/g, '_');
    const outDir = config.paths.generated;
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    console.log(`[ImageService] Generating background using provider "${this.provider}"...`);
    console.log(`[ImageService] Prompt: ${prompt.slice(0, 100)}...`);

    // 1. Google Imagen 3
    if (this.provider === 'imagen' && config.geminiApiKey) {
      try {
        return await this._generateWithImagen(prompt);
      } catch (err) {
        console.warn(`[ImageService] Imagen generation failed (${err.message}). Falling back to procedural artwork.`);
      }
    }

    // 2. OpenAI DALL-E 3
    if (this.provider === 'dalle' && config.openaiApiKey) {
      try {
        return await this._generateWithDalle(prompt);
      } catch (err) {
        console.warn(`[ImageService] DALL-E generation failed (${err.message}). Falling back to procedural artwork.`);
      }
    }

    // 3. High-quality Atmospheric Procedural Generator (Fallback & Demo Mode)
    return this._generateProceduralAtmosphere(prompt);
  }

  /**
   * Google Imagen 3 via Gemini REST API
   */
  async _generateWithImagen(prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${config.geminiApiKey}`;
    
    // Add strict aspect ratio and negative space directives
    const enhancedPrompt = `${prompt}, aspect ratio 4:5 vertical portrait, cinematic mood, dark negative space on right`;

    const response = await axios.post(
      url,
      {
        instances: [{ prompt: enhancedPrompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: '3:4', // closest portrait ratio supported
          outputMimeType: 'image/jpeg',
          personGeneration: 'ALLOW_ADULT'
        }
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 45000
      }
    );

    const b64 = response.data?.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) {
      throw new Error('No image bytes returned in Imagen prediction response');
    }

    return Buffer.from(b64, 'base64');
  }

  /**
   * OpenAI DALL-E 3
   */
  async _generateWithDalle(prompt) {
    const url = 'https://api.openai.com/v1/images/generations';
    const response = await axios.post(
      url,
      {
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1792', // vertical
        response_format: 'b64_json'
      },
      {
        headers: {
          Authorization: `Bearer ${config.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 45000
      }
    );

    const b64 = response.data?.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error('No image returned from DALL-E 3');
    }

    return Buffer.from(b64, 'base64');
  }

  /**
   * Procedural Cinematic Canvas Art Generator
   * Generates a rich, atmospheric 1080x1350 canvas with golden hour backlighting,
   * deep dark moody shadows, volumetric fog, and dark negative space on the right.
   */
  async _generateProceduralAtmosphere(prompt) {
    const { createCanvas } = require('@napi-rs/canvas');
    const width = 1080;
    const height = 1350;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Base deep dark moody twilight background
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#0a0d14');
    bgGrad.addColorStop(0.3, '#101726');
    bgGrad.addColorStop(0.7, '#1a1820');
    bgGrad.addColorStop(1, '#08090d');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Golden hour backlight burst (positioned on left / upper-left to leave right dark)
    const sunX = width * 0.28;
    const sunY = height * 0.32;
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 650);
    sunGrad.addColorStop(0, 'rgba(255, 235, 175, 0.7)');
    sunGrad.addColorStop(0.2, 'rgba(249, 180, 70, 0.35)');
    sunGrad.addColorStop(0.5, 'rgba(180, 95, 30, 0.15)');
    sunGrad.addColorStop(0.8, 'rgba(40, 20, 60, 0.05)');
    sunGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, width, height);

    // Ethereal light rays from top-left toward bottom-right
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#fff4d0';
    for (let i = 0; i < 8; i++) {
      const angle = (i * 0.08) - 0.2;
      ctx.beginPath();
      ctx.moveTo(sunX, sunY);
      ctx.lineTo(sunX + Math.cos(angle) * 1400, sunY + Math.sin(angle) * 1400);
      ctx.lineTo(sunX + Math.cos(angle + 0.04) * 1400, sunY + Math.sin(angle + 0.04) * 1400);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Silhouetted mountain ridges and gentle mist on the lower-left
    ctx.save();
    ctx.fillStyle = '#0b0f17';
    ctx.beginPath();
    ctx.moveTo(0, height * 0.7);
    ctx.bezierCurveTo(width * 0.2, height * 0.62, width * 0.4, height * 0.75, width * 0.7, height * 0.88);
    ctx.lineTo(width, height * 0.92);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    // Secondary foreground silhouette
    ctx.fillStyle = '#06080c';
    ctx.beginPath();
    ctx.moveTo(0, height * 0.82);
    ctx.bezierCurveTo(width * 0.15, height * 0.78, width * 0.35, height * 0.85, width * 0.55, height * 0.95);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    // Glowing symbolic cross silhouette on the distant hill (left)
    ctx.fillStyle = 'rgba(255, 230, 160, 0.85)';
    ctx.shadowColor = '#f9d371';
    ctx.shadowBlur = 20;
    const crossX = width * 0.24;
    const crossY = height * 0.62;
    // Vertical beam
    ctx.fillRect(crossX - 3, crossY - 60, 6, 80);
    // Horizontal beam
    ctx.fillRect(crossX - 22, crossY - 44, 44, 6);
    ctx.restore();

    // Atmospheric noise / fine stars
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let s = 0; s < 60; s++) {
      const sx = (Math.sin(s * 99) * 0.5 + 0.5) * width;
      const sy = (Math.cos(s * 77) * 0.5 + 0.5) * (height * 0.5);
      const sr = (s % 3 === 0) ? 1.5 : 0.8;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    return canvas.toBuffer('image/jpeg');
  }
}

module.exports = new ImageService();
