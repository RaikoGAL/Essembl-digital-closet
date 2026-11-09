import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f0f12",
        paper: "#f6f4ef",
        accent: { DEFAULT: "#c8ff4d", dark: "#9fd41f" },
        card: "#17171c",
        muted: "#8a8a94",
        line: "#26262d",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "-apple-system", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
      },
      borderRadius: { xl2: "1.25rem" },
    },
  },
  plugins: [],
} satisfies Config;
