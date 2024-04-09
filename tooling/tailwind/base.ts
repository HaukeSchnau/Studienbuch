import type { Config } from "tailwindcss";

export const colors = {
  primary: {
    default: "var(--primary, #33A42B)",
    pale: "var(--primary-pale, #6DB868)",
    des: "var(--primary-des, #EEF5ED)",

    400: "var(--primary-pale, #6DB868)",
    600: "var(--primary, #33A42B)",
    800: "var(--primary-text, #098A00)",
  },

  accent: {
    default: "var(--accent, #3B7FD9)",
    sec: "var(--accent-sec, #4d75a8)",
    pale: "var(--accent-pale, #76A6E5)",
    des: "var(--accent-des, #EBF0F7)",
  },

  danger: {
    default: "var(--danger, #A42B33)",
    sec: "var(--danger-sec, #8A0000)",
    des: "var(--danger-des, #ECD4D6)",
  },

  alert: {
    default: "var(--alert, #DCAB3C)",
    des: "var(--alert-des, #F2E9D8)",
  },

  success: {
    default: "var(--success, #33A42B)",
    des: "var(--success-des, #EEF5ED)",
    pale: "var(--success-pale, #6DB868)",
  },

  neutral: {
    default: "var(--neutral, #666666)",
    sec: "var(--neutral-sec, #e5e5e5)",
  },

  surface: "var(--surface, #ffffff)",
  background: "var(--background, #f9f9f9)",

  on: {
    primary: "var(--on-primary, #ffffff)",
    "primary-pale": "var(--on-primary-pale, #ffffff)",
    "primary-des": "var(--on-primary-des, #ffffff)",

    accent: "var(--on-accent, #ffffff)",
    "accent-sec": "var(--on-accent-sec, #ffffff)",
    "accent-pale": "var(--on-accent-pale, #ffffff)",
    "accent-des": "var(--on-accent-des, #ffffff)",

    danger: "var(--on-danger, #ffffff)",
    "danger-sec": "var(--on-danger-sec, #ffffff)",
    "danger-des": "var(--on-danger-des, #ffffff)",

    alert: "var(--on-alert, #ffffff)",
    "alert-des": "var(--on-alert-des, #ffffff)",

    success: "var(--on-success, #ffffff)",
    "success-des": "var(--on-success-des, #ffffff)",
    "success-pale": "var(--on-success-pale, #ffffff)",

    neutral: "var(--on-neutral, #ffffff)",
    "neutral-sec": "var(--on-neutral-sec, #ffffff)",

    surface: "var(--on-surface, #000000)",

    background: "var(--on-background, #000000)",
  },

  green: "var(--primary, #33A42B)",
  "green-desaturated": "var(--primary-des, #EEF5ED)",
  "green-text": "var(--primary-text, #098A00)",

  blue: "var(--accent, #3B7FD9)",
  "blue-sec": "var(--accent-sec, #4d75a8)",
  "blue-desaturated": "var(--accent-des, #EBF0F7)",

  offwhite: "#F1F1F1",
  white: "#FFFFFF",
  "grey-100": "#E6E6E6",

  grey: "#E5E5E5",
  darkgrey: "#666",

  red: "#A42B33",
  "red-sec": "#8A0000",
  "red-desaturated": "#D9A3A7",

  transparent: "transparent",
  "black-80": "#0000000b",

  black: {
    20: "rgba(0, 0, 0, 0.2)",
    80: "#000000b",
  },

  yellow: "#DCAB3C",
  "yellow-sec": "#a47c20",
};

export type Color = keyof typeof colors;

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
