import type { BookCandidate } from './book';

export type CatalogField = 'ALL' | 'TITLE' | 'AUTHOR' | 'ISBN';
export type CatalogFormat = 'ALL' | 'PRINT' | 'EBOOK' | 'AUDIOBOOK';
export interface CatalogSearchRequest {
  query: string;
  field: CatalogField;
  language: 'ALL' | 'ko' | 'en';
  format: CatalogFormat;
  limit?: number;
  intent?: 'SUBMIT' | 'REBUILD' | 'EXTEND';
}
export interface CatalogCandidate extends BookCandidate {
  catalogBookId: number;
  format: CatalogFormat | 'UNKNOWN';
  coverStatus: 'MISSING' | 'PENDING' | 'READY' | 'FAILED' | 'DENIED';
  inLibrary: boolean;
  savedBookId?: number | null;
  sources: { code: string; label: string; url: string }[];
}
export interface CatalogCollection {
  id: string;
  state: 'COLLECTING' | 'IDLE';
  lastOutcome: 'NONE' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED' | 'DEFERRED';
  generation: number;
  resultVersion: number;
  coverVersion?: number;
  canExtend?: boolean;
  succeededSourceCount: number;
  failedSourceCount: number;
  retryAfterSeconds?: number | null;
  lastUpdatedAt?: string | null;
  revalidateAfter?: string | null;
}
export interface CatalogSearchResponse {
  snapshotId: string;
  appliedResultVersion?: number;
  candidates: CatalogCandidate[];
  resultState: 'RESULTS' | 'COLLECTING' | 'UNAVAILABLE' | 'EMPTY';
  freshness: 'FRESH' | 'STALE' | 'UNKNOWN';
  nextCursor: string | null;
  visibleCount: number;
  truncated: boolean;
  collection: CatalogCollection;
  lastUpdatedAt?: string | null;
  revalidateAfter?: string | null;
}
export interface CatalogCapabilities {
  operator: boolean;
}
export interface CatalogOperations {
  sources: {
    id: number;
    code: string;
    label: string;
    adapterType: string;
    state: string;
    readiness: string;
    metadataPolicy: string;
    coverPolicy: string;
    requestsToday: number;
    dailyLimit: number;
    backoffUntil?: string | null;
    policyReference: string;
  }[];
  jobs: {
    id: number;
    source: string;
    kind: string;
    state: string;
    attempts: number;
    availableAt: string;
    deadlineAt: string;
    errorCode?: string | null;
  }[];
  usedBytes: number;
  limitBytes: number;
  warningPercent: number;
  coverCount: number;
}
