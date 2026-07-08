// @deployed-from-github — fix-server.js must skip blocks patching for this file
import { useState, useRef } from 'react';

// ─── Shared styles ────────────────────────────────────────────────────────────
const inp = {
  background: '#0f1117', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, padding: '8px 12px', color: '#e2e8f0', fontSize: 14,
  width: '100%', boxSizing: 'border-box', outline: 'none', direction: 'rtl',
};
const label = { fontSize: 12, color: '#64748b', marginBottom: 4, display: 'block' };
const field = { marginBottom: 12 };
const badge = { fontSize: 11, background: '#334155', padding: '2px 8px', borderRadius: 20, color: '#94a3b8' };
const row = { display: 'flex', gap: 8, alignItems: 'center' };

function safeText(val) {
  if (!val) return '';
  if (typeof val === 'string') {
    try { const p = JSON.parse(val); if (p?.ops) return p.ops.map(o => typeof o.insert === 'string' ? o.insert : '').join('').replace(/\n$/, '').trim(); } catch {}
    return val;
  }
  if (val?.ops) return val.ops.map(o => typeof o.insert === 'string' ? o.insert : '').join('').replace(/\n$/, '').trim();
  return String(val);
}

function textDir(str = '') {
  const rtl = (str.match(/[֐-߿יִ-﷽ﹰ-ﻼ]/g) || []).length;
  const ltr = (str.match(/[A-Za-zÀ-ɏɐ-ʯ]/g) || []).length;
  if (rtl === 0 && ltr === 0) return 'rtl';
  return rtl > ltr ? 'rtl' : 'ltr';
}

