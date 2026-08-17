import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('book Reflection feature flag paths', () => {
  beforeEach(() => vi.resetModules());

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('uses canonical Reflection paths when the rollout flag is enabled', async () => {
    vi.stubEnv('VITE_MARGINS_REFLECTION_LOOP_ENABLED', 'true');
    const { bookPath } = await import('./routes');
    expect(bookPath('review', { bookId: 42 })).toBe('/book/42/reflection');
    expect(bookPath('question-answer-editor', { bookId: 42, questionId: 9 })).toBe(
      '/book/42/reflection/interview',
    );
  });

  it('uses legacy review paths by default', async () => {
    const { bookPath } = await import('./routes');
    expect(bookPath('review', { bookId: 42 })).toBe('/book/42/review');
    expect(bookPath('review-editor', { bookId: 42, insightId: 7 })).toBe('/book/42/review/7/edit');
  });
});
