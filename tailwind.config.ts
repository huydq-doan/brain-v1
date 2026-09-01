import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#141414",
        mist: "#f5f7f4",
        leaf: "#2f6f4e",
        moss: "#dfe8d9",
        clay: "#b65c3a",
        line: "#d8ded4"
      },
      boxShadow: {
        soft: "0 14px 36px rgba(20, 20, 20, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
