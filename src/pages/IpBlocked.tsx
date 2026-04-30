import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ban } from "lucide-react";

const IpBlocked = () => (
  <main className="min-h-screen bg-background px-4 py-16 flex items-center justify-center">
    <Card className="w-full max-w-xl">
      <CardHeader className="text-center">
        <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
          <Ban className="h-6 w-6 text-red-500" />
        </div>
        <CardTitle className="font-display text-2xl">Access Restricted</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-center text-muted-foreground">
          Your IP address has been blocked from accessing this site. If you believe this is a mistake, please contact support.
        </p>
      </CardContent>
    </Card>
  </main>
);

export default IpBlocked;
