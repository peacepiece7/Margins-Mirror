import type { CatalogField, CatalogFormat, CatalogSearchRequest } from '@/types/api/catalog';

const fields = new Set<CatalogField>(['ALL', 'TITLE', 'AUTHOR', 'ISBN']);
const languages = new Set<CatalogSearchRequest['language']>(['ALL', 'ko', 'en']);
const formats = new Set<CatalogFormat>(['ALL', 'PRINT', 'EBOOK', 'AUDIOBOOK']);
const ownedParameters = ['q', 'field', 'language', 'format'] as const;

export function normalizeCatalogQuery(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\p{Z}\s]+/gu, ' ')
    .trim();
}

export function isValidCatalogQuery(value: string): boolean {
  const nfkc = value.normalize('NFKC');
  return normalizeCatalogQuery(value).length > 0 && [...nfkc].length <= 200;
}

export function readCatalogSearchParams(params: URLSearchParams): CatalogSearchRequest {
  const field = params.get('field');
  const language = params.get('language');
  const format = params.get('format');
  return {
    query: params.get('q') ?? '',
    field: fields.has(field as CatalogField) ? (field as CatalogField) : 'ALL',
    language: languages.has(language as CatalogSearchRequest['language'])
      ? (language as CatalogSearchRequest['language'])
      : 'ALL',
    format: formats.has(format as CatalogFormat) ? (format as CatalogFormat) : 'ALL',
    limit: 20,
  };
}

export function writeCatalogSearchParams(
  current: URLSearchParams,
  request: CatalogSearchRequest,
): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const parameter of ownedParameters) next.delete(parameter);

  const query = normalizeCatalogQuery(request.query);
  if (query) next.set('q', query);
  if (request.field !== 'ALL') next.set('field', request.field);
  if (request.language !== 'ALL') next.set('language', request.language);
  if (request.format !== 'ALL') next.set('format', request.format);
  return next;
}
