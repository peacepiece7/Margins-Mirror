import { normalizeApiBaseUrl } from './config';

describe('normalizeApiBaseUrl', () => {
  it('normalizes a public API origin without a trailing slash', () => {
    expect(normalizeApiBaseUrl('https://api.margins.cloud/', false)).toBe(
      'https://api.margins.cloud',
    );
    expect(normalizeApiBaseUrl('http://10.0.2.2:5813', true)).toBe(
      'http://10.0.2.2:5813',
    );
  });

  it.each([
    'ftp://api.margins.cloud',
    'https://reader:secret@api.margins.cloud',
    'https://api.margins.cloud/v1',
    'https://api.margins.cloud?token=public',
    'https://api.margins.cloud#configuration',
  ])('rejects a value that is not an origin: %s', (value) => {
    expect(() => normalizeApiBaseUrl(value, true)).toThrow();
  });

  it('requires HTTPS outside development', () => {
    expect(() => normalizeApiBaseUrl('http://api.margins.cloud', false)).toThrow(
      'Production API base URL must use HTTPS',
    );
  });
});
