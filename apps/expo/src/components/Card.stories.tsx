import type { Meta, StoryFn } from "@storybook/react";

import { Card } from "./Card";

export default {
  title: "Card",
  component: Card,
} satisfies Meta<typeof Card>;

type Story = StoryFn<typeof Card>;

export const Primary: Story = (props) => <Card {...props}></Card>;
