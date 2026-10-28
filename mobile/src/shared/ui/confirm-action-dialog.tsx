import { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/shared/theme/tokens';

import { AppText } from './app-text';
import { Button } from './button';
import { Notice } from './notice';
import { Surface } from './surface';

export function ConfirmActionDialog({
  cancelLabel,
  confirmLabel,
  description,
  error,
  onCancel,
  onConfirm,
  open,
  title,
}: {
  cancelLabel: string;
  confirmLabel: string;
  description: string;
  error?: string;
  onCancel(): void;
  onConfirm(): Promise<void>;
  open: boolean;
  title: string;
}) {
  const [pending, setPending] = useState(false);

  async function confirm() {
    if (pending) return;
    setPending(true);
    try {
      await onConfirm();
    } catch {
      // The caller owns localized domain error copy and keeps this dialog open for retry.
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={() => {
        if (!pending) onCancel();
      }}
      transparent
      visible={open}
    >
      <View accessibilityViewIsModal style={styles.backdrop} testID="confirm-action-dialog">
        <Surface style={styles.dialog}>
          <AppText variant="heading">{title}</AppText>
          <AppText>{description}</AppText>
          {error ? <Notice title={error} tone="error" /> : null}
          <View style={styles.actions}>
            <Button disabled={pending} onPress={onCancel} variant="outline">
              {cancelLabel}
            </Button>
            <Button loading={pending} onPress={() => void confirm()} variant="destructive">
              {confirmLabel}
            </Button>
          </View>
        </Surface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.x2,
    justifyContent: 'flex-end',
  },
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(38, 34, 30, 0.42)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.x4,
  },
  dialog: {
    borderColor: colors.line,
    maxWidth: 520,
    width: '100%',
  },
});
