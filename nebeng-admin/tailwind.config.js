/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "sans-serif"],
      },
      colors: {
        brand: {
          bg: "#090d16",
          surface: "#111726",
          surfaceSubtle: "#161f33",
          border: "#222f49",
          borderLight: "#314366",
          primary: "#3b82f6",
          primaryHover: "#2563eb",
          accent: "#facc15",
          glow: "#38bdf8",
        },
        darkBg: "#f5f7fb",
        cardBg: "#ffffff",
        cardBorder: "#eef1f7",
        accentBlue: "#3b6dfa",
        accentBlueHover: "#2f5ce0",
      },
      boxShadow: {
        neo: "3px 3px 0px rgba(0, 0, 0, 0.45)",
        "neo-btn": "0 4px 12px -2px rgba(79, 131, 255, 0.4)",
        brutal: "3px 3px 0px 0px rgba(15, 23, 42, 0.9)",
        "brutal-blue": "3px 3px 0px 0px #1d4ed8",
        "glow-subtle": "0 0 20px -5px rgba(59, 130, 246, 0.25)",
      },
    },
  },
  plugins: [],
};
