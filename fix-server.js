#!/usr/bin/env node
// Patches server files that aren't in GitHub:
// 1. FlipCardSection.jsx — fix renderDelta crash on plain strings
// 2. blocks/index.jsx — fix FlipCardBlock to use frontText/backText

const fs = require('fs');

const SERVER = '/opt/playbuzz-renderer/client/src';

// ── 1. FlipCardSection.jsx ──────────────────────────────────────────────────

const flipCardPath = `${SERVER}/components/patterns/FlipCardSection.jsx`;

if (fs.existsSync(flipCardPath)) {
  let src = fs.readFileSync(flipCardPath, 'utf8');
  let changed = false;

  // Fix renderDelta(text) where text may be a plain string
  if (src.includes('renderDelta(text)') && !src.includes('typeof text')) {
    src = src.replace(
      /renderDelta\(text\)/g,
      "typeof text === 'string' ? text : renderDelta(text)"
    );
    changed = true;
    console.log('✅ FlipCardSection.jsx: fixed renderDelta plain-string crash');
  } else if (src.includes("typeof text === 'string'")) {
    console.log('ℹ️  FlipCardSection.jsx: renderDelta fix already applied');
  } else {
    console.log('⚠️  FlipCardSection.jsx: renderDelta(text) not found — check manually');
  }

  if (changed) fs.writeFileSync(flipCardPath, src);
} else {
  console.log(`⚠️  Not found: ${flipCardPath}`);
}

// ── 2. blocks/index.jsx — fix FlipCardBlock ─────────────────────────────────

const blocksPath = `${SERVER}/admin/editor/blocks/index.jsx`;

if (fs.existsSync(blocksPath)) {
  let src = fs.readFileSync(blocksPath, 'utf8');
  let changed = false;

  // If FlipCardBlock still references block.front.text (old format), replace the whole component
  if (src.includes('block.front') || src.includes('block.back')) {
    // Find and replace the FlipCardBlock function
    const oldPattern = /function FlipCardBlock[\s\S]*?(?=\nfunction |\nexport |\nconst [A-Z])/;
    const newFlipCard = `function FlipCardBlock({ block, isEditing, onChange }) {
  const SIDES = [
    { t: 'frontText', img: 'frontImage', name: 'חזית' },
    { t: 'backText',  img: 'backImage',  name: 'גב'   },
  ];
  if (!isEditing) {
    return (
      <div style={{ display: 'flex', gap: 12 }}>
        {SIDES.map(s => (
          <div key={s.t} style={{ flex: 1, background: '#1a2235', borderRadius: 8, padding: 16, minHeight: 80, color: '#e2e8f0', fontSize: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>{s.name}</div>
            {block[s.img] && <img src={block[s.img]} alt="" style={{ maxWidth: '100%', maxHeight: 80, borderRadius: 4, marginBottom: 6 }} />}
            <div>{block[s.t] || '...'}</div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {SIDES.map(s => (
        <div key={s.t} style={{ flex: 1, background: '#1a2235', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>{s.name}</div>
          <textarea
            rows={3}
            style={{ width: '100%', background: '#0f1117', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, padding: 8, fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }}
            value={block[s.t] || ''}
            onChange={e => { const ch = {}; ch[s.t] = e.target.value; onChange(ch); }}
          />
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>תמונה (URL)</div>
          <input
            type="text"
            style={{ width: '100%', background: '#0f1117', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, padding: '6px 8px', fontSize: 12, marginTop: 4, boxSizing: 'border-box' }}
            value={block[s.img] || ''}
            onChange={e => { const ch = {}; ch[s.img] = e.target.value; onChange(ch); }}
          />
        </div>
      ))}
    </div>
  );
}

`;
    const newSrc = src.replace(oldPattern, newFlipCard);
    if (newSrc !== src) {
      fs.writeFileSync(blocksPath, newSrc);
      changed = true;
      console.log('✅ blocks/index.jsx: FlipCardBlock rewritten with frontText/backText');
    } else {
      console.log('⚠️  blocks/index.jsx: FlipCardBlock pattern not matched — check manually');
    }
  } else {
    console.log('ℹ️  blocks/index.jsx: FlipCardBlock already uses correct field names');
  }
} else {
  console.log(`⚠️  Not found: ${blocksPath}`);
}

console.log('\nDone.');
