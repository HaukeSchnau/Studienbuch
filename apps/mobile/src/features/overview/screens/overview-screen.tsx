import { View } from "react-native";
import { CoreLayout } from "~/components/layout/core-layout";
import { Text } from "~/components/ui/text";
import { Agenda } from "~/features/agenda";
import { AbsencesOverviewCard } from "~/features/absences";
import { TasksSection } from "~/features/tasks";
import { useRequiredAuthenticatedSession } from "~/app-shell/session/session";

export const OverviewScreen = () => {
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
      <TasksSection />
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
