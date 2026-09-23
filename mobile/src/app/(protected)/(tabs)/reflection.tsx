import { router } from 'expo-router';

import { useEnsureReadingSessionForBook } from '@/features/reading-sessions/queries';
import { ReflectionThreadScreen } from '@/features/reflections/thread-screen';
import type {
  MobileReflectionThread,
  MobileReflectionThreadTarget,
} from '@/features/reflections/types';

export default function ReflectionThreadRoute() {
  const ensureSession = useEnsureReadingSessionForBook();

  function openTarget(
    thread: MobileReflectionThread,
    target: MobileReflectionThreadTarget,
  ) {
    switch (target.kind) {
      case 'record':
        if (target.sessionId) {
          router.push(`/books/${target.bookId}/reflection?sessionId=${target.sessionId}`);
          return;
        }
        ensureSession.mutate(
          thread.bookId,
          {
            onSuccess: (session) =>
              router.push(`/books/${thread.bookId}/reflection?sessionId=${session.sessionId}`),
          },
        );
        return;
      case 'reflection':
        router.push(`/books/${target.bookId}/reflection?sessionId=${target.sessionId}`);
        return;
      case 'interview':
        router.push(
          `/books/${target.bookId}/reflection/interview?sessionId=${target.sessionId}&interviewId=${target.interviewId}`,
        );
        return;
      case 'guide':
        router.push(`/books/${target.bookId}/reflection/guide/${target.guideId}`);
        return;
      case 'discuss':
        router.push(`/books/${target.bookId}/reflection/discuss/${target.runId}`);
        return;
      case 'refine':
        router.push(`/books/${target.bookId}/reflection/refine/${target.runId}`);
    }
  }

  return (
    <ReflectionThreadScreen
      creatingBookId={ensureSession.isPending ? ensureSession.variables : undefined}
      creationError={ensureSession.isError}
      onOpenLibrary={() => router.navigate('/library')}
      onOpenThread={openTarget}
    />
  );
}
