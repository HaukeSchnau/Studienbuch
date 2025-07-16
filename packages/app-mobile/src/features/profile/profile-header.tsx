import Icon from "@expo/vector-icons/MaterialIcons";
import { getCurrentYearNum } from "@stu/lib";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TempError } from "~/components/temp-error";
import { Text } from "~/components/text";
import { useRequiredAuthenticatedSession } from "~/utils/auth";
import { getMyYear } from "./queries/get-my-year";

const Avatar = () => {
  return (
    <View className="h-28 w-28 items-center justify-center rounded-full bg-accent">
      <Icon name="person" size={48} color="white" />
    </View>
  );
};

export const Header = () => {
  const { user, userId } = useRequiredAuthenticatedSession();
  const year = useQuery(getMyYear({ userId }));

  if (year.isPending) {
    return <ActivityIndicator />;
  }

  if (year.isError) {
    return <TempError error={year.error.message} />;
  }

  return (
    <View className="rounded-b-3xl bg-primary">
      <SafeAreaView edges={["top"]}>
        <View className="flex-col items-center py-10 relative">
          <Avatar />
          <View className="h-6" />
          <Text weight="bold" className="text-3xl text-white">
            {user.name}'s Profil
          </Text>
          <View className="h-2" />
          <View className="items-center">
            <Text className="text-xl text-white">
              Jahrgang {year.data.year.name} ({getCurrentYearNum(year.data.year)}. Klasse)
            </Text>
            <Text className="text-xl text-white">{year.data.school.name}</Text>
          </View>

          <View className="absolute top-4 right-4">
            <TouchableOpacity
              onPress={() => {
                router.push("/setup/name-and-year");
              }}
            >
              <Icon name="edit" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};
