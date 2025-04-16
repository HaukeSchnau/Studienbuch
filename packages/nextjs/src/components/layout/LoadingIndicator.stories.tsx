import type { Meta, StoryObj } from "@storybook/react";

import { LoadingIndicator } from "./LoadingIndicator";

const meta = {
  title: "Layout/LoadingIndicator",
  component: LoadingIndicator,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof LoadingIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
