#!/usr/bin/env bash
# Run on the server to dump key source files to /tmp/src-dump/
# Then paste their contents back to the developer for review.
# Usage: bash /tmp/dump-src.sh
SERVER_DIR="/opt/playbuzz-renderer"
OUT="/tmp/src-dump"
mkdir -p "$OUT"

copy() {
  local src="$1"
  local name="$2"
  if [ -f "$src" ]; then
    cp "$src" "$OUT/$name"
    echo "✓ $name"
  else
    echo "✗ NOT FOUND: $src"
  fi
}

copy "${SERVER_DIR}/client/src/components/patterns/TriviaSection.jsx"   "TriviaSection.jsx"
copy "${SERVER_DIR}/client/src/components/patterns/ConvoSection.jsx"     "ConvoSection.jsx"
copy "${SERVER_DIR}/client/src/components/patterns/QuoteSection.jsx"     "QuoteSection.jsx"
copy "${SERVER_DIR}/client/src/App.jsx"                                  "App.jsx"
copy "${SERVER_DIR}/client/src/components/Navbar.jsx"                    "Navbar.jsx"
copy "${SERVER_DIR}/client/src/components/Header.jsx"                    "Header.jsx"
copy "${SERVER_DIR}/client/src/components/Layout.jsx"                    "Layout.jsx"

# Try to find nav/header if not in standard locations
for f in $(find "${SERVER_DIR}/client/src" -name "*.jsx" | xargs grep -l "hamburger\|menuOpen\|isOpen\|sidebar\|drawer" 2>/dev/null | head -5); do
  name=$(basename "$f")
  copy "$f" "nav_$name"
done

echo ""
echo "Files saved to $OUT"
echo "Run: ls -la $OUT && cat $OUT/TriviaSection.jsx"
