const dbService = require('./services/dbService');
const geminiService = require('./services/geminiService');
const imageService = require('./services/imageService');
const posterEngine = require('./services/posterEngine');
const cronService = require('./services/cronService');
const fs = require('fs');

async function testPipeline() {
  console.log('--- Starting Full Pipeline Verification ---');

  // Test 1: SQLite Databases
  console.log('\n[1/4] Testing SQLite Database Service...');
  const v1 = await dbService.getVerse('1 Kings 8:15');
  console.log('✓ Found 1 Kings 8:15:');
  console.log('  KJV:', v1.textEn.slice(0, 70) + '...');
  console.log('  Tamil:', v1.textTa.slice(0, 70) + '...');

  // Test 2: Gemini Service
  console.log('\n[2/4] Testing Gemini Service Prompt Engineering...');
  const ai = await geminiService.analyzeVerse(v1, 'both');
  console.log('✓ Hook:', ai.shortHook);
  console.log('✓ Prompt:', ai.imagePrompt.slice(0, 90) + '...');
  console.log('✓ Reference:', ai.reference);

  // Test 3: Background Image Generation
  console.log('\n[3/4] Testing Image Generation...');
  const bg = await imageService.generateBackground(ai.imagePrompt, v1.referenceEn);
  console.log('✓ Background generated, bytes:', bg.length);

  // Test 4: Canvas Compositing (1080x1350)
  console.log('\n[4/4] Testing Canvas Compositing Engine...');
  const posterBuffer = await posterEngine.renderPoster({
    backgroundImage: bg,
    shortHook: ai.shortHook,
    reference: ai.reference,
    verseTextEn: v1.textEn,
    verseTextTa: v1.textTa,
    language: 'both'
  });
  console.log('✓ Poster rendered, bytes:', posterBuffer.length);

  fs.mkdirSync('public/generated', { recursive: true });
  fs.writeFileSync('public/generated/test_verified.jpg', posterBuffer);
  console.log('✓ Saved to public/generated/test_verified.jpg');

  console.log('\n=================================================');
  console.log(' ALL VERIFICATION CHECKS PASSED SUCCESSFULLY! ');
  console.log('=================================================');
}

testPipeline().catch(err => {
  console.error('❌ Pipeline Test Failed:', err);
  process.exit(1);
});
