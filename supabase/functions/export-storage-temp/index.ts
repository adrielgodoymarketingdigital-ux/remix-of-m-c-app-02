import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKETS = [
  "loja-logos",
  "dispositivos-fotos",
  "origem-documentos",
  "catalogo-assets",
  "avisos-imagens",
  "novidades-assets",
  "produtos-fotos",
  "tutoriais-videos",
  "termos-compra",
  "compras-fotos",
  "compras-documentos",
];

// 7 dias
const EXPIRES_IN = 60 * 60 * 24 * 7;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Proteção: exige usuário autenticado COM role admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const result: Record<string, unknown> = {};
  let totalFiles = 0;

  for (const bucket of BUCKETS) {
    const files: { path: string; size: number; signedUrl: string }[] = [];

    // Lista recursiva
    async function walk(prefix: string) {
      let offset = 0;
      const limit = 1000;
      while (true) {
        const { data, error } = await supabase.storage
          .from(bucket)
          .list(prefix, { limit, offset, sortBy: { column: "name", order: "asc" } });
        if (error) {
          result[bucket] = { error: error.message };
          return;
        }
        if (!data || data.length === 0) break;

        for (const item of data) {
          const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
          // É pasta se não tiver id/metadata
          if (!item.id) {
            await walk(fullPath);
          } else {
            files.push({
              path: fullPath,
              size: (item.metadata as any)?.size ?? 0,
              signedUrl: "",
            });
          }
        }
        if (data.length < limit) break;
        offset += limit;
      }
    }

    try {
      await walk("");

      // Gera signed URLs em lote
      const paths = files.map((f) => f.path);
      if (paths.length > 0) {
        // createSignedUrls aceita array
        const chunks: string[][] = [];
        for (let i = 0; i < paths.length; i += 100) {
          chunks.push(paths.slice(i, i + 100));
        }
        let idx = 0;
        for (const chunk of chunks) {
          const { data: signed, error: signErr } = await supabase.storage
            .from(bucket)
            .createSignedUrls(chunk, EXPIRES_IN);
          if (signErr) {
            result[bucket] = { error: signErr.message, partial: files.slice(0, idx) };
            break;
          }
          for (const s of signed ?? []) {
            if (files[idx]) files[idx].signedUrl = s.signedUrl ?? "";
            idx++;
          }
        }
      }

      result[bucket] = { count: files.length, files };
      totalFiles += files.length;
    } catch (e) {
      result[bucket] = { error: (e as Error).message };
    }
  }

  return new Response(
    JSON.stringify({
      generated_at: new Date().toISOString(),
      expires_in_seconds: EXPIRES_IN,
      total_files: totalFiles,
      buckets: result,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});