import { BlueprintWorkspace } from '@/components/layouts/blueprint-workspace';
import { testAttr } from '@/utils/testAttrs';

import type { ReadingWorkspaceLayoutProps } from './types';

export function ReadingWorkspaceLayout({ children, header }: ReadingWorkspaceLayoutProps) {
  return (
    <BlueprintWorkspace
      className="blueprint-reading-workspace"
      header={header}
      testAttributes={testAttr('reading-portal')}
    >
      {children}
    </BlueprintWorkspace>
  );
}
