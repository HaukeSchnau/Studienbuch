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
import type { Semester } from "@/compat/mobile-v0";

interface SemesterSelectorProps {
  choices: Semester[];
  onSelect: (semester: Semester) => void;
  selectedSemester: Semester;
  variant?: "card" | "header";
}

const semesterRangeLabel = (semester: Semester) =>
  `${format(semester.start, "MMM yyyy", { locale: de })} - ${format(semester.end, "MMM yyyy", {
    locale: de,
  })}`;

export const SemesterSelector = ({
  choices,
  selectedSemester,
  onSelect,
  variant = "card",
}: SemesterSelectorProps) => {
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const isHeader = variant === "header";

  if (choices.length <= 1) {
    return (
      <View
        className={
          isHeader
            ? "self-start rounded-full bg-[#087800]/70 px-4 py-2"
            : "rounded-[24px] border border-[#DDE6F1] bg-white px-4 py-3"
        }
      >
        <View className="flex-row items-center justify-between gap-3">
          {isHeader ? <SystemIcon name="calendar-today" size={18} color="#FFFFFF" /> : null}
          <Text
            className={
              isHeader
                ? "text-[16px] leading-5 text-white"
                : "text-[15px] leading-5 text-primary-text"
            }
            weight="bold"
          >
            {selectedSemester.name}
          </Text>
          <Text
            className={
              isHeader ? "text-[16px] leading-5 text-white" : "text-[13px] leading-5 text-[#718095]"
            }
          >
            {semesterRangeLabel(selectedSemester)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <PressableSurface
        accessibilityLabel={`Halbjahr auswählen, aktuell ${selectedSemester.name}`}
        borderRadius={isHeader ? 999 : 24}
        className={
          isHeader
            ? "self-start rounded-full bg-[#087800]/70 px-4 py-2"
            : "rounded-[24px] border border-[#DDE6F1] bg-white px-4 py-3"
        }
        haptic="selection"
        onPress={() => setIsSheetVisible(true)}
        pressedScale={0.99}
      >
        <View className="flex-row items-center justify-between gap-3">
          {isHeader ? <SystemIcon name="calendar-today" size={18} color="#FFFFFF" /> : null}
          <View
            className={
              isHeader
                ? "min-w-0 flex-row items-baseline gap-1.5"
                : "min-w-0 flex-1 flex-row items-baseline gap-2"
            }
          >
            <Text
              className={
                isHeader
                  ? "text-[15px] leading-5 text-white"
                  : "text-[16px] leading-6 text-primary-text"
              }
              weight="bold"
            >
              {selectedSemester.name}
            </Text>
            <Text
              className={
                isHeader
                  ? "min-w-0 text-[15px] leading-5 text-white"
                  : "min-w-0 flex-1 text-[13px] leading-5 text-[#718095]"
              }
              numberOfLines={1}
            >
              {semesterRangeLabel(selectedSemester)}
            </Text>
          </View>
          {isHeader ? (
            <SystemIcon name="chevron-down" size={19} color="#FFFFFF" />
          ) : (
            <View className="h-8 w-8 items-center justify-center rounded-full bg-primary-des">
              <SystemIcon name="chevron-right" size={18} color={colors.primary.text} />
            </View>
          )}
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
