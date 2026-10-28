import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import { I18nProvider, useI18n } from '@/lib/i18n';
import type { MemoryCard, MemoryCardGroup, MemoryCardListResponse } from '@/types/api/memory-card';

import { memoryCardsApi } from '../api';
import { MemoryCardApp } from './MemoryCardApp';

vi.mock('../api', () => ({
  memoryCardsApi: {
    groups: vi.fn(),
    group: vi.fn(),
    deleteCard: vi.fn(),
    deleteGroup: vi.fn(),
    createCard: vi.fn(),
    updateMemorized: vi.fn(),
  },
}));

const card: MemoryCard = {
  cardId: 11,
  groupId: 7,
  frontText: 'wand',
  backText: '지팡이',
  exampleText: 'He raised his wand.',
  memo: 'Fantasy vocabulary.',
  memorized: false,
  position: 1,
};

const group: MemoryCardGroup = {
  groupId: 7,
  title: 'Fantasy words',
  cardCount: 1,
  cards: [card],
};

const secondCard: MemoryCard = {
  cardId: 12,
  groupId: 7,
  frontText: 'cloak',
  backText: '망토',
  memorized: false,
  position: 2,
};

function LocaleSwitch() {
  const { locale, setLocale } = useI18n();
  return <button onClick={() => setLocale(locale === 'en' ? 'ko' : 'en')}>Switch locale</button>;
}

