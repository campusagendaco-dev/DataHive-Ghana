import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

serve(async (req: Request) => {
  // Bossu sends: User-Agent: BossuDataHub/1.0, X-Webhook-Event: order.status_updated
  const userAgent = req.headers.get("user-agent") || "";
  if (!userAgent.includes("BossuDataHub")) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Security: Verify webhook secret if configured
  const BOSSU_WEBHOOK_SECRET = Deno.env.get("BOSSU_WEBHOOK_SECRET") || Deno.env.get("PROVIDER_WEBHOOK_SECRET");
  if (BOSSU_WEBHOOK_SECRET) {
    const query = new URL(req.url).searchParams;
    const providedSecret = req.headers.get("X-Webhook-Secret") || query.get("key") || query.get("secret");
    if (providedSecret !== BOSSU_WEBHOOK_SECRET) {
      console.warn("[bossu-webhook] Unauthorized request blocked.");
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  // Payload: { event, data: { order_id, reference, status, network, package_name, recipient_phone, price, updated_at } }
  const data = body?.data;
  if (!data) return new Response("ok", { status: 200 });

  const bossuOrderId = data.order_id;   // Bossu's own order ID
  const reference = data.reference;     // our external_reference (SwiftData order UUID)
  const rawStatus = String(data.status || "").toLowerCase();

  // Map Bossu statuses → SwiftData statuses
  let swiftStatus: string;
  if (rawStatus === "completed") {
    swiftStatus = "fulfilled";
  } else if (rawStatus === "failed" || rawStatus === "cancelled") {
    swiftStatus = "fulfillment_failed";
  } else {
    swiftStatus = "processing";
  }

  // Find the order — try our reference first, then Bossu order_id
  let order: any = null;
  if (reference) {
    const { data: o } = await supabaseAdmin
      .from("orders")
      .select("id, agent_id, amount, profit, status")
      .eq("id", reference)
      .maybeSingle();
    order = o;
  }
  if (!order && bossuOrderId) {
    const { data: o } = await supabaseAdmin
      .from("orders")
      .select("id, agent_id, amount, profit, status")
      .eq("provider_order_id", bossuOrderId)
      .maybeSingle();
    order = o;
  }

  if (!order) {
    console.warn("[bossu-webhook] Order not found:", { reference, bossuOrderId });
    return new Response("ok", { status: 200 });
  }

  // Ignore if already in a terminal state
  if (order.status === "fulfilled" || order.status === "refunded") {
    return new Response("ok", { status: 200 });
  }

  const patch: Record<string, any> = {
    status: swiftStatus,
    provider_order_id: bossuOrderId || order.provider_order_id,
  };
  if (swiftStatus === "fulfillment_failed") {
    patch.failure_reason = `Bossu: ${rawStatus}`;
  }

  await supabaseAdmin.from("orders").update(patch).eq("id", order.id);

  // Credit profits on fulfillment
  if (swiftStatus === "fulfilled") {
    await supabaseAdmin.rpc("credit_order_profits", { p_order_id: order.id }).catch((e: any) =>
      console.error("[bossu-webhook] profit credit failed:", e)
    );
  }

  console.log(`[bossu-webhook] Order ${order.id} → ${swiftStatus}`);
  return new Response("ok", { status: 200 });
});
