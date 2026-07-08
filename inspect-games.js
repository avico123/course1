#!/usr/bin/env node
// inspect-games.js — dumps the structure of a sample game and counts section types
// Usage: GAMES_DIR=/mnt/data/games node inspect-games.js [folderId]
// With a folderId: dumps that game's full slide/section structure
// Without: shows top-10 section types found across all games

const fs   = require('fs');
const path = require('path');

const GAMES_DIR  = process.env.GAMES_DIR || '/mnt/data/games';
const TARGET     = process.argv[2]; // optional specific folderId

function walk(obj, depth, prefix) {
  if (depth > 4 || obj === null || typeof obj !== 'object') return;
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? prefix + '.' + k : k;
    if (Array.isArray(v)) {
      console.log(`  ${p}: Array[${v.length}]`);
      if (v.length > 0) walk(v[0], depth + 1, p + '[0]');
    } else if (v && typeof v === 'object') {
      console.log(`  ${p}: {${Object.keys(v).join(', ')}}`);
      walk(v, depth + 1, p);
    } else {
      const display = typeof v === 'string' ? `"${v.slice(0,60)}"` : v;
      console.log(`  ${p}: ${display}`);
    }
  }
}

if (TARGET) {
  // Dump one specific game
  const p = path.join(GAMES_DIR, TARGET, 'item.json');
  if (!fs.existsSync(p)) { console.log('Not found:', p); process.exit(1); }
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  console.log('Top-level keys:', Object.keys(d).join(', '));
  walk(d, 0, '');
  process.exit(0);
}

// Find all section types and count flip-card-like sections
const typeCounts = {};
const mediaTypeCounts = {};
let games = 0, flipish = 0;
const flipExamples = [];

const folders = fs.readdirSync(GAMES_DIR).slice(0, 500); // sample first 500
for (const folder of folders) {
  const p = path.join(GAMES_DIR, folder, 'item.json');
  if (!fs.existsSync(p)) continue;
  let d;
  try { d = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
  games++;

  // Try several paths where sections might live
  const candidates = [
    ...(d.slides || []).flat(),
    ...(d.item?.slides || []).flat(),
    ...(d.sections || []),
    ...(d.pages || []).flat(),
  ];

  for (const sec of candidates) {
    if (!sec || typeof sec !== 'object') continue;
    const t = sec.type || 'unknown';
    typeCounts[t] = (typeCounts[t] || 0) + 1;
    const mt = sec.media?.mediaType || sec.mediaType || '';
    if (mt) mediaTypeCounts[mt] = (mediaTypeCounts[mt] || 0) + 1;

    const isFlip = t === 'flipCardSection' || mt === 'flip-card' || t === 'FlipCard' || JSON.stringify(sec).includes('frontMedia');
    if (isFlip) {
      flipish++;
      if (flipExamples.length < 3) flipExamples.push({ folder: folder.slice(0,8), type: t, mt, keys: Object.keys(sec).join(', ') });
    }
  }
}

console.log(`\nScanned ${games} games (first 500)\n`);
console.log('Section types:');
Object.entries(typeCounts).sort((a,b)=>b[1]-a[1]).slice(0,15).forEach(([t,c])=>console.log(`  ${t}: ${c}`));
console.log('\nMedia types:');
Object.entries(mediaTypeCounts).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([t,c])=>console.log(`  ${t}: ${c}`));
console.log(`\nFlip-ish sections: ${flipish}`);
flipExamples.forEach(e=>console.log('  Example:', JSON.stringify(e)));

// Also show what the first game looks like
const firstFolder = fs.readdirSync(GAMES_DIR)[0];
if (firstFolder) {
  const p2 = path.join(GAMES_DIR, firstFolder, 'item.json');
  if (fs.existsSync(p2)) {
    const d2 = JSON.parse(fs.readFileSync(p2, 'utf8'));
    console.log('\nFirst game top-level keys:', Object.keys(d2).join(', '));
  }
}
