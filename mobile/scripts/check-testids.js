#!/usr/bin/env node
// Fails (exit 1) if any interactive element in a covered screen lacks an explicit testID prop.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const covered = JSON.parse(fs.readFileSync(path.join(root, 'e2e', 'covered-screens.json'), 'utf8'));
const INTERACTIVE = /<(TouchableOpacity|Pressable|TextInput|Switch|IconButton)\b/g;

// Patterns that precede type generics (not real JSX elements)
const REF_PATTERNS = /(useRef|createRef|RefObject|ElementRef|ComponentRef|ComponentProps)\s*$/;

let failures = 0;
for (const rel of covered) {
  const file = path.join(root, rel);
  let src = fs.readFileSync(file, 'utf8');

  // Strip comments: replace block comments and line comments with equivalent whitespace/newlines
  // Block comments: /* ... */
  src = src.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '));
  // Line comments: // ... (to end of line)
  src = src.replace(/^\s*\/\/.*$/gm, (match) => match.replace(/[^\n]/g, ' '));

  let m;
  while ((m = INTERACTIVE.exec(src)) !== null) {
    // Skip if preceded by a ref pattern (e.g., useRef<TextInput>)
    const beforeMatch = src.slice(Math.max(0, m.index - 50), m.index);
    if (REF_PATTERNS.test(beforeMatch)) {
      continue;
    }

    // capture the full opening tag (scan to the matching '>' outside JSX-expression braces)
    let depth = 0,
      i = m.index,
      end = -1;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
      else if (src[i] === '>' && depth === 0) {
        end = i;
        break;
      }
    }
    const tag = src.slice(m.index, end + 1);
    if (!/\btestID\s*=/.test(tag)) {
      const line = src.slice(0, m.index).split('\n').length;
      console.error(`MISSING testID: ${rel}:${line} <${m[1]}>`);
      failures++;
    }
  }
}
if (failures) {
  console.error(`\n${failures} interactive element(s) missing testID.`);
  process.exit(1);
}
console.log(`check-testids: OK (${covered.length} screens covered)`);
