import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { basePackages, networks } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save } from "lucide-react";
import { fetchApiPricingContext } from "@/lib/api-source-pricing";

interface PackageSetting {
  network: string;
  package_size: string;
  agent_price: number | null;
  public_price: number | null;
  is_unavailable: boolean;
}

const AdminPackages = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, PackageSetting>>({});
  const [afaPublicPrice, setAfaPublicPrice] = useState(12.5);
  const [afaAgentPrice, setAfaAgentPrice] = useState(12.5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userDiscountPercent, setUserDiscountPercent] = useState("");
  const [activeApiSource, setActiveApiSource] = useState<"primary" | "secondary">("primary");
  const [activeMultiplier, setActiveMultiplier] = useState(1);

  useEffect(() => {
    const fetch = async () => {
      const pricingContext = await fetchApiPricingContext();
      setActiveApiSource(pricingContext.source);
      setActiveMultiplier(pricingContext.multiplier);

      const { data } = await supabase
        .from("global_package_settings")
        .select("network, package_size, agent_price, public_price, is_unavailable");

      const map: Record<string, PackageSetting> = {};
      (data || []).forEach((r: any) => {
        map[`${r.network}-${r.package_size}`] = r;
      });
      setSettings(map);

      const afaSetting = map["AFA-BUNDLE"];
      const publicPrice = Number(afaSetting?.public_price);
      const agentPrice = Number(afaSetting?.agent_price);
      if (Number.isFinite(publicPrice) && publicPrice >= 0) setAfaPublicPrice(publicPrice);
      if (Number.isFinite(agentPrice) && agentPrice >= 0) setAfaAgentPrice(agentPrice);

      setLoading(false);
    };
    fetch();
  }, []);

  const getSetting = (network: string, size: string): PackageSetting => {
    const key = `${network}-${size}`;
    return settings[key] || { network, package_size: size, agent_price: null, public_price: null, is_unavailable: false };
  };

  const updateSetting = (network: string, size: string, field: keyof PackageSetting, value: any) => {
    const key = `${network}-${size}`;
    const current = getSetting(network, size);
    setSettings((prev) => ({ ...prev, [key]: { ...current, [field]: value } }));
  };

  const handleSave = async () => {
    setSaving(true);

    for (const n of networks) {
      for (const pkg of basePackages[n.name] || []) {
        const s = getSetting(n.name, pkg.size);
        if (s.public_price !== null && s.public_price < 0) {
          toast({
            title: "Invalid public price",
            description: `${n.name} ${pkg.size} public price cannot be negative.`,
            variant: "destructive",
          });
          setSaving(false);
          return;
        }
        if (s.agent_price !== null && s.agent_price < 0) {
          toast({
            title: "Invalid agent price",
            description: `${n.name} ${pkg.size} agent price cannot be negative.`,
            variant: "destructive",
          });
          setSaving(false);
          return;
        }
      }
    }
    if (!Number.isFinite(afaPublicPrice) || afaPublicPrice < 0) {
      toast({
        title: "Invalid AFA user price",
        description: "AFA user price cannot be negative.",
        variant: "destructive",
      });
      setSaving(false);
      return;
    }
    if (!Number.isFinite(afaAgentPrice) || afaAgentPrice < 0) {
      toast({
        title: "Invalid AFA agent price",
        description: "AFA agent price cannot be negative.",
        variant: "destructive",
      });
      setSaving(false);
      return;
    }

    // Collect all modified settings
    const upserts = Object.values(settings).map((s) => ({
      network: s.network,
      package_size: s.package_size,
      agent_price: s.agent_price,
      public_price: s.public_price,
      is_unavailable: s.is_unavailable,
      updated_at: new Date().toISOString(),
    }));

    if (upserts.length > 0) {
      const { error } = await supabase
        .from("global_package_settings")
        .upsert(upserts, { onConflict: "network,package_size" });

      if (error) {
        toast({ title: "Save failed", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    }

    const roundedPublic = Number(afaPublicPrice.toFixed(2));
    const roundedAgent = Number(afaAgentPrice.toFixed(2));
    const { error: afaError } = await supabase
      .from("global_package_settings")
      .upsert(
        {
          network: "AFA",
          package_size: "BUNDLE",
          public_price: roundedPublic,
          agent_price: roundedAgent,
          is_unavailable: false,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "network,package_size" }
      );

    if (afaError) {
      toast({
        title: "AFA price save failed",
        description: afaError.message || "Could not save AFA prices.",
        variant: "destructive",
      });
      setSaving(false);
      return;
    }

    toast({ title: "Package settings saved!" });
    setAfaPublicPrice(roundedPublic);
    setAfaAgentPrice(roundedAgent);

    setSaving(false);
  };

  const applyUserDiscount = () => {
    const discount = parseFloat(userDiscountPercent);
    if (isNaN(discount) || discount <= 0 || discount >= 100) {
      toast({
        title: "Invalid discount",
        description: "Enter a percentage between 0 and 100.",
        variant: "destructive",
      });
      return;
    }

    const next = { ...settings };
    networks.forEach((n) => {
      basePackages[n.name]?.forEach((pkg) => {
        const key = `${n.name}-${pkg.size}`;
        const current = next[key] || {
          network: n.name,
          package_size: pkg.size,
          agent_price: null,
          public_price: null,
          is_unavailable: false,
        };
        const reducedUserPrice = parseFloat((pkg.price * (1 - discount / 100)).toFixed(2));
        next[key] = { ...current, public_price: reducedUserPrice };
      });
    });

    setSettings(next);
    toast({
      title: "User prices updated",
      description: `Reduced all user prices by ${discount}% (click Save All Changes to publish).`,
    });
  };

  if (loading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Package Management</h1>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save All Changes
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Override prices for agents and users (public site). Leave blank to use default prices.
        Toggle unavailable to hide packages site-wide.
      </p>

      {activeApiSource === "secondary" && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm">
          API 2 is active. Storefront data prices are automatically increased by {((activeMultiplier - 1) * 100).toFixed(2)}%.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>AFA Bundle Pricing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium mb-1">User AFA Price</p>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={afaPublicPrice}
                onChange={(e) => setAfaPublicPrice(e.target.value === "" ? 0 : Number(e.target.value))}
                className="bg-secondary"
                placeholder="12.50"
              />
              <p className="text-xs text-muted-foreground mt-1">Used on the public AFA bundle page.</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Agent AFA Price</p>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={afaAgentPrice}
                onChange={(e) => setAfaAgentPrice(e.target.value === "" ? 0 : Number(e.target.value))}
                className="bg-secondary"
                placeholder="12.50"
              />
              <p className="text-xs text-muted-foreground mt-1">Used in agent dashboard AFA and agent store AFA section.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border border-border rounded-lg bg-card">
        <div className="flex-1">
          <p className="font-medium">Bulk reduce user prices</p>
          <p className="text-xs text-muted-foreground">
            Apply one discount to all user/public package prices, then save.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min="0.01"
            max="99.99"
            step="0.01"
            value={userDiscountPercent}
            onChange={(e) => setUserDiscountPercent(e.target.value)}
            placeholder="e.g. 5"
            className="w-28 bg-secondary"
          />
          <span className="text-sm text-muted-foreground">%</span>
          <Button type="button" variant="outline" onClick={applyUserDiscount}>
            Apply
          </Button>
        </div>
      </div>

      <Tabs defaultValue="MTN">
        <TabsList>
          {networks.map((n) => (
            <TabsTrigger key={n.name} value={n.name}>{n.name}</TabsTrigger>
          ))}
        </TabsList>

        {networks.map((n) => (
          <TabsContent key={n.name} value={n.name}>
            <Card>
              <CardHeader>
                <CardTitle>{n.name} Packages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-2">
                    <div className="col-span-2">Package</div>
                    <div className="col-span-2">Base Price</div>
                    <div className="col-span-3">Agent Price</div>
                    <div className="col-span-3">User Price</div>
                    <div className="col-span-2 text-center">Available</div>
                  </div>

                  {basePackages[n.name]?.map((pkg) => {
                    const s = getSetting(n.name, pkg.size);
                    return (
                      <div key={pkg.size} className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg border ${s.is_unavailable ? "bg-destructive/5 border-destructive/20" : "border-border"}`}>
                        <div className="col-span-2">
                          <span className="font-medium text-sm">{pkg.size}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-sm text-muted-foreground">GH₵{pkg.price.toFixed(2)}</span>
                        </div>
                        <div className="col-span-3">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={pkg.price.toFixed(2)}
                            value={s.agent_price ?? ""}
                            onChange={(e) => updateSetting(n.name, pkg.size, "agent_price", e.target.value ? parseFloat(e.target.value) : null)}
                            className="h-8 text-sm bg-secondary"
                          />
                        </div>
                        <div className="col-span-3">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={(pkg.price * 1.12).toFixed(2)}
                            value={s.public_price ?? ""}
                            onChange={(e) => updateSetting(n.name, pkg.size, "public_price", e.target.value ? parseFloat(e.target.value) : null)}
                            className="h-8 text-sm bg-secondary"
                          />
                        </div>
                        <div className="col-span-2 flex justify-center items-center gap-2">
                          <Switch
                            checked={!s.is_unavailable}
                            onCheckedChange={(checked) => updateSetting(n.name, pkg.size, "is_unavailable", !checked)}
                          />
                          {s.is_unavailable && <Badge variant="destructive" className="text-xs">Off</Badge>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default AdminPackages;
