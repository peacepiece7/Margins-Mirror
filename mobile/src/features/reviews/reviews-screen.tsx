import { useState } from "react";
import { Alert, FlatList, StyleSheet, View } from "react-native";

import { useI18n } from "@/shared/i18n/i18n-provider";
import { colors, spacing } from "@/shared/theme/tokens";
import {
  AppText,
  Button,
  EditorialHeader,
  LoadingState,
  Notice,
  Screen,
  Surface,
  TextField,
} from "@/shared/ui";

import { reviewsCopy } from "./copy";
import { MarkdownText } from "./markdown-text";
import {
  usePublicReviewsQuery,
  useReviewCommentMutations,
  useReviewCommentsQuery,
} from "./queries";
import type { PublicReview, ReviewComment } from "./types";

export function ReviewsScreen({
  onOpenReview,
}: {
  onOpenReview?(insightId: number): void;
}) {
  const { locale } = useI18n();
  const c = reviewsCopy(locale);
  const reviews = usePublicReviewsQuery();
  const [openInsightId, setOpenInsightId] = useState<number>();
  const data = reviews.data?.reviews ?? [];

  return (
    <Screen layout="edge" scroll={false} testID="reviews-screen">
      <FlatList
        contentContainerStyle={styles.list}
        data={data}
        keyExtractor={(review) => String(review.insightId)}
        ListEmptyComponent={
          reviews.isPending ? (
            <LoadingState label={c.title} />
          ) : reviews.isError ? (
            <Notice title={c.loadError}>
              <Button onPress={() => void reviews.refetch()}>{c.retry}</Button>
            </Notice>
          ) : (
            <Notice title={c.empty} />
          )
        }
        ListHeaderComponent={
          <View>
            <EditorialHeader description={c.subtitle} page title={c.title} />
            <Surface testID="public-review-privacy-note" variant="section">
              <AppText style={styles.privacyNote}>{c.privacyNote}</AppText>
            </Surface>
            {reviews.isError && data.length > 0 ? (
              <Notice title={c.loadError}>
                <Button onPress={() => void reviews.refetch()}>{c.retry}</Button>
              </Notice>
            ) : null}
          </View>
        }
        renderItem={({ item: review }) => (
          <ReviewCard
            expanded={openInsightId === review.insightId}
            onOpen={onOpenReview ? () => onOpenReview(review.insightId) : undefined}
            onToggle={() =>
              setOpenInsightId((current) =>
                current === review.insightId ? undefined : review.insightId,
              )
            }
            review={review}
          />
        )}
      />
    </Screen>
  );
}

function ReviewCard({
  expanded,
  onOpen,
  onToggle,
  review,
}: {
  expanded: boolean;
  onOpen?(): void;
  onToggle?(): void;
  review: PublicReview;
}) {
  const { locale } = useI18n();
  const c = reviewsCopy(locale);
  const reviewDate = review.reviewedOn ?? review.createdAt;
  return (
    <Surface
      accessibilityLabel={`${review.bookTitle}: ${review.title ?? review.sessionTitle}`}
      variant="section"
    >
      <AppText accessibilityRole="header" variant="heading">
        {review.title || review.sessionTitle}
      </AppText>
      <AppText variant="caption">
        {review.bookTitle}
        {review.bookAuthor ? ` · ${review.bookAuthor}` : ""}
      </AppText>
      <MarkdownText content={review.content} />
      {review.evidence ? (
        <AppText variant="caption">
          {c.evidence}: {review.evidence}
        </AppText>
      ) : null}
      <View style={styles.reviewMeta}>
        <AppText variant="caption">
          {c.by} {review.authorName || c.anonymous}
          {reviewDate ? ` · ${reviewDate.slice(0, 10)}` : ""}
        </AppText>
      </View>
      {onOpen ? (
        <Button onPress={onOpen} testID="public-review-open" variant="primary">
          {c.open}
        </Button>
      ) : null}
      {onToggle ? (
        <Button
          accessibilityState={{ expanded }}
          onPress={onToggle}
          variant="outline"
        >
          {expanded ? c.cancel : c.comments}
        </Button>
      ) : null}
      {expanded ? <CommentThread insightId={review.insightId} /> : null}
    </Surface>
  );
}

