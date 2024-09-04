import { View } from "react-native";
import { router } from "expo-router";
import { z } from "zod";

import { formatYear } from "@stu/lib";

import { Button } from "~/components/button";
import { CheckboxRow } from "~/components/checkbox-row";
import { SelectField } from "~/components/select-field";
import { Text } from "~/components/text";
import { TextField } from "~/components/text-field";
import { api } from "~/utils/api";
import { useFormContext } from "./form";

export default function NameAndYear() {
  const { form, handleSubmitStep } = useFormContext({
    step: 1,
    onSubmitStep: () => router.push("/setup/class-and-courses"),
  });
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
        validators={{
          onSubmit: z.string().min(2, "Bitte gib deinen Namen an"),
        }}
        children={(field) => (
          <TextField
            label="Name"
            value={field.state.value}
            onChangeText={field.setValue}
            error={
              field.state.meta.isTouched &&
              field.state.meta.errors.length &&
              field.state.meta.errors.join(", ")
            }
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
              getKey={(year) => year.startYear}
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

      <Button label="Weiter" className="self-end" onPress={handleSubmitStep} />
    </View>
  );
}
