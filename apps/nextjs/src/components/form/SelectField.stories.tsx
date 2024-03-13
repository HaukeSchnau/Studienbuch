import type { Meta, StoryObj } from "@storybook/react";
import { useArgs } from "@storybook/preview-api";

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

const options = [
  { label: "Option 1", value: "option1" },
  { label: "Option 2", value: "option2" },
  { label: "Option 3", value: "option3" },
];

type OptionValue = (typeof options)[number];

export const Primary: Story = {
  args: {
    label: "Select an option",
    emptyLabel: "No option selected",
    valueId: "option1",
    options,
    onChange: (valueId) => console.log(valueId),
    getOptionId: (option) => option.value,
    getOptionLabel: (option) => option.label,
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
