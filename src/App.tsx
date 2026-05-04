import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DashboardLayout from "@/components/DashboardLayout";
import AdminLayout from "@/components/AdminLayout";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ThemeSelector from "@/components/ThemeSelector";
import WhatsAppButton from "@/components/WhatsAppButton";
import FreeDataButton from "@/components/FreeDataButton";
import TutorialModal from "@/components/TutorialModal";
import InstallPrompt from "@/components/InstallPrompt";
import AudioUnlocker from "@/components/AudioUnlocker";
import NotificationPopup from "@/components/NotificationPopup";
import { OfflineAlert } from "@/components/OfflineAlert";
import { useRegisterSW } from "virtual:pwa-register/react";
import LoadingScreen from "@/components/LoadingScreen";
import IpBlocked from "./pages/IpBlocked";
import Maintenance from "./pages/Maintenance";

// Route-level code splitting — each page chunk loads only when first visited
const Index = lazy(() => import("./pages/Index"));
const AgentProgram = lazy(() => import("./pages/AgentProgram"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const DashboardPricing = lazy(() => import("./pages/DashboardPricing"));
const DashboardOrders = lazy(() => import("./pages/DashboardOrders"));
const DashboardWithdraw = lazy(() => import("./pages/DashboardWithdraw"));
const DashboardWallet = lazy(() => import("./pages/DashboardWallet"));
const DashboardFlyer = lazy(() => import("./pages/DashboardFlyer"));
const DashboardSettings = lazy(() => import("./pages/DashboardSettings"));
const DashboardSubAgents = lazy(() => import("./pages/DashboardSubAgents"));
const DashboardResultCheckers = lazy(() => import("./pages/DashboardResultCheckers"));
const DashboardBuyDataNetwork = lazy(() => import("./pages/DashboardBuyDataNetwork"));
const DashboardBuyAirtime = lazy(() => import("./pages/DashboardBuyAirtime"));
const DashboardMyStore = lazy(() => import("./pages/DashboardMyStore"));
const DashboardReportIssue = lazy(() => import("./pages/DashboardReportIssue"));
const DashboardAccountSettings = lazy(() => import("./pages/DashboardAccountSettings"));
const DashboardProfile = lazy(() => import("./pages/DashboardProfile"));
const DashboardSubAgentPricing = lazy(() => import("./pages/DashboardSubAgentPricing"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const BuyData = lazy(() => import("./pages/BuyData"));
const BuyAirtime = lazy(() => import("./pages/BuyAirtime"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const VerifyOtp = lazy(() => import("./pages/VerifyOtp"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AgentPending = lazy(() => import("./pages/AgentPending"));
const AgentStore = lazy(() => import("./pages/AgentStore"));
const OrderStatus = lazy(() => import("./pages/OrderStatus"));
const PurchaseSuccess = lazy(() => import("./pages/PurchaseSuccess"));
const DashboardLeaderboard = lazy(() => import("./pages/DashboardLeaderboard"));
const AdminOverview = lazy(() => import("./pages/AdminOverview"));
const AdminAgents = lazy(() => import("./pages/AdminAgents"));
const AdminOrders = lazy(() => import("./pages/AdminOrders"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminWithdrawals = lazy(() => import("./pages/AdminWithdrawals"));
const AdminNotificationsPage = lazy(() => import("./pages/AdminNotificationsPage"));
const AdminPackages = lazy(() => import("./pages/AdminPackages"));
const AdminWalletTopup = lazy(() => import("./pages/AdminWalletTopup"));
const AdminSystemHealth = lazy(() => import("./pages/AdminSystemHealth"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics"));
const AdminPromotions = lazy(() => import("./pages/AdminPromotions"));
const AdminTickets = lazy(() => import("./pages/AdminTickets"));
const AdminAuditLogs = lazy(() => import("./pages/AdminAuditLogs"));
const AdminSecurity = lazy(() => import("./pages/AdminSecurity"));
const AdminAPIUsers = lazy(() => import("./pages/AdminAPIUsers"));
const AdminProfits = lazy(() => import("./pages/AdminProfits"));
const AdminBanners = lazy(() => import("./pages/AdminBanners"));
const AdminEngagement = lazy(() => import("./pages/AdminEngagement"));
const AdminReconciliation = lazy(() => import("./pages/AdminReconciliation"));
const SubAgentSignup = lazy(() => import("./pages/SubAgentSignup"));
const SubAgentPending = lazy(() => import("./pages/SubAgentPending"));
const DashboardDeveloperAPI = lazy(() => import("./pages/DashboardDeveloperAPI"));
const APIDocumentation = lazy(() => import("./pages/APIDocumentation"));
const DeveloperPortal = lazy(() => import("./pages/DeveloperPortal"));
const NotFound = lazy(() => import("./pages/NotFound"));
const DashboardCustomers = lazy(() => import("./pages/DashboardCustomers"));
const DashboardMarketing = lazy(() => import("./pages/DashboardMarketing"));
const DashboardUtilities = lazy(() => import("./pages/DashboardUtilities"));
const DashboardAirtimeCash = lazy(() => import("./pages/DashboardAirtimeCash"));
const DashboardReferral = lazy(() => import("./pages/DashboardReferral"));
const DashboardBulk = lazy(() => import("./pages/DashboardBulk"));
const DashboardSchedule = lazy(() => import("./pages/DashboardSchedule"));
const DashboardWhatsAppBot = lazy(() => import("./pages/DashboardWhatsAppBot"));
const MyOrders = lazy(() => import("./pages/MyOrders"));


const queryClient = new QueryClient();


/** Authenticated dashboard guard that keeps admins on the admin dashboard and unapproved agents/sub-agents on pending */
const DashboardGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, isAdmin, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (isAdmin) return <Navigate to="/admin" replace />;
  
  // Strict check for sub-agents
  if (profile?.is_sub_agent && !profile?.sub_agent_approved) {
    return <Navigate to="/sub-agent/pending" replace />;
  }

  // Strict check for main agents
  if (profile?.is_agent && !profile?.agent_approved) {
    return <Navigate to="/agent/pending" replace />;
  }
  
  return <>{children}</>;
};

/** Agent-only feature guard */
const AgentFeatureGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  const isPaidAgent = Boolean(profile?.agent_approved || profile?.sub_agent_approved);
  if (!isPaidAgent) return <Navigate to="/dashboard/my-store" replace />;
  return <>{children}</>;
};

/** Parent agent-only guard (sub-agents cannot recruit or manage sub-agent network) */
const ParentAgentOnlyGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  const isPaidAgent = Boolean(profile?.agent_approved || profile?.sub_agent_approved);
  if (!isPaidAgent) return <Navigate to="/dashboard/my-store" replace />;
  if (profile?.is_sub_agent) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

/** Sub-agent pending guard */
const SubAgentPendingGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile?.is_sub_agent) return <Navigate to="/" replace />;
  if (profile?.sub_agent_approved) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

/** Admin guard */
const AdminGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin, profile, loading } = useAuth();
  const [ipAllowed, setIpAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (isAdmin && user) {
      const checkIp = async () => {
        try {
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("allowed_ips")
            .eq("user_id", user.id)
            .eq("role", "admin")
            .maybeSingle();

          const allowed = roleData?.allowed_ips as string[] | null;
          if (!allowed || allowed.length === 0) {
            setIpAllowed(true);
            return;
          }

          const res = await fetch("https://api.ipify.org?format=json");
          const { ip } = await res.json();
          setIpAllowed(allowed.includes(ip));
        } catch (e) {
          console.error("IP check failed:", e);
          setIpAllowed(true); // Fallback to allow if API fails, but logged
        }
      };
      checkIp();
    }
  }, [isAdmin, user]);

  if (loading || (isAdmin && ipAllowed === null)) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  if (ipAllowed === false) return <Navigate to="/ip-blocked" replace />;
  
  return <>{children}</>;
};

/** Agent pending guard */
const PendingGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile?.is_agent) return <Navigate to="/agent-program" replace />;
  if (profile?.agent_approved) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const AppContent = () => {
  const { user, isAdmin: isAdminUser, loading: authLoading } = useAuth();
  const location = useLocation();
  const [maintenance, setMaintenance] = useState<{ is_enabled: boolean; message: string }>({
    is_enabled: false,
    message: "",
  });
  const [ipBlocked, setIpBlocked] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(true);
  // Minimum splash time — guarantees the loading animation is visible for at least 2 s
  const [splashReady, setSplashReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSplashReady(true), 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadMaintenance = async () => {
      // Prevent polling errors when offline
      if (!window.navigator.onLine) return;

      try {
        const maintenanceResult = await Promise.race([
          supabase.functions.invoke("maintenance-mode", {
            body: { action: "get" },
          }),
          new Promise<never>((_, reject) => {
            window.setTimeout(() => reject(new Error("maintenance-timeout")), 8000);
          }),
        ]);
        const { data, error } = maintenanceResult as { data: any; error: any };

        if (!mounted) return;

        if (error) {
          setMaintenance({ is_enabled: false, message: "" });
          setIpBlocked(false);
        } else if (data && !(data as any).error) {
          setMaintenance({
            is_enabled: Boolean((data as any).is_enabled),
            message: String((data as any).message || ""),
          });
          setIpBlocked(Boolean((data as any).is_blocked));
        } else {
          setMaintenance({ is_enabled: false, message: "" });
          setIpBlocked(false);
        }
      } catch {
        if (!mounted) return;
        setMaintenance({ is_enabled: false, message: "" });
      } finally {
        if (mounted) setMaintenanceLoading(false);
      }
    };

    loadMaintenance();
    const firstLoadSafetyTimeout = window.setTimeout(() => {
      if (mounted) setMaintenanceLoading(false);
    }, 7000);

    const interval = window.setInterval(loadMaintenance, 30000);

    return () => {
      mounted = false;
      window.clearTimeout(firstLoadSafetyTimeout);
      window.clearInterval(interval);
    };
  }, []);

  const isDashboard = location.pathname.startsWith("/dashboard");
  const isAdmin = location.pathname.startsWith("/admin");
  const isAgentStore = location.pathname.startsWith("/store/");
  const isMaintenanceBypassRoute =
    location.pathname.startsWith("/admin") ||
    location.pathname === "/login" ||
    location.pathname === "/agent/login" ||
    location.pathname === "/reset-password" ||
    location.pathname === "/auth/callback" ||
    location.pathname === "/auth";
  if (authLoading || maintenanceLoading || !splashReady) {
    return <LoadingScreen />;
  }

  if (ipBlocked && !isAdminUser) {
    return <IpBlocked />;
  }

  if (maintenance.is_enabled && !user && !isAdminUser && !isMaintenanceBypassRoute) {
    return <Maintenance message={maintenance.message} />;
  }

  return (
    <>
      {!isDashboard && !isAgentStore && !isAdmin && <Navbar />}
      <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Public pages */}
        <Route path="/" element={<Index />} />
        <Route path="/agent-program" element={<AgentProgram />} />
        <Route path="/store/:slug" element={<AgentStore />} />
        <Route path="/order-status" element={<OrderStatus />} />
        <Route path="/my-orders" element={<MyOrders />} />
        <Route path="/delivery-tracker" element={<Navigate to="/order-status" replace />} />
        <Route path="/purchase-success" element={<PurchaseSuccess />} />
        <Route path="/api-docs" element={<APIDocumentation />} />
        <Route path="/developers" element={<DeveloperPortal />} />

        {/* Auth pages */}
        <Route path="/login" element={<AuthPage />} />
        <Route path="/agent/login" element={<AuthPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth" element={<Navigate to="/login" replace />} />

        {/* Public buy page — no login required */}
        <Route path="/buy-data" element={<BuyData />} />
        <Route path="/buy-airtime" element={<BuyAirtime />} />

        {/* Sub agent routes */}
        <Route path="/store/:slug/sub-agent" element={<SubAgentSignup />} />
        <Route path="/sub-agent/pending" element={<SubAgentPendingGuard><SubAgentPending /></SubAgentPendingGuard>} />

        {/* Agent flow */}
        <Route path="/agent/pending" element={<PendingGuard><AgentPending /></PendingGuard>} />

        {/* User dashboard */}
        <Route path="/dashboard" element={<DashboardGuard><DashboardLayout /></DashboardGuard>}>
          <Route index element={<Dashboard />} />
          <Route path="wallet" element={<DashboardWallet />} />
          <Route path="transactions" element={<DashboardOrders />} />
          <Route path="buy-data" element={<Navigate to="/dashboard/buy-data/mtn" replace />} />
          <Route path="buy-data/mtn" element={<DashboardBuyDataNetwork network="MTN" />} />
          <Route path="buy-data/telecel" element={<DashboardBuyDataNetwork network="Telecel" />} />
          <Route path="buy-data/airteltigo" element={<DashboardBuyDataNetwork network="AirtelTigo" />} />
          <Route path="buy-airtime" element={<DashboardBuyAirtime />} />
          <Route path="utilities" element={<DashboardUtilities />} />
          <Route path="airtime-to-cash" element={<DashboardAirtimeCash />} />
          <Route path="my-store" element={<DashboardMyStore />} />
          <Route path="report-issue" element={<DashboardReportIssue />} />
          <Route path="account-settings" element={<DashboardAccountSettings />} />
          <Route path="profile" element={<DashboardProfile />} />
          <Route path="customers" element={<DashboardCustomers />} />
          <Route path="referral" element={<DashboardReferral />} />
          <Route path="bulk" element={<AgentFeatureGuard><DashboardBulk /></AgentFeatureGuard>} />
          <Route path="schedule" element={<DashboardSchedule />} />

          {/* Paid agent-only pages */}
          <Route path="cheaper-prices" element={<AgentFeatureGuard><DashboardPricing /></AgentFeatureGuard>} />
          <Route path="withdrawals" element={<AgentFeatureGuard><DashboardWithdraw /></AgentFeatureGuard>} />
          <Route path="store-settings" element={<AgentFeatureGuard><DashboardSettings /></AgentFeatureGuard>} />
          <Route path="subagents" element={<ParentAgentOnlyGuard><DashboardSubAgents /></ParentAgentOnlyGuard>} />
          <Route path="subagent-pricing" element={<ParentAgentOnlyGuard><DashboardSubAgentPricing /></ParentAgentOnlyGuard>} />
          <Route path="flyer" element={<AgentFeatureGuard><DashboardFlyer /></AgentFeatureGuard>} />
          <Route path="/dashboard/api" element={<AgentFeatureGuard><DashboardDeveloperAPI /></AgentFeatureGuard>} />
          <Route path="result-checker" element={<AgentFeatureGuard><DashboardResultCheckers /></AgentFeatureGuard>} />
          <Route path="leaderboard" element={<AgentFeatureGuard><DashboardLeaderboard /></AgentFeatureGuard>} />
          <Route path="marketing" element={<AgentFeatureGuard><DashboardMarketing /></AgentFeatureGuard>} />
          <Route path="whatsapp-bot" element={<AgentFeatureGuard><DashboardWhatsAppBot /></AgentFeatureGuard>} />

          {/* Legacy aliases */}
          <Route path="orders" element={<Navigate to="/dashboard/transactions" replace />} />
          <Route path="withdraw" element={<Navigate to="/dashboard/withdrawals" replace />} />
          <Route path="pricing" element={<Navigate to="/dashboard/cheaper-prices" replace />} />
          <Route path="sub-agents" element={<Navigate to="/dashboard/subagents" replace />} />
          <Route path="result-checkers" element={<Navigate to="/dashboard/result-checker" replace />} />
          <Route path="settings" element={<Navigate to="/dashboard/store-settings" replace />} />
        </Route>

        {/* Admin dashboard */}
        <Route path="/admin" element={<AdminGuard><AdminLayout /></AdminGuard>}>
          <Route index element={<AdminOverview />} />
          <Route path="agents" element={<AdminAgents />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="reconciliation" element={<AdminReconciliation />} />
          <Route path="withdrawals" element={<AdminWithdrawals />} />
          <Route path="notifications" element={<AdminNotificationsPage />} />
          <Route path="packages" element={<AdminPackages />} />
          <Route path="wallet-topup" element={<AdminWalletTopup />} />
          <Route path="system-health" element={<AdminSystemHealth />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="promotions" element={<AdminPromotions />} />
          <Route path="tickets" element={<AdminTickets />} />
          <Route path="audit-logs" element={<AdminAuditLogs />} />
          <Route path="security" element={<AdminSecurity />} />
          <Route path="api-users" element={<AdminAPIUsers />} />
          <Route path="profits" element={<AdminProfits />} />
          <Route path="banners" element={<AdminBanners />} />
          <Route path="engagement" element={<AdminEngagement />} />
          <Route path="account-settings" element={<DashboardAccountSettings />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
      {!isDashboard && !isAgentStore && !isAdmin && <Footer />}
      {!isDashboard && !isAdmin && <TutorialModal />}
      <AudioUnlocker />
      <NotificationPopup />
    </>
  );
};

const App = () => {
  useRegisterSW({
    onRegistered(r) {
      console.log("SW Registered");
    },
    onRegisterError(error) {
      console.error("SW registration error", error);
    },
    onNeedRefresh() {
      // New version available — reload immediately so stale cached bundles never run
      window.location.reload();
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <OfflineAlert />
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <AppContent />
              <ThemeSelector />
              <WhatsAppButton />
              <FreeDataButton />
              <InstallPrompt />
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
