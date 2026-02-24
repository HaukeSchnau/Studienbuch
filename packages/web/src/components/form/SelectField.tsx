type SelectFieldProps<TOption, TGroup> = {
  label?: string;
  emptyLabel: string;
  valueId?: string | number;
  onChange: (value?: NoInfer<TOption>) => void;
  getOptionLabel: (value: TOption) => string;
  getOptionId: (value: TOption) => string | number;
  error?: string;
  allowEmpty?: boolean;
} & (
  | {
      options: readonly TOption[];
      groups?: never;
      getGroupLabel?: never;
      getGroupId?: never;
    }
  | {
      groups: Map<TGroup, readonly TOption[]>;
      getGroupLabel: (group: TGroup) => string;
      getGroupId: (group: TGroup) => string | number;
      options?: never;
    }
);

const EMPTY_VALUE = "__RESERVED_EMPTY_VALUE__";

export function SelectField<TOption, TGroup = unknown>({
  label,
  emptyLabel,
  valueId,
  onChange,
  getOptionLabel,
  getOptionId,
  error,
  allowEmpty,
  options,
  groups,
  getGroupLabel,
  getGroupId,
}: SelectFieldProps<TOption, TGroup>) {
  const allOptions = options ?? Array.from(groups.values()).flat();

  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm">{label}</label>}
      <select
        className="border-darkgrey mb-1 mt-2 w-full cursor-pointer border-b bg-black-80 p-4 text-lg transition-all focus:border-accent focus:outline-none"
        value={valueId ?? ""}
        onChange={(e) =>
          onChange(
            EMPTY_VALUE === e.target.value
              ? undefined
              : allOptions.find((option) => String(getOptionId(option)) === e.target.value),
          )
        }
      >
        {(!valueId || allowEmpty) && <option value={EMPTY_VALUE}>{emptyLabel}</option>}

        {options
          ? options.map((option) => (
              <option key={getOptionId(option)} value={getOptionId(option)}>
                {getOptionLabel(option)}
              </option>
            ))
          : Array.from(groups.entries()).map(([group, options]) => (
              <optgroup key={getGroupId(group)} label={getGroupLabel(group)}>
                {options.map((option) => (
                  <option key={getOptionId(option)} value={getOptionId(option)}>
                    {getOptionLabel(option)}
                  </option>
                ))}
              </optgroup>
            ))}
      </select>

      {error && <div className="text-danger">{error}</div>}
    </div>
  );
}
