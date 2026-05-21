import type {
  HttpsCredentialPromptService,
  HttpsPromptResolutionReason,
} from "@/node/services/httpsCredentialPromptService";
import { createAskpassSession, type AskpassSession } from "./sshAskpass";

export interface HttpsPromptOutcome {
  kind: "username" | "password";
  reason: HttpsPromptResolutionReason;
  response: string;
}

export interface HttpsAskpassSession extends AskpassSession {
  getLastPromptOutcome(): HttpsPromptOutcome | null;
}

/** Classify a raw git askpass prompt string as username or password. */
export function classifyHttpsAskpassPrompt(promptText: string): "username" | "password" {
  if (/^Password/i.test(promptText.trim())) return "password";
  return "username";
}

/** Extract a display-friendly repo URL from the git askpass prompt text. */
export function extractRepoUrlFromPrompt(promptText: string): string {
  const match = /'([^']+)'/.exec(promptText);
  return match?.[1] ?? promptText.trim();
}

export interface HttpsAskpassOptions {
  httpsCredentialPromptService: HttpsCredentialPromptService;
}

/**
 * Creates a per-clone askpass session for HTTPS credential prompting.
 *
 * Reuses the mux-askpass file-IPC script but wires it to GIT_ASKPASS instead
 * of SSH_ASKPASS, so git (not SSH) invokes it for HTTPS credential prompts.
 * Each git credential request (username then password) is a separate invocation.
 */
export async function createHttpsAskpassSession(
  options: HttpsAskpassOptions
): Promise<HttpsAskpassSession> {
  const { httpsCredentialPromptService } = options;
  let lastPromptOutcome: HttpsPromptOutcome | null = null;

  const coreSession = await createAskpassSession(async (promptText) => {
    const kind = classifyHttpsAskpassPrompt(promptText);
    const repoUrl = extractRepoUrlFromPrompt(promptText);

    const resolution = await httpsCredentialPromptService.requestPromptDetailed({
      kind,
      prompt: promptText.trim(),
      repoUrl,
    });

    lastPromptOutcome = {
      kind,
      reason: resolution.reason,
      response: resolution.response,
    };

    return resolution.response;
  });

  return {
    // Map SSH_ASKPASS → GIT_ASKPASS; the mux-askpass script is protocol-agnostic.
    // Intentionally omit SSH_ASKPASS, SSH_ASKPASS_REQUIRE, DISPLAY from env.
    env: {
      GIT_ASKPASS: coreSession.env.SSH_ASKPASS,
      MUX_ASKPASS_DIR: coreSession.env.MUX_ASKPASS_DIR,
    },
    cleanup: () => coreSession.cleanup(),
    getLastPromptOutcome(): HttpsPromptOutcome | null {
      return lastPromptOutcome;
    },
  };
}
