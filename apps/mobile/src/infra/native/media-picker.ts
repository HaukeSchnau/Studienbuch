import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as ImagePicker from "expo-image-picker";

export type MediaSource = "camera" | "library";

export class MediaPermissionDenied extends Schema.TaggedError<MediaPermissionDenied>()(
  "MediaPermissionDenied",
  { source: Schema.Literal("camera") },
) {}

export class MediaPickerUnavailable extends Schema.TaggedError<MediaPickerUnavailable>()(
  "MediaPickerUnavailable",
  {
    source: Schema.Literals(["camera", "library"]),
    reason: Schema.String,
  },
) {}

const unavailable = (source: MediaSource, cause: unknown) =>
  MediaPickerUnavailable.make({
    source,
    reason: cause instanceof Error ? cause.message : String(cause),
  });

const selectedAsset = (result: ImagePicker.ImagePickerResult) =>
  result.canceled ? Option.none() : Option.fromNullishOr(result.assets[0]);

export class MediaPicker extends Context.Service<
  MediaPicker,
  {
    readonly takePhoto: Effect.Effect<
      Option.Option<ImagePicker.ImagePickerAsset>,
      MediaPermissionDenied | MediaPickerUnavailable
    >;
    readonly pickFromLibrary: Effect.Effect<
      Option.Option<ImagePicker.ImagePickerAsset>,
      MediaPickerUnavailable
    >;
  }
>()("@stu/mobile/infra/native/media-picker/MediaPicker") {
  static readonly layer = Layer.succeed(
    MediaPicker,
    MediaPicker.of({
      takePhoto: Effect.gen(function* () {
        const permission = yield* Effect.tryPromise({
          try: () => ImagePicker.requestCameraPermissionsAsync(),
          catch: (cause) => unavailable("camera", cause),
        });
        if (!permission.granted) return yield* MediaPermissionDenied.make({ source: "camera" });
        const result = yield* Effect.tryPromise({
          try: () =>
            ImagePicker.launchCameraAsync({
              allowsEditing: false,
              mediaTypes: ["images"],
              quality: 0.82,
            }),
          catch: (cause) => unavailable("camera", cause),
        });
        return selectedAsset(result);
      }),
      pickFromLibrary: Effect.tryPromise({
        try: () =>
          ImagePicker.launchImageLibraryAsync({
            allowsMultipleSelection: false,
            mediaTypes: ["images"],
            presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
            quality: 0.82,
          }),
        catch: (cause) => unavailable("library", cause),
      }).pipe(Effect.map(selectedAsset)),
    }),
  );
}
