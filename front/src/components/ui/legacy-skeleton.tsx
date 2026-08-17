interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <ShadcnSkeleton
      aria-hidden="true"
      className={`block rounded bg-muted bg-stone-200 ${className}`}
    />
  );
}
import { Skeleton as ShadcnSkeleton } from './skeleton';
