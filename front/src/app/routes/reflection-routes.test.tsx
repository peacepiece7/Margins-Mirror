import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { LegacyReviewRedirect } from './reflection-routes';

afterEach(cleanup);

function LocationProbe() {
  return (
    <>
      <span>{useLocation().pathname}</span>
      <span>{useNavigationType()}</span>
    </>
  );
}

function renderRedirect(path: string, routePath: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<LegacyReviewRedirect />} path={routePath} />
        <Route element={<LocationProbe />} path="*" />
      </Routes>
    </MemoryRouter>,
  );
}

describe('legacy review redirects', () => {
  it.each([
    ['/book/42/review', '/book/:bookId/review'],
    ['/book/42/review/new', '/book/:bookId/review/new'],
    ['/book/42/review/7/edit', '/book/:bookId/review/:insightId/edit'],
  ])('replaces %s with the canonical Reflection entry', (path, routePath) => {
    renderRedirect(path, routePath);
    expect(screen.getByText('/book/42/reflection')).toBeVisible();
    expect(screen.getByText('REPLACE')).toBeVisible();
  });

  it('maps old question-answer links to the canonical Interview route', () => {
    renderRedirect('/book/42/review/questions/9', '/book/:bookId/review/questions/:questionId');
    expect(screen.getByText('/book/42/reflection/interview')).toBeVisible();
    expect(screen.getByText('REPLACE')).toBeVisible();
  });
});
