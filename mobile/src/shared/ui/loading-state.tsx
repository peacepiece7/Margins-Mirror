import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/shared/theme/tokens';

import { AppText } from './app-text';

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <View accessibilityLiveRegion="polite" accessibilityRole="progressbar" style={styles.container}>
      <ActivityIndicator color={colors.accent} size="large" />
      <AppText variant="label">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.canvas,
    flex: 1,
    gap: spacing.x3,
    justifyContent: 'center',
    padding: spacing.x6,
  },
});
