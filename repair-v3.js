#!/usr/bin/env node
// repair-v3.js: removes the two remaining FlipCardBlock fragments
// Fragment A: the "}function FlipCardBlock..." before the VideoCreatorBlock export
// Fragment B: the orphaned body (const SIDES...) after the VideoCreatorBlock export

const fs = require('fs');
const p = '/opt/playbuzz-renderer/client/src/admin/editor/blocks/index.jsx';
let src = fs.readFileSync(p, 'utf8');
console.log('repair-v3.js — file length:', src.length);

// ── Fragment A: "function FlipCardBlock" → "export { VideoCreatorBlock }" ───
const vcExportMarker = "\nexport { VideoCreatorBlock }";
const secondFunc = src.indexOf('function FlipCardBlock', src.indexOf('function FlipCardBlock') + 1);
const vcExportIdx = src.indexOf(vcExportMarker);

console.log('Second FlipCardBlock at:', secondFunc);
console.log('VideoCreatorBlock export at:', vcExportIdx);

if (secondFunc !== -1 && vcExportIdx !== -1 && secondFunc < vcExportIdx) {
  // Remove from "function FlipCardBlock" to just before the VideoCreatorBlock export line
  // Note: there may be a "}" immediately before "function" (concatenated) — keep it
  src = src.slice(0, secondFunc) + src.slice(vcExportIdx);
  console.log('Removed Fragment A');
} else {
  console.log('Fragment A not found or already cleaned');
}

// ── Fragment B: orphaned body after VideoCreatorBlock export ─────────────────
// After the VideoCreatorBlock export line, everything until end of file (or next export)
// should be gone. Find the end of the VideoCreatorBlock export line first.
const vcIdx2 = src.indexOf("\nexport { VideoCreatorBlock }");
if (vcIdx2 !== -1) {
  // Find end of that line
  const lineEnd = src.indexOf('\n', vcIdx2 + 1);
  const afterVc = lineEnd !== -1 ? lineEnd : src.length;
  const rest = src.slice(afterVc);
  // Check if orphaned body exists after it (looks for "const SIDES" or lone "}" )
  const sidesIdx = rest.indexOf('const SIDES');
  if (sidesIdx !== -1) {
    // Remove everything after the VideoCreatorBlock export line
    src = src.slice(0, afterVc) + '\n';
    console.log('Removed Fragment B (orphaned body after VideoCreatorBlock export)');
  } else {
    console.log('Fragment B not found after VideoCreatorBlock export');
  }
} else {
  console.log('VideoCreatorBlock export line not found — cannot remove Fragment B');
}

fs.writeFileSync(p, src);
console.log('Done. File length now:', src.length);
console.log('\nFlipCard/SIDES occurrences:');
src.split('\n').forEach(function(line, i) {
  if (line.includes('FlipCardBlock') || line.includes('const SIDES') || line.includes('VideoCreatorBlock')) {
    console.log('  line ' + (i+1) + ': ' + line.trim().slice(0, 80));
  }
});
