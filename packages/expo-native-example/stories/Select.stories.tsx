import { View } from "react-native";
import type { Meta, StoryObj } from "@storybook/react";
import { SelectView } from "@stu/expo-native";
import { Text } from "react-native";

const meta = {
  title: "SelectView",
  component: SelectView,
  argTypes: {},
  args: {},
  decorators: [
    (Story) => (
      <View style={{ padding: 16, alignItems: "flex-start" }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof SelectView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  args: {
    name: "SelectView",
    options: ["Option 1", "Option 2", "Option 3"],
    children: <Text>SelectView</Text>,
    style: {
      width: 100,
      height: 100,
      backgroundColor: "red",
    },
  },
};
