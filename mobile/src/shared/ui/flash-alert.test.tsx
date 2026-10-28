import { act, fireEvent, render } from '@testing-library/react-native';
import { useState } from 'react';
import { Text } from 'react-native';

import { Button } from './button';
import { FlashAlertProvider, useFlashAlert } from './flash-alert';

function RouteHarness() {
  const [route, setRoute] = useState('discover');
  const { showAlert } = useFlashAlert();
  return (
    <>
      <Text>{route}</Text>
      <Button
        onPress={() => showAlert({ message: 'The book was added.', tone: 'success' })}
      >
        Save
      </Button>
      <Button onPress={() => setRoute('library')}>Navigate</Button>
    </>
  );
}

// BDD: DS-013 then-1/then-2/then-3
it('keeps semantic dismissible mutation feedback mounted across route content changes', async () => {
  const view = await render(
    <FlashAlertProvider>
      <RouteHarness />
    </FlashAlertProvider>,
  );

  await fireEvent.press(view.getByRole('button', { name: 'Save' }));
  expect(view.getByText('The book was added.').parent?.props.accessibilityRole).toBe('alert');
  await fireEvent.press(view.getByRole('button', { name: 'Navigate' }));
  expect(view.getByText('library')).toBeTruthy();
  expect(view.getByText('The book was added.')).toBeTruthy();
  await fireEvent.press(view.getByLabelText('Dismiss notification'));
  expect(view.queryByTestId('flash-alert')).toBeNull();
});

it('dismisses transient feedback automatically without obscuring persistent navigation', async () => {
  jest.useFakeTimers();
  const view = await render(
    <FlashAlertProvider>
      <RouteHarness />
    </FlashAlertProvider>,
  );

  await fireEvent.press(view.getByRole('button', { name: 'Save' }));
  expect(view.getByTestId('flash-alert-overlay')).toHaveStyle({ bottom: 0 });
  await act(async () => jest.advanceTimersByTime(5_000));
  expect(view.queryByTestId('flash-alert')).toBeNull();
  jest.useRealTimers();
});

it('keeps error feedback visible until the reader dismisses it', async () => {
  jest.useFakeTimers();

  function ErrorHarness() {
    const { showAlert } = useFlashAlert();
    return <Button onPress={() => showAlert({ message: 'Try again.', tone: 'error' })}>Fail</Button>;
  }

  const view = await render(
    <FlashAlertProvider>
      <ErrorHarness />
    </FlashAlertProvider>,
  );
  await fireEvent.press(view.getByRole('button', { name: 'Fail' }));
  await act(async () => jest.advanceTimersByTime(10_000));
  expect(view.getByText('Try again.')).toBeTruthy();
  await fireEvent.press(view.getByLabelText('Dismiss notification'));
  expect(view.queryByTestId('flash-alert')).toBeNull();
  jest.useRealTimers();
});
