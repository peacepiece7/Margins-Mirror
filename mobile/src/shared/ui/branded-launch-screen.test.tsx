import { render } from '@testing-library/react-native';

import { BrandedLaunchScreen } from './branded-launch-screen';

describe('BrandedLaunchScreen', () => {
  it('presents the Margins promise while session restoration is pending', async () => {
    const view = await render(
      <BrandedLaunchScreen
        appName="Margins"
        statusLabel="독서 공간을 복구하고 있어요…"
        tagline="오래 남는 생각을 위한 독서 공간."
      />,
    );

    expect(view.getByRole('header', { name: 'Margins' })).toBeTruthy();
    expect(view.getByText('오래 남는 생각을 위한 독서 공간.')).toBeTruthy();
    expect(view.getByRole('progressbar', { name: '독서 공간을 복구하고 있어요…' })).toBeTruthy();
    expect(view.getByTestId('branded-launch-artwork').props.accessible).toBe(false);
  });
});
