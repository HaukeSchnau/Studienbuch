import type { ReactNode } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "~/theme/colors";
import { Divider } from "./divider";
import { Text } from "./text";

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export const SheetScaffold = ({ title, subtitle, children, footer }: Props) => {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const footerBottomPadding = Math.max(insets.bottom - 14, 12);
  const maxBodyHeight = footer ? Math.min(height * 0.56, 520) : Math.min(height * 0.68, 620);

  return (
    <View style={{ backgroundColor: colors.surface }}>
      <View className="px-6 pb-5 pt-3">
        <Text variant="heading" className="text-[24px] leading-[30px] text-primary-text">
          {title}
        </Text>

        {subtitle ? (
          <Text className="pt-2 text-[15px] leading-6 text-[#5B6472]">{subtitle}</Text>
        ) : null}
      </View>

      <Divider />

      <ScrollView
        style={{ maxHeight: maxBodyHeight }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 16 }}
      >
        <View className="gap-3">{children}</View>
      </ScrollView>

      {footer ? (
        <View
          className="border-t border-[#E5EAF0] bg-[#FBFCFE] px-6 pt-3"
          style={{ paddingBottom: footerBottomPadding }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
};
