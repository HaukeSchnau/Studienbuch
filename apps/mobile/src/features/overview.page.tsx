import { View } from "react-native";
import { CoreLayout } from "~/components/core-layout";
import { Text } from "~/components/text";
import { Agenda } from "~/features/agenda/agenda";
import { AbsencesOverviewCard } from "~/features/absences/absences-overview-card";
import { Tasks } from "~/features/tasks/tasks";
import { useRequiredAuthenticatedSession } from "~/utils/auth";

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
    <Text className="text-4xl text-white" variant="heading">
      Moin, {session.user.name}!
    </Text>
  );
};
