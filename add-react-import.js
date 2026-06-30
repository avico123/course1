#!/usr/bin/env node
const fs = require('fs');
const p = '/opt/playbuzz-renderer/client/src/admin/editor/blocks/index.jsx';
let src = fs.readFileSync(p, 'utf8');
const firstLine = src.split('\n')[0];
console.log('First line:', firstLine);
const hasUseState = src.indexOf('useState') !== -1;
if (hasUseState) {
  console.log('useState already present');
} else {
  src = "import { useState, useRef } from 'react';\n" + src;
  fs.writeFileSync(p, src);
  console.log('Added useState/useRef import at top');
}
