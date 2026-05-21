import { EventEmitter } from "events";
import * as crypto from "crypto";
import { HOST_KEY_APPROVAL_TIMEOUT_MS } from "@/common/constants/ssh";
import type { HttpsCredentialPromptRequest } from "@/common/orpc/schemas/https";

export type HttpsPromptResolutionReason = "responded" | "timeout" | "no_responder";

export interface HttpsPromptResolution {
  response: string;
  reason: HttpsPromptResolutionReason;
}

interface PendingEntry {
  request: HttpsCredentialPromptRequest;
  timer: ReturnType<typeof setTimeout>;
  waiters: Array<(resolution: HttpsPromptResolution) => void>;
}

export class HttpsCredentialPromptService extends EventEmitter {
  private pending = new Map<string, PendingEntry>();
  private activeResponders = 0;
  private readonly timeoutMs: number;

  constructor(timeoutMs = HOST_KEY_APPROVAL_TIMEOUT_MS) {
    super();
    this.timeoutMs = timeoutMs;
  }

  registerInteractiveResponder(): () => void {
    this.activeResponders += 1;

    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      this.activeResponders = Math.max(0, this.activeResponders - 1);
    };
  }

  hasInteractiveResponder(): boolean {
    return this.activeResponders > 0;
  }

  /**
   * Atomic subscribe+snapshot: register listener FIRST, then return current
   * pending requests to avoid missing events between subscription and snapshot.
   */
  subscribeRequests(
    onRequest: (req: HttpsCredentialPromptRequest) => void,
    onRemoved?: (requestId: string) => void
  ): {
    snapshot: HttpsCredentialPromptRequest[];
    unsubscribe: () => void;
  } {
    this.on("request", onRequest);
    if (onRemoved) this.on("removed", onRemoved);
    return {
      snapshot: Array.from(this.pending.values()).map((entry) => entry.request),
      unsubscribe: () => {
        this.off("request", onRequest);
        if (onRemoved) this.off("removed", onRemoved);
      },
    };
  }

  // NOTE: `resolution.response` may contain credentials. Never log response values.
  private finalizeRequest(requestId: string, resolution: HttpsPromptResolution): void {
    const entry = this.pending.get(requestId);
    if (!entry) {
      return;
    }

    clearTimeout(entry.timer);
    this.pending.delete(requestId);
    this.emit("removed", requestId);

    for (const resolve of entry.waiters) {
      resolve(resolution);
    }
  }

  async requestPromptDetailed(
    params: Omit<HttpsCredentialPromptRequest, "requestId">
  ): Promise<HttpsPromptResolution> {
    if (!this.hasInteractiveResponder()) {
      return { response: "", reason: "no_responder" };
    }

    const requestId = crypto.randomUUID();

    return new Promise<HttpsPromptResolution>((resolve) => {
      const request: HttpsCredentialPromptRequest = { requestId, ...params };
      const entry: PendingEntry = {
        request,
        timer: setTimeout(() => {
          this.finalizeRequest(requestId, { response: "", reason: "timeout" });
        }, this.timeoutMs),
        waiters: [resolve],
      };

      this.pending.set(requestId, entry);
      this.emit("request", request);
    });
  }

  async requestPrompt(params: Omit<HttpsCredentialPromptRequest, "requestId">): Promise<string> {
    const resolution = await this.requestPromptDetailed(params);
    return resolution.response;
  }

  respond(requestId: string, response: string): void {
    this.finalizeRequest(requestId, { response, reason: "responded" });
  }
}
