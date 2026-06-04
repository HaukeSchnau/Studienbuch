import type { ComponentRef, ReactNode } from "react";
import { useRef } from "react";
import { View } from "react-native";

import { Text } from "~/components/ui/text";
import { SignatureField, SignatureView } from "~/domain-ui/signature-field";
import { haptics } from "~/platform/haptics";
import { Button, TextButton } from "~/components/ui/button";

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

      <SignatureField label={signatureLabel} ref={signatureRef} />

      <View className="h-4" />

      <View className="flex-row items-center justify-end gap-4">
        <TextButton onPress={onCancel} label="Abbrechen" />
        <Button
          onPress={async () => {
            if (!signatureRef.current) {
              return;
            }

            const signature = await signatureRef.current.getSVG();
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
