import type { Meta, StoryObj } from "@storybook/react";

import { TextField } from "./TextField";

const meta = {
  title: "Form/TextField",
  component: TextField,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    label: "Email",
    type: "email",
    placeholder: "Email",
  },
};
