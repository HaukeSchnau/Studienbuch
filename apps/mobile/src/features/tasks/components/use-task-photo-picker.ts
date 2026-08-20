import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

import { haptics } from "~/infra/native/haptics";

const showAttachmentError = (source: "camera" | "library") => {
  haptics.warning();
  Alert.alert(
    source === "camera" ? "Kamera nicht verfügbar" : "Fotoauswahl nicht möglich",
    "Bitte versuche es erneut oder prüfe die Berechtigungen in den Systemeinstellungen.",
  );
};

export const useTaskPhotoPicker = ({
  onAssetPicked,
}: {
  onAssetPicked: (asset: ImagePicker.ImagePickerAsset) => void;
}) => {
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

      if (!result.canceled && result.assets[0]) {
        onAssetPicked(result.assets[0]);
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

      if (!result.canceled && result.assets[0]) {
        onAssetPicked(result.assets[0]);
      }
    } catch {
      showAttachmentError("library");
    }
  };

  return { pickFromLibrary, takePhoto };
};
