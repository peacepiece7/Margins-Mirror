import { router } from 'expo-router';

import { goBackOrReplace } from './go-back-or-replace';

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    canGoBack: jest.fn(),
    replace: jest.fn(),
  },
}));

const mockedRouter = router as jest.Mocked<typeof router>;

beforeEach(() => {
  jest.clearAllMocks();
});

it('uses native history when the protected stack can go back', () => {
  mockedRouter.canGoBack.mockReturnValue(true);

  goBackOrReplace('/library');

  expect(mockedRouter.back).toHaveBeenCalledTimes(1);
  expect(mockedRouter.replace).not.toHaveBeenCalled();
});

it('replaces a direct deep link with its safe protected fallback', () => {
  mockedRouter.canGoBack.mockReturnValue(false);

  goBackOrReplace('/library');

  expect(mockedRouter.back).not.toHaveBeenCalled();
  expect(mockedRouter.replace).toHaveBeenCalledWith('/library');
});