function renderMemoryCard(path: string) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <I18nProvider>
          <LocaleSwitch />
          <MemoryCardApp />
        </I18nProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MemoryCardApp', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('renders fixed copy in the selected Korean locale', async () => {
    window.localStorage.setItem('margins.locale', 'ko');
    vi.mocked(memoryCardsApi.groups).mockResolvedValue({ groups: [] });

    renderMemoryCard('/memory-card/groups');

    expect(await screen.findByRole('heading', { name: '단어 카드' })).toBeVisible();
    expect(screen.getByRole('main')).toHaveClass('blueprint-memory-workspace');
    expect(screen.queryByText('Memory Card')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '학습 시작' })).toBeDisabled();
    expect(screen.getByText('아직 단어 카드 그룹이 없습니다.')).toBeVisible();
  });

  it('relocalizes group and card controls while preserving the bulk draft', async () => {
    vi.mocked(memoryCardsApi.groups).mockResolvedValue({ groups: [group] });
    vi.mocked(memoryCardsApi.group).mockResolvedValue(group);
    renderMemoryCard('/memory-card/groups');
    const row = await screen.findByTestId('memory-card-group-row');
    expect(within(row).getByRole('button', { name: 'Open' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Switch locale' }));
    expect(within(row).getByRole('button', { name: '열기' })).toBeVisible();
    expect(within(row).getByRole('button', { name: '삭제' })).toBeVisible();
    fireEvent.click(within(row).getByRole('button', { name: '열기' }));
    const upload = await screen.findByTestId('memory-card-upload-text');
    fireEvent.change(upload, { target: { value: 'my JSON draft' } });
    expect(screen.getByTestId('memory-card-card-row')).toHaveTextContent('암기');
    fireEvent.change(screen.getByLabelText('영어 단어'), { target: { value: 'card draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Switch locale' }));
    expect(screen.getByTestId('memory-card-card-row')).toHaveTextContent('Memorized');
    expect(upload).toHaveValue('my JSON draft');
    expect(screen.getByLabelText('English front')).toHaveValue('card draft');
    expect(memoryCardsApi.createCard).not.toHaveBeenCalled();
  });

  it('relocalizes a revealed study card without moving or hiding it', async () => {
    const twoCardGroup = { ...group, cardCount: 2, cards: [card, secondCard] };
    vi.mocked(memoryCardsApi.groups).mockResolvedValue({ groups: [twoCardGroup] });
    vi.mocked(memoryCardsApi.group).mockResolvedValue(twoCardGroup);
    renderMemoryCard('/memory-card/groups/7/study');
    await screen.findByText('The meaning is hidden.');
    fireEvent.click(screen.getByTestId('memory-card-study-reveal'));
    fireEvent.click(screen.getByTestId('memory-card-study-next'));
    fireEvent.click(screen.getByTestId('memory-card-study-reveal'));
    fireEvent.click(screen.getByRole('button', { name: 'Switch locale' }));

    expect(screen.getByText('cloak')).toBeVisible();
    expect(screen.getByText('망토')).toBeVisible();
    expect(screen.getByTestId('memory-card-study-reveal')).toBeDisabled();
    expect(screen.getByTestId('memory-card-study-next')).toBeEnabled();
    expect(memoryCardsApi.updateMemorized).not.toHaveBeenCalled();
  });

  it('surfaces a group-list request failure instead of showing only an empty state', async () => {
    vi.mocked(memoryCardsApi.groups).mockRejectedValue(new Error('Group list failed'));

    renderMemoryCard('/memory-card/groups');

    expect(await screen.findByText('Memory cards could not be loaded.')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('Memory cards could not be loaded.');
  });

  it('refreshes the group list from its header and displays Query-owned refetch errors', async () => {
    vi.mocked(memoryCardsApi.groups)
      .mockResolvedValueOnce({ groups: [] })
      .mockRejectedValueOnce(new Error('private detail'));
    renderMemoryCard('/memory-card/groups');
    await screen.findByText('No memory-card groups yet.');
    fireEvent.click(screen.getByTestId('memory-card-group-list-nav'));
    expect(await screen.findByText('Memory cards could not be loaded.')).toBeVisible();
    expect(screen.queryByText('private detail')).not.toBeInTheDocument();
    expect(memoryCardsApi.groups).toHaveBeenCalledTimes(2);
  });

  it('persists a memorized check and updates study progress', async () => {
    let persistedGroup = group;
    let resolveUpdate!: (response: MemoryCardListResponse) => void;
    const updatePromise = new Promise<MemoryCardListResponse>((resolve) => {
      resolveUpdate = resolve;
    });
    vi.mocked(memoryCardsApi.groups).mockResolvedValue({ groups: [group] });
    vi.mocked(memoryCardsApi.group).mockImplementation(() => Promise.resolve(persistedGroup));
    vi.mocked(memoryCardsApi.updateMemorized).mockReturnValue(updatePromise);

    renderMemoryCard('/memory-card/groups/7/study');

    expect(await screen.findByText('The meaning is hidden.')).toBeVisible();
    fireEvent.click(screen.getByTestId('memory-card-study-memorized-toggle'));
    expect(screen.getByTestId('memory-card-study-memorized-toggle')).toBeChecked();
    expect(screen.getByTestId('memory-card-study-progress')).toHaveTextContent('1/1 memorized');

    await waitFor(() => expect(memoryCardsApi.updateMemorized).toHaveBeenCalledWith(11, true));
    const response = { groupId: 7, cards: [{ ...card, memorized: true }] };
    persistedGroup = { ...group, cardCount: response.cards.length, cards: response.cards };
    resolveUpdate(response);
    expect(await screen.findByText('Memorized state saved.')).toBeVisible();
    expect(screen.getByTestId('memory-card-study-progress')).toHaveTextContent('1/1 memorized');
    expect(screen.getByTestId('memory-card-study-memorized-toggle')).toBeChecked();
  });

  it('renders the study index and truthful summary while cycling cards', async () => {
    const twoCardGroup = { ...group, cardCount: 2, cards: [card, secondCard] };
    vi.mocked(memoryCardsApi.groups).mockResolvedValue({ groups: [twoCardGroup] });
    vi.mocked(memoryCardsApi.group).mockResolvedValue(twoCardGroup);

    renderMemoryCard('/memory-card/groups/7/study');

    expect(await screen.findByTestId('memory-card-study-layout')).toBeVisible();
    expect(screen.getByTestId('memory-card-group-index')).toContainElement(
      screen.getByRole('button', { name: /Fantasy words/ }),
    );
    expect(screen.getByRole('button', { name: /Fantasy words/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByTestId('memory-card-study-summary')).toHaveTextContent('Total cards2');
    expect(screen.getByTestId('memory-card-study-summary')).toHaveTextContent('Remaining2');
    expect(screen.getByTestId('memory-card-study-card')).toHaveTextContent('Card 1 of 2');

    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    expect(screen.getByText('지팡이')).toBeVisible();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('cloak')).toBeVisible();
    expect(screen.getByText('The meaning is hidden.')).toBeVisible();
    fireEvent.click(screen.getByTestId('memory-card-study-previous'));
    expect(screen.getByText('wand')).toBeVisible();
  });

  it('does not announce the cached group refetch as foreground processing', async () => {
    let groupCallCount = 0;
    let resolveRefetch!: (value: MemoryCardGroup) => void;
    let resolveUpdate!: (response: MemoryCardListResponse) => void;
    const refetchPromise = new Promise<MemoryCardGroup>((resolve) => {
      resolveRefetch = resolve;
    });
    const updatePromise = new Promise<MemoryCardListResponse>((resolve) => {
      resolveUpdate = resolve;
    });
    vi.mocked(memoryCardsApi.groups).mockResolvedValue({ groups: [group] });
    vi.mocked(memoryCardsApi.group).mockImplementation(() => {
      groupCallCount += 1;
      return groupCallCount === 1 ? Promise.resolve(group) : refetchPromise;
    });
    vi.mocked(memoryCardsApi.updateMemorized).mockReturnValue(updatePromise);

    renderMemoryCard('/memory-card/groups/7/study');
    expect(await screen.findByText('The meaning is hidden.')).toBeVisible();

    fireEvent.click(screen.getByTestId('memory-card-study-memorized-toggle'));
    await waitFor(() => expect(memoryCardsApi.updateMemorized).toHaveBeenCalledWith(11, true));
    resolveUpdate({ groupId: 7, cards: [{ ...card, memorized: true }] });

    await waitFor(() => expect(groupCallCount).toBe(2));
    expect(screen.getByTestId('memory-card-status')).toHaveTextContent('Memorized state saved.');
    expect(screen.queryByText('Processing memory cards...')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('memory-card-status')?.querySelector('[data-slot="spinner-inline"]'),
    ).not.toBeInTheDocument();

    resolveRefetch({ ...group, cards: [{ ...card, memorized: true }] });
  });

  it('rolls back an optimistic memorized check when persistence fails', async () => {
    vi.mocked(memoryCardsApi.groups).mockResolvedValue({ groups: [group] });
    vi.mocked(memoryCardsApi.group).mockResolvedValue(group);
    vi.mocked(memoryCardsApi.updateMemorized).mockRejectedValue(new Error('Memorized save failed'));

    renderMemoryCard('/memory-card/groups/7/study');

    expect(await screen.findByText('The meaning is hidden.')).toBeVisible();
    fireEvent.click(screen.getByTestId('memory-card-study-memorized-toggle'));

    expect(screen.getByTestId('memory-card-study-memorized-toggle')).toBeChecked();
    expect(await screen.findByText('Memorized state could not be saved.')).toBeVisible();
    expect(screen.getByTestId('memory-card-study-memorized-toggle')).not.toBeChecked();
    expect(screen.getByTestId('memory-card-study-progress')).toHaveTextContent('0/1 memorized');
  });

  it('shows existing group cards as editable upload JSON', async () => {
    vi.mocked(memoryCardsApi.groups).mockResolvedValue({ groups: [group] });
    vi.mocked(memoryCardsApi.group).mockResolvedValue(group);

    renderMemoryCard('/memory-card/groups/7');

    const textarea = await screen.findByTestId('memory-card-upload-text');
    expect(JSON.parse((textarea as HTMLTextAreaElement).value)).toEqual({
      cards: [
        {
          frontText: 'wand',
          backText: '지팡이',
          exampleText: 'He raised his wand.',
          memo: 'Fantasy vocabulary.',
        },
      ],
    });
    expect((textarea as HTMLTextAreaElement).value).not.toContain('cardId');
    expect((textarea as HTMLTextAreaElement).value).not.toContain('memorized');
  });

  it('keeps malformed bulk JSON validation inside the RHF upload field', async () => {
    vi.mocked(memoryCardsApi.groups).mockResolvedValue({ groups: [group] });
    vi.mocked(memoryCardsApi.group).mockResolvedValue(group);

    renderMemoryCard('/memory-card/groups/7');

    const textarea = (await screen.findByTestId('memory-card-upload-text')) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '{not valid json' } });
    fireEvent.click(screen.getByTestId('memory-card-upload-submit'));

    expect(await screen.findByText('The JSON file could not be validated.')).toBeVisible();
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText('The bulk upload could not be saved.')).not.toBeInTheDocument();
    expect(memoryCardsApi.updateMemorized).not.toHaveBeenCalled();
  });

  it('refreshes an untouched generated draft after a card is deleted', async () => {
    const twoCardGroup = { ...group, cardCount: 2, cards: [card, secondCard] };
    vi.mocked(memoryCardsApi.groups).mockResolvedValue({ groups: [twoCardGroup] });
    vi.mocked(memoryCardsApi.group).mockResolvedValue(twoCardGroup);
    vi.mocked(memoryCardsApi.deleteCard).mockResolvedValue({
      groupId: 7,
      cards: [secondCard],
    });

    renderMemoryCard('/memory-card/groups/7');

    const rows = await screen.findAllByTestId('memory-card-card-row');
    fireEvent.click(within(rows[0]).getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(memoryCardsApi.deleteCard).toHaveBeenCalledWith(11));
    const textarea = screen.getByTestId('memory-card-upload-text') as HTMLTextAreaElement;
    expect(JSON.parse(textarea.value).cards).toEqual([
      {
        frontText: 'cloak',
        backText: '망토',
        exampleText: '',
        memo: '',
      },
    ]);
  });

  it('preserves a user-edited draft after a card is deleted', async () => {
    const twoCardGroup = { ...group, cardCount: 2, cards: [card, secondCard] };
    const customDraft = JSON.stringify({
      cards: [{ frontText: 'custom', backText: '사용자 초안' }],
    });
    vi.mocked(memoryCardsApi.groups).mockResolvedValue({ groups: [twoCardGroup] });
    vi.mocked(memoryCardsApi.group).mockResolvedValue(twoCardGroup);
    vi.mocked(memoryCardsApi.deleteCard).mockResolvedValue({
      groupId: 7,
      cards: [secondCard],
    });

    renderMemoryCard('/memory-card/groups/7');

    const textarea = (await screen.findByTestId('memory-card-upload-text')) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: customDraft } });
    const rows = screen.getAllByTestId('memory-card-card-row');
    fireEvent.click(within(rows[0]).getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(memoryCardsApi.deleteCard).toHaveBeenCalledWith(11));
    expect(textarea).toHaveValue(customDraft);
  });

  it('keeps a failed card deletion open for retry without changing the draft', async () => {
    vi.mocked(memoryCardsApi.groups).mockResolvedValue({ groups: [group] });
    vi.mocked(memoryCardsApi.group).mockResolvedValue(group);
    vi.mocked(memoryCardsApi.deleteCard)
      .mockRejectedValueOnce(new Error('private server detail'))
      .mockResolvedValueOnce({ groupId: 7, cards: [] });
    renderMemoryCard('/memory-card/groups/7');
    const row = await screen.findByTestId('memory-card-card-row');
    const draft = screen.getByTestId('memory-card-upload-text') as HTMLTextAreaElement;
    fireEvent.change(draft, { target: { value: 'my draft' } });
    fireEvent.click(within(row).getByRole('button', { name: 'Delete' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    await waitFor(() => expect(memoryCardsApi.deleteCard).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeVisible());
    expect(draft).toHaveValue('my draft');
    expect(screen.queryByText('private server detail')).not.toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    await waitFor(() => expect(memoryCardsApi.deleteCard).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('keeps a failed group deletion open for retry with a localized error', async () => {
    vi.mocked(memoryCardsApi.groups).mockResolvedValue({ groups: [group] });
    vi.mocked(memoryCardsApi.deleteGroup)
      .mockRejectedValueOnce(new Error('private server detail'))
      .mockResolvedValueOnce({ groups: [] });
    renderMemoryCard('/memory-card/groups');
    const row = await screen.findByTestId('memory-card-group-row');
    fireEvent.click(within(row).getByRole('button', { name: 'Delete' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    expect(await screen.findByText('Group could not be deleted.')).toBeVisible();
    expect(screen.getByRole('alertdialog')).toBeVisible();
    expect(screen.queryByText('private server detail')).not.toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    await waitFor(() => expect(memoryCardsApi.deleteGroup).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.queryByTestId('memory-card-group-row')).not.toBeInTheDocument();
  });

  it('caps generated JSON at the 500-card upload limit', async () => {
    const cards = Array.from({ length: 501 }, (_, index): MemoryCard => ({
      cardId: index + 1,
      groupId: 7,
      frontText: `word-${index + 1}`,
      backText: `meaning-${index + 1}`,
      memorized: false,
      position: index + 1,
    }));
    const largeGroup = { ...group, cardCount: cards.length, cards };
    vi.mocked(memoryCardsApi.groups).mockResolvedValue({ groups: [largeGroup] });
    vi.mocked(memoryCardsApi.group).mockResolvedValue(largeGroup);

    renderMemoryCard('/memory-card/groups/7');

    const textarea = (await screen.findByTestId('memory-card-upload-text')) as HTMLTextAreaElement;
    const generatedCards = JSON.parse(textarea.value).cards;
    expect(generatedCards).toHaveLength(500);
    expect(generatedCards[499].frontText).toBe('word-500');
    expect(screen.getByTestId('memory-card-upload-limit-notice')).toHaveTextContent(
      'This group has 501 cards',
    );
  });

  it('does not apply an old group save to the group opened while it was pending', async () => {
    const otherGroup = {
      ...group,
      groupId: 8,
      title: 'Other words',
      cards: [{ ...secondCard, groupId: 8 }],
    };
    vi.mocked(memoryCardsApi.groups).mockResolvedValue({ groups: [group, otherGroup] });
    vi.mocked(memoryCardsApi.group).mockImplementation(async (id) =>
      id === 7 ? group : otherGroup,
    );
    let resolveSave!: (value: MemoryCardListResponse) => void;
    vi.mocked(memoryCardsApi.createCard).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );
    renderMemoryCard('/memory-card/groups/7');
    fireEvent.change(await screen.findByLabelText('English front'), {
      target: { value: 'new word' },
    });
    fireEvent.change(screen.getByLabelText(/^Meaning/), { target: { value: '새 단어' } });
    fireEvent.submit(screen.getByTestId('memory-card-card-form'));
    await waitFor(() => expect(memoryCardsApi.createCard).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: /Other words/ }));
    await screen.findByRole('heading', { name: 'Other words' });
    const upload = screen.getByTestId('memory-card-upload-text') as HTMLTextAreaElement;
    fireEvent.change(upload, { target: { value: 'group B draft' } });
    await act(async () => resolveSave({ groupId: 7, cards: [card] }));
    expect(screen.getByRole('heading', { name: 'Other words' })).toBeVisible();
    expect(upload).toHaveValue('group B draft');
    expect(screen.queryByText('Card added.')).not.toBeInTheDocument();
  });
});
