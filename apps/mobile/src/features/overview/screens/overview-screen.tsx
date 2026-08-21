import { View } from "react-native";
import { CoreLayout } from "~/ui/layout/core-layout";
import { Text } from "~/ui/text";
import { AbsencesOverviewCard } from "~/features/absences";
import { useProfile } from "~/features/profile";
import { Agenda } from "~/features/schedule";
import { TasksSection } from "~/features/tasks";

export const OverviewScreen = () => (
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

const Greeting = () => {
  const { profile } = useProfile();

  return (
    <Text className="text-4xl text-white" variant="heading">
      Moin, {profile.name}!
    </Text>
  );
};
