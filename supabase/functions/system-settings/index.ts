import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_SETTINGS = {
  active_api_source: "primary",
  secondary_price_markup_pct: 8.11,
  auto_api_switch: false,
  preferred_provider: "primary",
  backup_provider: "secondary",
  holiday_mode_enabled: false,
  holiday_message: "Holiday mode is active. Orders will resume soon.",
  disable_ordering: false,
  dark_mode_enabled: false,
  customer_service_number: "+233203256540",
  support_channel_link: "https://whatsapp.com/channel/0029Vb6Xwed60eBaztkH2B3m",
  sub_agent_base_fee: 80,
};

const isMissingColumnError = (message: string, column: string) => {
  const lower = message.toLowerCase();
  return lower.includes("could not find") && lower.includes(column.toLowerCase());
};

const saveSettingsRow = async (supabaseAdmin: ReturnType<typeof createClient>, row: Record<string, unknown>) => {
  let payload = { ...row };

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { error } = await supabaseAdmin.from("system_settings").upsert(payload);
    if (!error) {
      return { error: null, payload };
    }

    const msg = String(error.message || "");

    if (payload.updated_by && isMissingColumnError(msg, "updated_by")) {
      const { updated_by: _drop, ...next } = payload;
      payload = next;
      continue;
    }

    if (payload.active_api_source && isMissingColumnError(msg, "active_api_source")) {
      const { active_api_source: _drop, ...next } = payload;
      payload = next;
      continue;
    }

    if (payload.secondary_price_markup_pct && isMissingColumnError(msg, "secondary_price_markup_pct")) {
      const { secondary_price_markup_pct: _drop, ...next } = payload;
      payload = next;
      continue;
    }

    if (payload.sub_agent_base_fee && isMissingColumnError(msg, "sub_agent_base_fee")) {
      const { sub_agent_base_fee: _drop, ...next } = payload;
      payload = next;
      continue;
    }

    return { error, payload };
  }

  return { error: { message: "Unable to save settings with current schema" }, payload };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured: missing Supabase env" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const readSettings = async () => {
    const { data, error } = await supabaseAdmin
      .from("system_settings")
      .select("auto_api_switch, preferred_provider, backup_provider, holiday_mode_enabled, holiday_message, disable_ordering, dark_mode_enabled, customer_service_number, support_channel_link, active_api_source, secondary_price_markup_pct, sub_agent_base_fee")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      const missingTable = error.message.toLowerCase().includes("system_settings");
      return {
        ...DEFAULT_SETTINGS,
        table_ready: !missingTable,
        warning: missingTable ? "system_settings table missing" : error.message,
      };
    }

    return {
      auto_api_switch: Boolean(data?.auto_api_switch),
      preferred_provider: String(data?.preferred_provider || DEFAULT_SETTINGS.preferred_provider),
      backup_provider: String(data?.backup_provider || DEFAULT_SETTINGS.backup_provider),
      active_api_source: String(data?.active_api_source || data?.preferred_provider || DEFAULT_SETTINGS.active_api_source),
      secondary_price_markup_pct: Number(data?.secondary_price_markup_pct ?? DEFAULT_SETTINGS.secondary_price_markup_pct),
      holiday_mode_enabled: Boolean(data?.holiday_mode_enabled),
      holiday_message: String(data?.holiday_message || DEFAULT_SETTINGS.holiday_message),
      disable_ordering: Boolean(data?.disable_ordering),
      dark_mode_enabled: Boolean(data?.dark_mode_enabled),
      customer_service_number: String(data?.customer_service_number || DEFAULT_SETTINGS.customer_service_number),
      support_channel_link: String(data?.support_channel_link || DEFAULT_SETTINGS.support_channel_link),
      sub_agent_base_fee: Number(data?.sub_agent_base_fee ?? DEFAULT_SETTINGS.sub_agent_base_fee),
      table_ready: true,
      warning: null,
    };
  };

  try {
    const payload = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = payload?.action === "set" ? "set" : "get";

    if (action === "get") {
      const settings = await readSettings();
      return new Response(JSON.stringify({ success: true, ...settings }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .limit(1);

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const preferredProvider = payload?.preferred_provider === "secondary" ? "secondary" : "primary";
    const backupProvider = payload?.backup_provider === "primary" ? "primary" : "secondary";
    const activeApiSource = payload?.active_api_source === "secondary" ? "secondary" : "primary";
    const markupPct = Number(payload?.secondary_price_markup_pct);
    const secondaryMarkupPct = Number.isFinite(markupPct) ? Math.max(0, markupPct) : DEFAULT_SETTINGS.secondary_price_markup_pct;
    const subAgentBaseFeeRaw = Number(payload?.sub_agent_base_fee);
    const subAgentBaseFee = Number.isFinite(subAgentBaseFeeRaw)
      ? Math.max(0, Number(subAgentBaseFeeRaw.toFixed(2)))
      : DEFAULT_SETTINGS.sub_agent_base_fee;
    const holidayMessage =
      String(payload?.holiday_message || DEFAULT_SETTINGS.holiday_message).trim() || DEFAULT_SETTINGS.holiday_message;
    const customerServiceNumber =
      String(payload?.customer_service_number || DEFAULT_SETTINGS.customer_service_number).trim() ||
      DEFAULT_SETTINGS.customer_service_number;
    const supportChannelLink = String(payload?.support_channel_link || "").trim() || DEFAULT_SETTINGS.support_channel_link;

    const row = {
      id: 1,
      auto_api_switch: Boolean(payload?.auto_api_switch),
      preferred_provider: activeApiSource || preferredProvider,
      backup_provider: backupProvider,
      active_api_source: activeApiSource,
      secondary_price_markup_pct: secondaryMarkupPct,
      holiday_mode_enabled: Boolean(payload?.holiday_mode_enabled),
      holiday_message: holidayMessage,
      disable_ordering: Boolean(payload?.disable_ordering),
      dark_mode_enabled: Boolean(payload?.dark_mode_enabled),
      customer_service_number: customerServiceNumber,
      support_channel_link: supportChannelLink,
      sub_agent_base_fee: subAgentBaseFee,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    };

    const { error: saveError, payload: persistedRow } = await saveSettingsRow(supabaseAdmin, row);

    if (saveError) {
      return new Response(JSON.stringify({ error: saveError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      ...persistedRow,
      active_api_source: String((persistedRow.active_api_source as string) || (persistedRow.preferred_provider as string) || activeApiSource),
      secondary_price_markup_pct: Number(persistedRow.secondary_price_markup_pct ?? secondaryMarkupPct),
      sub_agent_base_fee: Number(persistedRow.sub_agent_base_fee ?? subAgentBaseFee),
      table_ready: true,
      warning: null,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
