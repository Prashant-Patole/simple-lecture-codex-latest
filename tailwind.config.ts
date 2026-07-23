import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          glow: "hsl(var(--primary-glow))",
          dark: "hsl(var(--primary-dark))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          from: { transform: "translateX(-10px)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        "scroll-up": {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(-50%)" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 20px 5px hsl(var(--primary) / 0.3)" },
          "50%": { boxShadow: "0 0 40px 15px hsl(var(--primary) / 0.5)" },
        },
        "float-gentle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        // New animations for thinking/confirmation flow
        "float-particle": {
          "0%, 100%": { transform: "translateY(0) scale(1)", opacity: "0.6" },
          "50%": { transform: "translateY(-20px) scale(1.2)", opacity: "1" },
        },
        "pulse-line": {
          "0%, 100%": { opacity: "0.2", strokeDashoffset: "0" },
          "50%": { opacity: "0.6", strokeDashoffset: "10" },
        },
        "orbit-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "orbit-medium": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(-360deg)" },
        },
        "orbit-fast": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "brain-pulse": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.05)" },
        },
        "think": {
          "0%, 100%": { transform: "rotate(-5deg)" },
          "50%": { transform: "rotate(5deg)" },
        },
        "bubble-1": {
          "0%, 100%": { transform: "scale(1) translateY(0)", opacity: "0.8" },
          "50%": { transform: "scale(1.3) translateY(-5px)", opacity: "1" },
        },
        "bubble-2": {
          "0%, 100%": { transform: "scale(1) translateY(0)", opacity: "0.6" },
          "50%": { transform: "scale(1.2) translateY(-3px)", opacity: "0.8" },
        },
        "bubble-3": {
          "0%, 100%": { transform: "scale(1) translateY(0)", opacity: "0.4" },
          "50%": { transform: "scale(1.1) translateY(-2px)", opacity: "0.6" },
        },
        "sparkle": {
          "0%, 100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
          "50%": { transform: "scale(1.3) rotate(180deg)", opacity: "0.8" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.9)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "slide-up": {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "float-bg": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-30px) rotate(10deg)" },
        },
        // Slide transitions for animation flow
        "slide-out-left": {
          "0%": { transform: "translateX(0)", opacity: "1" },
          "100%": { transform: "translateX(-100%)", opacity: "0" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "shine": {
          "0%": { left: "-2rem", opacity: "0" },
          "10%": { opacity: "1" },
          "90%": { opacity: "1" },
          "100%": { left: "calc(100% + 2rem)", opacity: "0" },
        },
        "test-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 hsl(38 92% 50% / 0)", borderColor: "hsl(38 92% 50% / 0.6)" },
          "50%": { boxShadow: "0 0 18px 4px hsl(38 92% 50% / 0.55)", borderColor: "hsl(38 92% 55% / 0.95)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease-out",
        "slide-in": "slide-in 0.5s ease-out",
        "scroll-up": "scroll-up 25s linear infinite",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "float-gentle": "float-gentle 3s ease-in-out infinite",
        // New animations
        "float-particle": "float-particle 3s ease-in-out infinite",
        "pulse-line": "pulse-line 2s ease-in-out infinite",
        "orbit-slow": "orbit-slow 8s linear infinite",
        "orbit-medium": "orbit-medium 6s linear infinite",
        "orbit-fast": "orbit-fast 4s linear infinite",
        "brain-pulse": "brain-pulse 2s ease-in-out infinite",
        "think": "think 1s ease-in-out infinite",
        "bubble-1": "bubble-1 1.5s ease-in-out infinite",
        "bubble-2": "bubble-2 1.5s ease-in-out infinite 0.2s",
        "bubble-3": "bubble-3 1.5s ease-in-out infinite 0.4s",
        "sparkle": "sparkle 2s ease-in-out infinite",
        "scale-in": "scale-in 0.3s ease-out",
        "slide-up": "slide-up 0.4s ease-out",
        "float-bg": "float-bg 5s ease-in-out infinite",
        "test-glow": "test-glow 1.8s ease-in-out infinite",
        // Slide transitions
        "slide-out-left": "slide-out-left 0.4s ease-in-out forwards",
        "slide-in-right": "slide-in-right 0.4s ease-in-out forwards",
        "shine": "shine 2s ease-in-out infinite",
      },
      backgroundImage: {
        "gradient-primary": "var(--gradient-primary)",
        "gradient-hero": "var(--gradient-hero)",
        "gradient-card": "var(--gradient-card)",
      },
      boxShadow: {
        "soft": "var(--shadow-soft)",
        "hover": "var(--shadow-hover)",
      },
      transitionTimingFunction: {
        "smooth": "var(--transition-smooth)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
