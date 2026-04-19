import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DashboardAccountSettings = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    setFullName(profile?.full_name || "");
    setPhone(profile?.phone || "");
    setEmail(profile?.email || user?.email || "");
  }, [profile, user?.email]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!fullName.trim()) {
      toast({ title: "Full name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
      })
      .eq("user_id", user.id);

    if (error) {
      toast({ title: "Could not save account settings", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    await refreshProfile();
    toast({ title: "Account settings saved" });
    setSaving(false);
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl space-y-6">
      <h1 className="font-display text-2xl font-bold">Account Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label htmlFor="account-name">Full Name</Label>
              <Input id="account-name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1" required />
            </div>
            <div>
              <Label htmlFor="account-email">Email</Label>
              <Input id="account-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="account-phone">Phone</Label>
              <Input id="account-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" />
            </div>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardAccountSettings;
