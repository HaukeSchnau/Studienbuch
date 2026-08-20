import type { ComponentRef, ReactNode } from "react";
import { useRef, useState } from "react";
import { View } from "react-native";

import { Button, TextButton } from "~/ui/button";
import { Text } from "~/ui/text";
import { SignatureField, SignatureView } from "~/domain-ui/signature-field";
import { haptics } from "~/infra/native/haptics";

interface Props {
  heading: string;
  children: ReactNode;
  major?: string;
  signatureLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: (signatureSvg: string) => void;
}

export const ConfirmPageContent = ({
  heading,
  children,
  major,
  signatureLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}: Props) => {
  const signatureRef = useRef<ComponentRef<typeof SignatureField>>(null);
  const [hasSignature, setHasSignature] = useState(false);

  return (
    <>
      <Text className="text-lg">{heading}</Text>
      <View className="h-4" />
      <Text className="text-xl">{children}</Text>
      {major && (
        <>
          <View className="h-4" />
          <Text weight="medium" className="text-xl">
            {major}
          </Text>
        </>
      )}
      <View className="h-4" />

      <SignatureField label={signatureLabel} onSignedChange={setHasSignature} ref={signatureRef} />

      <View className="h-4" />

      <View className="flex-row items-center justify-end gap-4">
        <TextButton onPress={onCancel} label="Abbrechen" />
        <Button
          disabled={!hasSignature}
          onPress={async () => {
            if (!signatureRef.current) {
              return;
            }

            const signature = await signatureRef.current.getSVG();
            if (!signature) {
              haptics.warning();
              return;
            }

            onConfirm(signature);
            haptics.success();
          }}
          label={confirmLabel}
        />
      </View>
    </>
  );
};

interface ViewProps {
  children: ReactNode;
  major?: string;
  signatureLabel: string;
  signatureSvg: string;
}

export const ViewConfirmPageContent = ({
  children,
  major,
  signatureLabel,
  signatureSvg,
}: ViewProps) => {
  if (signatureSvg === "NOT_REQUIRED") {
    return null;
  }

  return (
    <>
      <Text className="text-xl">{children}</Text>
      {major && (
        <>
          <View className="h-4" />
          <Text weight="medium" className="text-xl">
            {major}
          </Text>
        </>
      )}
      <View className="h-4" />

      <SignatureView label={signatureLabel} svg={signatureSvg} />
    </>
  );
};
