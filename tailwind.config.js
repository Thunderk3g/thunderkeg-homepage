const { tokens } = require("./src/lib/theme/tokens.cjs");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: tokens.color.bg,
        surface: tokens.color.surface,
        elevated: tokens.color.elevated,
        border: tokens.color.border,
        fg: tokens.color.text,
        muted: tokens.color.muted,
        accent: tokens.color.accent,
        accent2: tokens.color.accent2,
        success: tokens.color.success,
        warning: tokens.color.warning,
        danger: tokens.color.danger,
      },
      borderRadius: tokens.radius,
      boxShadow: { window: tokens.shadow.window },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "Menlo", "monospace"],
      },
      animation: {
        blink: "blink 1s step-end infinite",
        pulse2: "pulse2 1.2s ease-in-out infinite alternate",
      },
      keyframes: {
        blink: { "0%,100%": { opacity: 1 }, "50%": { opacity: 0 } },
        pulse2: { "0%": { opacity: 0.4 }, "100%": { opacity: 1 } },
      },
    },
  },
  plugins: [],
};
