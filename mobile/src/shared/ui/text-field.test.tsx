import { render } from '@testing-library/react-native';

import { TextField } from './text-field';

describe('TextField', () => {
  it('is editable and announced as enabled by default', async () => {
    const view = await render(<TextField label="Title" />);
    const input = view.getByLabelText('Title');

    expect(input.props.editable).toBe(true);
    expect(input.props.accessibilityState).toEqual({ disabled: undefined });
  });

  it('preserves caller accessibility state when disabled', async () => {
    const view = await render(
      <TextField accessibilityState={{ busy: true }} editable={false} label="Title" />,
    );

    expect(view.getByLabelText('Title').props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });
  });
});
