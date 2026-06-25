import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../AuthContext';
import BlockEditor from '../editor/BlockEditor';

const EXTERNAL_HOSTS = ['playbuzz.com', 'dpg4l7vn2owwv.cloudfront.net'];
const isExternal = (url = '') => EXTERNAL_HOSTS.some(h => url.includes(h));

function findIssues(sections) {
  const result = [];
  sections.forEach((section, idx) => {
    const items = [];
    const walk = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) { obj.forEach(walk); return; }
      const url = obj.url || obj.originalImageUrl || obj.originalImageURL || obj.src || '';
      if (url && isExternal(url)) {
        items.push({ type: obj.mediaType === 'video' ? 'broken-video' : 'broken-image', url });
      }
      if (Array.isArray(obj.ops)) {
        obj.ops.forEach(op => {
          const link = op?.attributes?.link || '';
          if (link && isExternal(link)) items.push({ type: 'broken-link', url: link });
        });
      }
      Object.values(obj).forEach(walk);
    };
    walk(section);
    if (items.length) result.push({ sectionIdx: idx, title: section.title || section.header || `סעיף ${idx + 1}`, items });
  });
  return result;
}

function replaceUrlInObj(obj, oldUrl, newUrl) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(v => replaceUrlInObj(v, oldUrl, newUrl));
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) =>
      [k, typeof v === 'string' && v === oldUrl ? newUrl : replaceUrlInObj(v, oldUrl, newUrl)]
    )
  );
}

