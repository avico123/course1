#!/usr/bin/env node
// Adds "import { useState, useRef } from 'react';" to top of blocks/index.jsx
// only if there is no existing react import statement.
const fs = require('fs');
const p = '/opt/playbuzz-renderer/client/src/admin/editor/blocks/index.jsx';
let src = fs.readFileSync(p, 'utf8');
const hasImport = src.indexOf("from 'react'") !== -1 || src.indexOf('from "react"') !== -1;
if (hasImport) {
  console.log('React import already present');
} else {
  src = "import { useState, useRef } from 'react';\n" + src;
  fs.writeFileSync(p, src);
  console.log('Added: import { useState, useRef } from react');
}
console.log('First line now:', src.split('\n')[0]);
