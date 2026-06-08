import * as ImagePicker from "expo-image-picker";
import { useMemo, useState } from "react";
import { Alert, View } from "react-native";

import { Button, TextButton } from "~/components/ui/button";
import { PressableSurface } from "~/components/feedback/pressable-surface";
import { DateField } from "~/components/fields/date-field";
import { SelectField } from "~/components/fields/select-field";
import { SheetScaffold } from "~/components/layout/sheet-scaffold";
import { SystemIcon } from "~/components/ui/system-icon";
import { Text } from "~/components/ui/text";
import { TextAreaField } from "~/components/fields/text-area-field";
import { TextField } from "~/components/fields/text-field";
import { getNextSchoolDay } from "~/domain-ui/school-day";
import type { TaskAttachment } from "@stu/core";
import { useCourses, useScheduleData, useTasks } from "~/data/hooks";
import { haptics } from "~/platform/haptics";

const attachmentPalette = ["#B9D7F5", "#F5D9B9", "#D7E9C6", "#E2CEF5"] as const;

const createAttachment = (index: number, label?: string | null): TaskAttachment => ({
  id: `attachment-${Date.now()}-${index}`,
  label: label?.trim() || `Foto ${index + 1}`,
  color: attachmentPalette[index % attachmentPalette.length]!,
});

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

  const addPickedAsset = (asset: ImagePicker.ImagePickerAsset | undefined) => {
    if (!asset) {
      return;
    }

    setAttachments((current) => [
      ...current,
      createAttachment(current.length, asset.fileName ?? `Foto ${current.length + 1}`),
    ]);
    haptics.success();
  };

  const showAttachmentError = (source: "camera" | "library") => {
    haptics.warning();
    Alert.alert(
      source === "camera" ? "Kamera nicht verfügbar" : "Fotoauswahl nicht möglich",
      "Bitte versuche es erneut oder prüfe die Berechtigungen in den Systemeinstellungen.",
    );
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      haptics.warning();
      Alert.alert(
        "Kamera nicht freigegeben",
        "Du kannst die Berechtigung später in den Systemeinstellungen ändern.",
      );
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        mediaTypes: ["images"],
        quality: 0.82,
      });

      if (!result.canceled) {
        addPickedAsset(result.assets[0]);
      }
    } catch {
      showAttachmentError("camera");
    }
  };

  const pickFromLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: false,
        mediaTypes: ["images"],
        presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
        quality: 0.82,
      });

      if (!result.canceled) {
        addPickedAsset(result.assets[0]);
      }
    } catch {
      showAttachmentError("library");
    }
  };

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
                <Text weight="bold">{attachment.label}</Text>
                <Text className="pt-1 text-center text-sm opacity-70">Antippen zum Entfernen</Text>
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
