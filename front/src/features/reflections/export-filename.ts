export function slugifyFilename(value: string) {
  const slug = value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/(^-|-$)/g, '');

  return slug || 'session';
}

export function markdownFilename(title: string | undefined, suffix: string) {
  return `${slugifyFilename(title || 'session')}-${suffix}.md`;
}
