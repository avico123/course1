#!/usr/bin/env node
// Repairs blocks/index.jsx: removes all orphaned FlipCardBlock fragments (") {" + body)
// These are left behind when the function signature brace-counter stops at the
// parameter destructuring "{ block, ... }" instead of the function body "{".

const fs = require('fs');
const p = '/opt/playbuzz-renderer/client/src/admin/editor/blocks/index.jsx';
let src = fs.readFileSync(p, 'utf8');

console.log('=== repair-blocks.js ===');
console.log('File length before:', src.length);

// Count occurrences of orphaned ") {" followed eventually by "const SIDES"
let removed = 0;
let safety = 20;

while (safety-- > 0) {
  // Find any ") {" that is followed by "const SIDES" within the next 200 chars
  const idx = src.indexOf(') {\n');
  if (idx === -1) break;

  // Check if this is the orphaned FlipCard body (SIDES should appear soon)
  const nextChunk = src.slice(idx, idx + 300);
  if (!nextChunk.includes('const SIDES')) {
    // Not our fragment — move on (can't loop safely so just stop)
    console.log('Found ) { but no SIDES nearby — skipping');
    break;
  }

  console.log('Found orphaned ) { at position', idx);

  // Remove from the ") {" back to the start of its line
  let lineStart = idx;
  while (lineStart > 0 && src[lineStart - 1] !== '\n') lineStart--;
  // Also eat the blank line before it if any
  let blockStart = lineStart;
  if (blockStart > 1 && src[blockStart - 1] === '\n' && src[blockStart - 2] === '\n') {
    blockStart--;
  }

  // Find the end of this orphaned body by counting braces from the {
  let i = idx + 3; // skip ") {" to character after {
  let depth = 1; // we're already inside the {
  while (i < src.length && depth > 0) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
    i++;
  }
  // eat trailing newlines
  while (i < src.length && src[i] === '\n') i++;

  src = src.slice(0, blockStart) + src.slice(i);
  removed++;
  console.log('Removed fragment #' + removed);
}

// Also remove any lone ") {" lines (same issue, no SIDES visible)
const beforeLines = src;
src = src.split('\n').filter((line, i, arr) => {
  if (line.trim() === ') {') {
    console.log('Removing orphaned line: ) {  at line ~' + (i + 1));
    return false;
  }
  return true;
}).join('\n');

console.log('File length after:', src.length);
fs.writeFileSync(p, src);

console.log('\nRemoved', removed, 'orphaned fragment(s)');
console.log('\nCurrent FlipCard/ImagePicker occurrences:');
src.split('\n').forEach((line, i) => {
  if (line.includes('FlipCardBlock') || line.includes('ImagePicker') || line.includes('const SIDES')) {
    console.log('  line ' + (i + 1) + ': ' + line.trim().slice(0, 80));
  }
});
