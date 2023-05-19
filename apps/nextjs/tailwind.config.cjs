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
    },
  },
};

module.exports = config;
