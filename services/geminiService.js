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
   * Dynamically constructs the Master Prompt for ANY verse (Random or User Selected)
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
Create a breathtaking ancient biblical landscape inspired by ${theme}. Show majestic sacred architecture or landscape in the distance, heavenly golden rays breaking through dramatic dark navy clouds, warm divine light illuminating the sanctuary or waters, subtle floating golden particles, distant mountains, and a peaceful sacred atmosphere representing God’s faithfulness and fulfilled promises.

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
* Keep the scenery visible in the lower half without interfering with the verse text.

QUALITY REQUIREMENTS
Vertical 4:5 Instagram poster, ultra-realistic 8K-style visual quality, cinematic lighting, premium Christian devotional design, professional typography, clean composition, and high readability on mobile screens.

CRITICAL TEXT ACCURACY: Preserve both supplied Bible verses exactly as written. Do not translate them again, paraphrase them, omit words, mix Tamil and English letters, or generate incorrect Tamil characters. Do not add extra verses, logos, watermarks, or unrelated text.`;
  }

  /**
   * Analyzes ANY selected or random verse dynamically and outputs customized metadata
   */
  async analyzeVerse(verseData, language = 'both') {
    const defaultHighlightEn = this._detectHighlightEn(verseData.textEn);
    const defaultHighlightTa = this._detectHighlightTa(verseData.textTa);
    const defaultLocation = this._inferBiblicalLocation(verseData);

    let locationTheme = defaultLocation;
    let highlightEn = defaultHighlightEn;
    let highlightTa = defaultHighlightTa;
    let captionText = this._createDynamicCaption(verseData);
    let trendingHashtags = this._createDefaultHashtags(verseData);
    let specificScenePrompt = this._buildScenePrompt(defaultLocation);

    if (this.apiKey) {
      const systemPrompt = `You are an elite Christian creative director and biblical illustrator.
Given ANY Bible verse from Genesis to Revelation, dynamically analyze its exact context, theological meaning, and visual imagery.

Generate a strict JSON object with:
1. "locationTheme": A specific, breathtaking biblical location matching THIS EXACT VERSE (e.g. "Mount Calvary at dawn of redemption", "Lush green pastures of Judea with still waters", "Sea of Galilee with waves calming in divine peace", "Solomon’s Temple in Jerusalem with stone terraces", "Mount Sinai with celestial fire", "Ancient Roman road through olive groves", "Celestial New Jerusalem with crystal river of life").
2. "highlightEn": The most meaningful sacred words or divine promise in the English verse to highlight in Gold (in UPPERCASE, 3 to 8 words).
3. "highlightTa": The corresponding exact sacred words or divine promise in the Tamil verse to highlight in Gold (3 to 8 words).
4. "scenePrompt": An 8K text-to-image prompt for the background. Lower 45% shows the specific biblical scene with ancient architecture/landscape, warm divine light, subtle floating golden particles. Upper 55% shows dramatic dark navy blue and royal blue volumetric storm clouds with heavenly golden sunburst rays from upper-right, leaving clean negative space for typography.
5. "caption": A personalized devotional reflection connecting THIS SPECIFIC VERSE to daily life, plus a short prayer.
6. "trendingHashtags": 15-20 relevant trending Christian hashtags.

Return ONLY raw JSON, without markdown.`;

      const userPrompt = `Verse Reference: ${verseData.referenceEn} | ${verseData.referenceTa}
