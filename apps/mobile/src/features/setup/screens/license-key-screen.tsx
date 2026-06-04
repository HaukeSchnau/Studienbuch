import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useMaskedInputProps } from "react-native-mask-input";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { TextField } from "~/components/fields/text-field";
import { useSessionData } from "~/data/hooks";
import { setupNameAndYearRoute } from "~/routing/params";

export function LicenseKeyScreen() {
  const { user, updateProfile } = useSessionData();
  const [licenseKey, setLicenseKey] = useState(user.licenseKey);
  const maskedInputProps = useMaskedInputProps({
    mask: [
      /\w/,
      /\w/,
      /\w/,
      /\w/,
      "-",
      /\w/,
      /\w/,
      /\w/,
      /\w/,
      "-",
      /\w/,
      /\w/,
      /\w/,
      /\w/,
      "-",
      /\w/,
      /\w/,
      /\w/,
      /\w/,
    ],
    value: licenseKey,
    onChangeText: (text) => setLicenseKey(text.toUpperCase()),
    placeholderFillCharacter: "X",
    maskAutoComplete: true,
  });

  return (
    <View>
      <Text variant="heading" className="text-center">
        Willkommen!
      </Text>
      <View className="h-4" />
      <Text>
        Bitte gib zunächst deinen Lizenzschlüssel ein, um fortzufahren und die App zu aktivieren.
      </Text>
      <View className="h-6" />
      <TextField
        label="Lizenzschlüssel"
        {...maskedInputProps}
        autoCorrect={false}
        autoComplete="off"
      />
      <View className="h-6" />
      <Button
        label="Weiter"
        className="self-end"
        onPress={() => {
          updateProfile({ licenseKey });
          router.push(setupNameAndYearRoute);
        }}
      />
    </View>
  );
}
