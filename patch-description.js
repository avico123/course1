#!/usr/bin/env node
// Direct patch: adds description field support to ImageBlock and BlockEditor
// Run: node /tmp/patch-description.js
// Then: cd /opt/playbuzz-renderer/client && npm run build && pm2 restart all

const fs = require('fs');
const SERVER = '/opt/playbuzz-renderer/client/src';

// ── 1. blocks/index.jsx — add description textarea to ImageBlock ───────────────

const blocksPath = `${SERVER}/admin/editor/blocks/index.jsx`;
let src = fs.readFileSync(blocksPath, 'utf8');
let changed = false;

// Add description textarea between caption and alt fields (edit mode)
if (!src.includes("placeholder=\"טקסט מתחת לתמונה...\"")) {
  src = src.replace(
    `<Field label="טקסט חלופי (Alt)">`,
    `<Field label="טקסט">
        <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' }} value={block.description || ''} onChange={e => onChange({ description: e.target.value })} placeholder="טקסט מתחת לתמונה..." />
      </Field>
      <Field label="טקסט חלופי (Alt)">`
  );
  changed = true;
  console.log('✅ blocks/index.jsx: added description textarea to ImageBlock');
} else {
  console.log('ℹ️  blocks/index.jsx: description textarea already present');
}

// Add description to view mode (below caption)
if (!src.includes('block.description &&')) {
  src = src.replace(
    `{block.caption && <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>{block.caption}</p>}`,
    `{block.caption && <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>{block.caption}</p>}
      {block.description && <p style={{ fontSize: 14, color: '#cbd5e1', marginTop: 6, lineHeight: 1.6, direction: 'rtl' }}>{block.description}</p>}`
  );
  changed = true;
  console.log('✅ blocks/index.jsx: added description to view mode');
} else {
  console.log('ℹ️  blocks/index.jsx: description view already present');
}

if (changed) fs.writeFileSync(blocksPath, src);

// ── 2. BlockEditor.jsx — read/write description from imageSection JSON ─────────

const editorPath = `${SERVER}/admin/editor/BlockEditor.jsx`;
let esrc = fs.readFileSync(editorPath, 'utf8');
let echanged = false;

// sectionsToBlocks: extract description when reading imageSection
const oldReturn = `return { type: 'image', id, url: media.url || media.originalImageUrl || '', alt: '', caption: extractDeltaText(sec.title) };`;
const newReturn  = `return { type: 'image', id, url: media.url || media.originalImageUrl || '', alt: '', caption: extractDeltaText(sec.title), description: extractDeltaText(sec.description) };`;

if (esrc.includes(oldReturn)) {
  esrc = esrc.replace(oldReturn, newReturn);
  echanged = true;
  console.log('✅ BlockEditor.jsx: sectionsToBlocks reads description');
} else if (esrc.includes('description: extractDeltaText(sec.description)')) {
  console.log('ℹ️  BlockEditor.jsx: sectionsToBlocks already reads description');
} else {
  console.log('⚠️  BlockEditor.jsx: could not find imageSection return to patch');
}

// blockToSection: write description back when saving imageSection
const oldSave = `return { type: 'mediaSection', title: deltaText(block.caption || ''), media: { mediaType: 'image', url: block.url, originalImageUrl: block.url, alt: block.alt || '' } };`;
const newSave  = `return { type: 'imageSection', title: deltaText(block.caption || ''), description: deltaText(block.description || ''), media: { mediaType: 'image', url: block.url, originalImageUrl: block.url, alt: block.alt || '' } };`;

if (esrc.includes(oldSave)) {
  esrc = esrc.replace(oldSave, newSave);
  echanged = true;
  console.log('✅ BlockEditor.jsx: blockToSection writes description');
} else if (esrc.includes("description: deltaText(block.description")) {
  console.log('ℹ️  BlockEditor.jsx: blockToSection already writes description');
} else {
  console.log('⚠️  BlockEditor.jsx: could not find image blockToSection to patch');
}

if (echanged) fs.writeFileSync(editorPath, esrc);

// ── 3. StoryPattern.jsx — fix imgUrl for full /game-files/... paths ────────────

const storyPath = `${SERVER}/components/patterns/StoryPattern.jsx`;
let ssrc = fs.readFileSync(storyPath, 'utf8');

const oldImgUrl = `function imgUrl(filePath, folderId) {
  if (!filePath) return null
  const filename = filePath.replace(/^files\\//, '')
  return \`/game-files/\${folderId}/\${filename}\`
}`;
const newImgUrl = `function imgUrl(filePath, folderId) {
  if (!filePath) return null
  if (filePath.startsWith('http') || filePath.startsWith('/')) return filePath
  const filename = filePath.replace(/^files\\//, '')
  return \`/game-files/\${folderId}/\${filename}\`
}`;

