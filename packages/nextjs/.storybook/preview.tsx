import type { Preview } from "@storybook/react";
import React from "react";

import "../src/app/globals.css";

import type { CSSProperties } from "react";

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    (Story) => (
      <div
        className="flex font-sans"
        style={{ "--font-sans": "Nunito" } as CSSProperties}
      >
        <Story />
      </div>
    ),
  ],
};

export default preview;
