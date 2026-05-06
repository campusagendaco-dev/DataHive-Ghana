import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { provider_id } = await req.json();
    if (!provider_id) throw new Error("Missing provider_id");

    const { data: provider, error: providerError } = await supabaseAdmin
      .from("providers")
      .select("*")
      .eq("id", provider_id)
      .single();

    if (providerError || !provider) throw new Error("Provider not found");

    const handlerType = provider.handler_type || "standard";
    const apiKey = provider.api_key;
    const baseUrl = provider.base_url?.replace(/\/+$/, "");

    if (!apiKey || !baseUrl) throw new Error("Provider API key or Base URL missing");

    let packagesSynced = 0;
    let balance = provider.balance;

    if (handlerType === "datamart" || handlerType === "standard") {
      console.log(`Syncing ${handlerType} provider: ${provider.name}`);

      const cleanBase = baseUrl.trim().replace(/\/+$/, "");

      // 1. Sync Packages
      const packageUrlVariations = [
        `${cleanBase}/data-packages`,
        `${cleanBase}/api/data-packages`,
        `${cleanBase}/developer/data-packages`,
        `${cleanBase}/api/developer/data-packages`,
        `${cleanBase}/packages`
      ];

      let res;
      for (const url of packageUrlVariations) {
        console.log(`[sync] Trying package URL: ${url}`);
        const response = await fetch(url, {
          headers: { "X-API-Key": apiKey, "Accept": "application/json" }
        });
        if (response.ok) {
          res = response;
          break;
        }
      }

      if (res) {
        const result = await res.json();
        const rawData = result.data || result.packages || result;
        if (rawData && typeof rawData === "object") {
          const allPackages = [];

          // Handle both DataMart (nested by network) and Standard (array or object)
          const networks = handlerType === "datamart" ? Object.keys(rawData) : ["MTN", "Telecel", "AirtelTigo"];

          for (const netKey of networks) {
            const netPackages = handlerType === "datamart" ? rawData[netKey] : (Array.isArray(rawData) ? rawData : []);
            if (!Array.isArray(netPackages)) continue;

            let dbNetwork = netKey;
            if (netKey === "YELLO") dbNetwork = "MTN";

            for (const pkg of netPackages) {
              // Skip if package doesn't match network for standard array
              if (handlerType === "standard" && pkg.network && pkg.network !== netKey) continue;

              allPackages.push({
                provider_id: provider.id,
                network: dbNetwork,
                package_name: pkg.capacity >= 1 ? `${pkg.capacity}GB` : (pkg.package_name || `${pkg.mb || 0}MB`),
                capacity_gb: pkg.capacity || ((pkg.mb || 0) / 1024),
                cost_price: pkg.price || pkg.amount,
                external_id: String(pkg.id || pkg.package_id || `${dbNetwork}_${pkg.capacity}`),
                raw_data: pkg,
                is_active: true
              });
            }
          }

          if (allPackages.length > 0) {
            const { error: upsertError } = await supabaseAdmin
              .from("provider_packages")
              .upsert(allPackages, { onConflict: "provider_id,network,package_name" });
            if (upsertError) console.error("Package upsert error:", upsertError);
            packagesSynced = allPackages.length;
          }
        }
      }

      // 2. Sync Balance
      const balanceUrlVariations = [
        `${cleanBase}/balance`,
        `${cleanBase}/api/balance`,
        `${cleanBase}/developer/balance`,
        `${cleanBase}/api/developer/balance`
      ];

      for (const url of balanceUrlVariations) {
        console.log(`[sync] Trying balance URL: ${url}`);
        const balanceRes = await fetch(url, {
          headers: { "X-API-Key": apiKey, "Accept": "application/json" }
        });

        if (balanceRes.ok) {
          const bResult = await balanceRes.json();
          const rawBal = bResult.data?.rawBalance || bResult.data?.balance || bResult.balance;
          if (rawBal !== undefined) {
            // Clean currency symbols if it's a string
            balance = typeof rawBal === "string" ? parseFloat(rawBal.replace(/[^\d.]/g, "")) : Number(rawBal);
            console.log(`[sync] Found balance: ${balance}`);
            break;
          }
        }
      }
    } else if (handlerType === "datahub") {
      console.log(`Syncing DataHub Ghana provider: ${provider.name}`);

      // DataHub bundles live at /api/bundles (not under /api/external)
      const origin = new URL(baseUrl).origin;
      const bundlesUrl = `${origin}/api/bundles`;

      console.log(`[sync:datahub] Fetching bundles from: ${bundlesUrl}`);
      const bundlesRes = await fetch(bundlesUrl, {
        headers: { "X-API-Key": apiKey, "Accept": "application/json" }
      });

      if (bundlesRes.ok) {
        const result = await bundlesRes.json();
        const networks: any[] = result.networks || [];
        const allPackages = [];

        const networkKeyToDb: Record<string, string> = {
          YELLO: "MTN",
          TELECEL: "Telecel",
          AT_PREMIUM: "AirtelTigo",
          AT_BIGTIME: "AirtelTigo",
        };

        for (const network of networks) {
          if (!network.isActive) continue;
          const dbNetwork = networkKeyToDb[network.networkKey] || network.networkKey;
          const bundles: any[] = network.bundles || [];

          for (const bundle of bundles) {
            if (!bundle.isActive) continue;
            const capacityGb = (bundle.sizeInMB || 0) / 1024;

            allPackages.push({
              provider_id: provider.id,
              network: dbNetwork,
              package_name: bundle.size,
              capacity_gb: capacityGb,
              cost_price: bundle.price,
              external_id: bundle.id,
              raw_data: { ...bundle, networkKey: network.networkKey },
              is_active: true,
            });
          }
        }

        if (allPackages.length > 0) {
          const { error: upsertError } = await supabaseAdmin
            .from("provider_packages")
            .upsert(allPackages, { onConflict: "provider_id,network,package_name" });
          if (upsertError) console.error("[sync:datahub] Package upsert error:", upsertError);
          packagesSynced = allPackages.length;
          console.log(`[sync:datahub] Synced ${packagesSynced} packages`);
        }
      } else {
        console.error(`[sync:datahub] Bundles fetch failed: ${bundlesRes.status}`);
      }

      // Sync Balance — GET /api/external/balance
      const balanceRes = await fetch(`${baseUrl}/balance`, {
        headers: { "X-API-Key": apiKey, "Accept": "application/json" }
      });

      if (balanceRes.ok) {
        const bResult = await balanceRes.json();
        const rawBal = bResult.data?.balance ?? bResult.balance;
        if (rawBal !== undefined) {
          balance = typeof rawBal === "string" ? parseFloat(rawBal.replace(/[^\d.]/g, "")) : Number(rawBal);
          console.log(`[sync:datahub] Balance: GHS ${balance}`);
        }
      } else {
        console.warn(`[sync:datahub] Balance fetch failed: ${balanceRes.status}`);
      }
    } else {
      throw new Error(`Sync not implemented for handler type: ${handlerType}`);
    }

    // Update last sync time
    await supabaseAdmin
      .from("providers")
      .update({ 
        last_synced_at: new Date().toISOString(),
        balance: balance
      })
      .eq("id", provider.id);

    return new Response(JSON.stringify({ 
      success: true, 
      packages_synced: packagesSynced,
      balance: balance 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("[sync-provider-data] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
