import { rootRouteAccess } from './route-access';

describe('native account and privacy route access', () => {
  // BDD: PRIVACY-006, ACCOUNT-012
  // BDD: ACCOUNT-012
  it('restricts a recovered consent-pending user to consent/account surfaces', () => {
    expect(rootRouteAccess('consent-required')).toEqual({
      consent: true,
      protected: false,
      publicAuth: false,
    });
  });

  // BDD: ACCOUNT-013
  it('does not mount protected account routes for a signed-out user', () => {
    expect(rootRouteAccess('anonymous')).toEqual({
      consent: false,
      protected: false,
      publicAuth: true,
    });
  });
});
