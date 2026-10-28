import type { TranslationKey } from '@/lib/i18n';

export const discussionGuideStageLabelKeys: Record<string, TranslationKey> = {
  WARM_UP: 'reflectionStageWarmUp',
  INTERPRETATION: 'reflectionStageInterpretation',
  EXPERIENCE: 'reflectionStageExperience',
  SOCIAL_VALUE: 'reflectionStageSocialValue',
  CLOSING: 'reflectionStageClosing',
};

export const discussionGuidePurposeLabelKeys: Record<string, TranslationKey> = {
  THOUGHT_EXPANSION: 'reflectionBriefThoughtExpansion',
  ISSUE_EXPLORATION: 'reflectionBriefIssueExploration',
  DISCUSSION_PREP: 'reflectionBriefDiscussionPrep',
};

export const discussionGuideAudienceLabelKeys: Record<string, TranslationKey> = {
  SELF_AI: 'reflectionBriefSelfAi',
  SMALL_GROUP: 'reflectionBriefSmallGroup',
};

export const discussionGuideOriginLabelKeys: Record<string, TranslationKey> = {
  GENERATED: 'reflectionGuideOriginGenerated',
  USER_EDIT: 'reflectionGuideOriginEdited',
  REGENERATED: 'reflectionGuideOriginRegenerated',
};
