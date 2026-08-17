import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Alert, AlertDescription } from './alert';
import { Badge } from './badge';
import { Card } from './card';
import { Input } from './input';

describe('semantic UI adapters', () => {
  it('exposes project-owned semantic tones without changing element roles', () => {
    render(
      <>
        <Card aria-label="Warning card" tone="warning" />
        <Alert variant="success">
          <AlertDescription>Saved</AlertDescription>
        </Alert>
        <Badge variant="info">New</Badge>
      </>,
    );

    expect(screen.getByLabelText('Warning card')).toHaveAttribute('data-tone', 'warning');
    expect(screen.getByRole('alert')).toHaveClass('bg-emerald-50');
    expect(screen.getByText('New')).toHaveAttribute('data-variant', 'info');
  });

  it('reflects validation state semantically', () => {
    render(<Input aria-label="Title" aria-invalid />);
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveAttribute('data-invalid');
  });
});
