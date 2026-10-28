import { describe, expect, it } from 'vitest';
import { parseUpload } from './utils';

describe('memory-card upload boundary', () => {
  it('validates and normalizes the fields in one pass', () => {
    expect(
      parseUpload(
        JSON.stringify({
          cards: [{ frontText: ' wand ', backText: ' 지팡이 ', exampleText: null, memo: '  ' }],
        }),
      ),
    ).toEqual({
      cards: [{ frontText: 'wand', backText: '지팡이', exampleText: undefined, memo: undefined }],
    });
  });
  it.each([
    null,
    [],
    { cards: [] },
    { cards: [null] },
    { cards: [{ frontText: ' ', backText: 'meaning' }] },
    { cards: [{ frontText: 'word', backText: 'meaning', memo: 42 }] },
  ])('rejects malformed input before sending it: %j', (value) => {
    expect(() => parseUpload(JSON.stringify(value))).toThrow();
  });
  it.each([
    ['frontText', 200],
    ['backText', 500],
    ['exampleText', 1000],
    ['memo', 1000],
  ] as const)('retains the %s character limit', (field, limit) => {
    const card = { frontText: 'word', backText: 'meaning', [field]: 'a'.repeat(limit) };
    expect(() => parseUpload(JSON.stringify({ cards: [card] }))).not.toThrow();
    expect(() =>
      parseUpload(JSON.stringify({ cards: [{ ...card, [field]: 'a'.repeat(limit + 1) }] })),
    ).toThrow();
  });
  it('retains the 500-card limit', () => {
    const cards = Array.from({ length: 500 }, () => ({ frontText: 'word', backText: 'meaning' }));
    expect(parseUpload(JSON.stringify({ cards })).cards).toHaveLength(500);
    expect(() => parseUpload(JSON.stringify({ cards: [...cards, cards[0]] }))).toThrow();
  });
});
