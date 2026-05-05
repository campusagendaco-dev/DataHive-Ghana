import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_API_SOURCE = "primary" as const;
export type ApiSource = "primary";

export const getMultiplierFromSource = (_source: ApiSource): number => 1;

export const applyPriceMultiplier = (price: number, multiplier: number): number =>
  Number((price * multiplier).toFixed(2));

export async function fetchApiPricingContext(): Promise<{ source: ApiSource; multipliers: Record<string, number> }> {
  try {
    const { data } = await supabase.from("system_settings").select("*").eq("id", 1).maybeSingle();
    
    const multipliers: Record<string, number> = {
      MTN: 1 + (Number(data?.mtn_markup_percentage || 0) / 100),
      Telecel: 1 + (Number(data?.telecel_markup_percentage || 0) / 100),
      AirtelTigo: 1 + (Number(data?.at_markup_percentage || 0) / 100),
    };
    
    return { source: "primary", multipliers };
  } catch (error) {
    console.error("Error fetching pricing context:", error);
    return { source: "primary", multipliers: { MTN: 1, Telecel: 1, AirtelTigo: 1 } };
  }
}
