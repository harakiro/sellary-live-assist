import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f5ff",
          100: "#e0ebff",
          200: "#b8d4fe",
          300: "#7ab5fd",
          400: "#3b8ffa",
          500: "#1570ef",
          600: "#0b57d0",
          700: "#0842a0",
          800: "#0a3578",
          900: "#0c2d63",
        },
      },
    },
  },
  plugins: [],
};

export default config;
