import { describe, expect, it } from 'vitest';
import { debateTopicFromWindowTitle, localizedPersonaDisplayName, personaIcon } from './display';

describe('debate display helpers', () => {
  it('parses current and legacy debate title prefixes', () => {
    expect(debateTopicFromWindowTitle('Debate: How does ritual shape authority?')).toBe(
      'How does ritual shape authority?',
    );
    expect(debateTopicFromWindowTitle('토론: 권력은 어떻게 만들어지는가?')).toBe(
      '권력은 어떻게 만들어지는가?',
    );
    expect(debateTopicFromWindowTitle('Open room')).toBe('Open room');
  });

  it('maps seed character persona labels to stable icons', () => {
    expect(personaIcon({ displayName: '심리상담사', name: 'psychological-counselor' })).toBe('🧠');
    expect(personaIcon({ displayName: '기자', name: 'journalist' })).toBe('📰');
    expect(personaIcon({ displayName: '초등학교 선생님', name: 'elementary-school-teacher' })).toBe(
      '🍎',
    );
    expect(personaIcon({ displayName: '개발자', name: 'developer' })).toBe('💻');
    expect(personaIcon({ displayName: '작가', name: 'writer' })).toBe('✍️');
    expect(personaIcon({ displayName: 'Custom Reader', name: 'reader-custom' })).toBe('C');
  });

  it('localizes seeded persona names while preserving custom names', () => {
    expect(
      localizedPersonaDisplayName(
        { displayName: '심리상담사', name: 'psychological-counselor' },
        'en',
      ),
    ).toBe('Psychological Counselor');
    expect(localizedPersonaDisplayName({ displayName: 'Developer', name: 'developer' }, 'ko')).toBe(
      '개발자',
    );
    expect(
      localizedPersonaDisplayName({ displayName: 'Close Reader', name: 'reader-custom' }, 'ko'),
    ).toBe('Close Reader');
  });
});
