import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/shared/theme/tokens';
import { AppText } from '@/shared/ui';

const STAR_SIZE = 22;
const STAR_TARGET_SIZE = 44;
const starValues = [1, 2, 3, 4, 5] as const;
const ratingActions = [{ name: 'increment' }, { name: 'decrement' }] as const;

export function BookRatingInput({
  disabled = false,
  label,
  onChange,
  rating,
  clearLabel,
}: {
  clearLabel: string;
  disabled?: boolean;
  label: string;
  onChange(rating?: number): void;
  rating?: number | null;
}) {
  const currentRating = rating ?? 0;

  return (
    <View style={styles.row}>
      <View
        accessibilityActions={ratingActions}
        accessibilityLabel={label}
        accessibilityRole="adjustable"
        accessibilityState={{ disabled }}
        accessibilityValue={{ max: 5, min: 0, now: currentRating, text: `${currentRating} / 5` }}
        onAccessibilityAction={(event) => {
          if (disabled) return;
          if (event.nativeEvent.actionName === 'increment') {
            onChange(Math.min(5, currentRating + 0.5));
          }
          if (event.nativeEvent.actionName === 'decrement') {
            const nextRating = currentRating - 0.5;
            onChange(nextRating > 0 ? nextRating : undefined);
          }
        }}
        style={styles.stars}
        testID="book-rating-input"
      >
        {starValues.map((starValue) => {
          const fill = currentRating >= starValue
            ? 1
            : currentRating >= starValue - 0.5
              ? 0.5
              : 0;
          return (
            <Pressable
              accessibilityElementsHidden
              disabled={disabled}
              importantForAccessibility="no-hide-descendants"
              key={starValue}
              onPress={(event) =>
                onChange(
                  event.nativeEvent.locationX < STAR_TARGET_SIZE / 2
                    ? starValue - 0.5
                    : starValue,
                )
              }
              style={({ pressed }) => [styles.starTarget, pressed && styles.pressed]}
              testID={`rating-star-${starValue}`}
            >
              <View
                style={styles.star}
                testID={
                  fill === 1
                    ? 'rating-star-full'
                    : fill === 0.5
                      ? 'rating-star-half'
                      : 'rating-star-empty'
                }
              >
                <AppText accessibilityElementsHidden style={[styles.glyph, styles.empty]}>
                  ★
                </AppText>
                {fill > 0 ? (
                  <View
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={[styles.fillClip, { width: STAR_SIZE * fill }]}
                    testID={fill === 0.5 ? 'rating-star-half-fill' : undefined}
                  >
                    <AppText style={[styles.glyph, styles.filled]}>★</AppText>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        accessibilityLabel={clearLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || rating == null }}
        disabled={disabled || rating == null}
        onPress={() => onChange(undefined)}
        style={({ pressed }) => [
          styles.clear,
          pressed && styles.pressed,
          (disabled || rating == null) && styles.disabled,
        ]}
        testID="rating-clear"
      >
        <SymbolView
          fallback={<AppText style={styles.clearFallback}>×</AppText>}
          name={{ android: 'close', ios: 'xmark' }}
          size={15}
          tintColor={colors.muted}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  clear: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: radius.medium,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  clearFallback: {
    color: colors.muted,
    fontSize: 20,
    lineHeight: 22,
  },
  disabled: { backgroundColor: colors.surface, borderColor: colors.line },
  empty: { color: colors.line },
  fillClip: {
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
  },
  filled: { color: colors.brass },
  glyph: {
    fontSize: STAR_SIZE,
    lineHeight: STAR_SIZE,
    width: STAR_SIZE,
  },
  pressed: { opacity: 0.62 },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.x2,
  },
  star: { height: STAR_SIZE, position: 'relative', width: STAR_SIZE },
  stars: { flexDirection: 'row' },
  starTarget: {
    alignItems: 'center',
    height: STAR_TARGET_SIZE,
    justifyContent: 'center',
    width: STAR_TARGET_SIZE,
  },
});
