import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(frontRoot, 'src');
const finalMode = process.argv.includes('--final');
const failures = [];

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function sourceFiles(root) {
  const files = [];
  if (!(await exists(root))) return files;
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(target)));
    else if (/\.(?:ts|tsx)$/.test(entry.name)) files.push(target);
  }
  return files;
}

function sourceModule(file) {
  return path.relative(srcRoot, file).split(path.sep);
}

function resolveImport(file, specifier) {
  if (specifier.startsWith('@/')) return path.join(srcRoot, specifier.slice(2));
  if (specifier.startsWith('.')) return path.resolve(path.dirname(file), specifier);
  return undefined;
}

function importedFeature(target) {
  const relative = path.relative(srcRoot, target).split(path.sep);
  return relative[0] === 'features' ? relative[1] : undefined;
}

const files = await sourceFiles(srcRoot);
for (const file of files) {
  const contents = await readFile(file, 'utf8');
  const moduleParts = sourceModule(file);
  const ownerFeature = moduleParts[0] === 'features' ? moduleParts[1] : undefined;
  const isAppEntry = moduleParts.length === 1 && moduleParts[0] === 'App.tsx';
  const isShared = !isAppEntry && !['app', 'features'].includes(moduleParts[0]);
  const imports = [
    ...contents.matchAll(/(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g),
  ].map((match) => match[1]);

  for (const specifier of imports) {
    const target = resolveImport(file, specifier);
    if (!target) continue;
    const targetParts = path.relative(srcRoot, target).split(path.sep);
    const targetFeature = importedFeature(target);
    if (ownerFeature && targetFeature && targetFeature !== ownerFeature) {
      failures.push(`${path.relative(frontRoot, file)} imports feature "${targetFeature}"`);
    }
    if (ownerFeature && targetParts[0] === 'app') {
      failures.push(`${path.relative(frontRoot, file)} imports app code`);
    }
    if (isShared && ['app', 'features'].includes(targetParts[0])) {
      failures.push(
        `${path.relative(frontRoot, file)} has a reverse dependency on ${targetParts[0]}`,
      );
    }
  }

  if (moduleParts[0] === 'features' && path.basename(file) === 'api.ts') {
    const bannedImport = imports.find(
      (specifier) =>
        /(?:^|\/)(?:components|stores|hooks)(?:\/|$)/.test(specifier) ||
        ['react-hook-form', 'zustand'].includes(specifier),
    );
    if (bannedImport) {
      failures.push(`${path.relative(frontRoot, file)} imports responsibility "${bannedImport}"`);
    }
  }
}

const exceptionPath = path.join(frontRoot, 'architecture-legacy-exceptions.json');
const exceptions = JSON.parse(await readFile(exceptionPath, 'utf8'));
const duplicateExceptions = exceptions.paths.filter(
  (item, index) => exceptions.paths.indexOf(item) !== index,
);
if (duplicateExceptions.length) {
  failures.push(`duplicate legacy exceptions: ${duplicateExceptions.join(', ')}`);
}
for (const exception of exceptions.paths) {
  if (!(await exists(path.join(frontRoot, exception)))) {
    failures.push(`stale legacy exception: ${exception}`);
  }
}
if (finalMode && exceptions.paths.length) {
  failures.push(`final audit requires zero legacy exceptions; found ${exceptions.paths.length}`);
}

if (failures.length) {
  console.error(['Architecture audit failed:', ...failures.map((item) => `- ${item}`)].join('\n'));
  process.exit(1);
}

console.log(
  `PASS: ${files.length} source files respect module boundaries; ${exceptions.paths.length} tracked legacy exceptions remain.`,
);
