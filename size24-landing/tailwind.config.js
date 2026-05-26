/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sora: ["Sora", "sans-serif"],
      },
      colors: {
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: { DEFAULT: "hsl(var(--destructive))" },
        border:       "hsl(var(--border))",
        input:        "hsl(var(--input))",
        ring:         "hsl(var(--ring))",
        "nav-button": "hsl(var(--nav-button))",
        "hero-bg":    "hsl(var(--hero-bg))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(20px)", filter: "blur(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)",    filter: "blur(0)" },
        },
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "clip-left": {
          "0%":   { clipPath: "inset(0 100% 0 0)" },
          "100%": { clipPath: "inset(0 0% 0 0)" },
        },
        "clip-right": {
          "0%":   { clipPath: "inset(0 0 0 100%)" },
          "100%": { clipPath: "inset(0 0 0 0%)" },
        },
        "line-grow": {
          "0%":   { transform: "scaleY(0)", transformOrigin: "top" },
          "100%": { transform: "scaleY(1)", transformOrigin: "top" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 6px 2px rgba(201,168,76,0.4)" },
          "50%":      { boxShadow: "0 0 18px 6px rgba(201,168,76,0.9)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-8px)" },
        },
        "shimmer": {
          "0%":   { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        "count-up": {
          "0%":   { opacity: "0", transform: "translateY(30px) scale(0.8)" },
          "100%": { opacity: "1", transform: "translateY(0)    scale(1)" },
        },
        "slide-left": {
          "0%":   { opacity: "0", transform: "translateX(-60px)", filter: "blur(6px)" },
          "100%": { opacity: "1", transform: "translateX(0)",     filter: "blur(0)" },
        },
        "slide-right": {
          "0%":   { opacity: "0", transform: "translateX(60px)",  filter: "blur(6px)" },
          "100%": { opacity: "1", transform: "translateX(0)",     filter: "blur(0)" },
        },
        "particle-float": {
          "0%":   { transform: "translateY(0) translateX(0) scale(1)", opacity: "0" },
          "10%":  { opacity: "1" },
          "90%":  { opacity: "0.6" },
          "100%": { transform: "translateY(-120px) translateX(30px) scale(0.3)", opacity: "0" },
        },
      },
      animation: {
        "fade-up":       "fade-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "fade-in":       "fade-in 0.5s ease-out forwards",
        "clip-left":     "clip-left 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "clip-right":    "clip-right 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "line-grow":     "line-grow 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "glow-pulse":    "glow-pulse 2s ease-in-out infinite",
        "float":         "float 4s ease-in-out infinite",
        "shimmer":       "shimmer 3s linear infinite",
        "count-up":      "count-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-left":    "slide-left 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-right":   "slide-right 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "particle-float":"particle-float 4s ease-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
