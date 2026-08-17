import type {
  CreateReadingSessionResponse,
  CreateSessionWindowResponse,
  ReadingSessionNextAction,
  ReadingSessionStats,
  SessionHighlight,
} from '@/types/api/session';

export interface ReadingSessionProjectionState {
  [key: string]: unknown;
  session?: CreateReadingSessionResponse;
  stats?: ReadingSessionStats;
  nextActions: ReadingSessionNextAction[];
  window?: CreateSessionWindowResponse;
  highlights: SessionHighlight[];
}

export interface SessionReadinessItem {
  id: string;
  label: string;
  value: string;
  complete: boolean;
}

export interface SessionReadinessSummary {
  completedCount: number;
  totalCount: number;
  percent: number;
  items: SessionReadinessItem[];
}

export interface SessionBriefItem {
  id: string;
  label: string;
  value: string;
  detail?: string;
}

export interface SessionBriefSummary {
  headline: string;
  items: SessionBriefItem[];
}
