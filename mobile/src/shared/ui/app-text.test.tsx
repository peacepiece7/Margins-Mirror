import { render } from '@testing-library/react-native';

import { AppText } from './app-text';

describe('AppText', () => {
  it.each(['display', 'title', 'heading'] as const)('exposes the %s variant as a semantic heading', async (variant) => {
    const view = await render(<AppText variant={variant}>Reading room</AppText>);

    expect(view.getByRole('header', { name: 'Reading room' })).toBeTruthy();
  });

  it('preserves an explicit accessibility role on a heading variant', async () => {
    const view = await render(
      <AppText accessibilityRole="alert" variant="title">
        Session failed
      </AppText>,
    );

    expect(view.getByRole('alert', { name: 'Session failed' })).toBeTruthy();
    expect(view.queryByRole('header')).toBeNull();
  });
});
