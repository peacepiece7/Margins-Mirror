import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/legacy-skeleton';
import { BookRatingInput } from '@/features/books/components/BookRatingInput';
import { BookStatusSelect } from '@/features/books/components/BookStatusSelect';
import type { BookReadingStatus } from '@/features/books/types';
import { localizedPersonaDisplayName, localizedPersonaTone } from '@/features/debates/display';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

import type { BookDetailPageProps } from './types';

type DebateEntryIconKind = 'book' | 'topic' | 'speakers';

function DebateEntryIcon({
  className = 'h-5 w-5',
  kind,
  testId,
}: {
  className?: string;
  kind: DebateEntryIconKind;
  testId?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      {...(testId ? testAttr(testId) : {})}
    >
      {kind === 'book' && (
        <>
          <path d="M3.5 5.5A2.5 2.5 0 0 1 6 3h4a2 2 0 0 1 2 2v16a3 3 0 0 0-3-3H3.5V5.5Z" />
          <path d="M20.5 5.5A2.5 2.5 0 0 0 18 3h-4a2 2 0 0 0-2 2v16a3 3 0 0 1 3-3h5.5V5.5Z" />
        </>
      )}
      {kind === 'topic' && (
        <>
          <path d="M20 15a4 4 0 0 1-4 4H9l-5 3v-7a8 8 0 1 1 16 0Z" />
          <path d="M9.6 10a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1.1.9-1.1 1.7" />
          <path d="M12 17h.01" />
        </>
      )}
      {kind === 'speakers' && (
        <>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
          <path d="M16 5.2a3 3 0 0 1 0 5.6M17 14.5a5 5 0 0 1 3.5 4.8" />
        </>
      )}
    </svg>
  );
}

function QuestionRowSkeleton() {
  return (
    <div
      className="grid gap-2 rounded border border-stone-200 bg-white p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
      {...testAttr('book-question-skeleton')}
    >
      <div className="grid gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <Skeleton className="h-9 w-20" />
    </div>
  );
}

function normalizeBookStatus(status?: string): BookReadingStatus {
  return status === 'reading' || status === 'read' || status === 'dnf' ? status : 'want_to_read';
}

