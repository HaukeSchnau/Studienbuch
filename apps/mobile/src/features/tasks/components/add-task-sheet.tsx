import * as ImagePicker from "expo-image-picker";
import { useMemo, useState } from "react";
import { ActionSheetIOS, Alert, Platform, View } from "react-native";

import { Button, OutlinedButton, TextButton } from "~/components/ui/button";
import { PressableSurface } from "~/components/feedback/pressable-surface";
import { DateField } from "~/components/fields/date-field";
import { SelectField } from "~/components/fields/select-field";
import { SheetScaffold } from "~/components/layout/sheet-scaffold";
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

  const pickAttachment = async (source: "camera" | "library") => {
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      haptics.warning();
      Alert.alert(
        source === "camera" ? "Kamera nicht freigegeben" : "Fotos nicht freigegeben",
        "Du kannst die Berechtigung später in den Systemeinstellungen ändern.",
      );
      return;
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: false,
            mediaTypes: ["images"],
            quality: 0.82,
          })
        : await ImagePicker.launchImageLibraryAsync({
            allowsMultipleSelection: false,
            mediaTypes: ["images"],
            quality: 0.82,
          });

    if (!result.canceled) {
      addPickedAsset(result.assets[0]);
    }
  };

  const showAttachmentSourcePicker = () => {
    haptics.selection();

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          cancelButtonIndex: 2,
          options: ["Foto aufnehmen", "Aus Mediathek wählen", "Abbrechen"],
          title: "Foto hinzufügen",
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            void pickAttachment("camera");
          } else if (buttonIndex === 1) {
            void pickAttachment("library");
          }
        },
      );
      return;
    }

    Alert.alert("Foto hinzufügen", "Woher soll das Foto kommen?", [
      { text: "Kamera", onPress: () => void pickAttachment("camera") },
      { text: "Mediathek", onPress: () => void pickAttachment("library") },
      { style: "cancel", text: "Abbrechen" },
    ]);
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

      <OutlinedButton
        label="Foto hinzufügen"
        color={attachments.length > 0 ? "#76A6E5" : "#3B7FD9"}
        onPress={showAttachmentSourcePicker}
      />

      <DateField value={dueDate} onChange={setDueDate} label="Abgabetermin" />
    </SheetScaffold>
  );
};
