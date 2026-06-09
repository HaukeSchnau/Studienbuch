import { Platform, View } from "react-native";

import { PressableSurface } from "~/components/feedback/pressable-surface";
import { PortaledBottomSheet } from "~/components/layout/bottom-sheet";
import { SystemIcon, type SystemIconName } from "~/components/ui/system-icon";
import { Text } from "~/components/ui/text";
import { colors } from "~/theme/colors";

interface Props {
  onClose: () => void;
  onPickFromLibrary: () => void;
  onTakePhoto: () => void;
}

export const TaskPhotoSourceSheet = ({ onClose, onPickFromLibrary, onTakePhoto }: Props) => {
  const handleSelect = (action: () => void) => {
    onClose();
    requestAnimationFrame(action);
  };

  return (
    <PortaledBottomSheet iosSnapPoints={["48%"]} onClose={onClose}>
      <View className="px-5 pb-4 pt-2">
        <View className="px-1 pb-4">
          <Text variant="heading" className="text-[25px] leading-[31px] text-primary-text">
            Foto hinzufügen
          </Text>
          <Text className="pt-2 text-[16px] leading-6 text-[#5B6472]">
            Wähle eine Quelle für die neue Hausaufgaben-Notiz.
          </Text>
        </View>

        <View className="gap-3">
          <PhotoSourceRow
            iconName="camera"
            label="Foto aufnehmen"
            onPress={() => handleSelect(onTakePhoto)}
            tintColor={colors.primary.text}
          />
          <PhotoSourceRow
            iconName="photo-library"
            label="Aus Mediathek wählen"
            onPress={() => handleSelect(onPickFromLibrary)}
            tintColor={colors.accent.DEFAULT}
          />
          <PressableSurface
            accessibilityLabel="Foto hinzufügen abbrechen"
            borderRadius={22}
            className="h-12 items-center justify-center rounded-[22px] bg-[#EEF2F6]"
            haptic="selection"
            onPress={onClose}
            pressedScale={0.985}
          >
            <Text className="text-[17px] text-[#52616F]" weight="bold">
              Abbrechen
            </Text>
          </PressableSurface>
        </View>
      </View>
    </PortaledBottomSheet>
  );
};

const PhotoSourceRow = ({
  iconName,
  label,
  onPress,
  tintColor,
}: {
  iconName: SystemIconName;
  label: string;
  onPress: () => void;
  tintColor: string;
}) => (
  <PressableSurface
    accessibilityLabel={label}
    android_ripple={{
      borderless: false,
      color: "rgba(9, 138, 0, 0.12)",
      foreground: true,
    }}
    borderRadius={24}
    className="min-h-[64px] flex-row items-center gap-4 rounded-[24px] bg-white px-4"
    haptic="impact"
    highlightColor="rgba(9, 138, 0, 0.08)"
    highlightOpacity={Platform.OS === "ios" ? 1 : 0}
    onPress={onPress}
    pressedScale={0.985}
    style={{
      elevation: Platform.OS === "android" ? 1 : 0,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: Platform.OS === "ios" ? 0.04 : 0,
      shadowRadius: 8,
    }}
  >
    <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-des">
      <SystemIcon name={iconName} color={tintColor} size={24} />
    </View>
    <Text className="min-w-0 flex-1 text-[18px] text-[#172033]" weight="bold">
      {label}
    </Text>
    <SystemIcon name="chevron-right" color="#94A3B8" size={22} />
  </PressableSurface>
);
