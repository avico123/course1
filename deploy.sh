#!/usr/bin/env bash
# deploy.sh — pull latest files from GitHub and deploy to playbuzz-renderer
# Usage: bash deploy.sh
set -e

REPO="avico123/course1"
BRANCH="claude/jolly-tesla-7slsu3"
RAW="https://raw.githubusercontent.com/${REPO}/${BRANCH}"
SERVER_DIR="/opt/playbuzz-renderer"
GAMES_DIR="${GAMES_DIR:-/mnt/data/games}"

echo "=== Playbuzz deploy from GitHub ==="

fetch() {
  local url="$1"
  local dest="$2"
  echo "  → $dest"
  curl -fsSL "$url" -o "$dest"
}

# ── Server files ──────────────────────────────────────────────────────────────
fetch "${RAW}/scan-games.js"             "${SERVER_DIR}/server/scan-games.js"
fetch "${RAW}/routes-games-updated.js"   "${SERVER_DIR}/server/routes/games.js"

# ── Client: admin pages ───────────────────────────────────────────────────────
fetch "${RAW}/GamesPage.jsx"             "${SERVER_DIR}/client/src/admin/pages/GamesPage.jsx"
fetch "${RAW}/GameEditorPage.jsx"        "${SERVER_DIR}/client/src/admin/pages/GameEditorPage.jsx"

# ── Client: editor ───────────────────────────────────────────────────────────
fetch "${RAW}/BlockEditor.jsx"           "${SERVER_DIR}/client/src/admin/editor/BlockEditor.jsx"
fetch "${RAW}/BlockRenderer.jsx"         "${SERVER_DIR}/client/src/admin/editor/BlockRenderer.jsx"
fetch "${RAW}/FlipCardBlock.jsx"         "${SERVER_DIR}/client/src/admin/editor/blocks/FlipCardBlock.jsx"

# ── Client: game renderer ─────────────────────────────────────────────────────
fetch "${RAW}/GameRenderer.jsx"          "${SERVER_DIR}/client/src/GameRenderer.jsx"
fetch "${RAW}/StoryPattern.jsx"          "${SERVER_DIR}/client/src/components/patterns/StoryPattern.jsx"

# ── Patch server-only files (FlipCardSection, blocks/index) ──────────────────
fetch "${RAW}/fix-server.js"             "/tmp/fix-server.js"
echo "=== Patching server files ==="
node /tmp/fix-server.js

echo ""
echo "=== Building client ==="
cd "${SERVER_DIR}/client"
npm run build

echo ""
echo "=== Restarting server ==="
pm2 restart all

echo ""
echo "=== Running index scan ==="
GAMES_DIR="${GAMES_DIR}" node "${SERVER_DIR}/server/scan-games.js"

echo ""
echo "✅ Deploy complete!"
echo "   Open https://buzz.herzog.ac.il/admin to verify."
