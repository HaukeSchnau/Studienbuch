import { useEffect, useState } from "react";
import clsx from "clsx";

interface TextFieldCellProps {
  value: string;
  updateData: (value: string) => void;
  isDirty: boolean;
}

export const TextFieldCell = ({
  value: initialValue,
  updateData,
  isDirty,
}: TextFieldCellProps) => {
  const [value, setValue] = useState(initialValue);

  const onBlur = () => {
    if (value === initialValue) return;
    updateData(value);
  };

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  return (
    <input
      type="text"
      value={value}
      onBlur={onBlur}
      onChange={(e) => setValue(e.target.value)}
      className={clsx("p-2", isDirty && "bg-yellow text-white")}
      style={{
        width: `max(100%, ${value.length}ch)`,
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
    />
  );
};

interface SelectCellProps<TValues extends string> {
  value: TValues;
  values: TValues[];
  updateData: (value: TValues) => void;
  getLabel?: (value: TValues) => string;
  isDirty: boolean;
}

export const SelectCell = <TValues extends string>({
  value: initialValue,
  values,
  updateData,
  getLabel = (value) => value,
  isDirty,
}: SelectCellProps<TValues>) => {
  const [value, setValue] = useState(initialValue);

  const onBlur = () => {
    if (value === initialValue) return;
    updateData(value);
  };

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  return (
    <select
      value={value}
      onBlur={onBlur}
      onChange={(e) => setValue(e.target.value as TValues)}
      className={clsx("w-min p-2", isDirty && "bg-yellow text-white")}
    >
      {values.map((value) => (
        <option key={value} value={value}>
          {getLabel(value)}
        </option>
      ))}
    </select>
  );
};
