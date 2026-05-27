import Icon from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "~/components/text";
import { getCurrentYearNum } from "~/mock-app/domain";
import { useMockApp } from "~/mock-app/provider";

const Avatar = () => (
  <View className="h-28 w-28 items-center justify-center rounded-full bg-accent">
    <Icon name="person" size={48} color="white" />
  </View>
);

export const Header = () => {
  const { user, years } = useMockApp();
  const year = years.find((item) => item.id === user.yearId) ?? years[0]!;

  return (
    <View className="rounded-b-3xl bg-primary">
      <SafeAreaView edges={["top"]}>
        <View className="relative items-center py-10">
          <Avatar />
          <View className="h-6" />
          <Text weight="bold" className="text-3xl text-white">
            {user.name}'s Profil
          </Text>
          <View className="h-2" />
          <View className="items-center">
            <Text className="text-xl text-white">
              Jahrgang {year.name} ({getCurrentYearNum(year)}. Klasse)
            </Text>
            <Text className="text-xl text-white">{user.schoolName}</Text>
          </View>

          <View className="absolute top-4 right-4">
            <TouchableOpacity onPress={() => router.push("/setup/name-and-year")}>
              <Icon name="edit" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};
