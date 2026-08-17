import { useEffect, useMemo, useRef, useState } from 'react';
import {
  appendTranscript,
  collectFinalTranscript,
  getSpeechRecognitionConstructor,
  type SpeechRecognitionLike,
} from '@/lib/speech-recognition';

interface UseSpeechRecognitionOptions {
  language?: string;
  messages?: {
    permissionDenied: string;
    retry: string;
    startFailed: string;
    unsupported: string;
  };
  onTranscript: (value: string) => void;
  value: string;
}

const defaultMessages = {
  permissionDenied: 'Microphone permission is required.',
  retry: 'Please try dictation again.',
  startFailed: 'Could not start dictation.',
  unsupported: 'Speech input is not supported in this browser.',
};

export function useSpeechRecognition({
  language = 'en-US',
  messages = defaultMessages,
  onTranscript,
  value,
}: UseSpeechRecognitionOptions) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const valueRef = useRef(value);
  const onTranscriptRef = useRef(onTranscript);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);

  const Recognition = useMemo(() => getSpeechRecognitionConstructor(), []);
  const supported = Boolean(Recognition);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(
    () => () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    },
    [],
  );

  function stop() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }

  function start() {
    if (!Recognition) {
      setError(messages.unsupported);
      return;
    }

    if (recognitionRef.current) {
      stop();
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = language;
    recognition.onresult = (event) => {
      const transcript = collectFinalTranscript(event);
      if (!transcript) {
        return;
      }

      const nextValue = appendTranscript(valueRef.current, transcript);
      valueRef.current = nextValue;
      onTranscriptRef.current(nextValue);
    };
    recognition.onerror = (event) => {
      setError(event.error === 'not-allowed' ? messages.permissionDenied : messages.retry);
      stop();
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setError(null);
      setListening(true);
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setError(messages.startFailed);
    }
  }

  return {
    error,
    listening,
    start,
    stop,
    supported,
    toggle: listening ? stop : start,
  };
}
