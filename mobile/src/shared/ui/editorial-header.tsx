import { Pressable, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/shared/theme/tokens';

import { AppText } from './app-text';

export function EditorialHeader({
  backLabel,
  description,
  eyebrow,
  fitTitle = false,
  inverse = false,
  onBack,
  page = false,
  title,
}: {
  backLabel?: string;
  description?: string;
  eyebrow?: string;
  fitTitle?: boolean;
  inverse?: boolean;
  onBack?(): void;
  page?: boolean;
  title: string;
}) {
  return (
    <View style={[styles.container, page && styles.page, inverse && styles.containerInverse]}>
      <View style={styles.headerRow}>
        {onBack ? (
          <Pressable
            accessibilityLabel={backLabel}
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [
              styles.backAction,
              pressed && styles.backActionPressed,
            ]}
            testID="editorial-header-back"
          >
            <AppText
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.backGlyph, inverse && styles.titleInverse]}
            >
              ‹
            </AppText>
          </Pressable>
        ) : null}
        <View style={styles.copy}>
          {eyebrow ? (
            <AppText style={inverse ? styles.eyebrowInverse : undefined} variant="eyebrow">
              {eyebrow}
            </AppText>
          ) : null}
          <AppText
            adjustsFontSizeToFit={fitTitle}
            minimumFontScale={fitTitle ? 0.5 : undefined}
            numberOfLines={fitTitle ? 2 : undefined}
            style={inverse ? styles.titleInverse : undefined}
            variant="title"
          >
            {title}
          </AppText>
          {description ? (
            <AppText style={inverse ? styles.descriptionInverse : styles.description}>
              {description}
            </AppText>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backAction: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    marginLeft: -8,
    width: 44,
  },
  backActionPressed: {
    opacity: 0.55,
  },
  backGlyph: {
    color: colors.ink,
    fontSize: 32,
    lineHeight: 34,
  },
  container: {
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.x2,
    paddingBottom: spacing.x4,
  },
  containerInverse: {
    borderBottomColor: colors.darkLine,
  },
  copy: {
    flex: 1,
    gap: spacing.x2,
    minWidth: 0,
  },
  description: {
    color: colors.muted,
  },
  descriptionInverse: {
    color: colors.darkMuted,
  },
  eyebrowInverse: {
    color: colors.accent,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.x2,
  },
  titleInverse: {
    color: colors.darkText,
  },
  page: {
    paddingHorizontal: spacing.x5,
    paddingVertical: spacing.x4 + spacing.x1,
  },
});
