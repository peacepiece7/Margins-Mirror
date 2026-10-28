import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { colors, spacing } from '@/shared/theme/tokens';

import { AppText } from './app-text';

const readerArtwork = require('../../../assets/images/splash-icon.png');

export function BrandedLaunchScreen({
  appName,
  statusLabel,
  tagline,
}: {
  appName: string;
  statusLabel: string;
  tagline: string;
}) {
  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.container} testID="branded-launch-screen">
      <StatusBar style="light" />
      <Image
        accessible={false}
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={readerArtwork}
        style={styles.artwork}
        testID="branded-launch-artwork"
      />
      <View pointerEvents="none" style={styles.content}>
        <View style={styles.brand}>
          <AppText accessibilityRole="header" style={styles.wordmark}>
            {appName}
          </AppText>
          <View style={styles.rule} />
          <AppText style={styles.tagline}>{tagline}</AppText>
        </View>
        <View
          accessible
          accessibilityLabel={statusLabel}
          accessibilityLiveRegion="polite"
          accessibilityRole="progressbar"
          style={styles.status}
        >
          <ActivityIndicator color={colors.launchText} size="small" />
          <AppText style={styles.statusLabel} variant="caption">
            {statusLabel}
          </AppText>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  artwork: {
    bottom: -spacing.x8,
    height: '84%',
    opacity: 0.68,
    position: 'absolute',
    right: -spacing.x8,
    width: '92%',
  },
  brand: {
    alignItems: 'flex-start',
    gap: spacing.x3,
    maxWidth: 300,
  },
  container: {
    backgroundColor: colors.launchBackground,
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.x6,
    paddingVertical: spacing.x8,
  },
  rule: {
    backgroundColor: colors.brass,
    height: 2,
    width: spacing.x8,
  },
  status: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(3, 3, 3, 0.72)',
    flexDirection: 'row',
    gap: spacing.x3,
    minHeight: 44,
    paddingHorizontal: spacing.x3,
  },
  statusLabel: {
    color: colors.launchText,
  },
  tagline: {
    color: colors.launchText,
    fontFamily: 'Georgia',
    fontSize: 24,
    lineHeight: 31,
    maxWidth: 260,
  },
  wordmark: {
    color: colors.launchText,
    fontFamily: 'Georgia',
    fontSize: 46,
    fontWeight: '600',
    letterSpacing: 0.7,
    lineHeight: 54,
  },
});
