import { format } from "date-fns";
import { de } from "date-fns/locale/de";
import { useState } from "react";
import { View } from "react-native";
import { PressableSurface } from "~/components/feedback/pressable-surface";
import { PortaledBottomSheet } from "~/components/layout/bottom-sheet";
import { SystemIcon } from "~/components/ui/system-icon";
import { Text } from "~/components/ui/text";
import { haptics } from "~/platform/haptics";
import { colors } from "~/theme/colors";
import type { Semester } from "@stu/core";

interface SemesterSelectorProps {
  choices: Semester[];
  onSelect: (semester: Semester) => void;
  selectedSemester: Semester;
}

const semesterRangeLabel = (semester: Semester) =>
  `${format(semester.start, "MMM yyyy", { locale: de })} - ${format(semester.end, "MMM yyyy", {
    locale: de,
  })}`;

export const SemesterSelector = ({
  choices,
  selectedSemester,
  onSelect,
}: SemesterSelectorProps) => {
  const [isSheetVisible, setIsSheetVisible] = useState(false);

  if (choices.length <= 1) {
    return (
      <View className="rounded-[24px] border border-[#DDE6F1] bg-white px-4 py-3">
        <Text className="text-[14px] leading-5 text-[#5B6472]" weight="medium">
          Aktuelles Halbjahr
        </Text>
        <Text className="text-[18px] leading-6 text-primary-text" weight="bold">
          {selectedSemester.name}
        </Text>
      </View>
    );
  }

  return (
    <>
      <PressableSurface
        accessibilityLabel={`Halbjahr auswählen, aktuell ${selectedSemester.name}`}
        borderRadius={24}
        className="rounded-[24px] border border-[#DDE6F1] bg-white px-4 py-3"
        haptic="selection"
        onPress={() => setIsSheetVisible(true)}
        pressedScale={0.99}
      >
        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text className="text-[14px] leading-5 text-[#5B6472]" weight="medium">
              Aktuelles Halbjahr
            </Text>
            <Text className="text-[18px] leading-6 text-primary-text" weight="bold">
              {selectedSemester.name}
            </Text>
            <Text className="text-[13px] leading-5 text-[#718095]">
              {semesterRangeLabel(selectedSemester)}
            </Text>
          </View>
          <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-des">
            <SystemIcon name="chevron-right" size={20} color={colors.primary.text} />
          </View>
        </View>
      </PressableSurface>

      {isSheetVisible ? (
        <PortaledBottomSheet onClose={() => setIsSheetVisible(false)}>
          <View className="px-6 pb-3">
            <Text className="text-[25px] leading-8 text-primary-text" weight="bold">
              Halbjahr wählen
            </Text>
            <View className="h-3" />
            <View className="overflow-hidden rounded-[24px] border border-[#DDE6F1] bg-white">
              {[...choices]
                .sort((a, b) => b.start.getTime() - a.start.getTime())
                .map((semester, index, sortedChoices) => {
                  const selected = semester.id === selectedSemester.id;
                  return (
                    <View key={semester.id}>
                      <PressableSurface
                        accessibilityLabel={`${semester.name}, ${semesterRangeLabel(semester)}`}
                        borderRadius={0}
                        className="px-4 py-3.5"
                        haptic="selection"
                        onPress={() => {
                          haptics.selection();
                          onSelect(semester);
                          setIsSheetVisible(false);
                        }}
                        pressedScale={1}
                      >
                        <View className="flex-row items-center justify-between gap-3">
                          <View className="min-w-0 flex-1">
                            <Text
                              className="text-[17px] leading-6 text-primary-text"
                              weight={selected ? "bold" : "semi-bold"}
                            >
                              {semester.name}
                            </Text>
                            <Text className="text-[14px] leading-5 text-[#718095]">
                              {semesterRangeLabel(semester)}
                            </Text>
                          </View>
                          {selected ? (
                            <SystemIcon name="check" size={22} color={colors.primary.text} />
                          ) : null}
                        </View>
                      </PressableSurface>
                      {index < sortedChoices.length - 1 ? (
                        <View className="ml-4 h-px bg-[#E7EDF4]" />
                      ) : null}
                    </View>
                  );
                })}
            </View>
          </View>
        </PortaledBottomSheet>
      ) : null}
    </>
  );
};
