import React, { useMemo } from "react";

import { SelectView } from "@stu/expo-native-modules";

import { Button } from "./button";
import { Text } from "./text";

interface Props<TOption> {
  label: string;
  value: TOption;
  getOptionLabel: (option: TOption) => string;
  getKey: (option: TOption) => string;
  options: TOption[];
  onChange: (value: TOption) => void;
}

export const DropdownSelect = <TOption,>({
  getKey,
  getOptionLabel,
  label,
  value,
  onChange,
  options,
}: Props<TOption>) => {
  return <SelectView name={label} />;
};
