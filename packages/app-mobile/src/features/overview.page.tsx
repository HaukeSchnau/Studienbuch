import { View } from "react-native";

import { CoreLayout } from "~/components/core-layout";
import { Text } from "~/components/text";
import { useRequiredAuthenticatedSession } from "~/utils/auth";
import { AbsencesOverviewCard } from "./absences/absences-overview-card";
import { Agenda } from "./agenda/agenda";
import { Tasks } from "./tasks/tasks";

export const OverviewPage = () => {
  return (
    <CoreLayout>
      <View className="px-8">
        <View className="h-4" />

        <Greeting />
        <Agenda />

        <View className="h-8" />

        <AbsencesOverviewCard />
      </View>

      <View className="h-8" />

      <Tasks />
    </CoreLayout>
  );
};

const Greeting = () => {
  const session = useRequiredAuthenticatedSession();

  return (
    <Text className="color-white text-4xl" variant="heading">
      Moin, {session.user.name}!
    </Text>
  );
};
