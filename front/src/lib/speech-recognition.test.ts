import { describe, expect, it } from 'vitest';
import {
  appendTranscript,
  collectFinalTranscript,
  getSpeechRecognitionConstructor,
  type SpeechRecognitionEventLike,
  type SpeechRecognitionResultLike,
} from './speech-recognition';

function makeResult(transcript: string, isFinal: boolean): SpeechRecognitionResultLike {
  const alternative = { transcript };

  return {
    0: alternative,
    isFinal,
    item: () => alternative,
    length: 1,
  };
}

function makeEvent(
  results: SpeechRecognitionResultLike[],
  resultIndex = 0,
): SpeechRecognitionEventLike {
  return {
    resultIndex,
    results: {
      ...results,
      item: (index: number) => results[index],
      length: results.length,
    },
  };
}

describe('speechRecognition', () => {
  it('appends a transcript to the current draft with one separating space', () => {
    expect(appendTranscript('', ' 첫 문장 ')).toBe('첫 문장');
    expect(appendTranscript('이미 쓴 문장   ', ' 다음 문장 ')).toBe('이미 쓴 문장 다음 문장');
  });

  it('keeps the draft unchanged when the transcript is blank', () => {
    expect(appendTranscript('기존 초안', '   ')).toBe('기존 초안');
  });

  it('collects final recognition results and skips interim text', () => {
    const event = makeEvent([
      makeResult('확정 문장', true),
      makeResult('임시 문장', false),
      makeResult('다음 확정', true),
    ]);

    expect(collectFinalTranscript(event)).toBe('확정 문장 다음 확정');
  });

  it('uses the standard or webkit speech recognition constructor', () => {
    class StandardRecognition {}
    class WebkitRecognition {}

    expect(
      getSpeechRecognitionConstructor({ SpeechRecognition: StandardRecognition } as never),
    ).toBe(StandardRecognition);
    expect(
      getSpeechRecognitionConstructor({ webkitSpeechRecognition: WebkitRecognition } as never),
    ).toBe(WebkitRecognition);
    expect(getSpeechRecognitionConstructor(undefined)).toBeUndefined();
  });
});
