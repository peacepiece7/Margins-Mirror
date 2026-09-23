import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { MemoryCard } from '@/types/api/memory-card';
import { testAttr } from '@/utils/testAttrs';

interface StudyViewProps {
  card: MemoryCard | undefined;
  labels: {
    keyboardHint: string;
    meaningHidden: string;
    memorized: string;
    nextCard: string;
    noCards: string;
    position: string;
    previousCard: string;
    revealMeaning: string;
  };
  currentIndex: number;
  onMemorizedChange: (card: MemoryCard, memorized: boolean) => void;
  onNext: () => void;
  onPrevious: () => void;
  onReveal: () => void;
  revealed: boolean;
  savingMemorizedCardIds: ReadonlySet<number>;
  totalCount: number;
}

export function StudyView({
  card,
  currentIndex,
  labels,
  onMemorizedChange,
  onNext,
  onPrevious,
  onReveal,
  revealed,
  savingMemorizedCardIds,
  totalCount,
}: StudyViewProps) {
  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;
      if (!card) return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onPrevious();
      } else if (event.key === 'ArrowRight' && revealed) {
        event.preventDefault();
        onNext();
      } else if (event.code === 'Space' && !revealed) {
        event.preventDefault();
        onReveal();
      }
    }

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [card, onNext, onPrevious, onReveal, revealed]);

  const position = labels.position
    .replace('{current}', String(totalCount ? currentIndex + 1 : 0))
    .replace('{total}', String(totalCount));

  return (
    <section className="web-memory-study-card" {...testAttr('memory-card-study-card')}>
      <header>
        <span>{position}</span>
        <small>{labels.keyboardHint}</small>
      </header>
      <div className="web-memory-study-face">
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
      <div className="web-memory-study-actions">
        <Button
          className="min-h-12 px-4 py-3 font-semibold"
          disabled={!card}
          onClick={onPrevious}
          type="button"
          variant="outline"
          {...testAttr('memory-card-study-previous')}
        >
          {labels.previousCard}
        </Button>
        <Button
          className="min-h-12 px-4 py-3 font-semibold"
          disabled={!card || revealed}
          onClick={onReveal}
          type="button"
          variant="default"
          {...testAttr('memory-card-study-reveal')}
        >
          {labels.revealMeaning}
        </Button>
        <label className="flex min-h-12 items-center justify-center gap-2 rounded border border-stone-300 bg-white px-4 py-3 text-sm font-semibold">
          <Checkbox
            checked={card?.memorized ?? false}
            disabled={!card || savingMemorizedCardIds.has(card.cardId)}
            onCheckedChange={(checked) => card && onMemorizedChange(card, checked === true)}
            {...testAttr('memory-card-study-memorized-toggle')}
          />
          {labels.memorized}
        </label>
        <Button
          className="min-h-12 px-4 py-3 font-semibold"
          disabled={!card || !revealed}
          onClick={onNext}
          type="button"
          variant="outline"
          {...testAttr('memory-card-study-next')}
        >
          {labels.nextCard}
        </Button>
      </div>
    </section>
  );
}
