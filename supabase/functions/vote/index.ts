// supabase/functions/vote/index.ts
// Use the built-in Deno.serve instead of std/http "serve"
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
/** Secret name without SUPABASE_ prefix (Dashboard forbids that prefix) */
const SERVICE_ROLE =
  Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? undefined;

if (!SUPABASE_URL || !ANON) throw new Error("Missing SUPABASE_URL / SUPABASE_ANON_KEY");
if (!SERVICE_ROLE) throw new Error("Missing SERVICE_ROLE_KEY");

const DEV = Deno.env.get("ENV") === "dev";

function getIp(req: Request): string | null {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    null
  );
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json(400, { ok: false, error: "Invalid JSON" });
  }

  const { winner_id, loser_id, nonce } = payload ?? {};
  if (typeof winner_id !== "number" || typeof loser_id !== "number" || winner_id === loser_id) {
    return json(400, { ok: false, error: "Invalid winner_id/loser_id" });
  }
  if (nonce != null && (typeof nonce !== "string" || nonce.length > 100)) {
    return json(400, { ok: false, error: "Invalid nonce" });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const ip = getIp(req);
  const ua = req.headers.get("user-agent") ?? undefined;

  // Client that can read the current user (uses forwarded Authorization)
  const authClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await authClient.auth.getUser();
  const userId = userData?.user?.id ?? null;

  // Use caller token (user JWT if logged in, else anon) to call the RPC.
  // This works because vote_apply is SECURITY DEFINER and EXECUTE is granted to anon/authenticated.
  const execClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await execClient.rpc("vote_apply", {
    p_winner_id: winner_id,
    p_loser_id: loser_id,
    p_user_id: userId,
    p_nonce: nonce ?? null,
    p_client_ip: ip ?? null,
    p_user_agent: ua ?? null,
  });

  if (error) {
    if (DEV) console.error("RPC error", error);
    return json(500, { ok: false, error: error.message ?? "rpc_error" });
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (row?.rate_limited) return json(429, { ok: false, reason: "rate_limited" });
  if (row?.already_processed) return json(200, { ok: true, duplicate: true, data });

  return json(200, { ok: true, data });
});
