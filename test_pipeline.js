const dbService = require('./services/dbService');
const geminiService = require('./services/geminiService');
const imageService = require('./services/imageService');
const posterEngine = require('./services/posterEngine');
const fs = require('fs');

async function testPipeline() {
  console.log('--- Testing New Premium Reference Layout ---');

  // 1. Fetch Verse
  const verse = await dbService.getVerse('1 Kings 8:15');
  console.log('✓ Verse loaded:', verse.referenceEn, '|', verse.referenceTa);

  // 2. Gemini Analysis
  const ai = await geminiService.analyzeVerse(verse, 'both');
  console.log('✓ Scene prompt:', ai.imagePrompt.slice(0, 80) + '...');
  console.log('✓ Highlight EN:', ai.highlightEn);
  console.log('✓ Highlight TA:', ai.highlightTa);

  // 3. Generate Scene Artwork
  const bg = await imageService.generateBackground(ai.imagePrompt, verse.referenceEn);
  console.log('✓ Generated artwork bytes:', bg.length);

  // 4. Render Poster
  const poster = await posterEngine.renderPoster({
    backgroundImage: bg,
    referenceEn: verse.referenceEn,
    referenceTa: verse.referenceTa,
    verseTextEn: verse.textEn,
    verseTextTa: verse.textTa,
    highlightEn: ai.highlightEn,
    highlightTa: ai.highlightTa,
    language: 'both'
  });

  fs.mkdirSync('public/generated', { recursive: true });
  fs.writeFileSync('public/generated/test_verified.jpg', poster);
  console.log('✓ Rendered 1080x1350 poster saved to public/generated/test_verified.jpg');
  console.log('✓ Poster size:', (poster.length / 1024).toFixed(1), 'KB');
}

testPipeline().catch(console.error);
