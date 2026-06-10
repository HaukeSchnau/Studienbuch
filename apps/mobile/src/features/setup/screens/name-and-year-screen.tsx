import { router } from "expo-router";
import type { Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { Button } from "~/components/ui/button";
import { CheckboxRow } from "~/components/fields/checkbox-row";
import { SelectField } from "~/components/fields/select-field";
import { Text } from "~/components/ui/text";
import { TextField } from "~/components/fields/text-field";
import { useSchool, useSessionData } from "~/data/hooks";
import { setupClassAndCoursesRoute } from "~/routing/params";

interface NameAndYearScreenProps {
  heading?: string;
  intro?: string;
  nextRoute?: Href;
}

export function NameAndYearScreen({
  heading = "Willkommen!",
  intro = "Bitte gib deinen Namen und deinen Jahrgang an.",
  nextRoute = setupClassAndCoursesRoute,
}: NameAndYearScreenProps) {
  const { user, updateProfile } = useSessionData();
  const { years, classes } = useSchool();
  const [name, setName] = useState(user.name);
  const [isOfAge, setIsOfAge] = useState(user.isOfAge);
  const [yearId, setYearId] = useState(user.yearId);
  const year = years.find((item) => item.id === yearId) ?? years[0]!;
  const classOptions = useMemo(
    () => classes.filter((item) => item.startYear === year.startYear),
    [classes, year],
  );
  const [classId, setClassId] = useState(user.classId);

  useEffect(() => {
    if (!classOptions.find((item) => item.id === classId)) {
      setClassId(classOptions[0]?.id ?? "");
    }
  }, [classId, classOptions]);

  return (
    <View>
      <Text variant="heading" className="text-center">
        {heading}
      </Text>
      <View className="h-4" />
      <Text>{intro}</Text>

      <View className="h-6" />

      <TextField label="Name" value={name} onChangeText={setName} autoCorrect={false} />

      <View className="h-6" />

      <SelectField
        label="Jahrgang"
        value={year}
        onChange={(value) => setYearId(value?.id ?? years[0]!.id)}
        options={years}
        getOptionLabel={(value) => value.name}
        getKey={(value) => value.id}
      />

      <View className="h-6" />

      <SelectField
        label="Klasse"
        value={classOptions.find((item) => item.id === classId)}
        onChange={(value) => setClassId(value?.id ?? classOptions[0]?.id ?? "")}
        options={classOptions}
        getOptionLabel={(value) => `${year.name} ${value.identifierInYear}`}
        getKey={(value) => value.id}
      />

      <View className="h-6" />

      <CheckboxRow label="Ich bin volljährig" value={isOfAge} onChange={setIsOfAge} />

      <View className="h-6" />

      <Button
        label="Weiter"
        className="self-end"
        onPress={() => {
          updateProfile({ name, isOfAge, yearId, classId });
          router.push(nextRoute);
        }}
      />
    </View>
  );
}
