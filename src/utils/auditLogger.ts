import { supabase } from "@/integrations/supabase/client";

/**
 * Logs an administrative action to the audit_logs table.
 * @param adminId The ID of the admin performing the action.
 * @param action A string describing the action (e.g., "manual_wallet_topup").
 * @param details A JSON object containing specific details about the action.
 */
export const logAudit = async (adminId: string, action: string, details: any) => {
  try {
    const { error } = await supabase.from("audit_logs").insert({
      admin_id: adminId,
      action,
      details,
    });
    if (error) console.error("Audit log failed:", error);
  } catch (err) {
    console.error("Audit log error:", err);
  }
};
