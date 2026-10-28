export type ApiErrorCode = string;

export type ApiFieldError = {
  field: string;
  code: ApiErrorCode;
};

export type ApiErrorPayload = {
  code: ApiErrorCode;
  fields?: ApiFieldError[];
  message?: string;
  requestId?: string;
};

export type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  error: ApiErrorPayload | null;
};

export type SessionSnapshot = {
  accessToken?: string;
  lifetime: number;
  userId?: number;
};

export type AuthBridge = {
  current(): SessionSnapshot;
  expire(bound: SessionSnapshot): Promise<void>;
  isCurrent(bound: SessionSnapshot): boolean;
  refresh(bound: SessionSnapshot): Promise<SessionSnapshot>;
  requireConsent(): void;
};

export type ApiRequestOptions = Omit<RequestInit, 'body' | 'headers' | 'method'> & {
  auth?: boolean;
  body?: unknown;
  headers?: Record<string, string>;
  method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';
};
