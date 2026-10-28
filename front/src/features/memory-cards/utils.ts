import type { MemoryCard } from '@/types/api/memory-card';
import type { ParsedMemoryCardUpload } from './types';

export const MAX_MEMORY_CARD_UPLOAD_SIZE = 500;

export const templateJson = JSON.stringify(
  {
    cards: [
      {
        frontText: 'wand',
        backText: '지팡이',
        exampleText: 'He raised his wand.',
        memo: 'Common fantasy vocabulary.',
      },
      {
        frontText: 'cloak',
        backText: '망토',
        exampleText: 'She wore a long black cloak.',
        memo: '',
      },
    ],
  },
  null,
  2,
);

export function cardsJson(cards: MemoryCard[]) {
  return JSON.stringify(
    {
      cards: cards.slice(0, MAX_MEMORY_CARD_UPLOAD_SIZE).map((card) => ({
        frontText: card.frontText,
        backText: card.backText,
        exampleText: card.exampleText ?? '',
        memo: card.memo ?? '',
      })),
    },
    null,
    2,
  );
}

export function displayDate(value: string | undefined, locale: 'en' | 'ko') {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US');
}

export function interpolate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replace(`{${key}}`, String(value)),
    template,
  );
}

export function downloadTemplate() {
  const blob = new Blob([templateJson], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'memory-card-template.json';
  anchor.click();
  URL.revokeObjectURL(url);
}

export function parseUpload(value: string): ParsedMemoryCardUpload {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('JSON root must be an object');
  }
  const cards = (parsed as { cards?: unknown }).cards;
  if (!Array.isArray(cards) || cards.length === 0) {
    throw new Error('cards is required');
  }
  if (cards.length > MAX_MEMORY_CARD_UPLOAD_SIZE) {
    throw new Error(`cards must contain 1 to ${MAX_MEMORY_CARD_UPLOAD_SIZE} items`);
  }
  return {
    cards: cards.map((card, index) => {
      if (!card || typeof card !== 'object' || Array.isArray(card))
        throw new Error(`cards[${index}] must be an object`);
      const candidate = card as Record<string, unknown>;
      const fields = { frontText: '', backText: '', exampleText: '', memo: '' };
      for (const [field, limit, required] of [
        ['frontText', 200, true],
        ['backText', 500, true],
        ['exampleText', 1000, false],
        ['memo', 1000, false],
      ] as const) {
        const raw = candidate[field];
        if (raw != null && typeof raw !== 'string')
          throw new Error(`cards[${index}].${field} must be a string`);
        const text = typeof raw === 'string' ? raw.trim() : '';
        if (required && !text) throw new Error(`cards[${index}].${field} is required`);
        if (text.length > limit)
          throw new Error(`cards[${index}].${field} must be ${limit} characters or less`);
        fields[field] = text;
      }
      return {
        ...fields,
        exampleText: fields.exampleText || undefined,
        memo: fields.memo || undefined,
      };
    }),
  };
}

export function duplicateCount(cards: MemoryCard[], upload: ParsedMemoryCardUpload | undefined) {
  if (!upload) {
    return 0;
  }
  const existing = new Set(cards.map((card) => card.frontText.trim().toLowerCase()));
  return upload.cards.filter((card) => existing.has(card.frontText.trim().toLowerCase())).length;
}
