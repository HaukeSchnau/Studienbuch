import type { ComponentStoryFn, Meta } from "@storybook/react-native";

import { Card } from "./Card";

export default {
  title: "Card",
  component: Card,
} satisfies Meta<typeof Card>;

type Story = ComponentStoryFn<typeof Card>;

export const Primary: Story = (props) => <Card {...props}></Card>;
