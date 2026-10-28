import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'src');
const sourceExtensions = new Set(['.ts', '.tsx']);
const failures = [];

async function visit(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await visit(fullPath)));
    else if (sourceExtensions.has(path.extname(entry.name))) files.push(fullPath);
  }
  return files;
}

function resolveImport(fromFile, specifier) {
  if (specifier.startsWith('@/')) return path.join(root, specifier.slice(2));
  if (specifier.startsWith('.')) return path.resolve(path.dirname(fromFile), specifier);
  return undefined;
}

function area(file) {
  const relative = path.relative(root, file).split(path.sep);
  if (relative[0] === 'shared') return { kind: 'shared' };
  if (relative[0] === 'features') return { kind: 'feature', name: relative[1] };
  if (relative[0] === 'app') return { kind: 'app' };
  return { kind: 'other' };
}

for (const file of await visit(root)) {
  const sourceArea = area(file);
  const contents = await readFile(file, 'utf8');
  const imports = contents.matchAll(/(?:from\s+|import\s*\()(['"])([^'"]+)\1/g);
  for (const match of imports) {
    const target = resolveImport(file, match[2]);
    if (!target) continue;
    const targetArea = area(target);
    if (sourceArea.kind === 'shared' && ['feature', 'app'].includes(targetArea.kind)) {
      failures.push(`${path.relative(root, file)}: shared cannot import ${match[2]}`);
    }
    if (sourceArea.kind === 'feature' && targetArea.kind === 'app') {
      failures.push(`${path.relative(root, file)}: feature cannot import ${match[2]}`);
    }
    if (
      sourceArea.kind === 'feature' &&
      targetArea.kind === 'feature' &&
      sourceArea.name !== targetArea.name
    ) {
      failures.push(`${path.relative(root, file)}: feature cannot import ${match[2]}`);
    }
  }
}

if (failures.length) {
  console.error(`FAIL: mobile architecture violations\n${failures.join('\n')}`);
  process.exit(1);
}

console.log('PASS: mobile shared -> features -> app dependency direction');
