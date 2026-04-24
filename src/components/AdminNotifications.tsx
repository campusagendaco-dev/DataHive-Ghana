import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const AdminNotifications = () => {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const notify = (title: string, body: string) => {
      toastRef.current({ title, description: body });
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body, icon: "/favicon.png" });
      }
    };

    const ordersChannel = supabase
      .channel("admin-orders-notify")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
        const o = payload.new as any;
        notify(
          `New Order — ${o.network || "Wallet"} ${o.package_size || o.order_type || ""}`.trim(),
          `GH₵${Number(o.amount).toFixed(2)} · ${o.customer_phone || "No phone"}`,
        );
      })
      .subscribe();

    const withdrawalsChannel = supabase
      .channel("admin-withdrawals-notify")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "withdrawals" }, (payload) => {
        const w = payload.new as any;
        notify("New Withdrawal Request", `Amount: GH₵${Number(w.amount).toFixed(2)}`);
      })
      .subscribe();

    const agentsChannel = supabase
      .channel("admin-agents-notify")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles",
        filter: "is_agent=eq.true" }, (payload) => {
        const p = payload.new as any;
        if (p.is_agent && p.onboarding_complete && !p.agent_approved) {
          notify("Agent Pending Approval", `${p.full_name || "An agent"} completed onboarding.`);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(withdrawalsChannel);
      supabase.removeChannel(agentsChannel);
    };
  }, []); // stable — toastRef handles the latest toast reference

  return null;
};

export default AdminNotifications;
