import { fireEvent, render } from '@testing-library/react-native';

import { useReducedMotion } from '@/shared/accessibility/use-reduced-motion';

import { Button } from './button';

jest.mock('@/shared/accessibility/use-reduced-motion', () => ({
  useReducedMotion: jest.fn(),
}));

describe('Button', () => {
  beforeEach(() => jest.mocked(useReducedMotion).mockReturnValue(false));

  // BDD: PROJ-035
  // BDD: RLOOP-020
  // BDD: RLOOP-042
  it('exposes a named button with a 44 point minimum target', async () => {
    const view = await render(<Button onPress={jest.fn()}>Open book</Button>);
    expect(view.getByRole('button', { name: 'Open book' })).toHaveStyle({
      minHeight: 44,
      minWidth: 44,
    });
  });

  it('preserves semantic selection while exposing busy and disabled state', async () => {
    const view = await render(
      <Button accessibilityState={{ selected: true }} loading onPress={jest.fn()}>
        Reading
      </Button>,
    );

    expect(view.getByRole('button').props.accessibilityState).toEqual({
      busy: true,
      disabled: true,
      selected: true,
    });
  });

  it('removes nonessential pressed translation when reduced motion is enabled', async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    const screen = await render(<Button onPress={jest.fn()}>Continue</Button>);
    const button = screen.getByRole('button', { name: 'Continue' });

    await fireEvent(button, 'pressIn');

    expect(button).not.toHaveStyle({ transform: [{ translateY: 1 }] });
  });
});
