import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Get recent stats (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentOrders, error: statsError } = await supabaseAdmin
      .from("orders")
      .select("status, created_at, customer_phone, network, package_size")
      .gte("created_at", oneHourAgo)
      .order("created_at", { ascending: false });

    if (statsError) throw statsError;

    const stats = {
      checked: recentOrders?.length || 0,
      delivered: recentOrders?.filter(o => o.status === 'fulfilled').length || 0,
      partial: recentOrders?.filter(o => o.status === 'processing').length || 0,
      pending: recentOrders?.filter(o => o.status === 'paid').length || 0,
      failed: recentOrders?.filter(o => o.status === 'fulfillment_failed' || o.status === 'error').length || 0,
    };

    // 2. Get the "Last Delivered" order details
    const lastDeliveredOrder = recentOrders?.find(o => o.status === 'fulfilled');
    let lastDelivered = null;
    if (lastDeliveredOrder) {
      const placedAt = new Date(lastDeliveredOrder.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      lastDelivered = {
        trackingId: Math.floor(Math.random() * 900000 + 1000000).toString(), // Mocked tracking batch ID
        summary: `Tracking #${lastDeliveredOrder.customer_phone.slice(-4)} — placed recently, delivered at ${placedAt}`
      };
    }

    // 3. Mask phone numbers for public display
    const maskPhone = (p: string) => {
      if (!p) return "****";
      if (p.length < 7) return p.slice(0, 3) + "****";
      return p.slice(0, 3) + "****" + p.slice(-3);
    };

    const inCurrentBatch = recentOrders
      ?.filter(o => o.status === 'paid' || o.status === 'processing')
      .slice(0, 5)
      .map(o => ({
        phone: maskPhone(o.customer_phone),
        network: o.network || "YELLO",
        capacity: o.package_size || "1GB",
        deliveryStatus: o.status === 'processing' ? 'Processing' : 'In Queue'
      })) || [];

    const inLastDeliveredBatch = recentOrders
      ?.filter(o => o.status === 'fulfilled')
      .slice(0, 5)
      .map(o => ({
        phone: maskPhone(o.customer_phone),
        network: o.network || "YELLO",
        capacity: o.package_size || "1GB",
        deliveryStatus: "Sent"
      })) || [];

    return new Response(
      JSON.stringify({
        status: "success",
        data: {
          message: "Delivery scanner is actively checking orders...",
          scanner: { 
            active: stats.pending > 0 || stats.partial > 0, 
            waiting: stats.pending === 0, 
            waitSeconds: stats.pending === 0 ? 30 : 0 
          },
          stats,
          lastDelivered,
          checkingNow: { 
            summary: stats.pending > 0 ? `Checking now: Batch #${Math.floor(Math.random() * 1000000)}` : "Scanner idling... waiting for new orders" 
          },
          yourOrders: {
            inCurrentBatch,
            inLastDeliveredBatch
          }
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
