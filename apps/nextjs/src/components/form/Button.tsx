import type { ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";

type ButtonProps = {
  children: ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "yellow" | "danger";
} & (
  | {
      href: string;
    }
  | {
      onClick?: () => void;
      type?: "button" | "submit" | "reset";
      disabled?: boolean;
    }
);

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  const classes = clsx(
    "rounded-3xl border-b-4 border-t-4 px-8 py-4 font-bold uppercase transition-all ",
    variant === "primary" &&
      "border-b-blue-sec border-t-blue bg-blue hover:border-t-blue-sec hover:bg-blue-sec text-white",
    variant === "secondary" && "border-transparent hover:bg-grey text-darkgrey",
    variant === "yellow" &&
      "border-b-yellow-sec border-t-yellow bg-yellow hover:border-t-yellow-sec hover:bg-yellow-sec text-white",
    variant === "danger" &&
      "border-b-red-sec border-t-red bg-red hover:border-t-red-sec hover:bg-red-sec text-white",
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
