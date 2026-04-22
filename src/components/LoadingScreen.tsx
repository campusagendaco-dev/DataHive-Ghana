const LoadingScreen = () => (
  <div
    className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
    style={{ background: "linear-gradient(160deg, #0d0d0d 0%, #1a1200 60%, #0d0d0d 100%)" }}
  >
    {/* ── Animated logo stack ── */}
    <div className="relative flex items-center justify-center mb-7">
      {/* Outermost slow orbit ring */}
      <div
        className="loading-ring-outer absolute rounded-full border-2 border-dashed"
        style={{
          width: 148,
          height: 148,
          borderColor: "rgba(251,191,36,0.18)",
        }}
      />

      {/* Middle ring — reverse spin, solid */}
      <div
        className="loading-ring-inner absolute rounded-full"
        style={{
          width: 124,
          height: 124,
          border: "3px solid transparent",
          borderTopColor: "#f59e0b",
          borderRightColor: "rgba(251,191,36,0.35)",
          borderRadius: "50%",
        }}
      />

      {/* Inner fast ring */}
      <div
        className="loading-ring-outer absolute rounded-full"
        style={{
          width: 104,
          height: 104,
          border: "2px solid transparent",
          borderTopColor: "rgba(251,191,36,0.6)",
          borderLeftColor: "rgba(251,191,36,0.15)",
          animationDuration: "0.9s",
        }}
      />

      {/* Logo */}
      <img
        src="/logo.png"
        alt="SwiftData Ghana"
        className="loading-logo-img relative z-10 rounded-full select-none"
        width={80}
        height={80}
        draggable={false}
      />
    </div>

    {/* ── Brand name ── */}
    <div className="loading-brand-text text-center">
      <p
        className="font-black text-xl tracking-tight mb-0.5"
        style={{ color: "#ffffff", fontFamily: "Poppins, sans-serif" }}
      >
        SwiftData Ghana
      </p>
      <p
        className="text-xs font-semibold uppercase tracking-widest mb-4"
        style={{ color: "#f59e0b" }}
      >
        #1 Data Bundles
      </p>

      {/* Bouncing dots */}
      <div className="flex items-center justify-center gap-1.5">
        <span
          className="loading-dot-1 inline-block w-2 h-2 rounded-full"
          style={{ background: "#f59e0b" }}
        />
        <span
          className="loading-dot-2 inline-block w-2 h-2 rounded-full"
          style={{ background: "#f59e0b" }}
        />
        <span
          className="loading-dot-3 inline-block w-2 h-2 rounded-full"
          style={{ background: "#f59e0b" }}
        />
      </div>
    </div>
  </div>
);

export default LoadingScreen;
