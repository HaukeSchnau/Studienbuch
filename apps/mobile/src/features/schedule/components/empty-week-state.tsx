import { View } from "react-native";

import { SystemIcon } from "~/ui/system-icon";
import { Text } from "~/ui/text";
import { colors } from "~/ui/colors";

export const EmptyWeekState = () => (
  <View
    accessible
    accessibilityLabel="Freie Woche. Keine Kurse eingetragen."
    className="items-center px-5"
    pointerEvents="none"
  >
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View className="relative h-28 w-40">
        <View className="absolute left-8 top-4 h-20 w-24 rotate-[-8deg] rounded-[24px] bg-[#EAF7EA]" />
        <View className="absolute left-14 top-1 h-16 w-20 rotate-[8deg] rounded-[20px] bg-[#EAF1FF]" />
        <View className="absolute left-12 top-6 h-16 w-16 items-center justify-center rounded-full bg-white">
          <SystemIcon name="calendar-today" color={colors.primary.DEFAULT} size={30} />
        </View>
        <View className="absolute left-1 top-16 rounded-full bg-[#3B7FD9] px-3 py-1.5">
          <Text weight="bold" className="text-[10px] uppercase text-white">
            frei
          </Text>
        </View>
        <View className="absolute right-2 top-20 rotate-[7deg] rounded-full bg-[#FFD95A] px-3 py-1.5">
          <Text weight="bold" className="text-[10px] text-[#3E4655]">
            :)
          </Text>
        </View>
        <View className="absolute right-8 top-3 h-3 w-3 rounded-full bg-[#2EAB2E]" />
        <View className="absolute right-1 top-10 h-2 w-2 rounded-full bg-[#3B7FD9]" />
      </View>
      <View className="items-center">
        <Text weight="bold" className="mt-1 text-center text-lg text-[#138A13]">
          Freie Woche!
        </Text>
        <Text className="mt-1 text-center text-sm leading-5 text-neutral">
          Keine Kurse eingetragen. Zeit zum Durchatmen.
        </Text>
      </View>
    </View>
  </View>
);
