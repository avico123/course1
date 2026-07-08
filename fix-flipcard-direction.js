#!/usr/bin/env node
// fix-flipcard-direction.js
// Scans all games and sets textDir on flip card faces based on detected language.
// Run: node fix-flipcard-direction.js [--dry-run]
//
// Logic: if a face has more Latin letters (a-z, accented) than RTL letters (Hebrew/Arabic),
// it is LTR (Spanish/Portuguese/English). Otherwise RTL.

const fs   = require('fs');
const path = require('path');

const GAMES_DIR = process.env.GAMES_DIR || '/mnt/data/games';
const DRY_RUN   = process.argv.includes('--dry-run');

if (DRY_RUN) console.log('🔍 DRY RUN — no files will be changed\n');

function detectDir(str = '') {
  const rtl = (str.match(/[֐-׿؀-ۿ]/g) || []).length;
  const ltr = (str.match(/[A-Za-zÀ-ɏ]/g) || []).length;
  if (rtl === 0 && ltr === 0) return null; // no strong characters — leave as-is
  return rtl > ltr ? 'rtl' : 'ltr';
}

function extractText(val) {
  if (!val) return '';
  if (typeof val === 'string') {
    try {
      const p = JSON.parse(val);
      if (p?.ops) return p.ops.map(o => (typeof o.insert === 'string' ? o.insert : '')).join('');
    } catch {}
    return val;
  }
  if (val?.ops) return val.ops.map(o => (typeof o.insert === 'string' ? o.insert : '')).join('');
  return String(val);
}

let totalGames = 0, changedGames = 0, changedFaces = 0;

const folders = fs.readdirSync(GAMES_DIR).filter(f => {
  try { return fs.statSync(path.join(GAMES_DIR, f)).isDirectory(); } catch { return false; }
});

for (const folder of folders) {
  const itemPath = path.join(GAMES_DIR, folder, 'item.json');
  if (!fs.existsSync(itemPath)) continue;

  let data;
  try { data = JSON.parse(fs.readFileSync(itemPath, 'utf8')); } catch { continue; }

  totalGames++;
  const sections = (data.slides || []).flatMap(slide =>
    Array.isArray(slide) ? slide : [slide]
  );

  let gameChanged = false;

  for (const sec of sections) {
    if (sec.type !== 'flipCardSection') continue;

    const media = sec.media || {};
    const sides = [
      { key: 'frontMedia', obj: media.frontMedia },
      { key: 'backMedia',  obj: media.backMedia  },
    ];

    for (const { key, obj } of sides) {
      if (!obj) continue;
      const text = extractText(obj.text);
      const detected = detectDir(text);
      if (!detected) continue; // empty or ambiguous — skip

      const current = obj.textDir || 'rtl';
      if (detected !== current) {
        console.log(`  ${folder.slice(0,8)} | ${key} | "${text.slice(0,50).replace(/\n/g,' ')}"`);
        console.log(`    ${current} → ${detected}`);
        if (!DRY_RUN) {
          obj.textDir = detected;
          media[key] = obj;
        }
        gameChanged = true;
        changedFaces++;
      }
    }
  }

  if (gameChanged && !DRY_RUN) {
    try {
      fs.writeFileSync(itemPath, JSON.stringify(data, null, 2));
      changedGames++;
    } catch (e) {
      console.error(`  ❌ Failed to write ${itemPath}: ${e.message}`);
    }
  } else if (gameChanged) {
    changedGames++;
  }
}

console.log(`\n✅ Done. Scanned ${totalGames} games, ${DRY_RUN ? 'would change' : 'changed'} ${changedGames} games (${changedFaces} faces).`);
