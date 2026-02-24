import type { FormEvent } from "react";

export const submitHandler = (handler: () => void | Promise<void>) => {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    void handler();
  };
};
