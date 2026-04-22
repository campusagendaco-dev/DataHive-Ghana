import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Menu, X, ArrowLeft, MapPin, Users, TrendingUp,
  Phone, Mail, MessageCircle, ChevronRight, Store,
  ShoppingBag, Zap, HelpCircle,
} from "lucide-react";

const openTutorial = () => window.dispatchEvent(new CustomEvent("open-tutorial"));

/* WhatsApp SVG icon */
const WAIcon = () => (
  <svg viewBox="0 0 32 32" width="15" height="15" fill="currentColor">
    <path d="M16.004 2.667C8.64 2.667 2.667 8.64 2.667 16c0 2.347.614 4.56 1.693 6.48L2.667 29.333l7.04-1.653A13.28 13.28 0 0016.004 29.333C23.36 29.333 29.333 23.36 29.333 16S23.36 2.667 16.004 2.667zm5.84 18.027c-.32-.16-1.893-.933-2.187-1.04-.293-.107-.507-.16-.72.16-.213.32-.827 1.04-.987 1.253-.16.213-.347.24-.667.08-.32-.16-1.36-.507-2.587-1.6-.96-.853-1.6-1.907-1.787-2.227-.187-.32 0-.48.147-.627.133-.133.32-.347.48-.52.16-.173.213-.32.32-.533.107-.213.053-.4-.027-.56-.08-.16-.72-1.733-.987-2.373-.253-.613-.52-.533-.72-.547h-.613c-.213 0-.56.08-.853.4-.293.32-1.12 1.093-1.12 2.667 0 1.573 1.147 3.093 1.307 3.307.16.213 2.267 3.467 5.493 4.853.773.333 1.373.533 1.84.68.773.24 1.48.213 2.027.133.627-.093 1.893-.773 2.16-1.52.267-.747.267-1.387.187-1.52-.08-.133-.293-.213-.613-.373z"/>
  </svg>
);

export interface StoreNavbarProps {
  storeName: string;
  agentSlug?: string;
  networkAccent?: string;
  whatsappNumber?: string;
  whatsappGroupLink?: string;
  supportNumber?: string;
  email?: string;
  showSubAgentLink?: boolean;
  /** If true, show "← Back to store" instead of full nav */
  backMode?: boolean;
  /** Label for back link */
  backLabel?: string;
  /** Href for back link */
  backHref?: string;
  /** Optional step label shown in back-mode (e.g. "Step 1 of 2") */
  stepLabel?: string;
}

