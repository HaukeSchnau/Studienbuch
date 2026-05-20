import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import StudienbuchInlineModule from "../native/StudienbuchInlineModule";
import StudienbuchLocalModule from "../../modules/native-module-demo";

type ModuleCardProps = {
  title: string;
  purpose: string;
  moduleKind: string;
  boundary: string;
  platformSummary: string;
};

function ModuleCard({ title, purpose, moduleKind, boundary, platformSummary }: ModuleCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardEyebrow}>{moduleKind} native module</Text>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardText}>{purpose}</Text>
      <View style={styles.factList}>
        <Text style={styles.factLabel}>Source boundary</Text>
        <Text style={styles.factValue}>{boundary}</Text>
        <Text style={styles.factLabel}>Native result</Text>
        <Text style={styles.factValue}>{platformSummary}</Text>
      </View>
    </View>
  );
}

export default function Index() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Expo native code showcase</Text>
        <Text style={styles.title}>Two ways to own native code</Text>
        <Text style={styles.intro}>
          This screen calls one inline module that lives inside the mobile app and one local Expo
          module that lives in its own module boundary.
        </Text>

        <ModuleCard
          title="Inline module"
          purpose="Use this for a small native capability that belongs to this app and does not need its own package shape yet."
          moduleKind={StudienbuchInlineModule.moduleKind}
          boundary={StudienbuchInlineModule.getModuleBoundary()}
          platformSummary={StudienbuchInlineModule.getPlatformSummary()}
        />

        <ModuleCard
          title="Local Expo module"
          purpose="Use this once the native capability is large enough to deserve its own module files, native registration config, and JS entrypoint."
          moduleKind={StudienbuchLocalModule.moduleKind}
          boundary={StudienbuchLocalModule.getModuleBoundary()}
          platformSummary={StudienbuchLocalModule.getPlatformSummary()}
        />

        <Text style={styles.footer}>
          Running on {Platform.OS}. Rebuild the native app after changing Swift or Kotlin.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f4f2ed",
  },
  content: {
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  eyebrow: {
    color: "#5f6658",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  title: {
    color: "#11150f",
    fontSize: 32,
    fontWeight: "800",
  },
  intro: {
    color: "#384033",
    fontSize: 17,
    lineHeight: 24,
  },
  card: {
    gap: 10,
    borderColor: "#d7d2c7",
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "#fffdfa",
    padding: 16,
  },
  cardEyebrow: {
    color: "#66705d",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  cardTitle: {
    color: "#151912",
    fontSize: 22,
    fontWeight: "800",
  },
  cardText: {
    color: "#3f4739",
    fontSize: 15,
    lineHeight: 21,
  },
  factList: {
    gap: 4,
    borderTopColor: "#e7e1d6",
    borderTopWidth: 1,
    paddingTop: 10,
  },
  factLabel: {
    color: "#6a725f",
    fontSize: 12,
    fontWeight: "700",
  },
  factValue: {
    color: "#171b14",
    fontSize: 15,
    lineHeight: 21,
  },
  footer: {
    color: "#5b6354",
    fontSize: 13,
    lineHeight: 18,
  },
});
