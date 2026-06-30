#!/usr/bin/env node
// repair-v2.js — replaces the entire FLIP CARD section (between known markers)
// with one clean FlipCardBlock. No brace-counting needed.

const fs = require('fs');
const p = '/opt/playbuzz-renderer/client/src/admin/editor/blocks/index.jsx';
let src = fs.readFileSync(p, 'utf8');
console.log('repair-v2.js — file length:', src.length);

// Marker 1: start of the flip-card section (the comment line)
const startMarker = '// ─── FLIP CARD';
// Marker 2: the first thing after the flip-card section
const endMarker   = '\nexport function MultipleChoiceBlock';

const startIdx = src.indexOf(startMarker);
const endIdx   = src.indexOf(endMarker);

if (startIdx === -1) { console.error('ERROR: FLIP CARD marker not found'); process.exit(1); }
if (endIdx   === -1) { console.error('ERROR: MultipleChoiceBlock marker not found'); process.exit(1); }

if (startIdx >= endIdx) {
  console.error('ERROR: markers are in wrong order:', startIdx, endIdx);
  process.exit(1);
}

console.log('Replacing lines', src.slice(0, startIdx).split('\n').length,
            '→', src.slice(0, endIdx).split('\n').length);

const newSection = `// ─── FLIP CARD ────────────────────────────────────────────────────────────────────────────────

function FlipCardBlock({ block, isEditing, onChange, gameId }) {
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
            <div>{typeof block[s.t] === 'string' ? block[s.t] : (block[s.t] && block[s.t].ops ? block[s.t].ops.map(function(o){ return o.insert; }).join('') : '...')}</div>
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
            onChange={function(e) { var ch = {}; ch[s.t] = e.target.value; onChange(ch); }}
          />
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 10, marginBottom: 4 }}>תמונה</div>
          <ImagePicker gameId={gameId} value={block[s.img] || ''} onChange={function(v) { var ch = {}; ch[s.img] = v; onChange(ch); }} />
        </div>
      ))}
    </div>
  );
}

`;

src = src.slice(0, startIdx) + newSection + src.slice(endIdx);
fs.writeFileSync(p, src);
console.log('Done. File length now:', src.length);
console.log('FlipCard occurrences:');
src.split('\n').forEach(function(line, i) {
  if (line.includes('FlipCardBlock') || line.includes('const SIDES')) {
    console.log('  line ' + (i+1) + ': ' + line.trim().slice(0, 80));
  }
});
