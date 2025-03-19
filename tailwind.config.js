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
        terminal: {
          black: "#121212",
          border: "#2a2a2a",
          header: "#1a1a1a",
          text: "#d4d4d4",
          inactive: "#6e6e6e",
          placeholder: "#4a4a4a",
          active: "#2d2d2d",
          hover: "#1f1f1f",
          red: "#e06c75",
          green: "#98c379",
          yellow: "#e5c07b",
          blue: "#61afef",
          magenta: "#c678dd",
          cyan: "#56b6c2",
          prompt: "#61afef",
          cursor: "#d4d4d4",
          user: "#98c379",
          assistant: "#d4d4d4",
        },
      },
      animation: {
        blink: "blink 1s step-end infinite",
        typing: "typing 3.5s steps(40, end)",
      },
      keyframes: {
        blink: {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0 },
        },
        typing: {
          from: { width: "0" },
          to: { width: "100%" },
        },
      },
      fontFamily: {
        mono: [
          "JetBrains Mono",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
}; 