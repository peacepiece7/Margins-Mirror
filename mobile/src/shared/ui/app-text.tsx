import type { ComponentProps } from 'react';
import { StyleSheet, Text } from 'react-native';

import { typography } from '@/shared/theme/tokens';

type TextVariant = keyof typeof typography;

type AppTextProps = ComponentProps<typeof Text> & {
  variant?: TextVariant;
};

export function AppText({ style, variant = 'body', ...props }: AppTextProps) {
  const accessibilityRole = props.accessibilityRole ?? (isHeadingVariant(variant) ? 'header' : undefined);

  return (
    <Text
      allowFontScaling
      maxFontSizeMultiplier={2}
      style={[styles.base, typography[variant], style]}
      {...props}
      accessibilityRole={accessibilityRole}
    />
  );
}

function isHeadingVariant(variant: TextVariant) {
  return variant === 'display' || variant === 'title' || variant === 'heading';
}

const styles = StyleSheet.create({
  base: {
    flexShrink: 1,
  },
});
