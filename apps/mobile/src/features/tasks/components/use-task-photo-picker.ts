import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import type * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

import { haptics } from "~/infra/native/haptics";
import { MediaPicker, type MediaSource } from "~/infra/native/media-picker";

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
  const select = async (source: MediaSource) => {
    const result = await MediaPicker.pipe(
      Effect.flatMap((picker) => (source === "camera" ? picker.takePhoto : picker.pickFromLibrary)),
      Effect.provide(MediaPicker.layer),
      Effect.result,
      Effect.runPromise,
    );
    if (Result.isFailure(result)) {
      if (result.failure._tag === "MediaPermissionDenied") {
        haptics.warning();
        Alert.alert(
          "Kamera nicht freigegeben",
          "Du kannst die Berechtigung später in den Systemeinstellungen ändern.",
        );
      } else {
        showAttachmentError(source);
      }
      return;
    }
    if (Option.isSome(result.success)) {
      onAssetPicked(result.success.value);
    }
  };

  return {
    pickFromLibrary: () => select("library"),
    takePhoto: () => select("camera"),
  };
};
