"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import type { School } from "@schnau/lib/src/school";

import { Button } from "~/components/form/Button";
import { SelectField } from "~/components/form/SelectField";
import { TextField } from "~/components/form/TextField";
import { Card } from "~/components/layout/Card";
import { LoadingIndicator } from "~/components/layout/LoadingIndicator";
import { PageHeading } from "~/components/layout/PageHeading";
import { api } from "~/infrastructure/trpc/react";

interface NewYearForm {
  name: string;
  school: School;
  startYear: number;
  numberOfYears: number;
}

export default function NewYearPage() {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<NewYearForm>({
    resolver: zodResolver(
      z.object({
        name: z.string().min(1, "Name darf nicht leer sein"),
        school: z.object({
          id: z.number(),
          name: z.string(),
        }),
        startYear: z.coerce
          .number()
          .min(2000, "Startjahr muss nach 2000 liegen"),
        numberOfYears: z.coerce.number(),
      }),
    ),
  });

  const router = useRouter();

  const schools = api.schools.list.useQuery();
  const addYear = api.years.add.useMutation({
    onSuccess: () => router.push("/admin/years"),
  });

  const onSubmit = handleSubmit(async (data) => {
    addYear.mutate({
      name: data.name,
      startYear: data.startYear,
      graduationYear: data.startYear + data.numberOfYears,
      schoolId: data.school.id,
    });
  });

  return (
    <div>
      <PageHeading color="white">Neuer Jahrgang</PageHeading>

      <div className="h-4" />

      <Card>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
              name="school"
              control={control}
              render={({ field }) => (
                <SelectField
                  label="Schule"
                  emptyLabel="Keine Schule ausgewählt"
                  valueId={field.value?.id}
                  options={schools.data}
                  getOptionLabel={(school) => school.name}
                  getOptionId={(school) => school.id}
                  onChange={(school) => field.onChange(school)}
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
            defaultValue={9}
          />

          <Button
            type="submit"
            className="self-end"
            disabled={addYear.isPending}
          >
            {addYear.isPending ? <LoadingIndicator /> : "Speichern"}
          </Button>

          {addYear.isError && (
            <div className="text-red">{addYear.error.message}</div>
          )}
        </form>
      </Card>
    </div>
  );
}
