import { render } from '@testing-library/react-native';

import ProtectedLayout from '@/app/(protected)/_layout';

const mockStackScreens = new Map<string, { headerShown?: boolean; title?: string }>();

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const Stack = ({ children }: { children: React.ReactNode }) => React.createElement(View, null, children);
  function StackScreen({ name, options }: { name: string; options: { headerShown?: boolean; title?: string } }) {
    mockStackScreens.set(name, options);
    return null;
  }
  Stack.Screen = StackScreen;
  return { Stack };
});
jest.mock('@/features/books/queries', () => ({
  useBooksQuery: () => ({ data: { books: [] } }),
}));
jest.mock('@/shared/accessibility/use-reduced-motion', () => ({
  useReducedMotion: () => true,
}));
jest.mock('@/shared/i18n/i18n-provider', () => ({
  useI18n: () => ({ locale: 'en' }),
}));
jest.mock('@/shared/navigation/protected-bottom-navigation', () => ({
  ProtectedBottomNavigation: () => null,
}));
jest.mock('@/shared/navigation/protected-utility-navigation', () => ({
  ProtectedUtilityNavigation: () => null,
}));
jest.mock('@/shared/ui', () => ({
  FlashAlertProvider: ({ children }: { children: React.ReactNode }) => children,
}));

it('hides native headers where the protected screen supplies its own back action', async () => {
  mockStackScreens.clear();
  await render(<ProtectedLayout />);

  const screenOwnedHeaders = [
    'books/[bookId]/session',
    'books/[bookId]/reflection/index',
    'books/[bookId]/reflection/interview',
    'books/[bookId]/reflection/guide/[guideId]',
    'books/[bookId]/reflection/discuss/[runId]',
    'books/[bookId]/reflection/refine/[runId]',
    'books/[bookId]/debates/index',
    'books/[bookId]/debates/[windowId]',
    'memory-cards/index',
    'memory-cards/[groupId]',
    'memory-cards/[groupId]/study',
  ];

  for (const route of screenOwnedHeaders) {
    expect(mockStackScreens.get(route)?.headerShown).toBe(false);
  }
});

it('retains the native header for detail screens without an editorial header', async () => {
  mockStackScreens.clear();
  await render(<ProtectedLayout />);

  expect(mockStackScreens.get('books/[bookId]')).toEqual({ title: 'Book' });
  expect(mockStackScreens.get('reviews/[insightId]')).toEqual({ title: 'Review' });
});
