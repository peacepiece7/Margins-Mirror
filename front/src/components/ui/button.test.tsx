import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './alert-dialog';
import { Button } from './button';

describe('Button', () => {
  it('forwards its native ref through an AlertDialog asChild trigger', () => {
    const ref = createRef<HTMLButtonElement>();

    render(
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button ref={ref}>새 version 만들기</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>재생성 확인</AlertDialogTitle>
        </AlertDialogContent>
      </AlertDialog>,
    );

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    fireEvent.click(screen.getByRole('button', { name: '새 version 만들기' }));
    expect(screen.getByRole('alertdialog', { name: '재생성 확인' })).toBeVisible();
  });

  it('announces and disables a pending action', () => {
    render(
      <Button loading loadingLabel="Saving">
        Save
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Saving' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.querySelector('[data-slot="spinner"]')).toBeVisible();
  });

  it('preserves native disabled behavior, refs, and variants when rendered asChild', () => {
    const ref = createRef<HTMLButtonElement>();
    const onClick = vi.fn();

    render(
      <Button asChild disabled ref={ref} variant="destructive">
        <button onClick={onClick} type="button">
          Remove
        </button>
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Remove' });
    expect(ref.current).toBe(button);
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('data-variant', 'destructive');
    expect(button).toHaveClass('text-destructive');
    expect(button).toHaveClass(
      'hover:bg-destructive/20',
      'hover:text-destructive-ink',
      'active:bg-destructive/30',
      'active:text-destructive-ink',
    );
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('exposes disabled anchor semantics and prevents anchor activation when rendered asChild', () => {
    const onClick = vi.fn();

    render(
      <Button asChild disabled variant="link">
        <a href="/library" onClick={onClick}>
          Library
        </a>
      </Button>,
    );

    const link = screen.getByRole('link', { name: 'Library' });
    expect(link).toHaveAttribute('aria-disabled', 'true');
    expect(link).toHaveAttribute('data-disabled');
    expect(link).not.toHaveAttribute('disabled');
    expect(link).toHaveAttribute('tabindex', '-1');
    expect(link).toHaveAttribute('data-variant', 'link');
    expect(link).toHaveClass('underline-offset-4');
    expect(fireEvent.click(link)).toBe(false);
    expect(onClick).not.toHaveBeenCalled();
  });
});
