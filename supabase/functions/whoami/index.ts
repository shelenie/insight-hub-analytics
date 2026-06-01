import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Missing Supabase environment variables",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Missing Authorization header",
      }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Could not read authenticated user",
        details: userError?.message ?? null,
      }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { data: permissions, error: permissionsError } = await supabase
    .from("v_current_user_permissions")
    .select("*")
    .limit(1);

  return new Response(
    JSON.stringify({
      ok: true,
      function: "whoami",
      user: {
        id: user.id,
        email: user.email,
      },
      permissions: permissions?.[0] ?? null,
      permissionsError: permissionsError?.message ?? null,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
