import { describe, expect, it } from 'vitest';
import type { SessionWindowTimeline } from '@/types/api/session';
import { resolveDebateWindowId } from './window-selection';

function debateWindow(windowId: number, title: string): SessionWindowTimeline {
  return {
    windowId,
    sessionId: 11,
    windowType: 'debate',
    title,
    position: windowId,
    status: 'open',
    personaIds: [],
  };
}

describe('resolveDebateWindowId', () => {
  const windows: SessionWindowTimeline[] = [
    {
      windowId: 21,
      sessionId: 11,
      windowType: 'question',
      title: 'Reflection Window',
      position: 1,
      status: 'open',
      personaIds: [],
    },
    debateWindow(31, 'Debate: First topic'),
    debateWindow(32, 'Debate: Second topic'),
  ];

  it('uses the active debate window when one is selected', () => {
    expect(resolveDebateWindowId(windows, { windowId: 31, windowType: 'debate' })).toBe(31);
  });

  it('falls back to the latest debate window when the active window is not debate', () => {
    expect(resolveDebateWindowId(windows, { windowId: 21, windowType: 'question' })).toBe(32);
  });

  it('returns the latest debate window when no active window is provided', () => {
    expect(resolveDebateWindowId(windows)).toBe(32);
  });

  it('returns undefined when no debate windows exist', () => {
    expect(
      resolveDebateWindowId([windows[0]], { windowId: 21, windowType: 'question' }),
    ).toBeUndefined();
  });
});
