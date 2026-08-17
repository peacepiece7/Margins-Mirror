import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/lib/i18n';
import { ReviewEditorPage } from './ReviewEditorPage';

describe('ReviewEditorPage', () => {
  it('aligns the visibility select with adjacent inputs without clipping its text', () => {
    render(
      <I18nProvider>
        <ReviewEditorPage
          authorName=""
          content="Draft"
          evidence=""
          isEditing={false}
          loading={false}
          onAuthorNameChange={vi.fn()}
          onCancel={vi.fn()}
          onContentChange={vi.fn()}
          onEvidenceChange={vi.fn()}
          onReviewedOnChange={vi.fn()}
          onSubmit={vi.fn()}
          onVisibilityChange={vi.fn()}
          reviewedOn="2026-07-29"
          visibility="PRIVATE"
        />
      </I18nProvider>,
    );

    expect(screen.getByTestId('reflection-visibility-select')).toHaveClass(
      'h-8',
      'py-1',
      'leading-5',
    );
  });
});
