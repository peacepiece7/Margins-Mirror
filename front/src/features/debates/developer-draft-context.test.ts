import { describe, expect, it } from 'vitest';
import { debateDeveloperDraftContext } from './developer-draft-context';

describe('debateDeveloperDraftContext', () => {
  it('bounds long inputs while keeping the latest eight turns and current draft', () => {
    const context = debateDeveloperDraftContext({
      draft: 'd'.repeat(10000),
      question: 'q'.repeat(3000),
      answer: 'a'.repeat(3000),
      messages: Array.from({ length: 20 }, (_, index) => ({
        id: String(index),
        sessionId: 1,
        windowId: 2,
        role: 'assistant',
        content: index === 19 ? 'LATEST TURN' : `OLD-${index}-${'x'.repeat(5000)}`,
      })),
    });
    expect(context.length).toBeLessThanOrEqual(8000);
    expect(context).toContain('LATEST TURN');
    expect(context).not.toContain('OLD-0-');
    expect(context).toContain(`Current reader draft: ${'d'.repeat(2000)}`);
  });
});
