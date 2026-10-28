import { FlatList, Image, StyleSheet, View } from 'react-native';

import { useI18n } from '@/shared/i18n/i18n-provider';
import type { Locale } from '@/shared/i18n/messages';
import { colors, radius, spacing } from '@/shared/theme/tokens';
import { AppText, Button, LoadingState, Notice, Screen } from '@/shared/ui';

import { reflectionCopy } from './copy';
import { useReflectionThreads } from './queries';
import {
  resolveMobileReflectionThreadTarget,
  type MobileReflectionThreadStage,
} from './thread-state';
import type {
  MobileReflectionThread,
  MobileReflectionThreadTarget,
} from './types';

export function ReflectionThreadScreen({
  creatingBookId,
  creationError,
  onOpenLibrary,
  onOpenThread,
}: {
  creatingBookId?: number;
  creationError?: boolean;
  onOpenLibrary(): void;
  onOpenThread(
    thread: MobileReflectionThread,
    target: MobileReflectionThreadTarget,
  ): void;
}) {
  const { locale } = useI18n();
  const c = reflectionCopy(locale);
  const threads = useReflectionThreads();

  if (threads.isLoading) return <LoadingState label={c.readingThreads} />;

  return (
    <Screen layout="edge" scroll={false} testID="reflection-thread-screen">
      <View style={styles.header}>
        <AppText accessibilityRole="header" variant="title">{c.readingThreads}</AppText>
        <AppText style={styles.description}>{c.readingThreadsDescription}</AppText>
      </View>
      {creationError ? (
        <View style={styles.notice}>
          <Notice title={c.sessionCreationError} tone="error" />
        </View>
      ) : null}
      {threads.isError ? (
        <View style={styles.notice}>
          <Notice title={c.error} tone="error" />
          <Button onPress={() => void threads.refetch()} variant="ghost">{c.retry}</Button>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={threads.data?.threads ?? []}
          keyExtractor={(thread) => String(thread.bookId)}
          ListEmptyComponent={
            <View style={styles.notice}>
              <Notice title={c.emptyReadingThreads} />
              <AppText variant="caption">{c.emptyReadingThreadsDescription}</AppText>
              <Button onPress={onOpenLibrary} variant="ghost">{c.openShelf}</Button>
            </View>
          }
          onRefresh={() => void threads.refetch()}
          refreshing={threads.isRefetching}
          renderItem={({ item }) => {
            const target = resolveMobileReflectionThreadTarget(item);
            return (
              <ReflectionThreadRow
                loading={creatingBookId === item.bookId}
                disabled={creatingBookId !== undefined && creatingBookId !== item.bookId}
                locale={locale}
                onPress={() => onOpenThread(item, target)}
                stage={target.kind}
                thread={item}
              />
            );
          }}
        />
      )}
    </Screen>
  );
}

function ReflectionThreadRow({
  disabled,
  loading,
  locale,
  onPress,
  stage,
  thread,
}: {
  disabled: boolean;
  loading: boolean;
  locale: Locale;
  onPress(): void;
  stage: MobileReflectionThreadStage;
  thread: MobileReflectionThread;
}) {
  const c = reflectionCopy(locale);
  const progress = stage === 'interview'
    ? `${c.threadStage.interview} · ${locale === 'ko' ? '답변' : 'answers'} ${thread.answeredCount ?? 0}/${thread.targetAnswers ?? 5}`
    : c.threadStage[stage];
  const preview = stage === 'interview'
    ? thread.currentQuestion
    : thread.reflectionPreview;

  return (
    <View style={styles.row} testID={`reflection-thread-${thread.bookId}`}>
      {thread.coverImageUrl ? (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={locale === 'ko' ? `${thread.bookTitle} 표지` : `${thread.bookTitle} cover`}
          source={{ uri: thread.coverImageUrl }}
          style={styles.cover}
        />
      ) : (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.coverFallback}>
          <AppText variant="heading">{thread.bookTitle.slice(0, 1).toUpperCase()}</AppText>
        </View>
      )}
      <View style={styles.threadCopy}>
        <View style={styles.bookHeading}>
          <View style={styles.bookIdentity}>
            <AppText numberOfLines={2} variant="heading">{thread.bookTitle}</AppText>
            {thread.bookAuthor ? <AppText numberOfLines={1} variant="caption">{thread.bookAuthor}</AppText> : null}
          </View>
          <AppText style={styles.activity} variant="caption">
            {formatThreadActivity(thread.lastActivityAt, locale)}
          </AppText>
        </View>
        <AppText style={styles.stage} variant="eyebrow">{progress}</AppText>
        {preview ? <AppText numberOfLines={2}>{preview}</AppText> : null}
        <Button
          accessibilityLabel={`${thread.bookTitle}, ${c.threadAction[stage]}`}
          disabled={disabled}
          loading={loading}
          onPress={onPress}
          style={styles.action}
          testID="reflection-thread-action"
          variant="outline"
        >
          {c.threadAction[stage]}
        </Button>
      </View>
    </View>
  );
}

export function formatThreadActivity(
  value: string,
  locale: Locale,
  now = Date.now(),
) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (minutes < 1) return locale === 'ko' ? '방금' : 'now';
  if (minutes < 60) return locale === 'ko' ? `${minutes}분 전` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return locale === 'ko' ? `${hours}시간 전` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return locale === 'ko' ? `${days}일 전` : `${days}d ago`;
}

const styles = StyleSheet.create({
  action: {
    alignSelf: 'flex-start',
    marginTop: spacing.x1,
  },
  activity: {
    flexShrink: 0,
    paddingTop: 3,
  },
  bookHeading: {
    flexDirection: 'row',
    gap: spacing.x2,
    justifyContent: 'space-between',
  },
  bookIdentity: {
    flex: 1,
    gap: spacing.x1,
    minWidth: 0,
  },
  cover: {
    backgroundColor: colors.line,
    borderRadius: radius.small,
    height: 102,
    width: 70,
  },
  coverFallback: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.small,
    height: 102,
    justifyContent: 'center',
    width: 70,
  },
  description: {
    color: colors.muted,
    maxWidth: 520,
  },
  header: {
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.x2,
    paddingHorizontal: spacing.x5,
    paddingVertical: spacing.x6,
  },
  list: {
    flexGrow: 1,
    paddingBottom: spacing.x8,
  },
  notice: {
    gap: spacing.x2,
    padding: spacing.x5,
  },
  row: {
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.x4,
    paddingHorizontal: spacing.x5,
    paddingVertical: spacing.x5,
  },
  stage: {
    marginTop: spacing.x1,
  },
  threadCopy: {
    flex: 1,
    gap: spacing.x2,
    minWidth: 0,
  },
});
