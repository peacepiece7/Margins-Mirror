import { useEffect, useRef, useState } from 'react';

interface PersistedMessage {
  messageId: number;
  role: string;
  content: string;
}

export function useOptimisticMessage(messages: readonly PersistedMessage[]) {
  const sequence = useRef(0);
  const [pending, setPending] = useState<{
    message: { messageId: string; content: string };
    previousIds: ReadonlySet<number>;
  }>();
  const persisted = Boolean(
    pending &&
    messages.some(
      (message) =>
        message.role === 'user' &&
        message.content === pending.message.content &&
        !pending.previousIds.has(message.messageId),
    ),
  );

  useEffect(() => {
    if (persisted) setPending(undefined);
  }, [persisted]);

  return {
    message: persisted ? undefined : pending?.message,
    begin(content: string) {
      setPending({
        message: { messageId: `pending-message-${++sequence.current}`, content },
        previousIds: new Set(messages.map((message) => message.messageId)),
      });
    },
    clear() {
      setPending(undefined);
    },
  };
}
