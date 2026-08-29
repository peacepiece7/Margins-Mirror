import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getJson, postJson } from '@/lib/api-client';

import { contactApi } from './api';

vi.mock('@/lib/api-client', () => ({ getJson: vi.fn(), postJson: vi.fn() }));

describe('contactApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads the authenticated account email without importing another feature', async () => {
    vi.mocked(getJson).mockResolvedValue({ email: 'reader@example.com' });
    await expect(contactApi.accountEmail()).resolves.toEqual({ email: 'reader@example.com' });
    expect(getJson).toHaveBeenCalledWith('/api/account');
  });

  it('posts the inquiry and purpose-bound bot token to the public endpoint', async () => {
    const request = {
      email: 'reader@example.com',
      category: 'BUG_REPORT' as const,
      subject: 'Broken page',
      message: 'The page does not load.',
      botChallengeToken: 'challenge-token',
    };
    vi.mocked(postJson).mockResolvedValue({
      inquiryId: 42,
      status: 'OPEN',
      createdAt: '2026-08-24T00:00:00Z',
    });
    await contactApi.submit(request);
    expect(postJson).toHaveBeenCalledWith('/api/contact-inquiries', request);
  });
});
