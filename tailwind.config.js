const plugin = require("tailwindcss/plugin");

/** Lets `bg-primary/90` work with hex CSS variables in Tailwind 3. */
function mix(token) {
  return `color-mix(in srgb, var(${token}) calc(<alpha-value> * 100%), transparent)`;
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: mix("--border"),
        input: mix("--input"),
        ring: mix("--ring"),
        background: mix("--background"),
        foreground: mix("--foreground"),
        brand: mix("--brand"),
        info: mix("--info"),
        success: mix("--success"),
        warning: mix("--warning"),
        danger: mix("--danger"),
        subtle: mix("--subtle"),
        primary: {
          DEFAULT: mix("--primary"),
          foreground: mix("--primary-foreground"),
        },
        secondary: {
          DEFAULT: mix("--secondary"),
          foreground: mix("--secondary-foreground"),
        },
        destructive: {
          DEFAULT: mix("--destructive"),
          foreground: mix("--destructive-foreground"),
        },
        muted: {
          DEFAULT: mix("--muted"),
          foreground: mix("--muted-foreground"),
        },
        accent: {
          DEFAULT: mix("--accent"),
          foreground: mix("--accent-foreground"),
        },
        popover: {
          DEFAULT: mix("--popover"),
          foreground: mix("--popover-foreground"),
        },
        card: {
          DEFAULT: mix("--card"),
          foreground: mix("--card-foreground"),
          border: mix("--card-border"),
        },
        sidebar: {
          DEFAULT: mix("--sidebar"),
          foreground: mix("--sidebar-foreground"),
          primary: mix("--sidebar-primary"),
          "primary-foreground": mix("--sidebar-primary-foreground"),
          accent: mix("--sidebar-accent"),
          "accent-foreground": mix("--sidebar-accent-foreground"),
          border: mix("--sidebar-border"),
          ring: mix("--sidebar-ring"),
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      fontFamily: {
        sans: ["var(--font-geist)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "var(--shadow-card)",
        lift: "var(--shadow-lift)",
        pop: "var(--shadow-pop)",
      },
      transitionTimingFunction: {
        "power2-out": "var(--ease-power2-out)",
        "power3-out": "var(--ease-power3-out)",
        "power4-out": "var(--ease-power4-out)",
        "smooth-in-out": "var(--ease-smooth-in-out)",
        drawer: "var(--ease-drawer)",
      },
      width: {
        sidebar: "var(--sidebar-width)",
      },
      keyframes: {
        "toast-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "toast-in": "toast-in 200ms var(--ease-power3-out)",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    plugin(function ({ addVariant }) {
      addVariant("hoverable", "@media (hover: hover) and (pointer: fine)");
    }),
  ],
};
