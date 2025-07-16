import { Button, View, Text } from "react-native";
import type { Meta, StoryFn } from "@storybook/react";
import { DrawingView, DrawingViewRef } from "@stu/expo-native";
import { useRef, useState } from "react";

const meta = {
  title: "DrawingPad",
  component: DrawingView,
  argTypes: {},
  args: {},
  decorators: [
    (Story) => (
      <View style={{ padding: 16, alignItems: "flex-start" }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof DrawingView>;

export default meta;

type Story = StoryFn<typeof meta>;

export const Basic: Story = () => {
  const ref = useRef<DrawingViewRef>(null);
  const [svg, setSvg] = useState<string | null>(null);

  return (
    <View>
      <DrawingView ref={ref} style={{ width: 300, height: 300, backgroundColor: "green" }} />
      <Button
        title="Show SVG Code"
        onPress={async () => {
          const svgCode = await ref.current?.getSVG();
          setSvg(svgCode ?? null);
        }}
      />
      {svg && <Text>{svg}</Text>}
    </View>
  );
};
