import { booksCopy, candidateSummaryLabel } from './copy';

it('localizes each Book Knowledge provenance state and its version label in EN and KO', () => {
  expect(booksCopy('en')).toEqual(expect.objectContaining({
    knowledgeFallback: 'Temporary fallback knowledge is in use.',
    knowledgeStale: 'Cached knowledge is out of date.',
    knowledgeVersion: 'Knowledge version',
  }));
  expect(booksCopy('ko')).toEqual(expect.objectContaining({
    knowledgeFallback: '임시 대체 배경 지식을 사용하고 있습니다.',
    knowledgeStale: '저장된 배경 지식이 오래되었습니다.',
    knowledgeVersion: '배경 지식 버전',
  }));
});

it('summarizes candidate count and unique catalog providers in the active locale', () => {
  expect(candidateSummaryLabel([
    'google:dune',
    'google:dune-messiah',
    'openlibrary:OL893415W',
  ], 'en')).toBe('3 candidates · Google Books · Open Library');
  expect(candidateSummaryLabel(['google:dune'], 'ko')).toBe('검색 후보 1권 · Google 도서');
});
