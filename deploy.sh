#!/usr/bin/env bash
# deploy.sh — clone latest files from GitHub and deploy to playbuzz-renderer
# Usage: bash deploy.sh
set -e

REPO="avico123/course1"
BRANCH="claude/text-input-issue-k1uynr"
SERVER_DIR="/opt/playbuzz-renderer"
GAMES_DIR="${GAMES_DIR:-/mnt/data/games}"
CLONE_DIR="/tmp/course1-deploy-$$"

echo "=== Playbuzz deploy from GitHub (git clone) ==="

# Clone fresh copy — bypasses CDN cache entirely
echo "  → cloning ${REPO}@${BRANCH}"
rm -rf "$CLONE_DIR"
git clone --depth 1 --branch "$BRANCH" "https://github.com/${REPO}.git" "$CLONE_DIR"

cp() { command cp "$1" "$2" && echo "  → $2"; }

# ── Server files ──────────────────────────────────────────────────────────────
cp "${CLONE_DIR}/scan-games.js"             "${SERVER_DIR}/server/scan-games.js"
cp "${CLONE_DIR}/routes-games-updated.js"   "${SERVER_DIR}/server/routes/games.js"

# ── Client: admin pages ───────────────────────────────────────────────────────
cp "${CLONE_DIR}/GamesPage.jsx"             "${SERVER_DIR}/client/src/admin/pages/GamesPage.jsx"
cp "${CLONE_DIR}/GameEditorPage.jsx"        "${SERVER_DIR}/client/src/admin/pages/GameEditorPage.jsx"

# ── Client: editor ───────────────────────────────────────────────────────────
cp "${CLONE_DIR}/BlockEditor.jsx"           "${SERVER_DIR}/client/src/admin/editor/BlockEditor.jsx"
cp "${CLONE_DIR}/BlockRenderer.jsx"         "${SERVER_DIR}/client/src/admin/editor/BlockRenderer.jsx"
cp "${CLONE_DIR}/FlipCardBlock.jsx"         "${SERVER_DIR}/client/src/admin/editor/blocks/FlipCardBlock.jsx"
cp "${CLONE_DIR}/blocks-index.jsx"          "${SERVER_DIR}/client/src/admin/editor/blocks/index.jsx"

# ── Client: game renderer ─────────────────────────────────────────────────────
cp "${CLONE_DIR}/GameRenderer.jsx"          "${SERVER_DIR}/client/src/GameRenderer.jsx"
cp "${CLONE_DIR}/StoryPattern.jsx"          "${SERVER_DIR}/client/src/components/patterns/StoryPattern.jsx"
cp "${CLONE_DIR}/FlipCardSection.jsx"       "${SERVER_DIR}/client/src/components/patterns/FlipCardSection.jsx"

# ── Patch server-only files ───────────────────────────────────────────────────
cp "${CLONE_DIR}/fix-server.js"             "/tmp/fix-server.js"
echo "=== Patching server files ==="
node /tmp/fix-server.js

# blocks-index.jsx is self-contained — restore it after fix-server.js patching
echo "  → restoring blocks/index.jsx to clean version"
command cp "${CLONE_DIR}/blocks-index.jsx"  "${SERVER_DIR}/client/src/admin/editor/blocks/index.jsx"

# Cleanup
rm -rf "$CLONE_DIR"

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
