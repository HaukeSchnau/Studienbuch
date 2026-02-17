import { type Class, formatClassName, formatYear, isArraySingleElement, type Year } from "@stu/lib";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { z } from "zod";
import { Button } from "~/components/button";
import { CheckboxRow } from "~/components/checkbox-row";
import { SelectField } from "~/components/select-field";
import { TempError } from "~/components/temp-error";
import { Text } from "~/components/text";
import { TextField } from "~/components/text-field";
import { currentStudent } from "~/db/queries/user";
import { useAppForm } from "~/features/setup/form";
import { api, getHeadersObject } from "~/utils/api";
import { useSession } from "~/utils/auth";
import { getBaseUrl } from "~/utils/base-url";
import { useIngest, useRuntime } from "~/utils/events/ingest";
import { hydrateSnapshotFromApi } from "~/utils/snapshot-recovery";

export default function NameAndYear() {
  const years = api.schools.years.list.useQuery({ activeOnly: true });
  const currentUser = useQuery(currentStudent());
  const session = useSession();
  const runtime = useRuntime();
  const queryClient = useQueryClient();
  const studentJoined = useIngest("student.joined");

  const form = useAppForm({
    defaultValues: {
      name: currentUser.data ? `${currentUser.data.person.firstName} ${currentUser.data.person.lastName}` : "",
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

      await studentJoined.mutateAsync({
        class: {
          identifier: value.class.identifierInYear,
          startYear: value.class.startYear,
        },
        isOfAge: value.isOfAge,
        name: value.name,
        school: "igs-lil",
        studentId: session.userId,
      });

      await runtime.runPromise(
        hydrateSnapshotFromApi({
          baseUrl: getBaseUrl(),
          headers: getHeadersObject(),
          request: {
            entities: [{ kind: "student", id: session.userId }],
          },
        }),
      );

      let student = await queryClient.fetchQuery(currentStudent());
      for (let attempt = 0; !student && attempt < 20; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        student = await queryClient.fetchQuery(currentStudent());
      }

      if (!student) {
        console.error("Student setup did not converge locally after join event");
        return;
      }

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
                <ClassField selectedYear={year} value={field.state.value} onChange={field.handleChange} />
              )}
            />
          )
        }
      />

      <form.Field
        name="isOfAge"
        children={(field) => (
          <CheckboxRow label="Ich bin volljährig" value={field.state.value} onChange={field.setValue} />
        )}
      />

      <View className="h-6" />

      <Button label="Weiter" className="self-end" onPress={() => form.handleSubmit()} />
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
