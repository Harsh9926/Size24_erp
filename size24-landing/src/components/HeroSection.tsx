import React, { Suspense } from "react";

const Spline = React.lazy(() => import("@splinetool/react-spline"));

const SPLINE_SCENE = "https://prod.spline.design/Slk6b8kz3LRlKiyk/scene.splinecode";

const HeroSection: React.FC = () => (
  <section className="relative min-h-screen flex items-end bg-hero-bg overflow-hidden">

    {/* ── Spline 3D Background ── */}
    <div className="absolute inset-0">
      <Suspense fallback={<div className="absolute inset-0 bg-hero-bg" />}>
        <Spline scene={SPLINE_SCENE} className="w-full h-full" />
      </Suspense>
    </div>

    {/* ── Dark overlay so text stays readable ── */}
    <div className="absolute inset-0 bg-black/35 z-[1] pointer-events-none" />

    {/* ── Hero Content ── */}
    <div
      className="relative z-10 pointer-events-none w-full max-w-[90%] sm:max-w-md lg:max-w-2xl px-6 md:px-10 pb-10 md:pb-14 pt-32"
    >

      {/* Eyebrow badge */}
      <div
        className="opacity-0 animate-fade-up mb-4 inline-flex items-center gap-2"
        style={{ animationDelay: "0.05s" }}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        <span className="text-[11px] uppercase tracking-[0.2em] text-primary font-medium">
          Smart Retail ERP
        </span>
      </div>

      {/* Main heading */}
      <h1
        className="opacity-0 animate-fade-up text-foreground font-bold leading-[1.05] tracking-[-0.05em] uppercase mb-2 md:mb-4"
        style={{
          fontSize: "clamp(3rem, 8vw, 6rem)",
          animationDelay: "0.2s",
        }}
      >
        SIZE24{" "}
        <span className="text-primary">ERP</span>
      </h1>

      {/* Subheading */}
      <p
        className="opacity-0 animate-fade-up text-foreground/80 font-light mb-3 md:mb-6"
        style={{
          fontSize: "clamp(1.125rem, 2.5vw, 1.875rem)",
          animationDelay: "0.4s",
        }}
      >
        Run your retail business smarter.
      </p>

      {/* Description */}
      <p
        className="opacity-0 animate-fade-up text-muted-foreground font-light mb-4 md:mb-8"
        style={{
          fontSize: "clamp(0.875rem, 1.5vw, 1.25rem)",
          animationDelay: "0.55s",
        }}
      >
        Complete retail management built for speed. AI-powered sales insights
        with real-time data. Smart inventory and cash tracking across your entire
        shop network. All done right, not just fast.
      </p>

      {/* CTA Buttons */}
      <div
        className="opacity-0 animate-fade-up flex flex-wrap gap-3 font-bold"
        style={{ animationDelay: "0.7s" }}
      >
        <button
          className="pointer-events-auto bg-primary text-primary-foreground px-6 py-3 md:px-8 md:py-4 text-sm rounded-sm cursor-pointer hover:brightness-110 transition-all active:scale-[0.97] uppercase tracking-wider font-semibold"
        >
          Get Started
        </button>
        <button
          className="pointer-events-auto bg-white text-background px-6 py-3 md:px-8 md:py-4 text-sm rounded-sm cursor-pointer hover:brightness-90 transition-all active:scale-[0.97] uppercase tracking-wider font-semibold"
        >
          View Demo
        </button>
      </div>

      {/* Trust line */}
      <p
        className="opacity-0 animate-fade-up text-muted-foreground/60 text-xs font-light mt-4 md:mt-6"
        style={{ animationDelay: "0.85s" }}
      >
        Trusted by retailers across India &nbsp;·&nbsp; 50+ shops managed &nbsp;·&nbsp; Real-time insights
      </p>
    </div>
  </section>
);

export default HeroSection;
