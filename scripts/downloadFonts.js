const fs = require('fs');
const path = require('path');
const https = require('https');

const fontsDir = path.join(__dirname, '..', 'fonts');
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

// Direct URLs to reliable raw TTF fonts from official Google Fonts github repositories
const fonts = [
  {
    name: 'PlayfairDisplay-Bold.ttf',
    url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf'
  },
  {
    name: 'GreatVibes-Regular.ttf',
    url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/greatvibes/GreatVibes-Regular.ttf'
  },
  {
    name: 'Lora-Regular.ttf',
    url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/lora/Lora%5Bwght%5D.ttf'
  },
  {
    name: 'Cinzel-Bold.ttf',
    url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/cinzel/Cinzel%5Bwght%5D.ttf'
  },
  {
    name: 'MuktaMalar-Regular.ttf',
    url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/muktamalar/MuktaMalar-Regular.ttf'
  },
  {
    name: 'MuktaMalar-Bold.ttf',
    url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/muktamalar/MuktaMalar-Bold.ttf'
  }
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download ${url}: status code ${res.statusCode}`));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
      file.on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('Downloading premium fonts for poster engine...');
  for (const font of fonts) {
    const dest = path.join(fontsDir, font.name);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
      console.log(`[✓] Already exists: ${font.name}`);
      continue;
    }
    try {
      console.log(`Downloading ${font.name}...`);
      await downloadFile(font.url, dest);
      console.log(`[✓] Downloaded: ${font.name} (${(fs.statSync(dest).size / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.warn(`[!] Warning downloading ${font.name}: ${err.message}`);
    }
  }
  console.log('Fonts setup complete.');
}

run();
