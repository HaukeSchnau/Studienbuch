import type { ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";

type ButtonProps = {
  children: ReactNode;
  className?: string;
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

export function Button({ children, className, ...props }: ButtonProps) {
  const classes = clsx(
    "rounded-3xl border-b-4 border-t-4 border-b-blue-sec border-t-blue bg-blue px-8 py-4 font-bold uppercase text-white transition-all hover:border-t-blue-sec hover:bg-blue-sec",
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

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classes}
    >
      {children}
    </button>
  );
}
