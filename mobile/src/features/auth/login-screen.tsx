import { Controller, useForm } from 'react-hook-form';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { useI18n } from '@/shared/i18n/i18n-provider';
import { AppText, Button, EditorialHeader, Notice, Screen, Surface, TextField } from '@/shared/ui';
import { colors, spacing } from '@/shared/theme/tokens';

import { authErrorMessage } from './error-message';
import { authCopy } from './copy';
import { useAuthSession } from './session-provider';
import type { LoginInput } from './types';

export function LoginScreen({ onGoogleRegistration, onOpenPrivacy, onOpenTerms, onRecovery, onSignUp }: {
  onGoogleRegistration(): void;
  onOpenPrivacy(): void;
  onOpenTerms(): void;
  onRecovery(): void;
  onSignUp(): void;
}) {
  const { locale, t } = useI18n();
  const { authAttemptActive, login, loginWithGoogle } = useAuthSession();
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    setError,
  } = useForm<LoginInput>({ defaultValues: { password: '', username: '' } });

  const submit = handleSubmit(async (values) => {
    try {
      await login(values);
    } catch (error) {
      setError('root', { message: authErrorMessage(error, locale, t) });
    }
  });

  const google = async () => {
    try {
      const pending = await loginWithGoogle();
      if (pending) onGoogleRegistration();
    } catch (error) {
      setError('root', { message: authErrorMessage(error, locale, t) });
    }
  };

  return (
    <Screen contentStyle={styles.screen} includeTopInset testID="login-screen" tone="dark">
      <StatusBar style="light" />
      <View style={styles.brandBar}>
        <AppText style={styles.brand} variant="eyebrow">{t('appName')}</AppText>
        <View style={styles.brandLine} />
      </View>
      <View style={styles.hero}>
        <EditorialHeader
          description={t('loginSubtitle')}
          inverse
          title={t('loginTitle')}
        />
      </View>
      <Surface style={styles.form} tone="dark">
        {errors.root?.message ? <Notice inverse title={errors.root.message} tone="error" /> : null}
        <Controller
          control={control}
          name="username"
          render={({ field: { onBlur, onChange, value } }) => (
            <TextField
              autoCapitalize="none"
              autoComplete="username"
              error={errors.username?.message}
              label={t('username')}
              onBlur={onBlur}
              onChangeText={onChange}
              returnKeyType="next"
              textContentType="username"
              tone="dark"
              value={value}
            />
          )}
          rules={{ required: t('usernameRequired') }}
        />
        <Controller
          control={control}
          name="password"
          render={({ field: { onBlur, onChange, value } }) => (
            <TextField
              autoCapitalize="none"
              autoComplete="current-password"
              error={errors.password?.message}
              label={t('password')}
              onBlur={onBlur}
              onChangeText={onChange}
              onSubmitEditing={() => void submit()}
              returnKeyType="go"
              secureTextEntry
              textContentType="password"
              tone="dark"
              value={value}
            />
          )}
          rules={{ required: t('passwordRequired') }}
        />
        <Button
          disabled={authAttemptActive}
          loading={isSubmitting}
          onPress={() => void submit()}
          variant="inverse"
        >
          {isSubmitting ? t('loggingIn') : t('login')}
        </Button>
        <Button
          accessibilityLabel={authCopy(locale, 'google')}
          disabled={authAttemptActive || isSubmitting}
          onPress={() => void google()}
          variant="inverse"
        >
          <AppText
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.googleMark}
          >
            G
          </AppText>
          {` ${authCopy(locale, 'google')}`}
        </Button>
        <Button onPress={onRecovery} variant="inverseGhost">{authCopy(locale, 'recover')}</Button>
      </Surface>
      <View style={styles.actions}>
        <AppText style={styles.mutedText} variant="caption">{t('noAccount')}</AppText>
        <Button onPress={onSignUp} variant="inverse">
          {t('signup')}
        </Button>
        <Button onPress={onOpenPrivacy} variant="inverseGhost">
          {t('privacy')}
        </Button>
        <Button onPress={onOpenTerms} variant="inverseGhost">
          {t('terms')}
        </Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignItems: 'center',
    gap: spacing.x2,
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
  form: {
    backgroundColor: colors.dark,
  },
  hero: {
    marginTop: 'auto',
    paddingTop: spacing.x8,
  },
  googleMark: {
    color: colors.darkText,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 20,
  },
  mutedText: {
    color: colors.darkMuted,
  },
  screen: {
    paddingBottom: spacing.x4,
  },
});
