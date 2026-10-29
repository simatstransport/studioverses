const axios = require('axios');
const config = require('../config');

class GeminiService {
  constructor() {
    this.apiKey = config.geminiApiKey;
  }

  setApiKey(key) {
    this.apiKey = key;
  }

  /**
   * Generates custom verse-matched scene prompt matching user's exact masterclass specification
   */
  async analyzeVerse(verseData, language = 'both') {
    const scriptureText = language === 'ta'
      ? verseData.textTa
      : language === 'en'
        ? verseData.textEn
        : `${verseData.textEn}\n\n${verseData.textTa}`;

    const reference = language === 'ta'
      ? verseData.referenceTa
      : `${verseData.referenceEn.toUpperCase()} | ${verseData.referenceTa}`;

    // If no API key is provided, return intelligent contextual fallback
    if (!this.apiKey) {
      console.warn('[GeminiService] No GEMINI_API_KEY found. Generating smart default metadata.');
      return this._generateFallbackResponse(verseData, language);
    }

    const systemPrompt = `You are an elite Christian creative director, theological scholar, and master biblical illustrator.
Given a Bible verse, carefully study its exact historical context, spiritual meaning, and divine theme.

Generate a strict JSON response following this EXACT MASTERCLASS ARCHITECTURE:

1. "imagePrompt": A highly detailed, photorealistic 8K text-to-image prompt (4:5 vertical aspect ratio).
   MUST FOLLOW THESE STRICT CINEMATIC RULES:
   - "BACKGROUND AND SPIRITUAL ATMOSPHERE: Create a breathtaking ancient biblical landscape inspired by [specific historical biblical location matching the verse - e.g. Solomon's Temple in Jerusalem, Mount Sinai, green pastures of Bethlehem, Sea of Galilee at sunrise, Garden of Gethsemane, ancient Roman road, celestial new Jerusalem]."
   - "LOWER 45%: Show majestic biblical architecture or landscape in the distance, warm divine light illuminating the stone sanctuaries or peaceful waters, subtle floating golden light particles, distant misty mountains, and a peaceful sacred atmosphere representing God's faithfulness."
   - "UPPER 55%: Deep dramatic dark navy blue and royal blue volumetric clouds with heavenly golden rays breaking through from the upper right, leaving deep dark clean negative space for scripture typography."
   - "COLOR PALETTE: Cinematic combination of deep navy blue, royal blue, antique gold, and warm ivory. Photorealistic, reverent, majestic, spiritually uplifting, realistic volumetric lighting, extraordinary atmospheric depth."

2. "highlightEn": The exact sacred phrase in the English verse to highlight in subtle golden lettering (e.g., "BLESSED BE THE LORD GOD OF ISRAEL", "THE LORD IS MY SHEPHERD", "FOR GOD SO LOVED THE WORLD", "I CAN DO ALL THINGS THROUGH CHRIST").

3. "highlightTa": The corresponding exact sacred phrase in the Tamil verse to highlight in subtle golden lettering (e.g., "இஸ்ரவேலின் தேவனாகிய கர்த்தருக்கு ஸ்தோத்திரம்", "கர்த்தர் என் மேய்ப்பராயிருக்கிறார்", "தேவன் உலகத்தில் அன்புகூர்ந்தார்").

4. "caption": An inspirational devotional takeaway connecting this verse to daily life, a reflection on God's promises, and a short heartfelt prayer.

5. "trendingHashtags": A list of 15-20 top trending Christian hashtags for Instagram.

Return ONLY the raw JSON object, without markdown code fences or explanation.`;

    const userPrompt = `Verse Reference: ${verseData.referenceEn} | ${verseData.referenceTa}
English Text: "${verseData.textEn}"
Tamil Text: "${verseData.textTa}"
Selected Language: ${language}`;

    try {
      const rawText = await this._callRestApi(systemPrompt, userPrompt);
      const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      let tags = parsed.trendingHashtags || this._createDefaultHashtags(verseData);
      const hashtagsString = Array.isArray(tags) ? tags.join(' ') : String(tags);

      const fullCaption = `${parsed.caption || this._createDefaultCaption(verseData)}\n\n` +
        `• • •\n` +
        `${hashtagsString}`;

      return {
        imagePrompt: parsed.imagePrompt || this._generateScenePromptForVerse(verseData),
        highlightEn: parsed.highlightEn || this._detectHighlightEn(verseData.textEn),
        highlightTa: parsed.highlightTa || this._detectHighlightTa(verseData.textTa),
        referenceEn: verseData.referenceEn,
        referenceTa: verseData.referenceTa,
        captionText: parsed.caption || this._createDefaultCaption(verseData),
        trendingHashtags: hashtagsString,
        fullInstagramCaption: fullCaption,
        language
      };
    } catch (err) {
      console.warn('[GeminiService] Error calling Gemini API, using robust fallback:', err.message);
      return this._generateFallbackResponse(verseData, language);
    }
  }

  async _callRestApi(systemPrompt, userPrompt) {
    const modelsToTry = [
      'gemini-flash-lite-latest',
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
      'gemini-flash-latest'
    ];
    let lastErr = null;

    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
        const payload = {
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.7
          }
        };

