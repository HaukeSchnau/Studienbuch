import clsx from "clsx";
import type { ForwardedRef, InputHTMLAttributes } from "react";
import { forwardRef } from "react";

import type { IconName } from "../icon";
import { IconButton } from "./IconButton";

type TextFieldProps = {
  label: string;
  error?: string;
  onChange: (value: string) => void;
  actions?: {
    icon: IconName;
    onClick: () => void;
  }[];
} & Omit<InputHTMLAttributes<HTMLInputElement>, "onChange">;

export const TextField = forwardRef(function TextField(
  { label, error, onChange, actions, ...props }: TextFieldProps,
  ref: ForwardedRef<HTMLInputElement>,
) {
  return (
    <label
      className={clsx({
        "text-danger": error,
        "shake-horizontal": error,
      })}
    >
      {label}
      <div className="relative">
        <input
          className={clsx(
            "mb-1 mt-2 w-full border-b bg-black-80 p-4 text-lg transition-all focus:border-accent focus:outline-none",
            error ? "border-danger" : "border-darkgrey",
          )}
          ref={ref}
          {...props}
          onChange={(e) => onChange(e.target.value)}
        />
        {actions && (
          <div className="absolute right-0 top-1/2 flex -translate-y-1/2 transform items-center">
            {actions.map(({ icon, onClick }, i) => (
              <IconButton key={i} icon={icon} onClick={onClick} size="lg" />
            ))}
          </div>
        )}
      </div>
      <span>{error}</span>
    </label>
  );
});
