import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const canaries = JSON.parse(
  await readFile(path.join(root, 'security/artifact-canaries.json'), 'utf8'),
);
const artifactPatterns = [
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'private key'],
  [/sk-(?:proj-)?[A-Za-z0-9_-]{32,}/, 'OpenAI API key'],
  [/ghp_[A-Za-z0-9]{36}/, 'GitHub access token'],
  [/github_pat_[A-Za-z0-9_]{50,}/, 'GitHub fine-grained token'],
  [/AIza[0-9A-Za-z_-]{30,}/, 'Google API key'],
  [/Bearer\s+[A-Za-z0-9._~-]{20,}/, 'literal bearer token'],
];
const nativeConfigurationFiles = [
  'app.json',
  'eas.json',
  'ios/Margins/Info.plist',
  'ios/Margins/Margins.entitlements',
  'ios/Margins/Supporting/Expo.plist',
  'ios/Margins.xcodeproj/project.pbxproj',
];

async function filesUnder(relativePath) {
  const absolute = path.join(root, relativePath);
  let entries;
  try {
    entries = await readdir(absolute, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const child = path.join(relativePath, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(child)));
    else files.push(child);
  }
  return files;
}

async function auditArtifact(file) {
  try {
    const contents = await readFile(path.join(root, file));
    const text = contents.toString('utf8');
    for (const [label, canary] of Object.entries(canaries)) {
      if (text.includes(canary)) failures.push(`${file}: contains ${label} canary`);
    }
    for (const [pattern, label] of artifactPatterns) {
      if (pattern.test(text)) failures.push(`${file}: contains ${label}`);
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

for (const file of await filesUnder('dist-test')) {
  await auditArtifact(file);
}
for (const file of nativeConfigurationFiles) {
  await auditArtifact(file);
}

const configuredApiOrigin = process.env.EXPO_PUBLIC_API_BASE_URL;
if (configuredApiOrigin) {
  try {
    const url = new URL(configuredApiOrigin);
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.username ||
      url.password ||
      (url.pathname !== '' && url.pathname !== '/') ||
      url.search ||
      url.hash
    ) {
      failures.push('EXPO_PUBLIC_API_BASE_URL must contain only a public HTTP(S) origin');
    }
  } catch {
    failures.push('EXPO_PUBLIC_API_BASE_URL is not a valid public origin');
  }
}

const sourceFiles = (await filesUnder('src')).filter((file) => /\.[cm]?[jt]sx?$/.test(file));
const publicEnvNames = new Set();
const allowedPublicEnvNames = new Set([
  'EXPO_PUBLIC_API_BASE_URL',
  'EXPO_PUBLIC_EMAIL_VERIFICATION_REDIRECT_URI',
  'EXPO_PUBLIC_OAUTH_REDIRECT_URI',
]);
for (const file of sourceFiles) {
  const contents = await readFile(path.join(root, file), 'utf8');
  for (const match of contents.matchAll(/process\.env\.(EXPO_PUBLIC_[A-Z0-9_]+)/g)) {
    publicEnvNames.add(match[1]);
  }
  if (/console\.(?:debug|info|log|warn)\([^\n]*(?:accessToken|refreshToken|password|email)/i.test(contents)) {
    failures.push(`${file}: logs authentication or personal data`);
  }
  if (
    /console\.(?:debug|error|info|log|warn)\([\s\S]{0,240}(?:reflection|prompt|sse|payload)/i.test(
      contents,
    )
  ) {
    failures.push(`${file}: logs private reading or AI payload data`);
  }
  if (
    /searchParams\.set\(\s*['"](?:accessToken|email|nativeProof|password|prompt|refreshToken|reflection|ssePayload|turnstileToken|verificationCode)['"]/i.test(
      contents,
    )
  ) {
    failures.push(`${file}: places private data in a URL`);
  }
}

for (const name of publicEnvNames) {
  if (!allowedPublicEnvNames.has(name)) {
    failures.push(`unsupported public environment value: ${name}`);
  }
}

if (failures.length) {
  console.error(`FAIL: mobile artifact secret audit\n${failures.join('\n')}`);
  process.exit(1);
}

console.log(
  'PASS: mobile public configuration, generated native configuration, deep links, source logging, and export artifacts contain no secret signatures or representative private-data canaries.',
);
