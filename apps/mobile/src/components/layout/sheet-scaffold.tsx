import type { ReactNode } from "react";
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Divider } from "../ui/divider";
import { Text } from "../ui/text";

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export const SheetScaffold = ({ title, subtitle, children, footer }: Props) => {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const footerBottomPadding = Math.max(insets.bottom - (Platform.OS === "ios" ? 14 : 4), 12);
  const maxBodyHeight = footer
    ? Math.min(height * (Platform.OS === "ios" ? 0.58 : 0.62), 560)
    : Math.min(height * 0.7, 640);

  return (
    <View style={styles.surface}>
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
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 16,
          paddingBottom: footer ? 24 : 20,
        }}
      >
        <View className="gap-3">{children}</View>
      </ScrollView>

      {footer ? (
        <View
          className="border-t border-[#E5EAF0] px-6 pt-3"
          style={[styles.footer, { paddingBottom: footerBottomPadding }]}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  surface: {
    backgroundColor: Platform.OS === "ios" ? "transparent" : "#FFFFFF",
  },
  footer: {
    backgroundColor: Platform.OS === "ios" ? "transparent" : "#FBFCFE",
  },
});
