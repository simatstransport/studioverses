const path = require('path');
const fs = require('fs');
const config = require('../config');

// Select Canvas provider (prefer @napi-rs/canvas, fallback to canvas)
let canvasLib;
let isNapi = false;

try {
  const napi = require('@napi-rs/canvas');
  canvasLib = napi;
  isNapi = true;
} catch (e1) {
  try {
    canvasLib = require('canvas');
  } catch (e2) {
    throw new Error('Neither @napi-rs/canvas nor canvas is installed.');
  }
}

const { createCanvas, loadImage } = canvasLib;

class PosterEngine {
  constructor() {
    this.fontsRegistered = false;
    this.registerFonts();
  }

  registerFonts() {
    if (this.fontsRegistered) return;
    const fontsDir = config.paths.fonts;

    const fontMap = [
      { file: 'PlayfairDisplay-Bold.ttf', family: 'Playfair Display', weight: 'bold' },
      { file: 'GreatVibes-Regular.ttf', family: 'Great Vibes', weight: 'normal' },
      { file: 'Lora-Regular.ttf', family: 'Lora', weight: 'normal' },
      { file: 'Cinzel-Bold.ttf', family: 'Cinzel', weight: 'bold' },
      { file: 'MuktaMalar-Regular.ttf', family: 'Mukta Malar', weight: 'normal' },
      { file: 'MuktaMalar-Bold.ttf', family: 'Mukta Malar', weight: 'bold' }
    ];

    for (const f of fontMap) {
      const fullPath = path.join(fontsDir, f.file);
      if (fs.existsSync(fullPath)) {
        try {
          if (isNapi && canvasLib.GlobalFonts) {
            canvasLib.GlobalFonts.registerFromPath(fullPath, f.family);
          } else if (canvasLib.registerFont) {
            canvasLib.registerFont(fullPath, { family: f.family, weight: f.weight });
          }
          console.log(`[PosterEngine] Registered font: ${f.family}`);
        } catch (err) {
          console.warn(`[PosterEngine] Could not register font ${f.file}:`, err.message);
        }
      }
    }

    this.fontsRegistered = true;
  }

  /**
   * Main compositing function: produces a 1080x1350 JPEG/PNG buffer
   * @param {Object} options
   * @param {Buffer|string} options.backgroundImage - Buffer or path to image
   * @param {string} options.shortHook - Comforting English hook
   * @param {string} options.reference - e.g. "1 KINGS 8:15"
   * @param {string} options.verseTextEn - English verse text
   * @param {string} options.verseTextTa - Tamil verse text
   * @param {string} options.language - 'en' | 'ta' | 'both'
   */
  async renderPoster({
    backgroundImage,
    shortHook = 'I Know You Are Always With Me',
    reference = '1 KINGS 8:15',
    verseTextEn = '',
    verseTextTa = '',
    language = 'both'
  }) {
    const width = 1080;
    const height = 1350;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Draw Background Image
    if (backgroundImage) {
      let img;
      if (Buffer.isBuffer(backgroundImage)) {
        img = await loadImage(backgroundImage);
      } else if (typeof backgroundImage === 'string') {
        img = await loadImage(backgroundImage);
      }

      if (img) {
        // Draw image covering 1080x1350, centered
        this._drawImageCover(ctx, img, 0, 0, width, height);
      }
    } else {
      // Dark fallback background
      ctx.fillStyle = '#0f111a';
      ctx.fillRect(0, 0, width, height);
    }

    // 2. Cinematic Gradient Overlays (Dark moody right side & bottom for text legibility)
    this._applyCinematicOverlays(ctx, width, height);

    // 3. Subtle framing border
    this._drawEleganceFrame(ctx, width, height);

    // 4. Render Top-Right / Upper Hook
    // Mix two fonts: Bold Serif (Gold) + Cursive Script (White) + Curved golden underline
    this._renderHookText(ctx, shortHook, width, height);

    // 5. Render Verse Text (Scripture block)
    this._renderVerseBlock(ctx, {
      verseTextEn,
      verseTextTa,
      language,
      width,
      height
    });

    // 6. Render Bottom Decorative Divider & Reference
    this._renderReferenceFooter(ctx, reference, width, height);

    return canvas.toBuffer('image/jpeg');
  }

