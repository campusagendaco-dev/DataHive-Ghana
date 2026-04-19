import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";

const DashboardMyStore = () => {
  const { profile } = useAuth();
  const isPaidAgent = Boolean(profile?.agent_approved || profile?.sub_agent_approved);
  const storeUrl = profile?.slug ? `${window.location.origin}/store/${profile.slug}` : null;

  if (!isPaidAgent) {
    return (
      <div className="p-6 md:p-8 max-w-3xl space-y-6">
        <h1 className="font-display text-2xl font-bold">My Store</h1>
        <Card>
          <CardHeader>
            <CardTitle>Unlock Your Personalized Store</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pay GHS 80 once to become an agent and unlock your personalized customer store,
              cheaper prices, withdrawals, store settings, subagents, flyer generator, and more.
            </p>
            <Button asChild>
              <Link to="/agent-program">Become an Agent (GHS 80)</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl space-y-6">
      <h1 className="font-display text-2xl font-bold">My Store</h1>

      <Card>
        <CardHeader>
          <CardTitle>Store Access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Your store is active. Share your link with customers.</p>
          {storeUrl ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Live URL</p>
              <code className="block bg-secondary rounded-md px-3 py-2 text-sm break-all">{storeUrl}</code>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Set your store name in Store Settings to generate your custom store URL.</p>
          )}
          <div className="flex gap-2 flex-wrap">
            <Button asChild variant="outline">
              <Link to="/dashboard/store-settings">Store Settings</Link>
            </Button>
            {storeUrl && (
              <Button asChild>
                <a href={storeUrl} target="_blank" rel="noreferrer">Open Store</a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardMyStore;
