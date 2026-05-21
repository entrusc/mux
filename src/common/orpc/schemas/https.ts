import { z } from "zod";

export const HttpsCredentialPromptRequestSchema = z
  .object({
    requestId: z.string(),
    kind: z.enum(["username", "password"]),
    prompt: z.string(),
    repoUrl: z.string(),
  })
  .strict();

export type HttpsCredentialPromptRequest = z.infer<typeof HttpsCredentialPromptRequestSchema>;

const HttpsCredentialPromptRequestEventSchema = HttpsCredentialPromptRequestSchema.extend({
  type: z.literal("request"),
}).strict();

export const HttpsPromptEventSchema = z.union([
  HttpsCredentialPromptRequestEventSchema,
  z.object({ type: z.literal("removed"), requestId: z.string() }).strict(),
]);

export type HttpsPromptEvent = z.infer<typeof HttpsPromptEventSchema>;

export const HttpsPromptResponseInputSchema = z
  .object({
    requestId: z.string(),
    response: z.string(),
  })
  .strict();

export type HttpsPromptResponseInput = z.infer<typeof HttpsPromptResponseInputSchema>;
