import { Text } from "../text";

export const TempError = ({ error }: { error?: string }) => (
  <Text>Es ist ein Fehler aufgetreten: {error}</Text>
);
