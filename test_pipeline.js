const dbService = require('./services/dbService');
const geminiService = require('./services/geminiService');
const imageService = require('./services/imageService');
const posterEngine = require('./services/posterEngine');
const fs = require('fs');

async function testPsalm73() {
  console.log('--- Testing Psalm 73:2 with Holy Bible Filler & Tamil Font Fix ---');

  const verse = await dbService.getVerse('Psalm 73:2');
  console.log('✓ Verse loaded:', verse.referenceEn, '|', verse.referenceTa);

  const ai = await geminiService.analyzeVerse(verse, 'both');
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
  fs.writeFileSync('public/generated/test_psalm73.jpg', poster);
  console.log('✓ Successfully rendered Psalm 73:2 poster! Saved to public/generated/test_psalm73.jpg');
}

testPsalm73().catch(console.error);
