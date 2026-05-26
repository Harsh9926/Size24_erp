import React, { useEffect, useState } from "react";

const NAV_LINKS = ["Features", "Journey", "Shops", "Team", "Contact"];
const ERP_URL = "https://shopsize24.in/login";

const Navbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-16 py-4 transition-all duration-500"
      style={{
        background: scrolled
          ? "rgba(7,5,3,0.85)"
          : "transparent",
        backdropFilter: scrolled ? "blur(18px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(201,168,76,0.1)" : "1px solid transparent",
      }}
    >
      {/* ── Logo ── */}
      <a href="/" className="select-none flex-shrink-0">
        <img
          src="/logo-gold.avif"
          alt="SIZE24"
          style={{ height: 68, width: "auto", display: "block" }}
        />
      </a>

      {/* ── Center links ── */}
      <div className="hidden md:flex items-center gap-7">
        {NAV_LINKS.map((link) => (
          <a
            key={link}
            href={`#${link.toLowerCase()}`}
            className="text-[11px] uppercase tracking-[0.18em] font-medium transition-all duration-200"
            style={{ color: "rgba(201,168,76,0.65)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#C9A84C")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(201,168,76,0.65)")}
          >
            {link}
          </a>
        ))}
      </div>

      {/* ── Right actions ── */}
      <div className="flex items-center gap-3">
        {/* Login button */}
        <a
          href={ERP_URL}
          className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest px-4 py-2 rounded-lg transition-all duration-200"
          style={{
            color: "#C9A84C",
            border: "1px solid rgba(201,168,76,0.3)",
            background: "rgba(201,168,76,0.06)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "rgba(201,168,76,0.14)";
            (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(201,168,76,0.6)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "rgba(201,168,76,0.06)";
            (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(201,168,76,0.3)";
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
          </svg>
          Login
        </a>

        {/* Get Started */}
        <a
          href={ERP_URL}
          className="inline-flex items-center text-[11px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-lg transition-all duration-200 active:scale-95"
          style={{
            background: "linear-gradient(135deg,#FF6B00,#c2410c)",
            color: "#fff",
            boxShadow: "0 4px 16px rgba(255,107,0,0.3)",
          }}
          onMouseEnter={(e) => (e.currentTarget as HTMLAnchorElement).style.filter = "brightness(1.15)"}
          onMouseLeave={(e) => (e.currentTarget as HTMLAnchorElement).style.filter = "brightness(1)"}
        >
          Get Started
        </a>

        {/* Mobile login icon */}
        <a
          href={ERP_URL}
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg"
          style={{ border: "1px solid rgba(201,168,76,0.3)", color: "#C9A84C" }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
          </svg>
        </a>
      </div>
    </nav>
  );
};

export default Navbar;