if (ssrc.includes("if (filePath.startsWith('http')")) {
  console.log('ℹ️  StoryPattern.jsx: imgUrl already handles full paths');
} else if (ssrc.includes('filePath.replace(/^files')) {
  ssrc = ssrc.replace(oldImgUrl, newImgUrl);
  fs.writeFileSync(storyPath, ssrc);
  console.log('✅ StoryPattern.jsx: imgUrl now handles /game-files/... and https:// paths');
} else {
  console.log('⚠️  StoryPattern.jsx: could not find imgUrl to patch');
}

// ── 4. BlockEditor.jsx — separator section type + trivia description field ─────

const editorSrc2 = fs.readFileSync(editorPath, 'utf8');
let e2 = editorSrc2;
let e2changed = false;

// separator: save as separatorSection
if (e2.includes("case 'separator':\n      return { type: 'paragraphSection', title: deltaText(''), text: deltaText('') };")) {
  e2 = e2.replace(
    "case 'separator':\n      return { type: 'paragraphSection', title: deltaText(''), text: deltaText('') };",
    "case 'separator':\n      return { type: 'separatorSection', style: block.style || 'line' };"
  );
  e2changed = true;
  console.log('✅ BlockEditor.jsx: separator saves as separatorSection');
} else if (e2.includes("separatorSection")) {
  console.log('ℹ️  BlockEditor.jsx: separator already correct');
} else {
  console.log('⚠️  BlockEditor.jsx: could not find separator case to patch');
}

// triviaSection: read question from description field
if (e2.includes("extractDeltaText(sec.question || sec.title)")) {
  e2 = e2.replace(
    "extractDeltaText(sec.question || sec.title)",
    "extractDeltaText(sec.description || sec.question || sec.title)"
  );
  e2changed = true;
  console.log('✅ BlockEditor.jsx: triviaSection reads question from description');
} else if (e2.includes("sec.description || sec.question")) {
  console.log('ℹ️  BlockEditor.jsx: triviaSection already reads description');
} else {
  console.log('⚠️  BlockEditor.jsx: could not find triviaSection question field to patch');
}

// triviaSection answers: read from description field too
if (e2.includes("extractDeltaText(a.title || a.text)")) {
  e2 = e2.replace(
    "extractDeltaText(a.title || a.text)",
    "extractDeltaText(a.description || a.title || a.text)"
  );
  e2changed = true;
  console.log('✅ BlockEditor.jsx: trivia answers read from description field');
} else if (e2.includes("a.description || a.title")) {
  console.log('ℹ️  BlockEditor.jsx: trivia answers already read description');
}

// triviaSection: save question to description field
if (e2.includes("type: 'triviaSection',\n        question: deltaText(block.question || ''),")) {
  e2 = e2.replace(
    "type: 'triviaSection',\n        question: deltaText(block.question || ''),",
    "type: 'triviaSection',\n        title: deltaText('חידון'),\n        description: deltaText(block.question || ''),\n        question: deltaText(block.question || ''),"
  );
  e2changed = true;
  console.log('✅ BlockEditor.jsx: triviaSection saves question to description');
} else if (e2.includes("title: deltaText('חידון')")) {
  console.log('ℹ️  BlockEditor.jsx: triviaSection already saves description');
}

if (e2changed) fs.writeFileSync(editorPath, e2);

// ── 5. StoryPattern.jsx — render separatorSection ─────────────────────────────

const storyPath2 = `${SERVER}/components/patterns/StoryPattern.jsx`;
let ss2 = fs.readFileSync(storyPath2, 'utf8');

if (!ss2.includes('separatorSection')) {
  ss2 = ss2.replace(
    'function renderSection(section, folderId) {\n  switch (section.type) {',
    `const separatorStyles = {
  line:   { borderTop: '1px solid #e2e8f0', margin: '16px 0' },
  thick:  { borderTop: '3px solid #cbd5e1', margin: '16px 0' },
  dotted: { borderTop: '2px dotted #cbd5e1', margin: '16px 0' },
  space:  { height: 40 },
}

function renderSection(section, folderId) {
  switch (section.type) {
    case 'separatorSection': {
      const sepStyle = separatorStyles[section.style] || separatorStyles.line
      return <div key={section.id} style={sepStyle} />
    }`
  );
  fs.writeFileSync(storyPath2, ss2);
  console.log('✅ StoryPattern.jsx: separatorSection renders correctly');
} else {
  console.log('ℹ️  StoryPattern.jsx: separatorSection already present');
}

console.log('\nPatch done. Now run:');
console.log('  cd /opt/playbuzz-renderer/client && npm run build && pm2 restart all');
