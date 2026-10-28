import { describe, expect, it } from 'vitest';

import defaultConfig from '../../playwright.config';
import contrastConfig from '../../playwright.contrast.config';

// Contrast scans are an explicitly requested audit, not part of verify:local.
describe('Playwright audit discovery boundary', () => {
  it('excludes opt-in suites from the default E2E configuration', () => {
    expect(defaultConfig.testIgnore).toEqual(
      expect.arrayContaining(['auth-registration-mock.spec.ts', 'contrast-audit.spec.ts']),
    );
  });

  it('keeps contrast scans discoverable through the dedicated configuration', () => {
    expect(contrastConfig.testMatch).toBe('contrast-audit.spec.ts');
    expect(contrastConfig.use?.contextOptions?.reducedMotion).toBe('reduce');
    expect(contrastConfig.testIgnore ?? []).not.toContain('contrast-audit.spec.ts');
    expect(contrastConfig.projects?.map((project) => project.name)).toEqual([
      'compact-320',
      'desktop-1440',
    ]);
  });
});
