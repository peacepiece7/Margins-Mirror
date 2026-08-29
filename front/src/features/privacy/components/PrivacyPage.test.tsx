import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { I18nProvider } from '@/lib/i18n';
import { PrivacyHistoryPage } from './PrivacyHistoryPage';
import { PrivacyPage } from './PrivacyPage';

describe('public privacy pages', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders the current policy and history without an authenticated provider', () => {
    window.localStorage.setItem('margins.locale', 'en');

    const { rerender } = render(
      <I18nProvider>
        <MemoryRouter>
          <PrivacyPage />
        </MemoryRouter>
      </I18nProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();
    expect(screen.getByText(/effective date: 2026-07-27/i)).toBeVisible();
    expect(screen.getByRole('link', { name: /history/i })).toHaveAttribute(
      'href',
      '/privacy/history',
    );
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact');
    expect(
      screen.getByText(/contact form collects the reply email, category, subject, and message/i),
    ).toBeVisible();
    expect(
      screen.getByText(/Resend processes the reply email, category, subject, and message/i),
    ).toBeVisible();
    expect(screen.getByText(/prevent automated contact and signup-email abuse/i)).toBeVisible();
    expect(
      screen.getByText(/within one year of receipt regardless of processing status/i),
    ).toBeVisible();
    expect(screen.getByText(/only redirected or rejected input/i)).toBeVisible();
    expect(screen.getByText(/identifier-free daily counts/i)).toBeVisible();

    rerender(
      <I18nProvider>
        <MemoryRouter>
          <PrivacyHistoryPage />
        </MemoryRouter>
      </I18nProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Privacy Policy History' })).toBeVisible();
    expect(screen.getByRole('link', { name: /full policy/i })).toHaveAttribute(
      'href',
      '/privacy?version=2026-07-27',
    );
  });

  it('renders Korean policy copy from the locale catalog', () => {
    window.localStorage.setItem('margins.locale', 'ko');

    render(
      <I18nProvider>
        <MemoryRouter>
          <PrivacyPage />
        </MemoryRouter>
      </I18nProvider>,
    );

    expect(screen.getByRole('heading', { name: '개인정보처리방침' })).toBeVisible();
    expect(screen.getByText(/버전·시행일: 2026-07-27/)).toBeVisible();
    expect(screen.getByText(/답변받을 이메일, 문의 유형, 제목, 본문을 수집/)).toBeVisible();
    expect(
      screen.getByText(/Resend가 답변받을 이메일, 문의 유형, 제목과 본문을 처리/),
    ).toBeVisible();
    expect(screen.getByText(/문의와 가입 이메일의 자동화 남용/)).toBeVisible();
    expect(screen.getByText(/처리 상태와 관계없이 수신 시각부터 1년 이내 삭제/)).toBeVisible();
    expect(screen.getByText(/전환·거부된 입력 원문만/)).toBeVisible();
    expect(screen.getByText(/일별 집계만 남길 수 있습니다/)).toBeVisible();
  });
});
