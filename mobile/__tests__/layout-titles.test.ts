import { protectedStackTitles } from '@/app/(protected)/_layout';
import { publicStackTitles } from '@/app/(public)/_layout';

jest.mock('expo-router', () => ({ Stack: Object.assign(() => null, { Screen: () => null }) }));
jest.mock('@/shared/accessibility/use-reduced-motion', () => ({ useReducedMotion: () => true }));
jest.mock('@/shared/i18n/i18n-provider', () => ({ useI18n: () => ({ locale: 'en' }) }));

it('localizes public and protected stack titles in English and Korean', () => {
  expect(publicStackTitles('en')).toEqual(expect.objectContaining({ recovery: 'Account recovery', signup: 'Sign up' }));
  expect(publicStackTitles('ko')).toEqual(expect.objectContaining({ recovery: '계정 복구', signup: '회원가입' }));
  expect(protectedStackTitles('en')).toEqual(expect.objectContaining({ debate: 'Persona debate', reading: 'Reading workspace' }));
  expect(protectedStackTitles('ko')).toEqual(expect.objectContaining({ debate: '페르소나 토론', reading: '독서 작업실' }));
});
