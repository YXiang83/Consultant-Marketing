import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  OPENAI_API_KEY: z.string().min(20).optional(),
  OPENAI_TEXT_MODEL: z.string().default("gpt-5"),
  OPENAI_IMAGE_MODEL: z.string().default("gpt-image-1"),
  AI_PROVIDER: z.enum(["openai", "mock"]).default("openai"),
});

function readPublic() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  };
}

export function publicEnv() {
  const parsed = publicSchema.safeParse(readPublic());
  if (!parsed.success) {
    throw new Error(
      "Missing or invalid public env vars: " +
        parsed.error.issues.map((i) => i.path.join(".")).join(", "),
    );
  }
  return parsed.data;
}

export function serverEnv() {
  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_TEXT_MODEL: process.env.OPENAI_TEXT_MODEL,
    OPENAI_IMAGE_MODEL: process.env.OPENAI_IMAGE_MODEL,
    AI_PROVIDER: process.env.AI_PROVIDER,
  });
  if (!parsed.success) {
    throw new Error(
      "Invalid server env vars: " +
        parsed.error.issues.map((i) => i.path.join(".")).join(", "),
    );
  }
  return parsed.data;
}

export function publicEnvSafe() {
  const parsed = publicSchema.safeParse(readPublic());
  return parsed.success ? parsed.data : null;
}
