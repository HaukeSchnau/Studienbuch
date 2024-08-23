import { View } from "react-native";
import { Link } from "expo-router";
import { formatYear } from "@stu/lib";

import { Button } from "~/components/button";
import { CheckboxRow } from "~/components/checkbox-row";
import { SelectField } from "~/components/select-field";
import { Text } from "~/components/text";
import { TextField } from "~/components/text-field";
import { api } from "~/utils/api";
import { useFormContext } from "./form";

export default function NameAndYear() {
  const form = useFormContext(1);
  const years = api.years.list.useQuery({ activeOnly: true });

  return (
    <View>
      <Text variant="heading" className="text-center">
        Willkommen!
      </Text>
      <View className="h-4" />
      <Text>Bitte gib deinen Namen und deinen Jahrgang an.</Text>

      <View className="h-6" />

      <form.Field
        name="name"
        children={(field) => (
          <TextField
            label="Name"
            value={field.state.value}
            onChangeText={field.setValue}
          />
        )}
      />

      <View className="h-6" />

      {years.data && (
        <form.Field
          name="year"
          children={(field) => (
            <SelectField
              label="Jahrgang"
              value={field.state.value}
              onChange={field.setValue}
              options={years.data}
              getOptionLabel={formatYear}
              getKey={(year) => year.id}
            />
          )}
        />
      )}

      <View className="h-6" />

      <form.Field
        name="isOfAge"
        children={(field) => (
          <CheckboxRow
            label="Ich bin volljährig"
            value={field.state.value}
            onChange={field.setValue}
          />
        )}
      />

      <View className="h-6" />

      <Link href="/setup/class-and-courses" asChild>
        <Button label="Weiter" className="self-end" />
      </Link>
    </View>
  );
}
