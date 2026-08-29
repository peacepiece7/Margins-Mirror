import { deleteJson, getJson, patchJson, postJson } from '@/lib/api-client';
import type {
  MetricSnapshotResponse,
  ReadingSessionTimelineResponse,
  SessionSearchResponse,
} from '@/types/api/session';

export interface SessionHighlightInput {
  pageNumber?: number;
  locationLabel?: string;
  quoteText: string;
  note?: string;
}

export const readingSessionsApi = {
  latestTimeline(): Promise<ReadingSessionTimelineResponse | null> {
    return getJson('/api/reading-sessions/latest');
  },

  timeline(sessionId: number): Promise<ReadingSessionTimelineResponse | null> {
    return getJson(`/api/reading-sessions/${sessionId}`);
  },

  search(query: string): Promise<SessionSearchResponse> {
    return getJson(`/api/reading-sessions/search?query=${encodeURIComponent(query)}`);
  },

  createMetricSnapshot(sessionId: number): Promise<MetricSnapshotResponse> {
    return postJson(`/api/reading-sessions/${sessionId}/metrics/snapshot`, {});
  },

  updateTitle(sessionId: number, title: string): Promise<ReadingSessionTimelineResponse> {
    return patchJson(`/api/reading-sessions/${sessionId}/title`, { title });
  },

  createHighlight(
    sessionId: number,
    highlight: SessionHighlightInput,
  ): Promise<ReadingSessionTimelineResponse> {
    return postJson(`/api/reading-sessions/${sessionId}/highlights`, highlight);
  },

  updateHighlight(
    sessionId: number,
    highlightId: number,
    highlight: SessionHighlightInput,
  ): Promise<ReadingSessionTimelineResponse> {
    return patchJson(`/api/reading-sessions/${sessionId}/highlights/${highlightId}`, highlight);
  },

  deleteHighlight(sessionId: number, highlightId: number): Promise<ReadingSessionTimelineResponse> {
    return deleteJson(`/api/reading-sessions/${sessionId}/highlights/${highlightId}`);
  },

  createTag(sessionId: number, label: string): Promise<ReadingSessionTimelineResponse> {
    return postJson(`/api/reading-sessions/${sessionId}/tags`, { label });
  },

  deleteTag(sessionId: number, tagId: number): Promise<ReadingSessionTimelineResponse> {
    return deleteJson(`/api/reading-sessions/${sessionId}/tags/${tagId}`);
  },
};
