import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { 
  Search, Package, Clock, CheckCircle2, 
  XCircle, Loader2, ArrowLeft, RefreshCw,
  Activity, ExternalLink, ShieldCheck, Zap, ArrowRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Order {
  id: string;
  customer_phone: string;
  network: string;
  package_size: string;
  amount: number;
  status: string;
  created_at: string;
  order_type: string;
}

const MyOrders = () => {
  const [searchParams] = useSearchParams();
  const phoneParam = searchParams.get("phone") || "";
  const navigate = useNavigate();
  
  const [phone, setPhone] = useState(phoneParam);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchOrders = async (targetPhone: string) => {
    if (!targetPhone) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("list-orders", {
        body: { phone: targetPhone },
      });

      if (error || !data) throw error || new Error("Failed to fetch orders");
      setOrders(data.orders || []);
    } catch (err) {
      console.error("Fetch orders error:", err);
      toast.error("Could not load orders. Please try again.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (phoneParam) {
      fetchOrders(phoneParam);
    }
  }, [phoneParam]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;
    navigate(`/my-orders?phone=${phone}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'fulfilled': return 'text-emerald-400 bg-emerald-400/10';
      case 'processing': return 'text-amber-400 bg-amber-400/10';
      case 'paid': return 'text-blue-400 bg-blue-400/10';
      case 'fulfillment_failed': 
      case 'error': return 'text-red-400 bg-red-400/10';
      default: return 'text-white/40 bg-white/5';
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 font-sans antialiased">
      <div className="max-w-md mx-auto space-y-8 pt-12 pb-24">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <button 
            onClick={() => navigate('/')}
            className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-white/60" />
          </button>
          <div className="text-center">
            <h1 className="text-xl font-black uppercase tracking-widest text-white/90">My Orders</h1>
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-tighter">Guest Tracking Portal</p>
          </div>
          <div className="w-10" /> {/* Spacer */}
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="relative group">
          <input 
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Search by phone number..."
            className="w-full py-4 px-6 rounded-[2rem] bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/50 transition-all shadow-2xl"
          />
          <button 
            type="submit"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
          >
            <Search className="w-4 h-4 text-black" />
          </button>
        </form>

        {/* Orders List */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
              <p className="text-[10px] font-black uppercase tracking-widest text-white/20">Scanning Records...</p>
            </div>
          ) : orders.length > 0 ? (
            orders.map((order) => (
              <div 
                key={order.id}
                onClick={() => navigate(`/order-status?reference=${order.id}`)}
                className="group relative overflow-hidden rounded-[2rem] bg-white/[0.03] border border-white/10 p-5 hover:bg-white/[0.05] transition-all cursor-pointer active:scale-[0.98]"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center">
                      <Package className="w-5 h-5 text-white/40" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-white/90">{order.package_size || 'Bundle'}</p>
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-tighter">{order.network} • {order.order_type || 'Data'}</p>
                    </div>
                  </div>
                  <div className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest", getStatusColor(order.status))}>
                    {order.status}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                  <div className="flex items-center gap-2 text-[9px] font-bold text-white/20 uppercase tracking-widest">
                    <Clock className="w-3 h-3" />
                    {new Date(order.created_at).toLocaleDateString()} • {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="flex items-center gap-1.5 text-[9px] font-black text-amber-400/60 uppercase tracking-widest">
                    View Details
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            ))
          ) : phoneParam ? (
            <div className="text-center py-20 space-y-4">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto border border-white/5">
                <Search className="w-6 h-6 text-white/10" />
              </div>
              <p className="text-sm font-bold text-white/20">No orders found for this number</p>
            </div>
          ) : (
            <div className="text-center py-20 space-y-4">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto border border-white/5">
                <Activity className="w-6 h-6 text-white/10" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/20">Enter your number to track orders</p>
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        {orders.length > 0 && (
          <button 
            onClick={() => { setIsRefreshing(true); fetchOrders(phoneParam); }}
            className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center gap-3 active:scale-95 transition-all"
          >
            <RefreshCw className={cn("w-4 h-4 text-white/40", isRefreshing && "animate-spin")} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Refresh Status</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default MyOrders;