const StoreNavbar = ({
  storeName,
  agentSlug,
  networkAccent = "#f59e0b",
  whatsappNumber,
  whatsappGroupLink,
  supportNumber,
  email,
  showSubAgentLink = false,
  backMode = false,
  backLabel,
  backHref,
  stepLabel,
}: StoreNavbarProps) => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const waHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber.replace(/\D+/g, "")}`
    : null;

  return (
    <nav
      ref={menuRef}
      className="sticky top-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? "rgba(8,8,20,0.97)" : "rgba(8,8,20,0.90)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        boxShadow: scrolled ? "0 4px 32px rgba(0,0,0,0.5)" : "none",
      }}
    >
      {/* ── Main bar ── */}
      <div className="container mx-auto max-w-3xl flex items-center justify-between px-4 h-16">

        {/* Left: logo + name */}
        <div className="flex items-center gap-2.5 min-w-0">
          {backMode && backHref ? (
            <button
              onClick={() => navigate(backHref)}
              className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors text-sm font-medium shrink-0 mr-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{backLabel || "Back"}</span>
            </button>
          ) : (
            agentSlug && (
              <Link to={`/store/${agentSlug}`} className="text-white/40 hover:text-white/70 transition-colors shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            )
          )}

          <Link to={agentSlug ? `/store/${agentSlug}` : "/"} className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <img src="/logo.png" alt="SwiftData Ghana" className="w-9 h-9 rounded-full ring-1 ring-white/10" />
              <span
                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#080814]"
                style={{ background: networkAccent }}
              />
            </div>
            <div className="leading-tight min-w-0">
              <p className="text-white font-bold text-sm leading-none truncate max-w-[130px] sm:max-w-[220px]">
                {storeName}
              </p>
              <p className="text-[10px] font-semibold mt-0.5 leading-none" style={{ color: networkAccent }}>
                {backMode ? (stepLabel || "Sub Agent Signup") : "Data Reselling Store"}
              </p>
            </div>
          </Link>
        </div>

        {/* Right: desktop actions */}
        <div className="hidden md:flex items-center gap-1.5">
          {!backMode && (
            <>
              <Link
                to="/order-status"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-white/55 hover:text-white hover:bg-white/8 transition-all"
              >
                <MapPin className="w-3.5 h-3.5" /> Track Order
              </Link>

              {showSubAgentLink && agentSlug && (
                <Link
                  to={`/store/${agentSlug}/sub-agent`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-white/55 hover:text-white hover:bg-white/8 transition-all"
                >
                  <TrendingUp className="w-3.5 h-3.5" /> Join as Sub-Agent
                </Link>
              )}

              <button
                onClick={openTutorial}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-white/55 hover:text-white hover:bg-white/8 transition-all"
              >
                <HelpCircle className="w-3.5 h-3.5" /> Help
              </button>

              {/* WhatsApp CTA */}
              {waHref && (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all hover:scale-105 active:scale-95"
                  style={{ background: "#25D366" }}
                >
                  <WAIcon /> Contact
                </a>
              )}

              {whatsappGroupLink && (
                <a
                  href={whatsappGroupLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 border border-white/15 text-white/70 hover:text-white hover:border-white/30 text-xs font-medium px-3 py-2 rounded-xl transition-all"
                >
                  <Users className="w-3.5 h-3.5" /> Group
                </a>
              )}
            </>
          )}

          {backMode && waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all hover:scale-105"
              style={{ background: "#25D366" }}
            >
              <WAIcon /> WhatsApp
            </a>
          )}
        </div>

        {/* Mobile: WhatsApp pill + hamburger */}
        <div className="md:hidden flex items-center gap-2">
          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg"
              style={{ background: "#25D366" }}
            >
              <WAIcon />
              <span className="hidden xs:inline">Chat</span>
            </a>
          )}
          {!backMode && (
            <button
              onClick={() => setOpen(!open)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/8 transition-colors"
            >
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>

      {/* ── Mobile slide-down menu ── */}
      {!backMode && (
        <div
          className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
            open ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0"
          }`}
          style={{ borderTop: open ? "1px solid rgba(255,255,255,0.07)" : "none" }}
        >
          <div className="px-4 py-4 space-y-1" style={{ background: "rgba(6,6,16,0.99)" }}>

            {/* Store info card */}
            <div className="flex items-center gap-3 px-3 py-3 mb-3 rounded-xl border border-white/8"
              style={{ background: "rgba(255,255,255,0.03)" }}>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${networkAccent}15`, border: `1px solid ${networkAccent}30` }}
              >
                <Store className="w-5 h-5" style={{ color: networkAccent }} />
              </div>
              <div className="min-w-0">
                <p className="text-white font-bold text-sm truncate">{storeName}</p>
                <p className="text-white/40 text-xs">SwiftData Reseller</p>
              </div>
            </div>

            {/* Navigation */}
            <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest px-3 pb-1">Navigate</p>

            <Link
              to="/order-status"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-white/65 hover:text-white hover:bg-white/8 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5">
                <MapPin className="w-4 h-4 text-white/50" />
              </div>
              Track My Order
            </Link>

            {agentSlug && (
              <Link
                to={`/store/${agentSlug}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-white/65 hover:text-white hover:bg-white/8 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5">
                  <ShoppingBag className="w-4 h-4 text-white/50" />
                </div>
                Browse Bundles
              </Link>
            )}

            {showSubAgentLink && agentSlug && (
              <Link
                to={`/store/${agentSlug}/sub-agent`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-white/65 hover:text-white hover:bg-white/8 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${networkAccent}12` }}>
                  <TrendingUp className="w-4 h-4" style={{ color: networkAccent }} />
                </div>
                Become a Sub-Agent
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: networkAccent, background: `${networkAccent}15` }}>
                  Earn
                </span>
              </Link>
            )}

            <button
              onClick={() => { setOpen(false); openTutorial(); }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-white/65 hover:text-white hover:bg-white/8 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5">
                <HelpCircle className="w-4 h-4 text-white/50" />
              </div>
              How It Works
              <span className="ml-auto text-[10px] font-bold text-amber-400/70 bg-amber-400/10 px-1.5 py-0.5 rounded">Tutorial</span>
            </button>

            {/* Contact */}
            {(waHref || whatsappGroupLink || supportNumber || email) && (
              <>
                <div className="h-px bg-white/8 my-2" />
                <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest px-3 pb-1">Contact</p>

                {waHref && (
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-white/65 hover:text-white hover:bg-white/8 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(37,211,102,0.12)" }}>
                      <MessageCircle className="w-4 h-4 text-[#25D366]" />
                    </div>
                    WhatsApp Chat
                  </a>
                )}

                {whatsappGroupLink && (
                  <a
                    href={whatsappGroupLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-white/65 hover:text-white hover:bg-white/8 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(37,211,102,0.08)" }}>
                      <Users className="w-4 h-4 text-[#25D366]" />
                    </div>
                    WhatsApp Group
                  </a>
                )}

                {supportNumber && (
                  <a
                    href={`tel:${supportNumber.replace(/\D+/g, "")}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-white/65 hover:text-white hover:bg-white/8 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5">
                      <Phone className="w-4 h-4 text-white/50" />
                    </div>
                    {supportNumber}
                  </a>
                )}

                {email && (
                  <a
                    href={`mailto:${email}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-white/65 hover:text-white hover:bg-white/8 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5">
                      <Mail className="w-4 h-4 text-white/50" />
                    </div>
                    {email}
                  </a>
                )}
              </>
            )}

            {/* Footer note */}
            <div className="h-px bg-white/8 my-2" />
            <div className="flex items-center justify-center gap-1.5 py-1">
              <Zap className="w-3 h-3 text-amber-400" />
              <span className="text-white/20 text-xs">Powered by SwiftData Ghana</span>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default StoreNavbar;
