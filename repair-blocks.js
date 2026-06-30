#!/usr/bin/env node
// Repairs blocks/index.jsx: removes duplicate/orphaned FlipCardBlock fragments
// Keeps only the FIRST complete definition, removes all subsequent ones.

const fs = require('fs');
const p = '/opt/playbuzz-renderer/client/src/admin/editor/blocks/index.jsx';
let src = fs.readFileSync(p, 'utf8');
console.log('=== repair-blocks.js ===\nFile length before:', src.length);

// Find end of a function body starting from its opening {
// bodyOpenIdx = index of the "{" that opens the function body
function findBodyEnd(src, bodyOpenIdx) {
  let depth = 1, i = bodyOpenIdx + 1;
  while (i < src.length && depth > 0) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
    i++;
  }
  return i; // index AFTER the closing }
}

// Find the first FlipCardBlock, determine where it ends
const first = src.indexOf('function FlipCardBlock');
if (first === -1) { console.error('No FlipCardBlock found at all!'); process.exit(1); }

// Find ") {" after the function name = end of params, start of body
const bodyOpenParen = src.indexOf(') {', first);
const firstEnd = findBodyEnd(src, bodyOpenParen + 2); // +2 to point at the {
console.log('First FlipCardBlock ends at position', firstEnd);

// Now remove all subsequent FlipCardBlock occurrences
let removed = 0;
while (true) {
  // Look for next "function FlipCardBlock" after firstEnd
  const next = src.indexOf('function FlipCardBlock', firstEnd);
  if (next === -1) break;

  // There might be a "}" immediately before "function" with no newline (concatenated)
  // In that case, keep the "}" (it closes the previous function)
  let removeFrom = next;
  if (next > 0 && src[next - 1] === '}') {
    removeFrom = next; // keep the } at next-1, start removal at 'function'
  }

  // Find body open and end for this duplicate
  const dupBodyParen = src.indexOf(') {', next);
  if (dupBodyParen === -1) break;
  const dupEnd = findBodyEnd(src, dupBodyParen + 2);

  // eat trailing newlines
  let eat = dupEnd;
  while (eat < src.length && src[eat] === '\n') eat++;

  console.log('Removing duplicate FlipCardBlock at position', removeFrom, '→', eat);
  src = src.slice(0, removeFrom) + src.slice(eat);
  removed++;
  // firstEnd didn't change since we removed content after it
}

// Also remove any orphaned bodies: lines with "const SIDES" that are NOT inside a function
// (i.e., there's no "function FlipCardBlock" within the 10 lines before them)
const lines = src.split('\n');
let inOrphaned = false;
let orphanDepth = 0;
const cleanLines = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!inOrphaned) {
    // Detect orphaned body: ") {" on its own line or "const SIDES" with no preceding function header
    if ((line.trim() === ') {' || line.trim() === '){') &&
        lines.slice(Math.max(0, i-2), i).every(l => !l.includes('function FlipCardBlock'))) {
      // Check if next line has SIDES
      if (i + 1 < lines.length && lines[i+1].includes('const SIDES')) {
        console.log('Found orphaned ") {" at line', i+1, '— removing body');
        inOrphaned = true;
        orphanDepth = 1;
        continue; // skip this line
      }
    }
    cleanLines.push(line);
  } else {
    // Count braces to find end of orphaned body
    for (const ch of line) {
      if (ch === '{') orphanDepth++;
      else if (ch === '}') orphanDepth--;
    }
    if (orphanDepth <= 0) {
      inOrphaned = false;
      console.log('Orphaned body ended at line', i+1);
    }
    // skip this line
  }
}
src = cleanLines.join('\n');

console.log('File length after:', src.length);
fs.writeFileSync(p, src);
console.log('Removed', removed, 'duplicate(s)\n');
console.log('FlipCard/ImagePicker occurrences now:');
src.split('\n').forEach((line, i) => {
  if (line.includes('FlipCardBlock') || line.includes('const SIDES') || line.includes('ImagePicker')) {
    console.log('  line ' + (i+1) + ': ' + line.trim().slice(0, 90));
  }
});
