import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ConfirmActionDialog } from './confirm-action-dialog';

function renderDialog(overrides: Partial<Parameters<typeof ConfirmActionDialog>[0]> = {}) {
  return render(
    <ConfirmActionDialog
      cancelLabel="Cancel"
      confirmLabel="Remove"
      description="Remove this item?"
      onCancel={jest.fn()}
      onConfirm={jest.fn(() => Promise.resolve())}
      open
      title="Remove item"
      {...overrides}
    />,
  );
}

// BDD: DS-004 then-1
it('cancels an accessible destructive confirmation without running the mutation', async () => {
  const onCancel = jest.fn();
  const onConfirm = jest.fn(() => Promise.resolve());
  const view = await renderDialog({ onCancel, onConfirm });

  await fireEvent.press(view.getByRole('button', { name: 'Cancel' }));
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(onConfirm).not.toHaveBeenCalled();
});

// BDD: DS-004 then-2
it('runs one pending confirmation and disables duplicate actions', async () => {
  let resolve!: () => void;
  const pending = new Promise<void>((done) => {
    resolve = done;
  });
  const onConfirm = jest.fn(() => pending);
  const view = await renderDialog({ onConfirm });

  await fireEvent.press(view.getByRole('button', { name: 'Remove' }));
  expect(view.getByRole('button', { name: 'Remove' }).props.accessibilityState).toMatchObject({
    busy: true,
    disabled: true,
  });
  await fireEvent.press(view.getByRole('button', { name: 'Remove' }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
  resolve();
  await waitFor(() => {
    expect(view.getByRole('button', { name: 'Remove' }).props.accessibilityState.busy).not.toBe(true);
  });
});
