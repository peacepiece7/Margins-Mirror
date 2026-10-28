import { afterEach, describe, expect, it, vi } from 'vitest';

describe('developer debug feature flag', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('is disabled by default and accepts only the exact true build value', async () => {
    vi.stubEnv('VITE_MARGINS_DEVELOPER_DEBUG_ENABLED', 'false');
    expect((await import('./feature-flags')).developerDebugEnabled).toBe(false);

    vi.resetModules();
    vi.stubEnv('VITE_MARGINS_DEVELOPER_DEBUG_ENABLED', 'true');
    expect((await import('./feature-flags')).developerDebugEnabled).toBe(true);
  });
});
