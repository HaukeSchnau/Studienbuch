import { useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import type { DrawingViewRef } from "@stu/expo-native-modules";
import { DrawingView } from "@stu/expo-native-modules";

import { Text } from "~/components/text";
import { api } from "~/utils/api";
import { useRequiredAuthenticatedSession } from "~/utils/auth";
import Cross from "../.././../../../assets/cross.svg";

interface SignatureProps {
  label: string;
}

const Signature = ({ label }: SignatureProps) => {
  const ref = useRef<DrawingViewRef>(null);

  return (
    <View
      className="relative h-80 w-full items-center justify-center"
      style={{
        borderBottomColor: "#9E9E9E",
        borderBottomWidth: 1,
        backgroundColor: "#F5F5F5",
      }}
    >
      <DrawingView
        ref={ref}
        style={{ width: "100%", height: "100%", position: "absolute" }}
      />
      <View className="absolute bottom-0 left-0 right-0 flex-row items-center justify-between p-4">
        <Cross width={35} height={35} color={"rgba(0, 0, 0, 0.25)"} />
        <Text className="text-lg opacity-60">{label}</Text>
      </View>
    </View>
  );
};

export default function ExcuseAbsencePage() {
  const { courses: coursesStr, date: dateStr } = useLocalSearchParams<{
    date: string;
    courses: string;
  }>();
  const date = new Date(parseInt(dateStr));
  const courses = coursesStr.split(";");

  const absences = api.students.absences.listUnexcused.useQuery({
    date,
    courses,
  });
  const { user } = useRequiredAuthenticatedSession();

  if (absences.isPending) {
    return <ActivityIndicator />;
  }

  if (absences.isError) {
    return <Text>Error: {absences.error.message}</Text>;
  }

  if (!absences.data[0]) {
    return <Text>Keine unentschuldigten Fehlzeiten gefunden.</Text>;
  }

  const reason = absences.data[0].reason;

  return (
    <View className="p-8">
      <Stack.Screen
        options={{
          title: "Fehlzeit entschuldigen",
          headerTintColor: "#FFFFFF",
          headerBackTitle: "Zurück",
        }}
      />

      <Text className="text-lg">
        Bitte lasse deine Eltern hier unterschreiben:
      </Text>
      <View className="h-4" />
      <Text className="text-xl">
        Ich bestätige, dass mein Kind <Text weight="bold">{user.name}</Text> am{" "}
        <Text weight="bold">{date.toLocaleDateString()}</Text> mit folgender
        Begründung nicht am Unterricht teilnehmen konnte:
      </Text>
      <View className="h-4" />
      <Text weight="medium" className="text-xl">
        {reason}
      </Text>
      <View className="h-4" />

      <Signature label="Unterschrift des Erziehungsberechtigten" />
    </View>
  );
}
