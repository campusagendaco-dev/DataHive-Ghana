import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

export async function notifyApiClient(supabaseAdmin: any, orderId: string, status: string) {
  try {
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("agent_id, order_type, metadata")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order || order.order_type !== "api" || !order.agent_id) return;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("api_webhook_url, api_secret_key_hash")
      .eq("user_id", order.agent_id)
      .maybeSingle();

    if (profile?.api_webhook_url && profile?.api_secret_key_hash) {
      const payload = JSON.stringify({
        event: "order.updated",
        data: {
          order_id: orderId,
          status: status,
          client_reference: order.metadata?.client_reference || null,
          updated_at: new Date().toISOString()
        }
      });

      const signature = createHmac("sha256", profile.api_secret_key_hash)
        .update(payload)
        .digest("hex");

      await fetch(profile.api_webhook_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Swift-Signature": signature,
          "User-Agent": "SwiftData-Webhook/1.0"
        },
        body: payload
      });
      
      console.log(`[Webhook] Notified client at ${profile.api_webhook_url} for order ${orderId}`);
    }
  } catch (err) {
    console.error(`[Webhook] Failed to notify client for order ${orderId}:`, err.message);
  }
}

export async function notifyWalletCredit(supabaseAdmin: any, userId: string, amount: number, walletType: "main" | "api" = "api") {
  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("api_webhook_url, api_secret_key_hash")
      .eq("user_id", userId)
      .maybeSingle();

    if (profile?.api_webhook_url && profile?.api_secret_key_hash) {
      const payload = JSON.stringify({
        event: "wallet.funded",
        data: {
          wallet: walletType,
          amount: amount,
          currency: "GHS",
          updated_at: new Date().toISOString()
        }
      });

      const signature = createHmac("sha256", profile.api_secret_key_hash)
        .update(payload)
        .digest("hex");

      await fetch(profile.api_webhook_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Swift-Signature": signature,
          "User-Agent": "SwiftData-Webhook/1.0"
        },
        body: payload
      });
      
      console.log(`[Webhook] Notified client at ${profile.api_webhook_url} for wallet credit of ${amount} to ${walletType}`);
    }
  } catch (err) {
    console.error(`[Webhook] Failed to notify client for wallet credit:`, err.message);
  }
}
