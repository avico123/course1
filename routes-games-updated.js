const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { requireAuth, requireRole } = require('../auth/middleware');

const router = express.Router();
const GAMES_DIR  = process.env.GAMES_DIR || '/mnt/data/games';
const INDEX_PATH = path.join(__dirname, '..', 'items-index.json');

// ── In-memory index ───────────────────────────────────────────────────────────
let _index = null;
let _indexBuiltAt = null;

function loadIndex() {
  if (!fs.existsSync(INDEX_PATH)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
    _indexBuiltAt = raw.builtAt;
    return raw.items || [];
  } catch { return null; }
}

function getIndex() {
  if (!_index) _index = loadIndex();
  return _index;
}

function invalidateIndex() {
  _index = null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function readGameJson(gameId) {
  return JSON.parse(fs.readFileSync(path.join(GAMES_DIR, gameId, 'item.json'), 'utf8'));
}

function writeGameJson(gameId, data) {
  fs.writeFileSync(path.join(GAMES_DIR, gameId, 'item.json'), JSON.stringify(data, null, 2));
}

function getGameDirs() {
  return fs.readdirSync(GAMES_DIR).filter(name => {
    const fullPath = path.join(GAMES_DIR, name);
    return fs.statSync(fullPath).isDirectory() &&
           fs.existsSync(path.join(fullPath, 'item.json'));
  });
}

function sanitizeId(id) {
  return /^[\w-]+$/.test(id);
}

// ── GET /api/games — list ─────────────────────────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  try {
    const { search, pattern, lang, issues, teamStatus, contextTag, page = 1, limit = 50 } = req.query;

    const idx = getIndex();

    if (!idx) {
      // Fallback: old slow scan if index not built yet
      return fallbackList(req, res);
    }

    let items = [...idx];

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(g => (g.title || '').toLowerCase().includes(q));
    }
    if (pattern) {
      items = items.filter(g => g.patternId?.toLowerCase() === pattern.toLowerCase());
    }
    if (lang) {
      items = items.filter(g => g.detectedLang === lang);
    }
    if (issues === 'true' || issues === '1') {
      items = items.filter(g => g.issues && g.issues.length > 0);
    }
    if (teamStatus) {
      items = items.filter(g => g.teamStatus === teamStatus);
    }
    if (contextTag) {
      items = items.filter(g => (g.contextTags || []).includes(contextTag));
    }

    const total = items.length;
    const lim   = parseInt(limit);
    const start = (parseInt(page) - 1) * lim;
    const paginated = items.slice(start, start + lim);

    res.json({
      total,
      page: parseInt(page),
      limit: lim,
      indexBuiltAt: _indexBuiltAt,
      games: paginated.map(g => ({
        itemId:      g.itemId,
        folderId:    g.folderId,
        title:       g.title,
        patternId:   g.patternId,
        status:      g.status,
        locale:      g.locale,
        detectedLang: g.detectedLang,
        thumbnail:   g.thumbnailUrl || null,
        lastEdit:    g.lastEdit,
        issues:      g.issues,
        teamStatus:  g.teamStatus,
        teamNote:    g.teamNote,
        assignedTo:  g.assignedTo,
        langOverride: g.langOverride || '',
        contextTags:  g.contextTags || [],
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function fallbackList(req, res) {
  const { search, pattern, page = 1, limit = 50 } = req.query;
  const dirs = getGameDirs();
  let games = [];
  for (const gameId of dirs) {
    try {
      const data = readGameJson(gameId);
      games.push({
        itemId: data.itemId || gameId, folderId: gameId,
        title: data.title, patternId: data.patternId,
        status: data.status, locale: data.locale,
        thumbnail: data.thumbnail?.croppedImageURL || null,
        lastEdit: data.lastEdit, issues: [], detectedLang: 'unknown',
      });
    } catch {}
  }
  games.sort((a, b) => new Date(b.lastEdit) - new Date(a.lastEdit));
  if (search) { const q = search.toLowerCase(); games = games.filter(g => (g.title || '').toLowerCase().includes(q)); }
  if (pattern) { games = games.filter(g => g.patternId?.toLowerCase() === pattern.toLowerCase()); }
  const total = games.length;
  const lim = parseInt(limit);
  res.json({ total, page: parseInt(page), limit: lim, games: games.slice((page - 1) * lim, page * lim) });
}

// ── GET /api/games/index-status ───────────────────────────────────────────────
router.get('/index-status', requireAuth, (req, res) => {
  const idx = getIndex();
  res.json({
    hasIndex: !!idx,
    builtAt: _indexBuiltAt,
    count: idx?.length || 0,
  });
});

// ── POST /api/games/rebuild-index — trigger re-scan ───────────────────────────
router.post('/rebuild-index', requireAuth, requireRole('superadmin', 'admin'), (req, res) => {
  const { execFile } = require('child_process');
  const scriptPath = path.join(__dirname, '..', 'scan-games.js');
  res.json({ ok: true, message: 'Scan started, check back in ~60 seconds' });
  execFile('node', [scriptPath], { env: { ...process.env } }, (err, stdout, stderr) => {
    invalidateIndex();
    if (err) console.error('Scan error:', stderr);
    else console.log('Scan complete:', stdout.slice(-200));
  });
});

// ── GET /api/games/stats ──────────────────────────────────────────────────────
router.get('/stats', requireAuth, (req, res) => {
  try {
    const idx = getIndex();
    if (!idx) return res.json({});

    const langs = {}, patterns = {}, issues = {}, teamStatuses = {};
    for (const g of idx) {
      langs[g.detectedLang] = (langs[g.detectedLang] || 0) + 1;
      patterns[g.patternId] = (patterns[g.patternId] || 0) + 1;
      if (g.teamStatus) teamStatuses[g.teamStatus] = (teamStatuses[g.teamStatus] || 0) + 1;
      for (const iss of (g.issues || [])) issues[iss] = (issues[iss] || 0) + 1;
    }
    res.json({ total: idx.length, langs, patterns, issues, teamStatuses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/games/patterns ───────────────────────────────────────────────────
router.get('/patterns', requireAuth, (req, res) => {
  try {
    const idx = getIndex();
    if (idx) {
      const counts = {};
      idx.forEach(g => { const p = g.patternId || 'unknown'; counts[p] = (counts[p] || 0) + 1; });
      return res.json(counts);
    }
    const dirs = getGameDirs();
    const counts = {};
    for (const gameId of dirs) {
      try { const d = readGameJson(gameId); const p = d.patternId || 'unknown'; counts[p] = (counts[p] || 0) + 1; } catch {}
    }
    res.json(counts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/games/:id/meta — team tagging ──────────────────────────────────
router.patch('/:id/meta', requireAuth, (req, res) => {
  const { id } = req.params;
  if (!sanitizeId(id)) return res.status(400).json({ error: 'Invalid id' });

  const metaPath = path.join(GAMES_DIR, id, '_meta.json');
  let existing = {};
  if (fs.existsSync(metaPath)) {
    try { existing = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch {}
  }

  const { status, note, assignedTo, langOverride, contextTags } = req.body;
  if (status !== undefined)       existing.status       = status;
  if (note !== undefined)         existing.note         = note;
  if (assignedTo !== undefined)   existing.assignedTo   = assignedTo;
  if (langOverride !== undefined) existing.langOverride = langOverride;
  if (contextTags !== undefined)  existing.contextTags  = contextTags;
  existing.updatedAt  = new Date().toISOString();
  existing.updatedBy  = req.user?.username || '';

  fs.writeFileSync(metaPath, JSON.stringify(existing, null, 2));

  // Update in-memory index immediately (no need to re-scan)
  const idx = getIndex();
  if (idx) {
    const item = idx.find(g => g.folderId === id);
    if (item) {
      item.teamStatus  = existing.status || '';
      item.teamNote    = existing.note   || '';
      item.assignedTo  = existing.assignedTo || '';
      if (langOverride !== undefined) {
        item.langOverride = existing.langOverride || '';
        item.detectedLang = existing.langOverride || item.detectedLang;
      }
      if (contextTags !== undefined) item.contextTags = existing.contextTags || [];
    }
  }

  res.json({ ok: true });
});

// ── GET /api/games/:id — full game ───────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    if (!sanitizeId(id)) return res.status(400).json({ error: 'Invalid id' });

    const dirs = getGameDirs();
    let foundFolder = dirs.find(d => d === id);
    if (!foundFolder) {
      for (const gameId of dirs) {
        try {
          const data = readGameJson(gameId);
          if (data.itemId === id) { foundFolder = gameId; break; }
        } catch {}
      }
    }

    if (!foundFolder) return res.status(404).json({ error: 'Game not found' });
    const data = readGameJson(foundFolder);
    data._folderId = foundFolder;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/games — create ──────────────────────────────────────────────────
router.post('/', requireAuth, requireRole('superadmin', 'admin', 'creator'), (req, res) => {
  try {
    const { title, patternId = 'Story', locale = 'he-IL' } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });

    const newId   = crypto.randomUUID();
    const gameDir = path.join(GAMES_DIR, newId);
    fs.mkdirSync(path.join(gameDir, 'files'), { recursive: true });

    const now  = new Date().toISOString();
    const game = {
      itemId: newId, title: title.trim(), description: '',
      patternId, locale, status: 'draft', version: 2,
      isBranded: false, creatorId: req.user.id, authorId: req.user.id,
      creatorName: req.user.name, creationTime: now, lastEdit: now,
      publishDate: now, originalPublishDate: now,
      gameImage: '', gameShareImage: '', thumbnail: null,
      sections: [], tags: [],
    };

    writeGameJson(newId, game);
    invalidateIndex();
    res.status(201).json({ itemId: newId, folderId: newId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/games/:id — update ───────────────────────────────────────────────
router.put('/:id', requireAuth, requireRole('superadmin', 'admin', 'creator'), async (req, res) => {
  const { id } = req.params;
  if (!sanitizeId(id)) return res.status(400).json({ error: 'Invalid id' });

  const itemPath = path.join(GAMES_DIR, id, 'item.json');
  try {
    const data = JSON.parse(await fs.promises.readFile(itemPath, 'utf8'));
    const { title, description, sections, status, patternId, locale, cover, thumbnail } = req.body;

    if (typeof title === 'string')       data.title       = title.trim();
    if (typeof description === 'string') data.description = description.trim();
    if (Array.isArray(sections))         data.sections    = sections;
    if (status && ['draft','published'].includes(status)) data.status = status;
    if (patternId)   data.patternId = patternId;
    if (locale)      data.locale    = locale;
    if (cover !== undefined)     data.cover     = cover;
    if (thumbnail !== undefined) data.thumbnail = thumbnail;
    data.lastEdit = new Date().toISOString();

    await fs.promises.writeFile(itemPath, JSON.stringify(data, null, 2));
    invalidateIndex();
    res.json({ ok: true });
  } catch (e) {
    res.status(e.code === 'ENOENT' ? 404 : 500).json({ error: e.message });
  }
});

// ── DELETE /api/games/:id ─────────────────────────────────────────────────────
router.delete('/:id', requireAuth, requireRole('superadmin', 'admin'), (req, res) => {
  const { id } = req.params;
  if (!sanitizeId(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    fs.rmSync(path.join(GAMES_DIR, id), { recursive: true, force: true });
    invalidateIndex();
    res.json({ ok: true });
  } catch (e) {
    res.status(e.code === 'ENOENT' ? 404 : 500).json({ error: e.message });
  }
});

// ── POST /api/games/:id/upload ────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(GAMES_DIR, req.params.id, 'files');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    if (!['.jpg','.jpeg','.png','.gif','.webp'].includes(ext)) return cb(new Error('Invalid file type'));
    cb(null, `upload_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/:id/upload', requireAuth, requireRole('superadmin','admin','creator'),
  upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ filename: req.file.filename, url: `files/${req.file.filename}`, servePath: `/game-files/${req.params.id}/${req.file.filename}` });
  }
);

// ── POST /api/games/:id/upload-video ─────────────────────────────────────────
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(GAMES_DIR, req.params.id, 'files');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.mp4';
    if (!['.mp4','.webm','.mov'].includes(ext)) return cb(new Error('Invalid file type'));
    cb(null, `upload_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`);
  }
});
const uploadVideo = multer({ storage: videoStorage, limits: { fileSize: 500 * 1024 * 1024 } });

router.post('/:id/upload-video', requireAuth, requireRole('superadmin','admin','creator'),
  uploadVideo.single('video'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ filename: req.file.filename, url: `files/${req.file.filename}`, servePath: `/game-files/${req.params.id}/${req.file.filename}` });
  }
);

// ── POST /api/games/:id/duplicate ────────────────────────────────────────────
router.post('/:id/duplicate', requireAuth, requireRole('superadmin','admin','creator'), (req, res) => {
  const { id } = req.params;
  if (!sanitizeId(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const data  = readGameJson(id);
    const newId = crypto.randomUUID();
    const newDir = path.join(GAMES_DIR, newId);
    fs.mkdirSync(path.join(newDir, 'files'), { recursive: true });

    const srcFiles = path.join(GAMES_DIR, id, 'files');
    if (fs.existsSync(srcFiles)) {
      fs.readdirSync(srcFiles).forEach(file => {
        fs.copyFileSync(path.join(srcFiles, file), path.join(newDir, 'files', file));
      });
    }

    const now   = new Date().toISOString();
    data.itemId = newId;
    data.title  = `${data.title} (copy)`;
    data.status = 'draft';
    data.creationTime = now;
    data.lastEdit     = now;
    data.creatorId    = req.user.id;
    data.creatorName  = req.user.name;

    writeGameJson(newId, data);
    invalidateIndex();
    res.status(201).json({ itemId: newId, folderId: newId });
  } catch (e) {
    res.status(e.code === 'ENOENT' ? 404 : 500).json({ error: e.message });
  }
});

module.exports = router;
