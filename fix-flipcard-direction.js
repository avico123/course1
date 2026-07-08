#!/usr/bin/env node
// fix-flipcard-direction.js
// Scans all games and sets textDir on flip card faces based on detected language.
// Run: node fix-flipcard-direction.js [--dry-run]

const fs   = require('fs');
const path = require('path');

const GAMES_DIR = process.env.GAMES_DIR || '/mnt/data/games';
const DRY_RUN   = process.argv.includes('--dry-run');

if (DRY_RUN) console.log('DRY RUN — no files will be changed\n');

function detectDir(str = '') {
  const rtl = (str.match(/[֐-׿؀-ۿ]/g) || []).length;
  const ltr = (str.match(/[A-Za-zÀ-ɏ]/g) || []).length;
  if (ltr === 0 && rtl === 0) return null;
  return rtl > ltr ? 'rtl' : 'ltr';
}

function extractText(val) {
  if (!val) return '';
  if (typeof val === 'string') {
    try {
      const p = JSON.parse(val);
      if (p && p.ops) return p.ops.map(o => (typeof o.insert === 'string' ? o.insert : '')).join('');
    } catch {}
    return val;
  }
  if (val && val.ops) return val.ops.map(o => (typeof o.insert === 'string' ? o.insert : '')).join('');
  return String(val);
}

function getSections(data) {
  // data.sections is [[sec,sec,...],[sec,...],...]
  const raw = data.sections || data.slides || [];
  const flat = [];
  for (const item of raw) {
    if (Array.isArray(item)) {
      for (const sec of item) flat.push(sec);
    } else if (item && typeof item === 'object') {
      flat.push(item);
    }
  }
  return flat;
}

function isFlipCard(sec) {
  return sec.type === 'flipCardSection' ||
    (sec.media && sec.media.mediaType === 'flip-card') ||
    (sec.mediaType === 'flip-card');
}

function getFlipMedia(sec) {
  const m = sec.media || {};
  return {
    frontMedia: m.frontMedia,
    backMedia:  m.backMedia,
    media: m,
  };
}

let totalGames = 0, changedGames = 0, changedFaces = 0, totalFlipCards = 0;

const folders = fs.readdirSync(GAMES_DIR).filter(f => {
  try { return fs.statSync(path.join(GAMES_DIR, f)).isDirectory(); } catch { return false; }
});

for (const folder of folders) {
  const itemPath = path.join(GAMES_DIR, folder, 'item.json');
  if (!fs.existsSync(itemPath)) continue;

  let data;
  try { data = JSON.parse(fs.readFileSync(itemPath, 'utf8')); } catch { continue; }
  totalGames++;

  const sections = getSections(data);
  let gameChanged = false;

  for (const sec of sections) {
    if (!sec || !isFlipCard(sec)) continue;
    totalFlipCards++;

    const { frontMedia, backMedia, media } = getFlipMedia(sec);
    const sides = [
      { key: 'frontMedia', obj: frontMedia },
      { key: 'backMedia',  obj: backMedia  },
    ];

    for (const { key, obj } of sides) {
      if (!obj) continue;
      const text = extractText(obj.text);
      const detected = detectDir(text);
      if (!detected) continue;

      const current = obj.textDir || 'rtl';
      if (detected !== current) {
        console.log(`${folder.slice(0,8)} | ${key} | "${text.slice(0,60).replace(/\n/g,' ')}"`);
        console.log(`  ${current} -> ${detected}`);
        if (!DRY_RUN) {
          obj.textDir = detected;
          media[key] = obj;
          sec.media = media;
        }
        gameChanged = true;
        changedFaces++;
      }
    }
  }

  if (gameChanged) {
    if (!DRY_RUN) {
      try {
        fs.writeFileSync(itemPath, JSON.stringify(data, null, 2));
        changedGames++;
      } catch (e) {
        console.error('Failed to write', itemPath, e.message);
      }
    } else {
      changedGames++;
    }
  }
}

console.log(`\nScanned ${totalGames} games, found ${totalFlipCards} flip card sections`);
console.log(`${DRY_RUN ? 'Would change' : 'Changed'} ${changedGames} games (${changedFaces} faces)`);
