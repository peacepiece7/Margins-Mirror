import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LoginResponse } from '@/types/api/auth';

import { useAuthenticatedSessionGuard } from '@/lib/authenticated-session-guard';

import { AuthenticatedQueryProvider } from './AuthenticatedQueryProvider';

const session = (userId: number, accessToken: string): LoginResponse => ({
  userId,
  username: `reader-${userId}`,
  displayName: `Reader ${userId}`,
  authMode: 'password',
  accessToken,
  accessTokenExpiresInSeconds: 3600,
});

function QueryClientProbe({ onClient }: { onClient: (client: QueryClient) => void }) {
  const client = useQueryClient();
  useEffect(() => onClient(client), [client, onClient]);
  return null;
}

function DeferredMutationProbe({
  mutationPromise,
  onCurrentSessionSettlement,
}: {
  mutationPromise: Promise<void>;
  onCurrentSessionSettlement: () => void;
}) {
  const isCurrentSession = useAuthenticatedSessionGuard();
  const mutation = useMutation({ mutationFn: () => mutationPromise });
  return (
    <button
      onClick={() =>
        void mutation.mutateAsync().then(() => {
          if (isCurrentSession()) onCurrentSessionSettlement();
        })
      }
      type="button"
    >
      start
    </button>
  );
}

describe('AuthenticatedQueryProvider', () => {
  afterEach(cleanup);

  it('rotates protected Query clients when the authenticated session changes', async () => {
    const clients: QueryClient[] = [];
    const onClient = (client: QueryClient) => {
      if (!clients.includes(client)) clients.push(client);
    };
    const view = render(
      <AuthenticatedQueryProvider session={session(1, 'token-a')}>
        <QueryClientProbe onClient={onClient} />
      </AuthenticatedQueryProvider>,
    );

    await waitFor(() => expect(clients).toHaveLength(1));
    clients[0].setQueryData(['account', 'detail'], { userId: 1 });
    view.rerender(
      <AuthenticatedQueryProvider session={session(2, 'token-b')}>
        <QueryClientProbe onClient={onClient} />
      </AuthenticatedQueryProvider>,
    );

    await waitFor(() => expect(clients).toHaveLength(2));
    expect(clients[1]).not.toBe(clients[0]);
    expect(clients[1].getQueryData(['account', 'detail'])).toBeUndefined();

    clients[0].setQueryData(['account', 'detail'], { userId: 1, late: true });
    expect(clients[1].getQueryData(['account', 'detail'])).toBeUndefined();
  });

  it('keeps the protected Query client and late work alive during same-user token rotation', async () => {
    const clients: QueryClient[] = [];
    const onClient = (client: QueryClient) => {
      if (!clients.includes(client)) clients.push(client);
    };
    let resolveMutation!: () => void;
    const mutationPromise = new Promise<void>((resolve) => {
      resolveMutation = resolve;
    });
    const onCurrentSessionSettlement = vi.fn();
    const view = render(
      <AuthenticatedQueryProvider session={session(1, 'token-a')}>
        <QueryClientProbe onClient={onClient} />
        <DeferredMutationProbe
          mutationPromise={mutationPromise}
          onCurrentSessionSettlement={onCurrentSessionSettlement}
        />
      </AuthenticatedQueryProvider>,
    );

    await waitFor(() => expect(clients).toHaveLength(1));
    fireEvent.click(view.getByRole('button', { name: 'start' }));
    view.rerender(
      <AuthenticatedQueryProvider session={session(1, 'token-b')}>
        <QueryClientProbe onClient={onClient} />
        <DeferredMutationProbe
          mutationPromise={mutationPromise}
          onCurrentSessionSettlement={onCurrentSessionSettlement}
        />
      </AuthenticatedQueryProvider>,
    );

    await act(async () => {
      resolveMutation();
      await mutationPromise;
    });

    expect(clients).toHaveLength(1);
    expect(onCurrentSessionSettlement).toHaveBeenCalledOnce();
  });

  it('blocks a prior session mutation continuation after logout and login', async () => {
    let resolveMutation!: () => void;
    const mutationPromise = new Promise<void>((resolve) => {
      resolveMutation = resolve;
    });
    const onCurrentSessionSettlement = vi.fn();
    const view = render(
      <AuthenticatedQueryProvider session={session(1, 'token-a')}>
        <DeferredMutationProbe
          mutationPromise={mutationPromise}
          onCurrentSessionSettlement={onCurrentSessionSettlement}
        />
      </AuthenticatedQueryProvider>,
    );

    fireEvent.click(view.getByRole('button', { name: 'start' }));
    view.rerender(
      <AuthenticatedQueryProvider session={session(2, 'token-b')}>
        <DeferredMutationProbe
          mutationPromise={mutationPromise}
          onCurrentSessionSettlement={onCurrentSessionSettlement}
        />
      </AuthenticatedQueryProvider>,
    );

    await act(async () => {
      resolveMutation();
      await mutationPromise;
    });
    expect(onCurrentSessionSettlement).not.toHaveBeenCalled();
  });
});
