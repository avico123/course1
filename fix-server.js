#!/usr/bin/env node
// Patches server files that aren't in GitHub:
// 1. FlipCardSection.jsx — fix renderDelta crash on plain strings
// 2. blocks/index.jsx — fix FlipCardBlock to use frontText/backText + ImagePicker
// 3. BlockRenderer.jsx — ensure gameId prop is forwarded to block components
// 4. Guard renderDelta in all pattern files

const fs = require('fs');

const SERVER = '/opt/playbuzz-renderer/client/src';

// ── 1. FlipCardSection.jsx ──────────────────────────────────────────────────

const flipCardPath = `${SERVER}/components/patterns/FlipCardSection.jsx`;

if (fs.existsSync(flipCardPath)) {
  let src = fs.readFileSync(flipCardPath, 'utf8');
  let changed = false;

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

// ── 2. blocks/index.jsx — ImagePicker + FlipCardBlock ───────────────────────

const blocksPath = `${SERVER}/admin/editor/blocks/index.jsx`;

if (fs.existsSync(blocksPath)) {
  let src = fs.readFileSync(blocksPath, 'utf8');

  // ── 2a. Ensure useState/useRef are imported ────────────────────────────────
  // blocks/index.jsx may use named imports; add useState/useRef if missing
  if (/^import\s+.*from\s+['"]react['"]/m.test(src)) {
    // Has a React import — ensure useState and useRef are included
    src = src.replace(
      /^(import\s+)(\{[^}]+\})(\s+from\s+['"]react['"])/m,
      (m, pre, names, post) => {
        let n = names;
        if (!n.includes('useState')) n = n.replace('{', '{ useState,');
        if (!n.includes('useRef'))   n = n.replace('{', '{ useRef,');
        return pre + n + post;
      }
    );
    // If it was a default import (import React from 'react'), add named alongside
    if (!/import\s*\{/.test(src.split('\n').find(l => l.includes("from 'react'") || l.includes('from "react"')) || '')) {
      src = src.replace(
        /^(import\s+React\s+from\s+['"]react['"])/m,
        "import React, { useState, useRef } from 'react'"
      );
    }
    fs.writeFileSync(blocksPath, src);
    console.log('✅ blocks/index.jsx: ensured useState/useRef imports');
    src = fs.readFileSync(blocksPath, 'utf8');
  }

  // ── 2b. Inject ImagePicker component if missing ─────────────────────────────
  if (!src.includes('function ImagePicker')) {
    const imagePicker = `
function ImagePicker({ gameId, value, onChange }) {
  const [browsing, setBrowsing] = useState(false);
  const [serverFiles, setServerFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const upload = async (file) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const r = await fetch(\`/api/games/\${gameId}/upload\`, { method: 'POST', body: fd });
      const d = await r.json();
      onChange(d.servePath || d.url || '');
    } catch(e) { console.error('Upload error', e); }
    setUploading(false);
  };

  const browse = async () => {
    setLoading(true);
    setBrowsing(true);
    try {
      const r = await fetch(\`/api/games/\${gameId}/files\`);
      setServerFiles(await r.json());
    } catch(e) { console.error('Browse error', e); }
    setLoading(false);
  };

  return (
    <div>
      {value && (
        <img src={value} alt="" style={{ width: '100%', maxHeight: 90, objectFit: 'cover', borderRadius: 6, marginBottom: 6, border: '1px solid #334155' }} />
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => e.target.files[0] && upload(e.target.files[0])} />
        <button type="button"
          style={{ flex: 1, background: uploading ? '#1e3a5f' : '#1e40af', color: '#bfdbfe', border: 'none', borderRadius: 6, padding: '5px 0', fontSize: 12, cursor: uploading ? 'wait' : 'pointer' }}
          onClick={() => inputRef.current && inputRef.current.click()}>
          {uploading ? '⏳' : '⬆'} העלה
        </button>
        <button type="button"
          style={{ flex: 1, background: '#065f46', color: '#a7f3d0', border: 'none', borderRadius: 6, padding: '5px 0', fontSize: 12, cursor: 'pointer' }}
          onClick={browse}>
          🖼 גלישה
        </button>
      </div>
      <input type="text" placeholder="או הדבק URL..."
        style={{ width: '100%', background: '#0f1117', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, padding: '5px 8px', fontSize: 11, marginTop: 4, boxSizing: 'border-box', direction: 'ltr' }}
        value={value || ''}
        onChange={e => onChange(e.target.value)} />
      {browsing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => e.target === e.currentTarget && setBrowsing(false)}>
          <div style={{ background: '#1e2235', borderRadius: 14, padding: 20, maxWidth: 640, maxHeight: '75vh', overflow: 'auto', width: '92%', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ color: '#e2e8f0', fontWeight: 'bold', fontSize: 15 }}>בחר תמונה מהשרת</span>
              <button type="button" onClick={() => setBrowsing(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            {loading ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>טוען...</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {serverFiles.map(f => (
                  <div key={f.filename} style={{ position: 'relative', cursor: 'pointer', borderRadius: 8, overflow: 'hidden', border: '2px solid transparent' }}
                    onClick={() => { onChange(f.servePath); setBrowsing(false); }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#7c3aed'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
                    <img src={f.servePath} alt={f.filename}
                      style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
                      onError={e => { e.target.style.display='none'; }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: '#cbd5e1', fontSize: 9, padding: '2px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.filename}</div>
                  </div>
                ))}
                {serverFiles.length === 0 && (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#64748b', padding: 40 }}>אין תמונות בשרת לגיים זה</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

`;

    // Insert before the first function or export
    const insertBefore = src.search(/\nfunction [A-Z]|\nexport /);
    if (insertBefore !== -1) {
      src = src.slice(0, insertBefore) + imagePicker + src.slice(insertBefore);
      fs.writeFileSync(blocksPath, src);
      console.log('✅ blocks/index.jsx: ImagePicker component injected');
    } else {
      // Prepend
      src = imagePicker + src;
      fs.writeFileSync(blocksPath, src);
      console.log('✅ blocks/index.jsx: ImagePicker prepended');
    }
    // Re-read after write
    src = fs.readFileSync(blocksPath, 'utf8');
  } else {
    console.log('ℹ️  blocks/index.jsx: ImagePicker already present');
  }

  // ── 2c. Replace FlipCardBlock (remove ALL occurrences, insert one clean copy) ─
  // Skip if the deployed file already has the correct implementation (ImagePicker + frontText)
  if (src.includes('function FlipCardBlock') && src.includes('ImagePicker') && src.includes('frontText')) {
    console.log('ℹ️  blocks/index.jsx: FlipCardBlock already has correct implementation, skipping replacement');
  } else {

  const newFlipCard = `function FlipCardBlock({ block, isEditing, onChange, gameId }) {
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
            {block[s.img] && <img src={block[s.img]} alt="" style={{ maxWidth: '100%', maxHeight: 80, borderRadius: 4, marginBottom: 6, objectFit: 'cover' }} />}
            <div>{typeof block[s.t] === 'string' ? block[s.t] : (block[s.t]?.ops ? block[s.t].ops.map(o => o.insert).join('') : '...')}</div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {SIDES.map(s => (
        <div key={s.t} style={{ flex: 1, background: '#1a2235', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, fontWeight: 'bold' }}>{s.name}</div>
          <textarea
            rows={3}
            style={{ width: '100%', background: '#0f1117', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, padding: 8, fontSize: 14, resize: 'vertical', boxSizing: 'border-box', direction: 'rtl' }}
            value={typeof block[s.t] === 'string' ? block[s.t] : ''}
            onChange={e => { const ch = {}; ch[s.t] = e.target.value; onChange(ch); }}
          />
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 10, marginBottom: 4 }}>תמונה</div>
          <ImagePicker gameId={gameId} value={block[s.img] || ''} onChange={v => { const ch = {}; ch[s.img] = v; onChange(ch); }} />
        </div>
      ))}
    </div>
  );
}
`;

  // Remove ALL existing FlipCardBlock definitions (handles duplicates), then append one clean copy
  src = fs.readFileSync(blocksPath, 'utf8');
  let removedCount = 0;
  // Remove each occurrence using a loop (regex can only match one at a time with reset)
  let safety = 10;
  while (src.includes('function FlipCardBlock') && safety-- > 0) {
    // Find start of this FlipCardBlock — include optional leading 'export ' keyword
    let start = src.indexOf('function FlipCardBlock');
    const exportPrefix = 'export ';
    if (start >= exportPrefix.length && src.slice(start - exportPrefix.length, start) === exportPrefix) {
      start -= exportPrefix.length;
    }
    // Find end: next top-level function/export/const after the closing brace
    // Walk forward counting braces to find the function end
    let depth = 0;
    let i = start;
    let inFunc = false;
    while (i < src.length) {
      if (src[i] === '{') { depth++; inFunc = true; }
      else if (src[i] === '}') { depth--; if (inFunc && depth === 0) { i++; break; } }
      i++;
    }
    // Remove from start to i, collapsing any trailing blank lines
    while (i < src.length && (src[i] === '\n' || src[i] === '\r')) i++;
    src = src.slice(0, start) + src.slice(i);
    removedCount++;
  }
  // Append the new clean version before any trailing export block
  const exportIdx = src.lastIndexOf('\nexport ');
  if (exportIdx !== -1) {
    src = src.slice(0, exportIdx) + '\n' + newFlipCard + '\n' + src.slice(exportIdx);
  } else {
    src = src + '\n' + newFlipCard;
  }
  fs.writeFileSync(blocksPath, src);
  console.log(`✅ blocks/index.jsx: removed ${removedCount} old FlipCardBlock(s), inserted new one with ImagePicker`);
  } // end else (replacement needed)
} else {
  console.log(`⚠️  Not found: ${blocksPath}`);
}

// ── 3. BlockRenderer.jsx — ensure gameId is forwarded to block components ────

const blockRendererPath = `${SERVER}/admin/editor/BlockRenderer.jsx`;

if (fs.existsSync(blockRendererPath)) {
  let src = fs.readFileSync(blockRendererPath, 'utf8');
  let changed = false;

  // Pattern: <Component ... /> or <Component ... > without gameId
  // We look for JSX renders of block components and add gameId if missing
  if (!src.includes('gameId={gameId}') && src.includes('gameId')) {
    // gameId is in props but not forwarded — patch the component render
    src = src.replace(
      /(<\w+Block\b[^>]*?)(\/?>)/g,
      (m, open, close) => {
        if (open.includes('gameId')) return m;
        return `${open} gameId={gameId}${close}`;
      }
    );
    changed = true;
    console.log('✅ BlockRenderer.jsx: added gameId forwarding to block components');
  } else if (src.includes('gameId={gameId}')) {
    console.log('ℹ️  BlockRenderer.jsx: gameId already forwarded');
  } else {
    // gameId not in props at all — patch function signature and render
    src = src.replace(
      /function BlockRenderer\(\s*\{([^}]+)\}\s*\)/,
      (m, params) => {
        if (params.includes('gameId')) return m;
        return `function BlockRenderer({ ${params.trim()}, gameId })`;
      }
    );
    src = src.replace(
      /const BlockRenderer = \(\s*\{([^}]+)\}\s*\)/,
      (m, params) => {
        if (params.includes('gameId')) return m;
        return `const BlockRenderer = ({ ${params.trim()}, gameId })`;
      }
    );
    // Add gameId to block component render
    src = src.replace(
      /(<\w+Block\b[^/\n>]*)(\/?>)/g,
      (m, open, close) => {
        if (open.includes('gameId')) return m;
        return `${open} gameId={gameId}${close}`;
      }
    );
    changed = true;
    console.log('✅ BlockRenderer.jsx: added gameId to signature and forwarding');
  }

  if (changed) fs.writeFileSync(blockRendererPath, src);
} else {
  console.log(`⚠️  Not found: ${blockRendererPath} — skipping gameId patch`);
}

// ── 4. Guard renderDelta in all pattern files ────────────────────────────────

const patternFiles = [
  `${SERVER}/components/patterns/GalleryPattern.jsx`,
  `${SERVER}/components/patterns/TestYourselfPattern.jsx`,
  `${SERVER}/components/patterns/MultipleChoicePattern.jsx`,
  `${SERVER}/components/patterns/QuoteSection.jsx`,
];
for (const pf of patternFiles) {
  if (!fs.existsSync(pf)) { console.log(`⚠️  Not found: ${pf}`); continue; }
  let src = fs.readFileSync(pf, 'utf8');
  const before = src;
  src = src.replace(/renderDelta\((\w+(?:\.\w+)*)\)/g, (m, v) => {
    if (src.includes(`typeof ${v}`) ) return m;
    return `typeof ${v} === 'string' ? ${v} : ${m}`;
  });
  if (src !== before) { fs.writeFileSync(pf, src); console.log(`✅ ${pf.split('/').pop()}: guarded renderDelta calls`); }
  else console.log(`ℹ️  ${pf.split('/').pop()}: already guarded`);
}

console.log('\nDone.');
