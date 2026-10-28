import { fetch as expoFetch } from "expo/fetch";

import { ApiRequestError, apiErrorFromResponse } from "./error";
import type { ApiEnvelope } from "./types";

export type SseEvent = { data: unknown; event: string };

export type StreamRequest = {
  accessToken: string;
  baseUrl: string;
  body: unknown;
  onEvent?(event: SseEvent): void;
  path: string;
  signal?: AbortSignal;
};

export function parseSseBlock(block: string): SseEvent | undefined {
  let event = "";
  const data: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
  }
  if (!event || data.length === 0) return undefined;
  try {
    return { data: JSON.parse(data.join("\n")) as unknown, event };
  } catch {
    throw new ApiRequestError({ code: "STREAM_INVALID_EVENT" });
  }
}

export async function consumeSse<T>(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: SseEvent) => void = () => undefined,
): Promise<T> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalValue: T | undefined;
  let consumedBytes = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (value?.length) consumedBytes = true;
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        finalValue =
          consumeEvent<T>(parseSseBlock(block), onEvent) ?? finalValue;
      }
      if (done) break;
    }
    if (buffer.trim())
      finalValue =
        consumeEvent<T>(parseSseBlock(buffer), onEvent) ?? finalValue;
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiRequestError({
        code: consumedBytes
          ? "STREAM_INTERRUPTED_RECONCILE_REQUIRED"
          : "COMMON_REQUEST_ABORTED",
      });
    }
    throw new ApiRequestError({
      code: consumedBytes
        ? "STREAM_INTERRUPTED_RECONCILE_REQUIRED"
        : "COMMON_NETWORK_ERROR",
    });
  } finally {
    reader.releaseLock();
  }

  if (finalValue === undefined) {
    throw new ApiRequestError({ code: "STREAM_EOF_RECONCILE_REQUIRED" });
  }
  return finalValue;
}

function consumeEvent<T>(
  event: SseEvent | undefined,
  onEvent: (event: SseEvent) => void,
) {
  if (!event) return undefined;
  onEvent(event);
  if (event.event === "message.error") {
    const payload = event.data as { code?: string };
    throw new ApiRequestError({
      code: payload.code || "STREAM_MESSAGE_FAILED",
    });
  }
  return event.event === "message.done" ? (event.data as T) : undefined;
}

export async function postSse<T>({
  accessToken,
  baseUrl,
  body,
  onEvent,
  path,
  signal,
}: StreamRequest): Promise<T> {
  let response: Response;
  try {
    response = await expoFetch(new URL(path, baseUrl).toString(), {
      body: JSON.stringify(body),
      headers: {
        Accept: "text/event-stream",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiRequestError({ code: "COMMON_REQUEST_ABORTED" });
    }
    throw new ApiRequestError({ code: "COMMON_NETWORK_ERROR" });
  }

  if (!response.ok) {
    let envelope: ApiEnvelope<unknown> | undefined;
    try {
      envelope = (await response.json()) as ApiEnvelope<unknown>;
    } catch {
      // Status-derived public code is safer than an unstructured provider message.
    }
    throw apiErrorFromResponse(
      response.status,
      envelope?.error,
      response.headers.get("retry-after"),
    );
  }
  if (!response.body)
    throw new ApiRequestError({ code: "STREAM_BODY_UNAVAILABLE" });
  return consumeSse<T>(response.body, onEvent);
}
