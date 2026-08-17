import { Skeleton } from '@/components/ui/legacy-skeleton';
import { testAttr } from '@/utils/testAttrs';

export function DebateReplySkeleton() {
  return (
    <article className="flex justify-start gap-3" {...testAttr('debate-reply-skeleton')}>
      <Skeleton className="h-10 w-10 shrink-0 rounded-full bg-stone-300" />
      <div className="grid max-w-[78%] items-start gap-1">
        <Skeleton className="h-3 w-20 bg-stone-300" />
        <div className="grid gap-2 rounded-2xl rounded-bl-sm bg-white px-4 py-3 shadow-sm">
          <Skeleton className="h-4 w-56 max-w-full" />
          <Skeleton className="h-4 w-40 max-w-full" />
        </div>
      </div>
    </article>
  );
}
