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
   * Generates custom verse-matched scene prompt, sacred highlights, and viral caption
   */
  async analyzeVerse(verseData, language = 'both') {
    const scriptureText = language === 'ta'
      ? verseData.textTa
      : language === 'en'
        ? verseData.textEn
        : `${verseData.textEn}\n\n${verseData.textTa}`;

    const reference = language === 'ta'
      ? verseData.referenceTa
      : verseData.referenceEn.toUpperCase();

    // If no API key is provided, return intelligent contextual fallback
    if (!this.apiKey) {
      console.warn('[GeminiService] No GEMINI_API_KEY found. Generating smart default metadata.');
      return this._generateFallbackResponse(verseData, language);
    }

    const systemPrompt = `You are a world-class Christian creative director and cinematic biblical illustrator.
Given a Bible verse, carefully analyze its historical context, story, imagery, and sacred meaning.
Generate a strict JSON response with:
1. "imagePrompt": A highly detailed, realistic, cinematic 3D digital art prompt (4:5 vertical aspect ratio).
   CRITICAL COMPOSITION RULES:
   - LOWER HALF (bottom 50%): Must contain a breathtaking panoramic physical scene SPECIFIC TO THIS VERSE'S EXACT BIBLICAL THEME.
     Examples:
     * 1 Kings 8:15 -> "Panoramic view of ancient Solomon Temple in Jerusalem at golden hour sunrise, stone balustrade in foreground with a royal golden crown on blue velvet, glowing morning light illuminating stone columns and hills."
     * Psalm 23 -> "Lush green rolling pastures of Judea at morning sunrise, crystal-clear still stream reflecting golden sky, ancient shepherd staff on a stone."
     * Matthew 8 (Peace in storm) -> "Stormy Sea of Galilee with dramatic crashing waves parting around a wooden fishing boat bathed in a supernatural shaft of celestial golden light."
     * John 3:16 / Cross -> "Majestic glowing radiant cross atop Mount Calvary at celestial dawn, rolling misty valleys below, ethereal golden god rays."
     * Genesis 1 -> "Creation of light, dramatic planet earth forming in the cosmos with radiant golden light piercing primordial cosmic mist."
     * Exodus 14 -> "Parted Red Sea towering like crystalline walls of water with the divine pillar of fire guiding the pathway."
   - UPPER HALF (top 50%): Must consist of deep, dark, dramatic volumetric storm clouds with intense golden god rays breaking through, leaving clean negative space for centered typography.
   - STYLE: "Cinematic lighting, god rays from top right, 8k resolution, photorealistic, rich warm golden hour colors, biblical masterpiece."

2. "highlightEn": The key sacred words or divine blessing phrase to highlight in BOLD GOLD (e.g. "BLESSED BE THE LORD GOD OF ISRAEL", "THE LORD IS MY SHEPHERD", "FOR GOD SO LOVED THE WORLD", "I CAN DO ALL THINGS").
3. "highlightTa": The corresponding sacred words or divine blessing phrase in Tamil to highlight in BOLD GOLD (e.g. "இஸ்ரவேலின் தேவனாகிய கர்த்தருக்கு ஸ்தோத்திரம்", "கர்த்தர் என் மேய்ப்பராயிருக்கிறார்", "தேவன் உலகத்தில் அன்புகூர்ந்தார்").
4. "caption": A high-engagement, spiritually uplifting Instagram caption with verse takeaway and daily prayer.
5. "trendingHashtags": 15-20 top trending Christian hashtags for Instagram.

Return ONLY the raw JSON object, without markdown code fences or explanation.`;

    const userPrompt = `Verse Reference: ${verseData.referenceEn} (${verseData.referenceTa})
English Text: "${verseData.textEn}"
Tamil Text: "${verseData.textTa}"
Selected Language for Poster: ${language}`;

    try {
      const rawText = await this._callRestApi(systemPrompt, userPrompt);
      const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      const fullCaption = `${parsed.caption || this._createDefaultCaption(verseData)}\n\n` +
        `• • •\n` +
        `${parsed.trendingHashtags || this._createDefaultHashtags(verseData)}`;

      return {
        imagePrompt: parsed.imagePrompt,
        highlightEn: parsed.highlightEn || this._detectHighlightEn(verseData.textEn),
        highlightTa: parsed.highlightTa || this._detectHighlightTa(verseData.textTa),
        referenceEn: verseData.referenceEn,
        referenceTa: verseData.referenceTa,
        captionText: parsed.caption || this._createDefaultCaption(verseData),
        trendingHashtags: parsed.trendingHashtags || this._createDefaultHashtags(verseData),
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

  _detectHighlightEn(text) {
    const match = text.match(/\b(Blessed be the LORD God of Israel|Blessed be the LORD|The LORD is my shepherd|For God so loved the world|I can do all things through Christ|Trust in the LORD with all thine heart)\b/i);
    return match ? match[0] : 'BLESSED BE THE LORD GOD OF ISRAEL';
  }

  _detectHighlightTa(text) {
    const match = text.match(/(இஸ்ரவேலின் தேவனாகிய கர்த்தருக்கு ஸ்தோத்திரம்|கர்த்தருக்கு ஸ்தோத்திரம்|கர்த்தர் என் மேய்ப்பராயிருக்கிறார்|தேவன் உலகத்தில் அன்புகூர்ந்தார்)/);
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
    const prompt = `Cinematic photo of ancient Solomon Temple in Jerusalem at golden hour sunrise, stone balustrade foreground with royal golden crown on blue velvet cloth, dramatic volumetric clouds in dark sky at top, photorealistic 8k, majestic biblical art`;

    return {
      imagePrompt: prompt,
      highlightEn: this._detectHighlightEn(verseData.textEn),
      highlightTa: this._detectHighlightTa(verseData.textTa),
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
