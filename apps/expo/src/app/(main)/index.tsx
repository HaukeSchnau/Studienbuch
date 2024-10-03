import { ActivityIndicator, View } from "react-native";

import { CoreLayout } from "~/components/core-layout";
import { Text } from "~/components/text";
import { AbsencesOverviewCard } from "~/features/absences/absences-overview-card";
import { Agenda } from "~/features/agenda/agenda";
import { Tasks } from "~/features/tasks/tasks";
import { api } from "~/utils/api";

export default function OverviewPage() {
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
}

const Greeting = () => {
  const session = api.auth.getSession.useQuery();

  if (session.isPending) {
    return <ActivityIndicator />;
  }

  if (session.error) {
    return <Text>Session Error: {session.error.message}</Text>;
  }

  if (!session.data?.user) {
    return <Text>Not authenticated. This should not happen.</Text>;
  }

  return (
    <Text className="color-white text-4xl" variant="heading">
      Moin, {session.data.user.name}!
    </Text>
  );
};
