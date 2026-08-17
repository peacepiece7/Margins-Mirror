import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authJson, getJson, patchJson, postJson } from '@/lib/api-client';
import { accountApi } from './api';

vi.mock('@/lib/api-client', () => ({
  authJson: vi.fn(),
  getJson: vi.fn(),
  patchJson: vi.fn(),
  postJson: vi.fn(),
}));

describe('accountApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps authenticated profile calls in the account feature', async () => {
    vi.mocked(getJson).mockResolvedValue({});
    vi.mocked(patchJson).mockResolvedValue({ account: {} });
    await accountApi.get();
    await accountApi.updateProfile({ displayName: 'Reader' });
    expect(getJson).toHaveBeenCalledWith('/api/account');
    expect(patchJson).toHaveBeenCalledWith('/api/account/profile', {
      displayName: 'Reader',
    });
  });

  it('uses public auth transport for recovery without bearer state', async () => {
    vi.mocked(authJson).mockResolvedValue({ challengeId: 'challenge', expiresInSeconds: 300 });
    await accountApi.requestRecovery('reader@example.com');
    expect(authJson).toHaveBeenCalledWith({
      url: '/api/account/recovery/challenges',
      method: 'POST',
      data: { email: 'reader@example.com' },
    });
  });

  it('submits the one-time action token with the selected recovery action', async () => {
    vi.mocked(authJson).mockResolvedValue(undefined);
    await accountApi.recover('reader@example.com', 'opaque', 'ERASE_ALL_ACTIVITY');
    expect(authJson).toHaveBeenCalledWith({
      url: '/api/account/recovery',
      method: 'POST',
      data: {
        email: 'reader@example.com',
        actionToken: 'opaque',
        action: 'ERASE_ALL_ACTIVITY',
      },
    });
  });
});
