import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

interface Props {
  open?: boolean;
  onClose?: () => void;
  children?: ReactNode;
}

export const Modal = ({ open, onClose, children }: Props) => {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) {
      ref.current?.showModal();
    } else {
      ref.current?.close();
    }
  }, [open]);

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) {
          onClose?.();
        }
      }}
      className="rounded-3xl p-0 backdrop:bg-black-20"
    >
      <div className="p-4">{children}</div>
    </dialog>
  );
};
