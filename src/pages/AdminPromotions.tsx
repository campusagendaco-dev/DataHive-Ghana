import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Ticket, Plus, Loader2, Trash2 } from "lucide-react";

interface PromoCode {
  id: string;
  code: string;
  discount_percentage: number;
  max_uses: number;
  current_uses: number;
  is_active: boolean;
  created_at: string;
}

const AdminPromotions = () => {
  const { toast } = useToast();
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Form state
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState("10");
  const [maxUses, setMaxUses] = useState("100");

  const fetchPromos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("promo_codes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error fetching promos", description: error.message, variant: "destructive" });
    } else {
      setPromos(data as PromoCode[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPromos();
  }, []);

  const handleGenerate = async () => {
    if (!code.trim()) {
      toast({ title: "Code is required", variant: "destructive" });
      return;
    }
    const pct = parseFloat(discount);
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      toast({ title: "Invalid discount percentage", variant: "destructive" });
      return;
    }
    const max = parseInt(maxUses);
    if (isNaN(max) || max < 1) {
      toast({ title: "Invalid max uses", variant: "destructive" });
      return;
    }

    setGenerating(true);
    const { error } = await supabase.from("promo_codes").insert({
      code: code.trim().toUpperCase(),
      discount_percentage: pct,
      max_uses: max,
      is_active: true,
    });

    if (error) {
      toast({ title: "Failed to create code", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Promo code created!" });
      setCode("");
      setDiscount("10");
      setMaxUses("100");
      fetchPromos();
    }
    setGenerating(false);
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from("promo_codes").update({ is_active: !currentStatus }).eq("id", id);
    if (error) {
      toast({ title: "Failed to update", variant: "destructive" });
    } else {
      fetchPromos();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this code?")) return;
    const { error } = await supabase.from("promo_codes").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", variant: "destructive" });
    } else {
      fetchPromos();
    }
  };

  return (
    <div className="space-y-6 max-w-5xl pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Promo Codes & Sales</h1>
          <p className="text-sm text-muted-foreground mt-1">Generate discount codes to drive user acquisition.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Active Promotions</CardTitle>
              <CardDescription>Currently valid discount codes.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : promos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Ticket className="w-12 h-12 text-muted-foreground opacity-20 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No active promo codes</p>
                  <p className="text-xs text-muted-foreground mt-1">Create a new code to see it here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {promos.map((promo) => (
                    <div key={promo.id} className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-mono font-bold text-lg text-amber-400">{promo.code}</p>
                          <Badge variant={promo.is_active ? "default" : "secondary"} className={promo.is_active ? "bg-green-500/10 text-green-500 hover:bg-green-500/20" : ""}>
                            {promo.is_active ? "Active" : "Disabled"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {promo.discount_percentage}% off • Used {promo.current_uses} / {promo.max_uses} times
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleToggleActive(promo.id, promo.is_active)}>
                          {promo.is_active ? "Disable" : "Enable"}
                        </Button>
                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-400 hover:bg-red-500/10" onClick={() => handleDelete(promo.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Generator</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input placeholder="e.g. FLASH20" className="uppercase font-mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
              </div>
              <div className="space-y-2">
                <Label>Discount Percentage</Label>
                <div className="relative">
                  <Input type="number" placeholder="10" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Max Uses</Label>
                <Input type="number" placeholder="100" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
              </div>
              <Button className="w-full" onClick={handleGenerate} disabled={generating || !code}>
                {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Generate Code
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminPromotions;
