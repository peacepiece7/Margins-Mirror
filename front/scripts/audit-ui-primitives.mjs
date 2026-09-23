import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const sourceRoot = path.resolve('src');
const rawControlPattern = /<(button|input|select|textarea)\b/g;
const semanticPalettePattern = /\b(?:bg|border|text|ring)-(?:red|amber|emerald|sky)-\d+\b/g;
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
    for (const match of source.matchAll(semanticPalettePattern)) {
      const line = source.slice(0, match.index).split('\n').length;
      violations.push(
        `${path.relative(process.cwd(), target)}:${line} use a semantic token or primitive variant instead of ${match[0]}`,
      );
    }
    if (/<Input\b[^>]*\btype=["']checkbox["'][^>]*>/s.test(source)) {
      violations.push(
        `${path.relative(process.cwd(), target)}: use the shared Checkbox instead of Input type="checkbox"`,
      );
    }
  }
}

await visit(sourceRoot);

async function loadStyles(file, seen = new Set()) {
  if (seen.has(file)) return '';
  seen.add(file);
  const text = await readFile(file, 'utf8');
  const imports = [...text.matchAll(/@import ['"]([^'"]+)['"]/g)]
    .map((match) => match[1])
    .filter((value) => value.startsWith('.'));
  return (
    text +
    '\n' +
    (
      await Promise.all(
        imports.map((value) => loadStyles(path.resolve(path.dirname(file), value), seen)),
      )
    ).join('\n')
  );
}
const stylesheet = await loadStyles(path.join(sourceRoot, 'styles', 'index.css'));
if (stylesheet.includes('[data-testid')) {
  violations.push(
    'Styles must use persistent data-ui/data-slot selectors, not stripped data-testid attributes',
  );
}
if (
  /button\[class|\[class[~*]?=["'][^"']*(?:text|bg|border|ring)-(?:red|amber|emerald|sky)-/.test(
    stylesheet,
  )
) {
  violations.push(
    'Styles must not infer interactive or semantic variants from Tailwind utility class names',
  );
}
// Conditional feature builds may tree-shake a whole panel; check all styling hooks at source too.
for (const [file, ids] of [
  [
    'features/reflections/components/ReflectionInterviewPanel.tsx',
    ['reflection-interview-question'],
  ],
  [
    'features/reflections/components/GuidedDiscussionPanel.tsx',
    ['guided-discussion-history', 'guided-discussion-composer'],
  ],
]) {
  const source = await readFile(path.join(sourceRoot, file), 'utf8');
  for (const id of ids) {
    if (!source.includes(`data-ui="${id}"`))
      violations.push(`${file}: missing persistent styling hook ${id}`);
  }
}
const tokens = await readFile(path.join(sourceRoot, 'styles', 'tokens.css'), 'utf8');
for (const tone of ['success', 'warning', 'info']) {
  for (const part of ['surface', 'border', 'ink']) {
    if (!tokens.includes(`--${tone}-${part}:`))
      violations.push(`Missing semantic token: ${tone}-${part}`);
  }
}
for (const name of ['alert', 'badge', 'card']) {
  const content = await readFile(path.join(sourceRoot, 'components', 'ui', `${name}.tsx`), 'utf8');
  if (/(?:bg|text|border|ring)-(?:emerald|amber|sky)-\d+/.test(content)) {
    violations.push(`${name}: use semantic status tokens instead of palette colors`);
  }
  if (/\b(?:gap|px|py|max-h)-\(--/.test(content))
    violations.push(`${name}: Tailwind 4 variable shorthand is unsupported`);
}
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
