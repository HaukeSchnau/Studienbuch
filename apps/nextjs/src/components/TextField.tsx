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
        className="bg-black-80 border-darkgrey focus:border-blue mt-2 mb-1 w-full border-b-2 p-4 text-lg transition-all focus:outline-none"
        ref={ref}
        {...props}
      />
      {/* <span className={styles.errorMsg}>{usernameError}</span> */}
    </label>
  );
});
