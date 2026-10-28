import { fireEvent, render, waitFor } from '@testing-library/react';
import type { FormEvent } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { BookListPage } from '@/features/books/components/BookListPage';
import { BookSearchPage } from '@/features/books/components/BookSearchPage';
import {
  LibraryActivityList,
  LibraryRevisionList,
  LibraryThreadProgress,
} from '@/features/books/components/LibraryThreadSummary';
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

  it('book list renders its empty state and forwards sort changes', () => {
    const onSortChange = vi.fn();
    const view = render(
      <I18nProvider>
        <BookListPage
          books={[]}
          loading={false}
          onDelete={vi.fn()}
          onRatingChange={vi.fn()}
          onSelect={vi.fn()}
          onSortChange={onSortChange}
          onStatusChange={vi.fn()}
          sort="recent"
        />
      </I18nProvider>,
    );
    fireEvent.change(view.getByTestId('book-shelf-sort'), { target: { value: 'title_asc' } });
    expect(onSortChange).toHaveBeenCalledWith('title_asc');
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
                loop: {
                  answeredCount: 2,
                  continueLocator: {
                    href: '/book/1/reflection/interview',
                    kind: 'INTERVIEW',
                  },
                  stage: 'INTERVIEW',
                  targetCount: 5,
                },
                title: 'Margins',
              },
            ]}
            loading={false}
            onDelete={vi.fn()}
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
    expect(view.getByTestId('saved-book-continue')).toHaveAttribute(
      'href',
      '/book/1/reflection/interview',
    );
    expect(view.getByTestId('saved-book-detail-link')).not.toHaveAttribute('data-slot', 'button');
    fireEvent.click(view.getByTestId('saved-book-detail-link'));
    expect(onSelect).toHaveBeenCalledWith({
      author: 'Author',
      bookId: 1,
      coverImageUrl: 'https://example.com/margins.jpg',
      loop: {
        answeredCount: 2,
        continueLocator: {
          href: '/book/1/reflection/interview',
          kind: 'INTERVIEW',
        },
        stage: 'INTERVIEW',
        targetCount: 5,
      },
      title: 'Margins',
    });
    expect(
      view.getByTestId('saved-book-detail-link').parentElement?.parentElement,
    ).toContainElement(view.getByTestId('saved-book-cover'));
    expect(view.getByTestId('saved-book-detail-link').parentElement).toHaveClass(
      'min-h-16',
      'justify-center',
    );
    expect(view.getByTestId('saved-book-row')).not.toHaveClass(
      'hover:-translate-y-0.5',
      'hover:border-stone-400',
      'hover:shadow-[0_16px_40px_rgba(23,23,23,0.09)]',
    );
    view.unmount();
  });

  it('renders the server-provided Library stage, locator and bounded revision summaries', () => {
    const view = render(
      <MemoryRouter>
        <I18nProvider>
          <LibraryThreadProgress
            loop={{
              answeredCount: 3,
              continueLocator: {
                href: '/book/7/reflection/interview',
                kind: 'INTERVIEW',
              },
              stage: 'INTERVIEW',
              targetCount: 5,
            }}
          />
          <LibraryRevisionList
            revisions={[
              {
                createdAt: '2026-09-01T12:00:00',
                revisionId: 22,
                revisionSource: 'USER_EDIT',
                version: 2,
              },
            ]}
          />
        </I18nProvider>
      </MemoryRouter>,
    );

    expect(view.getByTestId('library-thread-continue')).toHaveAttribute(
      'href',
      '/book/7/reflection/interview',
    );
    expect(view.getByTestId('library-thread-summary')).toHaveTextContent('Interview 3/5');
    expect(view.getByTestId('library-recent-revisions')).toHaveTextContent('V2');
  });

  it('orders revision activity across books from newest to oldest', () => {
    const view = render(
      <MemoryRouter>
        <I18nProvider>
          <LibraryActivityList
            activities={[
              {
                bookAuthor: 'Older author',
                bookId: 1,
                bookTitle: 'Older book',
                createdAt: '2026-09-01T12:00:00',
                revisionId: 11,
                revisionSource: 'USER_EDIT',
                version: 1,
              },
              {
                bookAuthor: 'Newer author',
                bookId: 2,
                bookTitle: 'Newer book',
                createdAt: '2026-09-03T12:00:00',
                revisionId: 22,
                revisionSource: 'REFINEMENT',
                version: 3,
              },
            ]}
          />
        </I18nProvider>
      </MemoryRouter>,
    );

    const activity = view.getByTestId('library-recent-activity');
    const rows = activity.querySelectorAll('li');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Newer book');
    expect(rows[0]).toHaveTextContent('V3');
    expect(rows[1]).toHaveTextContent('Older book');
    expect(activity.querySelector('a')).toHaveAttribute('href', '/book/2');
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
          error=""
          loaded
          onOpenBook={vi.fn()}
          onRefresh={onRefresh}
          pending={false}
          reviews={[]}
        />
      </I18nProvider>,
    );
    expect(view.getByTestId('public-reviews-refresh')).toHaveTextContent('Refresh');
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
