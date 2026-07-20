import "server-only";
import { serverEnv } from "@/lib/env";
import { mockProvider } from "./providers/mock";
import { openAiProvider } from "./providers/openai";
import type { AiProvider } from "./types";

let cached: AiProvider | null = null;

export function aiProvider(): AiProvider {
  if (cached) return cached;
  const env = serverEnv();
  if (env.AI_PROVIDER === "openai" && env.OPENAI_API_KEY) {
    cached = openAiProvider();
  } else {
    cached = mockProvider();
  }
  return cached;
}
