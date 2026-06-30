#!/usr/bin/env node
// Patches blockToSection flip-card case to persist frontImage/backImage as backgroundMedia
const fs = require('fs');
const path = '/opt/playbuzz-renderer/client/src/admin/editor/BlockEditor.jsx';

let c = fs.readFileSync(path, 'utf8');

const OLD = `      const fm = { ...(block._rawFront || {}), text: block.frontText || '' };
      const bm = { ...(block._rawBack  || {}), text: block.backText  || '' };`;

const NEW = `      const fm = { ...(block._rawFront || {}), text: block.frontText || '' };
      if (block.frontImage) fm.backgroundMedia = { ...(fm.backgroundMedia || {}), url: block.frontImage };
      const bm = { ...(block._rawBack  || {}), text: block.backText  || '' };
      if (block.backImage)  bm.backgroundMedia = { ...(bm.backgroundMedia  || {}), url: block.backImage };`;

if (c.includes('fm.backgroundMedia = {')) {
  console.log('Already patched — nothing to do.');
  process.exit(0);
}

if (!c.includes(OLD)) {
  console.error('Could not find target block — check BlockEditor.jsx manually.');
  process.exit(1);
}

fs.writeFileSync(path, c.replace(OLD, NEW));
console.log('Patched successfully.');
