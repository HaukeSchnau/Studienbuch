import { startOfDay } from "date-fns";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Button, TextButton } from "~/components/button";
import { DateField } from "~/components/date-field";
import { Divider } from "~/components/divider";
import { SelectField } from "~/components/select-field";
import { SheetScaffold } from "~/components/sheet-scaffold";
import { Text } from "~/components/text";
import { TextAreaField } from "~/components/text-area-field";
import { TextField } from "~/components/text-field";
import { haptics } from "~/utils/haptics";
import type { TaskAttachment } from "~/mock-app/domain";
import { useMockApp } from "~/mock-app/provider";

const attachmentPalette = ["#B9D7F5", "#F5D9B9", "#D7E9C6", "#E2CEF5"] as const;

const createAttachment = (index: number): TaskAttachment => ({
  id: `attachment-${Date.now()}-${index}`,
  label: `Foto ${index + 1}`,
  color: attachmentPalette[index % attachmentPalette.length]!,
});

export const AddTaskSheet = ({ courseId, onClose }: { courseId?: string; onClose: () => void }) => {
  const { getCourseTasks, addTask, courses } = useMockApp();
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
        <>
          <SelectField
            label="Fach"
            value={selectedCourse}
            options={options}
            getKey={(course) => course.id}
            getOptionLabel={(course) => course.name}
            onChange={(course) => setSelectedCourseId(course?.id)}
          />
          <View className="h-4" />
        </>
      ) : null}

      <TextField autoFocus label="Titel" value={title} onChangeText={setTitle} />
      <View className="h-4" />

      <TextAreaField
        label="Beschreibung"
        numberOfLines={4}
        value={description}
        onChangeText={setDescription}
        maxLength={500}
        placeholder="Beschreibe kurz, was zu erledigen ist"
      />

      <View className="h-4" />

      {attachments.length > 0 ? (
        <>
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
          <View className="h-2" />
        </>
      ) : null}

      <TextButton
        label="Foto hinzufügen"
        onPress={() => {
          haptics.selection();
          setAttachments((current) => [...current, createAttachment(nextAttachmentIndex)]);
        }}
      />

      <Divider />
      <View className="h-4" />
      <DateField value={dueDate} onChange={setDueDate} label="Abgabetermin" />
    </SheetScaffold>
  );
};
