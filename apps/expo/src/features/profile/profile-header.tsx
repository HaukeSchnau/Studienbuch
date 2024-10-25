import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "@expo/vector-icons/MaterialIcons";

import { getCurrentYearNum } from "@stu/lib";

import { TempError } from "~/components/temp-error";
import { Text } from "~/components/text";
import { api } from "~/utils/api";
import { useRequiredAuthenticatedSession } from "~/utils/auth";

const Avatar = () => {
  return (
    <View className="h-28 w-28 items-center justify-center rounded-full bg-accent">
      <Icon name="person" size={48} color="white" />
    </View>
  );
};

export const Header = () => {
  const { user } = useRequiredAuthenticatedSession();
  const year = api.students.years.getOwn.useQuery();

  if (year.isPending) {
    return <ActivityIndicator />;
  }

  if (year.isError) {
    return <TempError error={year.error.message} />;
  }

  return (
    <View className="rounded-b-3xl bg-primary">
      <SafeAreaView edges={["top"]}>
        <View className="flex-col items-center py-10">
          <Avatar />
          <View className="h-6" />
          <Text weight="bold" className="text-3xl text-white">
            {user.name}s Profil
          </Text>
          <View className="h-2" />
          <View className="items-center">
            <Text className="text-xl text-white">
              Jahrgang {year.data.name} ({getCurrentYearNum(year.data)}. Klasse)
            </Text>
            <Text className="text-xl text-white">{year.data.school.name}</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};
