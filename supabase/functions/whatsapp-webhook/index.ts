import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { sendWhatsAppMessage } from "../_shared/whatsapp.ts";

declare const Deno: any;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://swiftdatagh.com";

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

// ── WaSender payload parser ──────────────────────────────────────────────────
function parseWaSenderWebhook(payload: any): { from: string; text: string; event: string } {
  const event = payload?.event || "";
  const messages = payload?.data?.messages;
  if (!messages) return { from: "", text: "", event };

  const from =
    messages.key?.cleanedSenderPn ||
    messages.key?.remoteJid?.split("@")[0] ||
    "";

  const text =
    messages.messageBody ||
    messages.message?.conversation ||
    messages.message?.extendedTextMessage?.text ||
    "";

  return { from: from.trim(), text: text.trim(), event };
}

// ── Agent context ────────────────────────────────────────────────────────────
interface AgentContext {
  agentId: string;
  storeName: string;
  agentPrices: Record<string, Record<string, string | number>>;
  slug: string;
  whatsappNumber?: string;
  fullName?: string;
}

/**
 * Try to detect an agent store code from the message text.
 * Customers arrive via links like: wa.me/233XXXX?text=Hi STORE_CODE
 */
async function detectAgentFromMessage(text: string): Promise<AgentContext | null> {
  const words = text.replace(/[^a-zA-Z0-9\s-_]/g, "").split(/\s+/).filter(Boolean);

  for (const word of words) {
    const slug = word.toLowerCase();
    if (slug.length < 3) continue;

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, store_name, full_name, agent_prices, slug, wa_bot_enabled, agent_approved, sub_agent_approved, whatsapp_number")
      .eq("slug", slug)
      .maybeSingle();

    if (profile && (profile.agent_approved || profile.sub_agent_approved)) {
      return {
        agentId: profile.user_id,
        storeName: profile.store_name || profile.full_name || "SwiftData Agent",
        agentPrices: (profile.agent_prices || {}) as Record<string, Record<string, string | number>>,
        slug: profile.slug || "",
        whatsappNumber: profile.whatsapp_number,
        fullName: profile.full_name,
      };
    }
  }

  return null;
}

