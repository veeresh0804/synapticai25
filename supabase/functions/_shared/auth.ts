// Shared auth helper for edge functions.
import { createClient } from "jsr:@supabase/supabase-js@2";

export async function requireUser(req: Request): Promise<
  | { ok: true; userId: string; jwt: string }
  | { ok: false; status: 401 }
> {
  const authHeader = req.headers.get("Authorization");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401 };
  }
  const jwt = authHeader.slice("Bearer ".length).trim();
  // Reject bare anon key (no user context)
  if (!jwt || jwt === anonKey) return { ok: false, status: 401 };

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user?.id) return { ok: false, status: 401 };
  return { ok: true, userId: data.user.id, jwt };
}
