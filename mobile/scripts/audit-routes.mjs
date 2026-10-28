import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const appRoot = join(mobileRoot, 'src', 'app');
const sddPath = join(dirname(mobileRoot), 'docs', 'architecture', 'mobile-application', 'sdd.md');

// This list is the executable route contract from the mobile-application SDD.
// Route groups are retained in the labels so a missing public/protected boundary
// cannot be hidden by a same-named file elsewhere in the tree.
const requiredRoutes = new Map([
  ['/', 'index.tsx'],
  ['root layout', '_layout.tsx'],
  ['/(public) layout', '(public)/_layout.tsx'],
  ['/(public)/login', '(public)/login.tsx'],
  ['/(public)/signup', '(public)/signup.tsx'],
  ['/(public)/recovery', '(public)/recovery.tsx'],
  ['/(public)/oauth/google', '(public)/oauth/google.tsx'],
  ['/privacy', 'privacy.tsx'],
  ['/privacy-history', 'privacy-history.tsx'],
  ['/terms', 'terms.tsx'],
  ['/terms-history', 'terms-history.tsx'],
  ['/consent', 'consent.tsx'],
  ['/consent-account', 'consent-account.tsx'],
  ['/(protected) layout', '(protected)/_layout.tsx'],
  ['/(protected)/(tabs) layout', '(protected)/(tabs)/_layout.tsx'],
  ['/(protected)/(tabs)/library', '(protected)/(tabs)/library.tsx'],
  ['/(protected)/(tabs)/reflection', '(protected)/(tabs)/reflection.tsx'],
  ['/(protected)/(tabs)/discover', '(protected)/(tabs)/discover.tsx'],
  ['/(protected)/(tabs)/reviews', '(protected)/(tabs)/reviews.tsx'],
  ['/(protected)/(tabs)/account', '(protected)/(tabs)/account.tsx'],
  ['/(protected)/reviews/[insightId]', '(protected)/reviews/[insightId].tsx'],
  ['/(protected)/memory-cards', '(protected)/memory-cards/index.tsx'],
  ['/(protected)/memory-cards/[groupId]', '(protected)/memory-cards/[groupId].tsx'],
  [
    '/(protected)/memory-cards/[groupId]/study',
    '(protected)/memory-cards/[groupId]/study.tsx',
  ],
  ['/(protected)/books/[bookId]', '(protected)/books/[bookId].tsx'],
  ['/(protected)/books/[bookId]/session', '(protected)/books/[bookId]/session.tsx'],
  [
    '/(protected)/books/[bookId]/reflection',
    '(protected)/books/[bookId]/reflection/index.tsx',
  ],
  [
    '/(protected)/books/[bookId]/reflection/interview',
    '(protected)/books/[bookId]/reflection/interview.tsx',
  ],
  [
    '/(protected)/books/[bookId]/reflection/guide/[guideId]',
    '(protected)/books/[bookId]/reflection/guide/[guideId].tsx',
  ],
  [
    '/(protected)/books/[bookId]/reflection/discuss/[runId]',
    '(protected)/books/[bookId]/reflection/discuss/[runId].tsx',
  ],
  [
    '/(protected)/books/[bookId]/reflection/refine/[runId]',
    '(protected)/books/[bookId]/reflection/refine/[runId].tsx',
  ],
  [
    '/(protected)/books/[bookId]/debates',
    '(protected)/books/[bookId]/debates/index.tsx',
  ],
  [
    '/(protected)/books/[bookId]/debates/[windowId]',
    '(protected)/books/[bookId]/debates/[windowId].tsx',
  ],
]);

