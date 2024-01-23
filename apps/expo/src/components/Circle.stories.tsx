import type { ComponentStoryObj, Meta } from "@storybook/react-native";

import { colors } from "@acme/tailwind-config";

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

type Story = ComponentStoryObj<typeof Circle>;

export const Primary: Story = {
  args: {
    size: 100,
    color: "green",
  },
};
