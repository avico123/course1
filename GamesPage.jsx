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

const LS_FAV    = 'pb_favorites';   // string[]  of folderId
const LS_RECENT = 'pb_recent';      // [{id,title,ts}]

function loadFavorites() {
  try { return JSON.parse(localStorage.getItem(LS_FAV) || '[]'); } catch { return []; }
}
function saveFavorites(arr) {
  localStorage.setItem(LS_FAV, JSON.stringify(arr));
}
function loadRecent() {
  try { return JSON.parse(localStorage.getItem(LS_RECENT) || '[]'); } catch { return []; }
}
function pushRecent(id, title) {
  const list = loadRecent().filter(r => r.id !== id);
  list.unshift({ id, title: title || id, ts: Date.now() });
  localStorage.setItem(LS_RECENT, JSON.stringify(list.slice(0, 10)));
}

export default function GamesPage({ onEdit }) {
  const { authFetch, user } = useAuth();
  const [games, setGames]       = useState([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(1);
  const [filterLang, setFilterLang]         = useState('');
  const [filterIssue, setFilterIssue]       = useState('');
  const [filterPattern, setFilterPattern]   = useState('');
  const [filterTeam, setFilterTeam]         = useState('');
  const [filterTags, setFilterTags]         = useState([]); // multi-select
  const [stats, setStats]       = useState(null);
  const [indexInfo, setIndexInfo] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newGame, setNewGame]   = useState({ title: '', patternId: 'Story', locale: 'he-IL' });
  const [metaPanel, setMetaPanel] = useState(null);
  const [metaForm, setMetaForm]   = useState({ status: '', note: '', assignedTo: '' });
  const [rebuilding, setRebuilding] = useState(false);
  const [advOpen, setAdvOpen]   = useState(false);
  const [favorites, setFavorites] = useState(loadFavorites);
  const [recent, setRecent]     = useState(loadRecent);
  const [showFavOnly, setShowFavOnly] = useState(false);
  const searchTimeout = useRef(null);
  const searchRef = useRef(null);
  const limit = 50;

  useEffect(() => {
    authFetch('/api/games/stats').then(r => r.json()).then(setStats).catch(() => {});
    authFetch('/api/games/index-status').then(r => r.json()).then(setIndexInfo).catch(() => {});
  }, []);

  // For favorites filtering we pass folderId list or client-filter
  const contextTag = filterTags.length === 1 ? filterTags[0] : '';

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page, limit,
      ...(search        ? { search }                    : {}),
      ...(filterLang    ? { lang: filterLang }          : {}),
      ...(filterIssue   ? { issueType: filterIssue }    : {}),
      ...(filterPattern ? { pattern: filterPattern }    : {}),
      ...(filterTeam    ? { teamStatus: filterTeam }    : {}),
      ...(contextTag    ? { contextTag }                : {}),
    });
    const r    = await authFetch(`/api/games?${params}`);
    const data = await r.json();
    setGames(data.games || []);
    setTotal(data.total || 0);
    if (data.indexBuiltAt) setIndexInfo(i => ({ ...i, builtAt: data.indexBuiltAt }));
    setLoading(false);
  }, [page, search, filterLang, filterIssue, filterPattern, filterTeam, contextTag]);

  useEffect(() => { load(); }, [load]);

  const handleSearchChange = (v) => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { setSearch(v); setPage(1); }, 300);
  };

  const handleEdit = (id, title) => {
    pushRecent(id, title);
    setRecent(loadRecent());
    onEdit(id);
  };

  const handleCreate = async () => {
    if (!newGame.title.trim()) return;
    const r    = await authFetch('/api/games', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newGame) });
    const data = await r.json();
    if (data.itemId) { setShowCreate(false); setNewGame({ title: '', patternId: 'Story', locale: 'he-IL' }); handleEdit(data.itemId, newGame.title); }
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

  const toggleFavorite = (id) => {
    const next = favorites.includes(id) ? favorites.filter(f => f !== id) : [...favorites, id];
    setFavorites(next);
    saveFavorites(next);
  };

  const openMeta = (g) => {
    setMetaPanel(g.folderId);
    setMetaForm({
      status: g.teamStatus || '',
      note: g.teamNote || '',
      assignedTo: g.assignedTo || '',
      langOverride: g.langOverride || '',
      contextTags: (g.contextTags || []).join(', '),
    });
  };

  const saveMeta = async () => {
    const payload = {
      ...metaForm,
      contextTags: metaForm.contextTags
        ? metaForm.contextTags.split(',').map(t => t.trim()).filter(Boolean)
        : [],
    };
    await authFetch(`/api/games/${metaPanel}/meta`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setMetaPanel(null);
    load();
  };

  const rebuildIndex = async () => {
    setRebuilding(true);
    await authFetch('/api/games/rebuild-index', { method: 'POST' });
    setTimeout(() => { setRebuilding(false); load(); }, 3000);
  };

  const toggleMeta = async (g, field) => {
    const newVal = !g[field];
    await authFetch(`/api/games/${g.folderId}/meta`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: newVal }),
    });
    setGames(gs => gs.map(x => x.folderId === g.folderId ? { ...x, [field]: newVal } : x));
  };

  const bulkEnable = async (field, label) => {
    const filter = {
      ...(filterLang    ? { lang: filterLang }         : {}),
      ...(filterPattern ? { pattern: filterPattern }   : {}),
      ...(contextTag    ? { contextTag }               : {}),
      ...(filterTeam    ? { teamStatus: filterTeam }   : {}),
      ...(filterIssue   ? { issueType: filterIssue }   : {}),
    };
    const r = await authFetch('/api/games/bulk-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filter, meta: { [field]: true } }),
    });
    const data = await r.json();
    alert(`${label} הופעל ל-${data.count} גיימים`);
    load();
  };

  const clearAll = () => {
    setFilterLang(''); setFilterIssue(''); setFilterPattern('');
    setFilterTeam(''); setFilterTags([]); setShowFavOnly(false);
    setSearch(''); setPage(1);
    if (searchRef.current) searchRef.current.value = '';
  };

  const toggleTag = (tag) => {
    setFilterTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
    setPage(1);
  };

  // Client-side favorites filter on top of server results
  const displayGames = showFavOnly ? games.filter(g => favorites.includes(g.folderId)) : games;
  // Client-side multi-tag filter (when >1 tag selected, server only handles 1)
  const visibleGames = filterTags.length > 1
    ? displayGames.filter(g => filterTags.every(t => (g.contextTags || []).includes(t)))
    : displayGames;

  const hasFilters = filterLang || filterIssue || filterPattern || filterTeam || filterTags.length || showFavOnly || search;

  const canDelete  = ['superadmin', 'admin'].includes(user?.role);
  const canRebuild = ['superadmin', 'admin'].includes(user?.role);
  const canBulk    = ['superadmin', 'admin'].includes(user?.role);
  const totalPages = Math.ceil(total / limit);
  const allTags = Object.keys(stats?.contextTags || {}).sort((a, b) => a.localeCompare(b, 'he'));

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
            <button style={s.rebuildBtn} onClick={rebuildIndex} disabled={rebuilding}
              title={indexInfo?.builtAt ? `אינדקס נבנה: ${new Date(indexInfo.builtAt).toLocaleString('he')}` : 'אין אינדקס'}>
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

      {/* Search bar + advanced toggle */}
      <div style={s.searchBar}>
        <input
          ref={searchRef}
          style={s.searchInput}
          defaultValue={search}
          onChange={e => handleSearchChange(e.target.value)}
          placeholder="🔍  חיפוש לפי כותרת..."
        />
        <button
          style={{ ...s.advBtn, ...(advOpen ? s.advBtnOpen : {}) }}
          onClick={() => setAdvOpen(o => !o)}
        >
          🔍 מתקדם {advOpen ? '▲' : '▾'}
          {hasFilters && <span style={s.filterDot} />}
        </button>
        {hasFilters && (
          <button style={s.clearBtn} onClick={clearAll}>✕ נקה הכל</button>
        )}
      </div>

      {/* Advanced panel */}
      {advOpen && (
        <div style={s.advPanel}>
          {/* Row 1: Language + Pattern + Team + Issue */}
          <div style={s.advRow}>
            <div style={s.advGroup}>
              <div style={s.advLabel}>שפה</div>
              <div style={s.chipRow}>
                {Object.entries(stats?.langs || {}).map(([lang, count]) => (
                  <button key={lang}
                    style={{ ...s.chip, ...(filterLang === lang ? { borderColor: LANG_COLORS[lang], color: LANG_COLORS[lang], background: 'rgba(255,255,255,0.07)' } : { color: LANG_COLORS[lang] || '#94a3b8' }) }}
                    onClick={() => { setFilterLang(filterLang === lang ? '' : lang); setPage(1); }}>
                    {LANG_LABELS[lang] || lang} <span style={s.chipCount}>{count}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={s.advGroup}>
              <div style={s.advLabel}>סוג תבנית</div>
              <select style={s.advSelect} value={filterPattern} onChange={e => { setFilterPattern(e.target.value); setPage(1); }}>
                <option value="">הכל</option>
                {Object.keys(stats?.patterns || {}).sort().map(p => (
                  <option key={p} value={p}>{p} ({stats.patterns[p]})</option>
                ))}
              </select>
            </div>

            <div style={s.advGroup}>
              <div style={s.advLabel}>סטטוס צוות</div>
              <select style={s.advSelect} value={filterTeam} onChange={e => { setFilterTeam(e.target.value); setPage(1); }}>
                <option value="">הכל</option>
                {TEAM_STATUSES.filter(t => t.value).map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div style={s.advGroup}>
              <div style={s.advLabel}>בעיות</div>
              <div style={s.chipRow}>
                {Object.entries(stats?.issues || {}).map(([iss, count]) => (
                  <button key={iss}
                    style={{ ...s.chip, ...(filterIssue === iss ? { borderColor: '#f87171', color: '#f87171', background: 'rgba(239,68,68,0.08)' } : { color: '#f87171' }) }}
                    onClick={() => { setFilterIssue(filterIssue === iss ? '' : iss); setPage(1); }}>
                    {ISSUE_LABELS[iss] || iss} <span style={s.chipCount}>{count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Context tags (multi-select) */}
          {allTags.length > 0 && (
            <div style={s.advGroup}>
              <div style={s.advLabel}>תגיות הקשר <span style={{ fontWeight: 400, opacity: 0.6 }}>(אפשר לבחור כמה)</span></div>
              <div style={{ ...s.chipRow, flexWrap: 'wrap', gap: 6, maxHeight: 140, overflowY: 'auto' }}>
                {allTags.map(tag => (
                  <button key={tag}
                    style={{ ...s.chip, ...(filterTags.includes(tag) ? { borderColor: '#a78bfa', color: '#a78bfa', background: 'rgba(124,58,237,0.12)' } : { color: '#94a3b8' }) }}
                    onClick={() => toggleTag(tag)}>
                    {tag}
                    {stats?.contextTags?.[tag] ? <span style={s.chipCount}>{stats.contextTags[tag]}</span> : null}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Row 3: Favorites + Recently edited */}
          <div style={s.advRow}>
            <div style={s.advGroup}>
              <div style={s.advLabel}>מועדפים</div>
              <button
                style={{ ...s.chip, ...(showFavOnly ? { borderColor: '#fbbf24', color: '#fbbf24', background: 'rgba(251,191,36,0.08)' } : { color: '#94a3b8' }) }}
                onClick={() => { setShowFavOnly(f => !f); setPage(1); }}>
                ⭐ הצג מועדפים בלבד {favorites.length > 0 ? `(${favorites.length})` : ''}
              </button>
            </div>

            {recent.length > 0 && (
              <div style={{ ...s.advGroup, flex: 2 }}>
                <div style={s.advLabel}>🕐 נערכו לאחרונה</div>
                <div style={{ ...s.chipRow, flexWrap: 'wrap', gap: 6 }}>
                  {recent.map(r => (
                    <button key={r.id} style={{ ...s.chip, color: '#7dd3fc', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={r.title}
                      onClick={() => handleEdit(r.id, r.title)}>
                      {r.title || r.id.slice(0, 8)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bulk actions (admin only, when filters active) */}
          {canBulk && (filterLang || filterPattern || contextTag || filterTeam || filterIssue) && (
            <div style={{ ...s.advRow, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12, marginTop: 4 }}>
              <div style={s.advLabel}>פעולות מרוכזות לתוצאות הנוכחיות:</div>
              <button style={{ ...s.clearBtn, color: '#34d399', borderColor: 'rgba(52,211,153,0.3)' }}
                onClick={() => bulkEnable('showHeadImage', '📷 תמונת כותרת')}>
                📷 הפעל תמונות לכולם
              </button>
              <button style={{ ...s.clearBtn, color: '#60a5fa', borderColor: 'rgba(96,165,250,0.3)' }}
                onClick={() => bulkEnable('showGameTitle', '📝 כותרת גיים')}>
                📝 הפעל כותרת לכולם
              </button>
            </div>
          )}
        </div>
      )}

      {/* Active filter badges */}
      {hasFilters && (
        <div style={s.activeFilters}>
          {filterLang && <span style={{ ...s.badge, color: LANG_COLORS[filterLang] }}>שפה: {LANG_LABELS[filterLang] || filterLang}</span>}
          {filterPattern && <span style={s.badge}>תבנית: {filterPattern}</span>}
          {filterTeam && <span style={s.badge}>צוות: {TEAM_STATUSES.find(t=>t.value===filterTeam)?.label}</span>}
          {filterIssue && <span style={{ ...s.badge, color: '#f87171' }}>{ISSUE_LABELS[filterIssue] || filterIssue}</span>}
          {filterTags.map(t => <span key={t} style={{ ...s.badge, color: '#a78bfa' }}>#{t}</span>)}
          {showFavOnly && <span style={{ ...s.badge, color: '#fbbf24' }}>⭐ מועדפים</span>}
          {search && <span style={s.badge}>חיפוש: "{search}"</span>}
        </div>
      )}

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
            <Field label="שפה (תיקון ידני)">
              <select style={s.inp} value={metaForm.langOverride} onChange={e => setMetaForm(f => ({...f, langOverride: e.target.value}))}>
                <option value="">— זיהוי אוטומטי</option>
                <option value="he">עברית</option>
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="ar">عربية</option>
              </select>
            </Field>
            <Field label="תגיות הקשר (ספר תנ״ך, נושא...)">
              <input style={s.inp} value={metaForm.contextTags} onChange={e => setMetaForm(f => ({...f, contextTags: e.target.value}))} placeholder="בראשית, שמות, דברים..." />
              <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>מופרדות בפסיק</div>
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
            <colgroup>
              <col style={{ width: 36 }} />   {/* star */}
              <col style={{ width: 64 }} />   {/* תמונה */}
              <col style={{ width: '25%' }} /> {/* כותרת */}
              <col style={{ width: 80 }} />    {/* שפה */}
              <col style={{ width: '16%' }} /> {/* סוג + תגיות */}
              <col style={{ width: 70 }} />    {/* סטטוס */}
              <col style={{ width: 100 }} />   {/* בעיות */}
              <col style={{ width: 100 }} />   {/* צוות */}
              <col style={{ width: 80 }} />    {/* עדכון */}
              <col style={{ width: 130 }} />   {/* פעולות */}
            </colgroup>
            <thead>
              <tr style={s.thead}>
                <th style={s.th}>⭐</th>
                <th style={s.th}>תמונה</th>
                <th style={s.th}>כותרת</th>
                <th style={s.th}>שפה</th>
                <th style={s.th}>סוג / הקשר</th>
                <th style={s.th}>סטטוס</th>
                <th style={s.th}>בעיות</th>
                <th style={s.th}>צוות</th>
                <th style={s.th}>עדכון</th>
                <th style={s.th}>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {visibleGames.map(g => {
                const isFav = favorites.includes(g.folderId);
                return (
                  <tr key={g.folderId} style={{ ...s.tr, ...(g.issues?.length ? { background: 'rgba(239,68,68,0.03)' } : {}) }}>
                    <td style={{ ...s.td, padding: '10px 4px', textAlign: 'center' }}>
                      <button style={{ ...s.starBtn, color: isFav ? '#fbbf24' : '#334155' }}
                        onClick={() => toggleFavorite(g.folderId)}
                        title={isFav ? 'הסר ממועדפים' : 'הוסף למועדפים'}>
                        {isFav ? '⭐' : '☆'}
                      </button>
                    </td>
                    <td style={s.td}>
                      {g.thumbnail
                        ? <img src={`/game-files/${g.folderId}/${g.thumbnail.replace(/^files\//, '')}`} style={s.thumb} alt="" onError={e => e.target.style.display='none'} />
                        : <div style={s.thumbPlaceholder}>🎮</div>
                      }
                    </td>
                    <td style={{ ...s.td, overflow: 'hidden' }}>
                      <div style={s.gameTitle} title={g.title}>{g.title || <span style={{ color: '#475569' }}>ללא שם</span>}</div>
                      <div style={s.gameId}>{g.folderId?.slice(0, 8)}...</div>
                    </td>
                    <td style={s.td}>
                      <span style={{ ...s.tag, color: LANG_COLORS[g.detectedLang] || '#94a3b8', background: 'rgba(255,255,255,0.04)' }} title={g.langOverride ? 'שפה תוקנה ידנית' : 'זיהוי אוטומטי'}>
                        {LANG_LABELS[g.detectedLang] || '?'}{g.langOverride ? ' ✎' : ''}
                      </span>
                    </td>
                    <td style={{ ...s.td, overflow: 'hidden' }}>
                      <span style={s.tag}>{g.patternId}</span>
                      {(g.contextTags || []).filter(t => t && !t.includes('<')).map(t => (
                        <button key={t}
                          style={{ ...s.tag, background: filterTags.includes(t) ? 'rgba(124,58,237,0.25)' : 'rgba(124,58,237,0.15)', color: '#a78bfa', display: 'block', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', border: 'none', textAlign: 'right', width: '100%' }}
                          title={`סנן לפי ${t}`}
                          onClick={() => { toggleTag(t); setAdvOpen(true); }}>
                          #{t}
                        </button>
                      ))}
                    </td>
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
                    <td style={{ ...s.td, overflow: 'hidden' }}>
                      {g.teamStatus && (
                        <span style={{ ...s.tag, color: TEAM_STATUSES.find(t => t.value === g.teamStatus)?.color || '#94a3b8' }}>
                          {TEAM_STATUSES.find(t => t.value === g.teamStatus)?.label || g.teamStatus}
                        </span>
                      )}
                      {g.assignedTo && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.assignedTo}</div>}
                    </td>
                    <td style={s.td}>
                      <span style={{ fontSize: 12, color: '#64748b' }}>{g.lastEdit ? new Date(g.lastEdit).toLocaleDateString('he') : ''}</span>
                    </td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button style={s.actionBtn} onClick={() => handleEdit(g.folderId, g.title)} title="ערוך">✏️</button>
                        <button style={s.actionBtn} onClick={() => window.open(`/game/${g.folderId}`, '_blank')} title="תצוגה מקדימה">👁</button>
                        <button style={{ ...s.actionBtn, color: g.showHeadImage ? '#34d399' : '#475569' }}
                          onClick={() => toggleMeta(g, 'showHeadImage')}
                          title={g.showHeadImage ? 'תמונת כותרת פעילה — לחץ לכיבוי' : 'תמונת כותרת כבויה — לחץ להפעלה'}>
                          🖼
                        </button>
                        <button style={{ ...s.actionBtn, color: g.showGameTitle ? '#60a5fa' : '#475569' }}
                          onClick={() => toggleMeta(g, 'showGameTitle')}
                          title={g.showGameTitle ? 'כותרת גיים פעילה — לחץ לכיבוי' : 'כותרת גיים כבויה — לחץ להפעלה'}>
                          📝
                        </button>
                        <button style={s.actionBtn} onClick={() => openMeta(g)} title="תייג">🏷</button>
                        <button style={s.actionBtn} onClick={() => handleDuplicate(g.folderId)} title="שכפל">⧉</button>
                        {canDelete && <button style={{ ...s.actionBtn, color: '#f87171' }} onClick={() => handleDelete(g.folderId, g.title)} title="מחק">🗑</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visibleGames.length === 0 && !loading && (
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

  // Search bar
  searchBar: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 },
  searchInput: { flex: 1, background: '#1e2235', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 16px', color: '#e2e8f0', fontSize: 15, direction: 'rtl', outline: 'none' },
  advBtn: { background: '#1e2235', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#94a3b8', padding: '10px 16px', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, position: 'relative', whiteSpace: 'nowrap', flexShrink: 0 },
  advBtnOpen: { borderColor: '#7c3aed', color: '#a78bfa', background: 'rgba(124,58,237,0.1)' },
  filterDot: { width: 7, height: 7, borderRadius: '50%', background: '#7c3aed', position: 'absolute', top: 7, left: 7 },
  clearBtn: { background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#94a3b8', padding: '8px 12px', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0 },

  // Advanced panel
  advPanel: { background: '#1a1d2e', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 12, padding: '16px 20px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 14 },
  advRow: { display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' },
  advGroup: { display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 160 },
  advLabel: { fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' },
  advSelect: { background: '#0f1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 10px', color: '#e2e8f0', fontSize: 14, outline: 'none', cursor: 'pointer' },
  chipRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  chip: { background: '#0f1117', border: '1.5px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '5px 11px', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, color: '#94a3b8' },
  chipCount: { background: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: '1px 5px', fontSize: 11, color: '#64748b' },

  // Active filter badges
  activeFilters: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 },
  badge: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '3px 10px', fontSize: 12, color: '#94a3b8' },

  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modalCard: { background: '#1a1d2e', borderRadius: 16, padding: 32, width: 420, border: '1px solid rgba(255,255,255,0.08)', maxHeight: '90vh', overflowY: 'auto' },
  modalTitle: { color: '#f1f5f9', fontSize: 20, fontWeight: 700, margin: '0 0 24px', direction: 'rtl' },
  inp: { background: '#0f1117', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 12px', color: '#e2e8f0', fontSize: 14, width: '100%', boxSizing: 'border-box', direction: 'rtl', outline: 'none' },
  modalBtns: { display: 'flex', gap: 10, marginTop: 24 },
  cancelBtn: { flex: 1, background: '#334155', border: 'none', borderRadius: 8, color: '#94a3b8', padding: '10px', cursor: 'pointer' },
  teamBtn: { background: '#0f1117', border: '2px solid', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  loading: { textAlign: 'center', color: '#64748b', padding: 60 },
  tableWrap: { background: '#1a1d2e', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' },
  thead: { background: 'rgba(255,255,255,0.03)' },
  th: { padding: '12px 16px', color: '#64748b', fontSize: 12, fontWeight: 600, textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid rgba(255,255,255,0.04)' },
  td: { padding: '10px 16px', color: '#cbd5e1', fontSize: 14, verticalAlign: 'middle' },
  thumb: { width: 48, height: 36, objectFit: 'cover', borderRadius: 6, display: 'block' },
  thumbPlaceholder: { width: 48, height: 36, background: '#0f1117', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 },
  gameTitle: { fontWeight: 500, color: '#e2e8f0', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  gameId: { fontSize: 11, color: '#475569' },
  tag: { fontSize: 11, background: '#334155', padding: '3px 8px', borderRadius: 20, color: '#94a3b8', whiteSpace: 'nowrap' },
  starBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 2, lineHeight: 1 },
  actionBtn: { background: '#1e2235', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, cursor: 'pointer', padding: '5px 8px', fontSize: 14 },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 24 },
  pageBtn: { background: '#1e2235', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#94a3b8', padding: '8px 14px', cursor: 'pointer', fontSize: 14 },
};
