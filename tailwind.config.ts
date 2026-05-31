import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--bg) / <alpha-value>)",
        foreground: "hsl(var(--text) / <alpha-value>)",
        surface: "hsl(var(--surface) / <alpha-value>)",
        card: "hsl(var(--surface) / <alpha-value>)",
        "card-foreground": "hsl(var(--text) / <alpha-value>)",
        popover: "hsl(var(--surface) / <alpha-value>)",
        "popover-foreground": "hsl(var(--text) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        text: "hsl(var(--text) / <alpha-value>)",
        "text-muted": "hsl(var(--text-muted) / <alpha-value>)",
        accent: "hsl(var(--accent) / <alpha-value>)",
        "accent-fg": "hsl(var(--accent-fg) / <alpha-value>)",
        primary: "hsl(var(--accent) / <alpha-value>)",
        "primary-foreground": "hsl(var(--accent-fg) / <alpha-value>)",
        secondary: "hsl(var(--border) / <alpha-value>)",
        "secondary-foreground": "hsl(var(--text) / <alpha-value>)",
        muted: "hsl(var(--border) / <alpha-value>)",
        "muted-foreground": "hsl(var(--text-muted) / <alpha-value>)",
        "accent-hover": "hsl(var(--accent-hover) / <alpha-value>)",
        ring: "hsl(var(--accent) / <alpha-value>)",
        input: "hsl(var(--border) / <alpha-value>)",
        success: "hsl(var(--success) / <alpha-value>)",
        "success-fg": "hsl(var(--success-fg) / <alpha-value>)",
        "success-bg": "hsl(var(--success-bg) / <alpha-value>)",
        warning: "hsl(var(--warning) / <alpha-value>)",
        "warning-fg": "hsl(var(--warning-fg) / <alpha-value>)",
        "warning-bg": "hsl(var(--warning-bg) / <alpha-value>)",
        danger: "hsl(var(--danger) / <alpha-value>)",
        "danger-fg": "hsl(var(--danger-fg) / <alpha-value>)",
        destructive: "hsl(var(--danger) / <alpha-value>)",
        "destructive-foreground": "hsl(var(--danger-fg) / <alpha-value>)",
        "danger-bg": "hsl(var(--danger-bg) / <alpha-value>)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "Segoe UI",
          "sans-serif",
        ],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;
