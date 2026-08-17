import { ApiRequestError, fetchWithAuthRetry, readFetchEnvelope } from './api-client';

export interface StreamEvent {
  event: string;
  data: unknown;
}

export function parseStreamBlock(block: string): StreamEvent | undefined {
  const lines = block.split(/\r?\n/);
  const event = lines
    .find((line) => line.startsWith('event:'))
    ?.slice('event:'.length)
    .trim();
  const data = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trim())
    .join('\n');

  if (!event || !data) return undefined;
  return { event, data: JSON.parse(data) as unknown };
}

function consumeEvent<T>(event: StreamEvent, onEvent: (event: StreamEvent) => void): T | undefined {
  onEvent(event);
  if (event.event === 'message.error') {
    const data = event.data as { code?: string };
    throw new ApiRequestError(data.code || 'STREAM_MESSAGE_FAILED');
  }
  return event.event === 'message.done' ? (event.data as T) : undefined;
}

export async function postStream<T>(
  path: string,
  body: unknown,
  onEvent: (event: StreamEvent) => void,
): Promise<T> {
  const response = await fetchWithAuthRetry(path, {
    method: 'POST',
    headers: { Accept: 'text/event-stream' },
    body: JSON.stringify(body),
  });

  if (!response.ok) await readFetchEnvelope<T>(response);
  if (!response.body) throw new ApiRequestError('STREAM_MESSAGE_FAILED');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalData: T | undefined;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || '';

    for (const block of blocks) {
      const event = parseStreamBlock(block);
      if (event) finalData = consumeEvent<T>(event, onEvent) ?? finalData;
    }
    if (done) break;
  }

  if (buffer.trim()) {
    const event = parseStreamBlock(buffer);
    if (event) finalData = consumeEvent<T>(event, onEvent) ?? finalData;
  }

  if (!finalData) throw new ApiRequestError('STREAM_MESSAGE_FAILED');
  return finalData;
}
