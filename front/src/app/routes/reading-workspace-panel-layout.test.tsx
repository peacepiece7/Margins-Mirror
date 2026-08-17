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
                <div>Current book</div>
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

  it.each([
    ['Library', '/book/library', '*'],
    ['Reflection', '/book/42/reflection', '/book/:bookId/reflection'],
  ])('uses the Book Detail section gap for the %s content stack', (_page, path, routePath) => {
    const view = renderLayout(path, routePath);

    expect(view.getByTestId('reading-workspace-content-stack')).toHaveClass(
      'grid',
      'margins-section-stack',
    );
    expect(view.getByTestId('reading-workspace-content-stack').children).toHaveLength(3);
    expect(view.getByTestId('reading-workspace-breadcrumb')).toBeVisible();
    view.unmount();
  });

  it('keeps global destinations in the GNB when no book is selected', () => {
    const view = renderLayout('/book/library');

    expect(view.getByTestId('portal-nav-book-search')).toHaveAttribute('href', '/book/discover');
    expect(view.getByTestId('portal-nav-book-list')).toHaveAttribute('href', '/book/library');
    expect(view.getByTestId('portal-nav-book-list')).toHaveAttribute('aria-current', 'page');
    expect(view.getByTestId('portal-nav-public-reviews')).toHaveAttribute(
      'href',
      '/book/public-reviews',
    );
    expect(view.queryByTestId('portal-library-side-panel')).not.toBeInTheDocument();
    view.unmount();
  });

  it('uses the shared responsive page gutter for the header and content', () => {
    const view = renderLayout('/book/library');
    const page = view.getByTestId('reading-workspace-content-stack');
    const content = page.parentElement;
    const headerContent = view.getByRole('banner').firstElementChild;

    expect(content).toHaveClass('margins-page-gutter', 'margins-section-stack');
    expect(headerContent).toHaveClass('margins-page-gutter');
    view.unmount();
  });

  it('keeps the GNB stable and adds book-scoped destinations to a Library child nav', () => {
    const view = renderLayout('/book/42', '/book/:bookId');

    expect(view.getByTestId('portal-page-nav').querySelectorAll('a')).toHaveLength(3);
    expect(view.getByTestId('portal-page-nav')).toHaveClass('grid', 'grid-cols-3');
    expect(view.getByTestId('portal-nav-book-list')).toHaveClass('min-h-11', 'min-w-0');
    expect(view.getByTestId('portal-nav-book-list')).toHaveAttribute('aria-current', 'page');
    expect(view.getByTestId('portal-library-side-panel')).toBeVisible();
    expect(view.getByTestId('portal-library-subnav')).toHaveAccessibleName('Library Primary pages');
    expect(view.getByTestId('portal-library-subnav').firstElementChild).toHaveClass(
      'grid-cols-3',
      'lg:grid-cols-1',
    );
    expect(view.getByTestId('portal-subnav-book-detail')).toHaveAttribute('href', '/book/42');
    expect(view.getByTestId('portal-subnav-book-detail')).toHaveClass('min-h-11', 'min-w-0');
    expect(view.getByTestId('portal-subnav-book-detail')).toHaveAttribute('aria-current', 'page');
    expect(view.getByTestId('portal-subnav-review')).toHaveAttribute('href', '/book/42/review');
    expect(view.getByTestId('portal-subnav-debate-rooms')).toHaveAttribute(
      'href',
      '/book/42/debate-rooms',
    );
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
