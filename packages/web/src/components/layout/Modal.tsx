import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

interface Props {
  open?: boolean;
  onClose: () => void;
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
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) {
          onClose();
        }
      }}
      onKeyDown={(e) => {
        if (e.target === ref.current && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClose();
        }
      }}
      className="rounded-3xl p-0 backdrop:bg-black-20 backdrop:backdrop-blur-sm backdrop:backdrop-filter"
    >
      <div className="p-8">{children}</div>
    </dialog>
  );
};

interface ModalWithDataProps<T> {
  data?: T | null;
  children: (data: T) => ReactNode;
  onClose: () => void;
}

export const ModalWithData = <T,>({ data, children, onClose }: ModalWithDataProps<T>) => {
  return (
    <Modal open={!!data} onClose={onClose}>
      {data && children(data)}
    </Modal>
  );
};
