import { ThreeDot } from "react-loading-indicators";

import { colors } from "@schnau/tailwind-config/base";

export const LoadingIndicator = () => {
  return (
    <ThreeDot
      variant="pulsate"
      color={colors.green}
      size="medium"
      text="Lade..."
      textColor="#253d2c"
    />
  );
};