        const res = await axios.post(url, payload, { timeout: 20000 });
        if (res.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          return res.data.candidates[0].content.parts[0].text;
        }
      } catch (err) {
        lastErr = err;
        continue;
      }
    }
    throw lastErr || new Error('All Gemini model endpoints failed.');
  }

  _generateScenePromptForVerse(verseData) {
    const text = verseData.textEn.toLowerCase();
    const ref = verseData.referenceEn.toLowerCase();

    let theme = "ancient biblical landscape inspired by Solomon's Temple in Jerusalem";
    let lowerSubject = "majestic ancient stone temple architecture in the distance, warm divine light illuminating the sanctuary, stone balcony foreground with royal golden crown on blue velvet";

    if (/shepherd|pasture|waters|green/i.test(text) || ref.includes('psalm 23')) {
      theme = "lush green rolling pastures of Judea at morning sunrise";
      lowerSubject = "peaceful crystal still waters reflecting golden sky, ancient wooden shepherd staff on a stone, soft rolling hills";
    } else if (/storm|sea|wind|wave|calm|boat/i.test(text) || ref.includes('mark 4') || ref.includes('matt 8')) {
      theme = "dramatic Sea of Galilee with waves parting in divine peace";
      lowerSubject = "ancient wooden fishing boat resting on calming water bathed in a direct shaft of celestial light, distant misty shores";
    } else if (/cross|love|give|son|life|salvation/i.test(text) || ref.includes('john 3')) {
      theme = "sacred Mount Calvary at dawn of redemption";
      lowerSubject = "majestic glowing celestial cross atop a distant hill, ethereal golden light illuminating the valley below";
    } else if (/eagle|strength|mount|wings/i.test(text) || ref.includes('isaiah 40')) {
      theme = "majestic mountain summits of Israel with eagles soaring";
      lowerSubject = "towering ancient cedar trees, soaring golden eagle above mountain peaks, glorious morning mist";
    } else if (/lion|den|faith/i.test(text) || ref.includes('daniel')) {
      theme = "ancient stone hall of Babylon illuminated by heavenly light";
      lowerSubject = "peaceful majestic lions resting in an ancient stone cavern, bathed in holy divine beam";
    }

    return `Create a breathtaking ancient biblical landscape inspired by ${theme}. Show ${lowerSubject} in the lower 45%. Upper 55% shows dramatic dark navy blue and royal blue volumetric clouds with heavenly golden sun rays breaking through, subtle floating golden particles, distant mountains, and a peaceful sacred atmosphere representing God's faithfulness and fulfilled promises. Use a cinematic combination of deep navy blue, royal blue, antique gold, and warm ivory. Photorealistic, reverent, majestic, 8k resolution, vertical 4:5 portrait.`;
  }

  _detectHighlightEn(text) {
    const match = text.match(/\b(BLESSED BE THE LORD GOD OF ISRAEL|Blessed be the LORD God of Israel|Blessed be the LORD|The LORD is my shepherd|For God so loved the world|I can do all things through Christ|Trust in the LORD with all thine heart|Thy word is a lamp unto my feet|Be strong and of a good courage)\b/i);
    return match ? match[0].toUpperCase() : 'BLESSED BE THE LORD GOD OF ISRAEL';
  }

  _detectHighlightTa(text) {
    const match = text.match(/(இஸ்ரவேலின் தேவனாகிய கர்த்தருக்கு ஸ்தோத்திரம்|கர்த்தருக்கு ஸ்தோத்திரம்|கர்த்தர் என் மேய்ப்பராயிருக்கிறார்|தேவன் உலகத்தில் அன்புகூர்ந்தார்|தேவன் நமக்கு அடைக்கலமும் பலனுமானவர்)/);
    return match ? match[0] : 'இஸ்ரவேலின் தேவனாகிய கர்த்தருக்கு ஸ்தோத்திரம்';
  }

  _createDefaultCaption(verseData) {
    return `✨ "And he said, Blessed be the LORD God of Israel, which spake with his mouth unto David my father, and hath with his hand fulfilled it, saying," — ${verseData.referenceEn}\n\n` +
      `🙏 ${verseData.textTa} — ${verseData.referenceTa}\n\n` +
      `🌿 Reflection:\n` +
      `What God has spoken over your life with His mouth, He has the sovereign power to fulfill with His mighty hand. Even when circumstances seem impossible, remember that His covenant never fails. Stand firm in faith today!\n\n` +
      `🙏 Daily Prayer:\n` +
      `Heavenly Father, thank You for Your faithfulness from generation to generation. Fulfill Your promises in our lives according to Your perfect will. In Jesus' name, Amen.`;
  }

  _createDefaultHashtags(verseData) {
    return `#DailyBibleVerse #BibleVerseOfTheDay #ScriptureOfTheDay #WordOfGod #DailyDevotional #FaithOverFear #GodsPromises #ChristianInspiration #JesusChrist #GraceUponGrace #GoodNews #Gospel #KJV #TamilChristian #TamilBible #TamilBibleVerse #TamilDevotional #ChristianReels #ChristianQuotes #FaithInGod #HopeInChrist`;
  }

  _generateFallbackResponse(verseData, language) {
    const scenePrompt = this._generateScenePromptForVerse(verseData);
    const highlightEn = this._detectHighlightEn(verseData.textEn);
    const highlightTa = this._detectHighlightTa(verseData.textTa);

    return {
      imagePrompt: scenePrompt,
      highlightEn: highlightEn,
      highlightTa: highlightTa,
      referenceEn: verseData.referenceEn,
      referenceTa: verseData.referenceTa,
      captionText: this._createDefaultCaption(verseData),
      trendingHashtags: this._createDefaultHashtags(verseData),
      fullInstagramCaption: `${this._createDefaultCaption(verseData)}\n\n• • •\n${this._createDefaultHashtags(verseData)}`,
      language
    };
  }
}

module.exports = new GeminiService();
