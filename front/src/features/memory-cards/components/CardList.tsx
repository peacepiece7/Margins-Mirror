import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { MemoryCard } from '@/types/api/memory-card';
import { testAttr } from '@/utils/testAttrs';

interface CardListProps {
  cards: MemoryCard[];
  labels: { delete: string; edit: string; memorized: string; open: string };
  onDelete: (card: MemoryCard) => void;
  onEdit: (card: MemoryCard) => void;
  onMemorizedChange: (card: MemoryCard, memorized: boolean) => void;
  onOpen: (card: MemoryCard) => void;
  savingMemorizedCardIds: ReadonlySet<number>;
}

export function CardList({
  cards,
  labels,
  onDelete,
  onEdit,
  onMemorizedChange,
  onOpen,
  savingMemorizedCardIds,
}: CardListProps) {
  return (
    <section className="grid gap-3">
      {cards.map((card) => (
        <article
          className="grid gap-3 rounded border border-stone-300 bg-white p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start"
          key={card.cardId}
          {...testAttr('memory-card-card-row')}
        >
          <div className="min-w-0">
            <h3 className="break-words text-xl font-semibold">{card.frontText}</h3>
            <p className="break-words text-base text-stone-800">{card.backText}</p>
            {card.exampleText && (
              <p className="mt-2 break-words text-sm text-stone-600">{card.exampleText}</p>
            )}
            {card.memo && <p className="mt-1 break-words text-sm text-stone-500">{card.memo}</p>}
            <label className="mt-3 flex min-h-11 w-fit items-center gap-2 rounded border border-stone-300 px-3 py-2 text-sm font-medium">
              <Input
                checked={card.memorized}
                disabled={savingMemorizedCardIds.has(card.cardId)}
                onChange={(event) => onMemorizedChange(card, event.target.checked)}
                type="checkbox"
                {...testAttr('memory-card-memorized-toggle')}
              />
              {labels.memorized}
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex">
            <Button
              className="min-h-11 rounded border border-stone-300 bg-white px-3 py-2 text-sm font-medium"
              onClick={() => onOpen(card)}
              type="button"
            >
              {labels.open}
            </Button>
            <Button
              className="min-h-11 rounded border border-stone-300 bg-white px-3 py-2 text-sm font-medium"
              onClick={() => onEdit(card)}
              type="button"
            >
              {labels.edit}
            </Button>
            <Button
              className="min-h-11 rounded border border-stone-300 bg-white px-3 py-2 text-sm font-medium hover:border-red-700"
              onClick={() => onDelete(card)}
              type="button"
            >
              {labels.delete}
            </Button>
          </div>
        </article>
      ))}
    </section>
  );
}
