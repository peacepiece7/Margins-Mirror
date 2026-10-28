import { fireEvent, render } from '@testing-library/react-native';

import { colors } from '@/shared/theme/tokens';

import { ConsentToggle } from './consent-toggle';

describe('ConsentToggle', () => {
  it('exposes checkbox name and checked state and changes explicitly', async () => {
    const onChange = jest.fn();
    const screen = await render(
      <ConsentToggle checked={false} label="I agree to the Privacy Policy" onChange={onChange} />,
    );

    const checkbox = screen.getByRole('checkbox', { name: 'I agree to the Privacy Policy' });
    expect(checkbox.props.accessibilityState).toEqual({ checked: false, disabled: undefined });
    expect(checkbox).toHaveStyle({ minHeight: 44 });
    fireEvent.press(checkbox);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('keeps disabled copy readable without whole-row opacity', async () => {
    const onChange = jest.fn();
    const screen = await render(
      <ConsentToggle
        checked={false}
        disabled
        label="I agree to the Privacy Policy"
        onChange={onChange}
      />,
    );

    const checkbox = screen.getByRole('checkbox', { name: 'I agree to the Privacy Policy' });
    expect(checkbox).toHaveStyle({ backgroundColor: colors.surface });
    expect(screen.getByText('I agree to the Privacy Policy')).toHaveStyle({ color: colors.muted });
    fireEvent.press(checkbox);
    expect(onChange).not.toHaveBeenCalled();
  });
});
