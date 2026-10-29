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
   * Builds the exact Master Prompt template requested by the user
   */
  buildMasterPrompt(verseData, highlightEn, highlightTa, locationTheme) {
    const theme = locationTheme || this._inferBiblicalLocation(verseData);
    const hlEn = highlightEn || this._detectHighlightEn(verseData.textEn);
    const hlTa = highlightTa || this._detectHighlightTa(verseData.textTa);

    return `Create a premium, ultra-realistic Christian Bible verse poster featuring ${verseData.referenceEn} in both English and Tamil, beautifully arranged in a single image with a majestic spiritual background.

📖 ENGLISH BIBLE VERSE — KJV
“${verseData.textEn}”

📖 தமிழ் வேதாகம வசனம்
“${verseData.textTa}”

Reference: ${verseData.referenceEn} | ${verseData.referenceTa}

BACKGROUND AND SPIRITUAL ATMOSPHERE
Create a breathtaking ancient biblical landscape inspired by ${theme}. Show majestic temple architecture or sacred landscape in the distance, heavenly golden rays breaking through dramatic dark navy clouds, warm divine light illuminating the sanctuary, subtle floating golden particles, distant mountains, and a peaceful sacred atmosphere representing God’s faithfulness and fulfilled promises.

Use a cinematic combination of deep navy blue, royal blue, antique gold, and warm ivory. Make the scene photorealistic, reverent, majestic, and spiritually uplifting, with realistic volumetric lighting and extraordinary atmospheric depth.

TEXT LAYOUT — EXTREMELY IMPORTANT
* Place the heading “HOLY BIBLE VERSE” at the top in elegant gold serif lettering.
* Display the complete English verse in the upper-middle section using clear, elegant ivory-white serif typography.
* Add a thin decorative golden divider.
* Display the complete Tamil verse beneath the English verse using a beautiful, highly readable Tamil font that correctly supports Tamil characters.
* Keep both languages equally important, balanced, and readable.
* Highlight “${hlEn}” and “${hlTa}” in subtle golden lettering.
* At the bottom, display: “${verseData.referenceEn} | ${verseData.referenceTa}”.
* Maintain generous spacing, elegant alignment, and strong contrast between the text and background.
* Keep the temple/scenery visible in the lower half without interfering with the verse text.

QUALITY REQUIREMENTS
Vertical 4:5 Instagram poster, ultra-realistic 8K-style visual quality, cinematic lighting, premium Christian devotional design, professional typography, clean composition, and high readability on mobile screens.

CRITICAL TEXT ACCURACY: Preserve both supplied Bible verses exactly as written. Do not translate them again, paraphrase them, omit words, mix Tamil and English letters, or generate incorrect Tamil characters. Do not add extra verses, logos, watermarks, or unrelated text.`;
  }

  /**
   * Analyzes verse and produces the master prompt, image prompt, and caption
   */
  async analyzeVerse(verseData, language = 'both') {
    const scriptureText = language === 'ta'
      ? verseData.textTa
      : language === 'en'
        ? verseData.textEn
        : `${verseData.textEn}\n\n${verseData.textTa}`;

    const defaultHighlightEn = this._detectHighlightEn(verseData.textEn);
    const defaultHighlightTa = this._detectHighlightTa(verseData.textTa);
    const locationTheme = this._inferBiblicalLocation(verseData);

    let highlightEn = defaultHighlightEn;
    let highlightTa = defaultHighlightTa;
    let captionText = this._createDefaultCaption(verseData);
    let trendingHashtags = this._createDefaultHashtags(verseData);
    let specificScenePrompt = `A breathtaking ancient biblical landscape inspired by ${locationTheme}. Lower 45% shows majestic temple architecture and ancient stone terrace in Jerusalem, warm divine light illuminating stone columns, subtle floating golden particles, distant mountains. Upper 55% shows dramatic dark navy blue and royal blue volumetric clouds with heavenly golden sun rays breaking through from the upper right, leaving clean negative space for typography. Cinematic deep navy blue, royal blue, antique gold, and warm ivory palette. Photorealistic 8k, reverent, majestic, vertical 4:5 portrait.`;

    if (this.apiKey) {
      const systemPrompt = `You are an elite Christian creative director and biblical illustrator.
Given a Bible verse, generate a strict JSON object with:
1. "locationTheme": Specific biblical location/theme for this verse (e.g. "Solomon’s Temple in Jerusalem", "Shepherd pastures of Judea", "Mount Calvary at dawn", "Sea of Galilee").
2. "highlightEn": Sacred phrase in English to highlight in Gold (e.g. "BLESSED BE THE LORD GOD OF ISRAEL").
3. "highlightTa": Corresponding sacred phrase in Tamil to highlight in Gold (e.g. "இஸ்ரவேலின் தேவனாகிய கர்த்தருக்கு ஸ்தோத்திரம்").
4. "scenePrompt": 8K text-to-image prompt for the background (lower 45% biblical architecture/landscape, upper 55% dramatic dark navy blue volumetric clouds with golden god rays, deep navy, royal blue, antique gold, warm ivory).
5. "caption": Inspirational devotional takeaway and prayer.
6. "trendingHashtags": 15-20 top trending Christian hashtags for Instagram.

Return ONLY raw JSON, without markdown.`;

      const userPrompt = `Verse Reference: ${verseData.referenceEn} | ${verseData.referenceTa}
English: "${verseData.textEn}"
Tamil: "${verseData.textTa}"`;

      try {
        const raw = await this._callRestApi(systemPrompt, userPrompt);
        const cleanJson = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);

        if (parsed.highlightEn) highlightEn = parsed.highlightEn;
        if (parsed.highlightTa) highlightTa = parsed.highlightTa;
        if (parsed.scenePrompt) specificScenePrompt = parsed.scenePrompt;
        if (parsed.caption) captionText = parsed.caption;
        if (parsed.trendingHashtags) {
          trendingHashtags = Array.isArray(parsed.trendingHashtags)
            ? parsed.trendingHashtags.join(' ')
            : String(parsed.trendingHashtags);
        }
      } catch (err) {
        console.warn('[GeminiService] AI API call warning, using built-in master template:', err.message);
      }
    }

    const masterPrompt = this.buildMasterPrompt(verseData, highlightEn, highlightTa, locationTheme);
    const fullCaption = `${captionText}\n\n• • •\n${trendingHashtags}`;

    return {
      masterPrompt: masterPrompt,
      imagePrompt: specificScenePrompt,
      highlightEn: highlightEn,
      highlightTa: highlightTa,
      referenceEn: verseData.referenceEn,
      referenceTa: verseData.referenceTa,
      captionText: captionText,
      trendingHashtags: trendingHashtags,
      fullInstagramCaption: fullCaption,
      language
    };
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

  _inferBiblicalLocation(verseData) {
    const text = (verseData.textEn || '').toLowerCase();
    const ref = (verseData.referenceEn || '').toLowerCase();

    if (ref.includes('1 kings') || ref.includes('2 kings') || ref.includes('chronicles') || text.includes('temple') || text.includes('solomon') || text.includes('david')) {
      return "Solomon’s Temple in Jerusalem with ancient stone terraces, royal stone balcony, and distant hills of Zion";
    }
    if (ref.includes('psalm 23') || text.includes('shepherd') || text.includes('green pastures') || text.includes('still waters')) {
      return "lush green rolling pastures of Judea at morning sunrise with gentle still waters";
    }
    if (ref.includes('john 3') || text.includes('cross') || text.includes('calvary') || text.includes('love') || text.includes('salvation')) {
      return "Mount Calvary at dawn with ethereal celestial radiant golden cross and misty valleys";
    }
    if (ref.includes('mark 4') || ref.includes('matthew 8') || text.includes('sea') || text.includes('storm') || text.includes('calm')) {
      return "Sea of Galilee with dramatic crashing waves parting around a wooden boat in celestial light";
    }
    if (ref.includes('isaiah 40') || text.includes('eagle') || text.includes('wings') || text.includes('mountains')) {
      return "majestic mountain summits of Israel with golden eagles soaring above clouds";
    }
    return "Solomon’s Temple in Jerusalem with sacred architecture, ancient stone balustrades, and heavenly rays";
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
    const highlightEn = this._detectHighlightEn(verseData.textEn);
    const highlightTa = this._detectHighlightTa(verseData.textTa);
    const locationTheme = this._inferBiblicalLocation(verseData);
    const masterPrompt = this.buildMasterPrompt(verseData, highlightEn, highlightTa, locationTheme);

    const scenePrompt = `A breathtaking ancient biblical landscape inspired by ${locationTheme}. Lower 45% shows majestic temple architecture in the distance, warm divine light illuminating the sanctuary, subtle floating golden particles, distant mountains. Upper 55% shows dramatic dark navy blue and royal blue volumetric clouds with heavenly golden sun rays breaking through from the upper right, leaving clean negative space for typography. Cinematic deep navy blue, royal blue, antique gold, and warm ivory palette. Photorealistic 8k, reverent, majestic, vertical 4:5 portrait.`;

    return {
      masterPrompt: masterPrompt,
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
