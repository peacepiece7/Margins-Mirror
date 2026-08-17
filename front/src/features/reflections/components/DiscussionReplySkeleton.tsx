import { Skeleton } from '@/components/ui/legacy-skeleton';
import { testAttr } from '@/utils/testAttrs';

export function DiscussionReplySkeleton() {
  return (
    <article
      className="mr-auto flex max-w-[92%] gap-3 rounded border border-stone-300 bg-white p-3 sm:max-w-[78%]"
      {...testAttr('guided-discussion-reply-skeleton')}
    >
      <div className="grid gap-2">
        <Skeleton className="h-3 w-24 bg-stone-300" />
        <Skeleton className="h-4 w-56 max-w-full bg-stone-300" />
        <Skeleton className="h-4 w-40 max-w-full bg-stone-300" />
      </div>
    </article>
  );
}
