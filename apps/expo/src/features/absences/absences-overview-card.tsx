import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Link } from "expo-router";
import { formatDate } from "date-fns";

import type { AbsenceDay } from "@stu/lib";
import { colors } from "@stu/tailwind-config/native";

import { PortaledBottomSheet } from "~/components/bottom-sheet";
import { Button } from "~/components/button";
import { Card } from "~/components/card";
import { IconButton } from "~/components/icon-button";
import { Text } from "~/components/text";
import { api } from "~/utils/api";
import { AddAbsence } from "./add-absence";
import BigCheck from "./big-check.svg";
import Warning from "./warning.svg";

export const AbsencesOverviewCard = () => {
  const [isAddVisible, setIsAddVisible] = useState(false);
  const onClickAdd = () => setIsAddVisible(true);

  const absences = api.students.absences.listUnexcused.useQuery();

  if (absences.isPending) {
    return (
      <Card>
        <ActivityIndicator />
      </Card>
    );
  }

  if (absences.isError) {
    return (
      <Card>
        <Text>Error: {absences.error.message}</Text>
      </Card>
    );
  }

  return (
    <Card
      style={{
        paddingVertical: 16,
      }}
    >
      <View className="flex-row items-center justify-between">
        <Text
          variant="heading"
          style={{
            fontSize: 20,
          }}
        >
          Fehlzeiten
        </Text>
        <IconButton
          onPress={onClickAdd}
          icon="add"
          size={28}
          color={colors.primary.text}
        />
      </View>
      <View className="h-2" />

      {absences.data.length === 0 ? (
        <NoAbsences />
      ) : (
        <UnexcusedAbsences absences={absences.data} />
      )}

      <View className="h-4" />

      <Link href="/absences" asChild>
        <Button label="Alle ansehen" className="self-end" />
      </Link>

      <PortaledBottomSheet onClose={() => setIsAddVisible(false)}>
        {isAddVisible && <AddAbsence onClose={() => setIsAddVisible(false)} />}
      </PortaledBottomSheet>
    </Card>
  );
};

const NoAbsences = () => {
  return (
    <View className="flex-row">
      <BigCheck width={40} />

      <View className="w-4" />

      <View className="flex-1">
        <Text className="opacity-80">
          Super! All deine Fehlzeiten sind entschuldigt!
        </Text>

        <View className="h-2" />

        <Text className="opacity-80">
          Wirst du heute oder morgen fehlen? Dann trage es am besten direkt hier
          ein.
        </Text>
      </View>
    </View>
  );
};

const UnexcusedAbsences = ({ absences }: { absences: AbsenceDay[] }) => {
  const numberOfDays = new Set(
    absences.map((absence) => formatDate(absence.date, "yyyy-MM-dd")),
  ).size;

  return (
    <View className="flex-row">
      <Warning width={40} height={50} />

      <View className="w-4" />

      <View className="flex-1">
        <Text className="opacity-80">
          Du hast noch <Text weight="bold">{absences.length}</Text>{" "}
          unentschuldigte Fehlzeiten an{" "}
          <Text weight="bold">{numberOfDays}</Text>{" "}
          {numberOfDays === 1 ? "Tag" : "Tagen"}.
        </Text>
      </View>
    </View>
  );
};
