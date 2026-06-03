import { startOfDay } from "date-fns";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { Button, OutlinedButton, TextButton } from "~/components/ui/button";
import { DateField } from "~/components/fields/date-field";
import { SelectField } from "~/components/fields/select-field";
import { SheetScaffold } from "~/components/layout/sheet-scaffold";
import { Text } from "~/components/ui/text";
import { TextAreaField } from "~/components/fields/text-area-field";
import { TextField } from "~/components/fields/text-field";
import type { TaskAttachment } from "@stu/core";
import { useMockCourses, useMockTasks } from "~/mock-app/hooks";
import { haptics } from "~/utils/haptics";

const attachmentPalette = ["#B9D7F5", "#F5D9B9", "#D7E9C6", "#E2CEF5"] as const;

const createAttachment = (index: number): TaskAttachment => ({
  id: `attachment-${Date.now()}-${index}`,
  label: `Foto ${index + 1}`,
  color: attachmentPalette[index % attachmentPalette.length]!,
});

export const AddTaskSheet = ({ courseId, onClose }: { courseId?: string; onClose: () => void }) => {
  const { courses } = useMockCourses();
  const { getCourseTasks, addTask } = useMockTasks();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(startOfDay(new Date()));
  const [selectedCourseId, setSelectedCourseId] = useState<string | undefined>(courseId);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);

  const options = useMemo(
    () => courses.filter((course) => (courseId ? course.id === courseId : true)),
    [courseId, courses],
  );
  const selectedCourse = options.find((course) => course.id === selectedCourseId);
  const nextAttachmentIndex = attachments.length;
  const isValid = title.trim().length > 0 && !!selectedCourse;
  const existingTaskCount = getCourseTasks(courseId).length;
  const subtitle =
    existingTaskCount > 0
      ? `${existingTaskCount} Aufgaben sind für diesen Bereich bereits hinterlegt.`
      : "Lege eine erste Aufgabe für diesen Bereich an.";

  return (
    <SheetScaffold
      title="Aufgabe hinzufügen"
      subtitle={subtitle}
      footer={
        <View className="flex-row items-center justify-end gap-4">
          <TextButton label="Abbrechen" onPress={onClose} />
          <Button
            disabled={!isValid}
            label="Speichern"
            onPress={() => {
              if (!selectedCourseId) {
                return;
              }

              addTask({
                courseId: selectedCourseId,
                title: title.trim(),
                description: description.trim(),
                dueDate,
                attachments,
              });
              haptics.success();
              onClose();
            }}
          />
        </View>
      }
    >
      {!courseId ? (
        <SelectField
          label="Fach"
          value={selectedCourse}
          options={options}
          getKey={(course) => course.id}
          getOptionLabel={(course) => course.name}
          onChange={(course) => setSelectedCourseId(course?.id)}
        />
      ) : null}

      <TextField label="Titel" value={title} onChangeText={setTitle} />

      <TextAreaField
        label="Beschreibung"
        numberOfLines={4}
        value={description}
        onChangeText={setDescription}
        maxLength={500}
        placeholder="Beschreibe kurz, was zu erledigen ist"
      />

      {attachments.length > 0 ? (
        <>
          <Text className="px-1 text-[15px] text-[#5B6472]" weight="medium">
            Fotos
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {attachments.map((attachment) => (
              <Pressable
                key={attachment.id}
                onPress={() =>
                  setAttachments((current) =>
                    current.filter((currentAttachment) => currentAttachment.id !== attachment.id),
                  )
                }
                className="h-24 w-[47%] items-center justify-center rounded-3xl"
                style={{ backgroundColor: attachment.color }}
              >
                <Text weight="bold">{attachment.label}</Text>
                <Text className="pt-1 text-center text-sm opacity-70">Antippen zum Entfernen</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <OutlinedButton
        label="Foto hinzufügen"
        color="#76A6E5"
        onPress={() => {
          haptics.selection();
          setAttachments((current) => [...current, createAttachment(nextAttachmentIndex)]);
        }}
      />

      <DateField value={dueDate} onChange={setDueDate} label="Abgabetermin" />
    </SheetScaffold>
  );
};