  /**
   * Scales and centers image to cover the canvas
   */
  _drawImageCover(ctx, img, x, y, w, h) {
    const imgRatio = img.width / img.height;
    const canvasRatio = w / h;
    let renderW, renderH, renderX, renderY;

    if (imgRatio < canvasRatio) {
      renderW = w;
      renderH = w / imgRatio;
      renderX = x;
      renderY = y + (h - renderH) / 2;
    } else {
      renderH = h;
      renderW = h * imgRatio;
      renderX = x + (w - renderW) / 2;
      renderY = y;
    }

    ctx.drawImage(img, renderX, renderY, renderW, renderH);
  }

  /**
   * Applies sophisticated gradients to guarantee text legibility without washing out the art
   */
  _applyCinematicOverlays(ctx, width, height) {
    ctx.save();

    // Overall subtle vignette
    const vignette = ctx.createRadialGradient(
      width * 0.5, height * 0.5, width * 0.3,
      width * 0.5, height * 0.5, width * 0.85
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(0.7, 'rgba(0, 0, 0, 0.45)');
    vignette.addColorStop(1, 'rgba(5, 7, 12, 0.85)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    // Dark moody gradient focused on right-half and bottom
    const rightGrad = ctx.createLinearGradient(width * 0.25, 0, width, height * 0.9);
    rightGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    rightGrad.addColorStop(0.4, 'rgba(6, 8, 14, 0.55)');
    rightGrad.addColorStop(0.75, 'rgba(4, 5, 10, 0.88)');
    rightGrad.addColorStop(1, 'rgba(2, 3, 6, 0.95)');
    ctx.fillStyle = rightGrad;
    ctx.fillRect(0, 0, width, height);

    // Bottom grounding gradient for the reference and footer
    const bottomGrad = ctx.createLinearGradient(0, height * 0.7, 0, height);
    bottomGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    bottomGrad.addColorStop(1, 'rgba(2, 3, 6, 0.9)');
    ctx.fillStyle = bottomGrad;
    ctx.fillRect(0, height * 0.7, width, height * 0.3);

    ctx.restore();
  }

  /**
   * Draws a very subtle, high-end outer gold border line
   */
  _drawEleganceFrame(ctx, width, height) {
    ctx.save();
    ctx.strokeStyle = 'rgba(249, 211, 113, 0.22)';
    ctx.lineWidth = 1;
    const inset = 40;
    ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);

    // Inner subtle corner notches
    const cornerSize = 14;
    ctx.strokeStyle = 'rgba(249, 211, 113, 0.55)';
    ctx.lineWidth = 1.5;

    // Top-Left
    ctx.beginPath();
    ctx.moveTo(inset, inset + cornerSize);
    ctx.lineTo(inset, inset);
    ctx.lineTo(inset + cornerSize, inset);
    ctx.stroke();

    // Top-Right
    ctx.beginPath();
    ctx.moveTo(width - inset - cornerSize, inset);
    ctx.lineTo(width - inset, inset);
    ctx.lineTo(width - inset, inset + cornerSize);
    ctx.stroke();

    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(inset, height - inset - cornerSize);
    ctx.lineTo(inset, height - inset);
    ctx.lineTo(inset + cornerSize, height - inset);
    ctx.stroke();

    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(width - inset - cornerSize, height - inset);
    ctx.lineTo(width - inset, height - inset);
    ctx.lineTo(width - inset, height - inset - cornerSize);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Renders Hook Text:
   * Bold Serif in Gold (#F9D371) + Cursive Script in White ('Great Vibes')
   * With golden curved underline graphic beneath it
   */
  _renderHookText(ctx, hookString, width, height) {
    if (!hookString) return;

    ctx.save();
    const cleanHook = hookString.trim();
    const words = cleanHook.split(/\s+/);

    // Split words: first portion in Serif Gold, last 1-2 words in Cursive Script White
    let serifWords = [];
    let scriptWords = [];

    if (words.length <= 2) {
      serifWords = [words[0]];
      scriptWords = words.slice(1);
    } else if (words.length <= 4) {
      serifWords = words.slice(0, 2);
      scriptWords = words.slice(2);
    } else {
      serifWords = words.slice(0, Math.ceil(words.length * 0.55));
      scriptWords = words.slice(Math.ceil(words.length * 0.55));
    }

    const serifText = serifWords.join(' ').toUpperCase();
    const scriptText = scriptWords.join(' ');

    const rightMargin = width - 85;
    const startY = 165;

    // 1. Serif Gold Line (Playfair Display / Cinzel)
    ctx.font = 'bold 36px "Playfair Display", "Cinzel", Georgia, serif';
    ctx.fillStyle = '#F9D371';
    ctx.textAlign = 'right';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 2;
    ctx.fillText(serifText, rightMargin, startY);

    // 2. Script White Line (Great Vibes)
    let scriptY = startY + 68;
    if (scriptText) {
      ctx.font = '54px "Great Vibes", "Brush Script MT", cursive';
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
      ctx.shadowBlur = 14;
      ctx.fillText(scriptText, rightMargin, scriptY);
    } else {
      scriptY = startY;
    }

    // 3. Golden Curved Underline Graphic beneath the hook
    const underlineY = scriptY + 22;
    const curveWidth = 240;
    const curveStartX = rightMargin - curveWidth;
    const curveEndX = rightMargin;

    ctx.strokeStyle = '#F9D371';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(249, 211, 113, 0.5)';
    ctx.shadowBlur = 8;

    ctx.beginPath();
    ctx.moveTo(curveStartX, underlineY);
    // Graceful curve
    ctx.bezierCurveTo(
      curveStartX + 60, underlineY + 12,
      curveEndX - 60, underlineY + 14,
      curveEndX, underlineY
    );
    ctx.stroke();

    // Delicate accent diamond at the end of the curve
    ctx.fillStyle = '#F9D371';
    ctx.beginPath();
    const diamondX = curveEndX - 10;
    const diamondY = underlineY + 7;
    ctx.moveTo(diamondX, diamondY - 4);
    ctx.lineTo(diamondX + 4, diamondY);
    ctx.lineTo(diamondX, diamondY + 4);
    ctx.lineTo(diamondX - 4, diamondY);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /**
   * Renders the Scripture text block (English, Tamil, or Both)
   */
  _renderVerseBlock(ctx, { verseTextEn, verseTextTa, language, width, height }) {
    ctx.save();

    const rightMargin = width - 85;
    const maxWidth = 580; // keep in right-half negative space
    const centerY = height * 0.58;

    ctx.textAlign = 'right';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 2;

    if (language === 'both' && verseTextEn && verseTextTa) {
      // Bilingual Rendering: English on top, subtle divider, Tamil below
      ctx.font = '31px "Lora", Georgia, serif';
      ctx.fillStyle = '#FDFDFD';
      const enLines = this._wrapText(ctx, `"${verseTextEn}"`, maxWidth);
      const enLineHeight = 44;

      ctx.font = 'bold 28px "Mukta Malar", "Latha", "Noto Sans Tamil", sans-serif';
      ctx.fillStyle = '#F2EBD9';
      const taLines = this._wrapText(ctx, `"${verseTextTa}"`, maxWidth);
      const taLineHeight = 42;

      const totalBlockHeight =
        enLines.length * enLineHeight +
        40 + // divider gap
        taLines.length * taLineHeight;

      let currentY = centerY - totalBlockHeight / 2 + 30;

      // Draw English lines
      ctx.font = '31px "Lora", Georgia, serif';
      ctx.fillStyle = '#FDFDFD';
      for (const line of enLines) {
        ctx.fillText(line, rightMargin, currentY);
        currentY += enLineHeight;
      }

      // Subtle decorative divider between languages
      currentY += 8;
      ctx.strokeStyle = 'rgba(249, 211, 113, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rightMargin - 180, currentY);
      ctx.lineTo(rightMargin, currentY);
      ctx.stroke();

      // Small central diamond
      ctx.fillStyle = '#F9D371';
      ctx.beginPath();
      const dotX = rightMargin - 90;
      ctx.arc(dotX, currentY, 2.5, 0, Math.PI * 2);
      ctx.fill();

      currentY += 32;

      // Draw Tamil lines
      ctx.font = 'bold 27px "Mukta Malar", "Latha", "Noto Sans Tamil", sans-serif';
      ctx.fillStyle = '#F4EDE0';
      for (const line of taLines) {
        ctx.fillText(line, rightMargin, currentY);
        currentY += taLineHeight;
      }

    } else if (language === 'ta' && verseTextTa) {
      // Tamil Only
      ctx.font = 'bold 36px "Mukta Malar", "Latha", "Noto Sans Tamil", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      const lines = this._wrapText(ctx, `"${verseTextTa}"`, maxWidth);
      const lineHeight = 54;
      let currentY = centerY - (lines.length * lineHeight) / 2;

      for (const line of lines) {
        ctx.fillText(line, rightMargin, currentY);
        currentY += lineHeight;
      }

    } else {
      // English Only
      ctx.font = '36px "Lora", Georgia, serif';
      ctx.fillStyle = '#FFFFFF';
      const lines = this._wrapText(ctx, `"${verseTextEn || verseTextTa}"`, maxWidth);
      const lineHeight = 54;
      let currentY = centerY - (lines.length * lineHeight) / 2;

      for (const line of lines) {
        ctx.fillText(line, rightMargin, currentY);
        currentY += lineHeight;
      }
    }

    ctx.restore();
  }

  /**
   * Renders Decorative Divider (thin line + cross ┼ + thin line) and Gold All-Caps Reference
   */
  _renderReferenceFooter(ctx, referenceString, width, height) {
    if (!referenceString) return;

    ctx.save();
    const rightMargin = width - 85;
    const footerY = height - 145;

    // Decorative Divider (right-aligned under verse block)
    const dividerWidth = 320;
    const dividerX = rightMargin - dividerWidth / 2;
    const lineHalf = 135;

    ctx.strokeStyle = 'rgba(249, 211, 113, 0.7)';
    ctx.lineWidth = 1.2;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 8;

    // Left segment
    ctx.beginPath();
    ctx.moveTo(dividerX - lineHalf, footerY);
    ctx.lineTo(dividerX - 18, footerY);
    ctx.stroke();

    // Cross icon ┼ in the center
    ctx.fillStyle = '#F9D371';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '22px serif';
    ctx.fillText('┼', dividerX, footerY - 1);

    // Right segment
    ctx.beginPath();
    ctx.moveTo(dividerX + 18, footerY);
    ctx.lineTo(dividerX + lineHalf, footerY);
    ctx.stroke();

    // Scripture Reference (All-Caps Serif in Gold with wide letter spacing)
    ctx.font = 'bold 22px "Cinzel", "Playfair Display", Georgia, serif';
    ctx.fillStyle = '#F9D371';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 2;

    const spacedText = this._addLetterSpacing(referenceString.toUpperCase(), 3);
    ctx.fillText(spacedText, dividerX, footerY + 36);

    ctx.restore();
  }

  /**
   * Simulates letter spacing by inserting spaces
   */
  _addLetterSpacing(text, spaces = 2) {
    return text.split('').join(' '.repeat(spaces));
  }

  /**
   * Helper function to wrap text within maximum width
   */
  _wrapText(ctx, text, maxWidth) {
    const words = text.split(/\s+/);
    const lines = [];
    let currentLine = '';

    for (let n = 0; n < words.length; n++) {
      const testLine = currentLine ? `${currentLine} ${words[n]}` : words[n];
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;

      if (testWidth > maxWidth && n > 0) {
        lines.push(currentLine);
        currentLine = words[n];
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }
}

module.exports = new PosterEngine();