export function BookDetailPage(props: BookDetailPageProps) {
  const { locale, t } = useI18n();
  const {
    answeredQuestionIds,
    book: selectedBook,
    bookKnowledge,
    bookKnowledgeError,
    bookKnowledgePending,
    debateTopic,
    draftPersonaIds: draftDebatePersonaIds,
    editAuthor,
    editTitle,
    loading,
    personas,
    questions: currentQuestions,
    recommendedPersonaIds,
    selectedPersonaIds: selectedDebatePersonaIds,
    speakerDialogOpen,
    questionLoading: showQuestionSkeleton,
    onApplyDiscussionPoint: applyDiscussionPoint,
    onApplyPersonas: applyDebatePersonas,
    onCloseSpeakerDialog: closeSpeakerDialog,
    onDebateTopicChange: setDebateTopic,
    onDeleteBook: deleteSelectedBook,
    onDeleteQuestion: deleteQuestion,
    onEditAuthorChange: setEditAuthor,
    onEditTitleChange: setEditTitle,
    onEnterDebate: enterDebate,
    onGenerateQuestions: generateQuestionsForSelectedBook,
    onOpenQuestionAnswer: openQuestionAnswer,
    onOpenQuestionDebate: openQuestionDebate,
    onOpenSpeakerDialog: openSpeakerDialog,
    onRatingChange,
    onSpeakerDialogOpenChange: setSpeakerDialogOpen,
    onStartReview: startReflection,
    onStatusChange,
    onSubmitBook: submitBookEdit,
    onToggleDraftPersona: toggleDraftDebatePersona,
  } = props;
  const bookKnowledgeDiscussionPoints = bookKnowledge?.discussionPoints ?? [];
  const selectedDebatePersonas = personas.filter((persona) =>
    selectedDebatePersonaIds.includes(persona.personaId),
  );
  const shelfStatusLabel = (status: BookReadingStatus) =>
    ({
      want_to_read: t('shelfStatusWantToRead'),
      reading: t('shelfStatusReading'),
      read: t('shelfStatusRead'),
      dnf: t('shelfStatusDnf'),
    })[status];
  const updateShelf = (
    _bookId: number,
    shelf: { readingStatus?: BookReadingStatus; rating?: number; clearRating?: boolean },
  ) => {
    if (shelf.readingStatus) onStatusChange(shelf.readingStatus);
    if (shelf.clearRating) onRatingChange(undefined);
    else if (shelf.rating !== undefined) onRatingChange(shelf.rating);
  };

  return (
    <section className="grid gap-5" {...testAttr('book-detail-page')}>
      <div className="rounded border border-stone-300 bg-stone-50/95 p-4 shadow-[0_18px_50px_rgba(23,23,23,0.06)] sm:p-5">
        <h2 className="font-display text-3xl font-semibold tracking-normal">{t('bookDetail')}</h2>
        {selectedBook ? (
          <form
            className="mt-4 grid gap-3"
            onSubmit={submitBookEdit}
            {...testAttr('book-edit-form')}
          >
            <div className="grid gap-3 rounded border border-stone-200 bg-white p-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="text-stone-600">{t('shelfStatusLabel')}</span>
                <BookStatusSelect
                  disabled={loading}
                  onChange={(status) => updateShelf(selectedBook.bookId, { readingStatus: status })}
                  status={normalizeBookStatus(selectedBook.readingStatus)}
                  statusLabel={shelfStatusLabel}
                  testId="book-detail-status"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-stone-600">{t('shelfRatingLabel')}</span>
                <BookRatingInput
                  disabled={loading}
                  onChange={(rating) =>
                    updateShelf(
                      selectedBook.bookId,
                      rating === undefined ? { clearRating: true } : { rating },
                    )
                  }
                  rating={selectedBook.rating}
                  testId="book-detail-rating"
                />
              </label>
            </div>
            <Input
              className="rounded border border-stone-300 bg-white px-3 py-2 text-sm"
              onChange={(event) => setEditTitle(event.target.value)}
              value={editTitle}
              {...testAttr('book-edit-title-input')}
            />
            <Input
              className="rounded border border-stone-300 bg-white px-3 py-2 text-sm"
              onChange={(event) => setEditAuthor(event.target.value)}
              value={editAuthor}
              {...testAttr('book-edit-author-input')}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                className="rounded bg-stone-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={loading || !editTitle.trim() || !editAuthor.trim()}
                type="submit"
                {...testAttr('book-edit-submit')}
              >
                {t('saveEdit')}
              </Button>
              <Button
                className="rounded border border-red-300 px-4 py-2 text-sm text-red-700"
                disabled={loading}
                onClick={deleteSelectedBook}
                type="button"
                {...testAttr('book-detail-delete')}
              >
                {t('delete')}
              </Button>
              <Button
                className="rounded border border-stone-900 px-4 py-2 text-sm font-medium"
                disabled={loading}
                onClick={startReflection}
                type="button"
                {...testAttr('book-start-review')}
              >
                {t('startReview')}
              </Button>
            </div>
          </form>
        ) : (
          <div className="mt-4 text-sm text-stone-500">{t('bookDetailEmpty')}</div>
        )}
      </div>

      <div
        className="rounded border border-stone-300 bg-white p-4 sm:p-5"
        {...testAttr('book-question-panel')}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">{t('questionPanelTitle')}</h3>
            <p className="text-sm text-stone-600">{t('questionPanelDescription')}</p>
          </div>
          <Button
            className="rounded border border-stone-950 px-3 py-2 text-sm font-medium disabled:opacity-50"
            disabled={!selectedBook || loading || showQuestionSkeleton}
            onClick={generateQuestionsForSelectedBook}
            type="button"
            {...testAttr('book-generate-questions')}
          >
            {t('questionGenerate')}
          </Button>
        </div>
        <div className="mt-4 grid gap-2">
          {showQuestionSkeleton && [0, 1, 2].map((item) => <QuestionRowSkeleton key={item} />)}
          {currentQuestions.map((question) => {
            const answered = answeredQuestionIds.has(question.questionId);

            return (
              <div
                className="grid gap-2 rounded border border-stone-200 bg-white p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                key={question.questionId}
                {...testAttr('book-question-row')}
              >
                <div className="text-sm leading-6" {...testAttr('book-question-text')}>
                  {question.questionText}
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    className="rounded border border-stone-900 px-3 py-2 text-sm font-medium disabled:opacity-50"
                    disabled={loading}
                    onClick={() => openQuestionAnswer(question.questionId)}
                    type="button"
                    {...testAttr('book-question-answer')}
                  >
                    {answered ? t('questionAnswerEdit') : t('questionAnswerStart')}
                  </Button>
                  <Button
                    className="rounded bg-stone-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                    disabled={loading}
                    onClick={() => openQuestionDebate(question.questionId)}
                    type="button"
                    {...testAttr('book-question-debate')}
                  >
                    {t('questionDebate')}
                  </Button>
                  {answered ? (
                    <span
                      className="rounded bg-stone-100 px-3 py-2 text-sm text-stone-500"
                      {...testAttr('book-question-answered')}
                    >
                      {t('questionAnswered')}
                    </span>
                  ) : (
                    <Button
                      className="rounded border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-50"
                      disabled={loading}
                      onClick={() => deleteQuestion(question.questionId)}
                      type="button"
                      {...testAttr('book-question-delete')}
                    >
                      {t('delete')}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {!showQuestionSkeleton && !currentQuestions.length && (
            <div className="rounded bg-stone-100 p-4 text-sm text-stone-500">
              {t('questionEmpty')}
            </div>
          )}
        </div>
      </div>

      <div
        className="rounded border border-stone-300 bg-white p-4 sm:p-5"
        {...testAttr('book-debate-entry')}
      >
        <h3 className="font-semibold">{t('debateEntryTitle')}</h3>
        <p className="mt-1 text-sm text-stone-600">{t('debateEntryDescription')}</p>
        <div className="mt-4 grid gap-2" {...testAttr('debate-entry-summary')}>
          <div className="grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-2 text-sm">
            <span
              aria-hidden="true"
              className="grid h-8 w-8 place-items-center rounded bg-stone-100 text-stone-600"
            >
              <DebateEntryIcon kind="book" testId="debate-entry-icon-book" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold uppercase text-stone-500">
                {t('currentBook')}
              </span>
              <span className="block font-medium" {...testAttr('debate-entry-book')}>
                {selectedBook?.title || t('noBookSelected')}
              </span>
            </span>
          </div>
          <div className="grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-2 text-sm">
            <span
              aria-hidden="true"
              className="grid h-8 w-8 place-items-center rounded bg-stone-100 text-stone-600"
            >
              <DebateEntryIcon kind="topic" testId="debate-entry-icon-topic" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold uppercase text-stone-500">
                {t('debateTopicPlaceholder')}
              </span>
              <span className="block font-medium" {...testAttr('debate-entry-topic')}>
                {debateTopic.trim() || t('debateTopicPlaceholder')}
              </span>
            </span>
          </div>
          <div className="grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-2 text-sm">
            <span
              aria-hidden="true"
              className="grid h-8 w-8 place-items-center rounded bg-stone-100 text-stone-600"
            >
              <DebateEntryIcon kind="speakers" testId="debate-entry-icon-speakers" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold uppercase text-stone-500">
                {t('debateParticipantCount')}
              </span>
              <span
                className="mt-1 flex flex-wrap gap-1"
                {...testAttr('debate-entry-selected-personas')}
              >
                {selectedDebatePersonas.length ? (
                  selectedDebatePersonas.map((persona) => (
                    <span
                      className="rounded border border-stone-300 bg-stone-50 px-2 py-1 text-xs text-stone-700"
                      key={persona.personaId}
                    >
                      <DebateEntryIcon
                        className="mr-1 inline-block h-3.5 w-3.5 align-[-0.15em]"
                        kind="speakers"
                        testId="debate-entry-selected-speaker-icon"
                      />
                      {localizedPersonaDisplayName(persona, locale)}
                    </span>
                  ))
                ) : (
                  <span className="text-stone-500">{t('debateNoPersonas')}</span>
                )}
              </span>
            </span>
          </div>
        </div>
        <Button
          className="mt-3 rounded border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700"
          onClick={openSpeakerDialog}
          type="button"
          {...testAttr('debate-participant-change')}
        >
          {t('debateParticipantChange')}
        </Button>
        <div className="mt-4 grid gap-2" {...testAttr('book-knowledge-recommendations')}>
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium">Book Knowledge 추천 주제</div>
            {bookKnowledgePending && <span className="text-xs text-stone-500">불러오는 중</span>}
          </div>
          {bookKnowledge?.summary && (
            <p className="rounded bg-amber-50 px-3 py-2 text-sm leading-6 text-stone-700">
              {bookKnowledge.summary}
            </p>
          )}
          {bookKnowledgeDiscussionPoints.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {bookKnowledgeDiscussionPoints.map((point) => (
                <Button
                  className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-left text-sm text-stone-800 hover:border-amber-500"
                  key={point.id}
                  onClick={() => applyDiscussionPoint(point.id)}
                  title={point.rationale}
                  type="button"
                  {...testAttr('book-knowledge-topic')}
                >
                  {point.question}
                </Button>
              ))}
            </div>
          ) : (
            <div className="rounded bg-stone-100 p-3 text-sm text-stone-500">
              {bookKnowledgeError || '저장된 추천 주제가 없으면 직접 주제를 입력할 수 있습니다.'}
            </div>
          )}
          {!!bookKnowledge?.keywords?.length && (
            <div className="flex flex-wrap gap-1" {...testAttr('book-knowledge-keywords')}>
              {bookKnowledge.keywords.map((keyword) => (
                <span
                  className="rounded bg-stone-100 px-2 py-1 text-xs text-stone-600"
                  key={keyword}
                >
                  #{keyword}
                </span>
              ))}
            </div>
          )}
        </div>
        <Dialog open={speakerDialogOpen} onOpenChange={setSpeakerDialogOpen}>
          <DialogContent
            className="border-stone-400 bg-card p-4 sm:max-w-2xl sm:p-5"
            showCloseButton={false}
            {...testAttr('debate-participant-dialog')}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="font-semibold" id="speaker-dialog-title">
                  {t('debateParticipantPicker')}
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm text-muted-foreground">
                  {t('debateParticipantDialogDescription')}
                </DialogDescription>
              </div>
              <Button
                aria-label={t('debateParticipantCancel')}
                className="rounded border border-stone-300 bg-white px-3 py-1 text-lg leading-none"
                onClick={closeSpeakerDialog}
                type="button"
              >
                ×
              </Button>
            </div>
            <div
              className="blueprint-speaker-picker mt-4 grid gap-2 sm:grid-cols-2"
              {...testAttr('debate-participant-picker')}
            >
              {personas.map((persona) => {
                const selected = draftDebatePersonaIds.includes(persona.personaId);
                const recommended = recommendedPersonaIds.includes(persona.personaId);
                const selectionLimitReached = !selected && draftDebatePersonaIds.length >= 2;
                const displayName = localizedPersonaDisplayName(persona, locale);
                const tone = localizedPersonaTone(persona, locale);
                return (
                  <Button
                    aria-disabled={selectionLimitReached}
                    aria-pressed={selected}
                    className={`grid h-auto min-h-24 gap-1 whitespace-normal rounded border px-3 py-2 text-left text-sm ${selected ? 'border-stone-950 bg-stone-950 text-white hover:bg-stone-900' : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50 hover:text-stone-900'}`}
                    key={persona.personaId}
                    onClick={() => toggleDraftDebatePersona(persona.personaId)}
                    title={
                      selectionLimitReached
                        ? t('debateParticipantSelectionLimit')
                        : persona.description
                    }
                    type="button"
                    variant="outline"
                    {...testAttr('debate-participant-toggle')}
                  >
                    <span className="font-medium">
                      <DebateEntryIcon
                        className="mr-1 inline-block h-4 w-4 align-[-0.18em]"
                        kind="speakers"
                        testId="debate-participant-speaker-icon"
                      />
                      {displayName}
                      {recommended && (
                        <span className="ml-1 text-[11px] font-normal opacity-75">
                          {t('debateParticipantSuggested')}
                        </span>
                      )}
                    </span>
                    {tone && (
                      <span className={`text-xs ${selected ? 'text-stone-200' : 'text-stone-500'}`}>
                        {tone}
                      </span>
                    )}
                    {persona.description && (
                      <span
                        className={`line-clamp-2 text-xs leading-5 ${selected ? 'text-stone-200' : 'text-stone-500'}`}
                      >
                        {persona.description}
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                className="rounded border border-stone-300 bg-white px-4 py-2 text-sm text-stone-800 hover:bg-stone-50 hover:text-stone-950"
                onClick={closeSpeakerDialog}
                type="button"
                variant="outline"
              >
                {t('debateParticipantCancel')}
              </Button>
              <Button
                className="rounded bg-stone-950 px-4 py-2 text-sm font-medium text-white"
                onClick={applyDebatePersonas}
                type="button"
                variant="default"
                {...testAttr('debate-participant-apply')}
              >
                {t('debateParticipantApply')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <div className="mt-3 flex gap-2">
          <Input
            className="min-w-0 flex-1 rounded border border-stone-300 px-3 py-2 text-sm"
            onChange={(event) => setDebateTopic(event.target.value)}
            placeholder={t('debateTopicPlaceholder')}
            value={debateTopic}
            {...testAttr('debate-topic-input')}
          />
          <Button
            className="rounded bg-stone-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={
              !selectedBook || !debateTopic.trim() || !selectedDebatePersonaIds.length || loading
            }
            onClick={enterDebate}
            type="button"
            {...testAttr('debate-enter-submit')}
          >
            {t('debateEnter')}
          </Button>
        </div>
      </div>
    </section>
  );
}
