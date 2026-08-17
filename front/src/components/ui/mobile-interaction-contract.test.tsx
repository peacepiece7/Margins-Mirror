import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AlertDialog, AlertDialogContent, AlertDialogTitle } from './alert-dialog';
import { Button } from './button';
import { Dialog, DialogContent, DialogTitle } from './dialog';
import { Input } from './input';
import { Select, SelectTrigger, SelectValue } from './select';
import { Tabs, TabsList, TabsTrigger } from './tabs';
import { Toggle } from './toggle';

describe('mobile interaction contract', () => {
  it('gives shared controls touch and pressed-state affordances', () => {
    render(
      <>
        <Button>Action</Button>
        <Toggle aria-label="Toggle option" />
        <Select>
          <SelectTrigger aria-label="Choose option">
            <SelectValue placeholder="Choose" />
          </SelectTrigger>
        </Select>
        <Tabs defaultValue="first">
          <TabsList>
            <TabsTrigger value="first">First</TabsTrigger>
          </TabsList>
        </Tabs>
      </>,
    );

    expect(screen.getByRole('button', { name: 'Action' })).toHaveClass(
      'touch-manipulation',
      'cursor-pointer',
    );
    expect(screen.getByRole('button', { name: 'Toggle option' })).toHaveClass(
      'touch-manipulation',
      'active:bg-muted',
    );
    expect(screen.getByRole('combobox', { name: 'Choose option' })).toHaveClass(
      'touch-manipulation',
      'active:bg-muted',
    );
    expect(screen.getByRole('tab', { name: 'First' })).toHaveClass(
      'touch-manipulation',
      'active:bg-background/70',
    );

    const tabsRoot = screen.getByRole('tab').closest('[data-slot="tabs"]');
    expect(tabsRoot).toHaveAttribute('data-orientation', 'horizontal');
    expect(tabsRoot).toHaveClass('data-[orientation=horizontal]:flex-col');
    expect(tabsRoot).not.toHaveClass('data-horizontal:flex-col');
    expect(screen.getByRole('tablist')).toHaveClass('group-data-[orientation=horizontal]/tabs:h-8');
  });

  it('keeps mobile fields tall and restores compact desktop density', () => {
    render(<Input aria-label="Search" />);

    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveClass('h-11', 'md:h-8');
  });

  it('bounds dialogs to the dynamic viewport', () => {
    const dialogView = render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Dialog title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole('dialog')).toHaveClass(
      'max-h-[calc(100dvh-2rem)]',
      'overflow-y-auto',
      'overscroll-contain',
    );
    dialogView.unmount();

    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Alert title</AlertDialogTitle>
        </AlertDialogContent>
      </AlertDialog>,
    );

    expect(screen.getByRole('alertdialog')).toHaveClass(
      'max-h-[calc(100dvh-2rem)]',
      'w-[calc(100%-2rem)]',
      'overflow-y-auto',
    );
  });
});
