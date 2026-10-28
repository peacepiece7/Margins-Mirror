import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthenticatedSessionGuardContext } from '@/lib/authenticated-session-guard';
import { I18nProvider } from '@/lib/i18n';
import { publicReviewKeys } from '@/lib/query-keys';
import type { PublicReview, ReviewCommentListResponse } from '@/types/api/session';
import { publicReviewsApi } from '../api';
import { PublicReviewsPanel } from './PublicReviewsPanel';

// BDD: FRONT-132, FRONT-133, FRONT-134, FRONT-135, FRONT-136, FRONT-180, FRONT-202
const review: PublicReview = {
  insightId: 11,
  bookId: 7,
  sessionId: 3,
  bookTitle: 'A book',
  sessionTitle: 'Reading',
  title: 'A public review',
  content: 'First line\nSecond line',
  evidence: 'A passage',
};
const thread: ReviewCommentListResponse = {
  insightId: 11,
  comments: [
    { insightId: 11, commentId: 5, content: 'My comment', ownedByCurrentReader: true },
    { insightId: 11, commentId: 6, content: 'Other reader', ownedByCurrentReader: false },
  ],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function renderPanel(currentSession = () => true) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <AuthenticatedSessionGuardContext.Provider value={currentSession}>
        <I18nProvider>
          <MemoryRouter initialEntries={['/book/public-reviews']}>
            <PublicReviewsPanel />
            <Location />
          </MemoryRouter>
        </I18nProvider>
      </AuthenticatedSessionGuardContext.Provider>
    </QueryClientProvider>,
  );
  return { ...view, client };
}

async function ready() {
  await screen.findByText('My comment');
  await waitFor(() =>
    expect(screen.getByTestId('public-review-comments-refresh')).not.toBeDisabled(),
  );
}

