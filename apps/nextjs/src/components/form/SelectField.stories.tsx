import { useArgs } from "@storybook/preview-api";
import type { Meta, StoryObj } from "@storybook/react";

import { SelectField } from "./SelectField";

const meta = {
  title: "Form/SelectField",
  component: SelectField<OptionValue>,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof SelectField<OptionValue>>;

export default meta;
type Story = StoryObj<typeof meta>;

type OptionValue = "option1" | "option2" | "option3";

const options = [
  { label: "Option 1", value: "option1" as const, id: "option1" },
  { label: "Option 2", value: "option2" as const, id: "option2" },
  { label: "Option 3", value: "option3" as const, id: "option3" },
];

export const Primary: Story = {
  args: {
    label: "Select an option",
    valueId: "option1",
    options,
  },
  render: function Component(args) {
    const [, setArgs] = useArgs();

    // Forward all args and overwrite onValueChange
    return (
      <SelectField<OptionValue>
        {...args}
        onChange={(valueId) => {
          args.onChange?.(valueId);
          setArgs({ ...args, valueId });
        }}
      />
    );
  },
};
