export const inputLimits = {
  readingSessionTitle: 255,
  readingSessionTitleEdit: 200,
  sessionWindowType: 40,
  sessionWindowTitle: 255,
  sessionWindowTitleEdit: 200,
  readingGoal: 500,
  progressNote: 2000,
  highlightLocation: 120,
  highlightQuote: 5000,
  highlightNote: 2000,
  sessionTag: 80,
  insightType: 60,
  insightTitle: 160,
  personaDisplayName: 120,
  personaTone: 120,
} as const;

export function isWithinMaxLength(value: string, maxLength: number) {
  return value.length <= maxLength;
}

export function isNonBlankWithinMaxLength(value: string, maxLength: number) {
  return value.trim().length > 0 && isWithinMaxLength(value, maxLength);
}

export function fitTextWithSuffix(value: string, suffix: string, maxLength: number) {
  if (value.length + suffix.length <= maxLength) {
    return `${value}${suffix}`;
  }

  if (suffix.length >= maxLength) {
    return suffix.slice(0, maxLength);
  }

  return `${value.slice(0, maxLength - suffix.length)}${suffix}`;
}
