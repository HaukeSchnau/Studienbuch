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
        "text-error": error,
        "shake-horizontal": error,
      })}
    >
      {label}
      <input
        className="mb-1 mt-2 w-full border-b border-darkgrey bg-black-80 p-4 text-lg transition-all focus:border-blue focus:outline-none"
        ref={ref}
        {...props}
      />
      <span className="text-error">{error}</span>
    </label>
  );
});
