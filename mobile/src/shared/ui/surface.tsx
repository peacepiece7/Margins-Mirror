import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radius, shadows, spacing } from '@/shared/theme/tokens';

type SurfaceProps = ComponentProps<typeof View> & {
  tone?: 'default' | 'dark';
  variant?: 'card' | 'section';
};

export function Surface({ style, tone = 'default', variant = 'card', ...props }: SurfaceProps) {
  return (
    <View
      style={[
        styles.surface,
        variant === 'section' && styles.section,
        tone === 'dark' && styles.dark,
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  surface: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: radius.medium,
    borderWidth: 1,
    gap: spacing.x3,
    minWidth: 0,
    padding: spacing.x4,
    ...shadows.paper,
  },
  dark: {
    backgroundColor: colors.darkSurface,
    borderColor: colors.darkLine,
  },
  section: {
    backgroundColor: colors.transparent,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 0,
    borderRadius: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    gap: spacing.x3,
    paddingHorizontal: spacing.x5,
    paddingVertical: spacing.x4 + spacing.x1,
    shadowOpacity: 0,
    elevation: 0,
  },
});
