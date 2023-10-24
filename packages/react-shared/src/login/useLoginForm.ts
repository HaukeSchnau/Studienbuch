import { useForm } from "react-hook-form";

export interface LoginForm {
  email: string;
  password: string;
}

export const useLoginForm = () => {
  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
    setError,
    clearErrors,
  } = useForm<LoginForm>({
    defaultValues: {
      email: "hauke@schnau-lilienthal.de",
      password: "kiara2705",
    },
  });

  return {
    register,
    handleSubmit,
    watch,
    errors,
    control,
    setError,
    clearErrors,
  };
};
