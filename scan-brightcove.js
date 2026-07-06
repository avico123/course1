#!/usr/bin/env node
// Scans all games for Brightcove numeric video IDs (vs real YouTube 11-char IDs)
// Run on server: node /tmp/scan-brightcove.js
const fs = require('fs');
const path = require('path');

const GAMES = process.env.GAMES_DIR || '/mnt/data/games';

let dirs;
try {
  dirs = fs.readdirSync(GAMES);
} catch (e) {
  console.error('Cannot read games dir:', GAMES, e.message);
  process.exit(1);
}

const results = [];

dirs.forEach(id => {
  const file = path.join(GAMES, id, 'item.json');
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const str = JSON.stringify(data);
    const allIds = [...str.matchAll(/"videoId":"([^"]+)"/g)].map(m => m[1]);
    const unique = [...new Set(allIds)];
    const brightcove = unique.filter(v => /^\d{8,}$/.test(v));  // numeric, 8+ digits = Brightcove
    const realYT     = unique.filter(v => /^[A-Za-z0-9_-]{11}$/.test(v));  // 11-char = YouTube

    if (unique.length > 0) {
      results.push({
        id,
        title: data.title || '(untitled)',
        brightcove,
        realYT,
        all: unique,
      });
    }
  } catch (e) {
    // skip unreadable games
  }
});

console.log('\n=== Games with video IDs ===\n');
results.forEach(r => {
  console.log(`Game: ${r.title}`);
  console.log(`  ID: ${r.id}`);
  if (r.brightcove.length) console.log(`  ❌ Brightcove IDs (broken): ${r.brightcove.join(', ')}`);
  if (r.realYT.length)     console.log(`  ✅ Real YouTube IDs: ${r.realYT.join(', ')}`);
  if (r.all.filter(v => !r.brightcove.includes(v) && !r.realYT.includes(v)).length)
    console.log(`  ❓ Other: ${r.all.filter(v => !r.brightcove.includes(v) && !r.realYT.includes(v)).join(', ')}`);
  console.log();
});

console.log(`\nTotal games with videos: ${results.length}`);
console.log(`Games with broken Brightcove IDs: ${results.filter(r => r.brightcove.length).length}`);
console.log(`Games with real YouTube IDs: ${results.filter(r => r.realYT.length).length}`);
