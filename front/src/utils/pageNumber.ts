export function parseOptionalPageNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (!/^\d+$/.test(trimmed)) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export function isOptionalPageNumberDraft(value: string) {
  return value.trim() === '' || parseOptionalPageNumber(value) !== undefined;
}
