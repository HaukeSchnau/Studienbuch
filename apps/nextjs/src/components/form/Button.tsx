import clsx from "clsx";

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}

export function Button({
  children,
  onClick,
  className,
  disabled,
  type = "button",
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "hover:bg-blue-sec border-b-blue-sec hover:border-t-blue-sec rounded-3xl border-b-4 border-t-4 border-t-blue bg-blue px-8 py-4 font-bold uppercase text-white transition-all",
        className,
      )}
    >
      {children}
    </button>
  );
}
