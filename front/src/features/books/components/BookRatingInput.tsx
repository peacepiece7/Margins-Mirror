import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

interface BookRatingInputProps {
  disabled?: boolean;
  onChange: (rating?: number) => void;
  rating?: number;
  testId?: string;
}

function starFill(value: number, rating: number) {
  if (rating >= value) {
    return 'full';
  }
  if (rating >= value - 0.5) {
    return 'half';
  }
  return 'empty';
}

function StarShape({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="m12 2.25 3.01 6.1 6.73.98-4.87 4.75 1.15 6.7L12 17.61l-6.02 3.17 1.15-6.7-4.87-4.75 6.73-.98L12 2.25Z" />
    </svg>
  );
}

export function BookRatingInput({
  disabled = false,
  onChange,
  rating,
  testId = 'book-rating-input',
}: BookRatingInputProps) {
  const { t } = useI18n();
  const currentRating = rating ?? 0;

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" {...testAttr(testId)}>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((starValue) => {
          const fill = starFill(starValue, currentRating);

          return (
            <div className="relative h-7 w-7" key={starValue}>
              <StarShape className="pointer-events-none absolute inset-0 h-7 w-7 text-stone-300" />
              {fill !== 'empty' && (
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-y-0 left-0 overflow-hidden ${
                    fill === 'half' ? 'w-1/2' : 'w-full'
                  }`}
                  data-fill={fill}
                >
                  <StarShape className="h-7 w-7 max-w-none text-[var(--margins-gold)]" />
                </span>
              )}
              <Button
                aria-label={`${starValue - 0.5} stars`}
                className="absolute inset-y-0 left-0 h-auto w-1/2 bg-transparent p-0 hover:bg-transparent disabled:cursor-not-allowed"
                disabled={disabled}
                onClick={() => onChange(starValue - 0.5)}
                type="button"
                variant="ghost"
                {...testAttr(`${testId}-half-${starValue}`)}
              />
              <Button
                aria-label={`${starValue} stars`}
                className="absolute inset-y-0 right-0 h-auto w-1/2 bg-transparent p-0 hover:bg-transparent disabled:cursor-not-allowed"
                disabled={disabled}
                onClick={() => onChange(starValue)}
                type="button"
                variant="ghost"
                {...testAttr(`${testId}-full-${starValue}`)}
              />
            </div>
          );
        })}
      </div>
      <Button
        aria-label={t('shelfRatingClear')}
        className="size-7 rounded border border-stone-300 p-0 text-stone-600 disabled:opacity-50"
        disabled={disabled || rating === undefined}
        onClick={() => onChange(undefined)}
        type="button"
        {...testAttr(`${testId}-clear`)}
      >
        <X aria-hidden="true" className="size-4" />
      </Button>
    </div>
  );
}
