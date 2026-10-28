import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visualEnvironment, assertPrepared } from './storybook-environment.mjs';

const lock = JSON.stringify({
  packages: {
    'node_modules/playwright': { version: '1.60.0' },
    'node_modules/@playwright/test': { version: '1.60.0' },
  },
});
test('matches the lockfile and gives each checkout its own dependency volume', () => {
  const environment = visualEnvironment('/checkout/a/front', lock);
  assert.equal(environment.image, 'mcr.microsoft.com/playwright:v1.60.0-noble');
  assert.notEqual(environment.volume, visualEnvironment('/checkout/b/front', lock).volume);
  assert.equal(visualEnvironment('/checkout/a/front', lock).lockHash, environment.lockHash);
  assertPrepared({ ...environment, imageId: 'sha256:pinned' }, environment, 'sha256:pinned');
});
test('rejects version mismatch, prerelease and changed environment without installing', () => {
  assert.throws(
    () => visualEnvironment('/front', lock.replace('"1.60.0"', '"1.59.0"')),
    /must match/,
  );
  assert.throws(
    () => visualEnvironment('/front', lock.replaceAll('1.60.0', '1.60.0-beta')),
    /stable/,
  );
  const environment = visualEnvironment('/front', lock);
  for (const field of ['image', 'volume', 'lockHash', 'imageId'])
    assert.throws(
      () =>
        assertPrepared(
          { ...environment, imageId: 'sha256:pinned', [field]: 'changed' },
          environment,
          'sha256:pinned',
        ),
      /changed/,
    );
});