export default function GameEditorPage({ gameId, onBack }) {
  const { authFetch } = useAuth();
  const [game, setGame] = useState(null);
  const [sections, setSections] = useState([]);
  const [meta, setMeta] = useState({ title: '', description: '', status: 'draft', patternId: 'Story', locale: 'he-IL' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState('editor');
  const [fixUrls, setFixUrls] = useState({});   // { oldUrl: newUrl }
  const [uploading, setUploading] = useState({}); // { oldUrl: true }
  const fileRefs = useRef({});

  useEffect(() => {
    authFetch(`/api/games/${gameId}`)
      .then(r => r.json())
      .then(data => {
        setGame(data);
        setSections(data.sections || []);
        setMeta({
          title: data.title || '',
          description: data.description || '',
          status: data.status || 'draft',
          patternId: data.patternId || 'Story',
          locale: data.locale || 'he-IL',
        });
      });
  }, [gameId]);

  const save = async () => {
    setSaving(true);
    await authFetch(`/api/games/${gameId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...meta, sections }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const issues = findIssues(sections);
  const issueCount = issues.reduce((n, s) => n + s.items.length, 0);

  const applyFix = (oldUrl, newUrl) => {
    if (!newUrl) return;
    setSections(secs => secs.map(s => replaceUrlInObj(s, oldUrl, newUrl)));
    setFixUrls(f => { const n = {...f}; delete n[oldUrl]; return n; });
  };

  const uploadFile = async (oldUrl, file) => {
    setUploading(u => ({...u, [oldUrl]: true}));
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await authFetch(`/api/games/${gameId}/files`, { method: 'POST', body: fd });
      const data = await r.json();
      const newUrl = data.url || data.path;
      if (newUrl) applyFix(oldUrl, newUrl);
    } catch (e) {
      alert('שגיאה בהעלאת הקובץ');
    }
    setUploading(u => { const n = {...u}; delete n[oldUrl]; return n; });
  };

  if (!game) return <div style={{ color: '#64748b', textAlign: 'center', padding: 80 }}>טוען...</div>;

  return (
    <div style={s.root}>
      {/* Top bar */}
      <div style={s.topBar}>
        <button style={s.backBtn} onClick={onBack}>← חזרה</button>
        <div style={s.gameTitle}>{meta.title || 'ללא שם'}</div>
        <div style={s.tabs}>
          {[['editor','עורך'], ['issues', issueCount ? `⚠ בעיות (${issueCount})` : 'בעיות'], ['meta','מטא-דטה'], ['preview','תצוגה מקדימה']].map(([k,l]) => (
            <button key={k} style={{ ...s.tabBtn, ...(tab === k ? s.tabActive : {}), ...(k === 'issues' && issueCount ? { color: '#f87171' } : {}) }}
              onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        <div style={s.actions}>
          <span style={{ ...s.statusBadge, background: meta.status === 'published' ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.1)', color: meta.status === 'published' ? '#86efac' : '#fde047' }}>
            {meta.status === 'published' ? 'פורסם' : 'טיוטה'}
          </span>
          <button style={s.saveBtn} onClick={save} disabled={saving}>
            {saving ? 'שומר...' : saved ? '✓ נשמר' : 'שמור'}
          </button>
          <button style={s.publishBtn} onClick={() => setMeta(m => ({...m, status: m.status === 'published' ? 'draft' : 'published'}))}>
            {meta.status === 'published' ? 'הסר פרסום' : 'פרסם'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={s.content}>
        {tab === 'editor' && (
          <BlockEditor sections={sections} onChange={setSections} gameId={gameId} />
        )}

        {tab === 'issues' && (
          <div style={s.issuesWrap}>
            {issueCount === 0 ? (
              <div style={s.noIssues}>✓ לא נמצאו בעיות בגיים זה</div>
            ) : (
              <>
                <p style={s.issuesHint}>
                  הבעיות הבאות נמצאו בגיים. לכל בעיה ניתן להעלות קובץ חלופי או להדביק URL חדש, ואז ללחוץ <strong>שמור</strong>.
                </p>
                {issues.map(({ sectionIdx, title, items }) => (
                  <div key={sectionIdx} style={s.issueSection}>
                    <div style={s.issueSectionTitle}>סעיף {sectionIdx + 1}{title !== `סעיף ${sectionIdx + 1}` ? ` — ${title}` : ''}</div>
                    {items.map(({ type, url }, i) => (
                      <div key={i} style={s.issueItem}>
                        <div style={s.issueType}>
                          {type === 'broken-video' ? '🎬 וידאו שבור' : type === 'broken-image' ? '🖼 תמונה שבורה' : '🔗 קישור שבור'}
                        </div>
                        <div style={s.issueUrl} title={url}>{url.length > 70 ? url.slice(0, 70) + '…' : url}</div>

                        {type === 'broken-link' ? (
                          <div style={s.fixRow}>
                            <input
                              style={s.fixInput}
                              placeholder="הדבק URL חדש..."
                              value={fixUrls[url] || ''}
                              onChange={e => setFixUrls(f => ({...f, [url]: e.target.value}))}
                            />
                            <button style={s.fixBtn} onClick={() => applyFix(url, fixUrls[url])}>החלף</button>
                          </div>
                        ) : (
                          <div style={s.fixRow}>
                            <input
                              type="file"
                              accept={type === 'broken-video' ? 'video/*' : 'image/*'}
                              style={{ display: 'none' }}
                              ref={el => fileRefs.current[url] = el}
                              onChange={e => { if (e.target.files[0]) uploadFile(url, e.target.files[0]); }}
                            />
                            <button style={s.fixBtn} disabled={uploading[url]}
                              onClick={() => fileRefs.current[url]?.click()}>
                              {uploading[url] ? '⏳ מעלה...' : '📁 העלה קובץ'}
                            </button>
                            <span style={s.orText}>או</span>
                            <input
                              style={s.fixInput}
                              placeholder="הדבק URL חדש..."
                              value={fixUrls[url] || ''}
                              onChange={e => setFixUrls(f => ({...f, [url]: e.target.value}))}
                            />
                            <button style={s.fixBtn} onClick={() => applyFix(url, fixUrls[url])}>החלף</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
                <div style={{ marginTop: 24 }}>
                  <button style={s.publishBtn} onClick={save} disabled={saving}>
                    {saving ? 'שומר...' : '💾 שמור תיקונים'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'meta' && (
          <div style={s.metaForm}>
            <h2 style={s.metaTitle}>פרטי הגיים</h2>
            {[
              ['כותרת', 'title', 'text', 'שם הגיים...'],
              ['תיאור', 'description', 'textarea', 'תיאור קצר...'],
            ].map(([label, key, type, ph]) => (
              <div key={key} style={s.field}>
                <label style={s.label}>{label}</label>
                {type === 'textarea'
                  ? <textarea style={{ ...s.inp, minHeight: 80, resize: 'vertical' }} value={meta[key] || ''} onChange={e => setMeta(m => ({...m, [key]: e.target.value}))} placeholder={ph} />
                  : <input style={s.inp} value={meta[key] || ''} onChange={e => setMeta(m => ({...m, [key]: e.target.value}))} placeholder={ph} />
                }
              </div>
            ))}
            <div style={s.field}>
              <label style={s.label}>סוג (patternId)</label>
              <select style={s.inp} value={meta.patternId} onChange={e => setMeta(m => ({...m, patternId: e.target.value}))}>
                {['Story','Gallery','BigPicture','TestYourself','multipleChoice'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={s.field}>
              <label style={s.label}>שפה</label>
              <select style={s.inp} value={meta.locale} onChange={e => setMeta(m => ({...m, locale: e.target.value}))}>
                <option value="he-IL">עברית</option>
                <option value="en-US">English</option>
                <option value="es-ES">Español</option>
              </select>
            </div>
            <div style={{ marginTop: 8, padding: 12, background: '#1e2235', borderRadius: 8, fontSize: 12, color: '#64748b' }}>
              <div>ID: {game.itemId}</div>
              <div>נוצר: {game.creationTime ? new Date(game.creationTime).toLocaleString('he') : '-'}</div>
              <div>עודכן: {game.lastEdit ? new Date(game.lastEdit).toLocaleString('he') : '-'}</div>
              <div>Sections: {sections.length}</div>
            </div>
          </div>
        )}

        {tab === 'preview' && (
          <div style={s.previewWrap}>
            <iframe src={`/game/${gameId}?embed=1`} style={s.previewFrame} title="preview" />
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  root: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f1117', direction: 'rtl' },
  topBar: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', background: '#1a1d2e', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 },
  backBtn: { background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#94a3b8', padding: '6px 12px', cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap' },
  gameTitle: { flex: 1, color: '#e2e8f0', fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  tabs: { display: 'flex', gap: 4, background: '#0f1117', borderRadius: 8, padding: 4 },
  tabBtn: { background: 'none', border: 'none', borderRadius: 6, color: '#64748b', padding: '6px 14px', cursor: 'pointer', fontSize: 13 },
  tabActive: { background: '#1e2235', color: '#e2e8f0' },
  actions: { display: 'flex', gap: 8, alignItems: 'center' },
  statusBadge: { fontSize: 12, padding: '4px 10px', borderRadius: 20, fontWeight: 600 },
  saveBtn: { background: '#1e2235', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#94a3b8', padding: '7px 16px', cursor: 'pointer', fontSize: 13 },
  publishBtn: { background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', border: 'none', borderRadius: 8, color: '#fff', padding: '7px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  content: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  issuesWrap: { padding: 32, maxWidth: 760, overflowY: 'auto', flex: 1 },
  noIssues: { color: '#34d399', fontSize: 18, textAlign: 'center', marginTop: 60 },
  issuesHint: { color: '#94a3b8', fontSize: 13, marginBottom: 24, lineHeight: 1.6 },
  issueSection: { background: '#1a1d2e', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20, marginBottom: 16 },
  issueSectionTitle: { color: '#e2e8f0', fontWeight: 600, fontSize: 15, marginBottom: 12 },
  issueItem: { background: '#0f1117', borderRadius: 8, padding: 14, marginBottom: 10 },
  issueType: { color: '#f87171', fontSize: 13, fontWeight: 600, marginBottom: 6 },
  issueUrl: { color: '#475569', fontSize: 11, fontFamily: 'monospace', marginBottom: 10, wordBreak: 'break-all' },
  fixRow: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  fixInput: { flex: 1, minWidth: 200, background: '#1a1d2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none', direction: 'ltr' },
  fixBtn: { background: '#334155', border: 'none', borderRadius: 8, color: '#e2e8f0', padding: '8px 16px', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' },
  orText: { color: '#475569', fontSize: 12 },
  metaForm: { padding: 32, maxWidth: 600, direction: 'rtl' },
  metaTitle: { color: '#f1f5f9', fontSize: 20, fontWeight: 700, margin: '0 0 24px' },
  field: { marginBottom: 16 },
  label: { fontSize: 12, color: '#64748b', marginBottom: 6, display: 'block' },
  inp: { background: '#1a1d2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 12px', color: '#e2e8f0', fontSize: 14, width: '100%', boxSizing: 'border-box', outline: 'none', direction: 'rtl' },
  previewWrap: { flex: 1, padding: 20 },
  previewFrame: { width: '100%', height: '100%', border: 'none', borderRadius: 12, background: '#fff' },
};
