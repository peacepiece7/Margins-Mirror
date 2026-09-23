import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useReducedMotion } from '@/shared/accessibility/use-reduced-motion';
import { colors, radius, spacing } from '@/shared/theme/tokens';

import { AppText } from './app-text';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'inverse' | 'inverseGhost';

type ButtonProps = Omit<ComponentProps<typeof Pressable>, 'children'> & {
  children: ReactNode;
  loading?: boolean;
  variant?: ButtonVariant;
};

export function Button({
  accessibilityLabel,
  accessibilityState,
  children,
  disabled,
  loading = false,
  style,
  variant = 'secondary',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const reducedMotion = useReducedMotion();
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{
        ...accessibilityState,
        busy: loading || accessibilityState?.busy,
        disabled: isDisabled || accessibilityState?.disabled,
      }}
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        variantStyles[variant].container,
        state.pressed && !isDisabled && !reducedMotion && styles.pressed,
        isDisabled && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...props}
    >
      <View style={styles.content}>
        {loading ? <ActivityIndicator color={variantStyles[variant].text.color} size="small" /> : null}
        <AppText style={[styles.label, variantStyles[variant].text]}>{children}</AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.medium,
    borderWidth: 1,
    paddingHorizontal: spacing.x4,
    paddingVertical: spacing.x2,
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.x2,
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.56,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    lineHeight: 18,
    textAlign: 'center',
  },
  pressed: {
    transform: [{ translateY: 1 }],
  },
});

const variantStyles = {
  primary: StyleSheet.create({
    container: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
    text: { color: colors.accentDeep },
  }),
  secondary: StyleSheet.create({
    container: { backgroundColor: colors.transparent, borderColor: colors.line },
    text: { color: colors.ink },
  }),
  outline: StyleSheet.create({
    container: { backgroundColor: colors.transparent, borderColor: colors.accent },
    text: { color: colors.accentDeep },
  }),
  destructive: StyleSheet.create({
    container: { backgroundColor: colors.transparent, borderColor: colors.danger },
    text: { color: colors.danger },
  }),
  ghost: StyleSheet.create({
    container: { backgroundColor: colors.transparent, borderColor: colors.transparent },
    text: { color: colors.link },
  }),
  inverse: StyleSheet.create({
    container: { backgroundColor: colors.transparent, borderColor: colors.accent },
    text: { color: colors.darkText },
  }),
  inverseGhost: StyleSheet.create({
    container: { backgroundColor: colors.transparent, borderColor: colors.transparent },
    text: { color: colors.accent },
  }),
} satisfies Record<ButtonVariant, { container: object; text: object }>;
