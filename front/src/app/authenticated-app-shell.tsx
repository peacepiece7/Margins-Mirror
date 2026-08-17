import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { GlobalLoadingIndicator } from '@/components/layouts/global-loading-indicator';
import { Button } from '@/components/ui/button';
import { SkipLink } from '@/components/ui/skip-link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { bookPath } from '@/features/books/routes';
import { apiErrorMessage } from '@/lib/api-error-i18n';
import { useI18n } from '@/lib/i18n';
import { useLatestSessionTimelineQuery } from '@/features/reading-sessions/queries';
import { testAttr } from '@/utils/testAttrs';

import { AppNavigation } from './app-navigation';
import type { LoginResponse } from '@/types/api/auth';

type AuthenticatedAppShellProps = {
  onLogout: () => Promise<void>;
  session: LoginResponse;
};

export function AuthenticatedAppShell({ onLogout, session }: AuthenticatedAppShellProps) {
  const { t } = useI18n();
  const location = useLocation();
  const activeApp = location.pathname.startsWith('/memory-card') ? 'memory-card' : 'margins';

  return (
    <>
      <SkipLink />
      <GlobalLoadingIndicator />
      <div
        className="blueprint-auth-gnb border-b border-stone-300/80 bg-stone-50/95 px-3 py-2 backdrop-blur sm:px-5"
        {...testAttr('auth-session-bar')}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-end gap-2 text-sm">
          <AppNavigation activeApp={activeApp} onLogout={onLogout} session={session} />
        </div>
      </div>
      <div id="main-content" tabIndex={-1}>
        <Outlet context={session} />
      </div>
    </>
  );
}

export function AuthenticatedMainPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const latest = useLatestSessionTimelineQuery();
  const continueBookId = latest.data?.bookId;
  const continueLabel = latest.data?.bookTitle ?? t('mainAuthContinueEmpty');
  const continuePath = continueBookId
    ? bookPath('book-detail', { bookId: continueBookId })
    : bookPath('book-search');
  const reviewPath = continueBookId
    ? bookPath('review', { bookId: continueBookId })
    : bookPath('public-reviews');
  const debatePath = continueBookId
    ? bookPath('book-detail', { bookId: continueBookId })
    : bookPath('book-list');

  return (
    <main
      className="blueprint-home-page min-h-screen text-stone-950"
      {...testAttr('main-auth-home-page')}
    >
      <section
        className="blueprint-home-content margins-page-gutter mx-auto grid max-w-6xl gap-6 py-8"
        {...testAttr('main-auth-home-content')}
      >
        <div className="grid gap-2">
          <h1 className="font-display text-4xl font-semibold tracking-normal">
            {t('mainAuthTitle')}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-stone-600">{t('mainAuthSubtitle')}</p>
        </div>
        {latest.error && (
          <Alert variant="destructive" {...testAttr('main-auth-home-error')}>
            <AlertDescription>
              {apiErrorMessage(latest.error, t, 'mainAuthContinueEmpty')}
            </AlertDescription>
          </Alert>
        )}
        <div className="blueprint-home-actions grid gap-3">
          <HomeAction
            detail={continueLabel}
            marker="→"
            onClick={() => navigate(continuePath)}
            testId="main-home-continue"
            title={t('mainAuthContinue')}
          />
          <HomeAction
            detail={t('mainAuthDiscoverDetail')}
            marker="+"
            onClick={() => navigate(bookPath('book-search'))}
            testId="main-home-discover"
            title={t('mainAuthDiscover')}
          />
          <HomeAction
            detail={t('mainAuthLibraryDetail')}
            marker="★"
            onClick={() => navigate(bookPath('book-list'))}
            testId="main-home-library"
            title={t('mainAuthLibrary')}
          />
          <HomeAction
            detail={t('mainAuthReviewDetail')}
            marker="✓"
            onClick={() => navigate(reviewPath)}
            testId="main-home-review"
            title={t('mainAuthReview')}
          />
          <HomeAction
            detail={t('mainAuthDebateDetail')}
            marker="?"
            onClick={() => navigate(debatePath)}
            testId="main-home-debate"
            title={t('mainAuthDebate')}
          />
        </div>
      </section>
    </main>
  );
}

function HomeAction({
  detail,
  marker,
  onClick,
  testId,
  title,
}: {
  detail: string;
  marker: string;
  onClick: () => void;
  testId: string;
  title: string;
}) {
  return (
    <Button
      className="blueprint-home-action grid h-auto min-h-28 w-full min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-3 whitespace-normal rounded border border-stone-300 p-4 text-left hover:border-[var(--margins-control-hover)] hover:bg-[var(--margins-control-hover)] hover:text-[var(--margins-paper)] focus-visible:bg-[var(--margins-control)] focus-visible:text-[var(--margins-paper)]"
      onClick={onClick}
      type="button"
      {...testAttr(testId)}
    >
      <span
        aria-hidden="true"
        className="grid h-10 w-10 place-items-center rounded bg-stone-950 text-sm font-semibold text-white"
      >
        {marker}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        <span className="mt-1 block text-sm leading-6 text-stone-600">{detail}</span>
      </span>
    </Button>
  );
}
