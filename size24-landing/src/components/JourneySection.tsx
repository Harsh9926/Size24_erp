import React, { useEffect, useRef, useState, useCallback } from "react";

/* ─── Types ─── */
interface TimelineItem {
  year: string;
  side: "left" | "right";
  title: string;
  text: string;
  img: string;
  imgAlt: string;
  tag: string | null;
}

/* ─── Data ─── */
const TIMELINE: TimelineItem[] = [
  { year: "2002", side: "left",  title: "Where It All Began",     img: "/journey/2002.jpg", imgAlt: "MD Tailors", tag: "MD Tailors, Camp Pune",
    text: "My mother started working at MD Tailors under a respected Parsi lady in the heart of Camp, Pune. With dedication and hard work, she laid the foundation of our journey." },
  { year: "2010", side: "right", title: "Taking the Leap",        img: "/journey/2010.jpg", imgAlt: "MD Tailors & Co", tag: "MD Tailors & Co.",
    text: "After years of hard work and earning trust, my mother took a bold step and purchased the entire company, continuing the legacy as MD Tailors & Co." },
  { year: "2015", side: "left",  title: "My Real Education",      img: "/journey/2015.jpg", imgAlt: "Vintage Pune", tag: null,
    text: "I joined my mother in the business. I learned, understood, and experienced every aspect from the ground up — discipline, customer focus, quality and responsibility." },
  { year: "2020", side: "right", title: "A New Vision is Born",   img: "/journey/2020.jpg", imgAlt: "SIZE24 first store", tag: "📍 Kalyani Nagar, Pune",
    text: "With a dream to create a modern and premium uniform experience, I launched \"Size24 by Ssahebh Siingh\". Our first store opened in Kalyani Nagar, Pune." },
  { year: "2023", side: "left",  title: "Growing With Your Love", img: "/journey/2023.jpg", imgAlt: "SIZE24 Wagholi", tag: "📍 Wagholi",
    text: "Your love and support encouraged us to grow bigger. We opened our second store in Wagholi, strengthening our presence and reaching more families." },
  { year: "2024", side: "right", title: "Going Digital",          img: "/journey/2024.jpg", imgAlt: "SIZE24 website", tag: "🌐 www.size24.in",
    text: "We stepped into the digital world with the launch of our fully operational website www.size24.in — bringing convenience and quality to your fingertips." },
  { year: "2025", side: "left",  title: "Another Milestone",      img: "/journey/2025.jpg", imgAlt: "SIZE24 Amanora", tag: "📍 Amanora Apex, Pune",
    text: "Another milestone achieved! We opened our new store at Amanora Apex, continuing our journey of growth, innovation, and trust." },
];

const VALUES = [
  { icon: "💪", title: "STRENGTH",  desc: "To face every challenge with courage." },
  { icon: "🤜", title: "HARD WORK", desc: "To never stop, to never settle, to always give more." },
  { icon: "🎯", title: "FOCUS",     desc: "To stay committed to the vision." },
  { icon: "🏆", title: "SUCCESS",   desc: "To create a legacy that inspires future generations." },
];

/* ─── Hook: scroll-triggered visibility ─── */
function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

/* ─── Floating gold particle ─── */
const Particle: React.FC<{ style: React.CSSProperties }> = ({ style }) => (
  <div
    className="absolute rounded-full pointer-events-none"
    style={{
      width: 3, height: 3,
      background: "radial-gradient(circle, #C9A84C, transparent)",
      animation: "particle-float 5s ease-out infinite",
      ...style,
    }}
  />
);

/* ─── 3D tilt card wrapper ─── */
const TiltCard: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({ children, className = "" }) => {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    const x = (e.clientX - left) / width  - 0.5;
    const y = (e.clientY - top)  / height - 0.5;
    el.style.transform = `perspective(800px) rotateY(${x * 12}deg) rotateX(${-y * 10}deg) scale(1.03)`;
    el.style.boxShadow = `${-x * 20}px ${y * 20}px 40px rgba(201,168,76,0.25)`;
  }, []);
  const onLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "perspective(800px) rotateY(0deg) rotateX(0deg) scale(1)";
    el.style.boxShadow = "0 8px 40px rgba(0,0,0,0.5)";
  }, []);
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={className}
      style={{ transition: "transform 0.15s ease, box-shadow 0.15s ease", transformStyle: "preserve-3d" }}
    >
      {children}
    </div>
  );
};

