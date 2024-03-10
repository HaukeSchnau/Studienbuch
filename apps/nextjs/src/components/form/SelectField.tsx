interface SelectFieldProps<T> {
  label: string;
  emptyLabel: string;
  valueId?: string | number;
  onChange: (value?: T) => void;
  getOptionLabel: (value: T) => string;
  getOptionId: (value: T) => string | number;
  options: T[];
}

export function SelectField<T>({
  label,
  emptyLabel,
  valueId,
  onChange,
  options,
  getOptionLabel,
  getOptionId,
}: SelectFieldProps<T>) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm">{label}</label>
      <select
        className="mb-1 mt-2 w-full cursor-pointer border-b border-darkgrey bg-black-80 p-4 text-lg transition-all focus:border-blue focus:outline-none"
        value={valueId ?? ""}
        onChange={(e) =>
          onChange(
            options.find(
              (option) => String(getOptionId(option)) === e.target.value,
            ),
          )
        }
      >
        {!valueId && <option value="">{emptyLabel}</option>}

        {options.map((option) => (
          <option key={getOptionId(option)} value={getOptionId(option)}>
            {getOptionLabel(option)}
          </option>
        ))}
      </select>
    </div>
  );
}
