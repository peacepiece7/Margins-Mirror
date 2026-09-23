import { fireEvent, render } from '@testing-library/react-native';

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
});
