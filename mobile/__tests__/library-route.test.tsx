import { act, render } from '@testing-library/react-native';

import LibraryRoute from '@/app/(protected)/(tabs)/library';

const mockPush = jest.fn();
const mockSetParams = jest.fn();
const mockLibraryScreen = jest.fn();
let mockParams: Record<string, string | undefined> = {};

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    setParams: (...args: unknown[]) => mockSetParams(...args),
  },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/shared/i18n/i18n-provider', () => ({
  useI18n: () => {
    const { messages } = jest.requireActual<typeof import('@/shared/i18n/messages')>('@/shared/i18n/messages');
    return { t: (key: keyof typeof messages.en) => messages.en[key] };
  },
}));
jest.mock('@/features/books/library-screen', () => ({
  LibraryScreen: (props: unknown) => {
    mockLibraryScreen(props);
    return null;
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
});

// BDD: MOBILE-009
it.each([
  ['debate', 'Choose a book to debate.', '/books/7?intent=debate'],
  ['study', 'Choose a book to study.', '/memory-cards?bookId=7'],
])('routes the %s action through an explicit Library book selection', async (action, prompt, destination) => {
  mockParams = { action };
  await render(<LibraryRoute />);
  const props = mockLibraryScreen.mock.calls[0][0] as {
    onOpenBook(book: { bookId: number }): void;
    selectionPrompt?: string;
  };

  expect(props.selectionPrompt).toBe(prompt);
  await act(async () => props.onOpenBook({ bookId: 7 }));
  expect(mockPush).toHaveBeenCalledWith(destination);
});

it('keeps ordinary shelf selection on Book Detail', async () => {
  await render(<LibraryRoute />);
  const props = mockLibraryScreen.mock.calls[0][0] as {
    onOpenBook(book: { bookId: number }): void;
    selectionPrompt?: string;
  };

  await act(async () => props.onOpenBook({ bookId: 7 }));
  expect(props.selectionPrompt).toBeUndefined();
  expect(mockPush).toHaveBeenCalledWith('/books/7');
});
