import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { useI18n } from '@/shared/i18n/i18n-provider';
import { colors, spacing } from '@/shared/theme/tokens';
import { AppText, Button, EditorialHeader, Screen, Surface } from '@/shared/ui';

export function WelcomeScreen({
  onLogin,
  onOpenPrivacy,
  onOpenTerms,
  onSignUp,
}: {
  onLogin(): void;
  onOpenPrivacy(): void;
  onOpenTerms(): void;
  onSignUp(): void;
}) {
  const { t } = useI18n();
  const introductionSteps = [
    t('welcomeStepDiscover'),
    t('welcomeStepQuestions'),
    t('welcomeStepReflections'),
    t('welcomeStepDebate'),
  ];
  return (
    <Screen contentStyle={styles.screen} includeTopInset testID="welcome-screen" tone="dark">
      <StatusBar style="light" />
      <View style={styles.brandBar}>
        <AppText style={styles.brand} variant="eyebrow">{t('appName')}</AppText>
        <View style={styles.brandLine} />
      </View>
      <View style={styles.hero}>
        <EditorialHeader
          description={t('welcomeSubtitle')}
          fitTitle
          inverse
          title={t('welcomeTitle')}
        />
      </View>
      <Surface style={styles.darkSurface} tone="dark">
        <View accessibilityRole="list" style={styles.steps} testID="product-introduction-steps">
          {introductionSteps.map((step, index) => (
            <View
              accessibilityLabel={`${index + 1}. ${step}`}
              accessible
              key={step}
              style={styles.step}
              testID={`product-introduction-step-${index + 1}`}
            >
              <AppText style={styles.stepNumber} variant="eyebrow">0{index + 1}</AppText>
              <AppText style={styles.inverseText}>{step}</AppText>
            </View>
          ))}
        </View>
      </Surface>
      <Surface style={styles.darkSurface} testID="memory-card-introduction" tone="dark">
        <AppText style={styles.sectionLabel} variant="eyebrow">{t('memoryCards')}</AppText>
        <AppText style={styles.inverseText}>{t('memoryCardIntroduction')}</AppText>
      </Surface>
      <Surface style={styles.actions} tone="dark">
        <Button onPress={onSignUp} variant="inverse">
          {t('welcomeStart')}
        </Button>
        <Button onPress={onLogin} variant="inverse">
          {t('welcomeLogin')}
        </Button>
        <Button onPress={onOpenPrivacy} variant="inverseGhost">
          {t('privacy')}
        </Button>
        <Button onPress={onOpenTerms} variant="inverseGhost">
          {t('terms')}
        </Button>
      </Surface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    backgroundColor: colors.dark,
  },
  brand: {
    color: colors.darkText,
  },
  brandBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.x3,
  },
  brandLine: {
    backgroundColor: colors.darkLine,
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  darkSurface: {
    backgroundColor: colors.dark,
  },
  hero: {
    marginTop: 'auto',
    paddingTop: spacing.x8,
  },
  inverseText: {
    color: colors.darkText,
    flex: 1,
  },
  screen: {
    paddingBottom: spacing.x4,
  },
  sectionLabel: {
    color: colors.accent,
  },
  step: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.x3,
  },
  steps: {
    gap: spacing.x3,
  },
  stepNumber: {
    color: colors.accent,
    width: 28,
  },
});
