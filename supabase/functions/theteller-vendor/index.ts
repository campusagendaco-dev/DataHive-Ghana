import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface RequestBody {
  action: "momo-collection" | "momo-disbursement" | "bank-transfer-init" | "bank-transfer-complete" | "check-status";
  amount?: number;
  phone?: string;
  network?: string;
  bank_code?: string;
  account_number?: string;
  reference_id?: string; // For bank authorize
  transaction_id?: string; // For status check
  description?: string;
}

const formatAmount = (amount: number): string => {
  // Amount is in GHS, convert to pesewas and pad to 12 digits
  const pesewas = Math.round(amount * 100);
  return pesewas.toString().padStart(12, "0");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { 
      status: 200, 
      headers: corsHeaders 
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const apiUser = Deno.env.get("THETELLER_API_USER");
  const apiKey = Deno.env.get("THETELLER_API_KEY");
  const merchantId = Deno.env.get("THETELLER_MERCHANT_ID");
  const terminalId = Deno.env.get("THETELLER_TERMINAL_ID");
  const passCode = Deno.env.get("THETELLER_PASS_CODE");
  const paystackKey = Deno.env.get("PAYSTACK_SECRET_KEY");

  const resolveAccountWithPaystack = async (accountNumber: string, bankCode: string) => {
    // Map theTeller codes to Paystack codes if needed
    // For MoMo, they are often the same (MTN, VOD, ATL)
    // For Banks, we try to use the selected code or a mapping
    const bankMapping: Record<string, string> = {
      "GCB": "040100",
      "ADB": "040200",
      "BAR": "040300",
      "STA": "040400",
      "SCB": "040500",
      "ECO": "040600",
      "FDL": "040700",
      "GTB": "040800",
      "ZEN": "040900",
      "UBA": "041000",
      "CAL": "041100",
      "UMB": "041200",
      "NIB": "041300",
      "PRU": "041400",
      "BOG": "041500",
      "MTN": "MTN",
      "VOD": "VOD",
      "ATL": "ATL"
    };

    const code = bankMapping[bankCode] || bankCode;
    console.log(`[paystack] Resolving ${accountNumber} with bank ${code}`);

    try {
      const resp = await fetch(`https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${code}`, {
        headers: {
          "Authorization": `Bearer ${paystackKey}`,
          "Content-Type": "application/json"
        }
      });
      const data = await resp.json();
      console.log(`[paystack] Resolution result:`, JSON.stringify(data));
      return data;
    } catch (e) {
      console.error("[paystack] Resolution error:", e);
      return { status: false, message: "Connection error" };
    }
  };

  const calculateCommissions = (amount: number, type: "momo" | "bank" | "africa") => {
    let agentProfit = 0;
    let companyProfit = 0;

    if (type === "momo") {
      // 1% fee total: 0.8% cost, 0.1% agent, 0.1% company
      agentProfit = amount * 0.001;
      companyProfit = amount * 0.001;
    } else if (type === "bank") {
      // Fixed 10 GHS fee: 5 cost, 2.5 agent, 2.5 company
      agentProfit = 2.5;
      companyProfit = 2.5;
    } else if (type === "africa") {
      // 3.5% fee: 2% cost, 0.75% agent, 0.75% company
      agentProfit = amount * 0.0075;
      companyProfit = amount * 0.0075;
    }

    return { agentProfit, companyProfit };
  };

  if (!apiUser || !apiKey || !merchantId) {
    return new Response(
      JSON.stringify({ error: "theTeller credentials not configured in secrets" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const jwt = authHeader?.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: RequestBody = await req.json();
    const { action, amount, phone, network, bank_code, account_number, reference_id, transaction_id, description } = body;

    const auth = btoa(`${apiUser}:${apiKey}`);
    const headers = {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "Merchant-Id": merchantId, // Required for status check
    };

    const isTestMode = Deno.env.get("THETELLER_MODE") === "test";
    let endpoint = isTestMode ? "https://test.theteller.net/v1.1/transaction/process" : "https://prod.theteller.net/v1.1/transaction/process";
    let method = "POST";
    let payload: any = {};

    // 1. Create a reference order if needed
    const orderId = crypto.randomUUID();
    
    if (action === "momo-collection") {
      // Security: Rate limit prompts to the same number (e.g., 1 prompt per 2 minutes)
      const { data: allowed } = await supabase.rpc("check_generic_rate_limit", {
        p_key: `momo_prompt_${phone}`,
        p_rate_limit: 1 // 1 per interval (interval defined in RPC, usually 1 min)
      });

      if (!allowed) {
        return new Response(JSON.stringify({ error: "Please wait a minute before requesting another prompt for this number." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      payload = {
        merchant_id: merchantId,
        transaction_id: orderId.substring(0, 12).replace(/-/g, ""), // theTeller often prefers shorter numeric-like IDs or specific lengths
        amount: formatAmount(amount!),
        processing_code: "000000",
        "r-switch": network, // MTN, VOD, ATL
        desc: description || "Swift Vendor Collection",
        subscriber_number: phone,
        terminal_id: terminalId,
      };
    } else if (action === "momo-disbursement") {
      // Validate balance first
      const { data: wallet } = await supabase.from("wallets").select("balance").eq("agent_id", user.id).single();
      if (!wallet || wallet.balance < amount!) {
        return new Response(JSON.stringify({ error: "Insufficient wallet balance" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      payload = {
        merchant_id: merchantId,
        transaction_id: orderId.substring(0, 12).replace(/-/g, ""),
        amount: formatAmount(amount!),
        processing_code: "404000",
        "r-switch": "FLT",
        desc: description || "Swift Vendor Disbursement",
        account_number: phone,
        account_issuer: network,
        pass_code: passCode,
      };
    } else if (action === "list-banks") {
      const country = body.country || "nigeria";
      try {
        const resp = await fetch(`https://api.paystack.co/bank?country=${country}`, {
          headers: { "Authorization": `Bearer ${paystackKey}` }
        });
        const data = await resp.json();
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Failed to fetch banks" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else if (action === "africa-transfer") {
      // Validate balance
      const { data: wallet } = await supabase.from("wallets").select("balance").eq("agent_id", user.id).single();
      if (!wallet || wallet.balance < amount!) {
        return new Response(JSON.stringify({ error: "Insufficient wallet balance" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      try {
        // Step 1: Create Transfer Recipient
        const recipientResp = await fetch("https://api.paystack.co/transferrecipient", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${paystackKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            type: body.country === "KE" ? "mobile_money" : "nuban",
            name: body.account_name,
            account_number: body.account_number,
            bank_code: body.bank_code,
            currency: body.currency,
          })
        });
        const recipientData = await recipientResp.json();
        if (!recipientData.status) throw new Error(recipientData.message);

        // Step 2: Initiate Transfer
        const transferResp = await fetch("https://api.paystack.co/transfer", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${paystackKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            source: "balance",
            amount: Math.round(amount! * 100), // Paystack expects amount in subunits
            recipient: recipientData.data.recipient_code,
            reason: body.description || "Swift Vendor Africa Payout",
            currency: body.currency
          })
        });
        const transferData = await transferResp.json();
        
        const commissions = calculateCommissions(amount!, "africa");
        
        // Debit wallet if successful (assuming Paystack handles GHS to target currency)
        if (transferData.status) {
          await supabase.rpc("debit_wallet", {
            p_agent_id: user.id,
            p_amount: amount
          });
          
          // Update order metadata with profits (Order was created in Step 2 of the function)
          // We'll update the main insertion logic below instead.
        }

        return new Response(JSON.stringify(transferData), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else if (action === "momo-enquiry") {
      const resolution = await resolveAccountWithPaystack(phone!, network!);
      if (resolution.status) {
        return new Response(JSON.stringify({ 
          status: "successful", 
          code: "000", 
          account_name: resolution.data.account_name 
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        return new Response(JSON.stringify({ 
          status: "failed", 
          message: resolution.message || "Could not verify MoMo account" 
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else if (action === "bank-transfer-init") {
      // Validate balance
      const { data: wallet } = await supabase.from("wallets").select("balance").eq("agent_id", user.id).single();
      if (!wallet || wallet.balance < amount!) {
        return new Response(JSON.stringify({ error: "Insufficient wallet balance" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Verify account first via Paystack
      const resolution = await resolveAccountWithPaystack(account_number!, bank_code!);
      if (!resolution.status) {
        return new Response(JSON.stringify({ 
          status: "failed", 
          message: resolution.message || "Could not verify bank account" 
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      payload = {
        merchant_id: merchantId,
        transaction_id: orderId.substring(0, 12).replace(/-/g, ""),
        amount: formatAmount(amount!),
        processing_code: "404020",
        "r-switch": "FLT",
        desc: description || "Swift Vendor Bank Transfer",
        account_number: account_number,
        account_bank: bank_code,
        account_issuer: "GIP",
        pass_code: passCode,
      };
      
      // We still need to call theTeller to get the reference_id for authorize
      // but we now have the verified account_name from Paystack
      const response = await fetch(endpoint, {
        method,
        headers,
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      
      return new Response(JSON.stringify({
        ...result,
        account_name: resolution.data.account_name, // Override with verified name
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } else if (action === "bank-transfer-complete") {
      endpoint = isTestMode 
        ? "https://test.theteller.net/v1.1/transaction/bank/ftc/authorize" 
        : "https://prod.theteller.net/v1.1/transaction/bank/ftc/authorize";
      payload = {
        merchant_id: merchantId,
        reference_id: reference_id,
      };
    } else if (action === "check-status") {
      const baseUrl = isTestMode ? "https://test.theteller.net" : "https://prod.theteller.net";
      endpoint = `${baseUrl}/v1.1/users/transactions/${transaction_id}/status`;
      method = "GET";
      payload = null;
    }

    console.log(`[theteller] Requesting ${endpoint} with action ${action}`);
    if (payload) console.log(`[theteller] Payload:`, JSON.stringify(payload));

    const response = await fetch(endpoint, {
      method,
      headers,
      body: payload ? JSON.stringify(payload) : undefined,
    });

    const result = await response.json();
    console.log(`[theteller] Response:`, JSON.stringify(result));
    console.log(`theTeller Response [${action}]:`, result);

    // 2. Handle DB recording
    if (action === "momo-collection" || action === "momo-disbursement" || action === "bank-transfer-init") {
      const orderType = action === "momo-collection" ? "vendor_cash_out" : 
                       (action === "momo-disbursement" ? "vendor_cash_in" : "vendor_bank_transfer");
      
      const isSuccess = result.code === "000" || result.status === "approved" || result.status === "successful" || result.status === true;
      const isPending = result.code === "100" || result.status === "pending";

      const commType = action === "africa-transfer" ? "africa" : 
                      (action === "bank-transfer-init" ? "bank" : "momo");
      const commissions = calculateCommissions(amount || 0, commType);

      await supabase.from("orders").insert({
        id: orderId,
        agent_id: user.id,
        order_type: orderType,
        amount: amount,
        profit: commissions.agentProfit,
        parent_profit: commissions.companyProfit,
        customer_phone: phone || account_number,
        status: isSuccess ? "fulfilled" : (isPending ? "pending" : "failed"),
        failure_reason: result.reason || result.message || result.error,
        metadata: {
          theteller_ref: result.transaction_id || result.reference_id || result.data?.reference,
          theteller_raw: result,
          bank_code: bank_code,
          account_name: result.account_name || body.account_name,
        }
      });

      // Debit wallet for disbursements immediately if successful or pending
      if ((action === "momo-disbursement" || action === "bank-transfer-init" || action === "africa-transfer") && (isSuccess || isPending)) {
        await supabase.rpc("debit_wallet", {
          p_agent_id: user.id,
          p_amount: amount
        });
      }

      // Credit wallet for collection ONLY if successful immediately
      if (action === "momo-collection" && isSuccess) {
        await supabase.rpc("credit_wallet", {
          p_agent_id: user.id,
          p_amount: amount
        });
        // Mark as credited
        await supabase.from("orders").update({
          metadata: { ...result, wallet_credited: true }
        }).eq("id", orderId);
      }
    }

    // Special case for Status Check: update the order and handle wallet
    if (action === "check-status") {
      const isSuccess = result.code === "000" || result.status === "approved" || result.status === "successful";
      
      if (isSuccess && transaction_id) {
        // Find the original order
        const { data: order } = await supabase.from("orders")
          .select("*")
          .eq("id", transaction_id)
          .single();
        
        if (order && order.status === "pending") {
          await supabase.from("orders").update({
            status: "fulfilled",
            metadata: { ...order.metadata, theteller_raw: result }
          }).eq("id", transaction_id);

          // If it was a collection, credit the wallet now
          if (order.order_type === "vendor_cash_out" && !order.metadata?.wallet_credited) {
            await supabase.rpc("credit_wallet", {
              p_agent_id: user.id,
              p_amount: order.amount
            });
            await supabase.from("orders").update({
              metadata: { ...order.metadata, wallet_credited: true }
            }).eq("id", transaction_id);
          }
        }
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("theTeller function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
