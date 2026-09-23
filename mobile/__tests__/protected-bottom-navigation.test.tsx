import { fireEvent, render } from '@testing-library/react-native';

import {
  ProtectedBottomNavigation,
  globalNavigationDestination,
} from '@/shared/navigation/protected-bottom-navigation';
import { ProtectedUtilityNavigation } from '@/shared/navigation/protected-utility-navigation';

const mockNavigate = jest.fn();
let mockPathname = '/library';
let mockAction: string | undefined;

jest.mock('expo-router', () => ({
  router: {
    navigate: (...args: unknown[]) => mockNavigate(...args),
  },
  useGlobalSearchParams: () => ({ action: mockAction }),
  usePathname: () => mockPathname,
}));
jest.mock('expo-symbols', () => ({
  SymbolView: ({ fallback }: { fallback?: React.ReactNode }) => fallback ?? null,
}));
jest.mock('@/shared/i18n/i18n-provider', () => ({
  useI18n: () => {
    const { messages } = jest.requireActual<typeof import('@/shared/i18n/messages')>('@/shared/i18n/messages');
    return {
      locale: 'en',
      t: (key: keyof typeof messages.en) => messages.en[key],
    };
  },
}));

beforeEach(() => {
  mockPathname = '/library';
  mockAction = undefined;
  mockNavigate.mockClear();
});

it('shows only the shelf count and search action in the protected GNB', async () => {
  const view = await render(<ProtectedUtilityNavigation bookCount={12} />);

  expect(view.getByText('My shelf · 12 books')).toBeTruthy();
  expect(view.getByRole('button', { name: 'Library' })).toBeTruthy();
  expect(view.getByRole('button', { name: 'Search books' })).toBeTruthy();
  expect(view.queryByText('Margins')).toBeNull();
  expect(view.queryByRole('button', { name: 'Open menu' })).toBeNull();

  await fireEvent.press(view.getByRole('button', { name: 'Search books' }));
  expect(mockNavigate).toHaveBeenCalledWith('/discover');
});

it('lets the Discover screen own the fixed top search row', async () => {
  mockPathname = '/discover';
  const view = await render(<ProtectedUtilityNavigation bookCount={12} />);
  expect(view.queryByTestId('protected-utility-navigation')).toBeNull();
});

// BDD: BOOK-005, MOBILE-009
it('renders five destinations, opens reading threads for Reflection, and selects books for Debate and Study', async () => {
  const view = await render(<ProtectedBottomNavigation />);

  for (const label of ['Library', 'Reflection', 'Debate', 'Study', 'Me']) {
    expect(view.getByRole('tab', { name: label })).toBeTruthy();
    expect(view.getByText(label)).toBeTruthy();
  }
  expect(view.getByRole('tab', { name: 'Library' }).props.accessibilityState.selected).toBe(true);

  await fireEvent.press(view.getByRole('tab', { name: 'Reflection' }));
  expect(mockNavigate).toHaveBeenCalledWith('/reflection');
  await fireEvent.press(view.getByRole('tab', { name: 'Debate' }));
  expect(mockNavigate).toHaveBeenCalledWith('/library?action=debate');
  await fireEvent.press(view.getByRole('tab', { name: 'Study' }));
  expect(mockNavigate).toHaveBeenCalledWith('/library?action=study');
});

it('marks the active workflow from the protected route tree', async () => {
  expect(globalNavigationDestination('/books/4')).toBe('library');
  expect(globalNavigationDestination('/reflection')).toBe('reflection');
  expect(globalNavigationDestination('/books/4/reflection/guide/9')).toBe('reflection');
  expect(globalNavigationDestination('/books/4/reflection/discuss/7')).toBe('debate');
  expect(globalNavigationDestination('/books/4/debates/2')).toBe('debate');
  expect(globalNavigationDestination('/memory-cards/3/study')).toBe('study');
  expect(globalNavigationDestination('/account')).toBe('account');

  mockPathname = '/books/4/reflection/interview';
  const view = await render(<ProtectedBottomNavigation />);
  expect(view.getByRole('tab', { name: 'Reflection' }).props.accessibilityState.selected).toBe(true);
});

it('keeps the chosen workflow selected while the reader is choosing a book', async () => {
  mockAction = 'debate';
  const view = await render(<ProtectedBottomNavigation />);

  expect(view.getByRole('tab', { name: 'Debate' }).props.accessibilityState.selected).toBe(true);
});
