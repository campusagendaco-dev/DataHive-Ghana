import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DashboardSubAgentPricing = () => {
  return (
    <div className="p-6 md:p-8 max-w-3xl space-y-6">
      <h1 className="font-display text-2xl font-bold">Subagent Pricing</h1>

      <Card>
        <CardHeader>
          <CardTitle>Manage Subagent Prices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Configure activation fee and pricing for your subagents from the Subagents page.
          </p>
          <Button asChild>
            <Link to="/dashboard/subagents">Open Subagents</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardSubAgentPricing;
