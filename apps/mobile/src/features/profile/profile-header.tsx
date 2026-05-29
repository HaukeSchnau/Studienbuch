import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "~/components/text";
import { SystemIcon } from "~/components/system-icon";
import { getCurrentYearNum } from "~/mock-app/domain";
import { useMockApp } from "~/mock-app/provider";

const Avatar = () => (
  <View className="h-28 w-28 items-center justify-center rounded-full bg-accent p-6">
    <SystemIcon name="person" size={48} color="white" />
  </View>
);

const DotField = ({ rows, cols }: { rows: number; cols: number }) => (
  <View style={{ gap: 6 }}>
    {Array.from({ length: rows }, (_, row) => (
      <View key={row} className="flex-row" style={{ gap: 6 }}>
        {Array.from({ length: cols }, (_, col) => (
          <View key={col} className="h-1.5 w-1.5 rounded-full bg-white/22" />
        ))}
      </View>
    ))}
  </View>
);

export const Header = () => {
  const { user, years } = useMockApp();
  const year = years.find((item) => item.id === user.yearId) ?? years[0]!;

  return (
    <View className="overflow-hidden rounded-b-[40px] bg-primary">
      <SafeAreaView edges={["top"]}>
        <View className="relative items-center px-6 py-7">
          <View className="absolute top-5 left-5">
            <DotField rows={8} cols={9} />
          </View>
          <View className="absolute right-6 bottom-7">
            <DotField rows={5} cols={6} />
          </View>

          <Avatar />
          <View className="h-4" />
          <Text weight="bold" className="text-3xl text-white">
            {user.name}'s Profil
          </Text>
          <View className="h-1.5" />
          <View className="items-center">
            <Text className="text-[18px] text-white/88">
              Jahrgang {year.name} ({getCurrentYearNum(year)}. Klasse)
            </Text>
            <Text className="text-[16px] text-white/78">{user.schoolName}</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};
