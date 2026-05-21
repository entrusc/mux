import { useEffect, useState } from "react";
import { useAPI } from "@/browser/contexts/API";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/browser/components/Dialog/Dialog";
import { Button } from "@/browser/components/Button/Button";
import { Input } from "@/browser/components/Input/Input";
import type { HttpsCredentialPromptRequest, HttpsPromptEvent } from "@/common/orpc/schemas/https";

export function HttpsCredentialPromptDialog() {
  const { api } = useAPI();
  const [pendingQueue, setPendingQueue] = useState<HttpsCredentialPromptRequest[]>([]);
  const pending = pendingQueue[0] ?? null;
  const [responding, setResponding] = useState(false);
  const [credentialInput, setCredentialInput] = useState("");

  useEffect(() => {
    if (!api) {
      setPendingQueue([]);
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    let iteratorRef: AsyncIterator<HttpsPromptEvent> | undefined;

    // Global subscription: backend requests HTTPS credential prompts during clone/pull.
    // Queue pending requests so concurrent prompts are handled FIFO without drops.
    (async () => {
      try {
        const iterable = await api.https.prompt.subscribe(undefined, { signal });
        const iterator = iterable[Symbol.asyncIterator]();

        if (signal.aborted) {
          void iterator.return?.(undefined);
          return;
        }

        iteratorRef = iterator;

        while (!signal.aborted) {
          const { value: event, done } = await iterator.next();
          if (done) {
            break;
          }

          if (event.type === "removed") {
            setPendingQueue((prev) => prev.filter((item) => item.requestId !== event.requestId));
          } else {
            const { type: _type, ...request } = event;
            setPendingQueue((prev) =>
              prev.some((item) => item.requestId === request.requestId) ? prev : [...prev, request]
            );
          }
        }
      } catch {
        // Subscription closed (cleanup/reconnect): no-op
      }
    })();

    return () => {
      controller.abort();
      void iteratorRef?.return?.(undefined);
      setPendingQueue([]);
    };
  }, [api]);

  useEffect(() => {
    // Each new prompt needs a fresh input field; carry-over risks sending stale secrets.
    setCredentialInput("");
  }, [pending?.requestId]);

  const respond = async (response: string) => {
    if (!api || !pending || responding) {
      return;
    }

    const requestId = pending.requestId;
    setResponding(true);

    try {
      await api.https.prompt.respond({ requestId, response });
      // Dequeue only on success — RPC failure keeps prompt visible for retry.
      setPendingQueue((prev) => prev.filter((item) => item.requestId !== requestId));
    } catch {
      // Transport/RPC failure: keep current request in queue so user can retry.
    } finally {
      setResponding(false);
    }
  };

  return (
    <Dialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (open || responding || !pending) {
          return;
        }
        // Treat dismiss/escape as cancellation so the backend unblocks promptly.
        void respond("");
      }}
    >
      <DialogContent maxWidth="500px" showCloseButton={false}>
        {pending !== null && (
          <>
            <DialogHeader>
              <DialogTitle>Git Authentication Required</DialogTitle>
              <DialogDescription>
                {pending.repoUrl ? `Enter credentials for ${pending.repoUrl}` : pending.prompt}
              </DialogDescription>
            </DialogHeader>

            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void respond(credentialInput);
              }}
            >
              <Input
                autoFocus
                type={pending.kind === "password" ? "password" : "text"}
                placeholder={pending.kind === "password" ? "Password" : "Username"}
                value={credentialInput}
                disabled={responding}
                onChange={(event) => {
                  setCredentialInput(event.target.value);
                }}
              />

              <DialogFooter className="justify-center">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={responding}
                  onClick={() => {
                    void respond("");
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="default" disabled={responding}>
                  {responding ? "Submitting..." : "Submit"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
