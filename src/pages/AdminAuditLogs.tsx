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

  const [logType, setLogType] = useState<"audit" | "api">("audit");
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async (isLoadMore = false) => {
    if (!isLoadMore) {
      setLoading(true);
      setPage(0);
    }
    setError(null);
    try {
      const currentPage = isLoadMore ? page + 1 : 0;
      const from = currentPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const table = logType === "audit" ? "audit_logs" : "api_logs";
      const { data: logData, error: logError } = await supabase
        .from(table)
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);
      
      if (logError) throw logError;

      if (logData && logData.length > 0) {
        let enrichedLogs = logData;
        if (logType === "audit") {
          const adminIds = [...new Set(logData.map(l => l.admin_id).filter(Boolean))];
          let profileMap: Record<string, string> = {};
          if (adminIds.length > 0) {
            const { data: profileData } = await supabase.from("profiles").select("user_id, full_name").in("user_id", adminIds);
            if (profileData) profileMap = profileData.reduce((acc, curr) => ({ ...acc, [curr.user_id]: curr.full_name }), {});
          }
          enrichedLogs = logData.map(log => ({ ...log, profiles: log.admin_id ? { full_name: profileMap[log.admin_id] || "Unknown Admin" } : null }));
        } else {
          const userIds = [...new Set(logData.map(l => l.user_id).filter(Boolean))];
          let profileMap: Record<string, string> = {};
          if (userIds.length > 0) {
            const { data: profileData } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
            if (profileData) profileMap = profileData.reduce((acc, curr) => ({ ...acc, [curr.user_id]: curr.full_name }), {});
          }
          enrichedLogs = logData.map(log => ({ ...log, profiles: log.user_id ? { full_name: profileMap[log.user_id] || "API Client" } : null }));
        }

        setLogs(prev => isLoadMore ? [...prev, ...enrichedLogs] : enrichedLogs);
        setHasMore(logData.length === PAGE_SIZE);
        if (isLoadMore) setPage(currentPage);
      } else {
        if (!isLoadMore) setLogs([]);
        setHasMore(false);
      }
    } catch (err: any) {
      setError(err.message || "Could not load logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [logType]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatAction = (action: string) => {
    if (!action) return "Unknown";
    return action.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  return (
    <div className="space-y-6 max-w-6xl pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">System Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">Audit administrative actions and API activity.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
          <button 
            onClick={() => setLogType("audit")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${logType === "audit" ? "bg-amber-500 text-black shadow-lg" : "text-white/40 hover:text-white"}`}
          >
            Admin Actions
          </button>
          <button 
            onClick={() => setLogType("api")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${logType === "api" ? "bg-sky-500 text-black shadow-lg" : "text-white/40 hover:text-white"}`}
          >
            API Activity
          </button>
        </div>
      </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-[10px] font-bold text-green-500 uppercase tracking-wider">Live Activity</span>
          </div>
        </div>
        <button 
          onClick={() => fetchLogs(false)} 
          disabled={loading}
          className="flex items-center gap-2 text-xs font-semibold bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg transition-colors border border-white/10"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileSearch className="w-3 h-3" />}
          Refresh Logs
        </button>
      </div>

      {error && (
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="p-4 text-red-500 text-sm flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            Error: {error}
          </CardContent>
        </Card>
      )}

      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="p-4 flex items-start gap-4">
          <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-500">Security Notice</p>
            <p className="text-xs text-muted-foreground mt-1 text-pretty">
              Audit logs are **immutable and permanent**. They record every sensitive action taken by administrators to ensure accountability and platform integrity.
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
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <FileSearch className="w-8 h-8 text-muted-foreground opacity-30" />
              </div>
              <p className="text-base font-semibold text-white/80">Audit Log is Empty</p>
              <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                No administrative actions have been recorded yet. The system will automatically log actions like price updates, wallet top-ups, and user management.
              </p>
              <button 
                onClick={() => fetchLogs(false)}
                className="mt-6 text-xs text-amber-400 hover:underline font-medium"
              >
                Check again
              </button>
            </div>
          ) : (
            <>
              {/* Desktop View */}
                <Table>
                  <TableHeader>
                    <TableRow className="bg-white/5 hover:bg-white/5 border-white/5">
                      <TableHead className="w-[180px] text-white/50 uppercase text-[10px] font-black tracking-widest">Timestamp</TableHead>
                      <TableHead className="text-white/50 uppercase text-[10px] font-black tracking-widest">{logType === "audit" ? "Admin" : "Agent / Client"}</TableHead>
                      <TableHead className="text-white/50 uppercase text-[10px] font-black tracking-widest">{logType === "audit" ? "Action" : "Endpoint / Ref"}</TableHead>
                      <TableHead className="text-white/50 uppercase text-[10px] font-black tracking-widest">{logType === "audit" ? "Details" : "Error Message"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id} className="border-white/5 hover:bg-white/[0.02] transition-colors">
                        <TableCell className="text-[11px] text-muted-foreground font-mono">
                          {new Date(log.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-semibold text-sm text-white/90">
                          {log.profiles?.full_name || (logType === "audit" ? "System" : "API Client")}
                        </TableCell>
                        <TableCell>
                          {logType === "audit" ? (
                            <Badge variant="outline" className="font-mono text-[10px] bg-amber-400/5 text-amber-400 border-amber-400/20">
                              {formatAction(log.action)}
                            </Badge>
                          ) : (
                            <div className="space-y-1">
                              <p className="font-mono text-[10px] text-white/70">{log.method} {log.endpoint}</p>
                              <code className="text-[10px] text-sky-400 bg-sky-400/5 px-1 rounded">{log.log_reference}</code>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground max-w-[300px] truncate group hover:text-white transition-colors cursor-help">
                          {logType === "audit" ? JSON.stringify(log.details) : log.error_message}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile View */}
              <div className="md:hidden space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="p-4 rounded-xl border border-white/5 bg-white/[0.01] space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] text-white/30 font-mono mb-1">{new Date(log.created_at).toLocaleString()}</p>
                        <p className="font-bold text-sm text-white/90">{log.profiles?.full_name || (logType === "audit" ? "System" : "API Client")}</p>
                      </div>
                      {logType === "audit" ? (
                        <Badge variant="outline" className="font-mono text-[9px] bg-amber-400/5 text-amber-400 border-amber-400/20 shrink-0">
                          {formatAction(log.action)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="font-mono text-[9px] bg-sky-400/5 text-sky-400 border-sky-400/20 shrink-0">
                          {log.log_reference}
                        </Badge>
                      )}
                    </div>
                    <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                      <p className="text-[10px] text-white/40 font-mono break-all line-clamp-3">
                        {logType === "audit" ? JSON.stringify(log.details) : `${log.method} ${log.endpoint} - ${log.error_message}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
                {hasMore && (
                  <div className="pt-8 flex justify-center border-t border-white/5 mt-6">
                    <button
                      onClick={() => fetchLogs(true)}
                      disabled={loading}
                      className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-2"
                    >
                      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileSearch className="w-3 h-3" />}
                      Load Older Logs
                    </button>
                  </div>
                )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAuditLogs;