/* ─── Image card with clip-path reveal ─── */
const ImageCard: React.FC<{ item: TimelineItem; visible: boolean }> = ({ item, visible }) => {
  const fromLeft = item.side === "left";
  return (
    <TiltCard className="relative w-full rounded-xl overflow-hidden cursor-pointer group">
      {/* aspect ratio wrapper */}
      <div style={{ paddingBottom: "133%" }} />

      {/* image — clip-path reveal */}
      <div
        className="absolute inset-0"
        style={{
          clipPath: visible
            ? "inset(0 0% 0 0%)"
            : fromLeft ? "inset(0 0% 0 100%)" : "inset(0 100% 0 0%)",
          transition: visible ? "clip-path 1.1s cubic-bezier(0.16,1,0.3,1)" : "none",
          transitionDelay: visible ? "0.25s" : "0s",
        }}
      >
        <img
          src={item.img}
          alt={item.imgAlt}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "brightness(0.82) saturate(0.85)" }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
            (e.currentTarget.parentElement as HTMLElement).style.background =
              "linear-gradient(135deg,#1a1509,#2a1f08)";
          }}
        />
      </div>

      {/* dark vignette */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.6) 100%)", zIndex: 2 }} />
      <div className="absolute bottom-0 left-0 right-0 h-28 pointer-events-none"
        style={{ background: "linear-gradient(to top, rgba(7,5,3,0.9), transparent)", zIndex: 2 }} />

      {/* animated border on hover */}
      <div
        className="absolute inset-0 rounded-xl pointer-events-none opacity-0 group-hover:opacity-100"
        style={{
          zIndex: 3,
          transition: "opacity 0.4s ease",
          boxShadow: "inset 0 0 0 1.5px rgba(201,168,76,0.5), 0 0 30px rgba(201,168,76,0.15)",
        }}
      />

      {/* year badge */}
      <div className="absolute top-4 right-4 px-3 py-1 rounded-full" style={{ zIndex: 4,
        background: "rgba(12,10,5,0.6)", border: "1px solid rgba(201,168,76,0.45)", backdropFilter: "blur(10px)" }}>
        <span className="text-xs font-bold tracking-widest" style={{ color: "#C9A84C" }}>{item.year}</span>
      </div>
    </TiltCard>
  );
};

/* ─── Text block ─── */
const TextBlock: React.FC<{ item: TimelineItem; visible: boolean; delay?: number }> = ({ item, visible, delay = 0 }) => (
  <div className="space-y-4">
    {/* Year — big dramatic */}
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(30px) scale(0.85)",
        transition: visible ? `opacity 0.6s ease, transform 0.6s cubic-bezier(0.16,1,0.3,1)` : "none",
        transitionDelay: visible ? `${delay}s` : "0s",
      }}
    >
      <span
        className="font-black leading-none block"
        style={{
          fontFamily: "Sora, sans-serif",
          fontSize: "clamp(4rem, 8vw, 6.5rem)",
          background: "linear-gradient(135deg, #C9A84C 0%, #f0d080 40%, #C9A84C 70%, #8a6a1a 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          letterSpacing: "-0.04em",
          lineHeight: 1,
        }}
      >
        {item.year}
      </span>
    </div>

    {/* divider line */}
    <div
      style={{
        height: 2, borderRadius: 4,
        background: "linear-gradient(90deg, #C9A84C, transparent)",
        transformOrigin: "left",
        transform: visible ? "scaleX(1)" : "scaleX(0)",
        transition: visible ? "transform 0.7s cubic-bezier(0.16,1,0.3,1)" : "none",
        transitionDelay: visible ? `${delay + 0.1}s` : "0s",
        width: "80%",
      }}
    />

    {/* Title */}
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: visible ? "opacity 0.6s ease, transform 0.6s cubic-bezier(0.16,1,0.3,1)" : "none",
        transitionDelay: visible ? `${delay + 0.15}s` : "0s",
      }}
    >
      <p className="font-bold text-lg md:text-xl" style={{ color: "#e8d8a0", fontFamily: "Sora, sans-serif" }}>
        {item.title}
      </p>
    </div>

    {/* Body text */}
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: visible ? "opacity 0.7s ease, transform 0.7s cubic-bezier(0.16,1,0.3,1)" : "none",
        transitionDelay: visible ? `${delay + 0.25}s` : "0s",
      }}
    >
      <p className="text-sm md:text-base leading-relaxed font-light" style={{ color: "#a89060" }}>
        {item.text}
      </p>
    </div>

    {/* Tag */}
    {item.tag && (
      <div
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(15px)",
          transition: visible ? "opacity 0.6s ease, transform 0.6s cubic-bezier(0.16,1,0.3,1)" : "none",
          transitionDelay: visible ? `${delay + 0.35}s` : "0s",
        }}
      >
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide"
          style={{
            color: "#C9A84C",
            background: "rgba(201,168,76,0.1)",
            border: "1px solid rgba(201,168,76,0.3)",
          }}
        >
          {item.tag}
        </span>
      </div>
    )}
  </div>
);

