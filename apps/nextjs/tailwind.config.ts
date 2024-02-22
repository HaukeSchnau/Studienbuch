import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

import baseConfig from "@schnau/tailwind-config/web";

export default {
  // We need to append the path to the UI package to the content array so that
  // those classes are included correctly.
  content: [...baseConfig.content],
  presets: [baseConfig],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-nunito)", ...fontFamily.sans],
      },

      backgroundImage: {
        "main-blob": "url('/assets/main-blob.svg')",
      },
      boxShadow: {
        md: "4px 4px 16px rgba(0, 0, 0, 0.16)",
      },
    },
  },
} satisfies Config;
