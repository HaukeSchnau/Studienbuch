import Icon from "@expo/vector-icons/MaterialIcons";
import clsx from "clsx";
import { View } from "react-native";

import { colors } from "@stu/tailwind-config/native";

import Cross from "../../assets/cross.svg";
import { Text } from "./text";

const SingleConfirmationStatus = ({
  confirmed,
  confirmedText,
}: {
  confirmed: boolean;
  confirmedText: string;
}) => {
  return (
    <View className="flex-row items-center gap-1">
      {confirmed ? (
        <Icon name="verified" size={24} color={colors.primary.text} />
      ) : (
        <Cross color={colors.danger.DEFAULT} />
      )}
      <Text className={clsx(confirmed ? "text-primary-text" : "text-danger")}>{confirmedText}</Text>
    </View>
  );
};

export const ConfirmationStatus = ({
  parent,
  teacher,
  isOfAge,
  order,
  confirmedText = "Bestätigt",
}: {
  parent: boolean;
  teacher: boolean;
  isOfAge: boolean;
  order: "parentTeacher" | "teacherParent";
  confirmedText?: string;
}) => {
  if (parent && teacher) {
    return <SingleConfirmationStatus confirmed confirmedText={confirmedText} />;
  }

  if (isOfAge) {
    return <SingleConfirmationStatus confirmed={teacher} confirmedText="Lehrer" />;
  }

  if (order === "parentTeacher") {
    return (
      <View className="flex-row gap-2">
        <SingleConfirmationStatus confirmed={parent} confirmedText="Eltern" />
        <SingleConfirmationStatus confirmed={teacher} confirmedText="Lehrer" />
      </View>
    );
  } else {
    return (
      <View className="flex-row gap-2">
        <SingleConfirmationStatus confirmed={teacher} confirmedText="Lehrer" />
        <SingleConfirmationStatus confirmed={parent} confirmedText="Eltern" />
      </View>
    );
  }
};