/* ─── Single timeline row ─── */
const TimelineRow: React.FC<{ item: TimelineItem; index: number }> = ({ item, index }) => {
  const { ref, visible } = useInView(0.15);
  const isLeft = item.side === "left";

  return (
    <div ref={ref} className="relative grid grid-cols-1 md:grid-cols-[1fr_80px_1fr] gap-6 md:gap-8 items-center mb-16 md:mb-24">

      {/* LEFT column */}
      <div className={isLeft ? "md:order-1" : "md:order-3"}>
        {isLeft ? (
          <div style={{
            opacity: visible ? 1 : 0,
            transition: visible ? "opacity 0.1s" : "none",
          }}>
            <ImageCard item={item} visible={visible} />
          </div>
        ) : (
          <div style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateX(0)" : "translateX(60px)",
            transition: visible ? "opacity 0.8s ease, transform 0.8s cubic-bezier(0.16,1,0.3,1)" : "none",
            transitionDelay: visible ? "0.1s" : "0s",
          }}>
            <TextBlock item={item} visible={visible} delay={0.1} />
          </div>
        )}
      </div>

      {/* CENTRE dot */}
      <div className="hidden md:flex flex-col items-center justify-center md:order-2">
        <div
          className="relative flex items-center justify-center"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "scale(1)" : "scale(0)",
            transition: visible ? "opacity 0.5s ease, transform 0.5s cubic-bezier(0.34,1.56,0.64,1)" : "none",
            transitionDelay: visible ? "0.4s" : "0s",
          }}
        >
          {/* outer ring */}
          <div
            className="absolute w-10 h-10 rounded-full"
            style={{
              border: "1px solid rgba(201,168,76,0.3)",
              animation: visible ? "glow-pulse 2.5s ease-in-out infinite" : "none",
            }}
          />
          {/* inner dot */}
          <div
            className="w-4 h-4 rounded-full"
            style={{
              background: "radial-gradient(circle, #f0d080, #C9A84C)",
              boxShadow: "0 0 14px 4px rgba(201,168,76,0.6)",
            }}
          />
        </div>
        {/* index number below dot */}
        <span
          className="text-[10px] font-bold mt-2 tracking-widest"
          style={{ color: "rgba(201,168,76,0.4)" }}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>

      {/* RIGHT column */}
      <div className={isLeft ? "md:order-3" : "md:order-1"}>
        {isLeft ? (
          <div style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateX(0)" : "translateX(-60px)",
            transition: visible ? "opacity 0.8s ease, transform 0.8s cubic-bezier(0.16,1,0.3,1)" : "none",
            transitionDelay: visible ? "0.1s" : "0s",
          }}>
            <TextBlock item={item} visible={visible} delay={0.1} />
          </div>
        ) : (
          <div style={{
            opacity: visible ? 1 : 0,
            transition: visible ? "opacity 0.1s" : "none",
          }}>
            <ImageCard item={item} visible={visible} />
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Animated timeline vertical line ─── */
const TimelineLine: React.FC = () => {
  const { ref, visible } = useInView(0.05);
  return (
    <div ref={ref} className="hidden md:block absolute left-1/2 -translate-x-1/2 pointer-events-none"
      style={{ top: 240, bottom: 300, width: 1 }}>
      {/* background track */}
      <div className="absolute inset-0" style={{ background: "rgba(201,168,76,0.1)" }} />
      {/* animated fill */}
      <div
        style={{
          position: "absolute", top: 0, left: 0, right: 0,
          background: "linear-gradient(to bottom, #C9A84C, rgba(201,168,76,0.2))",
          transformOrigin: "top",
          transform: visible ? "scaleY(1)" : "scaleY(0)",
          transition: visible ? "transform 3s cubic-bezier(0.16,1,0.3,1)" : "none",
          transitionDelay: "0.3s",
          bottom: 0,
        }}
      />
    </div>
  );
};

/* ─── Value card ─── */
const ValueCard: React.FC<{ v: typeof VALUES[number]; i: number; visible: boolean }> = ({ v, i, visible }) => (
  <div
    className="group relative text-center p-5 rounded-2xl cursor-default overflow-hidden"
    style={{
      background: "rgba(201,168,76,0.04)",
      border: "1px solid rgba(201,168,76,0.15)",
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0) scale(1)" : "translateY(30px) scale(0.95)",
      transition: visible ? "opacity 0.6s ease, transform 0.6s cubic-bezier(0.16,1,0.3,1)" : "none",
      transitionDelay: visible ? `${i * 0.1}s` : "0s",
    }}
  >
    {/* hover glow bg */}
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
      style={{ background: "radial-gradient(ellipse at center, rgba(201,168,76,0.12), transparent 70%)" }} />

    <div className="relative z-10 space-y-2">
      <span className="text-3xl block">{v.icon}</span>
      <p className="text-[#C9A84C] text-xs font-black uppercase tracking-[0.2em]">{v.title}</p>
      <p className="text-[#a89060] text-xs leading-relaxed font-light">{v.desc}</p>
    </div>

    {/* bottom accent line */}
    <div
      className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
      style={{ background: "linear-gradient(90deg, transparent, #C9A84C, transparent)" }}
    />
  </div>
);

