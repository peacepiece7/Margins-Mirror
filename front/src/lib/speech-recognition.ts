export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export interface SpeechRecognitionResultAlternativeLike {
  transcript: string;
}

export interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionResultAlternativeLike;
  [index: number]: SpeechRecognitionResultAlternativeLike;
}

export interface SpeechRecognitionResultListLike {
  readonly length: number;
  item(index: number): SpeechRecognitionResultLike;
  [index: number]: SpeechRecognitionResultLike;
}

export interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

export interface SpeechRecognitionErrorEventLike {
  readonly error: string;
}

export interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start(): void;
  stop(): void;
}

export type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

export function getSpeechRecognitionConstructor(
  targetWindow: SpeechRecognitionWindow | undefined = typeof window === 'undefined'
    ? undefined
    : window,
): SpeechRecognitionConstructor | undefined {
  if (!targetWindow) {
    return undefined;
  }

  return targetWindow.SpeechRecognition || targetWindow.webkitSpeechRecognition;
}

export function appendTranscript(current: string, transcript: string) {
  const next = transcript.trim();

  if (!next) {
    return current;
  }

  const existing = current.trimEnd();

  if (!existing) {
    return next;
  }

  return `${existing} ${next}`;
}

export function collectFinalTranscript(event: SpeechRecognitionEventLike) {
  const chunks: string[] = [];

  for (let index = event.resultIndex; index < event.results.length; index += 1) {
    const result = event.results[index] || event.results.item(index);
    const alternative = result[0] || result.item(0);

    if (result.isFinal && alternative?.transcript) {
      chunks.push(alternative.transcript);
    }
  }

  return chunks.join(' ').trim();
}
