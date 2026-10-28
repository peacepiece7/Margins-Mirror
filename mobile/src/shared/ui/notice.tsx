import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/shared/theme/tokens';

import { AppText } from './app-text';

type NoticeTone = 'info' | 'success' | 'error';

export function Notice({
  children,
  inverse = false,
  title,
  tone = 'info',
}: {
  children?: ReactNode;
  inverse?: boolean;
  title: string;
  tone?: NoticeTone;
}) {
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      accessible
      style={[styles.base, toneStyles[tone]]}
    >
      <AppText style={inverse ? styles.inverseText : undefined} variant="label">{title}</AppText>
      {children ? <AppText style={inverse ? styles.inverseText : undefined} variant="caption">{children}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderLeftWidth: 2,
    borderRadius: radius.small,
    gap: spacing.x1,
    padding: spacing.x3,
  },
  inverseText: {
    color: colors.darkText,
  },
});

const toneStyles = StyleSheet.create({
  error: { backgroundColor: colors.transparent, borderColor: colors.danger },
  info: { backgroundColor: colors.transparent, borderColor: colors.accent },
  success: { backgroundColor: colors.transparent, borderColor: colors.success },
});
