import type {
  DiscussionGuideProjection,
  DiscussionGuideProjectionResponse,
  DiscussionGuideResponse,
  DiscussionGuideVersionSummary,
} from '@/types/api/reflection-loop';

import type { GuideEditDraft } from './discussion-guide-edit';

export interface DiscussionGuidePanelProps {
  bookId: number;
  guideId: number;
}

export interface DiscussionGuideVersionNavigatorProps {
  disabled: boolean;
  guideId: number;
  onSelect: (guideId: number) => void;
  versions: DiscussionGuideVersionSummary[];
}

export interface DiscussionGuidePreviewProps {
  draftActive: boolean;
  exportPending: boolean;
  onExport: () => void;
  onProjectionTypeChange: (projection: DiscussionGuideProjection) => void;
  projection?: DiscussionGuideProjectionResponse;
  projectionError: boolean;
  projectionType: DiscussionGuideProjection;
}

export interface DiscussionGuideEditorProps {
  disabled: boolean;
  draft: GuideEditDraft;
  guide: DiscussionGuideResponse;
  onChange: (draft: GuideEditDraft) => void;
}
