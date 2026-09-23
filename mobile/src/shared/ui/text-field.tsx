import type { ComponentProps } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { colors, radius, spacing } from '@/shared/theme/tokens';

import { AppText } from './app-text';

type TextFieldProps = ComponentProps<typeof TextInput> & {
  error?: string;
  label: string;
  tone?: 'default' | 'dark';
};

export function TextField({
  accessibilityState,
  editable = true,
  error,
  label,
  style,
  tone = 'default',
  ...props
}: TextFieldProps) {
  const errorId = error ? `${props.nativeID ?? label}-error` : undefined;
  return (
    <View style={styles.group}>
      <AppText style={tone === 'dark' ? styles.darkLabel : undefined} variant="label">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        accessibilityState={{
          ...accessibilityState,
          disabled: editable === false || accessibilityState?.disabled,
        }}
        aria-describedby={errorId}
        aria-invalid={Boolean(error)}
        editable={editable}
        placeholderTextColor={tone === 'dark' ? colors.darkMuted : colors.muted}
        style={[styles.input, tone === 'dark' && styles.darkInput, error && styles.inputError, style]}
        {...props}
      />
      {error ? (
        <AppText accessibilityLiveRegion="polite" nativeID={errorId} style={styles.error} variant="caption">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  error: {
    color: colors.danger,
  },
  group: {
    gap: spacing.x2,
  },
  input: {
    backgroundColor: colors.transparent,
    borderColor: colors.line,
    borderRadius: radius.medium,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: spacing.x3,
    paddingVertical: spacing.x2,
  },
  inputError: {
    borderColor: colors.danger,
  },
  darkInput: {
    borderColor: colors.darkLine,
    color: colors.darkText,
  },
  darkLabel: {
    color: colors.darkMuted,
  },
});
