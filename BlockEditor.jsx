import { useState, useRef } from 'react';
import BlockToolbar from './BlockToolbar';
import BlockRenderer from './BlockRenderer';

const BLOCK_TYPES = [
  { type: 'header',            label: 'כותרת',           icon: 'H'   },
  { type: 'text',              label: 'טקסט',            icon: 'T'   },
  { type: 'image',             label: 'תמונה',           icon: '🖼'  },
  { type: 'video',             label: 'וידאו',           icon: '▶'   },
  { type: 'youtube',           label: 'YouTube',         icon: '▶️'  },
  { type: 'iframe',            label: 'Embed',           icon: '</>' },
  { type: 'separator',         label: 'מפריד',           icon: '─'   },
  { type: 'flip-card',         label: 'כרטיס הפיך',     icon: '🃏'  },
  { type: 'multiple-choice',   label: 'בחירה מרובה',    icon: '☑'   },
  { type: 'open-question',     label: 'שאלה פתוחה',     icon: '❓'  },
  { type: 'choose-answer',     label: 'בחר תשובה (4)',  icon: '🔘'  },
  { type: 'connect',           label: 'חיבור זוגות',    icon: '🔗'  },
  { type: 'drag-answer',       label: 'גרור תשובה',     icon: '✋'  },
  { type: 'videoCreator',      label: 'וידאו (מקומי)',  icon: '🎬'  },
];

