const path = require('path');
const fs = require('fs');
const config = require('../config');

// Select Canvas provider
let canvasLib;
let isNapi = false;

try {
  canvasLib = require('@napi-rs/canvas');
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
        } catch (err) {
          console.warn(`[PosterEngine] Font load warning: ${f.file}`);
        }
      }
    }

    this.fontsRegistered = true;
  }

  /**
   * Main rendering function strictly matching the reference image layout:
   * 1. Top Header: — HOLY BIBLE VERSE — in embossed gold with flanking lines
   * 2. Centered English verse with sacred/key words in BOLD GOLD
   * 3. Ornate gold divider: ─── ❖ ───
   * 4. Centered Tamil verse with sacred/key words in BOLD GOLD
   * 5. Centered reference: 1 KINGS 8:15  |  1 இராஜாக்கள் 8:15
   * 6. Cinematic background art in lower half, dark moody volumetric clouds in upper half
   */
  async renderPoster({
    backgroundImage,
    referenceEn = '1 KINGS 8:15',
    referenceTa = '1 இராஜாக்கள் 8:15',
    verseTextEn = '',
    verseTextTa = '',
    highlightEn = '',
    highlightTa = '',
    language = 'both'
  }) {
    const width = 1080;
    const height = 1350;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Draw Background Image
    if (backgroundImage) {
      let img;
      if (Buffer.isBuffer(backgroundImage) || typeof backgroundImage === 'string') {
        img = await loadImage(backgroundImage);
      }
      if (img) {
        this._drawImageCover(ctx, img, 0, 0, width, height);
      }
    } else {
      // Dark fallback
      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(0, 0, width, height);
    }

    // 2. Cinematic Gradient Overlay (Dark in upper half for text legibility, transparent in lower half for scenery)
    this._applyCinematicTopOverlay(ctx, width, height);

    // Floating Golden Divine Particles
    this._renderDivineGoldenParticles(ctx, width, height);

    // 3. Header: — HOLY BIBLE VERSE —
    this._renderHeader(ctx, width, 105);

    // 4. Centered Scripture Layout
    let currentY = 195;

    if (language === 'both') {
      // English Scripture
      currentY = this._renderScriptureText(ctx, {
        text: verseTextEn,
        highlightPhrase: highlightEn || this._detectHighlightEn(verseTextEn),
        fontRegular: '30px "Lora", Georgia, serif',
        fontBold: 'bold 32px "Cinzel", "Playfair Display", Georgia, serif',
        colorRegular: '#FFFFFF',
        colorHighlight: '#F8D775',
        maxWidth: 780,
        startY: currentY,
        lineHeight: 46,
        isEnglish: true
      });

      // Ornate Center Divider (─── ❖ ───)
      currentY += 28;
      this._renderOrnateDivider(ctx, width / 2, currentY);
      currentY += 46;

      // Tamil Scripture
      currentY = this._renderScriptureText(ctx, {
        text: verseTextTa,
        highlightPhrase: highlightTa || this._detectHighlightTa(verseTextTa),
        fontRegular: '28px "Mukta Malar", "Latha", sans-serif',
        fontBold: 'bold 31px "Mukta Malar", "Latha", sans-serif',
        colorRegular: '#F3EFE6',
        colorHighlight: '#F8D775',
        maxWidth: 800,
        startY: currentY,
        lineHeight: 48,
        isEnglish: false
      });

      // Reference Line
      currentY += 34;
      const refString = `${referenceEn.toUpperCase()}   |   ${referenceTa}`;
      this._renderReference(ctx, refString, width / 2, currentY);

      // Sacred Filler: If there is generous vertical gap in the middle (e.g. currentY < 700),
      // render the illuminated Open Holy Bible filler emblem!
      if (currentY < 680) {
        this._renderHolyBibleFiller(ctx, width / 2, currentY + 70);
      }

    } else if (language === 'ta') {
      // Tamil Only (Larger typography)
      currentY = this._renderScriptureText(ctx, {
        text: verseTextTa,
        highlightPhrase: highlightTa || this._detectHighlightTa(verseTextTa),
        fontRegular: '36px "Mukta Malar", "Latha", sans-serif',
        fontBold: 'bold 39px "Mukta Malar", "Latha", sans-serif',
        colorRegular: '#FFFFFF',
        colorHighlight: '#F8D775',
        maxWidth: 820,
        startY: 320,
        lineHeight: 56,
        isEnglish: false
      });

      currentY += 42;
      this._renderReference(ctx, referenceTa, width / 2, currentY);

    } else {
      // English Only
      currentY = this._renderScriptureText(ctx, {
        text: verseTextEn,
        highlightPhrase: highlightEn || this._detectHighlightEn(verseTextEn),
        fontRegular: '36px "Lora", Georgia, serif',
        fontBold: 'bold 38px "Cinzel", "Playfair Display", Georgia, serif',
        colorRegular: '#FFFFFF',
        colorHighlight: '#F8D775',
        maxWidth: 820,
        startY: 320,
        lineHeight: 56,
        isEnglish: true
      });

      currentY += 42;
      this._renderReference(ctx, referenceEn.toUpperCase(), width / 2, currentY);
    }

    return canvas.toBuffer('image/jpeg');
  }

  /**
   * Scales image to cover canvas exactly
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
   * Applies subtle atmospheric gradient:
   * Dark in upper 55% for crisp typography, transparent in lower 45% to reveal the scenery
   */
  _applyCinematicTopOverlay(ctx, width, height) {
    ctx.save();

    // Deep royal navy blue atmosphere tint
    const tintGrad = ctx.createLinearGradient(0, 0, width, height);
    tintGrad.addColorStop(0, 'rgba(8, 14, 28, 0.42)');
    tintGrad.addColorStop(0.5, 'rgba(12, 18, 38, 0.28)');
    tintGrad.addColorStop(1, 'rgba(6, 8, 16, 0.35)');
    ctx.fillStyle = tintGrad;
    ctx.fillRect(0, 0, width, height);

    // Soft dark gradient focused on the upper half for crisp text contrast
    const topGrad = ctx.createLinearGradient(0, 0, 0, height * 0.72);
    topGrad.addColorStop(0, 'rgba(4, 8, 18, 0.90)');
    topGrad.addColorStop(0.35, 'rgba(6, 12, 26, 0.78)');
    topGrad.addColorStop(0.65, 'rgba(8, 14, 28, 0.50)');
    topGrad.addColorStop(0.88, 'rgba(0, 0, 0, 0.15)');
    topGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, width, height * 0.75);

    // Subtle radial spotlight behind center text
    const centerGlow = ctx.createRadialGradient(
      width / 2, 420, 50,
      width / 2, 420, 500
    );
    centerGlow.addColorStop(0, 'rgba(0, 0, 0, 0.32)');
    centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = centerGlow;
    ctx.fillRect(0, 0, width, height * 0.7);

    ctx.restore();
  }

  /**
   * Delicate floating golden light particles (divine bokeh)
   */
  _renderDivineGoldenParticles(ctx, width, height) {
    ctx.save();
    for (let i = 0; i < 50; i++) {
      const x = ((Math.sin(i * 123.45) * 0.5 + 0.5) * (width - 120)) + 60;
      const y = ((Math.cos(i * 87.65) * 0.5 + 0.5) * (height - 180)) + 80;
      const radius = (i % 4 === 0) ? 2.5 : (i % 2 === 0) ? 1.6 : 1.0;
      const alpha = (i % 3 === 0) ? 0.65 : 0.38;

      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius * 3.5);
      grad.addColorStop(0, `rgba(255, 238, 175, ${alpha})`);
      grad.addColorStop(0.5, `rgba(248, 215, 117, ${alpha * 0.45})`);
      grad.addColorStop(1, 'rgba(248, 215, 117, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius * 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Header: — HOLY BIBLE VERSE — in Gold Cinzel with flanking lines
   */
  _renderHeader(ctx, width, y) {
    ctx.save();

    const text = 'HOLY BIBLE VERSE';
    ctx.font = 'bold 36px "Cinzel", "Playfair Display", Georgia, serif';
    ctx.fillStyle = '#F8D775';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Soft gold glow + shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 2;

    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const spacing = 35;
    const lineWidth = 130;

    // Center Text
    ctx.fillText(text, width / 2, y);

    // Left Flanking Gold Line
    ctx.strokeStyle = '#E5B842';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = 'rgba(249, 211, 113, 0.4)';
    ctx.shadowBlur = 8;

    const leftEndX = (width / 2) - (textWidth / 2) - spacing;
    const leftStartX = leftEndX - lineWidth;
    ctx.beginPath();
    ctx.moveTo(leftStartX, y);
    ctx.lineTo(leftEndX, y);
    ctx.stroke();

    // Right Flanking Gold Line
    const rightStartX = (width / 2) + (textWidth / 2) + spacing;
    const rightEndX = rightStartX + lineWidth;
    ctx.beginPath();
    ctx.moveTo(rightStartX, y);
    ctx.lineTo(rightEndX, y);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Ornate Center Divider: ─── ❖ ───
   */
  _renderOrnateDivider(ctx, centerX, y) {
    ctx.save();

    const lineWidth = 140;
    const gap = 24;

    ctx.strokeStyle = '#E5B842';
    ctx.lineWidth = 1.2;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 8;

    // Left Line
    ctx.beginPath();
    ctx.moveTo(centerX - gap - lineWidth, y);
    ctx.lineTo(centerX - gap, y);
    ctx.stroke();

    // Right Line
    ctx.beginPath();
    ctx.moveTo(centerX + gap, y);
    ctx.lineTo(centerX + gap + lineWidth, y);
    ctx.stroke();

    // Central Ornate Emblem (Floriated Diamond / Cross)
    ctx.fillStyle = '#F8D775';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '22px serif';
    ctx.shadowColor = 'rgba(249, 211, 113, 0.6)';
    ctx.shadowBlur = 10;
    ctx.fillText('❖', centerX, y);

    ctx.restore();
  }

  /**
   * Reference Line: 1 KINGS 8:15  |  1 இராஜாக்கள் 8:15
   */
  _renderReference(ctx, refString, centerX, y) {
    ctx.save();

    // Prioritize Mukta Malar so Tamil Unicode characters never render as tofu boxes [][][][]
    ctx.font = 'bold 21px "Mukta Malar", "Cinzel", "Playfair Display", Georgia, sans-serif';
    ctx.fillStyle = '#E5C068';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 2;

    ctx.fillText(refString, centerX, y);
    ctx.restore();
  }

  /**
   * Illuminated Open Holy Bible Filler Graphic
   * Beautifully bridges the gap below the verse and above the temple/city scenery
   */
  _renderHolyBibleFiller(ctx, centerX, y) {
    ctx.save();

    // Radiant celestial aura
    const glow = ctx.createRadialGradient(centerX, y, 5, centerX, y, 95);
    glow.addColorStop(0, 'rgba(255, 235, 160, 0.38)');
    glow.addColorStop(0.4, 'rgba(248, 215, 117, 0.18)');
    glow.addColorStop(1, 'rgba(248, 215, 117, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(centerX, y, 95, 0, Math.PI * 2);
    ctx.fill();

    const w = 72; // half-width of open Bible
    const h = 42; // height

    ctx.fillStyle = 'rgba(255, 252, 242, 0.95)';
    ctx.strokeStyle = '#D4A737';
    ctx.lineWidth = 1.8;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 12;

    // Left Page (curved open page)
    ctx.beginPath();
    ctx.moveTo(centerX, y + h * 0.65);
    ctx.quadraticCurveTo(centerX - w * 0.5, y + h * 0.88, centerX - w, y + h * 0.55);
    ctx.lineTo(centerX - w, y - h * 0.55);
    ctx.quadraticCurveTo(centerX - w * 0.5, y - h * 0.28, centerX, y - h * 0.48);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right Page (curved open page)
    ctx.beginPath();
    ctx.moveTo(centerX, y + h * 0.65);
    ctx.quadraticCurveTo(centerX + w * 0.5, y + h * 0.88, centerX + w, y + h * 0.55);
    ctx.lineTo(centerX + w, y - h * 0.55);
    ctx.quadraticCurveTo(centerX + w * 0.5, y - h * 0.28, centerX, y - h * 0.48);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Faint golden scripture lines on both pages
    ctx.strokeStyle = 'rgba(212, 167, 55, 0.55)';
    ctx.lineWidth = 1.2;
    for (let i = -2; i <= 2; i++) {
      const lineY = y + i * 6.5;
      // Left lines
      ctx.beginPath();
      ctx.moveTo(centerX - w + 14, lineY);
      ctx.lineTo(centerX - 12, lineY + 2);
      ctx.stroke();

      // Right lines
      ctx.beginPath();
      ctx.moveTo(centerX + 12, lineY + 2);
      ctx.lineTo(centerX + w - 14, lineY);
      ctx.stroke();
    }

    // Ribbon marker (draped down center)
    ctx.strokeStyle = '#B82626';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX, y - h * 0.48);
    ctx.quadraticCurveTo(centerX + 4, y + h * 0.35, centerX + 2, y + h * 0.95);
    ctx.stroke();

    // Radiant golden cross above the open Bible
    ctx.fillStyle = '#F8D775';
    ctx.shadowColor = 'rgba(249, 215, 117, 0.85)';
    ctx.shadowBlur = 14;
    const crossY = y - h * 0.5 - 18;
    // vertical beam
    ctx.fillRect(centerX - 2, crossY - 14, 4, 20);
    // horizontal beam
    ctx.fillRect(centerX - 9, crossY - 9, 18, 4);

    ctx.restore();
  }

  /**
   * Renders scripture lines, centering them and applying BOLD GOLD highlight to sacred phrases
   */
  _renderScriptureText(ctx, {
    text,
    highlightPhrase,
    fontRegular,
    fontBold,
    colorRegular,
    colorHighlight,
    maxWidth,
    startY,
    lineHeight,
    isEnglish
  }) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 2;

    const formatted = `“${text.trim()}”`;
    const cleanHighlight = highlightPhrase ? highlightPhrase.trim() : '';

    // Wrap into lines
    ctx.font = fontRegular;
    const lines = this._wrapText(ctx, formatted, maxWidth);

    let currentY = startY;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if this line contains the highlight phrase or sacred keywords
      const isHighlighted = cleanHighlight && (
        line.toLowerCase().includes(cleanHighlight.toLowerCase()) ||
        cleanHighlight.toLowerCase().includes(line.toLowerCase().replace(/[“”,;.]/g, '').trim())
      ) || (isEnglish && this._isSacredLineEn(line)) || (!isEnglish && this._isSacredLineTa(line));

      if (isHighlighted) {
        ctx.font = fontBold;
        ctx.fillStyle = colorHighlight;
        // Text in highlight line in English is often rendered upper-case for emphasis like sample
        const displayText = (isEnglish && isHighlighted) ? line.toUpperCase() : line;
        ctx.fillText(displayText, 540, currentY);
      } else {
        ctx.font = fontRegular;
        ctx.fillStyle = colorRegular;
        ctx.fillText(line, 540, currentY);
      }

      currentY += lineHeight;
    }

    ctx.restore();
    return currentY;
  }

  _isSacredLineEn(line) {
    return /\b(LORD GOD|LORD|BLESSED BE THE LORD|JESUS|GOD OF ISRAEL)\b/i.test(line);
  }

  _isSacredLineTa(line) {
    return /(கர்த்தருக்கு ஸ்தோத்திரம்|தேவனாகிய கர்த்தர்|இயேசு கிறிஸ்து|தேவன்)/.test(line);
  }

  _detectHighlightEn(text) {
    const match = text.match(/\b(Blessed be the LORD God of Israel|Blessed be the LORD|The LORD is my shepherd|For God so loved the world|I can do all things through Christ|Trust in the LORD with all thine heart)\b/i);
    return match ? match[0] : 'Blessed be the LORD God of Israel';
  }

  _detectHighlightTa(text) {
    const match = text.match(/(இஸ்ரவேலின் தேவனாகிய கர்த்தருக்கு ஸ்தோத்திரம்|கர்த்தருக்கு ஸ்தோத்திரம்|கர்த்தர் என் மேய்ப்பராயிருக்கிறார்|தேவன் உலகத்தில் அன்புகூர்ந்தார்)/);
    return match ? match[0] : 'கர்த்தருக்கு ஸ்தோத்திரம்';
  }

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
