// @vitest-environment jsdom

import { createElement, type ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { memoryCardPath, useMemoryCardRouteState } from './routes';

function routeFor(path: string) {
  const { result } = renderHook(() => useMemoryCardRouteState(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(MemoryRouter, { initialEntries: [path] }, children),
  });
  return result.current;
}

describe('memory card routes', () => {
  it('maps stable memory card URLs to page modes through router matching', () => {
    expect(routeFor('/memory-card')).toEqual({ mode: 'groups' });
    expect(routeFor('/memory-card/groups')).toEqual({ mode: 'groups' });
    expect(routeFor('/memory-card/groups/new')).toEqual({ mode: 'new-group' });
    expect(routeFor('/memory-card/groups/3')).toEqual({
      mode: 'group',
      groupId: 3,
    });
    expect(routeFor('/memory-card/groups/3/cards/new')).toEqual({
      mode: 'new-card',
      groupId: 3,
    });
    expect(routeFor('/memory-card/groups/3/cards/4')).toEqual({
      mode: 'card',
      groupId: 3,
      cardId: 4,
    });
    expect(routeFor('/memory-card/groups/3/cards/4/edit')).toEqual({
      mode: 'edit-card',
      groupId: 3,
      cardId: 4,
    });
    expect(routeFor('/memory-card/groups/3/upload')).toEqual({
      mode: 'upload',
      groupId: 3,
    });
    expect(routeFor('/memory-card/groups/3/study')).toEqual({
      mode: 'study',
      groupId: 3,
    });
  });

  it('falls back to the groups view for invalid numeric identifiers', () => {
    expect(routeFor('/memory-card/groups/0')).toEqual({ mode: 'groups' });
    expect(routeFor('/memory-card/groups/1e3')).toEqual({ mode: 'groups' });
    expect(routeFor('/memory-card/groups/3.5')).toEqual({ mode: 'groups' });
    expect(routeFor('/memory-card/groups/-3')).toEqual({ mode: 'groups' });
    expect(routeFor(`/memory-card/groups/${Number.MAX_SAFE_INTEGER + 1}`)).toEqual({
      mode: 'groups',
    });
    expect(routeFor('/memory-card/groups/3/cards/nope')).toEqual({ mode: 'groups' });
    expect(routeFor('/memory-card/groups/3/cards/0/edit')).toEqual({ mode: 'groups' });
  });

  it('builds canonical memory card paths', () => {
    expect(memoryCardPath('groups')).toBe('/memory-card/groups');
    expect(memoryCardPath('new-group')).toBe('/memory-card/groups/new');
    expect(memoryCardPath('cards', { groupId: 3 })).toBe('/memory-card/groups/3/cards');
    expect(memoryCardPath('edit-card', { groupId: 3, cardId: 4 })).toBe(
      '/memory-card/groups/3/cards/4/edit',
    );
    expect(memoryCardPath('study', { groupId: 3 })).toBe('/memory-card/groups/3/study');
  });
});
