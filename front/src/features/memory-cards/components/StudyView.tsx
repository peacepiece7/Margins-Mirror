import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useI18n } from '@/lib/i18n';
import type { MemoryCard } from '@/types/api/memory-card';
import { testAttr } from '@/utils/testAttrs';

interface StudyViewProps {
  card: MemoryCard | undefined;
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
  onMemorizedChange,
  onNext,
  onPrevious,
  onReveal,
  revealed,
  savingMemorizedCardIds,
  totalCount,
}: StudyViewProps) {
  const { t } = useI18n();
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

  const position = t('memoryCardPosition')
    .replace('{current}', String(totalCount ? currentIndex + 1 : 0))
    .replace('{total}', String(totalCount));

  return (
    <section className="web-memory-study-card" {...testAttr('memory-card-study-card')}>
      <header>
        <span>{position}</span>
        <small>{t('memoryCardKeyboardHint')}</small>
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
              <p className="text-base text-stone-500">{t('memoryCardMeaningHidden')}</p>
            )}
          </div>
        ) : (
          <p>{t('memoryCardNoStudyCards')}</p>
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
          {t('memoryCardPreviousCard')}
        </Button>
        <Button
          className="min-h-12 px-4 py-3 font-semibold"
          disabled={!card || revealed}
          onClick={onReveal}
          type="button"
          variant="default"
          {...testAttr('memory-card-study-reveal')}
        >
          {t('memoryCardRevealMeaning')}
        </Button>
        <label className="flex min-h-12 items-center justify-center gap-2 rounded border border-stone-300 bg-white px-4 py-3 text-sm font-semibold">
          <Checkbox
            checked={card?.memorized ?? false}
            disabled={!card || savingMemorizedCardIds.has(card.cardId)}
            onCheckedChange={(checked) => card && onMemorizedChange(card, checked === true)}
            {...testAttr('memory-card-study-memorized-toggle')}
          />
          {t('memoryCardMemorized')}
        </label>
        <Button
          className="min-h-12 px-4 py-3 font-semibold"
          disabled={!card || !revealed}
          onClick={onNext}
          type="button"
          variant="outline"
          {...testAttr('memory-card-study-next')}
        >
          {t('memoryCardNextCard')}
        </Button>
      </div>
    </section>
  );
}