function createBlock(type) {
  const id = `block_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const defaults = {
    header:            { type, id, content: 'כותרת חדשה', level: 2 },
    text:              { type, id, content: '' },
    image:             { type, id, url: '', alt: '', caption: '' },
    video:             { type, id, url: '', poster: '' },
    youtube:           { type, id, videoId: '', start: 0 },
    iframe:            { type, id, url: '', height: 400 },
    separator:         { type, id, style: 'line' },
    'flip-card':       { type, id, frontText: 'חזית', backText: 'גב', frontImage: '', backImage: '' },
    'multiple-choice': { type, id, question: '', answers: [{ text: '', correct: false }, { text: '', correct: false }] },
    'open-question':   { type, id, question: '', placeholder: 'כתוב תשובתך כאן...' },
    'choose-answer':   { type, id, question: '', options: ['', '', '', ''], correct: 0 },
    'connect':         { type, id, pairs: [{ right: '', left: '' }, { right: '', left: '' }] },
    'drag-answer':     { type, id, sentence: 'השלם את ___', answers: ['תשובה 1', 'תשובה 2'], correct: 0 },
    videoCreator:      { type, id, mp4: '', poster: '' },
  };
  return defaults[type] || { type, id };
}

export default function BlockEditor({ sections, onChange, gameId, authFetch }) {
  const [blocks, setBlocks] = useState(() => sectionsToBlocks(sections));
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [selected, setSelected] = useState(null);
  const dragNode = useRef(null);

  const update = (newBlocks) => {
    setBlocks(newBlocks);
    onChange?.(blocksToSections(newBlocks));
  };

  const addBlock = (type) => {
    const block = createBlock(type);
    const newBlocks = [...blocks, block];
    update(newBlocks);
    setSelected(block.id);
  };

  const updateBlock = (id, changes) => {
    update(blocks.map(b => b.id === id ? { ...b, ...changes } : b));
  };

  const deleteBlock = (id) => {
    update(blocks.filter(b => b.id !== id));
    if (selected === id) setSelected(null);
  };

  const moveBlock = (from, to) => {
    const arr = [...blocks];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    update(arr);
  };

  const duplicateBlock = (id) => {
    const idx = blocks.findIndex(b => b.id === id);
    const copy = { ...blocks[idx], id: `block_${Date.now()}` };
    const arr = [...blocks];
    arr.splice(idx + 1, 0, copy);
    update(arr);
  };

  const onDragStart = (e, idx) => { dragNode.current = idx; setDragIdx(idx); e.dataTransfer.effectAllowed = 'move'; };
  const onDragOver  = (e, idx) => { e.preventDefault(); setDragOverIdx(idx); };
  const onDrop = (e, idx) => {
    e.preventDefault();
    if (dragNode.current !== null && dragNode.current !== idx) moveBlock(dragNode.current, idx);
    setDragIdx(null); setDragOverIdx(null); dragNode.current = null;
  };

  return (
    <div style={s.root}>
      <div style={s.canvas}>
        {blocks.length === 0 && (
          <div style={s.empty}>
            <p>אין בלוקים עדיין</p>
            <p style={{ fontSize: 13, opacity: 0.6 }}>השתמש בסרגל הכלים למטה להוספת בלוקים</p>
          </div>
        )}

        {blocks.map((block, idx) => (
          <div
            key={block.id}
            draggable
            onDragStart={e => onDragStart(e, idx)}
            onDragOver={e => onDragOver(e, idx)}
            onDrop={e => onDrop(e, idx)}
            onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
            style={{
              ...s.blockWrapper,
              ...(selected === block.id ? s.blockSelected : {}),
              ...(dragOverIdx === idx ? s.blockDragOver : {}),
              opacity: dragIdx === idx ? 0.4 : 1,
            }}
            onClick={() => setSelected(block.id)}
          >
            <div style={s.dragHandle} title="גרור לשינוי סדר">⠿</div>
            <div style={s.blockContent}>
              <BlockRenderer
                block={block}
                isEditing={selected === block.id}
                onChange={changes => updateBlock(block.id, changes)}
                gameId={gameId}
                authFetch={authFetch}
              />
            </div>
            {selected === block.id && (
              <div style={s.blockActions}>
                <button style={s.actionBtn} onClick={e => { e.stopPropagation(); moveBlock(idx, Math.max(0, idx - 1)); }} title="העלה">↑</button>
                <button style={s.actionBtn} onClick={e => { e.stopPropagation(); moveBlock(idx, Math.min(blocks.length - 1, idx + 1)); }} title="הורד">↓</button>
                <button style={s.actionBtn} onClick={e => { e.stopPropagation(); duplicateBlock(block.id); }} title="שכפל">⧉</button>
                <button style={{...s.actionBtn, ...s.actionDelete}} onClick={e => { e.stopPropagation(); deleteBlock(block.id); }} title="מחק">✕</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <BlockToolbar types={BLOCK_TYPES} onAdd={addBlock} />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractDeltaText(delta) {
  if (!delta) return '';
  // Handle JSON-stringified Delta
  if (typeof delta === 'string') {
    try {
      const p = JSON.parse(delta);
      if (p?.ops) return p.ops.map(op => typeof op.insert === 'string' ? op.insert : '').join('').replace(/\n$/, '').trim();
    } catch {}
    return delta;
  }
  if (delta.ops) return delta.ops.map(op => typeof op.insert === 'string' ? op.insert : '').join('').replace(/\n$/, '').trim();
  return '';
}

function deltaText(text) {
  return { ops: [{ insert: (text || '') + '\n' }] };
}

// ── sections → blocks ─────────────────────────────────────────────────────────
// sections is [[sec, sec, ...], [sec, ...], ...] — flatten first

function sectionsToBlocks(sections = []) {
  const flat = Array.isArray(sections[0]) ? sections.flat() : sections;
  return flat.map((sec, i) => {
    const id = `block_${i}_${Date.now()}`;
    const media = sec.media || {};
    const mt = media.mediaType;

    switch (sec.type) {
      case 'paragraphSection':
        return { type: 'text', id, content: extractDeltaText(sec.text || sec.title) };

      case 'imageSection':
      case 'mediaSection':
        if (mt === 'youtube') return { type: 'youtube', id, videoId: media.videoId || '', start: media.videoStart || 0 };
        if (mt === 'video')   return { type: 'video',   id, url: media.originalVideoUrl || media.url || '', poster: '' };
        if (mt === 'iframe')  return { type: 'iframe',  id, url: media.url || '', height: 400 };
        return { type: 'image', id, url: media.url || media.originalImageUrl || '', alt: '', caption: extractDeltaText(sec.title) };

      case 'triviaSection':
        return {
          type: 'multiple-choice', id,
          question: extractDeltaText(sec.question || sec.title),
          answers: (sec.answers || []).map(a => ({ text: extractDeltaText(a.title || a.text), correct: !!a.isCorrect })),
        };

      case 'flipCardSection': {
        const fm = sec.media?.frontMedia || {};
        const bm = sec.media?.backMedia  || {};
        return {
          type: 'flip-card', id,
          frontText: extractDeltaText(fm.text) || '', frontImage: fm.backgroundMedia?.url || '', _rawFront: fm,
          backText:  extractDeltaText(bm.text) || '', backImage:  bm.backgroundMedia?.url || '', _rawBack:  bm,
        };
      }

      case 'quoteSection':
      case 'convoSection':
        return { type: 'text', id, content: extractDeltaText(sec.text || sec.title) };

      case 'videoCreatorSection':
        return { type: 'videoCreator', id, mp4: sec.video?.mp4?.src || '', poster: sec.video?.jpg?.src || '' };

      default:
        // Legacy format keyed by media.mediaType
        if (mt === 'image')     return { type: 'image',   id, url: media.url || media.originalImageUrl || '', alt: '', caption: extractDeltaText(sec.title) };
        if (mt === 'youtube')   return { type: 'youtube', id, videoId: media.videoId || '', start: media.videoStart || 0 };
        if (mt === 'video')     return { type: 'video',   id, url: media.originalVideoUrl || '', poster: '' };
        if (mt === 'iframe')    return { type: 'iframe',  id, url: media.url || '', height: 400 };
        if (mt === 'text-card') return { type: 'text',    id, content: extractDeltaText(sec.title) };
        if (mt === 'flip-card') {
          const fm = media.frontMedia || {};
          const bm = media.backMedia  || {};
          return { type: 'flip-card', id, frontText: extractDeltaText(fm.text) || '', frontImage: fm.backgroundMedia?.url || '', _rawFront: fm, backText: extractDeltaText(bm.text) || '', backImage: bm.backgroundMedia?.url || '', _rawBack: bm };
        }
        // Unknown — show as plain text so nothing is lost
        return { type: 'text', id, content: extractDeltaText(sec.title || sec.text) || '' };
    }
  });
}

// ── blocks → sections ─────────────────────────────────────────────────────────
// Wrap each block as its own slide [[sec], [sec], ...] to match Playbuzz format

function blockToSection(block) {
  switch (block.type) {
    case 'image':
      return { type: 'mediaSection', title: deltaText(block.caption || ''), media: { mediaType: 'image', url: block.url, originalImageUrl: block.url, alt: block.alt || '' } };
    case 'youtube':
      return { type: 'mediaSection', title: deltaText(''), media: { mediaType: 'youtube', videoId: block.videoId, videoStart: block.start || 0 } };
    case 'video':
      return { type: 'mediaSection', title: deltaText(''), media: { mediaType: 'video', originalVideoUrl: block.url } };
    case 'iframe':
      return { type: 'mediaSection', title: deltaText(''), media: { mediaType: 'iframe', url: block.url } };
    case 'text':
      return { type: 'paragraphSection', title: deltaText(''), text: deltaText(block.content || '') };
    case 'header':
      return { type: 'paragraphSection', title: deltaText(block.content || ''), text: deltaText('') };
    case 'separator':
      return { type: 'paragraphSection', title: deltaText(''), text: deltaText('') };
    case 'flip-card': {
      const fm = { ...(block._rawFront || {}), text: block.frontText || '' };
      const bm = { ...(block._rawBack  || {}), text: block.backText  || '' };
      return { type: 'flipCardSection', title: deltaText(''), media: { mediaType: 'flip-card', ratio: 'landscape', frontMedia: fm, backMedia: bm } };
    }
    case 'multiple-choice':
      return {
        type: 'triviaSection',
        question: deltaText(block.question || ''),
        answers: (block.answers || []).map(a => ({ title: deltaText(a.text), isCorrect: !!a.correct })),
      };
    case 'open-question':
      return { type: 'paragraphSection', title: deltaText(block.question || ''), text: deltaText(block.placeholder || '') };
    case 'choose-answer':
      return {
        type: 'triviaSection',
        question: deltaText(block.question || ''),
        answers: (block.options || []).map((o, i) => ({ title: deltaText(o), isCorrect: i === block.correct })),
      };
    case 'connect':
      return { type: 'paragraphSection', title: deltaText(''), text: deltaText('') };
    case 'drag-answer':
      return { type: 'paragraphSection', title: deltaText(block.sentence || ''), text: deltaText('') };
    case 'videoCreator':
      return { type: 'videoCreatorSection', video: { mp4: { src: block.mp4, type: 'video/mp4' }, jpg: { src: block.poster, type: 'image' } } };
    default:
      return { type: 'paragraphSection', title: deltaText(''), text: deltaText('') };
  }
}

function blocksToSections(blocks) {
  return blocks.map(block => [blockToSection(block)]);
}

const s = {
  root: { display: 'flex', flexDirection: 'column', height: '100%', background: '#0f1117' },
  canvas: { flex: 1, overflow: 'auto', padding: '24px 40px', display: 'flex', flexDirection: 'column', gap: 8 },
  empty: { textAlign: 'center', color: '#475569', padding: 80, fontSize: 16 },
  blockWrapper: {
    position: 'relative', background: '#1e2235', borderRadius: 10,
    border: '2px solid transparent', cursor: 'pointer',
    display: 'flex', alignItems: 'flex-start', gap: 8,
    transition: 'border-color 0.15s',
  },
  blockSelected: { borderColor: '#7c3aed' },
  blockDragOver: { borderColor: '#06b6d4', background: '#1a2a35' },
  blockContent: { flex: 1, padding: '12px 12px 12px 0' },
  dragHandle: { color: '#334155', fontSize: 18, padding: '14px 6px', cursor: 'grab', userSelect: 'none', flexShrink: 0 },
  blockActions: { position: 'absolute', top: 8, left: 8, display: 'flex', gap: 4 },
  actionBtn: {
    background: '#334155', border: 'none', borderRadius: 6,
    color: '#94a3b8', cursor: 'pointer', width: 28, height: 28,
    fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  actionDelete: { background: '#7f1d1d', color: '#fca5a5' },
};
