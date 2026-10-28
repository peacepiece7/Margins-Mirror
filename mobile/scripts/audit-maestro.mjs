import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const flowRoot = join(mobileRoot, '.maestro');
const sourceRoot = join(mobileRoot, 'src');

const requiredFlows = new Map([
  [
    'app-boot.yaml',
    [
      'welcome-screen',
      'product-introduction-steps',
      'memory-card-introduction',
      'assertNotVisible',
      'Your reading room',
    ],
  ],
  ['auth.yaml', ['subflows/login.yaml', 'stopApp', 'account-logout', 'welcome-screen']],
  [
    'registration.yaml',
    [
      'registration-screen',
      'Check email availability',
      'Send verification code',
      'Privacy Policy',
      'AI data transfer terms',
      'at least 14 years old',
      'library-screen',
    ],
  ],
  [
    'recovery.yaml',
    ['recovery-screen', 'Verification code', 'Confirm code', 'Restore account'],
  ],
  [
    'deep-links.yaml',
    ['margins://books/', 'book-detail-screen', 'reading-session-screen', 'not available'],
  ],
  [
    'full-product.yaml',
    [
      'reading-session-screen',
      'reflection-screen',
      'Save reflection',
      'debate-rooms-screen',
      'Debate topic',
      'debate-room-screen',
    ],
  ],
  [
    'community-account.yaml',
    ['reviews-screen', 'review-detail-screen', 'review-comment-submit', 'account-screen', 'Profile saved.'],
  ],
  ['oauth.yaml', ['margins://oauth/google?error=', 'Google sign-in could not be completed.']],
  [
    'discover.yaml',
    [
      'discover-screen',
      'book-candidate-list',
      'Search books',
      'Add a book manually',
      'Book title',
      'Author',
      'library-screen',
    ],
  ],
  [
    'memory-cards.yaml',
    [
      'global-navigation-study',
      'library-selection-prompt',
      'memory-card-groups-screen',
      'memory-card-group-screen',
      'memory-card-study-screen',
      'memory-card-study-reveal',
    ],
  ],
  [
    'privacy-consent.yaml',
    [
      'privacy-screen',
      'Policy history',
      'privacy-history-screen',
      'consent-screen',
      'consent-account',
      'account-screen',
    ],
  ],
  [
    'public-privacy.yaml',
    [
      'welcome-screen',
      'privacy-screen',
      'Version and effective date: 2026-07-27',
      '3. Processing and overseas transfer',
      '5. Resignation, deletion, and retention',
      'Policy history',
      'privacy-history-screen',
      'Effective 2026-07-27 · Initial publication',
    ],
  ],
  [
    'reflection-workflow.yaml',
    [
      'reflection-thread-screen',
      'reflection-thread-action',
      'reflection-interview-screen',
      'reflection-guide-screen',
      'reflection-discussion-screen',
      'reflection-refinement-screen',
    ],
  ],
]);

// Platform-owned identifiers are reviewed one by one. Prefixes and wildcards
// are deliberately not accepted as substitutes for app-owned testIDs.
const allowedRuntimeSelectors = new Set([
  'android:id/alertTitle',
  'android:id/button1',
  'android:id/button2',
]);

const expectedExternalGaps = [
  'OAuth success and pending-registration callbacks require configured Google credentials, allowlisted callbacks, and a native device/browser round trip.',
  'Hosted Turnstile completion requires the hosted origin, provider keys, mail delivery, and a native device/browser bridge.',
  'SSE interruption/background recovery requires controlled network and app-lifecycle execution on a native device.',
  'Accessibility and device lifecycle require iOS/Android runs with Dynamic Type, reduced motion, VoiceOver/TalkBack, rotation, backgrounding, and relaunch.',
];

function walk(root, suffixes) {
  const files = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) files.push(...walk(path, suffixes));
    else if (suffixes.some((suffix) => entry.endsWith(suffix))) files.push(path);
  }
  return files;
}

