import type { ZodSchema } from "zod";
import { useParams } from "next/navigation";

export const useSafeParams = <T>(schema: ZodSchema<T>) => {
  const params = useParams();
  return schema.parse(params);
};
