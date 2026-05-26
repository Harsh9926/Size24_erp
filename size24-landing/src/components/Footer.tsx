import React from "react";

const ERP_URL   = "https://shopsize24.in";
const LOGIN_URL = "https://shopsize24.in/login";

const Footer: React.FC = () => (
  <footer style={{ background: "#040302", fontFamily: "Sora, sans-serif" }}>

    {/* ── Top divider with glow ── */}
    <div style={{ height: 1, background: "linear-gradient(90deg, transparent 0%, rgba(201,168,76,0.4) 30%, rgba(255,107,0,0.4) 50%, rgba(201,168,76,0.4) 70%, transparent 100%)" }} />

    {/* ── CTA Banner ── */}
    <div
      className="relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, rgba(201,168,76,0.07) 0%, rgba(255,107,0,0.05) 50%, rgba(201,168,76,0.07) 100%)" }}
    >
      <div className="max-w-5xl mx-auto px-6 md:px-12 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="text-center md:text-left space-y-1.5">
          <p className="font-bold text-xl md:text-2xl" style={{ color: "#e8d8a0", letterSpacing: "-0.02em" }}>
            Ready to manage your stores?
          </p>
          <p className="text-sm font-light" style={{ color: "rgba(168,144,96,0.7)" }}>
            Join SIZE24 ERP — real-time insights for your entire retail network.
          </p>
        </div>
        <a
          href={LOGIN_URL}
          className="flex-shrink-0 inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-sm uppercase tracking-widest transition-all duration-200 active:scale-95"
          style={{ background: "linear-gradient(135deg,#FF6B00,#c2410c)", color: "#fff", boxShadow: "0 6px 24px rgba(255,107,0,0.35)" }}
          onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.filter = "brightness(1.12)"}
          onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.filter = "brightness(1)"}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
            <polyline points="10 17 15 12 10 7"/>
            <line x1="15" y1="12" x2="3" y2="12"/>
          </svg>
          Login to ERP
        </a>
      </div>
    </div>

    {/* ── Divider ── */}
    <div style={{ height: 1, background: "rgba(201,168,76,0.08)" }} />

    {/* ── Main links area ── */}
    <div className="max-w-5xl mx-auto px-6 md:px-12 py-12">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8">

        {/* Brand */}
        <div className="col-span-2 md:col-span-1 space-y-4">
          <img
            src="/logo-gold.avif"
            alt="SIZE24"
            style={{ height: 64, width: "auto", display: "block" }}
          />
          <p className="text-xs leading-relaxed font-light" style={{ color: "rgba(168,144,96,0.65)" }}>
            Smart Retail ERP for modern clothing brands across India.
          </p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
            <span className="text-[10px] font-medium" style={{ color: "rgba(201,168,76,0.5)" }}>
              shopsize24.in
            </span>
          </div>
        </div>

        {/* Platform */}
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#C9A84C" }}>Platform</p>
          {[
            { label: "Login to ERP", href: LOGIN_URL },
            { label: "My Journey",   href: "#journey" },
            { label: "Features",     href: "#features" },
            { label: "SIZE24 Store", href: "https://www.size24.in" },
          ].map(l => (
            <a key={l.label} href={l.href}
              className="block text-xs font-light transition-colors duration-200"
              style={{ color: "rgba(168,144,96,0.6)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#C9A84C")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(168,144,96,0.6)")}
            >{l.label}</a>
          ))}
        </div>

        {/* Company */}
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#C9A84C" }}>Company</p>
          {[
            { label: "About Ssahebh", href: "#journey" },
            { label: "Our Stores",    href: "#shops" },
            { label: "Team",          href: "#team" },
            { label: "Contact",       href: "#contact" },
          ].map(l => (
            <a key={l.label} href={l.href}
              className="block text-xs font-light transition-colors duration-200"
              style={{ color: "rgba(168,144,96,0.6)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#C9A84C")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(168,144,96,0.6)")}
            >{l.label}</a>
          ))}
        </div>

        {/* Legal */}
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#C9A84C" }}>Legal</p>
          {[
            { label: "Terms & Conditions", href: `${ERP_URL}/terms` },
            { label: "Privacy Policy",     href: `${ERP_URL}/privacy` },
          ].map(l => (
            <a key={l.label} href={l.href} target="_blank" rel="noreferrer"
              className="block text-xs font-light transition-colors duration-200"
              style={{ color: "rgba(168,144,96,0.6)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#C9A84C")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(168,144,96,0.6)")}
            >{l.label}</a>
          ))}

          {/* Jurisdiction badge */}
          <div className="mt-4 px-3 py-2 rounded-lg inline-block"
            style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.12)" }}>
            <p className="text-[10px] font-light" style={{ color: "rgba(201,168,76,0.5)" }}>
              🇮🇳 Pune, Maharashtra, India
            </p>
          </div>
        </div>
      </div>
    </div>

    {/* ── Bottom bar ── */}
    <div style={{ borderTop: "1px solid rgba(201,168,76,0.07)" }}>
      <div className="max-w-5xl mx-auto px-6 md:px-12 py-5 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="text-[10px] text-center sm:text-left" style={{ color: "rgba(168,144,96,0.38)" }}>
          © {new Date().getFullYear()} ShopSize24. All Rights Reserved. Unauthorized copying or resale is prohibited under Indian IT &amp; Copyright laws.
        </p>
        <p className="text-[10px] flex-shrink-0" style={{ color: "rgba(168,144,96,0.38)" }}>
          Built by <span style={{ color: "rgba(201,168,76,0.55)" }}>Harsh Chandel</span>
        </p>
      </div>
    </div>

  </footer>
);

export default Footer;
