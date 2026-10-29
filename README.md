# 🕊️ Premium Bible Verse Poster Generator & Instagram Publisher

An automated, full-stack Node.js application that turns daily scriptures into luxury 1080x1350px typography posters (in English KJV, Tamil, or Bilingual) and automatically publishes them to your Instagram feed using the Instagram Graph API.

---

## 🌟 Key Features

1. **Dual SQLite Bible Engine (`kjv.db` & `tamil.db`)**:
   - Queries 31,102 verses in English King James Version and Tamil with 1-to-1 canonical alignment.
   - Smart reference parser supports queries like `"1 Kings 8:15"`, `"Isa 40:31"`, `"Jn 3:16"`, `"Ps 23:1"`, or random daily selection.
2. **Google Gemini Prompt Engineering (`@google/genai`)**:
   - Analyzes scripture sentiment and extracts a comforting `shortHook`.
   - Generates cinematic 4:5 text-to-image prompts leaving negative space on the right side for text.
   - Composes reflective Instagram captions with 10–15 relevant Christian hashtags.
3. **Background Image Art Generator**:
   - Supports **Google Imagen 3** (`imagen-3.0-generate-002` via Gemini API).
   - Supports **OpenAI DALL-E 3**.
   - Built-in atmospheric procedural artwork generator for offline testing without burning API credits.
4. **Luxury Typography Compositor (Node Canvas / `@napi-rs/canvas`)**:
   - Strictly renders 1080px × 1350px (Instagram Portrait 4:5 ratio).
   - **Hook Typography (Top-Right)**: Bold Gold Serif (*Playfair Display* / *Cinzel*) + Cursive Script in White (*Great Vibes*) + Golden curved underline.
   - **Scripture Typography (Center-Right)**: Clean Serif (*Lora*), drop shadow, generous line height.
   - **Bilingual Layout**: English verse on top, golden separator, followed by Tamil verse in *Mukta Malar* Unicode font.
   - **Reference (Bottom)**: Thin gold line divider, cross icon (`┼`), and all-caps golden reference with letter spacing.
5. **Instagram Graph API Direct Publisher**:
   - Implements Meta's 2-step media container workflow (`/media` -> `/media_publish`).
   - Polls container processing status until ready and publishes to your feed.
6. **Automation & Web Studio Dashboard**:
   - `node-cron` scheduled daily posting at 08:00 AM (configurable).
   - Interactive glassmorphic web dashboard with live preview, random picker, manual generator, and instant Instagram publishing.

---

## 🚀 Quick Start

### 1. Start the Server
```bash
npm start
```
Or with auto-reload:
```bash
npm run dev
```

### 2. Open the Web Dashboard
Open your browser and navigate to:
**`http://localhost:3000`**

---

## 🔑 Configuration (`.env`)

Open `.env` in the project root and fill in your keys:

```env
# ==========================================
# SERVER CONFIGURATION
# ==========================================
PORT=3000
NODE_ENV=development

# Public HTTPS URL for Instagram Graph API to download your poster
# (Use ngrok during local development: ngrok http 3000)
PUBLIC_BASE_URL=https://your-ngrok-domain.ngrok-free.app

# ==========================================
# LOCAL SQLITE DATABASES
# ==========================================
KJV_DB_PATH=./data/kjv.db
TAMIL_DB_PATH=./data/tamil.db

# ==========================================
# GOOGLE GEMINI & IMAGEN API
# ==========================================
# Get key free from: https://aistudio.google.com/
GEMINI_API_KEY=AIzaSy...

# Background Art Provider: 'imagen' | 'dalle' | 'mock'
IMAGE_PROVIDER=imagen
OPENAI_API_KEY=

# ==========================================
# INSTAGRAM GRAPH API
# ==========================================
# Meta Developer App -> Graph API Explorer -> Instagram Business Account ID & Token
INSTAGRAM_ACCOUNT_ID=17841400000000000
INSTAGRAM_ACCESS_TOKEN=EAAB...

# ==========================================
# AUTOMATION (NODE-CRON)
# ==========================================
CRON_SCHEDULE="0 8 * * *"
AUTO_PUBLISH_ON_CRON=false
CRON_LANGUAGE=both
```

---

## 📱 Publishing to Instagram (Local Testing with ngrok)

Because Instagram's Graph API requires a public HTTPS URL to fetch the image:

1. Download and run **ngrok**:
   ```bash
   ngrok http 3000
   ```
2. Copy the resulting forwarding HTTPS URL (e.g., `https://abc-123.ngrok-free.app`).
3. Set `PUBLIC_BASE_URL=https://abc-123.ngrok-free.app` in your `.env`.
4. Click **"Publish to Instagram Feed Now"** on the dashboard!

---

## 📁 Project Architecture

```text
bible-verse/
├── config.js                 # Unified configuration & paths
├── server.js                 # Express REST API & static file server
├── .env                      # Environment variables & API keys
├── data/
│   ├── kjv.db               # English KJV SQLite database
│   └── tamil.db             # Tamil Bible SQLite database
├── fonts/                   # TTF fonts (Playfair, Great Vibes, Lora, Mukta Malar)
├── public/
│   ├── index.html           # Luxury Web Studio UI
│   ├── style.css            # Dark glassmorphism styling
│   ├── app.js               # Frontend interactive controller
│   └── generated/           # Saved 1080x1350 poster images
├── scripts/
│   └── downloadFonts.js     # Auto-downloads Google Fonts
├── services/
│   ├── dbService.js         # SQLite query engine & reference parser
│   ├── geminiService.js     # Gemini Pro / Flash prompt engineering & hooks
│   ├── imageService.js      # Imagen 3 / DALL-E / Procedural generator
│   ├── posterEngine.js      # 1080x1350 Canvas compositing engine
│   ├── instagramService.js  # Instagram Graph API container publisher
│   └── cronService.js       # node-cron daily automation pipeline
└── test_pipeline.js         # End-to-end verification test suite
```
