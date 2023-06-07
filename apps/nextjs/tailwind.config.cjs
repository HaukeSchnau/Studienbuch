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
      grey: "#E5E5E5",
    },
    backgroundImage: {
      "main-blob": "url('/assets/main-blob.svg')",
    },
  },
};

module.exports = config;
