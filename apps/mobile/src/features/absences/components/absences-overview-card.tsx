import { format } from "date-fns";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { PortaledBottomSheet } from "~/components/layout/bottom-sheet";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { IconButton } from "~/components/ui/icon-button";
import { Text } from "~/components/ui/text";
import { isAbsenceConfirmed } from "@stu/core";
import { useAbsences } from "~/data/hooks";
import { absencesRoute } from "~/routing/params";
import { useRequiredAuthenticatedSession } from "~/app-shell/session/session";
import { AddAbsence } from "./add-absence";
import BigCheck from "./big-check.svg";
import Warning from "./warning.svg";

export const AbsencesOverviewCard = () => {
  const [isAddVisible, setIsAddVisible] = useState(false);
  const { absences } = useAbsences();
  const { user } = useRequiredAuthenticatedSession();
  const unexcused = useMemo(
    () => absences.filter((absence) => !isAbsenceConfirmed(absence, user.isOfAge)),
    [absences, user.isOfAge],
  );

  return (
    <Card style={{ paddingVertical: 16 }}>
      <View className="flex-row items-center justify-between">
        <Text variant="heading" style={{ fontSize: 20 }}>
          Fehlzeiten
        </Text>
        <IconButton
          onPress={() => setIsAddVisible(true)}
          icon="add"
          variant="plain"
          size={28}
          color="#098A00"
        />
      </View>

      <View className="h-2" />

      {unexcused.length === 0 ? (
        <NoAbsences />
      ) : (
        <UnexcusedAbsences
          numberOfAbsences={unexcused.reduce(
            (count, absence) => count + absence.courseIds.length,
            0,
          )}
          numberOfDays={
            new Set(unexcused.map((absence) => format(absence.date, "yyyy-MM-dd"))).size
          }
        />
      )}

      <View className="h-4" />

      <Button
        label="Alle ansehen"
        className="self-end"
        onPress={() => router.push(absencesRoute)}
      />

      {isAddVisible ? (
        <PortaledBottomSheet onClose={() => setIsAddVisible(false)}>
          <AddAbsence onClose={() => setIsAddVisible(false)} />
        </PortaledBottomSheet>
      ) : null}
    </Card>
  );
};

const NoAbsences = () => (
  <View className="flex-row">
    <BigCheck width={40} />
    <View className="w-4" />
    <View className="flex-1">
      <Text className="opacity-80">Super! All deine Fehlzeiten sind entschuldigt!</Text>
      <View className="h-2" />
      <Text className="opacity-80">
        Wirst du heute oder morgen fehlen? Dann trage es am besten direkt hier ein.
      </Text>
    </View>
  </View>
);

const UnexcusedAbsences = ({
  numberOfDays,
  numberOfAbsences,
}: {
  numberOfDays: number;
  numberOfAbsences: number;
}) => {
  return (
    <View className="flex-row">
      <Warning width={40} height={50} />
      <View className="w-4" />
      <View className="flex-1">
        <Text className="opacity-80">
          Du hast noch <Text weight="bold">{numberOfAbsences}</Text> unentschuldigte{" "}
          {numberOfAbsences === 1 ? "Fehlzeit" : "Fehlzeiten"} an{" "}
          <Text weight="bold">{numberOfDays}</Text> {numberOfDays === 1 ? "Tag" : "Tagen"}.
        </Text>
      </View>
    </View>
  );
};