// ─── Shared ImagePicker ───────────────────────────────────────────────────────
function ImagePicker({ gameId, value, onChange, authFetch: af }) {
  const apiFetch = af || fetch;
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
      const r = await apiFetch(`/api/games/${gameId}/upload`, { method: 'POST', body: fd });
      const d = await r.json();
      onChange(d.servePath || d.url || '');
    } catch (e) { console.error('Upload error', e); }
    setUploading(false);
  };

  const browse = async () => {
    setLoading(true); setBrowsing(true);
    try {
      const r = await apiFetch(`/api/games/${gameId}/files`);
      setServerFiles(await r.json());
    } catch (e) { console.error('Browse error', e); }
    setLoading(false);
  };

  return (
    <div>
      {value && <img src={value} alt="" style={{ width: '100%', maxHeight: 90, objectFit: 'cover', borderRadius: 6, marginBottom: 6, border: '1px solid #334155' }} />}
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files[0] && upload(e.target.files[0])} />
        <button type="button"
          style={{ flex: 1, background: uploading ? '#1e3a5f' : '#1e40af', color: '#bfdbfe', border: 'none', borderRadius: 6, padding: '5px 0', fontSize: 12, cursor: uploading ? 'wait' : 'pointer' }}
          onClick={() => inputRef.current?.click()}>
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
        value={value || ''} onChange={e => onChange(e.target.value)} />
      {browsing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => e.target === e.currentTarget && setBrowsing(false)}>
          <div style={{ background: '#1e2235', borderRadius: 14, padding: 20, maxWidth: 640, maxHeight: '75vh', overflow: 'auto', width: '92%', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ color: '#e2e8f0', fontWeight: 'bold', fontSize: 15 }}>בחר תמונה מהשרת</span>
              <button type="button" onClick={() => setBrowsing(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            {loading ? <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>טוען...</div> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {serverFiles.map(f => (
                  <div key={f.filename} style={{ position: 'relative', cursor: 'pointer', borderRadius: 8, overflow: 'hidden', border: '2px solid transparent' }}
                    onClick={() => { onChange(f.servePath); setBrowsing(false); }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#7c3aed'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
                    <img src={f.servePath} alt={f.filename} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} onError={e => { e.target.style.display = 'none'; }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: '#cbd5e1', fontSize: 9, padding: '2px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.filename}</div>
                  </div>
                ))}
                {serverFiles.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#64748b', padding: 40 }}>אין תמונות בשרת לגיים זה</div>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label: lbl, children }) {
  return <div style={field}><span style={label}>{lbl}</span>{children}</div>;
}

function EditWrap({ typeLabel, children, preview }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={badge}>{typeLabel}</span>
      </div>
      {preview && <div style={{ marginBottom: 12 }}>{preview}</div>}
      {children}
    </div>
  );
}

function ViewWrap({ children }) {
  return <div style={{ minHeight: 32 }}>{children}</div>;
}

// ─── IMAGE ────────────────────────────────────────────────────────────────────
export function ImageBlock({ block, isEditing, onChange, gameId, authFetch }) {
  if (!isEditing) return (
    <ViewWrap>
      {block.url
        ? <img src={block.url} alt={block.alt} style={{ maxWidth: '100%', borderRadius: 8, display: 'block' }} />
        : <div style={{ height: 120, background: '#1e2235', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>🖼 תמונה</div>
      }
      {block.caption && <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>{block.caption}</p>}
    </ViewWrap>
  );

  return (
    <EditWrap typeLabel="תמונה" preview={block.url && <img src={block.url} alt="" style={{ maxHeight: 160, borderRadius: 8 }} />}>
      <Field label="תמונה">
        <ImagePicker gameId={gameId} authFetch={authFetch} value={block.url || ''} onChange={v => onChange({ url: v })} />
      </Field>
      <Field label="כיתוב">
        <input style={inp} value={block.caption || ''} onChange={e => onChange({ caption: e.target.value })} placeholder="תיאור תמונה..." />
      </Field>
      <Field label="טקסט חלופי (Alt)">
        <input style={inp} value={block.alt || ''} onChange={e => onChange({ alt: e.target.value })} placeholder="alt text..." />
      </Field>
    </EditWrap>
  );
}

// ─── VIDEO ────────────────────────────────────────────────────────────────────
export function VideoBlock({ block, isEditing, onChange }) {
  if (!isEditing) return (
    <ViewWrap>
      {block.url
        ? <video src={block.url} controls poster={block.poster} style={{ maxWidth: '100%', borderRadius: 8 }} />
        : <div style={{ height: 80, background: '#1e2235', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>▶ וידאו</div>
      }
    </ViewWrap>
  );
  return (
    <EditWrap typeLabel="וידאו">
      <Field label="URL וידאו (mp4)">
        <input style={inp} value={block.url || ''} onChange={e => onChange({ url: e.target.value })} placeholder="https://...mp4" />
      </Field>
      <Field label="תמונת פוסטר (אופציונלי)">
        <input style={inp} value={block.poster || ''} onChange={e => onChange({ poster: e.target.value })} placeholder="https://...jpg" />
      </Field>
    </EditWrap>
  );
}

// ─── YOUTUBE ─────────────────────────────────────────────────────────────────
export function YoutubeBlock({ block, isEditing, onChange }) {
  const extractId = (val) => {
    const m = val.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : val;
  };
  if (!isEditing) return (
    <ViewWrap>
      {block.videoId
        ? <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
            <iframe src={`https://www.youtube.com/embed/${block.videoId}?start=${block.start || 0}`}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: 8, border: 'none' }} allowFullScreen />
          </div>
        : <div style={{ height: 80, background: '#1e2235', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>▶️ YouTube</div>
      }
    </ViewWrap>
  );
  return (
    <EditWrap typeLabel="YouTube">
      <Field label="קישור YouTube">
        <input style={inp} value={block.videoId || ''} onChange={e => onChange({ videoId: extractId(e.target.value) })} placeholder="https://youtube.com/watch?v=... או Video ID" />
      </Field>
      <Field label="התחלה (שניות)">
        <input style={{ ...inp, width: 100 }} type="number" value={block.start || 0} onChange={e => onChange({ start: parseInt(e.target.value) || 0 })} />
      </Field>
      {block.videoId && <img src={`https://img.youtube.com/vi/${block.videoId}/mqdefault.jpg`} alt="" style={{ borderRadius: 8, maxWidth: '100%' }} />}
    </EditWrap>
  );
}

// ─── IFRAME ───────────────────────────────────────────────────────────────────
export function IframeBlock({ block, isEditing, onChange }) {
  if (!isEditing) return (
    <ViewWrap>
      {block.url
        ? <iframe src={block.url} width="100%" height={block.height || 400} style={{ border: 'none', borderRadius: 8, display: 'block' }} />
        : <div style={{ height: 80, background: '#1e2235', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>&lt;/&gt; Embed</div>
      }
    </ViewWrap>
  );
  return (
    <EditWrap typeLabel="Embed / iframe">
      <Field label="URL">
        <input style={inp} value={block.url || ''} onChange={e => onChange({ url: e.target.value })} placeholder="https://..." />
      </Field>
      <Field label="גובה (px)">
        <input style={{ ...inp, width: 100 }} type="number" value={block.height || 400} onChange={e => onChange({ height: parseInt(e.target.value) || 400 })} />
      </Field>
    </EditWrap>
  );
}

// ─── TEXT ─────────────────────────────────────────────────────────────────────
export function TextBlock({ block, isEditing, onChange }) {
  const text = safeText(block.content);
  if (!isEditing) return (
    <ViewWrap>
      <p style={{ color: '#cbd5e1', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap', direction: 'rtl' }}>
        {text || <span style={{ color: '#475569', fontStyle: 'italic' }}>טקסט ריק</span>}
      </p>
    </ViewWrap>
  );
  return (
    <EditWrap typeLabel="טקסט">
      <textarea style={{ ...inp, minHeight: 100, resize: 'vertical' }} value={text}
        onChange={e => onChange({ content: e.target.value })} placeholder="הכנס טקסט כאן..." />
    </EditWrap>
  );
}

// ─── HEADER ───────────────────────────────────────────────────────────────────
export function HeaderBlock({ block, isEditing, onChange }) {
  const sizes = { 1: 32, 2: 26, 3: 20 };
  const sz = sizes[block.level] || 26;
  const text = safeText(block.content);
  if (!isEditing) return (
    <ViewWrap>
      <div style={{ fontSize: sz, fontWeight: 700, color: '#f1f5f9', direction: 'rtl', lineHeight: 1.3 }}>{text || 'כותרת'}</div>
    </ViewWrap>
  );
  return (
    <EditWrap typeLabel="כותרת">
      <Field label="טקסט">
        <input style={{ ...inp, fontSize: 18, fontWeight: 600 }} value={text} onChange={e => onChange({ content: e.target.value })} placeholder="כותרת..." />
      </Field>
      <Field label="גודל">
        <div style={row}>
          {[1, 2, 3].map(l => (
            <button key={l} style={{ ...inp, width: 44, cursor: 'pointer', fontWeight: block.level === l ? 700 : 400, borderColor: block.level === l ? '#7c3aed' : undefined }}
              onClick={() => onChange({ level: l })}>H{l}</button>
          ))}
        </div>
      </Field>
    </EditWrap>
  );
}

// ─── SEPARATOR ────────────────────────────────────────────────────────────────
export function SeparatorBlock({ block, isEditing, onChange }) {
  const styles = {
    line:   { borderTop: '1px solid rgba(255,255,255,0.12)', margin: '8px 0' },
    thick:  { borderTop: '3px solid rgba(255,255,255,0.2)', margin: '8px 0' },
    dotted: { borderTop: '2px dotted rgba(255,255,255,0.15)', margin: '8px 0' },
    space:  { height: 40 },
  };
  if (!isEditing) return <ViewWrap><div style={styles[block.style] || styles.line} /></ViewWrap>;
  return (
    <EditWrap typeLabel="מפריד">
      <Field label="סגנון">
        <div style={row}>
          {Object.keys(styles).map(st => (
            <button key={st} style={{ ...inp, width: 'auto', padding: '6px 12px', cursor: 'pointer', borderColor: block.style === st ? '#7c3aed' : undefined }}
              onClick={() => onChange({ style: st })}>{st}</button>
          ))}
        </div>
      </Field>
    </EditWrap>
  );
}

// ─── FLIP CARD ────────────────────────────────────────────────────────────────
const FLIP_SIDES = [
  { t: 'frontText', img: 'frontImage', name: 'חזית' },
  { t: 'backText',  img: 'backImage',  name: 'גב'   },
];

export function FlipCardBlock({ block, isEditing, onChange, gameId, authFetch }) {
  const cardHeight = block.cardHeight || 400;
  const cardWidth  = block.cardWidth  || 100; // percent

  if (!isEditing) return (
    <div style={{ display: 'flex', gap: 12, width: `${cardWidth}%` }}>
      {FLIP_SIDES.map(s => {
        const txt = safeText(block[s.t]);
        const dir = textDir(txt);
        return (
          <div key={s.t} style={{ flex: 1, background: '#1a2235', borderRadius: 8, padding: 16, minHeight: cardHeight, color: '#e2e8f0', fontSize: 14, textAlign: dir === 'rtl' ? 'center' : 'left' }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>{s.name}</div>
            {block[s.img] && <img src={block[s.img]} alt="" style={{ maxWidth: '100%', maxHeight: cardHeight * 0.5, borderRadius: 4, marginBottom: 6, objectFit: 'cover' }} />}
            <div style={{ direction: dir, unicodeBidi: 'embed' }}>{txt}</div>
          </div>
        );
      })}
    </div>
  );
  return (
    <div>
      {/* Size controls */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, alignItems: 'center', background: '#0f1117', borderRadius: 8, padding: '8px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ ...label, marginBottom: 0 }}>גובה (px)</span>
          <input type="number" min={100} max={800} step={50}
            style={{ ...inp, width: 80 }}
            value={cardHeight}
            onChange={e => onChange({ cardHeight: Number(e.target.value) })} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ ...label, marginBottom: 0 }}>רוחב (%)</span>
          <input type="number" min={20} max={100} step={5}
            style={{ ...inp, width: 70 }}
            value={cardWidth}
            onChange={e => onChange({ cardWidth: Number(e.target.value) })} />
        </div>
      </div>
      {/* Front / Back editors */}
      <div style={{ display: 'flex', gap: 12 }}>
        {FLIP_SIDES.map(s => (
          <div key={s.t} style={{ flex: 1, background: '#1a2235', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, fontWeight: 'bold' }}>{s.name}</div>
            <textarea rows={4}
              style={{ width: '100%', background: '#0f1117', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, padding: 8, fontSize: 14, resize: 'vertical', boxSizing: 'border-box', direction: textDir(safeText(block[s.t])) }}
              value={safeText(block[s.t])}
              onChange={e => { const ch = {}; ch[s.t] = e.target.value; onChange(ch); }}
            />
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 10, marginBottom: 4 }}>תמונה</div>
            <ImagePicker gameId={gameId} authFetch={authFetch} value={block[s.img] || ''} onChange={v => { const ch = {}; ch[s.img] = v; onChange(ch); }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MULTIPLE CHOICE ──────────────────────────────────────────────────────────
export function MultipleChoiceBlock({ block, isEditing, onChange }) {
  const updateAnswer = (i, changes) => {
    const answers = [...(block.answers || [])];
    answers[i] = { ...answers[i], ...changes };
    onChange({ answers });
  };
  const addAnswer = () => onChange({ answers: [...(block.answers || []), { text: '', correct: false }] });
  const removeAnswer = (i) => onChange({ answers: block.answers.filter((_, idx) => idx !== i) });

  if (!isEditing) return (
    <ViewWrap>
      <div style={{ color: '#f1f5f9', fontWeight: 600, marginBottom: 8, direction: 'rtl' }}>{block.question}</div>
      {(block.answers || []).map((a, i) => (
        <div key={i} style={{ padding: '6px 12px', background: a.correct ? 'rgba(34,197,94,0.1)' : '#1e2235', borderRadius: 6, marginBottom: 4, color: '#cbd5e1', fontSize: 14, direction: 'rtl', border: a.correct ? '1px solid rgba(34,197,94,0.3)' : '1px solid transparent' }}>
          {a.correct ? '✓ ' : ''}{a.text}
        </div>
      ))}
    </ViewWrap>
  );
  return (
    <EditWrap typeLabel="בחירה מרובה">
      <Field label="שאלה">
        <input style={inp} value={block.question || ''} onChange={e => onChange({ question: e.target.value })} placeholder="שאלה..." />
      </Field>
      <span style={label}>תשובות (סמן את הנכונות)</span>
      {(block.answers || []).map((a, i) => (
        <div key={i} style={{ ...row, marginBottom: 6 }}>
          <input type="checkbox" checked={a.correct || false} onChange={e => updateAnswer(i, { correct: e.target.checked })} />
          <input style={{ ...inp, flex: 1 }} value={a.text || ''} onChange={e => updateAnswer(i, { text: e.target.value })} placeholder={`תשובה ${i + 1}...`} />
          <button style={{ background: '#7f1d1d', border: 'none', borderRadius: 6, color: '#fca5a5', cursor: 'pointer', padding: '0 8px', height: 34 }} onClick={() => removeAnswer(i)}>✕</button>
        </div>
      ))}
      <button style={{ ...inp, cursor: 'pointer', color: '#7c3aed', width: 'auto', padding: '6px 16px' }} onClick={addAnswer}>+ הוסף תשובה</button>
    </EditWrap>
  );
}

// ─── OPEN QUESTION ────────────────────────────────────────────────────────────
export function OpenQuestionBlock({ block, isEditing, onChange }) {
  if (!isEditing) return (
    <ViewWrap>
      <div style={{ color: '#f1f5f9', fontWeight: 600, marginBottom: 8, direction: 'rtl' }}>{block.question}</div>
      <div style={{ background: '#0f1117', borderRadius: 8, padding: 12, minHeight: 60, border: '1px solid rgba(255,255,255,0.08)', color: '#475569', fontSize: 13 }}>{block.placeholder}</div>
    </ViewWrap>
  );
  return (
    <EditWrap typeLabel="שאלה פתוחה">
      <Field label="שאלה">
        <input style={inp} value={block.question || ''} onChange={e => onChange({ question: e.target.value })} placeholder="שאלה..." />
      </Field>
      <Field label="טקסט placeholder">
        <input style={inp} value={block.placeholder || ''} onChange={e => onChange({ placeholder: e.target.value })} placeholder="כתוב תשובתך..." />
      </Field>
    </EditWrap>
  );
}

// ─── CHOOSE ANSWER ────────────────────────────────────────────────────────────
export function ChooseAnswerBlock({ block, isEditing, onChange }) {
  const options = block.options || ['', '', '', ''];
  if (!isEditing) return (
    <ViewWrap>
      <div style={{ color: '#f1f5f9', fontWeight: 600, marginBottom: 10, direction: 'rtl' }}>{block.question}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {options.map((opt, i) => (
          <div key={i} style={{ padding: '10px 14px', borderRadius: 8, background: block.correct === i ? 'rgba(34,197,94,0.15)' : '#1e2235', border: block.correct === i ? '1px solid rgba(34,197,94,0.4)' : '1px solid transparent', color: '#cbd5e1', fontSize: 14, direction: 'rtl' }}>
            {block.correct === i ? '✓ ' : ''}{opt || `אפשרות ${i + 1}`}
          </div>
        ))}
      </div>
    </ViewWrap>
  );
  return (
    <EditWrap typeLabel="בחר תשובה (4)">
      <Field label="שאלה">
        <input style={inp} value={block.question || ''} onChange={e => onChange({ question: e.target.value })} placeholder="שאלה..." />
      </Field>
      <span style={label}>אפשרויות (לחץ ✓ לסמן נכונה)</span>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {options.map((opt, i) => (
          <div key={i} style={{ ...row, background: block.correct === i ? 'rgba(34,197,94,0.1)' : '#0f1117', borderRadius: 8, padding: 4, border: block.correct === i ? '1px solid rgba(34,197,94,0.3)' : '1px solid transparent' }}>
            <button style={{ background: block.correct === i ? '#166534' : '#334155', border: 'none', borderRadius: 4, color: '#fff', width: 24, height: 24, cursor: 'pointer', flexShrink: 0, fontSize: 11 }} onClick={() => onChange({ correct: i })}>✓</button>
            <input style={{ ...inp, flex: 1, border: 'none', background: 'transparent' }} value={opt} onChange={e => { const o = [...options]; o[i] = e.target.value; onChange({ options: o }); }} placeholder={`אפשרות ${i + 1}`} />
          </div>
        ))}
      </div>
    </EditWrap>
  );
}

// ─── CONNECT ──────────────────────────────────────────────────────────────────
export function ConnectBlock({ block, isEditing, onChange }) {
  const pairs = block.pairs || [];
  const updatePair = (i, side, val) => {
    const p = [...pairs]; p[i] = { ...p[i], [side]: val }; onChange({ pairs: p });
  };
  if (!isEditing) return (
    <ViewWrap>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>{pairs.map((p, i) => <div key={i} style={{ padding: '8px 12px', background: '#1e2235', borderRadius: 6, marginBottom: 4, color: '#cbd5e1', fontSize: 14, direction: 'rtl' }}>{p.right}</div>)}</div>
        <div style={{ width: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }} />
        <div style={{ flex: 1 }}>{pairs.map((p, i) => <div key={i} style={{ padding: '8px 12px', background: '#1e2235', borderRadius: 6, marginBottom: 4, color: '#cbd5e1', fontSize: 14, direction: 'rtl' }}>{p.left}</div>)}</div>
      </div>
    </ViewWrap>
  );
  return (
    <EditWrap typeLabel="חיבור זוגות">
      {pairs.map((p, i) => (
        <div key={i} style={{ ...row, marginBottom: 8 }}>
          <input style={{ ...inp, flex: 1 }} value={p.right || ''} onChange={e => updatePair(i, 'right', e.target.value)} placeholder="צד ימין..." />
          <span style={{ color: '#64748b' }}>↔</span>
          <input style={{ ...inp, flex: 1 }} value={p.left || ''} onChange={e => updatePair(i, 'left', e.target.value)} placeholder="צד שמאל..." />
          <button style={{ background: '#7f1d1d', border: 'none', borderRadius: 6, color: '#fca5a5', cursor: 'pointer', padding: '0 8px', height: 34 }} onClick={() => onChange({ pairs: pairs.filter((_, j) => j !== i) })}>✕</button>
        </div>
      ))}
      <button style={{ ...inp, cursor: 'pointer', color: '#7c3aed', width: 'auto', padding: '6px 16px' }} onClick={() => onChange({ pairs: [...pairs, { right: '', left: '' }] })}>+ הוסף זוג</button>
    </EditWrap>
  );
}

// ─── DRAG ANSWER ──────────────────────────────────────────────────────────────
export function DragAnswerBlock({ block, isEditing, onChange }) {
  if (!isEditing) return (
    <ViewWrap>
      <div style={{ color: '#f1f5f9', fontSize: 15, direction: 'rtl', marginBottom: 8 }}>
        {(block.sentence || '').replace('___', '[___]')}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(block.answers || []).map((a, i) => (
          <div key={i} style={{ padding: '6px 14px', background: block.correct === i ? 'rgba(34,197,94,0.15)' : '#1e2235', borderRadius: 20, color: '#cbd5e1', fontSize: 13, border: block.correct === i ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(255,255,255,0.08)' }}>{a}</div>
        ))}
      </div>
    </ViewWrap>
  );
  return (
    <EditWrap typeLabel="גרור תשובה">
      <Field label="משפט (השתמש ב-___ למקום החסר)">
        <input style={inp} value={block.sentence || ''} onChange={e => onChange({ sentence: e.target.value })} placeholder="המילה ___ היא הנכונה" />
      </Field>
      <span style={label}>תשובות (לחץ ✓ לסמן נכונה)</span>
      {(block.answers || []).map((a, i) => (
        <div key={i} style={{ ...row, marginBottom: 6 }}>
          <button style={{ background: block.correct === i ? '#166534' : '#334155', border: 'none', borderRadius: 4, color: '#fff', width: 24, height: 24, cursor: 'pointer', flexShrink: 0 }} onClick={() => onChange({ correct: i })}>✓</button>
          <input style={{ ...inp, flex: 1 }} value={a} onChange={e => { const arr = [...(block.answers || [])]; arr[i] = e.target.value; onChange({ answers: arr }); }} placeholder={`תשובה ${i + 1}`} />
          <button style={{ background: '#7f1d1d', border: 'none', borderRadius: 6, color: '#fca5a5', cursor: 'pointer', padding: '0 8px', height: 34 }}
            onClick={() => { const arr = (block.answers || []).filter((_, j) => j !== i); onChange({ answers: arr, correct: block.correct >= i ? Math.max(0, block.correct - 1) : block.correct }); }}>✕</button>
        </div>
      ))}
      <button style={{ ...inp, cursor: 'pointer', color: '#7c3aed', width: 'auto', padding: '6px 16px' }} onClick={() => onChange({ answers: [...(block.answers || []), ''] })}>+ הוסף תשובה</button>
    </EditWrap>
  );
}

export { VideoCreatorBlock } from './VideoCreatorBlock.jsx';
