import { NativeTabs } from "~/app-shell/navigation/native-tabs";
import { colors } from "~/theme/colors";

export default function TabLayout() {
  return (
    <NativeTabs
      backgroundColor={colors.surface}
      iconColor={{
        default: "rgba(102, 102, 102, 0.88)",
        selected: colors.primary.text,
      }}
      labelStyle={{
        default: {
          color: "rgba(102, 102, 102, 0.88)",
          fontSize: 12,
          fontFamily: "Nunito_600SemiBold",
        },
        selected: {
          color: colors.primary.text,
          fontSize: 12,
          fontFamily: "Nunito_600SemiBold",
        },
      }}
      minimizeBehavior="never"
      rippleColor="rgba(9, 138, 0, 0.16)"
      tabBarRespectsIMEInsets
    >
      <NativeTabs.Trigger name="index" disableAutomaticContentInsets disableTransparentOnScrollEdge>
        <NativeTabs.Trigger.Icon
          sf={{ default: "house", selected: "house.fill" }}
          md={{ default: "home", selected: "home" }}
          selectedColor={colors.primary.text}
        />
        <NativeTabs.Trigger.Label>Übersicht</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger
        name="schedule"
        disableAutomaticContentInsets
        disableTransparentOnScrollEdge
      >
        <NativeTabs.Trigger.Icon
          sf={{ default: "calendar", selected: "calendar.circle.fill" }}
          md={{ default: "calendar_today", selected: "calendar_today" }}
          selectedColor={colors.primary.text}
        />
        <NativeTabs.Trigger.Label>Meine Woche</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger
        name="profile"
        disableAutomaticContentInsets
        disableTransparentOnScrollEdge
      >
        <NativeTabs.Trigger.Icon
          sf={{ default: "person", selected: "person.fill" }}
          md={{ default: "person", selected: "person" }}
          selectedColor={colors.primary.text}
        />
        <NativeTabs.Trigger.Label>Mein Profil</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
