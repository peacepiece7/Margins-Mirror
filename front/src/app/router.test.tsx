import { describe, expect, it } from 'vitest';

import { router } from './router';

describe('public routes', () => {
  it('keeps legal documents and contact outside the authenticated route tree', () => {
    for (const path of ['/contact', '/terms', '/terms/history']) {
      expect(router.routes.some((route) => route.path === path)).toBe(true);
    }
    const authenticatedRoot = router.routes.find((route) => route.path === '/');
    expect(
      authenticatedRoot?.children?.some((route) =>
        ['contact', 'terms', 'terms/history'].includes(route.path ?? ''),
      ),
    ).toBe(false);
  });
});