/** Load agent context by ID */
async function loadAgentById(agentId: string): Promise<AgentContext | null> {
  if (!agentId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, store_name, full_name, agent_prices, slug, agent_approved, sub_agent_approved, whatsapp_number")
    .eq("user_id", agentId)
    .maybeSingle();

  if (!profile) return null;

  return {
    agentId: profile.user_id,
    storeName: profile.store_name || profile.full_name || "SwiftData Agent",
    agentPrices: (profile.agent_prices || {}) as Record<string, Record<string, string | number>>,
    slug: profile.slug || "",
    whatsappNumber: profile.whatsapp_number,
    fullName: profile.full_name,
  };
}

// ── Build data package menu ──────────────────────────────────────────────────
async function buildPackageMenu(network: string, agent: AgentContext | null) {
  interface PackageItem { package_size: string; price: number }
  const packages: PackageItem[] = [];

  if (agent && agent.agentPrices) {
    const networkPrices = agent.agentPrices[network] || {};
    for (const [size, price] of Object.entries(networkPrices)) {
      const numPrice = Number(price);
      if (numPrice > 0) packages.push({ package_size: size, price: numPrice });
    }
    packages.sort((a, b) => a.price - b.price);
  }

  if (packages.length === 0) {
    const { data: globalPkgs } = await supabase
      .from("global_package_settings")
      .select("package_size, public_price, is_unavailable")
      .eq("network", network)
      .eq("is_unavailable", false)
      .order("public_price", { ascending: true });

    if (globalPkgs) {
      for (const pkg of globalPkgs) {
        packages.push({ package_size: pkg.package_size, price: Number(pkg.public_price) });
      }
    }
  }

  return packages;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { from, text, event } = parseWaSenderWebhook(payload);

    if (!event.includes("personal") && !event.includes("message")) {
      return new Response(JSON.stringify({ status: "ignored" }), { headers: corsHeaders });
    }
    if (!from || !text) {
      return new Response(JSON.stringify({ status: "ignored" }), { headers: corsHeaders });
    }
    if (payload?.data?.messages?.key?.fromMe === true) {
      return new Response(JSON.stringify({ status: "ignored" }), { headers: corsHeaders });
    }
    if (from.includes("-") || from.includes("g.us")) {
      return new Response(JSON.stringify({ status: "ignored" }), { headers: corsHeaders });
    }

    const { data: session } = await supabase
      .from("whatsapp_sessions")
      .select("*")
      .eq("phone_number", from)
      .maybeSingle();

    let currentStep = session?.current_step || "MENU";
    let orderData = session?.order_data || {};
    let storedAgentId = session?.agent_id || "";
    let nextStep = currentStep;
    let responseText = "";

    const userChoice = text.toLowerCase().trim();
    let agent: AgentContext | null = null;

    if (["menu", "0", "hi", "hello", "hey", "start"].includes(userChoice)) {
      nextStep = "MENU";
      orderData = {};
    }

    if (!storedAgentId || currentStep === "MENU" || nextStep === "MENU") {
      const detected = await detectAgentFromMessage(text);
      if (detected) {
        storedAgentId = detected.agentId;
        agent = detected;
        nextStep = "MENU";
        orderData = {};
      }
    }

    if (!agent && storedAgentId) {
      agent = await loadAgentById(storedAgentId);
    }

    const storeName = agent?.storeName || "SwiftData";

    switch (nextStep) {
      case "MENU":
        responseText =
          `*Welcome to ${storeName}!* 🐝\n\n` +
          `What would you like to do?\n\n` +
          `*1.* Buy Data 📶\n` +
          `*2.* Buy Airtime 📱\n` +
          `*3.* Check Order Status 🔍\n` +
          `*4.* Talk to Agent 👨‍💼\n\n` +
          `_Reply with the number of your choice_`;
        nextStep = "AWAITING_SERVICE_TYPE";
        break;

      case "AWAITING_SERVICE_TYPE":
        if (userChoice === "1") {
          responseText = `*Select Network:*\n\n*1.* MTN\n*2.* Telecel\n*3.* AT (AirtelTigo)\n\n_Reply 0 to go back_`;
          nextStep = "AWAITING_DATA_NETWORK";
        } else if (userChoice === "2") {
          responseText = `*Select Airtime Network:*\n\n*1.* MTN\n*2.* Telecel\n*3.* AT (AirtelTigo)\n\n_Reply 0 to go back_`;
          nextStep = "AWAITING_AIRTIME_NETWORK";
        } else if (userChoice === "3") {
          responseText = `Please reply with your *Order ID* to check its status.\n\n_Reply 0 to go back_`;
          nextStep = "AWAITING_ORDER_ID";
        } else if (userChoice === "4") {
          const agentWa = agent?.whatsappNumber?.replace(/[^0-9]/g, "") || "";
          if (agentWa) {
            responseText = 
              `*Live Support*\n\n` +
              `Click the link below to chat directly with our agent:\n` +
              `👉 https://wa.me/${agentWa}\n\n` +
              `_I've also sent them a notification that you're waiting!_`;
            
            // Forward notification to agent
            try {
              const agentNotifyMsg = `🔔 *New Live Chat Request*\n\nA customer (${from}) is asking for a live chat on your WhatsApp bot.`;
              await sendWhatsAppMessage(agentWa, agentNotifyMsg);
            } catch (e) { console.error("Notify error", e); }
          } else {
            responseText = `Live support is currently unavailable for this store.\n\n_Reply 0 for the main menu._`;
          }
          nextStep = "MENU";
        } else {
          responseText = `Invalid choice. Please reply *1*, *2*, *3*, or *4*.`;
        }
        break;

      case "AWAITING_DATA_NETWORK":
      case "AWAITING_AIRTIME_NETWORK": {
        const networks: Record<string, string> = { "1": "MTN", "2": "Telecel", "3": "AirtelTigo" };
        const selectedNetwork = networks[userChoice];
        if (!selectedNetwork) { responseText = `Invalid choice. Please reply *1*, *2*, or *3*.`; break; }
        orderData.network = selectedNetwork;

        if (nextStep === "AWAITING_DATA_NETWORK") {
          const packages = await buildPackageMenu(selectedNetwork, agent);
          if (packages.length === 0) {
            responseText = `Sorry, no packages available for ${selectedNetwork} at the moment.\n\n_Reply 0 for the main menu._`;
            nextStep = "MENU";
            break;
          }
          let packageMenu = `*${selectedNetwork} Data Packages:*\n\n`;
          const packageList: string[] = [];
          const priceList: number[] = [];
          packages.forEach((pkg, index) => {
            packageList.push(pkg.package_size);
            priceList.push(pkg.price);
            packageMenu += `*${index + 1}.* ${pkg.package_size} — GH₵ ${pkg.price.toFixed(2)}\n`;
          });
          orderData.availablePackages = packageList;
          orderData.availablePrices = priceList;
          packageMenu += `\n_Reply with the package number_`;
          responseText = packageMenu;
          nextStep = "AWAITING_DATA_PACKAGE";
        } else {
          responseText = `Enter the *${selectedNetwork} Airtime* amount in GH₵ (e.g. 5 or 10.50):\n\n_Minimum: GH₵ 1.00_`;
          nextStep = "AWAITING_AIRTIME_AMOUNT";
        }
        break;
      }

      case "AWAITING_DATA_PACKAGE": {
        const packageIndex = parseInt(userChoice) - 1;
        const availablePackages: string[] = orderData.availablePackages || [];
        if (isNaN(packageIndex) || packageIndex < 0 || packageIndex >= availablePackages.length) {
          responseText = `Invalid package number. Please pick a number from the list above.`;
          break;
        }
        orderData.package_size = availablePackages[packageIndex];
        orderData.selected_price = orderData.availablePrices?.[packageIndex] || 0;
        responseText =
          `You selected *${orderData.network} ${orderData.package_size}* — GH₵ ${Number(orderData.selected_price).toFixed(2)}\n\n` +
          `Please reply with the *phone number* to receive the data (e.g. 0241234567):`;
        nextStep = "AWAITING_PHONE";
        break;
      }

      case "AWAITING_AIRTIME_AMOUNT": {
        const amount = parseFloat(userChoice);
        if (isNaN(amount) || amount < 1) {
          responseText = `Invalid amount. Minimum is GH₵ 1.00. Please try again:`;
          break;
        }
        orderData.amount = amount;
        responseText =
          `You entered *GH₵ ${amount.toFixed(2)}* ${orderData.network} Airtime.\n\n` +
          `Please reply with the *phone number* to receive the airtime:`;
        nextStep = "AWAITING_PHONE";
        break;
      }

      case "AWAITING_PHONE": {
        const phoneRegex = /^[0-9+]{9,15}$/;
        const cleanPhone = userChoice.replace(/\s+/g, "");
        if (!phoneRegex.test(cleanPhone)) {
          responseText = `Invalid phone number. Please enter a valid number (e.g. 0241234567):`;
          break;
        }
        orderData.phone = cleanPhone;

        await sendWhatsAppMessage(from, `⏳ Generating your secure payment link...`);

        const orderId = crypto.randomUUID();
        const orderType = orderData.package_size ? "data" : "airtime";

        try {
          const initPayload = {
            email: `wa-${from}@swiftdatagh.com`,
            amount: orderType === "airtime" ? orderData.amount : orderData.selected_price || 0,
            reference: orderId,
            callback_url: agent ? `${APP_BASE_URL}/store/${agent.slug}/purchase-success?reference=${orderId}` : `${APP_BASE_URL}/purchase-success?reference=${orderId}`,
            metadata: {
              order_id: orderId,
              order_type: orderType,
              network: orderData.network,
              package_size: orderType === "data" ? orderData.package_size : undefined,
              customer_phone: orderData.phone,
              channel: "whatsapp",
              ...(storedAgentId ? { agent_id: storedAgentId } : {}),
            },
          };

          const funcRes = await fetch(`${SUPABASE_URL}/functions/v1/initialize-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
            body: JSON.stringify(initPayload),
          });
          const funcData = await funcRes.json();

          if (funcData.authorization_url) {
            const item = orderType === "data" ? `${orderData.network} ${orderData.package_size}` : `${orderData.network} Airtime GH₵ ${orderData.amount}`;
            responseText =
              `✅ *Order Ready!*\n\n` +
              `📦 ${item}\n` +
              `📱 Recipient: ${orderData.phone}\n\n` +
              `Pay securely via the link below (MoMo or Card):\n\n` +
              `👉 ${funcData.authorization_url}\n\n` +
              `_Your order will be fulfilled automatically after payment._\n\n` +
              `_Reply 0 for a new order._`;
            nextStep = "MENU";
            orderData = {};
          } else {
            responseText = `❌ Could not generate payment link. Please try again later.`;
            nextStep = "MENU";
          }
        } catch (e) {
          responseText = `❌ An error occurred. Please reply *0* to try again.`;
          nextStep = "MENU";
        }
        break;
      }

      case "AWAITING_ORDER_ID": {
        const ref = userChoice.trim();
        const { data: order } = await supabase.from("orders").select("status, network, package_size, amount, order_type").eq("id", ref).maybeSingle();
        if (!order) {
          responseText = `Order not found. Please check your reference.\n\n_Reply 0 for the main menu._`;
        } else {
          const statusLabel = order.status.replace(/_/g, " ").toUpperCase();
          const item = order.order_type === "airtime" ? `${order.network} Airtime GH₵ ${Number(order.amount).toFixed(2)}` : `${order.network} ${order.package_size}`;
          responseText = `🔍 *Order Status*\n\nItem: ${item}\nStatus: *${statusLabel}*\n\n_Reply 0 for the main menu._`;
        }
        nextStep = "MENU";
        break;
      }

      default:
        // If no matching command, suggest talking to agent
        responseText = 
          `I didn't quite catch that. 🤔\n\n` +
          `Reply *0* for the menu, or *4* to talk to our agent directly.`;
        nextStep = "MENU";
        break;
    }

    await supabase.from("whatsapp_sessions").upsert({
      phone_number: from,
      agent_id: storedAgentId,
      current_step: nextStep,
      order_data: orderData,
    });

    await sendWhatsAppMessage(from, responseText);

    return new Response(JSON.stringify({ status: "success" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[WA-Bot] Webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }
});