/* ─── Main Section ─── */
const JourneySection: React.FC = () => {
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerVisible, setHeaderVisible] = useState(false);
  const valuesRef = useRef<HTMLDivElement>(null);
  const [valuesVisible, setValuesVisible] = useState(false);

  useEffect(() => {
    const observe = (el: HTMLElement | null, setter: (v: boolean) => void, threshold = 0.2) => {
      if (!el) return;
      const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setter(true); obs.disconnect(); } }, { threshold });
      obs.observe(el);
      return () => obs.disconnect();
    };
    observe(headerRef.current, setHeaderVisible, 0.3);
    observe(valuesRef.current, setValuesVisible, 0.2);
  }, []);

  /* random particles */
  const particles = Array.from({ length: 18 }, (_, i) => ({
    key: i,
    style: {
      left: `${5 + Math.random() * 90}%`,
      top:  `${5 + Math.random() * 90}%`,
      animationDelay: `${Math.random() * 6}s`,
      animationDuration: `${4 + Math.random() * 4}s`,
      opacity: 0.4 + Math.random() * 0.4,
    },
  }));

  return (
    <section
      id="journey"
      className="relative overflow-hidden py-24 md:py-32"
      style={{ background: "#070503", fontFamily: "Sora, sans-serif" }}
    >
      {/* ── Floating particles ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map((p) => <Particle key={p.key} style={p.style} />)}
      </div>

      {/* ── Ambient radial glow ── */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(201,168,76,0.06) 0%, transparent 70%)" }} />

      {/* ── Noise texture ── */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='3' height='3'%3E%3Crect width='1' height='1' fill='%23C9A84C'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
        }}
      />

      <div className="relative max-w-6xl mx-auto px-4 md:px-8">

        {/* ── HEADER ── */}
        <div ref={headerRef} className="text-center mb-20 md:mb-28 space-y-5">

          {/* eyebrow */}
          <div style={{
            opacity: headerVisible ? 1 : 0,
            transform: headerVisible ? "translateY(0)" : "translateY(20px)",
            transition: headerVisible ? "opacity 0.6s ease, transform 0.6s cubic-bezier(0.16,1,0.3,1)" : "none",
          }}>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-[0.25em]"
              style={{ color: "#C9A84C", background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] animate-pulse" />
              The Story Behind the Brand
            </span>
          </div>

          {/* main heading with gradient shimmer */}
          <div style={{
            opacity: headerVisible ? 1 : 0,
            transform: headerVisible ? "translateY(0) scale(1)" : "translateY(30px) scale(0.95)",
            transition: headerVisible ? "opacity 0.7s ease, transform 0.7s cubic-bezier(0.16,1,0.3,1)" : "none",
            transitionDelay: "0.1s",
          }}>
            <h2
              className="font-black uppercase leading-none"
              style={{
                fontSize: "clamp(3rem, 9vw, 7rem)",
                background: "linear-gradient(135deg, #8a6a1a 0%, #C9A84C 30%, #f0d080 50%, #C9A84C 70%, #8a6a1a 100%)",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                animation: headerVisible ? "shimmer 5s linear infinite" : "none",
                letterSpacing: "-0.03em",
              }}
            >
              My Journey
            </h2>
          </div>

          {/* by line */}
          <div style={{
            opacity: headerVisible ? 1 : 0,
            transform: headerVisible ? "translateY(0)" : "translateY(20px)",
            transition: headerVisible ? "opacity 0.6s ease, transform 0.6s cubic-bezier(0.16,1,0.3,1)" : "none",
            transitionDelay: "0.2s",
          }}>
            <p className="text-[#e8d8a0] font-light"
              style={{ fontFamily: "Georgia, serif", fontSize: "clamp(1rem, 2.5vw, 1.5rem)", fontStyle: "italic" }}>
              By Ssahebh Siingh
            </p>
          </div>

          {/* divider */}
          <div style={{
            display: "flex", justifyContent: "center", alignItems: "center", gap: 12,
            opacity: headerVisible ? 1 : 0,
            transition: headerVisible ? "opacity 0.6s ease" : "none",
            transitionDelay: "0.3s",
          }}>
            <div style={{ width: 60, height: 1, background: "linear-gradient(to right, transparent, #C9A84C)" }} />
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#C9A84C", boxShadow: "0 0 8px #C9A84C" }} />
            <div style={{ width: 60, height: 1, background: "linear-gradient(to left, transparent, #C9A84C)" }} />
          </div>

          {/* quote */}
          <div style={{
            opacity: headerVisible ? 1 : 0,
            transform: headerVisible ? "translateY(0)" : "translateY(15px)",
            transition: headerVisible ? "opacity 0.6s ease, transform 0.6s cubic-bezier(0.16,1,0.3,1)" : "none",
            transitionDelay: "0.4s",
          }}>
            <p className="text-[#a89060] uppercase tracking-[0.18em] text-xs md:text-sm font-light max-w-lg mx-auto leading-relaxed">
              "A journey built on hard work, strength, and a vision to create a legacy."
            </p>
          </div>
        </div>

        {/* ── TIMELINE ── */}
        <div className="relative">
          <TimelineLine />
          {TIMELINE.map((item, i) => (
            <TimelineRow key={item.year} item={item} index={i} />
          ))}
        </div>

        {/* ── CLOSING QUOTE ── */}
        {(() => {
          const { ref, visible } = useInView(0.3);
          return (
            <div ref={ref} className="text-center my-16 md:my-20">
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, marginBottom: 24,
                opacity: visible ? 1 : 0, transition: visible ? "opacity 0.6s ease" : "none" }}>
                <div style={{ width: 80, height: 1, background: "linear-gradient(to right, transparent, rgba(201,168,76,0.5))" }} />
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(201,168,76,0.5)" }} />
                <div style={{ width: 80, height: 1, background: "linear-gradient(to left, transparent, rgba(201,168,76,0.5))" }} />
              </div>
              <p className="font-light leading-relaxed" style={{
                fontFamily: "Georgia, serif", fontStyle: "italic",
                fontSize: "clamp(1rem, 2vw, 1.3rem)", color: "#e8d8a0",
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(20px)",
                transition: visible ? "opacity 0.7s ease, transform 0.7s cubic-bezier(0.16,1,0.3,1)" : "none",
                transitionDelay: "0.15s",
              }}>
                "From a small tailoring setup in Camp to a growing brand across Pune —<br className="hidden md:block" />
                This is just the beginning."
              </p>
            </div>
          );
        })()}

        {/* ── VALUES ── */}
        <div ref={valuesRef} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-14">
          {VALUES.map((v, i) => (
            <ValueCard key={v.title} v={v} i={i} visible={valuesVisible} />
          ))}
        </div>

        {/* ── FOOTER STRIP ── */}
        {(() => {
          const { ref, visible } = useInView(0.4);
          return (
            <div ref={ref} className="border-t pt-10"
              style={{ borderColor: "rgba(201,168,76,0.15)",
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(20px)",
                transition: visible ? "opacity 0.7s ease, transform 0.7s cubic-bezier(0.16,1,0.3,1)" : "none",
              }}>
              <p className="text-center text-xs md:text-sm uppercase tracking-[0.22em] font-light leading-relaxed" style={{ color: "#C9A84C" }}>
                This is not just my story,<br />
                this is a journey of resilience, vision, and success.
              </p>
            </div>
          );
        })()}

      </div>
    </section>
  );
};

export default JourneySection;
