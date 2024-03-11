import type { ForwardedRef, InputHTMLAttributes } from "react";
import { forwardRef } from "react";
import clsx from "clsx";

type TextFieldProps = {
  label: string;
  error?: string;
  onChange: (value: string) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "onChange">;

export const TextField = forwardRef(function TextField(
  { label, error, onChange, ...props }: TextFieldProps,
  ref: ForwardedRef<HTMLInputElement>,
) {
  return (
    <label
      className={clsx({
        "text-red": error,
        "shake-horizontal": error,
      })}
    >
      {label}
      <input
        className={clsx(
          "mb-1 mt-2 w-full border-b bg-black-80 p-4 text-lg transition-all focus:border-blue focus:outline-none",
          error ? "border-red" : "border-darkgrey",
        )}
        ref={ref}
        {...props}
        onChange={(e) => onChange(e.target.value)}
      />
      <span>{error}</span>
    </label>
  );
});
