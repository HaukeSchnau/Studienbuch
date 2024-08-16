import type { Config } from "tailwindcss";

import base from "./base";

export const colors = {
  primary: {
    DEFAULT: "#33A42B",
    pale: "#6DB868",
    des: "#EEF5ED",

    text: "#098A00",
  },

  accent: {
    DEFAULT: "#3B7FD9",
    sec: "#4d75a8",
    pale: "#76A6E5",
    des: "#EBF0F7",
  },

  danger: {
    DEFAULT: "#A42B33",
    sec: "#8A0000",
    des: "#ECD4D6",
  },

  alert: {
    DEFAULT: "#DCAB3C",
    des: "#F2E9D8",
  },

  success: {
    DEFAULT: "#33A42B",
    des: "#EEF5ED",
    pale: "#6DB868",
  },

  neutral: {
    DEFAULT: "#666666",
    sec: "#e5e5e5",
  },

  surface: "#ffffff",
  background: "#f9f9f9",

  on: {
    primary: "#ffffff",
    "primary-pale": "#ffffff",
    "primary-des": "#ffffff",

    accent: "#ffffff",
    "accent-sec": "#ffffff",
    "accent-pale": "#ffffff",
    "accent-des": "#ffffff",

    danger: "#ffffff",
    "danger-sec": "#ffffff",
    "danger-des": "#ffffff",

    alert: "#ffffff",
    "alert-des": "#ffffff",

    success: "#ffffff",
    "success-des": "#ffffff",
    "success-pale": "#ffffff",

    neutral: "#ffffff",
    "neutral-sec": "#ffffff",

    surface: "#000000",

    background: "#000000",
  },

  white: "#FFFFFF",
  "grey-100": "#E6E6E6",

  transparent: "transparent",

  black: {
    80: "#0000000b",
  },
};

export default {
  content: base.content,
  presets: [],
  theme: {
    extend: {
      colors,
      borderRadius: {
        "3xl": "2.5rem",
      },
    },
  },
} satisfies Config;
