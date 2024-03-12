import type { Meta, StoryFn } from "@storybook/react";
import { useState } from "react";

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
type Story = StoryFn<typeof meta>;

export const Primary: Story = () => {
  const [value, setValue] = useState("");
  return <TextField value={value} onChange={setValue} label="Textfeld" />;
};
