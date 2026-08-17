import { Button } from '@/components/ui/button';
import { debateTopicFromWindowTitle } from '../display';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

import type { DebateRoomsPageProps } from '../panel-types';

export function DebateRoomsPage({
  currentWindowId,
  windows,
  onSelectWindow,
}: DebateRoomsPageProps) {
  const { t } = useI18n();

  return (
    <section className="grid gap-4" {...testAttr('debate-rooms-page')}>
      <div
        className="grid gap-3 rounded border border-stone-300 bg-white p-4 sm:p-5"
        {...testAttr('debate-window-list')}
      >
        <h2 className="text-xl font-semibold">{t('debateRooms')}</h2>
        {windows.map((window) => (
          <Button
            className={`min-w-0 max-w-full rounded border px-4 py-3 text-left text-sm ${
              currentWindowId === window.windowId
                ? 'border-stone-950 bg-stone-100'
                : 'border-stone-200 hover:border-stone-400'
            }`}
            key={window.windowId}
            onClick={() => onSelectWindow(window)}
            type="button"
            {...testAttr('debate-window-tab')}
          >
            <span className="block min-w-0 max-w-full truncate font-medium">
              {debateTopicFromWindowTitle(window.title)}
            </span>
            <span className="mt-1 block text-xs text-stone-500">Window #{window.windowId}</span>
          </Button>
        ))}
        {!windows.length && <div className="text-sm text-stone-500">{t('debateNoRooms')}</div>}
      </div>
    </section>
  );
}