English Text: "${verseData.textEn}"
Tamil Text: "${verseData.textTa}"`;

      try {
        const raw = await this._callRestApi(systemPrompt, userPrompt);
        const cleanJson = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);

        if (parsed.locationTheme) locationTheme = parsed.locationTheme;
        if (parsed.highlightEn) highlightEn = parsed.highlightEn.toUpperCase();
        if (parsed.highlightTa) highlightTa = parsed.highlightTa;
        if (parsed.scenePrompt) specificScenePrompt = parsed.scenePrompt;
        if (parsed.caption) captionText = parsed.caption;
        if (parsed.trendingHashtags) {
          trendingHashtags = Array.isArray(parsed.trendingHashtags)
            ? parsed.trendingHashtags.join(' ')
            : String(parsed.trendingHashtags);
        }
      } catch (err) {
        console.warn('[GeminiService] AI API warning, using dynamic template:', err.message);
      }
    }

    const masterPrompt = this.buildMasterPrompt(verseData, highlightEn, highlightTa, locationTheme);
    const fullCaption = `${captionText}\n\n• • •\n${trendingHashtags}`;

    return {
      masterPrompt: masterPrompt,
      imagePrompt: specificScenePrompt,
      locationTheme: locationTheme,
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

  /**
   * Automatically infers the biblical location/theme across all 66 books
   */
  _inferBiblicalLocation(verseData) {
    const text = (verseData.textEn || '').toLowerCase();
    const ref = (verseData.referenceEn || '').toLowerCase();
    const bookNum = verseData.bookNum || 1;

    // Gospels & Jesus
    if (ref.includes('john 3') || text.includes('cross') || text.includes('calvary') || text.includes('crucif') || text.includes('redeem')) {
      return "Mount Calvary at redemptive dawn with an ethereal glowing celestial golden cross and misty valleys";
    }
    if (text.includes('shepherd') || text.includes('pasture') || text.includes('still water') || ref.includes('psalm 23')) {
      return "lush green rolling pastures of Judea at morning sunrise with gentle still waters and ancient olive trees";
    }
    if (text.includes('storm') || text.includes('sea') || text.includes('waves') || text.includes('boat') || text.includes('fish') || ref.includes('mark 4') || ref.includes('matt 8')) {
      return "Sea of Galilee with dramatic waves parting in divine peace around an ancient wooden boat bathed in heavenly light";
    }
    if (text.includes('temple') || text.includes('solomon') || text.includes('david') || ref.includes('kings') || ref.includes('chronicles')) {
      return "Solomon’s Temple in ancient Jerusalem with towering limestone pillars, stone balustrades, and golden terraces";
    }
    if (text.includes('eagle') || text.includes('wings') || text.includes('mount') || ref.includes('isaiah 40')) {
      return "majestic mountain summits of Israel with golden eagles soaring above dramatic clouds";
    }
    if (text.includes('light') || text.includes('sun') || text.includes('creation') || ref.includes('genesis 1')) {
      return "the cosmos and earth forming with radiant golden divine light piercing primordial mist";
    }
    if (text.includes('wilderness') || text.includes('desert') || text.includes('manna') || ref.includes('exodus') || ref.includes('numbers')) {
      return "rugged Mount Sinai at dawn with towering rock cliffs bathed in celestial golden fire";
    }
    if (text.includes('city') || text.includes('new jerusalem') || text.includes('heaven') || ref.includes('revelation')) {
      return "the celestial golden city of New Jerusalem with radiant gates of pearl and a river of crystal water";
    }

    // Default by Testament
    if (bookNum >= 40) {
      // New Testament
      return "ancient holy land hills at golden hour sunrise with ancient stone pathways and olive groves";
    } else {
      // Old Testament
      return "ancient Jerusalem hills at golden hour sunrise with sacred stone sanctuaries and distant mountains";
    }
  }

  _buildScenePrompt(locationTheme) {
    return `Create a breathtaking ancient biblical landscape inspired by ${locationTheme}. Lower 45% shows majestic sacred architecture or landscape in the distance, ancient stone balustrade in foreground with warm divine light, subtle floating golden particles, distant mountains. Upper 55% shows dramatic dark navy blue and royal blue volumetric clouds with heavenly golden sun rays breaking through from the upper right, leaving clean negative space for typography. Cinematic deep navy blue, royal blue, antique gold, and warm ivory palette. Photorealistic 8k, reverent, majestic, vertical 4:5 portrait.`;
  }

  /**
   * Automatically extracts the most sacred/meaningful phrase in English for ANY verse
   */
  _detectHighlightEn(text) {
    if (!text) return 'THE LORD IS GOOD';

    // 1. Common well-known Bible phrases
    const known = text.match(/\b(BLESSED BE THE LORD GOD OF ISRAEL|THE LORD IS MY SHEPHERD|FOR GOD SO LOVED THE WORLD|I CAN DO ALL THINGS THROUGH CHRIST|TRUST IN THE LORD WITH ALL THINE HEART|THY WORD IS A LAMP UNTO MY FEET|BE STRONG AND OF A GOOD COURAGE|MY FEET WERE ALMOST GONE|THE LORD BLESS THEE AND KEEP THEE|I WILL BLESS THE LORD AT ALL TIMES|FEAR NOT FOR I AM WITH THEE)\b/i);
    if (known) return known[0].toUpperCase();

    // 2. Look for phrases containing LORD, GOD, JESUS, CHRIST, FAITH, BLESSED
    const sacredMatch = text.match(/(?:[A-Z][a-z]*\s+)?\b(?:LORD GOD|LORD|GOD|JESUS CHRIST|CHRIST|SAVIOUR)\b(?:[A-Z\s,]{3,30})?/i);
    if (sacredMatch && sacredMatch[0].length >= 8 && sacredMatch[0].length <= 40) {
      return sacredMatch[0].replace(/[“”,;.]/g, '').trim().toUpperCase();
    }

    // 3. Fallback: Take the first meaningful clause (up to 6 words)
    const words = text.replace(/^[“"\s]+/, '').split(/\s+/);
    return words.slice(0, Math.min(5, words.length)).join(' ').replace(/[,;.]/g, '').toUpperCase();
  }

  /**
   * Automatically extracts the most sacred/meaningful phrase in Tamil for ANY verse
   */
  _detectHighlightTa(text) {
    if (!text) return 'கர்த்தருக்கு ஸ்தோத்திரம்';

    // 1. Common well-known Tamil phrases
    const known = text.match(/(இஸ்ரவேலின் தேவனாகிய கர்த்தருக்கு ஸ்தோத்திரம்|கர்த்தருக்கு ஸ்தோத்திரம்|கர்த்தர் என் மேய்ப்பராயிருக்கிறார்|தேவன் உலகத்தில் அன்புகூர்ந்தார்|தேவன் நமக்கு அடைக்கலமும் பலனுமானவர்|என் கால்கள் தள்ளாடுதலுக்கும்|கர்த்தர் உன்னை ஆசீர்வதித்து|கர்த்தரை நான் எக்காலத்திலும் ஸ்தோத்திரிப்பேன்|பயப்படாதே நான் உன்னுடனே இருக்கிறேன்)/);
    if (known) return known[0];

    // 2. Match words with கர்த்தர், தேவன், இயேசு
    const sacredMatch = text.match(/([^\s,;.]+\s+)?(கர்த்தர்|தேவன்|இயேசு|ஆண்டவர்)([^\s,;.]{2,30})?/);
    if (sacredMatch) {
      return sacredMatch[0].replace(/[“”,;.]/g, '').trim();
    }

    // 3. Fallback: Take first 4 words of Tamil verse
    const words = text.replace(/^[“"\s]+/, '').split(/\s+/);
    return words.slice(0, Math.min(4, words.length)).join(' ').replace(/[,;.]/g, '').trim();
  }

  _createDynamicCaption(verseData) {
    return `✨ "${verseData.textEn}" — ${verseData.referenceEn} (KJV)\n\n` +
      `📖 ${verseData.textTa} — ${verseData.referenceTa}\n\n` +
      `🌿 Reflection on ${verseData.referenceEn}:\n` +
      `God's word is living, active, and steadfast. In every season of life, His promises are 'Yes' and 'Amen'. Stand firm on this scripture today, walk in peace, and let His grace strengthen your soul.\n\n` +
      `🙏 Daily Prayer:\n` +
      `Lord God Almighty, thank You for the truth and power of Your holy scripture. Align our hearts with Your purpose and illuminate our pathway today. In Jesus' mighty name, Amen.`;
  }

  _createDefaultHashtags(verseData) {
    const book = (verseData.referenceEn || '').split(/\s+/)[0].replace(/[^a-zA-Z]/g, '');
    return `#DailyBibleVerse #BibleVerseOfTheDay #ScriptureOfTheDay #${book} #WordOfGod #DailyDevotional #FaithOverFear #GodsPromises #ChristianInspiration #JesusChrist #GraceUponGrace #GoodNews #Gospel #KJV #TamilChristian #TamilBible #TamilBibleVerse #TamilDevotional #FaithInGod #HopeInChrist`;
  }
}

module.exports = new GeminiService();
