import { deleteJson, getJson, patchJson, postJson } from '@/lib/api-client';
import type {
  CreateReadingSessionResponse,
  MetricSnapshotResponse,
  ReadingLibraryStatsResponse,
  ReadingSessionListResponse,
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

  list(): Promise<ReadingSessionListResponse> {
    return getJson('/api/reading-sessions');
  },

  stats(): Promise<ReadingLibraryStatsResponse> {
    return getJson('/api/reading-sessions/stats');
  },

  search(query: string): Promise<SessionSearchResponse> {
    return getJson(`/api/reading-sessions/search?query=${encodeURIComponent(query)}`);
  },

  create(bookId: number, title: string): Promise<CreateReadingSessionResponse> {
    return postJson('/api/reading-sessions', { bookId, title });
  },

  archive(sessionId: number): Promise<ReadingSessionListResponse> {
    return deleteJson(`/api/reading-sessions/${sessionId}`);
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
