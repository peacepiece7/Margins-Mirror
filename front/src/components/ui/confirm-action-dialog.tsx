import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';

export interface ConfirmActionDialogProps {
  cancelLabel: string;
  confirmLabel: string;
  description: string;
  loadingLabel?: string;
  onConfirm: () => Promise<unknown> | unknown;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}

export function ConfirmActionDialog({
  cancelLabel,
  confirmLabel,
  description,
  loadingLabel,
  onConfirm,
  onOpenChange,
  open,
  title,
}: ConfirmActionDialogProps) {
  const [loading, setLoading] = useState(false);

  async function confirm() {
    setLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // The caller owns the domain error state. Keep the dialog open so the action can be retried.
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!loading) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={(event) => {
              event.preventDefault();
              void confirm();
            }}
            variant="destructive"
          >
            {loading ? loadingLabel || confirmLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
