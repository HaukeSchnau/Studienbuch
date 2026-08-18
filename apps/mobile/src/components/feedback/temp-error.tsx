import { Text } from "../ui/text";

export const TempError = ({ error }: { error?: string }) => (
  <Text>Es ist ein Fehler aufgetreten: {error}</Text>
);
