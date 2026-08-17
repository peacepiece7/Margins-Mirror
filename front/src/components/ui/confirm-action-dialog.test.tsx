import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmActionDialog } from './confirm-action-dialog';

function renderDialog(onConfirm: () => Promise<unknown> | unknown) {
  const onOpenChange = vi.fn();
  render(
    <ConfirmActionDialog
      cancelLabel="Cancel"
      confirmLabel="Delete"
      description="Delete this item?"
      loadingLabel="Deleting"
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      open
      title="Delete"
    />,
  );
  return onOpenChange;
}

describe('ConfirmActionDialog', () => {
  it('cancels without running the action', () => {
    const onConfirm = vi.fn();
    const onOpenChange = renderDialog(onConfirm);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('prevents duplicate confirmation while loading', async () => {
    let resolveAction: (() => void) | undefined;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveAction = resolve;
        }),
    );
    const onOpenChange = renderDialog(onConfirm);
    const confirm = screen.getByRole('button', { name: 'Delete' });

    fireEvent.click(confirm);
    expect(screen.getByRole('button', { name: 'Deleting' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Deleting' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    resolveAction?.();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('stays open and becomes retryable after an action failure', async () => {
    const onOpenChange = renderDialog(() => Promise.reject(new Error('failed')));

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole('alertdialog')).toBeVisible();
  });

  it('keeps confirmation actions in the coarse-pointer touch-target contract', () => {
    renderDialog(vi.fn());

    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute(
      'data-slot',
      'alert-dialog-cancel',
    );
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveAttribute(
      'data-slot',
      'alert-dialog-action',
    );
  });
});
