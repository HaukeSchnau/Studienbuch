interface SelectEntry<T> {
  label: string;
  value: T;
  id: string;
}

interface SelectFieldProps<T> {
  label: string;
  emptyLabel: string;
  valueId?: string;
  onChange: (value: T) => void;
  options: SelectEntry<T>[];
}

export function SelectField<T>({
  label,
  emptyLabel,
  valueId,
  onChange,
  options,
}: SelectFieldProps<T>) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm">{label}</label>
      <select
        className="mb-1 mt-2 w-full cursor-pointer border-b-2 border-darkgrey bg-black-80 p-4 text-lg transition-all focus:border-blue focus:outline-none"
        value={valueId ?? ""}
        onChange={(e) =>
          onChange(
            options.find((option) => option.id === e.target.value)!.value,
          )
        }
      >
        {!valueId && <option value="">{emptyLabel}</option>}

        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
