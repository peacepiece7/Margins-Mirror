import { describe, expect, it } from 'vitest';

import { router } from './router';

describe('public routes', () => {
  it('keeps contact outside the authenticated route tree', () => {
    expect(router.routes.some((route) => route.path === '/contact')).toBe(true);
    const authenticatedRoot = router.routes.find((route) => route.path === '/');
    expect(authenticatedRoot?.children?.some((route) => route.path === 'contact')).toBe(false);
  });
});
