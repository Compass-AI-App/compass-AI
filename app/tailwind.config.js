/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        compass: {
          bg: "#0a0a0a",
          sidebar: "#111111",
          card: "#1a1a1a",
          border: "#262626",
          text: "#e5e5e5",
          muted: "#737373",
          accent: "#6366f1",
          "accent-hover": "#818cf8",
          code: "#3b82f6",
          docs: "#a855f7",
          data: "#22c55e",
          judgment: "#f97316",
        },
      },
    },
  },
  plugins: [],
};
