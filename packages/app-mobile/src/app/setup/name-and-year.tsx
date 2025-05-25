import { ActivityIndicator, View } from "react-native";
import { z } from "zod";

import { formatClassName, formatYear, isArraySingleElement } from "@stu/lib";

import type { Class, SchoolId, StateCode, Year } from "@stu/lib";
import * as t from "@stu/student/schema";
import { pk } from "@stu/student/schema";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Button } from "~/components/button";
import { CheckboxRow } from "~/components/checkbox-row";
import { SelectField } from "~/components/select-field";
import { TempError } from "~/components/temp-error";
import { Text } from "~/components/text";
import { TextField } from "~/components/text-field";
import { db } from "~/db/client";
import { currentStudent } from "~/db/queries/user";
import { useAppForm } from "~/features/setup/form";
import { api } from "~/utils/api";
import { useSession } from "~/utils/auth";
import { ingest } from "~/utils/events/ingest";
import { router } from "expo-router";

const bootstrap = async ({
  school,
  year,
  classIdentifier,
}: {
  school: { id: SchoolId; name: string; stateCode: StateCode };
  year: { name: string; graduationYear: number; startYear: number };
  classIdentifier: string;
}) => {
  await db
    .insert(t.schools)
    .values({
      id: school.id,
      name: school.name,
      stateCode: school.stateCode,
    })
    .onConflictDoUpdate({
      target: pk(t.schools),
      set: {
        name: school.name,
        stateCode: school.stateCode,
      },
    });
  await db
    .insert(t.years)
    .values({
      name: year.name,
      graduationYear: year.graduationYear,
      startYear: year.startYear,
      school: school.id,
    })
    .onConflictDoUpdate({
      target: pk(t.years),
      set: {
        name: year.name,
        graduationYear: year.graduationYear,
      },
    });
  await db
    .insert(t.classes)
    .values({
      identifierInYear: classIdentifier,
      startYear: year.startYear,
      school: school.id,
    })
    .onConflictDoNothing();
};

export default function NameAndYear() {
  const years = api.schools.years.list.useQuery({ activeOnly: true });
  const currentUser = useQuery(currentStudent());
  const session = useSession();
  const queryClient = useQueryClient();

  const form = useAppForm({
    defaultValues: {
      name: currentUser.data
        ? `${currentUser.data.person.firstName} ${currentUser.data.person.lastName}`
        : "",
      isOfAge: currentUser.data?.isOfAge ?? false,
      year: currentUser.data?.year,
      class: currentUser.data?.class,
    },
    onSubmit: async ({ value }) => {
      if (!value.class || !value.year) {
        console.error("No class or year");
        return; // TODO: show error
      }

      if (!session) {
        throw new Error("No session in name and year form");
      }

      await bootstrap({
        school: {
          id: value.year.school,
          name: "IGS Lilienthal",
          stateCode: "NI",
        },
        year: value.year,
        classIdentifier: value.class.identifierInYear,
      });

      await ingest("student.joined", session.userId, {
        class: {
          identifier: value.class.identifierInYear,
          startYear: value.class.startYear,
        },
        isOfAge: value.isOfAge,
        name: value.name,
        school: "igs-lil",
        studentId: session.userId,
      });

      await queryClient.invalidateQueries();

      router.push("/setup/class-and-courses");
    },
  });

  return (
    <View>
      <Text variant="heading" className="text-center">
        Willkommen!
      </Text>
      <View className="h-4" />
      <Text>Bitte gib deinen Namen und deinen Jahrgang an.</Text>

      <View className="h-6" />

      <form.Field
        name="name"
        validators={{
          onSubmit: z.string().min(2, "Bitte gib deinen Namen an"),
        }}
        children={(field) => (
          <TextField
            label="Name"
            value={field.state.value}
            onChangeText={field.setValue}
            autoCorrect={false}
            error={
              field.state.meta.isTouched &&
              field.state.meta.errors.length &&
              // eslint-disable-next-line @typescript-eslint/no-base-to-string -- TODO: fix
              field.state.meta.errors.join(", ")
            }
          />
        )}
      />

      <View className="h-6" />

      {years.data && (
        <form.Field
          name="year"
          children={(field) => (
            <SelectField
              label="Jahrgang"
              value={field.state.value}
              onChange={field.setValue}
              options={years.data}
              getOptionLabel={formatYear}
              getKey={(year) => year.startYear}
            />
          )}
        />
      )}

      <View className="h-6" />

      <form.Subscribe
        selector={(state) => state.values.year}
        children={(year) =>
          year && (
            <form.Field
              name="class"
              children={(field) => (
                <ClassField
                  selectedYear={year}
                  value={field.state.value}
                  onChange={field.handleChange}
                />
              )}
            />
          )
        }
      />

      <form.Field
        name="isOfAge"
        children={(field) => (
          <CheckboxRow
            label="Ich bin volljährig"
            value={field.state.value}
            onChange={field.setValue}
          />
        )}
      />

      <View className="h-6" />

      <Button
        label="Weiter"
        className="self-end"
        onPress={() => form.handleSubmit()}
      />
    </View>
  );
}

const ClassField = ({
  selectedYear,
  value,
  onChange,
}: {
  selectedYear: Year;
  value: Class | undefined;
  onChange: (value: Class | undefined) => void;
}) => {
  const classes = api.schools.classes.list.useQuery({
    school: "igs-lil",
    startYear: selectedYear.startYear,
  });

  useEffect(() => {
    if (classes.data && isArraySingleElement(classes.data)) {
      onChange(classes.data[0]);
    }
  }, [classes.data, onChange]);

  if (classes.isError) {
    return <TempError error={classes.error.message} />;
  }

  if (classes.isPending) {
    return <ActivityIndicator />;
  }

  if (isArraySingleElement(classes.data)) {
    return null;
  }

  return (
    <>
      <SelectField
        options={classes.data}
        label="Klasse"
        getKey={(item) => item.identifierInYear}
        getOptionLabel={(item) => formatClassName(item, selectedYear)}
        onChange={onChange}
        value={value}
      />
      <View className="h-6" />
    </>
  );
};
