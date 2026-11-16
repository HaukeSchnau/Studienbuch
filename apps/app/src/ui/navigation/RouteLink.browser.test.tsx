import { assert, expect, it } from "@effect/vitest";
import { Text } from "react-native";

import { render } from "../../infra/testing/render.tsx";
import { RouteLink } from "./RouteLink.tsx";

const screen = (title: string) => () => <Text>{title}</Text>;

// The sign-in screens' links loaded the whole app on the web: a white screen, and the tab fell back
// from `?device=` to the browser's own device.
it("follows a link to a screen of the app without loading the page", async () => {
  await using view = await render(<RouteLink label="Anmelden" href="/anmelden" />, {
    routes: { anmelden: screen("Bei Studienbuch anmelden") },
  });

  const link = view.getByRole("link", { name: "Anmelden" });

  // Still an anchor, so the browser can open it in a new tab.
  await expect.element(link).toHaveAttribute("href", "/anmelden");
  await link.click();

  assert.deepStrictEqual(view.pageLoads, []);
  await expect.element(view.getByText("Bei Studienbuch anmelden")).toBeVisible();
});

it("runs its own press, then follows the link", async () => {
  const pressed: Array<string> = [];

  await using view = await render(
    <RouteLink label="Abbrechen" href="/aktivieren" onPress={() => pressed.push("Abbrechen")} />,
    { routes: { aktivieren: screen("Willkommen!") } },
  );

  await view.getByRole("link", { name: "Abbrechen" }).click();

  assert.deepStrictEqual(
    { pressed, pageLoads: view.pageLoads },
    { pressed: ["Abbrechen"], pageLoads: [] },
  );
  await expect.element(view.getByText("Willkommen!")).toBeVisible();
});

it("goes back to a screen with dismissTo without loading the page", async () => {
  await using view = await render(
    <RouteLink label="Zurück zur Anmeldung" href="/anmelden" dismissTo />,
    { routes: { anmelden: screen("Bei Studienbuch anmelden") } },
  );

  await view.getByRole("link", { name: "Zurück zur Anmeldung" }).click();

  assert.deepStrictEqual(view.pageLoads, []);
  await expect.element(view.getByText("Bei Studienbuch anmelden")).toBeVisible();
});
