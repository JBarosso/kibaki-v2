// supabase/functions/tournament-tick/index.ts
// Edge Function pour la résolution automatique des tournois
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE) {
  throw new Error("Missing SUPABASE_URL or SERVICE_ROLE_KEY");
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

  try {
    // Use service role client for admin operations
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let payload: any = {};
    try {
      payload = await req.json();
    } catch {
      // Allow empty payload for general tick
    }

    const { tournament_id } = payload;

    if (tournament_id) {
      // Tick specific tournament
      const { data, error } = await supabase.rpc('tournament_tick', { 
        p_tournament_id: tournament_id 
      });

      if (error) {
        console.error(`Error ticking tournament ${tournament_id}:`, error);
        return json(500, { ok: false, error: error.message });
      }

      return json(200, { 
        ok: true, 
        message: `Tournament ${tournament_id} ticked successfully`,
        data 
      });
    } else {
      // Tick all active tournaments that need processing
      // First, get all tournaments that have matches needing resolution
      const { data: tournaments, error: fetchError } = await supabase
        .from('tournaments')
        .select('id, name')
        .eq('status', 'running');

      if (fetchError) {
        console.error('Error fetching tournaments:', fetchError);
        return json(500, { ok: false, error: fetchError.message });
      }

      const results = [];
      for (const tournament of tournaments || []) {
        try {
          const { data, error } = await supabase.rpc('tournament_tick', { 
            p_tournament_id: tournament.id 
          });

          if (error) {
            console.error(`Error ticking tournament ${tournament.id}:`, error);
            results.push({ 
              tournament_id: tournament.id, 
              name: tournament.name,
              success: false, 
              error: error.message 
            });
          } else {
            results.push({ 
              tournament_id: tournament.id, 
              name: tournament.name,
              success: true, 
              data 
            });
          }
        } catch (err: any) {
          console.error(`Exception ticking tournament ${tournament.id}:`, err);
          results.push({ 
            tournament_id: tournament.id, 
            name: tournament.name,
            success: false, 
            error: err.message 
          });
        }
      }

      return json(200, { 
        ok: true, 
        message: `Processed ${results.length} tournaments`,
        results 
      });
    }
  } catch (error: any) {
    console.error('Tournament tick error:', error);
    return json(500, { ok: false, error: error.message });
  }
});
