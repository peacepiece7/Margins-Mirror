UPDATE books
SET raw_metadata = JSON_SET(
  COALESCE(raw_metadata, JSON_OBJECT()),
  '$.aiProfile',
  JSON_OBJECT(
    'isbn', COALESCE(isbn, ''),
    'title', title,
    'author', COALESCE(author, ''),
    'publishedYear', published_year,
    'language', COALESCE(language_code, ''),
    'genre', JSON_ARRAY(),
    'mood', JSON_ARRAY(),
    'pace', 'unknown',
    'themes', JSON_ARRAY('reader-reflection'),
    'summaryShort', 'Saved book profile backfilled from current Margins book metadata.',
    'summaryLong', 'This profile is advisory context for AI discussion. Replies should prioritize persisted reader notes, questions, highlights, messages, and the current book columns.',
    'characters', JSON_ARRAY(),
    'discussionAngles', JSON_ARRAY(
      'literary perspective',
      'philosophical perspective',
      'psychological perspective',
      'historical and social perspective'
    ),
    'spoilerLevel', 'unknown',
    'source', JSON_OBJECT(
      'provider', COALESCE(source, 'ai'),
      'confidence', 'low'
    ),
    'generatedAt', 'schema-007-book-ai-profile-backfill',
    'reviewedByUser', false
  )
)
WHERE raw_metadata IS NULL
  OR JSON_EXTRACT(raw_metadata, '$.aiProfile') IS NULL
  OR COALESCE(JSON_UNQUOTE(JSON_EXTRACT(raw_metadata, '$.aiProfile.title')), '') <> title
  OR COALESCE(JSON_UNQUOTE(JSON_EXTRACT(raw_metadata, '$.aiProfile.author')), '') <> COALESCE(author, '')
  OR COALESCE(JSON_UNQUOTE(JSON_EXTRACT(raw_metadata, '$.aiProfile.isbn')), '') <> COALESCE(isbn, '')
  OR COALESCE(
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(raw_metadata, '$.aiProfile.publishedYear')), 'null') AS SIGNED),
    -2147483648
  ) <> COALESCE(published_year, -2147483648);
