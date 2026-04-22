import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSearch, ShieldAlert, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface AuditLog {
  id: string;
  action: string;
  details: any;
  created_at: string;
  profiles: { full_name: string } | null;
}

const AdminAuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*, profiles:admin_id(full_name)")
        .order("created_at", { ascending: false });
      
      if (!error && data) {
        setLogs(data as any[]);
      }
      setLoading(false);
    };

    fetchLogs();
  }, []);

  const formatAction = (action: string) => {
    return action.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  return (
    <div className="space-y-6 max-w-5xl pb-10">
      <div>
        <h1 className="font-display text-2xl font-bold">Audit Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">Track all administrative actions for security and compliance.</p>
      </div>

      <Card className="border-red-500/20 bg-red-500/5">
        <CardContent className="p-4 flex items-start gap-4">
          <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-500">Security Notice</p>
            <p className="text-xs text-muted-foreground mt-1">
              Audit logs are immutable and cannot be deleted. All sensitive actions (manual wallet top-ups, price changes, role assignments) are recorded here.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest administrative actions across the platform.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <FileSearch className="w-12 h-12 text-muted-foreground opacity-20 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No logs found</p>
              <p className="text-xs text-muted-foreground mt-1">Admin actions will populate here once recorded.</p>
            </div>
          ) : (
            <div className="rounded-md border border-white/5">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/20 hover:bg-secondary/20">
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="border-white/5">
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {log.profiles?.full_name || "System"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono text-[10px]">
                          {formatAction(log.action)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                        {JSON.stringify(log.details)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAuditLogs;
