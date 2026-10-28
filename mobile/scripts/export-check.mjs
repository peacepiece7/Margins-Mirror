import { spawnSync } from 'node:child_process';
import path from 'node:path';

const expo = process.platform === 'win32'
  ? path.resolve('node_modules/.bin/expo.cmd')
  : path.resolve('node_modules/.bin/expo');

for (const platform of ['android', 'ios']) {
  const result = spawnSync(
    expo,
    ['export', '--platform', platform, '--output-dir', `dist-test/${platform}`],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('PASS: Android and iOS production JavaScript bundles exported.');
