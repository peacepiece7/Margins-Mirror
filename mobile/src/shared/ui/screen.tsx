import type { ReactNode, Ref } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/shared/theme/tokens';

type ScreenProps = {
  children: ReactNode;
  layout?: 'edge' | 'inset';
  scroll?: boolean;
  scrollViewRef?: Ref<ScrollView>;
  testID?: string;
  tone?: 'default' | 'dark';
  contentStyle?: StyleProp<ViewStyle>;
  includeTopInset?: boolean;
};

export function Screen({
  children,
  contentStyle: customContentStyle,
  includeTopInset = false,
  layout = 'inset',
  scroll = true,
  scrollViewRef,
  testID,
  tone = 'default',
}: ScreenProps) {
  const { width } = useWindowDimensions();
  const dark = tone === 'dark';
  const contentStyle = [
    styles.content,
    layout === 'edge' && styles.contentEdge,
    dark && styles.contentDark,
    layout === 'inset' && { paddingHorizontal: screenHorizontalPadding(width) },
    customContentStyle,
  ];
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={contentStyle}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      ref={scrollViewRef}
      testID={testID}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[contentStyle, styles.fixed]} testID={testID}>
      {children}
    </View>
  );

  return (
    <SafeAreaView
      edges={includeTopInset ? ['top', 'left', 'right', 'bottom'] : ['left', 'right', 'bottom']}
      style={[styles.safeArea, dark && styles.safeAreaDark]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        {content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function screenHorizontalPadding(width: number) {
  if (width >= 1024) return spacing.x6;
  if (width >= 480) return spacing.x4 + spacing.x1;
  return spacing.x4;
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    gap: spacing.x5,
    paddingVertical: spacing.x5,
  },
  contentDark: {
    backgroundColor: colors.dark,
  },
  contentEdge: {
    gap: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  keyboard: {
    flex: 1,
  },
  fixed: {
    flex: 1,
  },
  safeArea: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  safeAreaDark: {
    backgroundColor: colors.dark,
  },
});
