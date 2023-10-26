import type { Meta, StoryObj } from "@storybook/react";

import { PageHeading } from "./PageHeading";

const meta = {
  title: "Layout/PageHeading",
  component: PageHeading,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof PageHeading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    title: "Lorem ipsum dolor sit amet",
    color: "green",
  },
};
