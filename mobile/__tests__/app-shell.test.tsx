import { render } from '@testing-library/react-native';

import { RootStack } from '@/app/_layout';

let mockSessionStatus = 'anonymous';

jest.mock('@/features/auth/session-provider', () => ({
  AuthSessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuthSession: () => ({ status: mockSessionStatus }),
}));

jest.mock('@/shared/i18n/i18n-provider', () => ({
  I18nProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('expo-router', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  const Stack = ({ children }: { children: React.ReactNode }) => <View>{children}</View>;
  Stack.Protected = ({ children, guard }: { children: React.ReactNode; guard: boolean }) =>
    guard ? <View>{children}</View> : null;
  Stack.Screen = ({ name }: { name: string }) => <Text>{name}</Text>;
  return { Stack };
});

// BDD: TERM-021
describe('native app route guards', () => {
  it.each([
    ['anonymous', '(public)'],
    ['restore-error', '(public)'],
    ['consent-required', 'consent'],
    ['authenticated', '(protected)'],
  ])('mounts only the %s route tree', async (status, expectedRoute) => {
    mockSessionStatus = status;
    const view = await render(<RootStack />);

    expect(view.getByText(expectedRoute)).toBeTruthy();
    expect(view.getByText('privacy')).toBeTruthy();
    expect(view.getByText('privacy-history')).toBeTruthy();
    expect(view.getByText('terms')).toBeTruthy();
    expect(view.getByText('terms-history')).toBeTruthy();
    expect(view.queryByText('consent-account')).toBe(
      status === 'consent-required' ? view.getByText('consent-account') : null,
    );
    for (const route of ['(public)', 'consent', '(protected)']) {
      if (route !== expectedRoute) expect(view.queryByText(route)).toBeNull();
    }
    view.unmount();
  });
});
