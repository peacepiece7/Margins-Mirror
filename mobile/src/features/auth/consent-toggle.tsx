import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/ui';
import { colors, radius, spacing } from '@/shared/theme/tokens';

export function ConsentToggle({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange(value: boolean): void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <View style={[styles.box, checked && styles.checked]}>
        {checked ? <AppText style={styles.mark}>✓</AppText> : null}
      </View>
      <AppText style={styles.label}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: radius.small,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checked: { backgroundColor: colors.navy, borderColor: colors.navy },
  disabled: { opacity: 0.56 },
  label: { flex: 1 },
  mark: { color: colors.white, fontWeight: '700' },
  pressed: { opacity: 0.72 },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.x3,
    minHeight: 44,
  },
});
