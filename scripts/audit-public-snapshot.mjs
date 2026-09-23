import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
  .toString('utf8')
  .split('\0')
  .filter(Boolean);

const rootFiles = new Set([
  '.env.example',
  '.gitattributes',
  '.gitignore',
  'COPYRIGHT.md',
  'README.md',
  'package.json',
]);
const allowedRoots = new Set(['back', 'db', 'front', 'infra', 'mobile', 'scripts']);
const forbiddenNames = /(^|\/)(?:\.env(?!\.example$)[^/]*|\.zed|ops|runbooks?|tasks|tooling|local-secrets|node_modules|dist-test|test-results)(\/|$)/i;
const forbiddenExtensions = /\.(?:jks|key|mobileprovision|p12|p8|pem)$/i;
const secretSignatures = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['OpenAI key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{30,}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
];

const failures = [];
for (const file of files) {
  const root = file.split('/')[0];
  if (
    (!rootFiles.has(file) && !allowedRoots.has(root) && file !== '.github/workflows/ci.yml' &&
      file !== 'docs/architecture.md' && !file.startsWith('docs/images/')) ||
    forbiddenNames.test(file) ||
    forbiddenExtensions.test(file) ||
    /(?:^|\/)(?:google-services\.json|GoogleService-Info\.plist|id_rsa|service-account[^/]*)$/i.test(file) ||
    (file.startsWith('infra/') && file !== 'infra/docker/mysql-compose.yml') ||
    file.endsWith('/AGENTS.md') ||
    file.startsWith('front/scripts/verify-production-') ||
    file.startsWith('mobile/scripts/audit-bdd-trace') ||
    file === 'mobile/scripts/bdd-trace-manifest.mjs'
  ) {
    failures.push(`${file}: outside public snapshot allowlist`);
    continue;
  }

  const contents = readFileSync(file);
  if (contents.includes(0)) continue;
  const source = contents.toString('utf8');
  for (const [label, signature] of secretSignatures) {
    if (signature.test(source)) failures.push(`${file}: ${label} signature`);
  }
  for (const match of source.matchAll(/\b(?:https?|mongodb(?:\+srv)?):\/\/[^\s/:@]+:[^\s/@]+@[A-Za-z0-9.-]+/g)) {
    if (new URL(match[0]).hostname !== 'example.invalid') {
      failures.push(`${file}: credentialed URL signature`);
    }
  }
  if (/\b[A-Z0-9._%+-]+@(?:gmail|yahoo|outlook|hotmail)\.com\b/i.test(source)) {
    failures.push(`${file}: personal mailbox address`);
  }
}

if (failures.length) {
  console.error(`Public snapshot audit failed:\n${failures.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Public snapshot audit passed (${files.length} candidate files).`);
}
