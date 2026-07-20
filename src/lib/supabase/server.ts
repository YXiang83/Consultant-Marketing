import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

export const APP_DB_SCHEMA = "consultant_marketing";

export async function supabaseServer() {
  const env = publicEnv();
  const cookieStore = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    db: { schema: APP_DB_SCHEMA },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(entries) {
        try {
          for (const { name, value, options } of entries) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render — cookies are read-only.
        }
      },
    },
  });
}

export function supabaseAdmin() {
  const pub = publicEnv();
  const srv = serverEnv();
  if (!srv.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for server-only admin client");
  }
  return createClient(pub.NEXT_PUBLIC_SUPABASE_URL, srv.SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: APP_DB_SCHEMA },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function requireUser() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return { supabase, user: data.user };
}
