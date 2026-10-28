import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import type { System } from "@stu/api/System";
import { Tokens } from "@stu/ui/Tokens";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useRouter } from "expo-router";

import { ApiProtocol } from "../../infra/api/ApiProtocol.ts";
import { VirtualDevice } from "../../infra/device/VirtualDevice.ts";
import { BuildInfo } from "../../infra/updates/BuildInfo.ts";
import { Card } from "../../ui/Card.tsx";
import { HeroScreen } from "../../ui/HeroScreen.tsx";
import { CryptoSelfTest } from "./CryptoSelfTest.ts";
import { DeviceStorage } from "./DeviceStorage.ts";
import { ServerInfo } from "./ServerInfo.ts";
import { StatusRow, type StatusRowProps } from "./StatusRow.tsx";

/** "Moin!": what runs on this device, and whether its server, crypto and storage work. */
export function DiagnosticsScreen() {
  const server = useAtomValue(ServerInfo.info);
  const selfTest = useAtomValue(CryptoSelfTest.outcomes);
  const storage = useAtomValue(DeviceStorage.thisStart);
  const refreshServer = useAtomRefresh(ServerInfo.info);
  const refreshSelfTest = useAtomRefresh(CryptoSelfTest.outcomes);
  const router = useRouter();

  const refresh = () => {
    refreshServer();
    refreshSelfTest();
  };

  const serverRevision = AsyncResult.value(server).pipe(Option.map((info) => info.revision));

  return (
    <HeroScreen
      title="Moin!"
      subtitle="Das läuft auf diesem Gerät:"
      refresh={{ refreshing: server.waiting || selfTest.waiting, onRefresh: refresh }}
    >
      <Card>
        <StatusRow first {...appRow(serverRevision)} />
        <StatusRow {...serverRow(server)} />
        <StatusRow {...cryptoRow(selfTest)} onPress={() => router.push("/selbsttest")} />
        <StatusRow {...storageRow(storage)} />
      </Card>
    </HeroScreen>
  );
}

type Row = Omit<StatusRowProps, "onPress" | "first">;

const short = (id: string) => id.slice(0, 7);

const revisionName = (revision: string) =>
  revision === "unreleased" ? "Arbeitskopie" : short(revision);

const environmentName: Record<System.Environment, string> = {
  development: "Entwicklung",
  preview: "Vorschau",
  beta: "Beta",
  production: "Produktion",
};

const joined = (...parts: ReadonlyArray<string | undefined>) =>
  parts.filter((part) => part !== undefined).join(" · ");

function appRow(serverRevision: Option.Option<string>): Row {
  const accent = Tokens.subject.blue.fill;

  if (BuildInfo.servedByServer) {
    return {
      label: "App",
      title: "Im Browser",
      detail: joined(
        Option.getOrUndefined(Option.map(VirtualDevice.name, (name) => `Gerät ${name}`)),
        "vom Server ausgeliefert",
      ),
      status: "ok",
      accent,
    };
  }

  const sameAsServer =
    Option.isSome(BuildInfo.revision) && Option.isSome(serverRevision)
      ? BuildInfo.revision.value === serverRevision.value
      : undefined;

  return {
    label: "App",
    title: Option.match(BuildInfo.revision, { onNone: () => "Arbeitskopie", onSome: short }),
    detail: Option.match(BuildInfo.update, {
      onNone: () => "Entwicklungsbuild, ohne Updates",
      onSome: (update) =>
        joined(
          `Update ${short(update.id)}${update.embedded ? " (eingebaut)" : ""}`,
          Option.getOrUndefined(Option.map(update.runtimeVersion, (v) => `Laufzeit ${short(v)}`)),
          Option.getOrUndefined(update.channel),
          sameAsServer === undefined
            ? undefined
            : sameAsServer
              ? "wie der Server"
              : "anders als der Server",
        ),
    }),
    status: "ok",
    accent,
  };
}

function serverRow(server: AsyncResult.AsyncResult<System.Info, { readonly _tag: string }>): Row {
  const accent = Tokens.subject.violet.fill;
  const host = Option.getOrUndefined(ApiProtocol.host);

  return AsyncResult.matchWithError(server, {
    onInitial: () => ({
      label: "Server",
      title: "Wird gefragt …",
      detail: host,
      status: "pending",
      accent,
    }),
    onError: (error) => ({
      label: "Server",
      title: "Nicht erreichbar",
      detail:
        error._tag === "ApiProtocol.NoServer" ? "Diesem Build fehlt die Server-Adresse" : host,
      status: "failed",
      accent,
    }),
    onDefect: () => ({
      label: "Server",
      title: "Antwort unlesbar",
      detail: host,
      status: "failed",
      accent,
    }),
    onSuccess: ({ value }) => ({
      label: "Server",
      title: revisionName(value.revision),
      detail: joined(environmentName[value.environment], host),
      status: server.waiting ? "pending" : "ok",
      accent,
    }),
  });
}

function cryptoRow(selfTest: AsyncResult.AsyncResult<ReadonlyArray<CryptoSelfTest.Outcome>>): Row {
  const label = "Verschlüsselung";
  const accent = Tokens.subject.teal.fill;

  return Option.match(AsyncResult.value(selfTest), {
    onNone: () => ({ label, title: "Wird geprüft …", status: "pending", accent }),
    onSome: (outcomes) => {
      const passed = outcomes.filter((outcome) => outcome.status === "passed");
      const failed = outcomes.find((outcome) => outcome.status === "failed");
      const missing = outcomes.filter((outcome) => outcome.status === "unsupported");

      return {
        label,
        title: `${passed.length} von ${outcomes.length} bestanden`,
        detail:
          failed === undefined
            ? missing.length === 0
              ? "AES-GCM, HKDF, Ed25519, X25519, ML-KEM, X-Wing"
              : `${missing.map((outcome) => outcome.name).join(", ")} fehlt hier`
            : `${failed.name}: ${failed.detail}`,
        status: selfTest.waiting ? "pending" : failed === undefined ? "ok" : "failed",
        accent,
      };
    },
  });
}

function storageRow(
  storage: AsyncResult.AsyncResult<DeviceStorage.Report, { readonly _tag: string }>,
): Row {
  const label = "Speicher";
  const accent = Tokens.subject.amber.fill;

  return AsyncResult.matchWithError(storage, {
    onInitial: () => ({ label, title: "Wird geöffnet …", status: "pending", accent }),
    onError: (error) => ({
      label,
      title: "Nicht verfügbar",
      detail:
        error._tag === "Keychain.Unavailable"
          ? "Der Schlüssel im Schlüsselbund ist nicht lesbar"
          : "Die Datenbank lässt sich nicht öffnen",
      status: "failed",
      accent,
    }),
    onDefect: () => ({ label, title: "Nicht verfügbar", status: "failed", accent }),
    onSuccess: ({ value }) => ({
      label,
      title: `${value.starts}. Start`,
      detail: Option.match(value.cipher, {
        onNone: () => `SQLite ${value.sqlite}, eigener Ordner im Browser`,
        onSome: (cipher) =>
          `SQLCipher ${cipher.version.split(" ")[0]} (${cipher.provider}), Schlüssel im Schlüsselbund`,
      }),
      status: "ok",
      accent,
    }),
  });
}
