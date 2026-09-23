import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '@/lib/api-client';
import { readAuthSession } from '@/lib/auth-session';
import { I18nProvider } from '@/lib/i18n';

import { contactApi } from '../api';
import { ContactPage } from './ContactPage';

vi.mock('../api', () => ({ contactApi: { accountEmail: vi.fn(), submit: vi.fn() } }));
vi.mock('@/lib/auth-session', () => ({ readAuthSession: vi.fn() }));

function renderPage(locale: 'en' | 'ko' = 'en') {
  window.localStorage.setItem('margins.locale', locale);
  return render(
    <I18nProvider>
      <MemoryRouter>
        <ContactPage />
      </MemoryRouter>
    </I18nProvider>,
  );
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText('Reply email'), {
    target: { value: ' Reader@Example.com ' },
  });
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'BUG_REPORT' } });
  fireEvent.change(screen.getByLabelText('Subject'), { target: { value: ' Broken page ' } });
  fireEvent.change(screen.getByLabelText('Message'), {
    target: { value: ' The page does not load. ' },
  });
}

describe('ContactPage', () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(readAuthSession).mockReturnValue(undefined);
  });

  it('is public and presents all six inquiry categories', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Contact Margins' })).toBeVisible();
    expect(contactApi.accountEmail).not.toHaveBeenCalled();
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Choose a category',
      'Service usage',
      'Account or login',
      'Privacy',
      'Bug report',
      'Feature request',
      'Other',
    ]);
    expect(screen.getByText(/Do not include passwords/)).toBeVisible();
  });

  it('uses the shared form controls with explicit accessible field relationships', async () => {
    renderPage();

    expect(screen.getByLabelText('Reply email')).toHaveAttribute('data-slot', 'input');
    expect(screen.getByLabelText('Category')).toHaveAttribute('data-slot', 'native-select');
    expect(screen.getByLabelText('Category')).toHaveClass('h-11', 'md:h-8');
    expect(screen.getByLabelText('Subject')).toHaveAttribute('data-slot', 'input');
    expect(screen.getByLabelText('Message')).toHaveAttribute('data-slot', 'textarea');

    fireEvent.click(screen.getByTestId('contact-submit'));
    const emailError = await screen.findByText('Enter an email address for the reply.');
    expect(screen.getByLabelText('Reply email')).toHaveAttribute('aria-describedby', emailError.id);
    expect(emailError).toHaveAttribute('role', 'alert');
  });

  it('prefills but does not lock the authenticated account email', async () => {
    vi.mocked(readAuthSession).mockReturnValue({
      userId: 1,
      username: 'reader',
      displayName: 'Reader',
      authMode: 'local',
      accessToken: 'token',
      accessTokenExpiresInSeconds: 300,
    });
    vi.mocked(contactApi.accountEmail).mockResolvedValue({ email: 'reader@example.com' });
    renderPage();
    const email = await screen.findByLabelText('Reply email');
    await waitFor(() => expect(email).toHaveValue('reader@example.com'));
    expect(email).not.toHaveAttribute('readonly');
    fireEvent.change(email, { target: { value: 'other@example.com' } });
    expect(email).toHaveValue('other@example.com');
  });

  it('validates required fields and disallowed control characters before submission', async () => {
    renderPage();
    fireEvent.click(screen.getByTestId('contact-submit'));
    expect(await screen.findByText('Enter an email address for the reply.')).toBeVisible();
    expect(contactApi.submit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Reply email'), {
      target: { value: 'reader@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'OTHER' } });
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Question\u0007' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'A normal message' } });
    fireEvent.click(screen.getByTestId('contact-submit'));
    expect(await screen.findByText('Remove unsupported control characters.')).toBeVisible();
    expect(contactApi.submit).not.toHaveBeenCalled();
  });

  it('normalizes the request and clears only subject and message after success', async () => {
    vi.mocked(contactApi.submit).mockResolvedValue({
      inquiryId: 42,
      status: 'OPEN',
      createdAt: '2026-08-24T00:00:00Z',
    });
    renderPage();
    fillValidForm();
    fireEvent.click(screen.getByTestId('contact-submit'));
    await waitFor(() =>
      expect(contactApi.submit).toHaveBeenCalledWith({
        email: 'reader@example.com',
        category: 'BUG_REPORT',
        subject: 'Broken page',
        message: 'The page does not load.',
        botChallengeToken: '',
      }),
    );
    expect(await screen.findByTestId('contact-success')).toHaveTextContent('Reference #42');
    expect(screen.getByLabelText('Reply email')).toHaveValue('Reader@Example.com');
    expect(screen.getByLabelText('Category')).toHaveValue('BUG_REPORT');
    expect(screen.getByLabelText('Subject')).toHaveValue('');
    expect(screen.getByLabelText('Message')).toHaveValue('');
  });

  it('relocalizes submitted feedback while preserving the inquiry reference', async () => {
    vi.mocked(contactApi.submit).mockResolvedValue({
      inquiryId: 2,
      status: 'OPEN',
      createdAt: '2026-08-24T00:00:00Z',
    });
    renderPage();
    fillValidForm();
    fireEvent.click(screen.getByTestId('contact-submit'));

    expect(await screen.findByTestId('contact-success')).toHaveTextContent(
      'Your inquiry was sent. Reference #2',
    );
    fireEvent.click(screen.getByRole('button', { name: 'KO' }));
    expect(screen.getByTestId('contact-success')).toHaveTextContent(
      '문의가 전송되었습니다. 접수 번호 #2',
    );
    expect(screen.getByTestId('contact-success')).not.toHaveTextContent(
      'Your inquiry was sent. Reference',
    );
  });

  it('keeps every entry and localizes provider failure feedback', async () => {
    vi.mocked(contactApi.submit).mockRejectedValue(
      new ApiRequestError('CONTACT_INQUIRY_DELIVERY_FAILED', 502),
    );
    renderPage('ko');
    fireEvent.change(screen.getByLabelText('답변받을 이메일'), {
      target: { value: 'reader@example.com' },
    });
    fireEvent.change(screen.getByLabelText('문의 유형'), { target: { value: 'FEATURE_REQUEST' } });
    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '기능 제안' } });
    fireEvent.change(screen.getByLabelText('문의 내용'), {
      target: { value: '이 기능이 필요해요.' },
    });
    fireEvent.click(screen.getByTestId('contact-submit'));
    expect(await screen.findByTestId('contact-error')).toHaveTextContent(
      '문의는 저장했지만 운영자 알림을 보내지 못했습니다.',
    );
    expect(screen.getByLabelText('답변받을 이메일')).toHaveValue('reader@example.com');
    expect(screen.getByLabelText('문의 유형')).toHaveValue('FEATURE_REQUEST');
    expect(screen.getByLabelText('제목')).toHaveValue('기능 제안');
    expect(screen.getByLabelText('문의 내용')).toHaveValue('이 기능이 필요해요.');
  });
});
