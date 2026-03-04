import baseConfig from "@stu/tailwind-config/web";

import defaultTheme from "tailwindcss/defaultTheme";

export default {
  content: [...baseConfig.content],
  presets: [baseConfig],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-nunito)", ...defaultTheme.fontFamily.sans],
      },

      backgroundImage: {
        "main-blob": "url('/assets/main-blob.svg')",
      },
      boxShadow: {
        md: "4px 4px 16px rgba(0, 0, 0, 0.16)",
      },
    },
  },
};
