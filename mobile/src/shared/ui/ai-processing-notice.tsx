import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useI18n } from '@/shared/i18n/i18n-provider';
import { colors, spacing } from '@/shared/theme/tokens';

import { AppText } from './app-text';
import { Button } from './button';
import { dismissAiNoticeForSevenDays, isAiNoticeDismissed } from './dismissible-notice';
import { Notice } from './notice';

export function AiProcessingNotice({ onOpenPrivacy }: { onOpenPrivacy(): void }) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [doNotShowAgain, setDoNotShowAgain] = useState(false);

  useEffect(() => {
    let active = true;
    void isAiNoticeDismissed()
      .then((dismissed) => {
        if (active) setVisible(!dismissed);
      })
      .catch(() => {
        if (active) setVisible(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!visible) return null;

  async function close() {
    if (doNotShowAgain) {
      try {
        await dismissAiNoticeForSevenDays();
      } catch {
        // Local dismissal remains available when device storage is temporarily unavailable.
      }
    }
    setVisible(false);
  }

  return (
    <View style={styles.container} testID="ai-processing-notice">
      <Notice title={t('aiProcessingNotice')}>
        {t('aiProcessingDescription')}
      </Notice>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: doNotShowAgain }}
        onPress={() => setDoNotShowAgain((checked) => !checked)}
        style={styles.checkboxRow}
      >
        <View style={[styles.checkbox, doNotShowAgain && styles.checkboxSelected]} />
        <AppText>{t('doNotShowAgain')}</AppText>
      </Pressable>
      <View style={styles.actions}>
        <Button onPress={onOpenPrivacy} variant="ghost">
          {t('privacy')}
        </Button>
        <Button
          accessibilityLabel={t('closeAiProcessingNotice')}
          onPress={() => void close()}
          variant="ghost"
        >
          ×
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.x2,
    justifyContent: 'space-between',
  },
  checkbox: {
    borderColor: colors.navy,
    borderRadius: 4,
    borderWidth: 1,
    height: 20,
    width: 20,
  },
  checkboxRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.x2,
    minHeight: 44,
  },
  checkboxSelected: {
    backgroundColor: colors.navy,
    borderWidth: 5,
  },
  container: { gap: spacing.x2 },
});
