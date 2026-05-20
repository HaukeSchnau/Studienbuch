import { mobileTabs } from "@/navigation/mobileTabs";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { StatusBar } from "expo-status-bar";
import { Fragment } from "react";
import "../global.css";

export default function RootLayout() {
  return (
    <Fragment>
      <StatusBar style="auto" />
      <NativeTabs
        backBehavior="history"
        labelVisibilityMode="labeled"
        minimizeBehavior="automatic"
        sidebarAdaptable
      >
        {mobileTabs.map((tab) => (
          <NativeTabs.Trigger key={tab.name} name={tab.name}>
            <NativeTabs.Trigger.Icon {...tab.icon} />
            <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        ))}
      </NativeTabs>
    </Fragment>
  );
}
