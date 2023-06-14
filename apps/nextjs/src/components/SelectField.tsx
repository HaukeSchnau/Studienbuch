import { useEffect, useState } from "react";

import { type Year } from "@acme/db";

import { api } from "~/utils/api";

type SelectEntry<T> = {
  label: string;
  value: T;
  id: string;
};

type SelectFieldProps<T> = {
  label: string;
  value: SelectEntry<T>;
  onChange: (value?: T) => void;
  options: SelectEntry<T>[];
};

export default function SelectField<T>({
  label,
  value,
  onChange,
  options,
}: SelectFieldProps<T>) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-gray-500">{label}</label>
      <select
        className="rounded-md border border-gray-200 px-2 py-1 text-sm"
        value={value.id}
        onChange={(e) =>
          onChange(
            options.find((option) => option.id === e.target.value)?.value,
          )
        }
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

type YearSelectFieldProps = {
  value?: Omit<Year, "createdAt">;
  onChange: (value?: Omit<Year, "createdAt">) => void;
};

export const YearSelectField: React.FC<YearSelectFieldProps> = ({
  value,
  onChange,
}) => {
  const years = api.years.get.useQuery();

  useEffect(() => {
    if (years.data && !value) {
      onChange(years.data[0]);
    }
  }, [years.data, value, onChange]);

  if (!years.data) return null;

  return (
    <SelectField
      label="Jahr"
      options={years.data?.map((year) => ({
        label: year.name,
        value: year,
        id: year.name,
      }))}
      value={{
        label: value?.name ?? "Kein Jahr ausgewählt",
        value: value,
        id: value?.name ?? "Kein Jahr ausgewählt",
      }}
      onChange={(year) => year && onChange(year)}
    />
  );
};
