import { createHash } from 'node:crypto';

export function visualEnvironment(front, lock) {
  const packages = JSON.parse(lock).packages;
  const version = packages['node_modules/playwright'].version;
  if (
    !/^\d+\.\d+\.\d+$/.test(version) ||
    packages['node_modules/@playwright/test'].version !== version
  )
    throw new Error('Playwright versions must match and be stable releases');
  const hash = (data) => createHash('sha256').update(data).digest('hex');
  return {
    image: 'mcr.microsoft.com/playwright:v' + version + '-noble',
    volume: 'margins-storybook-' + hash(front).slice(0, 12),
    lockHash: hash(lock),
  };
}

export function assertPrepared(receipt, expected, imageId) {
  if (
    receipt.lockHash !== expected.lockHash ||
    receipt.image !== expected.image ||
    receipt.imageId !== imageId ||
    receipt.volume !== expected.volume
  )
    throw new Error('Visual environment changed. Run the explicit setup command again.');
}
