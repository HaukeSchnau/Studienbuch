import type { ReactNode } from "react";
import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
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
  const useLiquidGlass = Platform.OS === "ios" && isGlassEffectAPIAvailable();
  const footerBottomPadding = Math.max(insets.bottom - 14, 12);
  const maxBodyHeight = footer ? Math.min(height * 0.56, 520) : Math.min(height * 0.68, 620);
  const Surface = useLiquidGlass ? GlassView : View;
  const surfaceProps = useLiquidGlass
    ? ({
        glassEffectStyle: "regular",
        tintColor: "rgba(251, 253, 255, 0.68)",
        colorScheme: "light",
      } as const)
    : {};

  return (
    <Surface {...surfaceProps} style={styles.surface}>
      <View style={styles.contentTint}>
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
            className="border-t border-[#E5EAF0] px-6 pt-3"
            style={[styles.footer, { paddingBottom: footerBottomPadding }]}
          >
            {footer}
          </View>
        ) : null}
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  surface: {
    backgroundColor: Platform.OS === "ios" ? "rgba(251, 253, 255, 0.58)" : colors.surface,
  },
  contentTint: {
    backgroundColor: Platform.OS === "ios" ? "rgba(251, 253, 255, 0.78)" : colors.surface,
  },
  footer: {
    backgroundColor: Platform.OS === "ios" ? "rgba(248, 250, 252, 0.82)" : "#FBFCFE",
  },
});
