import { useEffect } from "react";
import {
  LayoutAnimation,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router, Slot, Stack, usePathname } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-form-adapter";

import type { SetupForm } from "./form";
import { shadow } from "~/components/styles/shadow";
import { Text } from "~/components/text";
import { api } from "~/utils/api";
import { useLicenseKey, useSession } from "~/utils/auth";
import { setStorage } from "~/utils/storage";
import logoImage from "../../../assets/icon.png";
import { FormContext } from "./form";

export default function HomeLayout() {
  const { height } = useAnimatedKeyboard();
  const animatedStyle = useAnimatedStyle(() => ({
    paddingBottom: height.value,
  }));

  const activateLicenseKey = api.auth.activateLicenseKey.useMutation();
  const login = api.auth.loginWithLicenseKey.useMutation();
  const joinCourses = api.students.courses.join.useMutation();

  const semester = api.schools.semesters.getCurrent.useQuery();

  const utils = api.useUtils();

  const session = useSession();
  const licenseKey = useLicenseKey();

  const form = useForm<SetupForm, ReturnType<typeof zodValidator>>({
    defaultValues: {
      licenseKey: licenseKey ?? "",
      name: session?.user?.name ?? "",
      isOfAge: session?.user?.isOfAge ?? false,
      chosenCourses: {},
    },
    validatorAdapter: zodValidator(),
    onSubmit: async ({ value, formApi }) => {
      console.log(semester);

      if (!semester.data || !value.class) {
        return; // TODO: show error
      }

      await activateLicenseKey.mutateAsync({
        licenseKey: value.licenseKey,
        name: value.name,
      });
      const { error, session } = await login.mutateAsync({
        licenseKey: value.licenseKey,
      });
      if (error) {
        formApi.setFieldMeta(error.field, (prev) => ({
          ...prev,
          errors: prev.errors.concat(error.message),
        }));

        return;
      }
      await setStorage("auth.licenseKey", value.licenseKey);
      await setStorage("auth.session", session);

      await joinCourses.mutateAsync({
        school: "igs-lil",
        semesterType: semester.data.type,
        semesterYear: semester.data.year,
        courseIds: Object.values(value.chosenCourses)
          .filter(Boolean)
          .map((course) => course.id),
        classIdentifier: value.class.identifierInYear,
        startYear: value.class.startYear,
        isOfAge: value.isOfAge,
      });

      await utils.invalidate();

      router.replace("/");
    },
  });

  const pathname = usePathname();
  useEffect(() => {
    LayoutAnimation.easeInEaseOut();
  }, [pathname]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Backdrop />

      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <SafeAreaView
          style={{
            flex: 1,
          }}
        >
          <Animated.View
            style={[
              {
                justifyContent: "center",
                alignItems: "center",
                gap: 16 * 2,
                paddingHorizontal: 32,
                height: "100%",
                flex: 1,
              },
              animatedStyle,
            ]}
          >
            <Logo />
            <View
              className="w-full rounded-3xl bg-white px-6 py-8"
              style={shadow}
            >
              <FormContext.Provider value={form}>
                <Slot />
              </FormContext.Provider>
            </View>

            <LegalText />
          </Animated.View>
        </SafeAreaView>
      </ScrollView>
    </>
  );
}

const LegalText = () => {
  return (
    <View className="gap-4 self-center">
      <TouchableOpacity
        onPress={() => openBrowserAsync("https://studienbuch.app/impressum")}
      >
        <Text className="text-md text-center text-[#6A6A6A]">Impressum</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => openBrowserAsync("https://studienbuch.app/datenschutz")}
      >
        <Text className="text-md text-center text-[#6A6A6A]">Datenschutz</Text>
      </TouchableOpacity>
    </View>
  );
};

const Logo = () => {
  return (
    <View
      className="mx-auto flex h-40 w-40 items-center justify-center rounded-full bg-[#6EB867]"
      style={shadow}
    >
      <Image
        source={logoImage}
        style={{ width: 120, height: 120, borderRadius: 50 }}
      />
    </View>
  );
};

const Backdrop = () => {
  return (
    <>
      <View className="absolute -left-36 top-36 h-72 w-72 rounded-full bg-[#9DBFEC]" />
      <View className="absolute -right-28 top-96 h-56 w-56 rounded-full bg-[#92C78E]" />
      <View className="absolute -left-24 top-[600px] h-48 w-48 rounded-full bg-[#CA9093]" />
    </>
  );
};
