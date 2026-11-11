import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { serverEnv } from "@/lib/server-env";
import { buildUserMessage, SYSTEM_PROMPT, type PromptInput } from "./prompt";
import { generatedSuiteSchema, type GeneratedSuite } from "./schemas";

const MODEL = "claude-opus-5-5";

export type GenerationResult = { ok: true; suite: GeneratedSuite } | { ok: false; message: string };

let client: Anthropic | undefined;

function getClient(apiKey: string): Anthropic {
  client ??= new Anthropic({ apiKey, timeout: 120_000, maxRetries: 2 });
  return client;
}

/**
 * Asks Claude for test cases as structured JSON. Errors are mapped to safe,
 * user-facing messages; details are logged server-side only.
 */
export async function generateTestSuite(input: PromptInput): Promise<GenerationResult> {
  const { ANTHROPIC_API_KEY } = serverEnv();
  if (!ANTHROPIC_API_KEY) {
    return { ok: false, message: "The test generator isn't configured. Set ANTHROPIC_API_KEY on the server." };
  }

  try {
    const response = await getClient(ANTHROPIC_API_KEY).beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // If a safety classifier declines, the API retries on a fallback model
      // within the same call (server-side fallback, routed by refusal category).
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildUserMessage(input) }],
      output_config: { effort: "medium", format: betaZodOutputFormat(generatedSuiteSchema) },
    });

    if (response.stop_reason === "refusal") {
      return { ok: false, message: "Claude declined to generate tests for this description. Try rephrasing it." };
    }
    if (response.stop_reason === "max_tokens") {
      return { ok: false, message: "The response was too long. Ask for fewer tests or a narrower description." };
    }
    if (!response.parsed_output) {
      console.error("[generator] no parsed output", response.stop_reason);
      return { ok: false, message: "Claude returned an unexpected response. Please try again." };
    }
    return { ok: true, suite: response.parsed_output };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      console.error("[generator] auth", error.status, error.message);
      return { ok: false, message: "The Claude API key is invalid or lacks access. Check ANTHROPIC_API_KEY." };
    }
    if (error instanceof Anthropic.RateLimitError) {
      return { ok: false, message: "The test generator is busy right now. Please try again in a minute." };
    }
    if (error instanceof Anthropic.APIConnectionTimeoutError || error instanceof Anthropic.APIConnectionError) {
      console.error("[generator] connection", error.message);
      return { ok: false, message: "Couldn't reach the Claude API. Please try again." };
    }
    if (error instanceof Anthropic.APIError) {
      console.error("[generator] api", error.status, error.message);
      return { ok: false, message: "The test generator failed. Please try again." };
    }
    // E.g. the SDK failing to parse output against the schema.
    console.error("[generator] unexpected", error);
    return { ok: false, message: "Claude returned output that couldn't be read. Please try again." };
  }
}
