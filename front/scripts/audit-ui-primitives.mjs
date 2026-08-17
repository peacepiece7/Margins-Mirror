import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const sourceRoot = path.resolve('src');
const rawControlPattern = /<(button|input|select|textarea)\b/g;
const violations = [];

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (target === path.join(sourceRoot, 'components', 'ui')) continue;
      await visit(target);
      continue;
    }
    if (!entry.name.endsWith('.tsx') || entry.name.endsWith('.test.tsx')) continue;
    const source = await readFile(target, 'utf8');
    for (const match of source.matchAll(rawControlPattern)) {
      const line = source.slice(0, match.index).split('\n').length;
      violations.push(`${path.relative(process.cwd(), target)}:${line} raw <${match[1]}>`);
    }
  }
}

await visit(sourceRoot);

const stylesheet = await readFile(path.join(sourceRoot, 'styles', 'index.css'), 'utf8');
const mobileContractFragments = [
  '--margins-page-gutter:',
  '--margins-card-padding:',
  '--margins-control-gap:',
  '--margins-section-gap:',
  '@media (pointer: coarse)',
  "[data-slot='button']",
  "[data-slot='input']",
  "[data-slot='select-trigger']",
  "[data-slot='tabs-list']",
  "[data-slot='tabs-trigger']",
  'min-height: 3.125rem',
  'min-width: 2.75rem',
  'min-height: 2.75rem',
];

for (const fragment of mobileContractFragments) {
  if (!stylesheet.includes(fragment)) {
    violations.push(`src/styles/index.css missing mobile UI contract: ${fragment}`);
  }
}

if (violations.length) {
  console.error('Use the shared components in src/components/ui for interactive controls.');
  console.error(violations.join('\n'));
  process.exit(1);
}

console.log('UI primitive audit passed.');
