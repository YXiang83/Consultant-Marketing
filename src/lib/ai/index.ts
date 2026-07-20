import "server-only";
import { serverEnv } from "@/lib/env";
import { mockProvider } from "./providers/mock";
import { openAiProvider } from "./providers/openai";
import type { AiProvider } from "./types";

let cached: AiProvider | null = null;

export function aiProvider(): AiProvider {
  if (cached) return cached;
  const env = serverEnv();

  if (env.AI_PROVIDER === "mock") {
    cached = mockProvider();
    return cached;
  }

  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing. Add it to the server environment before using the consultant.");
  }

  cached = openAiProvider();
  return cached;
}
