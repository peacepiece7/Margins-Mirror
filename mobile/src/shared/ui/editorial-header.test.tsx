import { fireEvent, render } from '@testing-library/react-native';

import { EditorialHeader } from './editorial-header';

it('renders one accessible 44-point back action only when requested', async () => {
  const onBack = jest.fn();
  const screen = await render(
    <EditorialHeader backLabel="Back to library" onBack={onBack} page title="Memory Cards" />,
  );

  const back = screen.getByRole('button', { name: 'Back to library' });
  expect(back).toHaveStyle({ height: 44, width: 44 });
  await fireEvent.press(back);
  expect(onBack).toHaveBeenCalledTimes(1);

  await screen.rerender(<EditorialHeader page title="Memory Cards" />);
  expect(screen.queryByTestId('editorial-header-back')).toBeNull();
});
