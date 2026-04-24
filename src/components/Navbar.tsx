import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Menu, X, LogOut, LayoutDashboard, ShieldCheck,
  TrendingUp, Home, HelpCircle, ChevronRight,
  User, Settings, Wallet, ClipboardList, Store, Sun, Moon,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAppTheme } from "@/contexts/ThemeContext";


const openTutorial = () => window.dispatchEvent(new CustomEvent("open-tutorial"));

/* icon helper */
const NavIcon = ({ icon: Icon, className = "" }: { icon: typeof Home; className?: string }) => (
  <Icon className={`w-4 h-4 shrink-0 ${className}`} />
);

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, isAdmin, signOut } = useAuth();
  const { isDark, toggleDark } = useAppTheme();
  const menuRef = useRef<HTMLDivElement>(null);

  /* close on route change */
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  /* shadow on scroll */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* close on outside click */
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    navigate("/");
  };

  const isActive = (to: string) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  const agentApproved = profile?.agent_approved || profile?.sub_agent_approved;

  /* ── Desktop nav links ── */
  const mainLinks = [
    { to: "/", label: "Home", icon: Home },
    { to: "/order-status", label: "Track Order", icon: LayoutDashboard },
    ...(!user || !agentApproved ? [{ to: "/agent-program", label: "Become an Agent", icon: TrendingUp }] : []),
  ];

  const navBg   = isDark
    ? (scrolled ? "rgba(13,13,24,0.97)"    : "rgba(13,13,24,0.92)")
    : (scrolled ? "rgba(255,255,255,0.97)" : "rgba(255,255,255,0.90)");
  const navBorder = scrolled
    ? `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)"}`
    : "1px solid transparent";
  const navShadow = scrolled
    ? (isDark ? "0 4px 32px rgba(0,0,0,0.4)" : "0 4px 24px rgba(0,0,0,0.08)")
    : "none";
  const linkIdle    = isDark ? "text-white/60 hover:text-white hover:bg-white/8"   : "text-gray-600 hover:text-gray-900 hover:bg-black/5";
  const linkActive  = isDark ? "bg-white/10 text-white"                            : "bg-black/6 text-gray-900";
  const logoText    = isDark ? "text-white"   : "text-gray-900";
  const dividerBg   = isDark ? "bg-white/10"  : "bg-black/10";
  const mobileMenuBg= isDark ? "rgba(10,10,20,0.98)" : "rgba(255,255,255,0.99)";
  const mobileItemIdle   = isDark ? "text-white/65 hover:text-white hover:bg-white/8" : "text-gray-600 hover:text-gray-900 hover:bg-black/5";
  const mobileItemActive = isDark ? "bg-white/10 text-white" : "bg-black/6 text-gray-900";

  return (
    <nav
      ref={menuRef}
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: navBg,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: navBorder,
        boxShadow: navShadow,
      }}
    >
      <div className="container mx-auto flex items-center justify-between h-16 px-4">

        {/* ── Logo ── */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0" aria-label="SwiftData Ghana">
          <div className="relative">
            <img
              src="/logo.png"
              alt="SwiftData Ghana"
              className="w-10 h-10 rounded-full shrink-0 ring-1 ring-amber-400/20"
              width={40} height={40}
            />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center border-2 border-[#0d0d18] shadow-lg animate-pulse-subtle">
              <ShieldCheck className="w-3 h-3 text-white" />
            </div>
          </div>
          <div className="leading-tight hidden sm:block">
            <span className={`${logoText} font-black text-sm block leading-none tracking-tight`}>SwiftData Ghana</span>
            <span className="text-amber-400 text-[10px] leading-none font-semibold">#1 Cheapest Data Bundles</span>
          </div>
        </Link>

        {/* ── Desktop nav ── */}
        <div className="hidden md:flex items-center gap-0.5">
          {mainLinks.map(({ to, label, icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${isActive(to) ? linkActive : linkIdle}`}
            >
              <NavIcon icon={icon} className={isActive(to) ? "text-amber-400" : ""} />
              {label}
            </Link>
          ))}

          {/* Tutorial */}
          <button
            onClick={openTutorial}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${linkIdle}`}
          >
            <NavIcon icon={HelpCircle} />
            How It Works
          </button>

          {/* Divider */}
          <div className={`w-px h-5 ${dividerBg} mx-1`} />

          {/* Dark / Light toggle */}
          <button
            onClick={toggleDark}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${linkIdle}`}
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDark
              ? <Sun  className="w-4 h-4 text-amber-400" />
              : <Moon className="w-4 h-4" />}
          </button>

          {/* Dashboard / Admin shortcut */}
          {user && (
            <Link
              to={isAdmin ? "/admin" : "/dashboard"}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${isActive("/dashboard") || isActive("/admin") ? linkActive : linkIdle}`}
            >
              <NavIcon icon={isAdmin ? ShieldCheck : LayoutDashboard}
                className={isActive("/dashboard") || isActive("/admin") ? "text-amber-400" : ""} />
              {isAdmin ? "Admin" : "Dashboard"}
            </Link>
          )}

          {/* Auth CTA */}
          {user ? (
            <button
              onClick={handleSignOut}
              className={`ml-1 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${linkIdle}`}
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          ) : (
            <Link
              to="/login"
              className="ml-1 flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-black text-sm font-bold px-4 py-2 rounded-xl transition-all hover:scale-105 active:scale-95"
            >
              Get Started <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {/* ── Mobile right side ── */}
        <div className="md:hidden flex items-center gap-2">
          {/* Dark / Light toggle (mobile) */}
          <button
            onClick={toggleDark}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 ${linkIdle}`}
            title={isDark ? "Light Mode" : "Dark Mode"}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
          {!user && (
            <Link
              to="/login"
              className="flex items-center gap-1 bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold px-3 py-2 rounded-lg transition-all"
            >
              Sign In
            </Link>
          )}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${isDark ? "text-white/70 hover:text-white hover:bg-white/8" : "text-gray-600 hover:text-gray-900 hover:bg-black/5"}`}
            aria-label="Menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ── Mobile menu ── */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${menuOpen ? "max-h-[640px] opacity-100" : "max-h-0 opacity-0"}`}
        style={{ borderTop: menuOpen ? `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)"}` : "none" }}
      >
        <div className="px-4 py-4 space-y-1" style={{ background: mobileMenuBg }}>

          {/* User greeting */}
          {user && (
            <div className={`flex items-center gap-3 px-3 py-3 mb-2 rounded-xl border ${isDark ? "border-white/8 bg-white/[0.03]" : "border-black/8 bg-black/[0.02]"}`}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center bg-amber-400/15 border border-amber-400/20 shrink-0">
                <User className="w-4 h-4 text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className={`${logoText} text-sm font-bold truncate`}>{profile?.full_name || "My Account"}</p>
                <p className={`${isDark ? "text-white/40" : "text-gray-400"} text-xs truncate`}>{profile?.store_name || (isAdmin ? "Administrator" : "Customer")}</p>
              </div>
            </div>
          )}

          {/* Main links */}
          <p className={`${isDark ? "text-white/25" : "text-gray-400"} text-[10px] font-bold uppercase tracking-widest px-3 pb-1`}>Explore</p>
          {mainLinks.map(({ to, label, icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${isActive(to) ? mobileItemActive : mobileItemIdle}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isActive(to) ? "bg-amber-400/15" : (isDark ? "bg-white/5" : "bg-black/5")}`}>
                <NavIcon icon={icon} className={isActive(to) ? "text-amber-400" : (isDark ? "text-white/50" : "text-gray-400")} />
              </div>
              {label}
              {isActive(to) && <ChevronRight className={`w-4 h-4 ml-auto ${isDark ? "text-white/30" : "text-gray-300"}`} />}
            </Link>
          ))}

          {/* Help */}
          <button
            onClick={() => { setMenuOpen(false); openTutorial(); }}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${mobileItemIdle}`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDark ? "bg-white/5" : "bg-black/5"}`}>
              <HelpCircle className={`w-4 h-4 ${isDark ? "text-white/50" : "text-gray-400"}`} />
            </div>
            How It Works
            <span className="ml-auto text-[10px] font-bold text-amber-400/70 bg-amber-400/10 px-1.5 py-0.5 rounded">Tutorial</span>
          </button>

          {/* Account links (logged in) */}
          {user && (
            <>
              <div className={`h-px ${isDark ? "bg-white/8" : "bg-black/8"} my-2`} />
              <p className={`${isDark ? "text-white/25" : "text-gray-400"} text-[10px] font-bold uppercase tracking-widest px-3 pb-1`}>Account</p>

              {[
                { to: isAdmin ? "/admin" : "/dashboard", label: "Dashboard", icon: LayoutDashboard },
                { to: "/dashboard/wallet", label: "My Wallet", icon: Wallet },
                { to: "/dashboard/transactions", label: "My Transactions", icon: ClipboardList },
                ...(agentApproved ? [{ to: "/dashboard/my-store", label: "My Store", icon: Store }] : []),
                { to: "/dashboard/account-settings", label: "Account Settings", icon: Settings },
              ].map(({ to, label, icon: Icon }) => (
                <Link key={to} to={to} className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${mobileItemIdle}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDark ? "bg-white/5" : "bg-black/5"}`}>
                    <Icon className={`w-4 h-4 ${isDark ? "text-white/50" : "text-gray-400"}`} />
                  </div>
                  {label}
                </Link>
              ))}

              {isAdmin && (
                <Link to="/admin" className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${mobileItemIdle}`}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-amber-400/10">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                  </div>
                  Admin Panel
                  <span className="ml-auto text-[10px] font-bold text-amber-400/70 bg-amber-400/10 px-1.5 py-0.5 rounded">Admin</span>
                </Link>
              )}
            </>
          )}

          {/* Auth footer */}
          <div className={`h-px ${isDark ? "bg-white/8" : "bg-black/8"} my-2`} />
          {user ? (
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-red-400/70 hover:text-red-400 hover:bg-red-500/8 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-red-500/8">
                <LogOut className="w-4 h-4 text-red-400/60" />
              </div>
              Sign Out
            </button>
          ) : (
            <Link
              to="/login"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold text-black transition-all"
              style={{ background: "#f59e0b" }}
            >
              Get Started — It's Free <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
