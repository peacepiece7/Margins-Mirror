import type { Locale } from '@/shared/i18n/messages';

const copy = {
  en: {
    bibliographic: 'Bibliographic',
    candidateId: 'Catalog ID',
    clearRating: 'Clear rating',
    debate: 'Debate',
    dismissSavedFeedback: 'Dismiss saved confirmation',
    editBook: 'Edit book',
    filterBooks: 'Filter by title or author',
    isbn: 'ISBN',
    language: 'Language',
    libraryCheckError: 'Your library could not be checked. Saving is disabled until it reloads.',
    libraryCheckPending: 'Checking your library before saving…',
    knowledgeFallback: 'Temporary fallback knowledge is in use.',
    knowledgeRefreshPending: 'A newer knowledge version is being prepared.',
    knowledgeStale: 'Cached knowledge is out of date.',
    knowledgeVersion: 'Knowledge version',
    alreadyInLibrary: 'Already in your library',
    chooseReadingStatus: 'Choose a shelf state',
    cover: 'cover',
    hideSavedBooks: 'Hide books already in my library',
    manualIsbn: 'ISBN (optional)',
    noNewCandidates: 'Every matching candidate is already in your library.',
    openInLibrary: 'Open in library',
    noFilteredBooks: 'No saved books match this filter.',
    openQuestions: 'Explore questions',
    openReflection: 'Write reflection',
    pages: 'Pages',
    publisher: 'Publisher',
    providerFallback: 'Catalog provider',
    providerGoogle: 'Google Books',
    providerOpenLibrary: 'Open Library',
    providerOpenAi: 'AI-assisted catalog',
    providerPlaceholder: 'Fallback catalog',
    publishedYear: 'Published',
    rating: 'Rating',
    searchPending: 'Searching catalog providers…',
    saveChanges: 'Save changes',
    workflowUnavailable: 'A reading session is not available for this book yet.',
    status: {
      dnf: 'Did not finish',
      read: 'Read',
      reading: 'Reading',
      want_to_read: 'Want to read',
    },
  },
  ko: {
    bibliographic: '서지정보',
    candidateId: '도서 목록 ID',
    clearRating: '별점 지우기',
    debate: '토론하기',
    dismissSavedFeedback: '저장 확인 닫기',
    editBook: '책 정보 수정',
    filterBooks: '제목 또는 저자로 필터링',
    isbn: 'ISBN',
    language: '언어',
    libraryCheckError: '내 책장을 확인하지 못했습니다. 다시 불러오기 전까지 저장할 수 없습니다.',
    libraryCheckPending: '저장하기 전에 내 책장을 확인하고 있어요…',
    knowledgeFallback: '임시 대체 배경 지식을 사용하고 있습니다.',
    knowledgeRefreshPending: '새 배경 지식 버전을 준비하고 있습니다.',
    knowledgeStale: '저장된 배경 지식이 오래되었습니다.',
    knowledgeVersion: '배경 지식 버전',
    alreadyInLibrary: '이미 내 책장에 있음',
    chooseReadingStatus: '책장 상태 선택',
    cover: '표지',
    hideSavedBooks: '이미 담은 책 숨기기',
    manualIsbn: 'ISBN (선택)',
    noNewCandidates: '검색된 후보가 모두 내 책장에 있습니다.',
    openInLibrary: '책장에서 열기',
    noFilteredBooks: '이 필터와 일치하는 저장된 책이 없습니다.',
    openQuestions: '질문 탐색하기',
    openReflection: '회고 쓰기',
    pages: '쪽수',
    publisher: '출판사',
    providerFallback: '도서 제공처',
    providerGoogle: 'Google 도서',
    providerOpenLibrary: 'Open Library',
    providerOpenAi: 'AI 보조 도서 목록',
    providerPlaceholder: '대체 도서 목록',
    publishedYear: '출간연도',
    rating: '별점',
    searchPending: '도서 제공처를 검색하고 있어요…',
    saveChanges: '변경사항 저장',
    workflowUnavailable: '이 책의 독서 세션이 아직 준비되지 않았습니다.',
    status: {
      dnf: '중단함',
      read: '다 읽음',
      reading: '읽는 중',
      want_to_read: '읽고 싶은 책',
    },
  },
} as const;

export function booksCopy(locale: Locale) {
  return copy[locale];
}

export function candidateProviderLabel(candidateId: string, locale: Locale) {
  const c = booksCopy(locale);
  if (candidateId.startsWith('google:')) return c.providerGoogle;
  if (candidateId.startsWith('openlibrary:')) return c.providerOpenLibrary;
  if (candidateId.startsWith('openai-')) return c.providerOpenAi;
  if (candidateId.startsWith('placeholder-')) return c.providerPlaceholder;
  return c.providerFallback;
}

export function candidateSummaryLabel(
  candidateIds: string[],
  locale: Locale,
  totalCount = candidateIds.length,
) {
  const countLabel = locale === 'ko'
    ? `검색 후보 ${totalCount}권`
    : `${totalCount} ${totalCount === 1 ? 'candidate' : 'candidates'}`;
  const providers = candidateIds
    .map((candidateId) => candidateProviderLabel(candidateId, locale))
    .filter((provider, index, allProviders) => allProviders.indexOf(provider) === index);

  return [countLabel, ...providers].join(' · ');
}