function flowReference(currentPath, reference) {
  const fromRoot = join(flowRoot, reference);
  if (existsSync(fromRoot)) return fromRoot;
  return join(dirname(currentPath), reference);
}

const sourceTestIds = new Set();
for (const path of walk(sourceRoot, ['.ts', '.tsx'])) {
  if (path.includes('.test.') || path.includes('/__tests__/')) continue;
  const source = readFileSync(path, 'utf8');
  for (const match of source.matchAll(/\btestID\s*=\s*(['"])([^'"]+)\1/g)) {
    sourceTestIds.add(match[2]);
  }
  for (const match of source.matchAll(/\btestID\s*:\s*(['"])([^'"]+)\1/g)) {
    sourceTestIds.add(match[2]);
  }
}

const flowPaths = walk(flowRoot, ['.yaml']).sort();
const flowSources = new Map(flowPaths.map((path) => [path, readFileSync(path, 'utf8')]));
const failures = [];
const checkedSelectors = new Set();
const referencedSubflows = new Set();
const fail = (file, message) => failures.push(`${file}: ${message}`);

for (const [path, source] of flowSources) {
  const file = relative(flowRoot, path);
  const topLevel = !file.includes('/');
  const separator = source.indexOf('\n---\n');

  if (topLevel) {
    if (!requiredFlows.has(file)) {
      fail(file, 'top-level flow is not declared in the static coverage manifest');
    }
    if (!source.startsWith('appId: cloud.margins.mobile\n')) {
      fail(file, 'must target cloud.margins.mobile');
    }
    if (separator < 0) fail(file, 'must include a Maestro document separator');
    if (!source.includes('- assertVisible:')) {
      fail(file, 'must contain a visible-state assertion');
    }
    const commands = separator < 0 ? '' : source.slice(separator + '\n---\n'.length);
    const beginsCleared = /^- launchApp:\n    clearState: true(?:\n|$)/.test(commands);
    const beginsWithLogin = /^- runFlow: subflows\/login\.yaml(?:\n|$)/.test(commands);
    if (!beginsCleared && !beginsWithLogin) {
      fail(file, 'must begin from clearState or the audited clear-state login subflow');
    }
  } else if (source.includes('appId:') || source.includes('\n---\n')) {
    fail(file, 'shared subflows must contain commands only');
  }

  const markers = requiredFlows.get(file);
  if (markers) {
    for (const marker of markers) {
      if (!source.includes(marker)) {
        fail(file, `missing required journey marker ${JSON.stringify(marker)}`);
      }
    }
  }

  const aliases = new Set();
  const envBlock = source.match(/\nenv:\n([\s\S]*?)\n---\n/)?.[1];
  if (envBlock) {
    for (const line of envBlock.split('\n')) {
      const match = line.match(
        /^  ([A-Z][A-Z0-9_]*): (\$\{MARGINS_MAESTRO_[A-Z0-9_]+\})$/,
      );
      if (!match) {
        fail(file, `invalid or non-externalized environment entry ${JSON.stringify(line)}`);
        continue;
      }
      aliases.add(match[1]);
    }
  }

  for (const variable of source.matchAll(/\$\{([A-Z][A-Z0-9_]*)\}/g)) {
    if (
      topLevel &&
      !variable[1].startsWith('MARGINS_MAESTRO_') &&
      !aliases.has(variable[1])
    ) {
      fail(file, `references undeclared or non-MARGINS_MAESTRO-backed variable ${variable[1]}`);
    }
  }

  for (const input of source.matchAll(/^\s*-?\s*inputText:\s*(.+)$/gm)) {
    if (!/^\$\{[A-Z][A-Z0-9_]*\}$/.test(input[1].trim())) {
      fail(file, 'inputText values must come from MARGINS_MAESTRO-backed variables');
    }
  }

  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(source)) {
    fail(file, 'contains a literal email address');
  }
  if (/[?&](access_token|refresh_token|authorization_code|password|verifier)=/i.test(source)) {
    fail(file, 'places sensitive authentication material in a URL');
  }

  const selectorMatches = [
    ...source.matchAll(/^\s*id:\s*['"]?([^'"\s#]+)['"]?\s*$/gm),
  ];
  if (topLevel && selectorMatches.length === 0) {
    fail(file, 'must anchor the journey with at least one stable selector id');
  }
  for (const match of selectorMatches) {
    const selector = match[1];
    checkedSelectors.add(selector);
    if (!sourceTestIds.has(selector) && !allowedRuntimeSelectors.has(selector)) {
      fail(file, `selector id ${JSON.stringify(selector)} has no literal testID in mobile/src`);
    }
  }

  const runFlowDefinitions = [...source.matchAll(/^\s*-\s*runFlow:/gm)];
  const scalarRunFlows = [
    ...source.matchAll(/^\s*-\s*runFlow:\s*([^\s#]+)\s*$/gm),
  ];
  if (runFlowDefinitions.length !== scalarRunFlows.length) {
    fail(file, 'runFlow must use an auditable scalar file reference');
  }
  for (const runFlow of scalarRunFlows) {
    const reference = runFlow[1].replace(/^['"]|['"]$/g, '');
    if (!/^[A-Za-z0-9_./-]+\.ya?ml$/.test(reference) || reference.includes('..')) {
      fail(file, `has unsafe subflow reference ${JSON.stringify(reference)}`);
      continue;
    }
    const childPath = flowReference(path, reference);
    if (relative(flowRoot, childPath).startsWith('..')) {
      fail(file, `subflow reference escapes .maestro: ${reference}`);
      continue;
    }
    if (!existsSync(childPath)) {
      fail(file, `references missing subflow ${reference}`);
      continue;
    }
    referencedSubflows.add(childPath);
    const child = readFileSync(childPath, 'utf8');
    for (const childVariable of child.matchAll(/\$\{([A-Z][A-Z0-9_]*)\}/g)) {
      if (!childVariable[1].startsWith('MARGINS_MAESTRO_') && !aliases.has(childVariable[1])) {
        fail(file, `subflow ${reference} requires undeclared variable ${childVariable[1]}`);
      }
    }
  }
}

for (const [file] of requiredFlows) {
  if (!flowSources.has(join(flowRoot, file))) fail(file, 'required flow is missing');
}

const loginPath = join(flowRoot, 'subflows', 'login.yaml');
if (!flowSources.has(loginPath)) {
  fail('subflows/login.yaml', 'required shared login subflow is missing');
} else {
  const login = flowSources.get(loginPath);
  if (!login.startsWith('- launchApp:\n    clearState: true\n')) {
    fail('subflows/login.yaml', 'must begin by launching with clearState');
  }
  for (const marker of ['clearState: true', 'welcome-screen', 'login-screen', 'library-screen']) {
    if (!login.includes(marker)) {
      fail('subflows/login.yaml', `missing marker ${JSON.stringify(marker)}`);
    }
  }
}

for (const path of flowPaths.filter((candidate) => relative(flowRoot, candidate).includes('/'))) {
  if (!referencedSubflows.has(path)) {
    fail(relative(flowRoot, path), 'orphan subflow is not referenced by a top-level journey');
  }
}

if (failures.length) {
  console.error('FAIL: Maestro static definition audit found invalid coverage or unsafe fixtures.');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `PASS (static definition): ${requiredFlows.size} top-level journeys and ${flowPaths.length - requiredFlows.size} subflow(s) are linked; ${checkedSelectors.size} selector ids resolve to source testIDs or an exact platform allowlist.`,
);
console.log(
  'EVIDENCE LIMIT: this audit checks repository text only; it does not parse the Maestro YAML schema, execute a flow, launch an app, or provide device evidence.',
);
for (const gap of expectedExternalGaps) console.log(`EXTERNAL DEVICE/PROVIDER GAP: ${gap}`);
