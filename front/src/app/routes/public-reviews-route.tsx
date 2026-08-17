import { PublicReviewsPanel } from '@/features/public-reviews/components/PublicReviewsPanel';
import { ReadingWorkspacePanelLayout } from './reading-workspace-panel-layout';

export function PublicReviewsRoute() {
  return (
    <ReadingWorkspacePanelLayout>
      <PublicReviewsPanel />
    </ReadingWorkspacePanelLayout>
  );
}
