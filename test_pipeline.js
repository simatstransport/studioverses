const dbService = require('./services/dbService');
const geminiService = require('./services/geminiService');
const imageService = require('./services/imageService');
const posterEngine = require('./services/posterEngine');
const fs = require('fs');

async function testMasterPromptPipeline() {
  console.log('--- Testing 1 Kings 8:15 with Master Prompt ---');

  const verse = await dbService.getVerse('1 Kings 8:15');
  console.log('✓ Scripture Loaded:', verse.referenceEn, '|', verse.referenceTa);

  const ai = await geminiService.analyzeVerse(verse, 'both');
  console.log('\n--- EXACT MASTER PROMPT GENERATED ---');
  console.log(ai.masterPrompt);
  console.log('-------------------------------------\n');

  console.log('✓ Highlight EN:', ai.highlightEn);
  console.log('✓ Highlight TA:', ai.highlightTa);

  // Background artwork
  const bg = await imageService.generateBackground(ai.imagePrompt, verse.referenceEn);

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
  console.log('✓ Masterpiece poster successfully saved to public/generated/test_verified.jpg');
}

testMasterPromptPipeline().catch(console.error);
