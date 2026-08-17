import type { Locale } from '@/lib/i18n';
import type { Persona } from '@/types/api/persona';

const personaIconRules = [
  { icon: '🧠', keywords: ['psychological-counselor', 'counselor', '상담'] },
  { icon: '📰', keywords: ['journalist', '기자'] },
  { icon: '🍎', keywords: ['elementary-school-teacher', '초등'] },
  { icon: '🎓', keywords: ['college-student', '대학생'] },
  { icon: '👵', keywords: ['neighborhood-grandmother', '할머니'] },
  { icon: '🪖', keywords: ['soldier', '군인'] },
  { icon: '🏫', keywords: ['middle-school-teacher', '중학교'] },
  { icon: '⚖️', keywords: ['lawyer', '변호'] },
  { icon: '👨‍🏫', keywords: ['university-professor', '교수'] },
  { icon: '🩺', keywords: ['doctor', '의사'] },
  { icon: '💻', keywords: ['developer', '개발'] },
  { icon: '✍️', keywords: ['writer', '작가'] },
  { icon: '§', keywords: ['critic', '평론'] },
  { icon: '?', keywords: ['philosopher', '철학'] },
  { icon: 'Ψ', keywords: ['psychologist', '심리'] },
  { icon: '#', keywords: ['historian', '역사'] },
  { icon: '◎', keywords: ['sociologist', '사회'] },
  { icon: '✎', keywords: ['editor', '편집'] },
  { icon: '!', keywords: ['skeptical', '회의'] },
  { icon: '◆', keywords: ['facilitator', '진행'] },
] as const;

const seededPersonaLabels: Record<string, Record<Locale, { displayName: string; tone: string }>> = {
  'psychological-counselor': {
    en: { displayName: 'Psychological Counselor', tone: 'Emotion and psychology' },
    ko: { displayName: '심리상담사', tone: '감정과 심리' },
  },
  journalist: {
    en: { displayName: 'Journalist', tone: 'Context and intent' },
    ko: { displayName: '기자', tone: '맥락과 의도' },
  },
  'elementary-school-teacher': {
    en: { displayName: 'Elementary School Teacher', tone: 'Simple and warm explanation' },
    ko: { displayName: '초등학교 선생님', tone: '쉽고 따뜻한 설명' },
  },
  'college-student': {
    en: { displayName: 'College Student', tone: 'Peer questions and growth' },
    ko: { displayName: '대학생', tone: '또래의 질문과 성장' },
  },
  'neighborhood-grandmother': {
    en: { displayName: 'Neighborhood Grandmother', tone: 'Lived wisdom' },
    ko: { displayName: '옆집 할머니', tone: '생활감과 지혜' },
  },
  soldier: {
    en: { displayName: 'Soldier', tone: 'Duty and choice' },
    ko: { displayName: '군인', tone: '책임과 선택' },
  },
  'middle-school-teacher': {
    en: { displayName: 'Middle School Teacher', tone: 'Growth and conflict mediation' },
    ko: { displayName: '중학교 교사', tone: '성장과 갈등 조율' },
  },
  lawyer: {
    en: { displayName: 'Lawyer', tone: 'Argument and responsibility' },
    ko: { displayName: '변호사', tone: '논증과 책임' },
  },
  'university-professor': {
    en: { displayName: 'University Professor', tone: 'Concept and synthesis' },
    ko: { displayName: '대학교수', tone: '개념과 종합' },
  },
  doctor: {
    en: { displayName: 'Doctor', tone: 'Body and care' },
    ko: { displayName: '의사', tone: '몸과 돌봄' },
  },
  developer: {
    en: { displayName: 'Developer', tone: 'Structure and patterns' },
    ko: { displayName: '개발자', tone: '구조와 패턴' },
  },
  writer: {
    en: { displayName: 'Writer', tone: 'Style and expression' },
    ko: { displayName: '작가', tone: '문체와 표현' },
  },
  'literary-critic': {
    en: { displayName: 'Literary Critic', tone: 'Structure and symbol' },
    ko: { displayName: '문학평론가', tone: '구조와 상징' },
  },
  philosopher: {
    en: { displayName: 'Philosopher', tone: 'Ethics and meaning' },
    ko: { displayName: '철학자', tone: '윤리와 의미' },
  },
  psychologist: {
    en: { displayName: 'Psychologist', tone: 'Motivation and relationship' },
    ko: { displayName: '심리학자', tone: '동기와 관계' },
  },
  historian: {
    en: { displayName: 'Historian', tone: 'Time and context' },
    ko: { displayName: '역사가', tone: '시대와 맥락' },
  },
  sociologist: {
    en: { displayName: 'Sociologist', tone: 'Norms and groups' },
    ko: { displayName: '사회학자', tone: '규범과 집단' },
  },
  editor: {
    en: { displayName: 'Editor', tone: 'Structure and readability' },
    ko: { displayName: '편집자', tone: '구조와 가독성' },
  },
  'skeptical-reader': {
    en: { displayName: 'Skeptical Reader', tone: 'Evidence check' },
    ko: { displayName: '회의적인 독자', tone: '근거 점검' },
  },
  'book-club-facilitator': {
    en: { displayName: 'Book Club Facilitator', tone: 'Conversation flow' },
    ko: { displayName: '독서 모임 진행자', tone: '대화 진행' },
  },
};

const seededDisplayNameAliases = new Map(
  Object.entries(seededPersonaLabels).flatMap(([name, labels]) => [
    [labels.en.displayName.toLowerCase(), name],
    [labels.ko.displayName.toLowerCase(), name],
  ]),
);

export function debateTopicFromWindowTitle(title: string) {
  return title.replace(/^(Debate|토론): /, '');
}

export function personaIcon(persona?: Pick<Persona, 'displayName' | 'name'>) {
  const label = `${persona?.displayName || ''} ${persona?.name || ''}`.toLowerCase();
  const match = personaIconRules.find((rule) =>
    rule.keywords.some((keyword) => label.includes(keyword)),
  );

  if (match) {
    return match.icon;
  }

  const fallback = (persona?.displayName || persona?.name || '').trim();
  return fallback.charAt(0).toUpperCase() || '•';
}

function seededPersonaName(persona?: Pick<Persona, 'displayName' | 'name'>) {
  if (!persona) {
    return undefined;
  }

  if (persona.name && seededPersonaLabels[persona.name]) {
    return persona.name;
  }

  return seededDisplayNameAliases.get((persona.displayName || '').toLowerCase());
}

export function localizedPersonaDisplayName(
  persona: Pick<Persona, 'displayName' | 'name'> | undefined,
  locale: Locale,
) {
  const seededName = seededPersonaName(persona);
  if (seededName) {
    return seededPersonaLabels[seededName][locale].displayName;
  }

  return persona?.displayName || 'AI';
}

export function localizedPersonaTone(
  persona: Pick<Persona, 'displayName' | 'name' | 'tone'> | undefined,
  locale: Locale,
) {
  const seededName = seededPersonaName(persona);
  if (seededName) {
    return seededPersonaLabels[seededName][locale].tone;
  }

  return persona?.tone;
}
