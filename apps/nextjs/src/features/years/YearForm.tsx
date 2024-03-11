import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import type { Year } from "@schnau/lib/src/year";

import { Button } from "~/components/form/Button";
import { SelectField } from "~/components/form/SelectField";
import { TextField } from "~/components/form/TextField";
import { LoadingIndicator } from "~/components/layout/LoadingIndicator";
import { api } from "~/infrastructure/trpc/react";

interface YearFormValues {
  name: string;
  schoolId: number;
  startYear: number;
  numberOfYears: number;
}

interface Props {
  defaultYear?: Year & { schoolId: number };
  onSubmit: (data: YearFormValues) => void;
  error?: string;
  isPending?: boolean;
}

export const YearForm = ({
  onSubmit,
  defaultYear,
  error,
  isPending,
}: Props) => {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<YearFormValues>({
    defaultValues: {
      name: defaultYear?.name,
      schoolId: defaultYear?.schoolId,
      startYear: defaultYear?.startYear,
      numberOfYears: defaultYear
        ? defaultYear.graduationYear - defaultYear.startYear
        : 9,
    },
    resolver: zodResolver(
      z.object({
        name: z.string().min(1, "Name darf nicht leer sein"),
        schoolId: z.number().int("Schule muss ausgewählt sein"),
        startYear: z.coerce
          .number()
          .min(2000, "Startjahr muss nach 2000 liegen"),
        numberOfYears: z.coerce.number(),
      }),
    ),
  });

  const schools = api.schools.list.useQuery();

  const submitHandler = handleSubmit(onSubmit);

  return (
    <form onSubmit={submitHandler} className="flex flex-col gap-4">
      <TextField
        label="Name"
        {...register("name", { required: true })}
        error={errors.name?.message}
      />

      {schools.isPending ? (
        <LoadingIndicator />
      ) : schools.isError ? (
        <div>{schools.error.message}</div>
      ) : (
        <Controller
          name="schoolId"
          control={control}
          render={({ field }) => (
            <SelectField
              label="Schule"
              emptyLabel="Keine Schule ausgewählt"
              valueId={field.value}
              options={schools.data}
              getOptionLabel={(school) => school.name}
              getOptionId={(school) => school.id}
              onChange={(school) => field.onChange(school?.id)}
            />
          )}
        />
      )}

      <TextField
        label="Startjahr"
        type="number"
        {...register("startYear")}
        error={errors.startYear?.message}
      />

      <TextField
        label="Anzahl Jahre"
        type="number"
        {...register("numberOfYears")}
        error={errors.numberOfYears?.message}
      />

      <Button type="submit" className="self-end" disabled={isPending}>
        {isPending ? <LoadingIndicator /> : "Speichern"}
      </Button>

      {error && <div className="text-red">{error}</div>}
    </form>
  );
};
