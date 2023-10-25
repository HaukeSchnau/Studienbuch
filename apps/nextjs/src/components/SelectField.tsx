interface SelectEntry<T> {
  label: string;
  value: T;
  id: string;
}

interface SelectFieldProps<T> {
  label: string;
  value: SelectEntry<T>;
  onChange: (value?: T) => void;
  options: SelectEntry<T>[];
}

export default function SelectField<T>({
  label,
  value,
  onChange,
  options,
}: SelectFieldProps<T>) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm">{label}</label>
      <select
        className="mb-1 mt-2 w-full cursor-pointer border-b-2 border-darkgrey bg-black-80 p-4 text-lg transition-all focus:border-blue focus:outline-none"
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
