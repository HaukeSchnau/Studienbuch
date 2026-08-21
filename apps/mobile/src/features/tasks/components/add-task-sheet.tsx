import { Image } from "expo-image";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { Button, TextButton } from "~/ui/button";
import { PressableSurface } from "~/ui/feedback/pressable-surface";
import { DateField } from "~/ui/fields/date-field";
import { SelectField } from "~/ui/fields/select-field";
import { SheetScaffold } from "~/ui/layout/sheet-scaffold";
import { SystemIcon } from "~/ui/system-icon";
import { Text } from "~/ui/text";
import { TextAreaField } from "~/ui/fields/text-area-field";
import { TextField } from "~/ui/fields/text-field";
import { getNextSchoolDay } from "~/domain-ui/school-day";
import type { TaskAttachment } from "~/compat/mobile-v0";
import { useCourses, useScheduleData, useTasks } from "~/infra/data/hooks";
import { haptics } from "~/infra/native/haptics";
import { createTaskAttachment } from "../model/task-attachments";
import { useTaskPhotoPicker } from "./use-task-photo-picker";

export const AddTaskSheet = ({ courseId, onClose }: { courseId?: string; onClose: () => void }) => {
  const { courses } = useCourses();
  const { timetable } = useScheduleData();
  const { getCourseTasks, addTask } = useTasks();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(() => getNextSchoolDay(timetable));
  const [selectedCourseId, setSelectedCourseId] = useState<string | undefined>(courseId);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);

  const options = useMemo(
    () => courses.filter((course) => (courseId ? course.id === courseId : true)),
    [courseId, courses],
  );
  const selectedCourse = options.find((course) => course.id === selectedCourseId);
  const isValid = title.trim().length > 0 && !!selectedCourse;
  const existingTaskCount = getCourseTasks(courseId).length;
  const subtitle =
    existingTaskCount > 0
      ? `${existingTaskCount} Aufgaben sind für diesen Bereich bereits hinterlegt.`
      : "Lege eine erste Aufgabe für diesen Bereich an.";

  const { pickFromLibrary, takePhoto } = useTaskPhotoPicker({
    onAssetPicked: (asset) => {
      setAttachments((current) => {
        const nextIndex = current.length;
        return [
          ...current,
          createTaskAttachment({
            index: nextIndex,
            label: asset.fileName ?? `Foto ${nextIndex + 1}`,
            uri: asset.uri,
          }),
        ];
      });
      haptics.success();
    },
  });

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
              <PressableSurface
                key={attachment.id}
                onPress={() =>
                  setAttachments((current) =>
                    current.filter((currentAttachment) => currentAttachment.id !== attachment.id),
                  )
                }
                className="h-24 w-[47%] items-center justify-center rounded-3xl"
                borderRadius={24}
                highlightColor="rgba(9, 138, 0, 0.12)"
                haptic="impact"
                pressedScale={0.97}
                style={{ backgroundColor: attachment.color }}
              >
                {attachment.uri ? (
                  <Image
                    source={{ uri: attachment.uri }}
                    contentFit="cover"
                    style={{
                      borderRadius: 24,
                      bottom: 0,
                      left: 0,
                      position: "absolute",
                      right: 0,
                      top: 0,
                    }}
                  />
                ) : null}
                <View className="absolute inset-x-0 bottom-0 bg-black/45 px-3 py-2">
                  <Text className="text-center text-white" numberOfLines={1} weight="bold">
                    {attachment.label}
                  </Text>
                  <Text className="pt-0.5 text-center text-xs text-white/85">
                    Antippen zum Entfernen
                  </Text>
                </View>
              </PressableSurface>
            ))}
          </View>
        </>
      ) : null}

      <View className="flex-row items-center gap-3 self-stretch">
        <PressableSurface
          accessibilityLabel="Foto aus Mediathek hinzufügen"
          borderRadius={24}
          className="h-12 flex-1 flex-row items-center justify-center rounded-full border border-[#B6C0CC] bg-white px-4"
          haptic="impact"
          onPress={() => void pickFromLibrary()}
          pressedScale={0.985}
        >
          <Text weight="semi-bold" className="text-[17px] text-[#3B7FD9]">
            Foto hinzufügen
          </Text>
        </PressableSurface>
        <PressableSurface
          accessibilityLabel="Foto aufnehmen"
          borderRadius={24}
          className="h-12 w-12 items-center justify-center rounded-full bg-primary-des"
          haptic="impact"
          onPress={() => void takePhoto()}
          pressedScale={0.95}
        >
          <SystemIcon name="camera" size={22} color="#098A00" />
        </PressableSurface>
      </View>

      <DateField value={dueDate} onChange={setDueDate} label="Abgabetermin" />
    </SheetScaffold>
  );
};
