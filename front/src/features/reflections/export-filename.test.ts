import { describe, expect, it } from 'vitest';
import { markdownFilename, slugifyFilename } from './export-filename';

describe('export filename helpers', () => {
  it('keeps existing ASCII-friendly slugs stable', () => {
    expect(markdownFilename('Dune opening ritual notes', 'transcript')).toBe(
      'dune-opening-ritual-notes-transcript.md',
    );
  });

  it('preserves non-Latin book titles instead of falling back to session', () => {
    expect(markdownFilename('채식주의자 독서 노트', 'review')).toBe(
      '채식주의자-독서-노트-review.md',
    );
  });

  it('collapses punctuation and falls back for symbol-only titles', () => {
    expect(slugifyFilename('  Dune: Part #1 / notes!  ')).toBe('dune-part-1-notes');
    expect(markdownFilename('***', 'review')).toBe('session-review.md');
  });
});
