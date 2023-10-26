import type { Meta, StoryObj } from "@storybook/react";

import { NavigationItem } from "./NavigationItem";

const meta = {
  title: "Layout/NavigationItem",
  component: NavigationItem,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof NavigationItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    children: "Home",
    href: "/",
  },
};
