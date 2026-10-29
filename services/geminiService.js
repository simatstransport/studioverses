const axios = require('axios');
const config = require('../config');

class GeminiService {
  constructor() {
    this.apiKey = config.geminiApiKey;
    this.client = null;
    this._initClient();
  }

  _initClient() {
    if (!this.apiKey) return;
    try {
      const { GoogleGenAI } = require('@google/genai');
      this.client = new GoogleGenAI({ apiKey: this.apiKey });
    } catch (err) {
      console.warn('[GeminiService] SDK init failed, will use direct REST fallback:', err.message);
    }
  }

  setApiKey(key) {
    this.apiKey = key;
    this._initClient();
  }

  /**
   * Generates hook, image prompt, typography instructions and caption from verse
   * @param {Object} verseData - { referenceEn, referenceTa, textEn, textTa, bookNum, chapter, verse }
   * @param {string} language - 'en' | 'ta' | 'both'
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

    const systemPrompt = `You are an elite Christian creative art director and viral social media strategist.
Given a Bible verse, analyze its spiritual emotion, promise, and theological context.
Generate a strict JSON response containing:
1. "shortHook": A short, comforting, emotionally resonant summarizing phrase in English (3 to 7 words, e.g. "Fulfilled By His Mighty Hand", "His Grace Is Always Sufficient", "Peace In The Storm", "Do Not Fear I Am With You").
2. "imagePrompt": A highly detailed text-to-image prompt to generate a 4:5 vertical background artwork.
   IT MUST STRICTLY INCLUDE THESE EXACT WORDS: "Cinematic lighting, golden hour backlight, deep dark moody shadows, highly detailed photorealistic digital art, leaving dark negative space on the right side for text."
   Subject matches verse emotion (e.g., Jesus comforting a person, glowing cross on a mountain at twilight, stormy seas calmed, ancient temple at dusk).
3. "verseText": The exact scripture text.
4. "reference": Capitalized reference (e.g. "${verseData.referenceEn.toUpperCase()}").
5. "caption": A powerful, engaging Instagram caption formatted with emojis, a reflective spiritual takeaway connecting the verse to daily life, a brief prayer, and the scripture text in English and Tamil.
6. "trendingHashtags": A string containing top daily trending Christian hashtags tailored to the verse theme (mix of viral tags, high-reach tags, KJV tags, and Tamil Christian tags, e.g. #DailyBibleVerse #BibleVerseOfTheDay #FaithOverFear #GodsPromises #GraceUponGrace #JesusChrist #KJV #TamilChristian #TamilBibleVerse #ScriptureOfTheDay).

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
        shortHook: parsed.shortHook || this._createDefaultHook(verseData.textEn),
        imagePrompt: parsed.imagePrompt,
        verseText: scriptureText,
        reference: parsed.reference || reference,
        captionText: parsed.caption || this._createDefaultCaption(verseData),
        trendingHashtags: parsed.trendingHashtags || this._createDefaultHashtags(verseData),
        fullInstagramCaption: fullCaption,
        emotion: parsed.emotion || 'Hope & Comfort',
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

  _createDefaultHook(textEn) {
    if (/bless|fulfilled|god of israel/i.test(textEn)) return 'Fulfilled By His Mighty Hand';
    if (/love|charity/i.test(textEn)) return 'Unfailing Love Everlasting';
    if (/peace|comfort|rest/i.test(textEn)) return 'Peace That Surpasses All';
    if (/fear|afraid|strength/i.test(textEn)) return 'Do Not Fear, I Am With You';
    if (/pray|confess|heal/i.test(textEn)) return 'The Power of Fervent Prayer';
    if (/light|shine/i.test(textEn)) return 'A Light In The Darkness';
    return 'His Grace Is Always Sufficient';
  }

  _createDefaultCaption(verseData) {
    return `✨ "And whatever you ask in faith, believe that you have received it."\n\n` +
      `📖 ${verseData.referenceEn} (KJV)\n` +
      `"${verseData.textEn}"\n\n` +
      `📖 ${verseData.referenceTa} (Tamil)\n` +
      `"${verseData.textTa}"\n\n` +
      `🌿 Reflection:\n` +
      `No matter what challenge you are facing today, remember that God's hand is working behind the scenes. His promises never fail, and His timing is perfect. Hold onto faith, walk with courage, and let His peace guard your heart!\n\n` +
      `🙏 Daily Prayer:\n` +
      `Lord, thank You for Your unfailing faithfulness and grace. Guide our steps today and let Your light shine through us. Amen.`;
  }

  _createDefaultHashtags(verseData) {
    return `#DailyBibleVerse #BibleVerseOfTheDay #ScriptureOfTheDay #WordOfGod #DailyDevotional #FaithOverFear #GodsPromises #ChristianInspiration #JesusChrist #GraceUponGrace #GoodNews #Gospel #KJV #TamilChristian #TamilBible #TamilBibleVerse #TamilDevotional #ChristianReels #ChristianQuotes #FaithInGod #HopeInChrist`;
  }

  _generateFallbackResponse(verseData, language) {
    const scriptureText = language === 'ta'
      ? verseData.textTa
      : language === 'en'
        ? verseData.textEn
        : `${verseData.textEn}\n\n${verseData.textTa}`;

    const hook = this._createDefaultHook(verseData.textEn);
    const ref = language === 'ta' ? verseData.referenceTa : verseData.referenceEn.toUpperCase();
    const caption = this._createDefaultCaption(verseData);
    const hashtags = this._createDefaultHashtags(verseData);

    return {
      shortHook: hook,
      imagePrompt: `Cinematic lighting, golden hour backlight, deep dark moody shadows, highly detailed photorealistic digital art, leaving dark negative space on the right side for text. A serene biblical landscape with heavenly golden rays piercing through dark dramatic storm clouds over peaceful waters, holy ethereal atmosphere, 8k resolution, cinematic 4:5 composition.`,
      verseText: scriptureText,
      reference: ref,
      captionText: caption,
      trendingHashtags: hashtags,
      fullInstagramCaption: `${caption}\n\n• • •\n${hashtags}`,
      emotion: 'Hope & Peace',
      language,
      isFallback: true
    };
  }
}

module.exports = new GeminiService();
