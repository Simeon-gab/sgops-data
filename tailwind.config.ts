import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          0: "#08080c",
          1: "#0e0e14",
          2: "#15151e",
          3: "#1c1c28",
          4: "#242434",
        },
        border: {
          DEFAULT: "#2a2a3a",
          hover: "#3a3a4e",
        },
        text: {
          1: "#f0f0f2",
          2: "#a0a0b4",
          3: "#686880",
        },
        gold: {
          DEFAULT: "#d4a017",
          dim: "rgba(212,160,23,0.12)",
          bright: "#f0c030",
        },
        tier: {
          hot: "#ef4444",
          warm: "#d4a017",
          cold: "#64748b",
        },
        stage: {
          new: "#d4a017",
          contacted: "#e08a2e",
          responded: "#22c55e",
          meeting: "#3b82f6",
          proposal: "#8b5cf6",
          closed: "#10b981",
          lost: "#ef4444",
        },
      },
      fontFamily: {
        sans: ["Outfit", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
