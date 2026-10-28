import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useOptimisticMessage } from './use-optimistic-message';

describe('useOptimisticMessage', () => {
  afterEach(cleanup);
  it('retains repeated content until a new saved user message arrives', () => {
    const oldMessage = { messageId: 1, role: 'user', content: 'same thought' };
    const { result, rerender } = renderHook(({ messages }) => useOptimisticMessage(messages), {
      initialProps: { messages: [oldMessage] },
    });
    act(() => result.current.begin('same thought'));
    expect(result.current.message?.content).toBe('same thought');
    const temporaryId = result.current.message?.messageId;
    rerender({
      messages: [oldMessage, { messageId: 2, role: 'assistant', content: 'same thought' }],
    });
    expect(result.current.message?.messageId).toBe(temporaryId);
    rerender({
      messages: [oldMessage, { messageId: 3, role: 'user', content: 'different thought' }],
    });
    expect(result.current.message?.messageId).toBe(temporaryId);
    rerender({ messages: [oldMessage, { messageId: 4, role: 'user', content: 'same thought' }] });
    expect(result.current.message).toBeUndefined();
  });

  it('clears a failed attempt and gives the retry a distinct temporary id', () => {
    const { result } = renderHook(() => useOptimisticMessage([]));
    act(() => result.current.begin('first attempt'));
    const firstId = result.current.message?.messageId;
    act(() => result.current.clear());
    expect(result.current.message).toBeUndefined();
    act(() => result.current.begin('first attempt'));
    expect(result.current.message?.messageId).not.toBe(firstId);
  });
});
