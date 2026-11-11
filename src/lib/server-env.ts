import "server-only";
import { z } from "zod";

/**
 * Server-only environment. Never import from client components: these values
 * must not reach the browser bundle. Everything here is optional so the app
 * runs without it; features that need a value check for it explicitly.
 */
const serverEnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().trim().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function serverEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse({
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || undefined,
  });
  if (!parsed.success) {
    const vars = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid server environment variables: ${vars}. See .env.example.`);
  }
  return parsed.data;
}

/** True when the AI test generator can call the Claude API. */
export function isGeneratorConfigured(): boolean {
  return Boolean(serverEnv().ANTHROPIC_API_KEY);
}
