import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './breadcrumb';
import { SkipLink } from './skip-link';

describe('shell primitives', () => {
  it('provides a keyboard-first content target', () => {
    render(<SkipLink>Skip</SkipLink>);
    expect(screen.getByRole('link', { name: 'Skip' })).toHaveAttribute('href', '#main-content');
  });

  it('marks the current breadcrumb page', () => {
    render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>Library</BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Discover</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    );
    expect(screen.getByText('Discover')).toHaveAttribute('aria-current', 'page');
  });
});
