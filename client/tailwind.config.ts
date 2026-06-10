import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#171717",
        muted: "#6f7178",
        line: "#e8e8ec",
        paper: "#f7f7f5",
        brand: "#2f6df6",
        mint: "#18a06f",
        coral: "#ef6655",
        amber: "#d99b20"
      },
      boxShadow: {
        soft: "0 18px 60px rgba(20, 20, 20, 0.08)"
      }
    }
  },
  plugins: []
} satisfies Config;
