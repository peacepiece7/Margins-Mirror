import { StyleSheet, View } from 'react-native';

import { colors } from '@/shared/theme/tokens';
import { AppText } from '@/shared/ui';

const STAR_SIZE = 22;

export function BookRatingDisplay({ rating }: { rating: number }) {
  const boundedRating = Math.max(0, Math.min(5, rating));

  return (
    <View
      accessibilityLabel={`${boundedRating} / 5`}
      accessibilityRole="image"
      style={styles.row}
      testID="book-rating-display"
    >
      {[0, 1, 2, 3, 4].map((index) => {
        const fill = Math.max(0, Math.min(1, boundedRating - index));
        return (
          <View
            key={index}
            style={styles.star}
            testID={fill === 1 ? 'rating-star-full' : fill === 0.5 ? 'rating-star-half' : 'rating-star-empty'}
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
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
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
  row: { flexDirection: 'row' },
  star: { height: STAR_SIZE, position: 'relative', width: STAR_SIZE },
});
