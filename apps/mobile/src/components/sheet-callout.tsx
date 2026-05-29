import type { ReactNode } from "react";
import { View } from "react-native";

import { Text } from "./text";

export const SheetCallout = ({ children }: { children: ReactNode }) => {
  return (
    <View className="rounded-[24px] border border-[#E5EAF0] bg-[#F9FBFD] px-5 py-4">
      <Text className="text-[17px] leading-8 text-[#17212B]">{children}</Text>
    </View>
  );
};
