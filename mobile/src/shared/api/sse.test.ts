import { consumeSse, parseSseBlock } from "./sse";

function stream(chunks: Uint8Array[], failure?: Error) {
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index++];
      if (chunk) {
        controller.enqueue(chunk);
      } else if (failure) {
        controller.error(failure);
      } else {
        controller.close();
      }
    },
  });
}

describe("native SSE parser", () => {
  const encoder = new TextEncoder();

  it("parses LF, CRLF and multiple data fields", () => {
    expect(parseSseBlock('event: message.delta\ndata: {"delta":"LF"}')).toEqual(
      {
        data: { delta: "LF" },
        event: "message.delta",
      },
    );
    expect(
      parseSseBlock('event: message.done\r\ndata: {"messageId":\r\ndata: 1}'),
    ).toEqual({
      data: { messageId: 1 },
      event: "message.done",
    });
  });

  it("preserves UTF-8 characters split across byte chunks and returns done", async () => {
    const bytes = encoder.encode(
      'event: message.delta\ndata: {"delta":"독서"}\n\nevent: message.done\ndata: {"messageId":7}\n\n',
    );
    const koreanLeadByte = bytes.findIndex((value) => value >= 0xe0);
    const events: string[] = [];
    const result = await consumeSse<{ messageId: number }>(
      stream([
        bytes.slice(0, koreanLeadByte + 1),
        bytes.slice(koreanLeadByte + 1, koreanLeadByte + 2),
        bytes.slice(koreanLeadByte + 2),
      ]),
      (event) => events.push(event.event),
    );
    expect(result).toEqual({ messageId: 7 });
    expect(events).toEqual(["message.delta", "message.done"]);
  });

  it("uses stable event error codes and never exposes raw messages", async () => {
    const body = encoder.encode(
      'event: message.error\ndata: {"code":"SESSION_LAST_WINDOW_REQUIRED","message":"raw"}\n\n',
    );
    await expect(consumeSse(stream([body]))).rejects.toMatchObject({
      code: "SESSION_LAST_WINDOW_REQUIRED",
    });
  });

  it("requires reconciliation for EOF or interruption after bytes", async () => {
    await expect(
      consumeSse(
        stream([
          encoder.encode('event: message.delta\ndata: {"delta":"x"}\n\n'),
        ]),
      ),
    ).rejects.toMatchObject({ code: "STREAM_EOF_RECONCILE_REQUIRED" });
    await expect(
      consumeSse(
        stream([encoder.encode("event: message.delta\n")], new Error("socket")),
      ),
    ).rejects.toMatchObject({ code: "STREAM_INTERRUPTED_RECONCILE_REQUIRED" });
  });

  it("maps an aborted reader to a stable cancellation error", async () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    await expect(consumeSse(stream([], abort))).rejects.toMatchObject({
      code: "COMMON_REQUEST_ABORTED",
    });
    await expect(
      consumeSse(
        stream([encoder.encode("event: message.delta\ndata: ")], abort),
      ),
    ).rejects.toMatchObject({
      code: "STREAM_INTERRUPTED_RECONCILE_REQUIRED",
    });
  });
});
