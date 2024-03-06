import type { Meta, StoryObj } from "@storybook/react";

import { colors } from "@schnau/tailwind-config/base";

import { Circle } from "./Circle";

export default {
  title: "Circle",
  component: Circle,
  argTypes: {
    size: {
      control: {
        type: "number",
        min: 0,
        max: 1000,
        step: 1,
      },
    },
    color: {
      control: "select",
      options: Object.keys(colors),
    },
  },
} satisfies Meta<typeof Circle>;

type Story = StoryObj<typeof Circle>;

export const Primary: Story = {
  args: {
    size: 100,
    color: colors.green,
  },
};
