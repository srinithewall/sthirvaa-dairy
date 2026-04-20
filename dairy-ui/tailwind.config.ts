import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: "#2D6A4F",
        "brand-light": "#52B788",
        "brand-dark": "#1B4332",
        accent: "#F7B731",
        "accent-dark": "#d4920a",
        surface: "#FFFFFF",
        surface2: "#F5F9F6",
        text: "#1A2E22",
        text2: "#4A6355",
        text3: "#7A9485",
        danger: "#E05252",
        warn: "#F7B731",
        success: "#2D6A4F",
        info: "#3A7BD5",
      },
      borderRadius: {
        custom: "10px",
        "custom-lg": "14px",
      },
      boxShadow: {
        card: "0 4px 12px rgba(45,106,79,0.06)",
        modal: "0 24px 64px rgba(0,0,0,0.22)",
      },
    },
  },
  plugins: [],
};
export default config;
