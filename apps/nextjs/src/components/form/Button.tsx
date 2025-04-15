import clsx from "clsx";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

type ButtonProps<TUrl extends string> = {
  children: ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "alert" | "danger";
} & (
  | {
      href: Route<TUrl>;
    }
  | {
      onClick?: () => void;
      type?: "button" | "submit" | "reset";
      disabled?: boolean;
    }
);

export function Button<TUrl extends string>({
  children,
  className,
  variant = "primary",
  ...props
}: ButtonProps<TUrl>) {
  const classes = clsx(
    "rounded-3xl border-b-4 border-t-4 px-8 py-4 font-bold uppercase transition-all",
    variant === "primary" &&
      "border-b-accent-sec border-t-accent bg-accent hover:border-t-accent-sec hover:bg-accent-sec text-on-accent",
    variant === "secondary" &&
      "border-transparent hover:bg-neutral-sec text-neutral",
    variant === "alert" &&
      "border-b-alert-sec border-t-alert bg-alert hover:border-t-alert-sec hover:bg-alert-sec text-white",
    variant === "danger" &&
      "border-b-danger-sec border-t-danger bg-danger hover:border-t-danger-sec hover:bg-danger-sec text-white",
    className,
  );

  if ("href" in props) {
    return (
      <Link href={props.href} className={classes}>
        {children}
      </Link>
    );
  }

  const { disabled, type, onClick } = props;
  const isDisabled = !!disabled || (type !== "submit" && !onClick);

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={clsx(classes, isDisabled && "cursor-not-allowed opacity-50")}
    >
      {children}
    </button>
  );
}
