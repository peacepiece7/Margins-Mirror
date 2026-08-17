import { describe, expect, it } from 'vitest';
import { resolveInitialLocale, translationCatalog } from './i18n';

describe('translation catalog', () => {
  it('keeps English and Korean translation keys aligned', () => {
    expect(Object.keys(translationCatalog.ko).sort()).toEqual(
      Object.keys(translationCatalog.en).sort(),
    );
  });

  it('keeps all translation values populated', () => {
    Object.values(translationCatalog).forEach((messages) => {
      Object.entries(messages).forEach(([key, value]) => {
        expect(value, key).toBeTruthy();
      });
    });
  });

  it('keeps English product copy available', () => {
    expect(translationCatalog.en.loginSubtitle).toContain('private reading archive');
    expect(translationCatalog.en.deleteConfirm).toBe('Delete this item?');
    expect(translationCatalog.en.pageBookSearch).toBe('Discover');
    expect(translationCatalog.en.username).toBe('Username');
    expect(translationCatalog.en.password).toBe('Password');
    expect(translationCatalog.en.logout).toBe('Logout');
    expect(translationCatalog.en.bookSourceGoogleBooks).toBe('Google Books');
    expect(translationCatalog.ko.bookSourceGoogleBooks).toBe('Google 도서');
  });

  it('localizes shared alert feedback and confirmation copy', () => {
    expect(translationCatalog.en.bookAdded).toBe('The book was added.');
    expect(translationCatalog.ko.bookAdded).toBe('책이 추가되었습니다.');
    expect(translationCatalog.en.close).toBe('Close');
    expect(translationCatalog.ko.close).toBe('닫기');
    expect(translationCatalog.en.reflectionGuideRegenerateTitle).toBe(
      'Create a new guide with the same settings?',
    );
    expect(translationCatalog.ko.reflectionGuideRegenerateTitle).toBe(
      '같은 설정으로 새 발제안을 만들까요?',
    );
    expect(translationCatalog.en.reflectionGuideRegenerate).toBe('Regenerate with AI');
    expect(translationCatalog.ko.reflectionGuideRegenerate).toBe('AI로 다시 생성');
  });

  it('prefers a stored locale over the browser language', () => {
    expect(resolveInitialLocale('en', 'ko-KR')).toBe('en');
    expect(resolveInitialLocale('ko', 'en-US')).toBe('ko');
  });

  it('starts in Korean for a Korean browser without a stored locale', () => {
    expect(resolveInitialLocale(null, 'ko-KR')).toBe('ko');
  });

  it('starts in English for a non-Korean browser without a stored locale', () => {
    expect(resolveInitialLocale(null, 'en-US')).toBe('en');
    expect(resolveInitialLocale(null, 'ja-JP')).toBe('en');
  });

  it('keeps Korean login controls in Korean', () => {
    expect(translationCatalog.ko.username).toBe('사용자 이름');
    expect(translationCatalog.ko.password).toBe('비밀번호');
    expect(translationCatalog.ko.logout).toBe('로그아웃');
    expect(translationCatalog.ko.loginAccountLocked).toBe(
      '비밀번호를 5회 잘못 입력하여 계정이 15분간 잠겼습니다.',
    );
    expect(translationCatalog.en.loginAccountLocked).toBe(
      'The password was entered incorrectly 5 times. This account is locked for 15 minutes.',
    );
  });

  it('translates memory-card titles, actions, and memorized state', () => {
    expect(translationCatalog.en.memoryCardTitle).toBe('Memory Cards');
    expect(translationCatalog.en.memoryCardStartStudy).toBe('Start study');
    expect(translationCatalog.en.memoryCardMemorized).toBe('Memorized');
    expect(translationCatalog.ko.memoryCardTitle).toBe('단어 카드');
    expect(translationCatalog.ko.memoryCardStartStudy).toBe('학습 시작');
    expect(translationCatalog.ko.memoryCardMemorized).toBe('암기 완료');
  });

  it('translates account management and recovery workflows', () => {
    expect(translationCatalog.en.accountTitle).toBe('Account');
    expect(translationCatalog.en.accountAuthProviderLocal).toBe('Email and password');
    expect(translationCatalog.en.recoveryActionRestore).toBe('Restore account');
    expect(translationCatalog.ko.accountTitle).toBe('회원정보');
    expect(translationCatalog.ko.accountAuthProviderLocal).toBe('이메일과 비밀번호');
    expect(translationCatalog.ko.recoveryActionRestore).toBe('계정 복구');
  });

  it('translates privacy, required consent, and AI transfer notices', () => {
    expect(translationCatalog.en.privacyPolicyTitle).toBe('Privacy Policy');
    expect(translationCatalog.en.consentTitle).toBe('Required consent');
    expect(translationCatalog.en.aiActionDebate).toBe('Persona debate');
    expect(translationCatalog.ko.privacyPolicyTitle).toBe('개인정보처리방침');
    expect(translationCatalog.ko.consentTitle).toBe('필수 동의 확인');
    expect(translationCatalog.ko.aiActionDebate).toBe('페르소나 토론');
  });
});
