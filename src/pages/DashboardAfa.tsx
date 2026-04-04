import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import AfaOrderForm from "@/components/AfaOrderForm";
import { Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_AFA_PRICE = 12.5;

const DashboardAfa = () => {
  const { user } = useAuth();
  const [afaPrice, setAfaPrice] = useState(DEFAULT_AFA_PRICE);

  useEffect(() => {
    const loadAfaPrice = async () => {
      const { data } = await supabase
        .from("global_package_settings")
        .select("agent_price, public_price")
        .eq("network", "AFA")
        .eq("package_size", "BUNDLE")
        .maybeSingle();
      const numeric = Number((data as any)?.agent_price ?? (data as any)?.public_price);
      if (Number.isFinite(numeric) && numeric >= 0) {
        setAfaPrice(numeric);
      }
    };
    loadAfaPrice();
  }, []);

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">AFA Bundle</h1>
        <p className="text-muted-foreground">Order AFA bundles for your customer. AFA pricing is managed from the Admin portal.</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 mb-8">
        <h2 className="font-display text-lg font-semibold mb-1">AFA Price Control Location</h2>
        <p className="text-sm text-muted-foreground">
          AFA prices are controlled by the admin team in the Admin portal.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">Place AFA Order</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Order an AFA bundle at GHS {afaPrice.toFixed(2)}.</p>
        <AfaOrderForm
          price={afaPrice.toFixed(2)}
          agentId={user?.id}
          profit={0}
        />
      </div>
    </div>
  );
};

export default DashboardAfa;