beforeEach(() => {
  localStorage.setItem('margins.locale', 'en');
  vi.spyOn(publicReviewsApi, 'list').mockResolvedValue({ reviews: [review] });
  vi.spyOn(publicReviewsApi, 'comments').mockResolvedValue(thread);
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('PublicReviewsPanel comment workflow', () => {
  it('shows initial loading and localized query failures with retry', async () => {
    const request = deferred<{ reviews: PublicReview[] }>();
    vi.mocked(publicReviewsApi.list).mockReturnValueOnce(request.promise);
    renderPanel();
    expect(screen.getAllByTestId('public-review-skeleton')).toHaveLength(3);
    await act(async () => request.reject(new Error('private query detail')));
    await screen.findByText('Public reviews could not be loaded.');
    fireEvent.click(screen.getByTestId('public-reviews-refresh'));
    await ready();
    vi.mocked(publicReviewsApi.comments).mockRejectedValueOnce(
      new Error('private comments detail'),
    );
    fireEvent.click(screen.getByTestId('public-review-comments-refresh'));
    await screen.findByText('Comments could not be loaded.');
    expect(screen.getByText('My comment')).toBeInTheDocument();
    expect(screen.queryByText('private comments detail')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('public-review-comments-refresh'));
    await waitFor(() =>
      expect(screen.queryByTestId('public-review-comments-error')).not.toBeInTheDocument(),
    );
  });

  it('blocks blank forms and writes during a comments fetch', async () => {
    const create = vi.spyOn(publicReviewsApi, 'createComment');
    const update = vi.spyOn(publicReviewsApi, 'updateComment');
    const request = deferred<ReviewCommentListResponse>();
    renderPanel();
    await ready();
    fireEvent.change(screen.getByTestId('public-review-comment-input'), {
      target: { value: '   ' },
    });
    fireEvent.submit(screen.getByTestId('public-review-comment-form'));
    fireEvent.click(screen.getByTestId('public-review-comment-edit'));
    fireEvent.change(screen.getByTestId('public-review-comment-edit-input'), {
      target: { value: '   ' },
    });
    fireEvent.submit(screen.getByTestId('public-review-comment-edit-form'));
    await act(async () => {});
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId('public-review-comment-input'), {
      target: { value: 'Wait for fetch' },
    });
    vi.mocked(publicReviewsApi.comments).mockReturnValueOnce(request.promise);
    fireEvent.click(screen.getByTestId('public-review-comments-refresh'));
    await waitFor(() => expect(screen.getByTestId('public-review-comment-submit')).toBeDisabled());
    fireEvent.submit(screen.getByTestId('public-review-comment-form'));
    await act(async () => {});
    expect(create).not.toHaveBeenCalled();
    await act(async () => request.resolve(thread));
    expect(screen.getByTestId('public-review-comment-input')).toHaveValue('Wait for fetch');
  });

  it('keeps writes and drafts independent across review cards', async () => {
    const first = deferred<ReviewCommentListResponse>();
    vi.mocked(publicReviewsApi.list).mockResolvedValue({
      reviews: [review, { ...review, insightId: 12, title: 'Neighbor' }],
    });
    vi.mocked(publicReviewsApi.comments).mockImplementation(async (id) =>
      id === 11 ? thread : { insightId: 12, comments: [] },
    );
    const create = vi
      .spyOn(publicReviewsApi, 'createComment')
      .mockImplementation((id) =>
        id === 11 ? first.promise : Promise.resolve({ insightId: 12, comments: [] }),
      );
    renderPanel();
    await screen.findByText('My comment');
    const cards = screen.getAllByTestId('public-review-card').map((card) => within(card));
    await waitFor(() =>
      expect(cards[1].getByTestId('public-review-comment-input')).not.toBeDisabled(),
    );
    fireEvent.change(cards[0].getByTestId('public-review-comment-input'), {
      target: { value: 'First' },
    });
    fireEvent.change(cards[1].getByTestId('public-review-comment-input'), {
      target: { value: 'Second' },
    });
    fireEvent.submit(cards[0].getByTestId('public-review-comment-form'));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(cards[1].getByTestId('public-review-comment-submit')).not.toBeDisabled();
    fireEvent.submit(cards[1].getByTestId('public-review-comment-form'));
    await waitFor(() =>
      expect(cards[1].getByTestId('public-review-comment-input')).toHaveValue(''),
    );
    expect(cards[0].getByTestId('public-review-comment-input')).toHaveValue('First');
    await act(async () => first.resolve(thread));
    await waitFor(() =>
      expect(cards[0].getByTestId('public-review-comment-input')).toHaveValue(''),
    );
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('maps a failed reply to Korean copy without losing its draft', async () => {
    localStorage.setItem('margins.locale', 'ko');
    vi.spyOn(publicReviewsApi, 'createComment').mockRejectedValue(
      new Error('private provider detail'),
    );
    renderPanel();
    await ready();
    const input = screen.getAllByTestId('public-review-reply-input')[0];
    fireEvent.change(input, { target: { value: '답글 초안' } });
    fireEvent.submit(screen.getAllByTestId('public-review-reply-form')[0]);
    await screen.findByText('댓글을 저장하지 못했습니다.');
    expect(input).toHaveValue('답글 초안');
    expect(screen.queryByText('private provider detail')).not.toBeInTheDocument();
  });

  it.each(['comment', 'reply'] as const)(
    'serializes %s submissions, trims content and resets only that form',
    async (kind) => {
      const request = deferred<ReviewCommentListResponse>();
      const create = vi.spyOn(publicReviewsApi, 'createComment').mockReturnValue(request.promise);
      renderPanel();
      await ready();
      const rootInput = screen.getByTestId('public-review-comment-input');
      const replyInput = screen.getAllByTestId('public-review-reply-input')[0];
      fireEvent.change(rootInput, { target: { value: '  Root draft  ' } });
      fireEvent.change(replyInput, { target: { value: '  Reply draft  ' } });
      const form =
        kind === 'comment'
          ? screen.getByTestId('public-review-comment-form')
          : screen.getAllByTestId('public-review-reply-form')[0];
      act(() => {
        fireEvent.submit(form);
        fireEvent.submit(form);
      });
      await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
      expect(create).toHaveBeenCalledWith(
        11,
        kind === 'comment' ? 'Root draft' : 'Reply draft',
        kind === 'reply' ? 5 : undefined,
      );
      expect(rootInput).toBeDisabled();
      const saved = {
        ...thread,
        comments: [
          ...thread.comments,
          {
            insightId: 11,
            commentId: 9,
            content: 'Saved response',
            ownedByCurrentReader: true,
            parentCommentId: kind === 'reply' ? 5 : undefined,
          },
        ],
      };
      vi.mocked(publicReviewsApi.comments).mockResolvedValue(saved);
      await act(async () => request.resolve(saved));
      await screen.findByText('Saved response');
      await waitFor(() => expect(kind === 'comment' ? rootInput : replyInput).toHaveValue(''));
      expect(kind === 'comment' ? replyInput : rootInput).toHaveValue(
        kind === 'comment' ? '  Reply draft  ' : '  Root draft  ',
      );
      if (kind === 'reply')
        expect(screen.getByText('Saved response').closest('article')).toHaveClass('ml-6');
    },
  );

  it('renders localized create failures, preserves the draft and permits a retry', async () => {
    const create = vi
      .spyOn(publicReviewsApi, 'createComment')
      .mockRejectedValueOnce(new Error('private backend detail'))
      .mockResolvedValueOnce(thread);
    renderPanel();
    await ready();
    const input = screen.getByTestId('public-review-comment-input');
    fireEvent.change(input, { target: { value: 'Retry me' } });
    fireEvent.submit(screen.getByTestId('public-review-comment-form'));
    await screen.findByText('Comment could not be saved.');
    expect(screen.queryByText('private backend detail')).not.toBeInTheDocument();
    expect(input).toHaveValue('Retry me');
    await waitFor(() => expect(input).not.toBeDisabled());
    fireEvent.submit(screen.getByTestId('public-review-comment-form'));
    await waitFor(() => expect(input).toHaveValue(''));
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('keeps a committed response if follow-up GET fails instead of encouraging a duplicate write', async () => {
    const saved = {
      ...thread,
      comments: [
        ...thread.comments,
        {
          insightId: 11,
          commentId: 9,
          content: 'Committed comment',
          ownedByCurrentReader: true,
        },
      ],
    };
    const create = vi.spyOn(publicReviewsApi, 'createComment').mockResolvedValue(saved);
    renderPanel();
    await ready();
    vi.mocked(publicReviewsApi.comments).mockRejectedValueOnce(new Error('read unavailable'));
    fireEvent.change(screen.getByTestId('public-review-comment-input'), {
      target: { value: 'Committed comment' },
    });
    fireEvent.submit(screen.getByTestId('public-review-comment-form'));
    await screen.findByText('Comments could not be loaded.');
    expect(screen.getByText('Committed comment')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('public-review-comment-input')).toHaveValue(''));
    expect(create).toHaveBeenCalledOnce();
  });

  it('serializes edit requests, retains failed text and closes only after a successful retry', async () => {
    const request = deferred<ReviewCommentListResponse>();
    const update = vi
      .spyOn(publicReviewsApi, 'updateComment')
      .mockReturnValueOnce(request.promise)
      .mockResolvedValueOnce(thread);
    renderPanel();
    await ready();
    fireEvent.click(screen.getByTestId('public-review-comment-edit'));
    fireEvent.change(screen.getByTestId('public-review-comment-edit-input'), {
      target: { value: '  Edited draft  ' },
    });
    act(() => {
      fireEvent.submit(screen.getByTestId('public-review-comment-edit-form'));
      fireEvent.submit(screen.getByTestId('public-review-comment-edit-form'));
    });
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenCalledWith(11, 5, 'Edited draft');
    await act(async () => request.reject(new Error('private update detail')));
    await screen.findByText('Comment could not be updated.');
    expect(screen.getByTestId('public-review-comment-edit-input')).toHaveValue('  Edited draft  ');
    fireEvent.submit(screen.getByTestId('public-review-comment-edit-form'));
    await waitFor(() =>
      expect(screen.queryByTestId('public-review-comment-edit-form')).not.toBeInTheDocument(),
    );
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('awaits deletion, keeps failure visible in the confirmation and supports retry', async () => {
    const request = deferred<ReviewCommentListResponse>();
    const remove = vi
      .spyOn(publicReviewsApi, 'deleteComment')
      .mockReturnValueOnce(request.promise)
      .mockResolvedValueOnce({ insightId: 11, comments: [] });
    renderPanel();
    await ready();
    fireEvent.click(screen.getByTestId('public-review-comment-delete'));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    await waitFor(() => expect(remove).toHaveBeenCalledOnce());
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
    ).toBeDisabled();
    await act(async () => request.reject(new Error('private delete detail')));
    await waitFor(() =>
      expect(screen.getByRole('alertdialog')).toHaveTextContent('Comment could not be deleted.'),
    );
    vi.mocked(publicReviewsApi.comments).mockResolvedValue({ insightId: 11, comments: [] });
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.queryByText('My comment')).not.toBeInTheDocument();
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it('never mutates on delete cancel and hides controls for other readers', async () => {
    const remove = vi.spyOn(publicReviewsApi, 'deleteComment');
    renderPanel();
    await ready();
    const other = screen.getByText('Other reader').closest('article')!;
    expect(within(other).queryByTestId('public-review-comment-edit')).not.toBeInTheDocument();
    expect(within(other).queryByTestId('public-review-comment-delete')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('public-review-comment-delete'));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
    );
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('public-review-book-link'));
    expect(screen.getByTestId('location')).toHaveTextContent('/book/7');
  });

  it('keeps the same forms and all dirty values during background list and comments refresh', async () => {
    const list = deferred<{ reviews: PublicReview[] }>();
    const comments = deferred<ReviewCommentListResponse>();
    renderPanel();
    await ready();
    const root = screen.getByTestId('public-review-comment-input');
    const reply = screen.getAllByTestId('public-review-reply-input')[0];
    fireEvent.change(root, { target: { value: 'Root stays' } });
    fireEvent.change(reply, { target: { value: 'Reply stays' } });
    fireEvent.click(screen.getByTestId('public-review-comment-edit'));
    const edit = screen.getByTestId('public-review-comment-edit-input');
    fireEvent.change(edit, { target: { value: 'Edit stays' } });
    vi.mocked(publicReviewsApi.list).mockReturnValueOnce(list.promise);
    fireEvent.click(screen.getByTestId('public-reviews-refresh'));
    await waitFor(() => expect(publicReviewsApi.list).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('public-review-comment-input')).toBe(root);
    await act(async () => list.resolve({ reviews: [{ ...review, title: 'Refreshed title' }] }));
    vi.mocked(publicReviewsApi.comments).mockReturnValueOnce(comments.promise);
    fireEvent.click(screen.getByTestId('public-review-comments-refresh'));
    await act(async () => comments.resolve(thread));
    expect(root).toHaveValue('Root stays');
    expect(reply).toHaveValue('Reply stays');
    expect(edit).toHaveValue('Edit stays');
  });

  it('does not reset a form or apply a response when the authenticated lifetime has ended', async () => {
    let active = true;
    const request = deferred<ReviewCommentListResponse>();
    vi.spyOn(publicReviewsApi, 'createComment').mockReturnValue(request.promise);
    const { client } = renderPanel(() => active);
    await ready();
    const input = screen.getByTestId('public-review-comment-input');
    fireEvent.change(input, { target: { value: 'Old session draft' } });
    fireEvent.submit(screen.getByTestId('public-review-comment-form'));
    await waitFor(() => expect(publicReviewsApi.createComment).toHaveBeenCalledOnce());
    active = false;
    await act(async () => request.resolve({ insightId: 11, comments: [] }));
    await waitFor(() => expect(input).not.toBeDisabled());
    expect(input).toHaveValue('Old session draft');
    expect(client.getQueryData(publicReviewKeys.comments(11))).toEqual(thread);
    expect(publicReviewsApi.comments).toHaveBeenCalledOnce();
  });
});
