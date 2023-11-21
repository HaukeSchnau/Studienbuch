import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { colors } from "@acme/tailwind-config";

import { TRPCProvider } from "~/utils/api";

import "../styles.css";

// This is the main layout of the app
// It wraps your pages with the providers they need
const RootLayout = () => {
  return (
    <TRPCProvider>
      {/*
        The Stack component displays the current page.
        It also allows you to configure your screens 
      */}
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.green,
          },
          headerTitleStyle: {
            color: colors.white,
          },
        }}
      />
      <StatusBar />
    </TRPCProvider>
  );
};

export default RootLayout;
