import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { visualEnvironment, assertPrepared } from './storybook-environment.mjs';

const front = await realpath(resolve(import.meta.dirname, '..'));
const artifacts = resolve(front, '../.artifacts/storybook');
const lock = await readFile(resolve(front, 'package-lock.json'));
const environment = visualEnvironment(front, lock);
const { image, volume, lockHash } = environment;
const mode = process.argv[2];
if (!['setup', 'check', 'test', 'update'].includes(mode))
  throw new Error('Use setup, check, test or update');

function run(args, capture = false) {
  return new Promise((resolveRun, reject) => {
    const child = spawn('docker', args, {
      stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    });
    let output = '';
    if (capture)
      child.stdout.on('data', (data) => {
        output += data;
      });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolveRun(output.trim()) : reject(new Error('Docker exited ' + code)),
    );
  });
}
if (mode !== 'check') await mkdir(artifacts, { recursive: true });
const mounts = [
  '--mount',
  'type=bind,source=' + front + ',target=/workspace/front,readonly',
  '--mount',
  'type=volume,source=' + volume + ',target=/workspace/front/node_modules',
  '--mount',
  'type=bind,source=' + artifacts + ',target=/artifacts',
];
const base = [
  'run',
  '--rm',
  '--platform',
  'linux/amd64',
  '--ipc=host',
  ...mounts,
  '--workdir',
  '/workspace/front',
  '-e',
  'CI=1',
  '-e',
  'TZ=UTC',
  '-e',
  'LANG=C.UTF-8',
  '-e',
  'PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1',
  '-e',
  'STORYBOOK_RESULTS_DIR=/artifacts/results',
  '-e',
  'STORYBOOK_REPORT_DIR=/artifacts/report',
];
const receiptPath = resolve(artifacts, 'prepared.json');
if (mode === 'setup') {
  await run(['pull', '--platform', 'linux/amd64', image]);
  await run(['volume', 'create', volume]);
  await run([...base, image, 'npm', 'ci', '--include=dev', '--no-audit', '--no-fund']);
  const imageId = await run(['image', 'inspect', '--format', '{{.Id}}', image], true);
  await writeFile(receiptPath, JSON.stringify({ image, imageId, volume, lockHash }, null, 2));
  console.log('Prepared pinned Linux/amd64 visual environment. Baselines were not updated.');
} else {
  let receipt;
  try {
    receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
  } catch {
    throw new Error(
      'Run npm run test:storybook:visual:setup first; verification does not install dependencies.',
    );
  }
  const imageId = await run(['image', 'inspect', '--format', '{{.Id}}', image], true);
  assertPrepared(receipt, environment, imageId);
  await run(['volume', 'inspect', volume], true);
  if (mode === 'check') {
    console.log('PASS: pinned Storybook visual environment is prepared.');
  } else {
    await readFile(resolve(front, 'storybook-static/index.json'));
    await readFile(resolve(front, 'storybook-static/iframe.html'));
    // Bind the current build directly rather than a replaced directory under the source mount.
    const staticMount = [
      '--mount',
      'type=bind,source=' +
        resolve(front, 'storybook-static') +
        ',target=/workspace/front/storybook-static,readonly',
    ];
    await run([
      ...base,
      '--network=none',
      ...staticMount,
      image,
      'node',
      '-e',
      "const fs = require('node:fs'); for (const file of ['storybook-static/index.json', 'storybook-static/iframe.html']) fs.accessSync(file);",
    ]);
    const updateMount =
      mode === 'update'
        ? [
            '--mount',
            'type=bind,source=' +
              resolve(front, 'tests/storybook/__screenshots__') +
              ',target=/workspace/front/tests/storybook/__screenshots__',
          ]
        : [];
    await run([
      ...base,
      '--network=none',
      ...staticMount,
      ...updateMount,
      image,
      'node',
      'node_modules/@playwright/test/cli.js',
      'test',
      '--config',
      '.storybook/playwright.config.ts',
      ...(mode === 'update' ? ['--update-snapshots=all'] : []),
    ]);
    console.log('PASS: pinned Linux/amd64 Storybook visuals and migrated gallery behavior');
  }
}
