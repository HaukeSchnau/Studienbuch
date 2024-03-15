interface SelectFieldProps<T> {
  label: string;
  emptyLabel: string;
  valueId?: string | number;
  onChange: (value?: T) => void;
  getOptionLabel: (value: T) => string;
  getOptionId: (value: T) => string | number;
  options: T[];
  error?: string;
  allowEmpty?: boolean;
}

const EMPTY_VALUE = "__RESERVED_EMPTY_VALUE__";

export function SelectField<T>({
  label,
  emptyLabel,
  valueId,
  onChange,
  options,
  getOptionLabel,
  getOptionId,
  error,
  allowEmpty,
}: SelectFieldProps<T>) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm">{label}</label>
      <select
        className="mb-1 mt-2 w-full cursor-pointer border-b border-darkgrey bg-black-80 p-4 text-lg transition-all focus:border-blue focus:outline-none"
        value={valueId ?? ""}
        onChange={(e) =>
          onChange(
            EMPTY_VALUE === e.target.value
              ? undefined
              : options.find(
                  (option) => String(getOptionId(option)) === e.target.value,
                ),
          )
        }
      >
        {(!valueId || allowEmpty) && (
          <option value={EMPTY_VALUE}>{emptyLabel}</option>
        )}

        {options.map((option) => (
          <option key={getOptionId(option)} value={getOptionId(option)}>
            {getOptionLabel(option)}
          </option>
        ))}
      </select>

      {error && <div className="text-red">{error}</div>}
    </div>
  );
}
