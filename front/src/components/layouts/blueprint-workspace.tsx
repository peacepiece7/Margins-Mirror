import type { PropsWithChildren, ReactNode } from 'react';

interface BlueprintWorkspaceProps extends PropsWithChildren {
  className?: string;
  header?: ReactNode;
  testAttributes?: Record<string, string>;
}

export function BlueprintWorkspace({
  children,
  className = '',
  header,
  testAttributes,
}: BlueprintWorkspaceProps) {
  return (
    <main
      className={`blueprint-workspace min-h-screen text-stone-950 ${className}`}
      {...testAttributes}
    >
      <div className="blueprint-workspace-frame">
        {header}
        {children}
      </div>
    </main>
  );
}
