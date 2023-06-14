/** @type {import("tailwindcss").Config} */
const config = {
  content: ["./src/**/*.tsx"],
  // @ts-ignore
  presets: [require("@acme/tailwind-config")],
  theme: {
    fontFamily: {
      sans: ["Nunito", "sans-serif"],
    },
    colors: {
      green: "#098A00",
      offwhite: "#F1F1F1",
      white: "#FFFFFF",
      "grey-100": "#E6E6E6",
      grey: "#E5E5E5",
      darkgrey: "#666",
      blue: "#4E7FD5",
      red: "A42B33",
      error: "ff0011",
      transparent: "transparent",
      "black-80": "#0000000b",
    },
    backgroundImage: {
      "main-blob": "url('/assets/main-blob.svg')",
    },
    boxShadow: {
      md: "4px 4px 16px rgba(0, 0, 0, 0.16)",
    },
  },
};

module.exports = config;
