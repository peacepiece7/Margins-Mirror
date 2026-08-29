import { fireEvent, render, waitFor } from '@testing-library/react';
import type { FormEvent } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { BookDetailPage } from './book-detail';
import { BookListPage } from '@/features/books/components/BookListPage';
import { BookSearchPage } from '@/features/books/components/BookSearchPage';
import { DebatePage } from '@/features/debates/components/DebatePage';
import { DebateRoomsPage } from '@/features/debates/components/DebateRoomsPage';
import { PublicReviewsPage } from '@/features/public-reviews/components/PublicReviewsPage';
import { QuestionAnswerEditorPage } from '@/features/reflections/components/QuestionAnswerEditorPage';
import { ReviewEditorPage } from '@/features/reflections/components/ReviewEditorPage';
import { ReviewPage } from '@/features/reflections/components/ReviewPage';
import { I18nProvider } from '@/lib/i18n';

describe('reading workspace page boundaries', () => {
  it('book search renders its content and forwards its RHF-owned query', async () => {
    const onSearch = vi.fn();

    const view = render(
      <I18nProvider>
        <BookSearchPage
          candidateHasMore={false}
          candidates={[]}
          error={false}
          loadMoreRef={vi.fn()}
          loading={false}
          loadingMore={false}
          onClear={vi.fn()}
          onManualSubmit={vi.fn()}
          onRetry={vi.fn()}
          onSaveCandidate={vi.fn()}
          onSearch={onSearch}
          query="Margins"
          saving={false}
        />
      </I18nProvider>,
    );
    fireEvent.change(view.getByTestId('book-search-input'), { target: { value: 'Margins' } });
    fireEvent.click(view.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(onSearch).toHaveBeenCalledWith('Margins'));
    view.unmount();
  });

  it('renders Discover candidates in one column without pagination buttons', () => {
    const view = render(
      <I18nProvider>
        <BookSearchPage
          candidateHasMore
          candidates={[
            { author: 'Author', candidateId: 'candidate-1', title: 'First book' },
            { author: 'Author', candidateId: 'candidate-2', title: 'Second book' },
          ]}
          error={false}
          loadMoreRef={vi.fn()}
          loading={false}
          loadingMore={false}
          onClear={vi.fn()}
          onManualSubmit={vi.fn()}
          onRetry={vi.fn()}
          onSaveCandidate={vi.fn()}
          onSearch={vi.fn()}
          query="book"
          saving={false}
        />
      </I18nProvider>,
    );

    expect(view.getByTestId('book-candidate-list')).toHaveClass('grid-cols-1');
    expect(view.getAllByTestId('book-candidate-card')).toHaveLength(2);
    expect(view.queryByTestId('book-candidate-next')).not.toBeInTheDocument();
    expect(view.queryByTestId('book-candidate-prev')).not.toBeInTheDocument();
    expect(view.getByTestId('book-candidate-load-more')).toBeInTheDocument();
  });

  it('debate rooms renders windows and forwards the selected window', () => {
    const onSelectWindow = vi.fn();
    const window = {
      position: 1,
      sessionId: 10,
      status: 'active',
      title: 'Debate: Meaning',
      windowId: 20,
      windowType: 'debate',
      personaIds: [],
    };
    const view = render(
      <I18nProvider>
        <DebateRoomsPage currentWindowId={20} onSelectWindow={onSelectWindow} windows={[window]} />
      </I18nProvider>,
    );

    fireEvent.click(view.getByRole('button', { name: /Meaning/ }));

    expect(onSelectWindow).toHaveBeenCalledWith(window);
    view.unmount();
  });

  it('question answer editor renders the question and forwards cancel', () => {
    const onCancel = vi.fn();
    const view = render(
      <I18nProvider>
        <QuestionAnswerEditorPage
          answer="An answer"
          hasExistingAnswer={false}
          loading={false}
          onAnswerChange={vi.fn()}
          onCancel={onCancel}
          onSubmit={vi.fn()}
          questionText="What changed?"
        />
      </I18nProvider>,
    );

    fireEvent.click(view.getByRole('button', { name: 'Cancel' }));

    expect(view.getByText('What changed?')).toBeVisible();
    expect(onCancel).toHaveBeenCalledOnce();
    view.unmount();
  });

  it('review editor renders its draft and forwards cancel', () => {
    const onCancel = vi.fn();
    const view = render(
      <I18nProvider>
        <ReviewEditorPage
          authorName=""
          content="Draft"
          evidence=""
          isEditing={false}
          loading={false}
          onAuthorNameChange={vi.fn()}
          onCancel={onCancel}
          onContentChange={vi.fn()}
          onEvidenceChange={vi.fn()}
          onReviewedOnChange={vi.fn()}
          onSubmit={vi.fn()}
          onVisibilityChange={vi.fn()}
          reviewedOn=""
          visibility="PRIVATE"
        />
      </I18nProvider>,
    );

    fireEvent.click(view.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledOnce();
    view.unmount();
  });

  it('book list renders its empty state and forwards filter changes', () => {
    const onFilterChange = vi.fn();
    const view = render(
      <I18nProvider>
        <BookListPage
          books={[]}
          filter="all"
          loading={false}
          onDelete={vi.fn()}
          onFilterChange={onFilterChange}
          onRatingChange={vi.fn()}
          onSelect={vi.fn()}
          onSortChange={vi.fn()}
          onStatusChange={vi.fn()}
          sort="recent"
        />
      </I18nProvider>,
    );
    fireEvent.change(view.getByTestId('book-shelf-filter'), { target: { value: 'reading' } });
    expect(onFilterChange).toHaveBeenCalledWith('reading');
    view.unmount();
  });

  it('selects a saved book from its title link without card hover effects', () => {
    const onSelect = vi.fn();
    const view = render(
      <MemoryRouter>
        <I18nProvider>
          <BookListPage
            books={[
              {
                author: 'Author',
                bookId: 1,
                coverImageUrl: 'https://example.com/margins.jpg',
                title: 'Margins',
              },
            ]}
            filter="all"
            loading={false}
            onDelete={vi.fn()}
            onFilterChange={vi.fn()}
            onRatingChange={vi.fn()}
            onSelect={onSelect}
            onSortChange={vi.fn()}
            onStatusChange={vi.fn()}
            sort="recent"
          />
        </I18nProvider>
      </MemoryRouter>,
    );

    expect(view.getByTestId('saved-book-detail-link')).toHaveAttribute('href', '/book/1');
    expect(view.getByTestId('saved-book-detail-link').tagName).toBe('A');
    expect(view.getByTestId('saved-book-detail-link')).toHaveTextContent('Margins');
    expect(view.getByTestId('saved-book-detail-link')).not.toHaveAttribute('data-slot', 'button');
    fireEvent.click(view.getByTestId('saved-book-detail-link'));
    expect(onSelect).toHaveBeenCalledWith({
      author: 'Author',
      bookId: 1,
      coverImageUrl: 'https://example.com/margins.jpg',
      title: 'Margins',
    });
    expect(
      view.getByTestId('saved-book-detail-link').parentElement?.parentElement,
    ).toContainElement(view.getByTestId('saved-book-cover'));
    expect(view.getByTestId('saved-book-detail-link').parentElement).toHaveClass(
      'min-h-20',
      'justify-center',
    );
    expect(view.getByTestId('saved-book-row')).not.toHaveClass(
      'hover:-translate-y-0.5',
      'hover:border-stone-400',
      'hover:shadow-[0_16px_40px_rgba(23,23,23,0.09)]',
    );
    view.unmount();
  });

  it('book detail renders selected-book controls and forwards review start', () => {
    const onStartReview = vi.fn();
    const view = render(
      <I18nProvider>
        <BookDetailPage
          answeredQuestionIds={new Set()}
          book={{ author: 'Author', bookId: 1, title: 'Margins' }}
          bookKnowledgeError=""
          bookKnowledgePending={false}
          debateTopic=""
          draftPersonaIds={[]}
          editAuthor="Author"
          editTitle="Margins"
          loading={false}
          onApplyDiscussionPoint={vi.fn()}
          onApplyPersonas={vi.fn()}
          onCloseSpeakerDialog={vi.fn()}
          onDebateTopicChange={vi.fn()}
          onDeleteBook={vi.fn()}
          onDeleteQuestion={vi.fn()}
          onEditAuthorChange={vi.fn()}
          onEditTitleChange={vi.fn()}
          onEnterDebate={vi.fn()}
          onGenerateQuestions={vi.fn()}
          onOpenQuestionAnswer={vi.fn()}
          onOpenQuestionDebate={vi.fn()}
          onOpenSpeakerDialog={vi.fn()}
          onRatingChange={vi.fn()}
          onSpeakerDialogOpenChange={vi.fn()}
          onStartReview={onStartReview}
          onStatusChange={vi.fn()}
          onSubmitBook={vi.fn()}
          onToggleDraftPersona={vi.fn()}
          personas={[]}
          questionLoading={false}
          questions={[]}
          recommendedPersonaIds={[]}
          selectedPersonaIds={[]}
          speakerDialogOpen={false}
        />
      </I18nProvider>,
    );
    fireEvent.click(view.getByTestId('book-start-review'));
    expect(onStartReview).toHaveBeenCalledOnce();
    view.unmount();
  });

  it('book detail keeps selected persona controls on the primary Button variant', () => {
    const view = render(
      <I18nProvider>
        <BookDetailPage
          answeredQuestionIds={new Set()}
          book={{ author: 'Author', bookId: 1, title: 'Margins' }}
          bookKnowledgeError=""
          bookKnowledgePending={false}
          debateTopic=""
          draftPersonaIds={[1]}
          editAuthor="Author"
          editTitle="Margins"
          loading={false}
          onApplyDiscussionPoint={vi.fn()}
          onApplyPersonas={vi.fn()}
          onCloseSpeakerDialog={vi.fn()}
          onDebateTopicChange={vi.fn()}
          onDeleteBook={vi.fn()}
          onDeleteQuestion={vi.fn()}
          onEditAuthorChange={vi.fn()}
          onEditTitleChange={vi.fn()}
          onEnterDebate={vi.fn()}
          onGenerateQuestions={vi.fn()}
          onOpenQuestionAnswer={vi.fn()}
          onOpenQuestionDebate={vi.fn()}
          onOpenSpeakerDialog={vi.fn()}
          onRatingChange={vi.fn()}
          onSpeakerDialogOpenChange={vi.fn()}
          onStartReview={vi.fn()}
          onStatusChange={vi.fn()}
          onSubmitBook={vi.fn()}
          onToggleDraftPersona={vi.fn()}
          personas={[
            {
              description: 'Challenges assumptions.',
              displayName: 'Skeptic',
              name: 'skeptic',
              personaId: 1,
            },
            {
              description: 'Looks for context.',
              displayName: 'Historian',
              name: 'historian',
              personaId: 2,
            },
          ]}
          questionLoading={false}
          questions={[]}
          recommendedPersonaIds={[]}
          selectedPersonaIds={[]}
          speakerDialogOpen
        />
      </I18nProvider>,
    );

    const buttons = view.getAllByTestId('debate-participant-toggle');
    expect(buttons[0]).toHaveAttribute('data-variant', 'default');
    expect(buttons[1]).toHaveAttribute('data-variant', 'outline');
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'true');
    expect(buttons[1]).toHaveAttribute('aria-pressed', 'false');
    view.unmount();
  });

  it('saved notes renders its empty state and forwards write', () => {
    const onWrite = vi.fn();
    const view = render(
      <I18nProvider>
        <ReviewPage
          filter="all"
          insights={[]}
          loading={false}
          onDiscussAnswer={vi.fn()}
          onEditAnswer={vi.fn()}
          onEditReview={vi.fn()}
          onFilterChange={vi.fn()}
          onWrite={onWrite}
          questions={[]}
          selectedBook
        />
      </I18nProvider>,
    );
    fireEvent.click(view.getByTestId('review-write'));
    expect(onWrite).toHaveBeenCalledOnce();
    view.unmount();
  });

  it('public reviews renders its empty state and forwards refresh', () => {
    const onRefresh = vi.fn();
    const view = render(
      <I18nProvider>
        <PublicReviewsPage
          commentDrafts={{}}
          comments={{}}
          commentsError={{}}
          commentsPending={{}}
          editingCommentDraft=""
          error=""
          loaded
          onCancelEdit={vi.fn()}
          onCommentDraftChange={vi.fn()}
          onDeleteComment={vi.fn()}
          onEditingDraftChange={vi.fn()}
          onLoadComments={vi.fn()}
          onOpenBook={vi.fn()}
          onRefresh={onRefresh}
          onReplyDraftChange={vi.fn()}
          onStartEdit={vi.fn()}
          onSubmitComment={vi.fn()}
          onSubmitEdit={vi.fn()}
          pending={false}
          replyDrafts={{}}
          reviews={[]}
        />
      </I18nProvider>,
    );
    fireEvent.click(view.getByTestId('public-reviews-refresh'));
    expect(onRefresh).toHaveBeenCalledOnce();
    view.unmount();
  });

  it('debate renders its composer and forwards submit', () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    const view = render(
      <I18nProvider>
        <DebatePage
          draft="A thought"
          loading={false}
          messages={[]}
          onAllReplies={vi.fn()}
          onDraftChange={vi.fn()}
          onPersonaReply={vi.fn()}
          onSubmit={onSubmit}
          personas={[]}
          selectedPersonas={[
            {
              displayName: 'Reader',
              name: 'reader',
              personaId: 1,
            },
          ]}
          showReplySkeleton={false}
          topic="Meaning"
          window={{
            title: 'Debate: Meaning',
            windowType: 'debate',
          }}
        />
      </I18nProvider>,
    );
    expect(view.getByTestId('debate-speaker-reply')).toHaveClass(
      'h-auto',
      'min-h-24',
      'whitespace-normal',
    );
    fireEvent.click(view.getByTestId('debate-session-submit'));
    expect(onSubmit).toHaveBeenCalledOnce();
    view.unmount();
  });

  it('debate keeps the composer and exposes feedback for a rejected event', () => {
    const onModerationFeedback = vi.fn();
    const view = render(
      <I18nProvider>
        <DebatePage
          draft="Keep this draft"
          loading={false}
          messages={[]}
          moderationEvents={[
            {
              eventId: 11,
              sessionId: 2,
              windowId: 3,
              decision: 'REJECT',
              intent: 'MEANINGLESS',
              reasonCode: 'MEANINGLESS',
              fallbackUsed: false,
              routingOutcome: 'REJECTED',
              personaCalled: false,
              createdAt: '2026-07-29T00:00:00Z',
            },
          ]}
          onAllReplies={vi.fn()}
          onDraftChange={vi.fn()}
          onModerationFeedback={onModerationFeedback}
          onPersonaReply={vi.fn()}
          onSubmit={vi.fn()}
          personas={[]}
          selectedPersonas={[]}
          showReplySkeleton={false}
          topic="Meaning"
          window={{ title: 'Debate: Meaning', windowType: 'debate' }}
        />
      </I18nProvider>,
    );

    expect(view.getByTestId('debate-moderation-event')).toHaveTextContent(
      /This message was not sent|이 메시지는 페르소나에게 전달하지 않았어요/,
    );
    expect(view.getByTestId('debate-session-message-input')).toHaveValue('Keep this draft');
    fireEvent.click(view.getByRole('button', { name: /Related|관련 있었어요/ }));
    expect(onModerationFeedback).toHaveBeenCalledWith(11, 'RELATED');
    view.unmount();
  });
});
