import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';

import { AuthBoundary } from '@/features/auth/components/AuthBoundary';
import { PublicLandingPage } from '@/features/landing/components/PublicLandingPage';
import { MemoryCardApp } from '@/features/memory-cards/components/MemoryCardApp';
import { BookLibraryPanel } from '@/features/books/components/BookLibraryPanel';
import { BookSearchPanel } from '@/features/books/components/BookSearchPanel';

import { AuthenticatedAppShell } from './authenticated-app-shell';
import { PremiumRoute } from './premium-route';
import { ReadingWorkspacePanelLayout } from './routes/reading-workspace-panel-layout';
import { BookDetailRoute } from './routes/book-detail-route';
import {
  DiscussionGuideRoute,
  GuidedDiscussionRoute,
  LegacyQuestionAnswerRoute,
  LegacyReviewEditorRoute,
  LegacyReviewRedirect,
  LegacyReviewRoute,
  ReflectionInterviewRoute,
  ReflectionDisabledRedirect,
  ReflectionRefineRoute,
  ReflectionRoute,
} from './routes/reflection-routes';
import { reflectionLoopEnabled } from '@/lib/feature-flags';
import { DebateRoomsRoute, DebateRoute } from './routes/debate-routes';
import { PublicReviewsRoute } from './routes/public-reviews-route';
import { AccountPage } from '@/features/account/components/AccountPage';
import { RecoveryPage } from '@/features/account/components/RecoveryPage';
import { PrivacyPage } from '@/features/privacy/components/PrivacyPage';
import { PrivacyHistoryPage } from '@/features/privacy/components/PrivacyHistoryPage';
import { ConsentPage } from '@/features/privacy/components/ConsentPage';
import { ContactPage } from '@/features/contact/components/ContactPage';

export const router = createBrowserRouter([
  { path: '/privacy', element: <PrivacyPage /> },
  { path: '/privacy/history', element: <PrivacyHistoryPage /> },
  { path: '/consent', element: <ConsentPage /> },
  { path: '/contact', element: <ContactPage /> },
  { path: '/account/recovery', element: <RecoveryPage /> },
  {
    path: '/',
    element: (
      <AuthBoundary
        authenticated={({ logout, session }) => (
          <AuthenticatedAppShell onLogout={logout} session={session} />
        )}
        publicRoot={<PublicLandingPage />}
      />
    ),
    children: [
      { index: true, element: <Navigate replace to="/book/library" /> },
      { path: 'login', element: <Navigate replace to="/book/library" /> },
      { path: 'account', element: <AccountPage /> },
      { path: 'memory-card', element: <Navigate replace to="/memory-card/groups" /> },
      {
        path: 'memory-card/*',
        element: (
          <PremiumRoute>
            <MemoryCardApp />
          </PremiumRoute>
        ),
      },
      { path: 'book', element: <Navigate replace to="/book/discover" /> },
      {
        path: 'book/discover',
        element: (
          <ReadingWorkspacePanelLayout>
            <BookSearchPanel />
          </ReadingWorkspacePanelLayout>
        ),
      },
      {
        path: 'book/library',
        element: (
          <ReadingWorkspacePanelLayout>
            <BookLibraryPanel />
          </ReadingWorkspacePanelLayout>
        ),
      },
      { path: 'book/public-reviews', element: <PublicReviewsRoute /> },
      { path: 'book/public-reviews/:insightId', element: <PublicReviewsRoute /> },
      { path: 'book/:bookId', element: <BookDetailRoute /> },
      {
        path: 'book/:bookId/reflection',
        element: reflectionLoopEnabled ? <ReflectionRoute /> : <ReflectionDisabledRedirect />,
      },
      {
        path: 'book/:bookId/reflection/interview',
        element: reflectionLoopEnabled ? (
          <ReflectionInterviewRoute />
        ) : (
          <ReflectionDisabledRedirect />
        ),
      },
      {
        path: 'book/:bookId/reflection/guide/:guideId',
        element: reflectionLoopEnabled ? <DiscussionGuideRoute /> : <ReflectionDisabledRedirect />,
      },
      {
        path: 'book/:bookId/reflection/discuss/:runId',
        element: reflectionLoopEnabled ? <GuidedDiscussionRoute /> : <ReflectionDisabledRedirect />,
      },
      {
        path: 'book/:bookId/reflection/refine/:runId',
        element: reflectionLoopEnabled ? <ReflectionRefineRoute /> : <ReflectionDisabledRedirect />,
      },
      {
        path: 'book/:bookId/review',
        element: reflectionLoopEnabled ? <LegacyReviewRedirect /> : <LegacyReviewRoute />,
      },
      {
        path: 'book/:bookId/review/:insightId/edit',
        element: reflectionLoopEnabled ? <LegacyReviewRedirect /> : <LegacyReviewEditorRoute />,
      },
      {
        path: 'book/:bookId/review/new',
        element: reflectionLoopEnabled ? (
          <LegacyReviewRedirect />
        ) : (
          <LegacyReviewEditorRoute create />
        ),
      },
      {
        path: 'book/:bookId/review/questions/:questionId',
        element: reflectionLoopEnabled ? <LegacyReviewRedirect /> : <LegacyQuestionAnswerRoute />,
      },
      { path: 'book/:bookId/debate-rooms', element: <DebateRoomsRoute /> },
      { path: 'book/:bookId/debate', element: <DebateRoomsRoute /> },
      { path: 'book/:bookId/debate/:windowId', element: <DebateRoute /> },
      { path: '*', element: <Navigate replace to="/book/discover" /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
