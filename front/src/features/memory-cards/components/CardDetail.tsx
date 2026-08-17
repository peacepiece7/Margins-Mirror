import { Card, CardContent } from '@/components/ui/card';
import type { MemoryCard } from '@/types/api/memory-card';
import { testAttr } from '@/utils/testAttrs';

export function CardDetail({ card }: { card: MemoryCard }) {
  return (
    <Card {...testAttr('memory-card-card-detail')}>
      <CardContent className="grid gap-2">
        <h3 className="break-words text-2xl font-semibold">{card.frontText}</h3>
        <p className="break-words text-lg">{card.backText}</p>
        {card.exampleText && (
          <p className="break-words text-sm text-muted-foreground">{card.exampleText}</p>
        )}
        {card.memo && <p className="break-words text-sm text-muted-foreground">{card.memo}</p>}
      </CardContent>
    </Card>
  );
}
