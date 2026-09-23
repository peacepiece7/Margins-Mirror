import { cleanup, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { I18nProvider } from '@/lib/i18n';

import { ReadingWorkspacePanelLayout } from './reading-workspace-panel-layout';

function renderLayout(path: string, routePath = '*') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <I18nProvider>
        <Routes>
          <Route
            path={routePath}
            element={
              <ReadingWorkspacePanelLayout>
                <div>Page content</div>
              </ReadingWorkspacePanelLayout>
            }
          />
        </Routes>
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('ReadingWorkspacePanelLayout navigation', () => {
  afterEach(cleanup);

  it.each(['/book/library', '/book/discover', '/book/public-reviews'])(
    'gives global page %s the full page-owned content width',
    (path) => {
      const view = renderLayout(path);

      expect(view.getByTestId('workspace-grid')).toHaveClass('web-workspace-shell', 'is-global');
      expect(view.queryByTestId('workspace-workflow-rail')).not.toBeInTheDocument();
      expect(view.queryByTestId('portal-page-nav')).not.toBeInTheDocument();
      expect(view.queryByTestId('reading-workspace-breadcrumb')).not.toBeInTheDocument();
      view.unmount();
    },
  );

  it('keeps compact book-scoped destinations and the current book id', () => {
    const view = renderLayout('/book/42', '/book/:bookId');

    expect(view.getByTestId('workspace-grid')).toHaveClass('is-book-scoped');
    expect(view.getByTestId('portal-library-side-panel')).toBeVisible();
    expect(view.getByTestId('portal-library-subnav')).toHaveAccessibleName('Library Primary pages');
    expect(view.getByTestId('portal-subnav-book-detail')).toHaveAttribute('href', '/book/42');
    expect(view.getByTestId('portal-subnav-book-detail')).toHaveAttribute('aria-current', 'page');
    expect(view.getByTestId('portal-subnav-review')).toHaveAttribute('href', '/book/42/review');
    expect(view.getByTestId('portal-subnav-debate-rooms')).toHaveAttribute(
      'href',
      '/book/42/debate-rooms',
    );
    expect(view.queryByTestId('workspace-workflow-rail')).not.toBeInTheDocument();
    view.unmount();
  });

  it.each([
    ['/book/42/review/new', '/book/:bookId/review/new', 'Review editor'],
    [
      '/book/42/review/questions/7',
      '/book/:bookId/review/questions/:questionId',
      'Answer question',
    ],
    ['/book/42/debate/9', '/book/:bookId/debate/:windowId', 'Debate'],
  ])('uses a route-specific breadcrumb leaf for %s', (path, routePath, label) => {
    const view = renderLayout(path, routePath);

    expect(view.getByTestId('reading-workspace-breadcrumb')).toHaveTextContent(`Library/${label}`);
    expect(
      view.getByTestId('reading-workspace-breadcrumb').querySelector('[aria-current="page"]'),
    ).toHaveTextContent(label);
    view.unmount();
  });
});
