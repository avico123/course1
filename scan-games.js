#!/usr/bin/env node
/**
 * scan-games.js
 * Run once (or via cron) to build items-index.json
 * Usage: node scan-games.js
 */

const fs   = require('fs');
const path = require('path');

const GAMES_DIR  = process.env.GAMES_DIR || '/mnt/data/games';
const INDEX_PATH = path.join(__dirname, 'items-index.json');

// ── Language detection ────────────────────────────────────────────────────────
// Spanish-specific characters not found in English
const SPANISH_CHARS = /[ñÑáéíóúüÁÉÍÓÚÜ¿¡]/;

function detectLang(title = '', locale = '') {
  let he = 0, ar = 0, lat = 0, es = 0;
  for (const ch of title) {
    const c = ch.charCodeAt(0);
    if (c >= 0x0590 && c <= 0x05FF) he++;
    else if (c >= 0x0600 && c <= 0x06FF) ar++;
    else if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) lat++;
    if (SPANISH_CHARS.test(ch)) es++;
  }
  const total = he + ar + lat;
  if (total === 0) return 'unknown';
  if (he / total > 0.3) return 'he';
  if (ar / total > 0.3) return 'ar';
  // Latin script: check for Spanish-specific characters first
  if (es > 0) return 'es';
  // Use locale as tiebreaker between English and Spanish
  if (locale && locale.startsWith('es')) return 'es';
  return 'en';
}

// ── Issue detection ───────────────────────────────────────────────────────────
const EXTERNAL_HOSTS = ['playbuzz.com', 'dpg4l7vn2owwv.cloudfront.net'];

function isExternal(url = '') {
  return EXTERNAL_HOSTS.some(h => url.includes(h));
}

function scanSections(sections = []) {
  const issues = new Set();

  const walk = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) { obj.forEach(walk); return; }

    const url = obj.url || obj.originalImageUrl || obj.originalImageURL || obj.src || '';
    if (url) {
      if (isExternal(url)) {
        const t = obj.mediaType || '';
        issues.add(t === 'video' ? 'broken-video' : 'broken-image');
      }
    }

    // Check text ops for links
    if (Array.isArray(obj.ops)) {
      for (const op of obj.ops) {
        const link = op?.attributes?.link || '';
        if (link && isExternal(link)) issues.add('broken-link');
      }
    }

    for (const v of Object.values(obj)) walk(v);
  };

  walk(sections);
  return [...issues];
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`Scanning ${GAMES_DIR}...`);
const start = Date.now();

const dirs = fs.readdirSync(GAMES_DIR).filter(name => {
  const p = path.join(GAMES_DIR, name);
  return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'item.json'));
});

console.log(`Found ${dirs.length} game folders`);

const index = [];
let errors = 0;

for (const folderId of dirs) {
  try {
    const raw  = fs.readFileSync(path.join(GAMES_DIR, folderId, 'item.json'), 'utf8');
    const data = JSON.parse(raw);

    // Check for _meta.json (team tags)
    let meta = {};
    const metaPath = path.join(GAMES_DIR, folderId, '_meta.json');
    if (fs.existsSync(metaPath)) {
      try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch {}
    }

    // If meta has a manual lang override, use it; otherwise auto-detect
    const detectedLang = meta.langOverride || detectLang(data.title, data.locale);
    const issues       = scanSections(data.sections);

    // Check missing local files referenced in sections
    const filesDir = path.join(GAMES_DIR, folderId, 'files');
    const localFiles = fs.existsSync(filesDir) ? fs.readdirSync(filesDir) : [];
    if (localFiles.length === 0 && (data.sections || []).flat().length > 0) {
      // Has content but no local files - may have been uploaded to Playbuzz only
      // Only flag if sections reference local file paths
    }

    index.push({
      folderId,
      itemId:       data.itemId || folderId,
      title:        data.title || '',
      patternId:    data.patternId || 'unknown',
      status:       data.status || 'draft',
      locale:       data.locale || '',
      detectedLang,
      creationTime: data.creationTime || '',
      lastEdit:     data.lastEdit || '',
      creatorName:  data.creatorName || '',
      issues,
      teamStatus:   meta.status || '',
      teamNote:     meta.note   || '',
      assignedTo:   meta.assignedTo || '',
      langOverride: meta.langOverride || '',
      contextTags:  meta.contextTags || [],
      hasThumbnail: !!(data.thumbnail?.croppedImageURL || data.thumbnail?.originalImageURL),
      thumbnailUrl: data.thumbnail?.croppedImageURL || data.thumbnail?.originalImageURL || '',
      sectionCount: (data.sections || []).length,
    });
  } catch (e) {
    errors++;
    console.error(`  ✗ ${folderId}: ${e.message}`);
  }
}

index.sort((a, b) => new Date(b.lastEdit) - new Date(a.lastEdit));

fs.writeFileSync(INDEX_PATH, JSON.stringify({ builtAt: new Date().toISOString(), count: index.length, items: index }, null, 2));

const secs = ((Date.now() - start) / 1000).toFixed(1);
console.log(`\n✅ Done in ${secs}s`);
console.log(`   ${index.length} items indexed, ${errors} errors`);
console.log(`   Issues found:`);

const issueCounts = {};
index.forEach(i => i.issues.forEach(iss => { issueCounts[iss] = (issueCounts[iss] || 0) + 1; }));
Object.entries(issueCounts).forEach(([k, v]) => console.log(`     ${k}: ${v}`));

const langCounts = {};
index.forEach(i => { langCounts[i.detectedLang] = (langCounts[i.detectedLang] || 0) + 1; });
console.log(`   Languages:`, langCounts);
console.log(`\n   Index saved to: ${INDEX_PATH}`);