export function ReviewDetailScreen({
  insightId,
  onBack,
}: {
  insightId: number;
  onBack(): void;
}) {
  const { locale } = useI18n();
  const c = reviewsCopy(locale);
  const reviews = usePublicReviewsQuery();
  if (reviews.isPending) {
    return (
      <Screen>
        <LoadingState label={c.title} />
      </Screen>
    );
  }
  if (reviews.isError) {
    return (
      <Screen>
        <Notice title={c.loadError} tone="error">
          <Button onPress={() => void reviews.refetch()}>{c.retry}</Button>
        </Notice>
      </Screen>
    );
  }
  const review = reviews.data?.reviews.find((item) => item.insightId === insightId);
  if (!review) {
    return (
      <Screen testID="review-not-found">
        <Notice title={c.notFound} />
        <Button onPress={onBack} variant="outline">
          {c.back}
        </Button>
      </Screen>
    );
  }
  return (
    <Screen layout="edge" testID="review-detail-screen">
      <Surface testID="public-review-detail-privacy-note" variant="section">
        <AppText style={styles.privacyNote}>{c.privacyNote}</AppText>
      </Surface>
      <ReviewCard expanded review={review} />
      <Button onPress={onBack} variant="ghost">
        {c.back}
      </Button>
    </Screen>
  );
}

function CommentThread({ insightId }: { insightId: number }) {
  const { locale } = useI18n();
  const c = reviewsCopy(locale);
  const query = useReviewCommentsQuery(insightId, true);
  const mutations = useReviewCommentMutations(insightId);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<number>();
  const [editId, setEditId] = useState<number>();
  const [editDraft, setEditDraft] = useState("");
  const mutationError =
    mutations.create.isError ||
    mutations.update.isError ||
    mutations.remove.isError;
  const mutationPending =
    mutations.create.isPending ||
    mutations.update.isPending ||
    mutations.remove.isPending;

  const submit = () => {
    const content = draft.trim();
    if (!content) return;
    mutations.create.mutate(
      { content, parentCommentId: replyTo },
      {
        onSuccess: () => {
          setDraft("");
          setReplyTo(undefined);
        },
      },
    );
  };

  return (
    <View style={styles.thread}>
      {query.isPending ? <LoadingState label={c.comments} /> : null}
      {query.isError ? (
        <Notice title={c.loadError}>
          <Button onPress={() => void query.refetch()}>{c.retry}</Button>
        </Notice>
      ) : null}
      <View testID="bdd-front-132-comment-thread">
        {query.data?.comments.map((comment) => (
          <CommentRow
            actionsDisabled={mutationPending}
            comment={comment}
            editing={editId === comment.commentId}
            editDraft={editDraft}
            key={comment.commentId}
            onCancelEdit={() => setEditId(undefined)}
            onChangeEdit={setEditDraft}
            onDelete={() =>
              Alert.alert(c.remove, c.confirmDelete, [
                { text: c.cancel, style: "cancel" },
                {
                  text: c.remove,
                  style: "destructive",
                  onPress: () => mutations.remove.mutate(comment.commentId),
                },
              ])
            }
            onEdit={() => {
              setEditId(comment.commentId);
              setEditDraft(comment.content);
            }}
            onReply={() => {
              setReplyTo(comment.commentId);
              setDraft("");
            }}
            onSave={() => {
              if (!editDraft.trim()) return;
              mutations.update.mutate(
                { commentId: comment.commentId, content: editDraft.trim() },
                { onSuccess: () => setEditId(undefined) },
              );
            }}
            removing={
              mutations.remove.isPending && mutations.remove.variables === comment.commentId
            }
            saving={
              mutations.update.isPending
              && mutations.update.variables?.commentId === comment.commentId
            }
          />
        ))}
      </View>
      {mutationError ? <Notice title={c.mutationError} tone="error" /> : null}
      {replyTo ? (
        <AppText variant="caption">
          {c.reply} #{replyTo}
        </AppText>
      ) : null}
      <TextField
        editable={!mutations.create.isPending}
        label={c.commentPlaceholder}
        multiline
        onChangeText={setDraft}
        value={draft}
        testID={replyTo ? "bdd-front-133-reply-composer" : "bdd-front-132-comment-composer"}
      />
      <View style={styles.actions}>
        {replyTo ? (
          <Button
            disabled={mutations.create.isPending}
            onPress={() => setReplyTo(undefined)}
            variant="ghost"
          >
            {c.cancel}
          </Button>
        ) : null}
        <Button
          disabled={!draft.trim() || mutationPending}
          loading={mutations.create.isPending}
          onPress={submit}
          testID="review-comment-submit"
        >
          {c.send}
        </Button>
      </View>
    </View>
  );
}

