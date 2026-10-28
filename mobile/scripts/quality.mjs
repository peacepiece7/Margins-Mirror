import { spawnSync } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const commands = [
  ['run', 'typecheck'],
  ['run', 'lint'],
  ['test'],
  ['run', 'audit:routes'],
  ['run', 'audit:maestro'],
  ['run', 'doctor'],
  ['run', 'export:check'],
  ['run', 'audit:secrets'],
];

for (const args of commands) {
  const result = spawnSync(npm, args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('PASS: mobile non-device quality gate completed.');
