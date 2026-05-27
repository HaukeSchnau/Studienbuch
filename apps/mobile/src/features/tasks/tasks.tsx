import { View } from "react-native";
import { Card } from "~/components/card";
import { Text } from "~/components/text";

export const Tasks = () => {
  return (
    <View className="px-8 pb-8">
      <Card>
        <Text variant="heading" style={{ fontSize: 20 }}>
          Aufgaben
        </Text>
        <View className="h-2" />
        <Text className="opacity-70">
          Die Aufgabenansicht folgt im nächsten Schritt zusammen mit der echten Datenlogik.
        </Text>
      </Card>
    </View>
  );
};
