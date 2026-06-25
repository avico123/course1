#!/usr/bin/env node
/**
 * import-nemo-context.js
 * Reads nemo-chapters-embed.csv and writes contextTags + lang into each
 * matching game's _meta.json based on the data-item UUID in the embed_code.
 *
 * Usage:
 *   node import-nemo-context.js [csv-path] [games-dir]
 *
 * Defaults:
 *   csv-path  = /home/opc/nemo-chapters-embed.csv
 *   games-dir = /mnt/data/games
 */

const fs   = require('fs');
const path = require('path');

const CSV_PATH  = process.argv[2] || '/home/opc/nemo-chapters-embed.csv';
const GAMES_DIR = process.argv[3] || (process.env.GAMES_DIR || '/mnt/data/games');

// ── Parse CSV ─────────────────────────────────────────────────────────────────
// Simple parser: handles quoted fields with embedded newlines/commas
function parseCSV(text) {
  const rows = [];
  let field = '', row = [], inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"' && text[i+1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuote = false;
      else field += ch;
    } else {
      if (ch === '"') { inQuote = true; }
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (ch === '\r') { /* skip */ }
      else field += ch;
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`Reading ${CSV_PATH}...`);
const raw  = fs.readFileSync(CSV_PATH, 'utf8');
const rows = parseCSV(raw);

const headers = rows[0];
const col = name => headers.indexOf(name);

const iLang    = col('lang');
const iBook    = col('nemo_book');
const iChapter = col('nemo_chapter');
const iName    = col('nemo_item_name');
const iStatus  = col('buzz_status');
const iEmbed   = col('embed_code');

console.log(`Headers: ${headers.join(' | ')}`);
console.log(`Total rows: ${rows.length - 1}`);

let matched = 0, skipped = 0, errors = 0;

for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  if (!row || row.length < 3) continue;

  const status = (row[iStatus] || '').trim();
  if (status !== 'found') { skipped++; continue; }

  const embed = row[iEmbed] || '';
  const uuidMatch = embed.match(/data-item="([a-f0-9-]{36})"/i);
  if (!uuidMatch) { skipped++; continue; }

  const uuid     = uuidMatch[1];
  const gameDir  = path.join(GAMES_DIR, uuid);
  const metaPath = path.join(gameDir, '_meta.json');

  if (!fs.existsSync(gameDir)) {
    console.warn(`  ✗ UUID not found on disk: ${uuid}`);
    errors++;
    continue;
  }

  let existing = {};
  if (fs.existsSync(metaPath)) {
    try { existing = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch {}
  }

  const book    = (row[iBook]    || '').trim();
  const chapter = (row[iChapter] || '').trim();
  const name    = (row[iName]    || '').trim();
  const lang    = (row[iLang]    || '').trim();

  // Build contextTags: [book, chapter, item-name] — skip empty parts
  const tags = [book, chapter, name].filter(Boolean);

  existing.contextTags = tags;
  if (lang) existing.langOverride = lang;
  existing.nemoBook    = book;
  existing.nemoChapter = chapter;
  existing.nemoName    = name;
  existing.updatedAt   = new Date().toISOString();
  existing.updatedBy   = 'import-nemo-context';

  fs.writeFileSync(metaPath, JSON.stringify(existing, null, 2));
  console.log(`  ✓ ${uuid.slice(0,8)}… → ${tags.join(' / ')}`);
  matched++;
}

console.log(`\n✅ Done`);
console.log(`   Matched & tagged : ${matched}`);
console.log(`   Skipped (no UUID): ${skipped}`);
console.log(`   Not found on disk: ${errors}`);
console.log(`\nRun scan-games.js next to rebuild the index:`);
console.log(`  node /opt/playbuzz-renderer/server/scan-games.js`);
