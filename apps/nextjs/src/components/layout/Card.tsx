import clsx from "clsx";
import type { Route } from "next";
import Link from "next/link";

interface CardProps<TUrl extends string> {
  children: React.ReactNode;
  noPadding?: boolean;
  className?: string | boolean;
  href?: Route<TUrl>;
}

export const Card = <TUrl extends string>({
  children,
  className,
  noPadding,
  href,
}: CardProps<TUrl>) => {
  const classes = clsx("rounded-3xl bg-white shadow-md", className, {
    "p-8": !noPadding,
  });

  if (href)
    return (
      <Link
        href={href}
        className={clsx(
          classes,
          "transition-all hover:-rotate-3 hover:scale-110",
        )}
      >
        {children}
      </Link>
    );

  return <div className={classes}>{children}</div>;
};

interface CardHeadingProps {
  children: React.ReactNode;
}

export const CardHeading = ({ children }: CardHeadingProps) => {
  return <h2 className="mb-4 text-2xl font-bold text-primary">{children}</h2>;
};