const documentedRouteTokens = new Map([
  ['/(public)/login', '(public)/login.tsx'],
  ['/(public)/signup', '(public)/signup.tsx'],
  ['/(public)/recovery', '(public)/recovery.tsx'],
  ['/(public)/oauth/google', '(public)/oauth/google.tsx'],
  ['/privacy', 'privacy.tsx'],
  ['/privacy-history', 'privacy-history.tsx'],
  ['/terms', 'terms.tsx'],
  ['/terms-history', 'terms-history.tsx'],
  ['/consent', 'consent.tsx'],
  ['/consent-account', 'consent-account.tsx'],
  ['/(protected)/(tabs)/library', '(protected)/(tabs)/library.tsx'],
  ['/(protected)/(tabs)/reflection', '(protected)/(tabs)/reflection.tsx'],
  ['discover', '(protected)/(tabs)/discover.tsx'],
  ['reviews', '(protected)/(tabs)/reviews.tsx'],
  ['account', '(protected)/(tabs)/account.tsx'],
  ['/(protected)/memory-cards', '(protected)/memory-cards/index.tsx'],
  ['[groupId]', '(protected)/memory-cards/[groupId].tsx'],
  ['books/[bookId]', '(protected)/books/[bookId].tsx'],
  ['session', '(protected)/books/[bookId]/session.tsx'],
  ['reflection', '(protected)/books/[bookId]/reflection/index.tsx'],
  ['reflection/interview', '(protected)/books/[bookId]/reflection/interview.tsx'],
  [
    'reflection/guide/[guideId]',
    '(protected)/books/[bookId]/reflection/guide/[guideId].tsx',
  ],
  [
    'reflection/discuss/[runId]',
    '(protected)/books/[bookId]/reflection/discuss/[runId].tsx',
  ],
  [
    'reflection/refine/[runId]',
    '(protected)/books/[bookId]/reflection/refine/[runId].tsx',
  ],
  ['debates', '(protected)/books/[bookId]/debates/index.tsx'],
  ['debates/[windowId]', '(protected)/books/[bookId]/debates/[windowId].tsx'],
]);
const routeSectionNonRoutes = new Set([
  'consentRequired',
  'bookId',
  'sessionId',
  'windowId',
  'guideId',
  'runId',
  'groupId',
]);

const defaultExportPattern =
  /\bexport\s+default\s+(?:(?:async\s+)?function\b|class\b|[A-Za-z_$][\w$]*|\([^)]*\)\s*=>)|\bexport\s*{\s*default\s*}\s*from\b/;
const placeholderTextPattern =
  /\b(?:TODO|FIXME|coming[\s_-]*soon|not[\s_-]*implemented|placeholder)\b/i;
const emptyShellPattern =
  /\breturn\s+(?:null\s*;|<>\s*<\/>)|\bexport\s+default\s*\([^)]*\)\s*=>\s*null\b|<View(?:\s[^>]*)?\s*\/>/s;

const failures = [];

function sourceModules(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceModules(path);
    return /\.[cm]?[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}

const sdd = readFileSync(sddPath, 'utf8');
const routeSection = sdd.match(/### Route graph\n([\s\S]*?)(?=\n### )/)?.[1];
if (!routeSection) {
  failures.push('SDD: missing parseable Route graph section');
} else {
  const currentTokens = new Set(
    [...routeSection.matchAll(/`([^`]+)`/g)]
      .map((match) => match[1])
      .filter((token) => !routeSectionNonRoutes.has(token)),
  );
  for (const token of currentTokens) {
    if (!documentedRouteTokens.has(token)) {
      failures.push(`SDD: undocumented audit mapping for route token ${JSON.stringify(token)}`);
    }
  }
  for (const token of documentedRouteTokens.keys()) {
    if (!currentTokens.has(token)) {
      failures.push(`SDD: stale audit mapping for removed route token ${JSON.stringify(token)}`);
    }
  }
}

for (const [token, relativePath] of documentedRouteTokens) {
  if (!requiredRoutes.has(token) && ![...requiredRoutes.values()].includes(relativePath)) {
    failures.push(`SDD: route token ${JSON.stringify(token)} is not bound to a required module`);
  }
}

for (const [route, relativePath] of requiredRoutes) {
  const path = join(appRoot, relativePath);
  if (!existsSync(path)) {
    failures.push(`${route}: missing exact route module src/app/${relativePath}`);
    continue;
  }

  const source = readFileSync(path, 'utf8');
  if (!defaultExportPattern.test(source)) {
    failures.push(`${route}: route module has no default export`);
  }
  if (placeholderTextPattern.test(source)) {
    failures.push(`${route}: route module contains an obvious placeholder/TODO marker`);
  }
  if (emptyShellPattern.test(source)) {
    failures.push(`${route}: route module is an obvious empty route shell`);
  }
}

const expectedModules = new Set(requiredRoutes.values());
for (const path of sourceModules(appRoot)) {
  const relativePath = path.slice(appRoot.length + 1);
  if (!expectedModules.has(relativePath)) {
    failures.push(
      `unexpected app module src/app/${relativePath}; Expo Router treats files under src/app as route surface`,
    );
  }
}

if (failures.length) {
  console.error('FAIL: mobile route graph does not satisfy the SDD route-module contract.');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `PASS (static definition): ${requiredRoutes.size} SDD route/layout modules exist, default-export, and contain no obvious placeholder shell.`,
);
console.log(
  'EVIDENCE LIMIT: this source audit does not prove native compilation, deep-link association, navigation execution, or device launch.',
);
