import { View } from "react-native";
import { useMaskedInputProps } from "react-native-mask-input";
import { useRouter } from "expo-router";

import type { Falsy } from "@stu/lib";

import { Button } from "~/components/button";
import { Text } from "~/components/text";
import { TextField } from "~/components/text-field";
import { useAppForm } from "~/features/setup/form";
import { api } from "~/utils/api";
import { useStorage } from "~/utils/storage";

export default function LicenseKey() {
  const checkMutation = api.auth.checkLicenseKey.useMutation();
  const router = useRouter();
  const [licenseKey, setLicenseKey] = useStorage("auth.licenseKey");

  // const { form, handleSubmitStep } = useFormContext({
  //   step: 0,
  //   onSubmitStep: () => {
  //     router.push("/setup/name-and-year");
  //   },
  // });

  const form = useAppForm({
    defaultValues: {
      licenseKey: licenseKey ?? "",
    },
    onSubmit: async ({ value }) => {
      setLicenseKey(value.licenseKey);
      router.push("/setup/name-and-year");
    },
  });

  return (
    <View>
      <Text variant="heading" className="text-center">
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
        validators={{
          onChangeAsync: async ({ value }) => {
            const result = await checkMutation.mutateAsync({
              licenseKey: value,
            });
            return result === "VALID"
              ? undefined
              : "Ungültiger Lizenzschlüssel";
          },
          // onSubmitAsync: async ({ value }) => {
          //   const result = await checkMutation.mutateAsync({
          //     licenseKey: value,
          //   });
          //   return result === "VALID"
          //     ? undefined
          //     : "Ungültiger Lizenzschlüssel";
          // },
        }}
        children={(field) => (
          <LicenseKeyField
            value={field.state.value}
            setValue={field.setValue}
            error={
              field.state.meta.isTouched &&
              field.state.meta.errors.length &&
              field.state.meta.errors.join(", ")
            }
          />
        )}
      />
      <View className="h-6" />
      <Button
        label="Weiter"
        className="self-end"
        onPress={() => form.handleSubmit()}
      />
    </View>
  );
}

const LicenseKeyField = ({
  value,
  setValue,
  error,
}: {
  value: string;
  setValue: (value: string) => void;
  error?: string | Falsy;
}) => {
  const maskedInputProps = useMaskedInputProps({
    // prettier-ignore
    mask: [/\w/, /\w/, /\w/, /\w/, '-', /\w/, /\w/, /\w/, /\w/, '-', /\w/, /\w/, /\w/, /\w/, '-', /\w/, /\w/, /\w/, /\w/],
    value,
    onChangeText: (text) => setValue(text.toUpperCase()),
    placeholderFillCharacter: "X",
    maskAutoComplete: true,
  });

  return (
    <TextField
      label="Lizenzschlüssel"
      error={error}
      {...maskedInputProps}
      autoCorrect={false}
      autoComplete="off"
    />
  );
};
