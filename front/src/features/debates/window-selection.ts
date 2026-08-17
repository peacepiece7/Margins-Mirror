import type { SessionWindowTimeline } from '@/types/api/session';

interface ActiveWindow {
  windowId: number;
  windowType: string;
}

export function resolveDebateWindowId(
  windows: SessionWindowTimeline[],
  activeWindow?: ActiveWindow,
): number | undefined {
  if (activeWindow?.windowType === 'debate') {
    return activeWindow.windowId;
  }

  const debateWindows = windows.filter((window) => window.windowType === 'debate');
  return debateWindows[debateWindows.length - 1]?.windowId;
}
