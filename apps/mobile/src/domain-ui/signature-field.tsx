import type { ReactNode } from "react";
import { forwardRef, useImperativeHandle, useState } from "react";
import { View } from "react-native";
import { SvgXml } from "react-native-svg";

import Cross from "~/assets/cross.svg";
import { PressableSurface } from "~/components/feedback/pressable-surface";
import { Text } from "~/components/ui/text";

export interface SignatureFieldRef {
  getSVG: () => Promise<string>;
}

const SignatureFrame = ({ children, label }: { children: ReactNode; label: string }) => (
  <View
    className="h-80 w-full items-center justify-center"
    style={{
      borderBottomColor: "#9E9E9E",
      borderBottomWidth: 1,
      backgroundColor: "#F5F5F5",
    }}
  >
    {children}
    <View className="absolute right-0 bottom-0 left-0 flex-row items-center justify-between p-4">
      <Cross width={35} height={35} color={"rgba(0, 0, 0, 0.25)"} />
      <Text className="text-lg opacity-60">{label}</Text>
    </View>
  </View>
);

interface Props {
  label: string;
  onSignedChange?: (signed: boolean) => void;
}

const createMockSignatureSvg = (label: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 140"><path d="M18 92 C52 40, 84 114, 122 82 S188 40, 224 90 S274 112, 302 64" fill="none" stroke="#111" stroke-width="4" stroke-linecap="round"/><text x="18" y="124" font-size="14" fill="#666">${label}</text></svg>`;

export const SignatureField = forwardRef<SignatureFieldRef, Props>(
  ({ label, onSignedChange }, ref) => {
    const [svg, setSvg] = useState<string>("");

    useImperativeHandle(
      ref,
      () => ({
        async getSVG() {
          return svg;
        },
      }),
      [svg],
    );

    return (
      <SignatureFrame label={label}>
        <PressableSurface
          accessibilityLabel={`${label} erfassen`}
          borderRadius={0}
          haptic={svg ? "none" : "selection"}
          highlightColor="rgba(9, 138, 0, 0.10)"
          onPress={() => {
            const next = createMockSignatureSvg(label);
            setSvg(next);
            onSignedChange?.(true);
          }}
          className="h-full w-full items-center justify-center"
          style={{ position: "absolute" }}
        >
          {svg ? (
            <SvgXml xml={svg} style={{ width: "100%", height: "100%", position: "absolute" }} />
          ) : (
            <Text className="px-8 text-center text-base opacity-50">
              Tippen, um eine Demo-Unterschrift einzufügen
            </Text>
          )}
        </PressableSurface>
      </SignatureFrame>
    );
  },
);

export const SignatureView = ({ svg, label }: { svg: string; label: string }) => (
  <SignatureFrame label={label}>
    <SvgXml xml={svg} style={{ width: "100%", height: "100%", position: "absolute" }} />
  </SignatureFrame>
);
