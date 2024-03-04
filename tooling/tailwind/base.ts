import type { Config } from "tailwindcss";

export const colors = {
  primary: {
    400: "#6DB868",
    600: "#33A42B",
  },

  green: "#33A42B",
  "green-desaturated": "#EEF5ED",
  "green-text": "#098A00",

  blue: "#3B7FD9",
  "blue-sec": "#4d75a8",
  "blue-desaturated": "#EBF0F7",

  offwhite: "#F1F1F1",
  white: "#FFFFFF",
  "grey-100": "#E6E6E6",

  grey: "#E5E5E5",
  darkgrey: "#666",

  red: "#A42B33",
  "red-desaturated": "#D9A3A7",

  transparent: "transparent",
  "black-80": "#0000000b",
};

export type Color = keyof typeof colors;

export const getColorValue = (color: Color) => colors[color];

export default {
  darkMode: ["class"],
  content: ["src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors,
      borderColor: {
        DEFAULT: "hsl(var(--border))",
      },
    },
  },
} satisfies Config;