function CommentRow({
  actionsDisabled,
  comment,
  editing,
  editDraft,
  onCancelEdit,
  onChangeEdit,
  onDelete,
  onEdit,
  onReply,
  onSave,
  removing,
  saving,
}: {
  actionsDisabled: boolean;
  comment: ReviewComment;
  editing: boolean;
  editDraft: string;
  onCancelEdit(): void;
  onChangeEdit(value: string): void;
  onDelete(): void;
  onEdit(): void;
  onReply(): void;
  onSave(): void;
  removing: boolean;
  saving: boolean;
}) {
  const { locale } = useI18n();
  const c = reviewsCopy(locale);
  return (
    <View
      style={[styles.comment, comment.parentCommentId ? styles.reply : null]}
      testID={comment.parentCommentId ? `bdd-front-133-reply-${comment.commentId}` : `review-comment-${comment.commentId}`}
    >
      <AppText variant="caption">{comment.authorName || c.anonymous}</AppText>
      {editing ? (
        <TextField
          editable={!actionsDisabled}
          label={c.edit}
          multiline
          onChangeText={onChangeEdit}
          value={editDraft}
        />
      ) : (
        <AppText>{comment.content}</AppText>
      )}
      <View style={styles.actions}>
        {editing ? (
          <>
            <Button disabled={actionsDisabled} onPress={onCancelEdit} variant="ghost">
              {c.cancel}
            </Button>
            <Button
              disabled={actionsDisabled || !editDraft.trim()}
              loading={saving}
              onPress={onSave}
            >
              {c.save}
            </Button>
          </>
        ) : comment.parentCommentId == null ? (
          <Button disabled={actionsDisabled} onPress={onReply} variant="ghost">
            {c.reply}
          </Button>
        ) : null}
        {comment.ownedByCurrentReader && !editing ? (
          <View style={styles.actions} testID={`bdd-front-136-owned-actions-${comment.commentId}`}>
            <Button disabled={actionsDisabled} onPress={onEdit} variant="ghost">
              {c.edit}
            </Button>
            <Button
              disabled={actionsDisabled}
              loading={removing}
              onPress={onDelete}
              variant="ghost"
            >
              {c.remove}
            </Button>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.x2,
    justifyContent: "flex-end",
  },
  comment: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    gap: spacing.x2,
    paddingTop: spacing.x3,
  },
  heading: { gap: spacing.x2 },
  list: { flexGrow: 1 },
  privacyNote: {
    color: colors.muted,
  },
  reply: {
    borderLeftColor: colors.brass,
    borderLeftWidth: 2,
    marginLeft: spacing.x4,
    paddingLeft: spacing.x3,
  },
  reviewMeta: {
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.x2,
  },
  thread: { gap: spacing.x3 },
});
