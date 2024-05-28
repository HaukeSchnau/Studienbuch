import { useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-form-adapter";
import { z } from "zod";

import type { Class, ProtoCourseWithTimes, Semester, Year } from "@schnau/lib";
import { formatClassName } from "@schnau/lib";

import { Button } from "~/components/form/Button";
import { SelectField } from "~/components/form/SelectField";
import { Modal } from "~/components/layout/Modal";
import { submitHandler } from "~/infrastructure/forms/submitHandler";
import { api } from "~/infrastructure/trpc/react";
import { SchedulePdfField } from "./SchedulePdfField";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  year: Year;
}

interface ImportFormValues {
  class?: Class;
  semester?: Semester;
  protoCourses: ProtoCourseWithTimes[];
}

const importFormSchema = z.object({
  class: z.object({ id: z.number() }),
  semester: z.object({ id: z.string() }),
});

export const ImportScheduleModal = ({ isOpen, onClose, year }: Props) => {
  const utils = api.useUtils();
  const {
    mutate: insertCourses,
    isPending,
    isError,
    error,
  } = api.courses.addCourses.useMutation({
    onSuccess: async () => {
      await utils.courses.list.invalidate({ yearId: year.id });
      onClose();
    },
  });

  const { data: classes } = api.classes.list.useQuery({ yearId: year.id });

  const { Field, handleSubmit, Subscribe } = useForm<
    ImportFormValues,
    typeof zodValidator
  >({
    defaultValues: {
      protoCourses: [],
    },
    validatorAdapter: zodValidator,
    validators: {
      onChange: importFormSchema,
    },
    onSubmit: ({ value }) => {
      const { class: clazz, semester } = importFormSchema.parse(value);

      insertCourses({
        courses: value.protoCourses,
        semesterId: semester.id,
        classId: clazz.id,
      });
    },
  });

  return (
    <Modal open={isOpen} onClose={onClose}>
      <form
        className="flex flex-col gap-4 p-4"
        onSubmit={submitHandler(handleSubmit)}
      >
        <h2 className="text-2xl font-bold">Stundenplan importieren</h2>
        <Field name="protoCourses">
          {(field) => (
            <SchedulePdfField
              protoCourses={field.getValue()}
              onChange={field.handleChange}
            />
          )}
        </Field>

        <Field name="class">
          {(field) =>
            classes && (
              <SelectField
                label="Klasse"
                options={classes}
                emptyLabel="Klasse auswählen"
                getOptionId={(option) => option.id}
                getOptionLabel={(option) => formatClassName(option, year)}
                onChange={field.handleChange}
                valueId={field.getValue()?.id}
              />
            )
          }
        </Field>

        <div className="flex gap-4 self-end">
          <Button variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Subscribe selector={(form) => !!form.errors.length}>
            {(isDisabled) => (
              <Button disabled={isDisabled || isPending} type="submit">
                Importieren
              </Button>
            )}
          </Subscribe>
        </div>

        <Subscribe selector={(form) => form.errors}>
          {(errors) =>
            !!errors.length && (
              <p className="text-danger">{errors.join(", ")}</p>
            )
          }
        </Subscribe>
        {isError && <p className="text-danger">{error.message}</p>}
      </form>
    </Modal>
  );
};
