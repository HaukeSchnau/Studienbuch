import { View } from "react-native";
import { useMaskedInputProps } from "react-native-mask-input";
import { Link } from "expo-router";

import { Button } from "~/components/button";
import { Text } from "~/components/text";
import { TextField } from "~/components/text-field";
import { useFormContext } from "./form";

export default function LicenseKey() {
  const form = useFormContext();

  return (
    <View>
      <Text weight="bold" className="text-center text-3xl text-primary-text">
        Willkommen!
      </Text>
      <View className="h-4" />
      <Text>
        Bitte gib zunächst deinen Lizenzschlüssel ein, um fortzufahren und die
        App zu aktivieren. Du hast deinen Lizenzschlüssel von deiner Lehrkraft
        erhalten.
      </Text>
      <View className="h-6" />
      <form.Field
        name="licenseKey"
        children={(field) => (
          <LicenseKeyField
            value={field.state.value}
            setValue={field.setValue}
          />
        )}
      />
      <View className="h-6" />
      <Link href="/setup/name-and-year" asChild>
        <Button
          label="Weiter"
          onPress={() => console.log(form.state.values.licenseKey)}
          className="self-end"
        />
      </Link>
    </View>
  );
}

const LicenseKeyField = ({
  value,
  setValue,
}: {
  value: string;
  setValue: (value: string) => void;
}) => {
  const maskedInputProps = useMaskedInputProps({
    // prettier-ignore
    mask: [/\w/, /\w/, /\w/, /\w/, '-', /\w/, /\w/, /\w/, /\w/, '-', /\w/, /\w/, /\w/, /\w/, '-', /\w/, /\w/, /\w/, /\w/],
    value,
    onChangeText: (text) => setValue(text.toUpperCase()),
    placeholderFillCharacter: "X",
    maskAutoComplete: true,
  });

  return <TextField label="Lizenzschlüssel" {...maskedInputProps} />;
};
