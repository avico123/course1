import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../AuthContext';

const LANG_LABELS = { he: 'עברית', en: 'English', es: 'Español', ar: 'عربية', unknown: '?' };
const LANG_COLORS = { he: '#60a5fa', en: '#34d399', es: '#f472b6', ar: '#fb923c', unknown: '#475569' };

const TEAM_STATUSES = [
  { value: '',            label: 'ללא סטטוס',   color: '#475569' },
  { value: 'ok',         label: '✓ תקין',       color: '#34d399' },
  { value: 'needs-fix',  label: '⚠ לתיקון',     color: '#fbbf24' },
  { value: 'broken',     label: '✗ שבור',        color: '#f87171' },
  { value: 'skip',       label: '— דלג',         color: '#64748b' },
];

const ISSUE_LABELS = {
  'broken-video': '🎬 וידאו שבור',
  'broken-image': '🖼 תמונה שבורה',
  'broken-link':  '🔗 קישור שבור',
};

export default function GamesPage({ onEdit }) {
  const { authFetch, user } = useAuth();
  const [games, setGames]       = useState([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(1);
  const [filterLang, setFilterLang]         = useState('');
  const [filterIssues, setFilterIssues]     = useState(false);
  const [filterPattern, setFilterPattern]   = useState('');
  const [filterTeam, setFilterTeam]         = useState('');
  const [stats, setStats]       = useState(null);
  const [indexInfo, setIndexInfo] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newGame, setNewGame]   = useState({ title: '', patternId: 'Story', locale: 'he-IL' });
  const [metaPanel, setMetaPanel] = useState(null); // gameId being tagged
  const [metaForm, setMetaForm]   = useState({ status: '', note: '', assignedTo: '' });
  const [rebuilding, setRebuilding] = useState(false);
  const searchTimeout = useRef(null);
  const limit = 50;

  // Load stats once
  useEffect(() => {
    authFetch('/api/games/stats').then(r => r.json()).then(setStats).catch(() => {});
    authFetch('/api/games/index-status').then(r => r.json()).then(setIndexInfo).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page, limit,
      ...(search        ? { search }               : {}),
      ...(filterLang    ? { lang: filterLang }      : {}),
      ...(filterIssues  ? { issues: '1' }           : {}),
      ...(filterPattern ? { pattern: filterPattern }: {}),
      ...(filterTeam    ? { teamStatus: filterTeam }: {}),
    });
    const r    = await authFetch(`/api/games?${params}`);
    const data = await r.json();
    setGames(data.games || []);
    setTotal(data.total || 0);
    if (data.indexBuiltAt) setIndexInfo(i => ({ ...i, builtAt: data.indexBuiltAt }));
    setLoading(false);
  }, [page, search, filterLang, filterIssues, filterPattern, filterTeam]);

  useEffect(() => { load(); }, [load]);

  const handleSearchChange = (v) => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { setSearch(v); setPage(1); }, 300);
  };

  const handleCreate = async () => {
    if (!newGame.title.trim()) return;
    const r    = await authFetch('/api/games', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newGame) });
    const data = await r.json();
    if (data.itemId) { setShowCreate(false); setNewGame({ title: '', patternId: 'Story', locale: 'he-IL' }); onEdit(data.itemId); }
  };

  const handleDelete = async (id, title) => {
    if (!confirm(`למחוק את "${title}"?`)) return;
    await authFetch(`/api/games/${id}`, { method: 'DELETE' });
    load();
  };

  const handleDuplicate = async (id) => {
    const r = await authFetch(`/api/games/${id}/duplicate`, { method: 'POST' });
    const data = await r.json();
    if (data.itemId) load();
  };

  const openMeta = (g) => {
    setMetaPanel(g.folderId);
    setMetaForm({ status: g.teamStatus || '', note: g.teamNote || '', assignedTo: g.assignedTo || '' });
  };

  const saveMeta = async () => {
    await authFetch(`/api/games/${metaPanel}/meta`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metaForm),
    });
    setMetaPanel(null);
    load();
  };

  const rebuildIndex = async () => {
    setRebuilding(true);
    await authFetch('/api/games/rebuild-index', { method: 'POST' });
    setTimeout(() => { setRebuilding(false); load(); }, 3000);
  };

  const canDelete  = ['superadmin', 'admin'].includes(user?.role);
  const canRebuild = ['superadmin', 'admin'].includes(user?.role);
  const totalPages = Math.ceil(total / limit);

  return (
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>גיימים</h1>
          <p style={s.sub}>{total.toLocaleString()} מתוך {(stats?.total || 0).toLocaleString()} גיימים</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canRebuild && (
            <button style={s.rebuildBtn} onClick={rebuildIndex} disabled={rebuilding} title={indexInfo?.builtAt ? `אינדקס נבנה: ${new Date(indexInfo.builtAt).toLocaleString('he')}` : 'אין אינדקס'}>
              {rebuilding ? '⏳ סורק...' : '🔄 סרוק מחדש'}
            </button>
          )}
          <button style={s.createBtn} onClick={() => setShowCreate(true)}>+ גיים חדש</button>
        </div>
      </div>

      {/* Index warning */}
      {!indexInfo?.hasIndex && (
        <div style={s.warning}>
          ⚠️ האינדקס לא נבנה עדיין — הפילטרים לא יעבדו. לחץ "סרוק מחדש" (פעם אחת, ~60 שניות).
        </div>
      )}

      {/* Stats bar */}
      {stats && (
        <div style={s.statsBar}>
          {Object.entries(stats.langs || {}).map(([lang, count]) => (
            <button key={lang} style={{ ...s.statChip, borderColor: filterLang === lang ? LANG_COLORS[lang] : 'transparent', color: LANG_COLORS[lang] || '#94a3b8' }}
              onClick={() => { setFilterLang(filterLang === lang ? '' : lang); setPage(1); }}>
              {LANG_LABELS[lang] || lang} <span style={s.chipCount}>{count}</span>
            </button>
          ))}
          <div style={s.statDivider} />
          {Object.entries(stats.issues || {}).map(([iss, count]) => (
            <button key={iss} style={{ ...s.statChip, borderColor: filterIssues ? '#f87171' : 'transparent', color: '#f87171' }}
              onClick={() => { setFilterIssues(!filterIssues); setPage(1); }}>
              {ISSUE_LABELS[iss] || iss} <span style={s.chipCount}>{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Search + filters */}
      <div style={s.filterRow}>
        <input
          style={{ ...s.search, flex: 2 }}
          defaultValue={search}
          onChange={e => handleSearchChange(e.target.value)}
          placeholder="🔍  חיפוש לפי כותרת..."
        />
        <select style={s.select} value={filterPattern} onChange={e => { setFilterPattern(e.target.value); setPage(1); }}>
          <option value="">כל הסוגים</option>
          {Object.keys(stats?.patterns || {}).sort().map(p => (
            <option key={p} value={p}>{p} ({stats.patterns[p]})</option>
          ))}
        </select>
        <select style={s.select} value={filterTeam} onChange={e => { setFilterTeam(e.target.value); setPage(1); }}>
          <option value="">כל הסטטוסים</option>
          {TEAM_STATUSES.filter(t => t.value).map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        {(filterLang || filterIssues || filterPattern || filterTeam || search) && (
          <button style={s.clearBtn} onClick={() => { setFilterLang(''); setFilterIssues(false); setFilterPattern(''); setFilterTeam(''); setSearch(''); setPage(1); }}>✕ נקה</button>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div style={s.modal}>
          <div style={s.modalCard}>
            <h2 style={s.modalTitle}>גיים חדש</h2>
            <Field label="כותרת *">
              <input style={s.inp} value={newGame.title} onChange={e => setNewGame(g => ({...g, title: e.target.value}))} placeholder="שם הגיים..." autoFocus />
            </Field>
            <Field label="סוג">
              <select style={s.inp} value={newGame.patternId} onChange={e => setNewGame(g => ({...g, patternId: e.target.value}))}>
                {['Story','Gallery','BigPicture','TestYourself','multipleChoice'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="שפה">
              <select style={s.inp} value={newGame.locale} onChange={e => setNewGame(g => ({...g, locale: e.target.value}))}>
                <option value="he-IL">עברית</option>
                <option value="en-US">English</option>
                <option value="es-ES">Español</option>
              </select>
            </Field>
            <div style={s.modalBtns}>
              <button style={s.cancelBtn} onClick={() => setShowCreate(false)}>ביטול</button>
              <button style={s.createBtn} onClick={handleCreate}>צור גיים</button>
            </div>
          </div>
        </div>
      )}

      {/* Team-tag modal */}
      {metaPanel && (
        <div style={s.modal}>
          <div style={s.modalCard}>
            <h2 style={s.modalTitle}>תיוג צוות</h2>
            <Field label="סטטוס">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {TEAM_STATUSES.map(t => (
                  <button key={t.value} style={{ ...s.teamBtn, borderColor: metaForm.status === t.value ? t.color : 'rgba(255,255,255,0.1)', color: metaForm.status === t.value ? t.color : '#64748b' }}
                    onClick={() => setMetaForm(f => ({...f, status: t.value}))}>
                    {t.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="הערה">
              <input style={s.inp} value={metaForm.note} onChange={e => setMetaForm(f => ({...f, note: e.target.value}))} placeholder="תיאור הבעיה..." />
            </Field>
            <Field label="הוקצה ל">
              <input style={s.inp} value={metaForm.assignedTo} onChange={e => setMetaForm(f => ({...f, assignedTo: e.target.value}))} placeholder="שם העובד..." />
            </Field>
            <div style={s.modalBtns}>
              <button style={s.cancelBtn} onClick={() => setMetaPanel(null)}>ביטול</button>
              <button style={s.createBtn} onClick={saveMeta}>שמור תיוג</button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={s.loading}>טוען...</div>
      ) : (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr style={s.thead}>
                <th style={s.th}>תמונה</th>
                <th style={s.th}>כותרת</th>
                <th style={s.th}>שפה</th>
                <th style={s.th}>סוג</th>
                <th style={s.th}>סטטוס</th>
                <th style={s.th}>בעיות</th>
                <th style={s.th}>צוות</th>
                <th style={s.th}>עדכון</th>
                <th style={s.th}>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {games.map(g => (
                <tr key={g.folderId} style={{ ...s.tr, ...(g.issues?.length ? { background: 'rgba(239,68,68,0.03)' } : {}) }}>
                  <td style={s.td}>
                    {g.thumbnail
                      ? <img src={`/game-files/${g.folderId}/${g.thumbnail.replace(/^files\//, '')}`} style={s.thumb} alt="" onError={e => e.target.style.display='none'} />
                      : <div style={s.thumbPlaceholder}>🎮</div>
                    }
                  </td>
                  <td style={{ ...s.td, maxWidth: 240, direction: 'rtl' }}>
                    <div style={s.gameTitle}>{g.title || <span style={{ color: '#475569' }}>ללא שם</span>}</div>
                    <div style={s.gameId}>{g.folderId?.slice(0, 8)}...</div>
                  </td>
                  <td style={s.td}>
                    <span style={{ ...s.tag, color: LANG_COLORS[g.detectedLang] || '#94a3b8', background: 'rgba(255,255,255,0.04)' }}>
                      {LANG_LABELS[g.detectedLang] || '?'}
                    </span>
                  </td>
                  <td style={s.td}><span style={s.tag}>{g.patternId}</span></td>
                  <td style={s.td}>
                    <span style={{ ...s.tag, background: g.status === 'published' ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)', color: g.status === 'published' ? '#86efac' : '#fde047' }}>
                      {g.status === 'published' ? 'פורסם' : 'טיוטה'}
                    </span>
                  </td>
                  <td style={s.td}>
                    {(g.issues || []).map(iss => (
                      <span key={iss} style={{ ...s.tag, background: 'rgba(239,68,68,0.12)', color: '#fca5a5', display: 'block', marginBottom: 2, fontSize: 11 }}>
                        {ISSUE_LABELS[iss] || iss}
                      </span>
                    ))}
                  </td>
                  <td style={s.td}>
                    {g.teamStatus && (
                      <span style={{ ...s.tag, color: TEAM_STATUSES.find(t => t.value === g.teamStatus)?.color || '#94a3b8' }}>
                        {TEAM_STATUSES.find(t => t.value === g.teamStatus)?.label || g.teamStatus}
                      </span>
                    )}
                    {g.assignedTo && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{g.assignedTo}</div>}
                  </td>
                  <td style={s.td}>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{g.lastEdit ? new Date(g.lastEdit).toLocaleDateString('he') : ''}</span>
                  </td>
                  <td style={s.td}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button style={s.actionBtn} onClick={() => onEdit(g.folderId)} title="ערוך">✏️</button>
                      <button style={s.actionBtn} onClick={() => window.open(`/game/${g.folderId}`, '_blank')} title="תצוגה מקדימה">👁</button>
                      <button style={s.actionBtn} onClick={() => openMeta(g)} title="תייג">🏷</button>
                      <button style={s.actionBtn} onClick={() => handleDuplicate(g.folderId)} title="שכפל">⧉</button>
                      {canDelete && <button style={{ ...s.actionBtn, color: '#f87171' }} onClick={() => handleDelete(g.folderId, g.title)} title="מחק">🗑</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {games.length === 0 && !loading && (
            <div style={{ textAlign: 'center', color: '#475569', padding: 40 }}>לא נמצאו גיימים</div>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={s.pagination}>
          <button style={s.pageBtn} disabled={page === 1} onClick={() => setPage(1)}>⟪</button>
          <button style={s.pageBtn} disabled={page === 1} onClick={() => setPage(p => p - 1)}>← הקודם</button>
          <span style={{ color: '#94a3b8' }}>{page} / {totalPages}</span>
          <button style={s.pageBtn} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>הבא →</button>
          <button style={s.pageBtn} disabled={page >= totalPages} onClick={() => setPage(totalPages)}>⟫</button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 12, color: '#64748b', marginBottom: 6, display: 'block' }}>{label}</label>
      {children}
    </div>
  );
}

const s = {
  root: { direction: 'rtl' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  title: { color: '#f1f5f9', fontSize: 28, fontWeight: 700, margin: 0 },
  sub: { color: '#64748b', fontSize: 14, margin: '4px 0 0' },
  createBtn: { background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14, flexShrink: 0 },
  rebuildBtn: { background: '#1e2235', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#94a3b8', padding: '10px 16px', cursor: 'pointer', fontSize: 13 },
  warning: { background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 8, padding: '10px 14px', color: '#fde047', fontSize: 13, marginBottom: 12 },
  statsBar: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 },
  statChip: { background: '#1e2235', border: '2px solid transparent', borderRadius: 20, padding: '5px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center' },
  chipCount: { background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '1px 6px', fontSize: 11, color: '#94a3b8' },
  statDivider: { width: 1, background: 'rgba(255,255,255,0.08)', margin: '0 4px' },
  filterRow: { display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' },
  search: { background: '#1e2235', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 16px', color: '#e2e8f0', fontSize: 15, direction: 'rtl', outline: 'none' },
  select: { background: '#1e2235', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 12px', color: '#e2e8f0', fontSize: 14, outline: 'none', cursor: 'pointer' },
  clearBtn: { background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#94a3b8', padding: '8px 12px', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' },
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modalCard: { background: '#1a1d2e', borderRadius: 16, padding: 32, width: 420, border: '1px solid rgba(255,255,255,0.08)', maxHeight: '90vh', overflowY: 'auto' },
  modalTitle: { color: '#f1f5f9', fontSize: 20, fontWeight: 700, margin: '0 0 24px', direction: 'rtl' },
  inp: { background: '#0f1117', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 12px', color: '#e2e8f0', fontSize: 14, width: '100%', boxSizing: 'border-box', direction: 'rtl', outline: 'none' },
  modalBtns: { display: 'flex', gap: 10, marginTop: 24 },
  cancelBtn: { flex: 1, background: '#334155', border: 'none', borderRadius: 8, color: '#94a3b8', padding: '10px', cursor: 'pointer' },
  teamBtn: { background: '#0f1117', border: '2px solid', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  loading: { textAlign: 'center', color: '#64748b', padding: 60 },
  tableWrap: { background: '#1a1d2e', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: 'rgba(255,255,255,0.03)' },
  th: { padding: '12px 16px', color: '#64748b', fontSize: 12, fontWeight: 600, textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid rgba(255,255,255,0.04)' },
  td: { padding: '10px 16px', color: '#cbd5e1', fontSize: 14, verticalAlign: 'middle' },
  thumb: { width: 48, height: 36, objectFit: 'cover', borderRadius: 6, display: 'block' },
  thumbPlaceholder: { width: 48, height: 36, background: '#0f1117', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 },
  gameTitle: { fontWeight: 500, color: '#e2e8f0', marginBottom: 2 },
  gameId: { fontSize: 11, color: '#475569' },
  tag: { fontSize: 11, background: '#334155', padding: '3px 8px', borderRadius: 20, color: '#94a3b8', whiteSpace: 'nowrap' },
  actionBtn: { background: '#1e2235', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, cursor: 'pointer', padding: '5px 8px', fontSize: 14 },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 24 },
  pageBtn: { background: '#1e2235', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#94a3b8', padding: '8px 14px', cursor: 'pointer', fontSize: 14 },
};
