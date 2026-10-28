import { act, renderHook } from '@testing-library/react-native';

import { brandedLaunchMinimumMs, useBrandedLaunch } from './use-branded-launch';

describe('useBrandedLaunch', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('prevents a cold-start flash but never hides an unfinished restore', async () => {
    const hook = await renderHook(
      ({ restoring }: { restoring: boolean }) => useBrandedLaunch(restoring),
      { initialProps: { restoring: true } },
    );

    expect(hook.result.current).toBe(true);
    await hook.rerender({ restoring: false });
    expect(hook.result.current).toBe(true);

    await act(async () => jest.advanceTimersByTime(brandedLaunchMinimumMs));
    expect(hook.result.current).toBe(false);

    await hook.rerender({ restoring: true });
    expect(hook.result.current).toBe(true);
  });

  it('does not delay a later non-restoring mount', async () => {
    const hook = await renderHook(() => useBrandedLaunch(false));

    expect(hook.result.current).toBe(false);
  });
});
