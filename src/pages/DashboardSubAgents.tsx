import { Users2, Clock } from "lucide-react";

const DashboardSubAgents = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-amber-400/15 flex items-center justify-center mb-6">
        <Users2 className="w-10 h-10 text-amber-500" />
      </div>
      <div className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-400/30 rounded-full px-4 py-1.5 mb-4">
        <Clock className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-amber-600 text-xs font-semibold uppercase tracking-widest">Coming Soon</span>
      </div>
      <h1 className="font-display text-3xl font-black text-foreground mb-3">Sub Agents</h1>
      <p className="text-muted-foreground text-sm max-w-sm">
        Recruit and manage your own sub-agents, track their orders, and earn commissions. This feature is on its way.
      </p>
    </div>
  );
};

export default DashboardSubAgents;
