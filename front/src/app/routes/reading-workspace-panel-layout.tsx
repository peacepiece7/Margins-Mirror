import type { ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { bookPath } from '@/features/books/routes';
import type { MarginsPage } from '@/features/books/types';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

import { ReadingWorkspaceLayout } from './reading-workspace-layout';

const globalMenuPages: MarginsPage[] = ['book-search', 'book-list', 'public-reviews'];
const bookMenuPages: MarginsPage[] = ['book-detail', 'review', 'debate-rooms'];

function activeGlobalPage(pathname: string): MarginsPage {
  if (pathname === '/book/discover') return 'book-search';
  if (pathname.startsWith('/book/public-reviews')) return 'public-reviews';
  return 'book-list';
}

function activeBookPage(pathname: string): MarginsPage {
  if (pathname.includes('/review') || pathname.includes('/reflection')) return 'review';
  if (pathname.includes('/debate')) return 'debate-rooms';
  return 'book-detail';
}

function breadcrumbBookPage(pathname: string, fallback: MarginsPage): MarginsPage {
  if (/\/review\/(?:new|\d+\/edit)$/.test(pathname)) return 'review-editor';
  if (pathname.includes('/review/questions/')) return 'question-answer-editor';
  if (/\/debate\/\d+$/.test(pathname)) return 'debate';
  return fallback;
}

export function ReadingWorkspacePanelLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const location = useLocation();
  const params = useParams();
  const bookId = params.bookId ? Number(params.bookId) : undefined;
  const globalPage = activeGlobalPage(location.pathname);
  const bookPage = activeBookPage(location.pathname);
  const breadcrumbPage = breadcrumbBookPage(location.pathname, bookPage);
  const labels: Record<MarginsPage, string> = {
    'book-search': t('pageBookSearch'),
    'book-list': t('pageBookList'),
    'book-detail': t('pageBookDetail'),
    review: t('pageReview'),
    'review-editor': t('pageReviewEditor'),
    'question-answer-editor': t('questionAnswerPageTitle'),
    'public-reviews': t('pagePublicReviews'),
    'debate-rooms': t('pageDebateRooms'),
    debate: t('pageDebate'),
  };

  return (
    <ReadingWorkspaceLayout
      header={
        <header className="blueprint-workspace-header">
          <div className="margins-page-gutter mx-auto flex max-w-7xl flex-col gap-3 py-4 sm:gap-5 sm:py-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="blueprint-unit-label">UNIT / READING WORKSPACE</span>
              <h1 className="font-display text-3xl font-semibold tracking-normal sm:text-5xl">
                <Link className="hover:text-stone-600" to="/" {...testAttr('portal-home-link')}>
                  Margins
                </Link>
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-5 text-stone-600 sm:mt-2 sm:leading-6">
                {t('appTagline')}
              </p>
            </div>
            <nav
              aria-label={t('pageNavigation')}
              className="blueprint-page-nav grid grid-cols-3 gap-2 lg:flex lg:flex-wrap"
              {...testAttr('portal-page-nav')}
            >
              {globalMenuPages.map((pageId) => (
                <Button
                  asChild
                  className={`blueprint-nav-item h-auto min-h-11 min-w-0 rounded border px-2 py-2 text-xs font-medium sm:text-sm lg:min-h-0 lg:px-3 ${
                    globalPage === pageId
                      ? 'is-active border-stone-950 bg-stone-950 text-white'
                      : 'border-stone-300 bg-white/85 text-stone-700 hover:border-stone-950'
                  }`}
                  key={pageId}
                  {...testAttr(`portal-nav-${pageId}`)}
                >
                  <Link
                    aria-current={globalPage === pageId ? 'page' : undefined}
                    to={bookPath(pageId)}
                  >
                    {labels[pageId]}
                  </Link>
                </Button>
              ))}
            </nav>
          </div>
        </header>
      }
    >
      <section
        className={`blueprint-workspace-content margins-page-gutter margins-section-stack mx-auto grid max-w-7xl py-4 sm:py-6 ${
          bookId ? 'lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start' : ''
        }`}
      >
        {bookId && (
          <aside
            className="rounded border border-stone-300 bg-stone-50/80 p-2 lg:sticky lg:top-4 lg:p-3"
            {...testAttr('portal-library-side-panel')}
          >
            <Link
              className="flex min-h-11 items-center justify-between rounded px-2 py-2 text-sm font-semibold text-stone-950 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-0"
              to={bookPath('book-list')}
            >
              <span>{labels['book-list']}</span>
              <span aria-hidden="true" className="text-stone-400">
                /
              </span>
            </Link>
            <nav
              aria-label={`${labels['book-list']} ${t('pageNavigation')}`}
              className="mt-2 lg:border-l lg:border-stone-300 lg:pl-3"
              {...testAttr('portal-library-subnav')}
            >
              <div className="grid grid-cols-3 gap-1 border border-stone-200 bg-white/70 p-1.5 lg:grid-cols-1 lg:border-l-0">
                {bookMenuPages.map((pageId) => (
                  <Button
                    asChild
                    className={`h-auto min-h-11 w-full min-w-0 justify-center rounded-sm border-l-2 px-1.5 py-2 text-center text-xs sm:px-3 sm:text-sm lg:min-h-0 lg:justify-start lg:text-left ${
                      bookPage === pageId
                        ? 'border-l-stone-950 bg-stone-950 text-white hover:bg-stone-800 hover:text-white'
                        : 'border-l-transparent bg-transparent text-stone-600 hover:border-l-stone-400 hover:bg-stone-100 hover:text-stone-950'
                    }`}
                    key={pageId}
                    variant="ghost"
                    {...testAttr(`portal-subnav-${pageId}`)}
                  >
                    <Link
                      aria-current={bookPage === pageId ? 'page' : undefined}
                      to={bookPath(pageId, { bookId })}
                    >
                      {pageId === 'debate-rooms' ? labels.debate : labels[pageId]}
                    </Link>
                  </Button>
                ))}
              </div>
            </nav>
          </aside>
        )}
        <section
          className="margins-section-stack grid min-w-0"
          {...testAttr('reading-workspace-content-stack')}
        >
          <Breadcrumb {...testAttr('reading-workspace-breadcrumb')}>
            <BreadcrumbList>
              <BreadcrumbItem>
                <Link to={bookPath('book-list')}>{labels['book-list']}</Link>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{labels[bookId ? breadcrumbPage : globalPage]}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          {children}
        </section>
      </section>
    </ReadingWorkspaceLayout>
  );
}
