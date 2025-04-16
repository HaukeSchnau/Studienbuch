import { createFormHook, createFormHookContexts } from "@tanstack/react-form";
export const { fieldContext, formContext } = createFormHookContexts();
export const { useAppForm, withForm } = createFormHook({
  fieldComponents: {},
  formComponents: {},
  fieldContext,
  formContext,
});
