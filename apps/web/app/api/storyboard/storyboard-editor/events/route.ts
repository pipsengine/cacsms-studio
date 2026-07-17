import { getStoryboardWorkspaceData } from "@/lib/storyboard-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function encodeEvent(data: string) {
  return `event: message\ndata: ${data}\n\n`;
}

export async function GET() {
  const encoder = new TextEncoder();
  let interval: ReturnType<typeof setInterval> | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const closeTimers = () => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = async () => {
        if (closed) return;
        try {
          const payload = await getStoryboardWorkspaceData();
          controller.enqueue(encoder.encode(encodeEvent(JSON.stringify(payload))));
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              encodeEvent(
                JSON.stringify({
                  message: error instanceof Error ? error.message : "Storyboard event stream unavailable."
                })
              )
            )
          );
        }
      };

      await push();
      heartbeat = setInterval(() => {
        if (!closed) {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        }
      }, 10_000);
      interval = setInterval(() => {
        void push();
      }, 15_000);

      controller.enqueue(
        encoder.encode(
          "retry: 5000\n"
        )
      );

      // Clean up automatically if the runtime tears down the stream.
      controller.enqueue(encoder.encode(": storyboard-stream-open\n\n"));
    },
    cancel() {
      closed = true;
      closeTimers();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
