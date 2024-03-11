import type { ComponentProps } from "react";

import { TextField } from "./TextField";

type NumberFieldProps = Omit<
  ComponentProps<typeof TextField>,
  "type" | "onChange"
> & {
  onChange: (value: number) => void;
};

export const NumberField = ({ onChange, ...rest }: NumberFieldProps) => {
  return (
    <TextField
      {...rest}
      type="number"
      onChange={(value) => onChange(Number(value))}
    />
  );
};
