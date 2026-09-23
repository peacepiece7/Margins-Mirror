import type { ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { bookPath } from '@/features/books/routes';
import type { MarginsPage } from '@/features/books/types';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

import { ReadingWorkspaceLayout } from './reading-workspace-layout';

const bookMenuPages: MarginsPage[] = ['book-detail', 'review', 'debate-rooms'];

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
    <ReadingWorkspaceLayout>
      <div
        className={`web-workspace-shell margins-page-gutter ${bookId ? 'is-book-scoped' : 'is-global'}`}
        {...testAttr('workspace-grid')}
      >
        <section
          className="web-workspace-main margins-section-stack grid min-w-0"
          {...testAttr('reading-workspace-content-stack')}
        >
          {bookId && (
            <div className="web-book-context-nav" {...testAttr('portal-library-side-panel')}>
              <Breadcrumb {...testAttr('reading-workspace-breadcrumb')}>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <Link to={bookPath('book-list')}>{labels['book-list']}</Link>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{labels[breadcrumbPage]}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <nav
                aria-label={`${labels['book-list']} ${t('pageNavigation')}`}
                className="web-book-context-links"
                {...testAttr('portal-library-subnav')}
              >
                {bookMenuPages.map((pageId) => (
                  <Button
                    asChild
                    className={`web-book-context-link ${bookPage === pageId ? 'is-active' : ''}`}
                    key={pageId}
                    size="sm"
                    variant="ghost"
                  >
                    <Link
                      aria-current={bookPage === pageId ? 'page' : undefined}
                      to={bookPath(pageId, { bookId })}
                      {...testAttr(`portal-subnav-${pageId}`)}
                    >
                      {pageId === 'debate-rooms' ? labels.debate : labels[pageId]}
                    </Link>
                  </Button>
                ))}
              </nav>
            </div>
          )}
          {children}
        </section>
      </div>
    </ReadingWorkspaceLayout>
  );
}
