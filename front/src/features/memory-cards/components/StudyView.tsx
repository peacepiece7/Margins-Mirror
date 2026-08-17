import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { MemoryCard } from '@/types/api/memory-card';
import { testAttr } from '@/utils/testAttrs';

import { StudyProgress } from './StudyProgress';

interface StudyViewProps {
  card: MemoryCard | undefined;
  labels: {
    backToGroup: string;
    meaningHidden: string;
    memorized: string;
    memorizedCount: string;
    nextCard: string;
    noCards: string;
    revealMeaning: string;
  };
  memorizedCount: number;
  onBack: () => void;
  onMemorizedChange: (card: MemoryCard, memorized: boolean) => void;
  onNext: () => void;
  onReveal: () => void;
  revealed: boolean;
  savingMemorizedCardIds: ReadonlySet<number>;
  totalCount: number;
}

export function StudyView({
  card,
  labels,
  memorizedCount,
  onBack,
  onMemorizedChange,
  onNext,
  onReveal,
  revealed,
  savingMemorizedCardIds,
  totalCount,
}: StudyViewProps) {
  return (
    <section className="grid min-h-[calc(100vh-9rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          className="min-h-11 rounded border border-stone-300 bg-white px-3 py-2 text-sm font-medium"
          onClick={onBack}
          type="button"
        >
          {labels.backToGroup}
        </Button>
        <StudyProgress label={`${memorizedCount}/${totalCount} ${labels.memorizedCount}`} />
      </div>
      <div className="grid place-items-center overflow-y-auto rounded border border-stone-300 bg-white p-4 text-center sm:p-5">
        {card ? (
          <div className="grid max-w-2xl gap-5">
            <p className="break-words font-display text-5xl font-semibold tracking-normal">
              {card.frontText}
            </p>
            {revealed ? (
              <div className="grid gap-3">
                <p className="break-words text-2xl font-semibold">{card.backText}</p>
                {card.exampleText && (
                  <p className="break-words text-base text-stone-600">{card.exampleText}</p>
                )}
              </div>
            ) : (
              <p className="text-base text-stone-500">{labels.meaningHidden}</p>
            )}
          </div>
        ) : (
          <p>{labels.noCards}</p>
        )}
      </div>
      <div className="sticky bottom-0 grid gap-2 bg-[var(--margins-bg)] pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 sm:grid-cols-3">
        <Button
          className="min-h-12 rounded bg-stone-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          disabled={!card || revealed}
          onClick={onReveal}
          type="button"
          {...testAttr('memory-card-study-reveal')}
        >
          {labels.revealMeaning}
        </Button>
        <label className="flex min-h-12 items-center justify-center gap-2 rounded border border-stone-300 bg-white px-4 py-3 text-sm font-semibold">
          <Input
            checked={card?.memorized ?? false}
            disabled={!card || savingMemorizedCardIds.has(card.cardId)}
            onChange={(event) => card && onMemorizedChange(card, event.target.checked)}
            type="checkbox"
            {...testAttr('memory-card-study-memorized-toggle')}
          />
          {labels.memorized}
        </label>
        <Button
          className="min-h-12 rounded border border-stone-300 bg-white px-4 py-3 text-sm font-semibold disabled:opacity-50"
          disabled={!card || !revealed}
          onClick={onNext}
          type="button"
          {...testAttr('memory-card-study-next')}
        >
          {labels.nextCard}
        </Button>
      </div>
    </section>
  );
}
