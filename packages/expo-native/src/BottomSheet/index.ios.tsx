import { requireNativeView } from "expo";
import type { NativeSyntheticEvent } from "react-native";
import { Dimensions, View } from "react-native";

import type { BottomSheetProps } from ".";

type NativeBottomSheetProps = Omit<BottomSheetProps, "onIsOpenedChange"> & {
  onIsOpenedChange: (
    event: NativeSyntheticEvent<{ isOpened: boolean }>,
  ) => void;
};

const BottomSheetNativeView: React.ComponentType<NativeBottomSheetProps> =
  requireNativeView("ExpoUI", "BottomSheetView");

export function transformBottomSheetProps(
  props: BottomSheetProps,
): NativeBottomSheetProps {
  return {
    ...props,
    onIsOpenedChange: ({ nativeEvent: { isOpened } }) => {
      props.onIsOpenedChange(isOpened);
    },
  };
}

export function BottomSheet(props: BottomSheetProps) {
  const { width } = Dimensions.get("window");
  return (
    <View>
      <BottomSheetNativeView
        style={{ position: "absolute", width }}
        {...transformBottomSheetProps(props)}
      />
    </View>
  );
}
