import { forwardRef } from "react";
import clsx from "clsx";

type TextFieldProps = {
  label: string;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>;

export const TextField = forwardRef(function TextField(
  { label, error, ...props }: TextFieldProps,
  ref: React.ForwardedRef<HTMLInputElement>,
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
      />
      <span>{error}</span>
    </label>
  );
});
