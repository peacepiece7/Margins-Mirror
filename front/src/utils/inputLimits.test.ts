import { describe, expect, it } from 'vitest';
import {
  fitTextWithSuffix,
  inputLimits,
  isNonBlankWithinMaxLength,
  isWithinMaxLength,
} from './inputLimits';

describe('inputLimits', () => {
  it('matches backend column limits for user-facing session fields', () => {
    expect(inputLimits.readingSessionTitle).toBe(255);
    expect(inputLimits.sessionWindowType).toBe(40);
    expect(inputLimits.sessionWindowTitle).toBe(255);
    expect(inputLimits.sessionTag).toBe(80);
    expect(inputLimits.personaDisplayName).toBe(120);
  });

  it('validates non-blank values without trimming away overlong input', () => {
    expect(isNonBlankWithinMaxLength('  valid  ', 12)).toBe(true);
    expect(isNonBlankWithinMaxLength('   ', 12)).toBe(false);
    expect(isNonBlankWithinMaxLength('abcd', 3)).toBe(false);
    expect(isWithinMaxLength('abcd', 4)).toBe(true);
  });

  it('fits generated labels with a required suffix inside backend limits', () => {
    const title = fitTextWithSuffix(
      'a'.repeat(255),
      ' reflection',
      inputLimits.readingSessionTitle,
    );

    expect(title).toHaveLength(inputLimits.readingSessionTitle);
    expect(title.endsWith(' reflection')).toBe(true);
  });
});
