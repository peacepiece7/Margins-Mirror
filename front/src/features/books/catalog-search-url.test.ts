import { describe, expect, it } from 'vitest';
import {
  isValidCatalogQuery,
  normalizeCatalogQuery,
  readCatalogSearchParams,
  writeCatalogSearchParams,
} from './catalog-search-url';

describe('catalog search URL state', () => {
  it('round-trips Unicode queries and supported filters while preserving unrelated parameters', () => {
    const original = new URLSearchParams('source=mail&tag=a&tag=b');
    const next = writeCatalogSearchParams(original, {
      query: '  그리스   로마 신화 1권?  ',
      field: 'TITLE',
      language: 'ko',
      format: 'EBOOK',
    });

    expect(next.get('q')).toBe('그리스 로마 신화 1권?');
    expect(next.get('field')).toBe('TITLE');
    expect(next.get('language')).toBe('ko');
    expect(next.get('format')).toBe('EBOOK');
    expect(next.getAll('tag')).toEqual(['a', 'b']);
    expect(readCatalogSearchParams(new URLSearchParams(next.toString()))).toMatchObject({
      query: '그리스 로마 신화 1권?',
      field: 'TITLE',
      language: 'ko',
      format: 'EBOOK',
    });
    expect(original.has('q')).toBe(false);
  });

  it('omits default filters and safely defaults unsupported values', () => {
    const next = writeCatalogSearchParams(
      new URLSearchParams('q=old&field=INVALID&language=fr&format=INVALID&keep=yes'),
      { query: 'Dune', field: 'ALL', language: 'ALL', format: 'ALL' },
    );

    expect(next.toString()).toBe('keep=yes&q=Dune');
    expect(
      readCatalogSearchParams(
        new URLSearchParams('q=Dune&field=INVALID&language=fr&format=INVALID'),
      ),
    ).toMatchObject({ field: 'ALL', language: 'ALL', format: 'ALL' });
  });

  it('normalizes whitespace and applies the existing NFKC Unicode length boundary', () => {
    expect(normalizeCatalogQuery('  A　 B\nC  ')).toBe('A B C');
    expect(isValidCatalogQuery('　')).toBe(false);
    expect(isValidCatalogQuery('가'.repeat(200))).toBe(true);
    expect(isValidCatalogQuery('가'.repeat(201))).toBe(false);
  });
});
