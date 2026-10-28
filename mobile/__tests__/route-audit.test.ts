import { spawnSync } from 'node:child_process';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const mobileRoot = join(__dirname, '..');
const unexpectedModuleName = `unexpected-helper-${process.pid}.test.ts`;
const unexpectedModule = join(mobileRoot, 'src', 'app', unexpectedModuleName);

it('rejects helper and test modules added to the Expo Router app directory', () => {
  try {
    writeFileSync(unexpectedModule, 'export const helper = true;\n');

    const result = spawnSync(process.execPath, ['scripts/audit-routes.mjs'], {
      cwd: mobileRoot,
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      `unexpected app module src/app/${unexpectedModuleName}`,
    );
  } finally {
    if (existsSync(unexpectedModule)) unlinkSync(unexpectedModule);
  }
});
