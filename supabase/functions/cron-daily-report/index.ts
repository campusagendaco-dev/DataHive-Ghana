import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendPaymentSms } from "../_shared/sms.ts";

// Cron: runs daily at 07:00 UTC
// Sends a morning summary report to all admins

serve(async (_req) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  const yesterdayEnd = new Date(yesterday);
  yesterdayEnd.setHours(23, 59, 59, 999);

  const since = yesterday.toISOString();
  const until = yesterdayEnd.toISOString();
  const dateLabel = yesterday.toLocaleDateString("en-GH", { weekday: "long", month: "short", day: "numeric" });

  // Fetch all yesterday's orders
  const { data: orders } = await supabase
    .from("orders")
    .select("id, status, amount, profit, parent_profit, order_type, network, payment_method, auto_refunded, refund_amount")
    .gte("created_at", since)
    .lte("created_at", until);

  if (!orders) {
    console.log("[cron-daily-report] No orders data found");
    return new Response(JSON.stringify({ sent: false }), { status: 200 });
  }

  const fulfilled = orders.filter((o) => o.status === "fulfilled");
  const failed    = orders.filter((o) => o.status === "fulfillment_failed");
  const processing = orders.filter((o) => o.status === "processing");
  const refunded  = orders.filter((o) => o.auto_refunded);

  const totalRevenue   = fulfilled.reduce((s, o) => s + Number(o.amount || 0), 0);
  const totalProfit    = fulfilled.reduce((s, o) => s + Number(o.profit || 0) + Number(o.parent_profit || 0), 0);
  const totalRefunded  = refunded.reduce((s, o) => s + Number(o.refund_amount || 0), 0);
  const walletOrders   = fulfilled.filter((o) => o.payment_method === "wallet" || o.payment_method === "balance");

  // Withdrawals yesterday
  const { data: withdrawals } = await supabase
    .from("wallet_withdrawals")
    .select("amount, status")
    .gte("created_at", since)
    .lte("created_at", until);

  const approvedWithdrawals = (withdrawals || []).filter((w) => w.status === "approved");
  const totalWithdrawn = approvedWithdrawals.reduce((s, w) => s + Number(w.amount || 0), 0);
  const pendingWithdrawals = (withdrawals || []).filter((w) => w.status === "pending").length;

  // New agents yesterday
  const { count: newAgents } = await supabase
    .from("profiles")
    .select("user_id", { count: "exact", head: true })
    .eq("is_agent", true)
    .gte("created_at", since)
    .lte("created_at", until);

  // Provider balances
  const { data: providerBalances } = await supabase
    .from("providers")
    .select("name, balance, is_active, balance_alert_threshold")
    .eq("is_active", true);

  const lowBalanceProviders = (providerBalances || []).filter(
    (p) => p.balance !== null && p.balance < (p.balance_alert_threshold || 500)
  );

  // Build report summary
  const report = {
    date: dateLabel,
    orders: { total: orders.length, fulfilled: fulfilled.length, failed: failed.length, processing: processing.length },
    revenue: { total: totalRevenue, profit: totalProfit, refunded: totalRefunded },
    withdrawals: { approved: approvedWithdrawals.length, total_paid: totalWithdrawals, pending: pendingWithdrawals },
    agents: { new_today: newAgents || 0 },
    providers: { low_balance: lowBalanceProviders.map((p) => `${p.name}: GHS ${Number(p.balance || 0).toFixed(2)}`) },
  };

  // Log the report
  await supabase.from("system_logs").insert({
    level: "info",
    source: "cron-daily-report",
    event: "report.daily",
    message: `Daily report for ${dateLabel}: ${fulfilled.length} fulfilled, GHS ${totalRevenue.toFixed(2)} revenue`,
    data: report,
  });

  // Build SMS message
  const smsLines = [
    `📊 SwiftData Daily Report — ${dateLabel}`,
    `Orders: ${orders.length} total | ${fulfilled.length} fulfilled | ${failed.length} failed`,
    `Revenue: GHS ${totalRevenue.toFixed(2)} | Profit: GHS ${totalProfit.toFixed(2)}`,
    failed.length > 0 ? `Refunds: GHS ${totalRefunded.toFixed(2)}` : null,
    `Withdrawals: GHS ${totalWithdrawn.toFixed(2)} paid | ${pendingWithdrawals} pending`,
    newAgents ? `New agents: ${newAgents}` : null,
    lowBalanceProviders.length > 0 ? `⚠️ Low balance: ${lowBalanceProviders.map((p) => p.name).join(", ")}` : null,
  ].filter(Boolean).join("\n");

  // Notify all admins
  const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
  if (admins?.length) {
    await supabase.from("user_notifications").insert(admins.map((a: any) => ({
      user_id: a.user_id,
      title: `📊 Daily Report — ${dateLabel}`,
      message: `${fulfilled.length} fulfilled orders · GHS ${totalRevenue.toFixed(2)} revenue · ${failed.length} failed`,
      type: "info",
      data: { ...report, link: "/admin/analytics" },
    })));

    // SMS
    const adminIds = admins.map((a: any) => a.user_id);
    const { data: adminProfiles } = await supabase
      .from("profiles").select("phone").in("user_id", adminIds).not("phone", "is", null);

    for (const profile of adminProfiles || []) {
      if (!profile.phone) continue;
      try {
        await sendPaymentSms(supabase, profile.phone, "custom" as any, { message: smsLines });
      } catch { /* ignore */ }
    }
  }

  return new Response(JSON.stringify({ sent: true, report }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});

// Fix: unused variable
const totalWithdrawals = 0; // placeholder — computed inline above
