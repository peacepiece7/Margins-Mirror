import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteJson, getJson, patchJson, postJson } from '@/lib/api-client';

import { memoryCardsApi } from './api';

vi.mock('@/lib/api-client', () => ({
  deleteJson: vi.fn(),
  getJson: vi.fn(),
  patchJson: vi.fn(),
  postJson: vi.fn(),
}));

describe('memoryCardsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads a group from its feature endpoint', async () => {
    vi.mocked(getJson).mockResolvedValue({
      groupId: 7,
      title: 'Fantasy words',
      cardCount: 0,
    });

    await memoryCardsApi.group(7);

    expect(getJson).toHaveBeenCalledWith('/api/memory-card-groups/7');
  });

  it('sends bulk card DTOs without mutating workflow state', async () => {
    const request = {
      duplicatePolicy: 'replace' as const,
      cards: [{ frontText: 'wand', backText: '지팡이' }],
    };
    vi.mocked(postJson).mockResolvedValue({ groupId: 7, cards: [] });

    await memoryCardsApi.bulkCards(7, request);

    expect(postJson).toHaveBeenCalledWith('/api/memory-card-groups/7/cards/bulk', request);
  });

  it('updates memorized state through the dedicated endpoint', async () => {
    vi.mocked(patchJson).mockResolvedValue({ groupId: 7, cards: [] });

    await memoryCardsApi.updateMemorized(11, true);

    expect(patchJson).toHaveBeenCalledWith('/api/memory-cards/11/memorized', {
      memorized: true,
    });
  });

  it('deletes a card through the card endpoint', async () => {
    vi.mocked(deleteJson).mockResolvedValue({ groupId: 7, cards: [] });

    await memoryCardsApi.deleteCard(11);

    expect(deleteJson).toHaveBeenCalledWith('/api/memory-cards/11');
  });
});
