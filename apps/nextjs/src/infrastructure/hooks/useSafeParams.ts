import { useParams } from "next/navigation";
import type { ZodSchema } from "zod";

export const useParsedParams = <T>(schema: ZodSchema<T>) => {
  const params = useParams();
  return schema.parse(params);
};

export const useSafeParams = <T>(schema: ZodSchema<T>): Partial<T> => {
  const params = useParams();
  const result = schema.safeParse(params);
  if (!result.success) {
    return {};
  }

  return result.data;
};
