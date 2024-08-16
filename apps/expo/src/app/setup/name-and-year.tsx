import { View } from "react-native";

import { formatYear } from "@schnau/lib";

import { SelectField } from "~/components/select-field";
import { Text } from "~/components/text";
import { TextField } from "~/components/text-field";
import { api } from "~/utils/api";
import { useFormContext } from "./form";

export default function NameAndYear() {
  const form = useFormContext();
  const years = api.years.list.useQuery({ activeOnly: true });

  console.log(years);

  return (
    <View>
      <Text weight="bold" className="text-center text-3xl text-primary-text">
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
    </View>
  );
}
